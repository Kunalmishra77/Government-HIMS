-- Laboratory schema: lab_specimens, lab_tests, lab_reflex_suggestions — Phase 4, Task 1.
--
-- Field lists verified directly against the live client store (not just the task brief):
-- src/store/useLabOrdersStore.ts (Specimen, TestRun, AnalyteResult, MicrobioResult,
-- ReflexSuggestion, TestStatus, RejectReason, MicroPhase) and src/lib/labCatalog.ts
-- (Bench, SpecimenType, Priority). Differences found vs. the brief's assumed shape:
--
--   * Specimen.collectedBy is a free-text name (e.g. "Phlebo Saira"), NOT a profiles
--     uuid — phlebotomists aren't necessarily authenticated profiles rows in this
--     store. Stored as plain text, no FK.
--   * Specimen has a `volume` field the brief omitted — added.
--   * TestRun.assignedTo / enteredBy / verifiedBy are LabTech objects ({id, name,
--     bench?}) from a separate lab-roster concept (TECH_RAVI, DR_PATHO, and even a
--     synthetic 'ANLZ' analyzer actor for auto-feed) — NOT profiles uuids, and 'ANLZ'
--     could never satisfy a profiles FK. Stored as jsonb, same treatment as
--     analytes/micro/callback.
--   * TestRun.recollectReason (separate from rejectReason — set when a whole test is
--     sent back for recollection), notes, and acknowledgedAt were missing from the
--     brief's column list — added.
--   * ReflexSuggestion carries patientName and triggerSummary (display snapshot
--     fields used by the reflex queue UI) which the brief's DDL omitted — added.
--   * Priority ('STAT'|'Urgent'|'Routine') is a genuine closed enum in the store
--     (labCatalog.ts), not a free-form text column defaulting to 'Routine' as the
--     brief assumed — modeled as lab_priority_t.
--
-- All other shapes (TestStatus's 9 values, RejectReason's 6 values, Bench's 6 values,
-- SpecimenType's 7 values) matched the brief exactly.

create type lab_specimen_type_t as enum
  ('EDTA', 'serum', 'urine_cup', 'blood_culture', 'swab', 'sputum', 'tissue');
create type lab_test_status_t as enum (
  'awaiting_collection', 'collected', 'on_bench', 'in_progress',
  'entered', 'verified', 'released', 'rejected', 'recollect_requested'
);
create type lab_reject_reason_t as enum
  ('hemolyzed', 'clotted', 'insufficient', 'wrong_tube', 'unlabeled', 'contaminated');
create type lab_bench_t as enum ('HEMA', 'BIOCHEM', 'IMMUNO', 'URINE', 'MICRO', 'HISTO');
create type lab_priority_t as enum ('STAT', 'Urgent', 'Routine');

create table lab_specimens (
  id             text primary key,               -- accession, e.g. 'ACC-1042'
  order_id       text not null references orders(id),
  type           lab_specimen_type_t not null,
  container      text not null,
  collected_by   text,                            -- free-text name, e.g. 'Phlebo Saira' — not a profiles FK
  collected_at   timestamptz,
  volume         text,
  reject_reason  lab_reject_reason_t
);
create index lab_specimens_order_idx on lab_specimens(order_id);

create table lab_tests (
  id                 text primary key,             -- 'LT-...'
  order_id           text not null references orders(id),
  specimen_id        text references lab_specimens(id),
  code               text not null,
  name               text not null,
  bench              lab_bench_t not null,
  priority           lab_priority_t not null default 'Routine',
  status             lab_test_status_t not null default 'awaiting_collection',
  assigned_to        jsonb,                        -- LabTech {id, name, bench?} | null
  entered_by         jsonb,                        -- LabTech | null
  verified_by        jsonb,                        -- LabTech | null
  released_at        timestamptz,
  reject_reason      lab_reject_reason_t,
  recollect_reason   lab_reject_reason_t,
  expected_tat_min   integer not null default 60,
  ordered_at         timestamptz not null default now(),
  analytes           jsonb not null default '[]',  -- AnalyteResult[]
  micro              jsonb,                         -- MicrobioResult | null
  callback           jsonb,                         -- {calledBy, calledAt, recipient, ackBy?} | null
  notes              text,
  acknowledged_at    timestamptz,
  updated_at         timestamptz not null default now()
);
create index lab_tests_order_idx on lab_tests(order_id);
create index lab_tests_active_idx on lab_tests(status) where status not in ('released', 'rejected');
create index lab_tests_assigned_idx on lab_tests(assigned_to) where assigned_to is not null;

create table lab_reflex_suggestions (
  id                 text primary key,
  based_on_test_id   text not null references lab_tests(id),
  patient_name       text not null,
  trigger_summary    text not null,
  code               text not null,
  reason             text not null,
  ordered_at         timestamptz,
  created_at         timestamptz not null default now()
);

alter table lab_specimens enable row level security;
alter table lab_tests enable row level security;
alter table lab_reflex_suggestions enable row level security;

-- Lab role: full read/write on all three (bench routing means any lab tech may need
-- to see/act on any bench's work, per the existing store's incharge-command-center
-- and cross-bench visibility) — but never blanket without a role check.
create policy lab_specimens_all_lab on lab_specimens for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab', 'admin')));
create policy lab_tests_all_lab on lab_tests for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab', 'admin')));
create policy lab_reflex_all_lab on lab_reflex_suggestions for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab', 'admin')));

-- Doctor: read-only, own patients' tests (via the orders table they own).
create policy lab_tests_select_doctor on lab_tests for select
  using (exists (select 1 from orders o where o.id = lab_tests.order_id and o.doctor_id = auth.uid()));

-- Explicitly deferred (out of scope for this task): doctor read access to
-- lab_specimens/lab_reflex_suggestions, reception/admin oversight reads,
-- patient-self read access — none of these are exercised by the current store.
