-- IPD schema: ipd_stays + ipd_vitals — Phase 7, Task 1.
--
-- Field list verified directly against the live client stores:
-- src/store/useInpatientStore.ts (Inpatient, IpdStage, Condition, Round,
-- MedOrder, TestOrder, ProgressNote, Discharge, IpdEvent, IvLine, WardVitals,
-- IoEntry, VitalsRecord, MarRecord, Referral, IcuTransfer, OtBooking, Surgery)
-- and src/store/useAdmissionStore.ts (AdmissionRequest, for the FK).
--
-- Design decisions are documented in this plan's Task 1 preamble and Global
-- Constraints section: single ipd_stays table with jsonb nested shapes;
-- ipd_vitals as its own independently-written table; free-text gender/bed/
-- ward/admitting_doctor; shared discharge jsonb column (canonical pillar set
-- 'clinical'|'nursing'|'pharmacy'|'billing'|'insurance'); OT/surgery status-
-- only jsonb. `systolic_bp`/`diastolic_bp` (not the store's `systolicBP`/
-- `diastolicBP`) and `latest_bp` (not `latestBP`) — _core.ts's naive
-- camelCase<->snake_case conversion cannot round-trip two adjacent uppercase
-- letters, same reasoning as Lab's expected_tat_min/expectedTatMin.

create type ipd_stage_t as enum (
  'admitted', 'under_treatment', 'pre_op', 'in_surgery', 'post_op',
  'recovering', 'discharge_initiated', 'discharged'
);
create type ipd_condition_t as enum ('Critical', 'Serious', 'Stable', 'Improving', 'Discharge-ready');

create table ipd_stays (
  id                    text primary key,                  -- 'IPD-...'
  admission_request_id  text not null references admission_requests(id),
  patient_id            text not null references patients(id),
  patient_name          text not null,
  age                   integer,
  gender                text,
  bed                   text not null,
  ward                  text not null,
  admitting_doctor      text not null,
  diagnosis             text not null,
  admitted_at           timestamptz not null default now(),
  expected_discharge    text,
  stage                 ipd_stage_t not null default 'admitted',
  condition             ipd_condition_t not null,
  rounds                jsonb not null default '[]',
  meds                  jsonb not null default '[]',
  tests                 jsonb not null default '[]',
  diet                  text,
  surgery               jsonb,
  progress_notes        jsonb not null default '[]',
  discharge             jsonb,
  events                jsonb not null default '[]',
  referrals             jsonb,
  icu_transfer          jsonb,
  ot_booking            jsonb,
  code_status           text,
  allergies             text[],
  comorbidities         text[],
  latest_hb_a1c         numeric,
  latest_bp             text,
  iv_lines              jsonb not null default '[]',
  latest_vitals         jsonb,
  dismissed_insight     boolean not null default false,
  mar                   jsonb not null default '[]',
  nurse_ack             text[] not null default '{}',
  io                    jsonb not null default '[]',
  updated_at            timestamptz not null default now()
);
create index ipd_stays_patient_idx on ipd_stays(patient_id);
create index ipd_stays_admission_request_idx on ipd_stays(admission_request_id);
create index ipd_stays_active_idx on ipd_stays(stage) where stage != 'discharged';

alter table ipd_stays enable row level security;

-- Reception/admin materialize the row at admit time (Task 3's "order
-- rewire") — the bed-manager/admission-desk portal is the actor performing
-- this write, not the requesting doctor. Tightened per Lab/Radiology's
-- lesson: a fresh insert can only represent a just-admitted stay.
create policy ipd_stays_insert_reception on ipd_stays for insert
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin'))
    and stage = 'admitted'
    and rounds = '[]'::jsonb and meds = '[]'::jsonb and tests = '[]'::jsonb
    and progress_notes = '[]'::jsonb and mar = '[]'::jsonb and io = '[]'::jsonb
    and iv_lines = '[]'::jsonb and nurse_ack = '{}'::text[]
    and discharge is null and surgery is null and icu_transfer is null and ot_booking is null
  );
create policy ipd_stays_select_reception on ipd_stays for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')));

-- Doctor + nurse: full read/write at any stage — every subsequent bridge
-- task (rounds, meds, vitals cache, tests, referrals, surgery status,
-- discharge) is a doctor- or nurse-portal action against this same row,
-- mirroring Lab/Radiology's "any staff member may act on any record at any
-- stage" reasoning.
create policy ipd_stays_all_clinical on ipd_stays for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')));

-- Patient: read-only, own stay only (mirrors the patient portal's shared
-- events/patientText view of this exact record).
create policy ipd_stays_select_patient on ipd_stays for select
  using (exists (select 1 from patients p where p.id = ipd_stays.patient_id and p.auth_user_id = auth.uid()));

create type ipd_o2_delivery_t as enum ('Room air', 'Nasal cannula', 'Face mask', 'Non-rebreather', 'Ventilator');
create type ipd_consciousness_t as enum ('A', 'V', 'P', 'U');

create table ipd_vitals (
  id                text primary key,                      -- 'IPV-...'
  ipd_stay_id       text not null references ipd_stays(id),
  patient_id        text not null references patients(id),
  recorded_at       timestamptz not null default now(),
  recorded_by       uuid not null references profiles(id),
  recorded_by_name  text not null,
  hr                integer,
  systolic_bp       integer,
  diastolic_bp      integer,
  rr                integer,
  spo2              integer,
  o2_delivery       ipd_o2_delivery_t,
  o2_flow           numeric,
  temp              numeric,
  pain              smallint,
  blood_glucose     numeric,
  consciousness     ipd_consciousness_t,
  gcs               smallint,
  weight            numeric,
  height            numeric,
  capillary_refill  numeric,
  urine_output      numeric,
  note              text
);
create index ipd_vitals_stay_idx on ipd_vitals(ipd_stay_id);
create index ipd_vitals_patient_idx on ipd_vitals(patient_id);

alter table ipd_vitals enable row level security;

create policy ipd_vitals_all_clinical on ipd_vitals for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')));

create policy ipd_vitals_select_patient on ipd_vitals for select
  using (exists (select 1 from patients p where p.id = ipd_vitals.patient_id and p.auth_user_id = auth.uid()));
