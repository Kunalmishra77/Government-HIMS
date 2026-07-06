-- Radiology schema: radiology_studies — Phase 5, Task 1.
--
-- Field list verified directly against the live client store:
-- src/store/useRadiologyStudiesStore.ts (RadiologyStudy, StudyStatus, RadSource,
-- PaymentMode, RadTech, Attachment, AiFinding, DoseRecord, QualityFlags,
-- DistributionEntry, Escalation, VerificationLevel) and src/lib/radiologyCatalog.ts
-- (Modality, Priority).
--
-- Design decision — single table, jsonb for every nested/compound shape (mirrors
-- Lab Task 1's precedent for analytes/micro/callback): attachments, reportSections,
-- aiFindings, doseRecord, qualityFlags, escalation, distribution, callback, and the
-- RadTech actor fields (acquiringBy/readingBy/verifiedBy/residentReadBy) are ALL
-- jsonb. No child table: unlike Lab's specimen/test split (genuinely separate
-- real-world objects with independent lifecycles and, at points, different
-- actors), a RadiologyStudy is one order = one study = one row throughout its
-- whole lifecycle, and every nested shape here is written by the same
-- radiology-role actor set under the same RLS policy — no distinct access-control
-- need was found for any of them.
--
-- expected_tat_min (not the store's `expectedTATmin` spelling) for the same
-- reason as Lab's lab_tests.expected_tat_min/expectedTatMin: _core.ts's naive
-- per-character camelCase<->snake_case conversion would mangle `expectedTATmin`
-- into `expected_t_a_tmin`.

create type rad_source_t as enum ('OPD', 'IPD', 'ICU', 'OT', 'ER');
create type rad_payment_mode_t as enum ('Cash', 'UPI', 'Card', 'Insurance', 'Credit');
create type rad_study_status_t as enum (
  'ordered', 'scheduled', 'arrived', 'acquiring', 'acquired',
  'reading', 'reported', 'verified', 'released', 'cancelled'
);
create type rad_modality_t as enum ('XR', 'CT', 'MRI', 'US', 'MAMMO', 'NM');
create type rad_priority_t as enum ('Routine', 'Urgent', 'STAT', 'Trauma', 'Stroke', 'Critical');
create type rad_verification_level_t as enum ('resident', 'consultant');

create table radiology_studies (
  id                     text primary key,               -- 'RS-...'
  order_id               text not null references orders(id),
  patient_id             text not null,
  patient_name           text not null,
  source                 rad_source_t not null,
  ward_bed               text,
  doctor_name            text not null,
  payment_mode           rad_payment_mode_t not null,
  clinical_question      text,
  code                   text not null,
  name                   text not null,
  modality               rad_modality_t not null,
  body_part              text not null,
  priority               rad_priority_t not null default 'Routine',
  contrast_consented     boolean,
  status                 rad_study_status_t not null default 'ordered',
  scheduled_for          timestamptz,
  arrived_at             timestamptz,
  acquiring_by           jsonb,                          -- RadTech {id, name} | null
  acquired_at            timestamptz,
  attachments            jsonb not null default '[]',    -- Attachment[]
  reading_by             jsonb,                          -- RadTech | null
  report_sections        jsonb not null default '{}',    -- Record<string, string>
  ai_prelim              text,
  reported_at            timestamptz,
  verified_by            jsonb,                          -- RadTech | null
  verified_at            timestamptz,
  released_at            timestamptz,
  callback               jsonb,                          -- {calledBy, calledAt, recipient} | null
  expected_tat_min       integer not null default 60,
  ordered_at             timestamptz not null default now(),
  acknowledged_at        timestamptz,
  cancel_reason          text,
  no_show_risk           numeric,
  predicted_duration_min integer,
  dose_record            jsonb,                          -- DoseRecord | null
  ai_findings            jsonb,                          -- AiFinding[] | null
  quality_flags          jsonb,                          -- QualityFlags | null
  verification_level     rad_verification_level_t,
  resident_read_by       jsonb,                          -- RadTech | null
  escalation             jsonb,                          -- Escalation | null
  distribution           jsonb,                          -- DistributionEntry[] | null
  comparison_prior_id    text,
  updated_at             timestamptz not null default now()
);
create index radiology_studies_order_idx on radiology_studies(order_id);
create index radiology_studies_active_idx on radiology_studies(status)
  where status not in ('released', 'cancelled');

alter table radiology_studies enable row level security;

-- Radiology role: full read/write (any radiology staff member may need to act on
-- any study at any lifecycle stage — schedule, acquire, read, verify — per the
-- existing store's own design, mirroring Lab's cross-bench reasoning).
create policy radiology_studies_all_radiology on radiology_studies for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('radiology', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('radiology', 'admin')));

-- Doctor: read-only, own patients' studies (via the orders table they own).
create policy radiology_studies_select_doctor on radiology_studies for select
  using (exists (select 1 from orders o where o.id = radiology_studies.order_id and o.doctor_id = auth.uid()));

-- Explicitly deferred (out of scope for this task): doctor INSERT access (Task 3
-- adds this once the order-rewire bridge needs it, mirroring Lab Task 3's
-- discovery), reception/admin oversight reads, patient-self read access — none
-- of these are exercised by the current store.
