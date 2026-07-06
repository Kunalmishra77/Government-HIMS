-- Doctor consultation schema: encounters (clinical notes), prescriptions (signed Rx),
-- orders (lab/radiology/drug/procedure/referral) — Phase 3, Task 1.
--
-- Field lists verified directly against the live zod schemas (not just the task brief):
-- src/lib/api/encounters.ts (EncounterSchema), src/lib/api/prescriptions.ts
-- (PrescriptionSchema/RxLineSchema/SafetyEnvelopeSchema), src/lib/api/orders.ts
-- (OrderSchema/OrderItemSchema). All three matched the brief's assumed field list exactly.

create type encounter_kind_t as enum ('SOAP', 'Progress', 'Discharge', 'Triage', 'OnlineConsult');

create table encounters (
  id                     text primary key,             -- 'ENC-...'
  visit_id               text not null references visits(id),
  patient_id             text not null references patients(id),
  doctor_id              uuid not null references profiles(id),
  doctor_name            text not null,
  started_at             timestamptz not null default now(),
  ended_at               timestamptz,
  kind                   encounter_kind_t not null default 'SOAP',
  subjective             text,
  objective              text,
  assessment             text,
  plan                   text,
  note_markdown          text,
  ai_pre_brief_accepted  boolean,
  signed_at              timestamptz
);
create index encounters_visit_idx on encounters(visit_id);
create index encounters_patient_idx on encounters(patient_id);
create index encounters_doctor_idx on encounters(doctor_id);

create type prescription_status_t as enum ('draft', 'signed', 'dispensing', 'dispensed', 'cancelled');

create table prescriptions (
  id            text primary key,                      -- 'RX-...'
  encounter_id  text references encounters(id),
  visit_id      text references visits(id),
  patient_id    text not null references patients(id),
  doctor_id     uuid not null references profiles(id),
  doctor_name   text not null,
  signed_at     timestamptz,
  status        prescription_status_t not null default 'draft',
  lines         jsonb not null default '[]',    -- RxLineSchema[]
  safety        jsonb,                          -- SafetyEnvelopeSchema | null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index prescriptions_patient_idx on prescriptions(patient_id);
create index prescriptions_doctor_idx on prescriptions(doctor_id);
create index prescriptions_visit_idx on prescriptions(visit_id);

create type order_kind_t as enum ('lab', 'radiology', 'drug', 'procedure', 'referral');
create type order_urgency_t as enum ('routine', 'urgent', 'stat');
create type order_status_t as enum
  ('draft', 'sent', 'received', 'collecting', 'in_progress', 'reported', 'verified', 'released', 'cancelled');

create table orders (
  id            text primary key,                      -- 'ORD-...'
  visit_id      text references visits(id),
  encounter_id  text references encounters(id),
  patient_id    text not null references patients(id),
  doctor_id     uuid not null references profiles(id),
  doctor_name   text,
  kind          order_kind_t not null,
  urgency       order_urgency_t not null default 'routine',
  status        order_status_t not null default 'draft',
  indication    text,
  items         jsonb not null default '[]',    -- OrderItemSchema[]
  modality      text,
  bench         text,
  sent_at       timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index orders_patient_idx on orders(patient_id);
create index orders_doctor_idx on orders(doctor_id);
create index orders_visit_idx on orders(visit_id);
create index orders_active_idx on orders(kind, status) where status not in ('released', 'cancelled');

alter table encounters enable row level security;
alter table prescriptions enable row level security;
alter table orders enable row level security;

-- Doctor: full access to their own encounters/prescriptions/orders.
create policy encounters_all_doctor on encounters for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy prescriptions_all_doctor on prescriptions for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy orders_all_doctor on orders for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

-- Reception/admin: read-only oversight across all three (continuity of care, no write access here).
create policy encounters_select_staff on encounters for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));
create policy prescriptions_select_staff on prescriptions for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));
create policy orders_select_staff on orders for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));

-- Explicitly deferred (out of scope for this task, triggered by their own later phases):
-- lab/radiology role read/update access on orders, pharmacy role read access on
-- prescriptions, patient-self read access on any of these three tables.
