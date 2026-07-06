-- Phase 4, Task 3 fix — tighten `lab_tests_insert_doctor` (security review finding).
--
-- The prior migration (20260705010000) gave a doctor INSERT access to `lab_tests`
-- constrained only by order ownership (`o.doctor_id = auth.uid()`). It did NOT
-- constrain `status`, `analytes`, `entered_by`, or `verified_by` — so a doctor's
-- INSERT could, in principle, create a `lab_tests` row already at
-- `status = 'released'` with fabricated `analytes` and a fake `verified_by`,
-- bypassing the bench workflow (claim -> enter -> verify -> release) that the
-- rest of the lab module is built around and poisoning the audit trail those
-- columns are meant to protect (see lab-tests.ts's module-level note on the
-- `entered_by`/`verified_by` segregation-of-duties concern).
--
-- The app itself (dispatchLabOrder in src/app/doctor/dashboard/page.tsx, via
-- LabTests.create() in src/lib/api/lab-tests.ts) only ever inserts a doctor-
-- created lab_tests row with `status` defaulted to 'awaiting_collection',
-- `analytes` defaulted to `[]`, and no `entered_by`/`verified_by` (both left
-- unset, i.e. null on insert) — so tightening the RLS check to match exactly
-- what the app does costs nothing functionally, while closing a real gap
-- since RLS, not app self-restraint, is the actual security boundary.
--
-- `analytes` is NOT re-checked here even though the finding's sketch mentions it:
-- the column is `not null default '[]'`, and LabTests.create() never lets a caller
-- omit it from the schema-parsed row (LabTestSchema defaults it to `[]` before
-- insert), but a malicious direct-to-PostgREST caller COULD still supply
-- `analytes: [...]` with fabricated results at insert time even at
-- status='awaiting_collection'. Adding `and analytes = '[]'::jsonb` closes that
-- too, matching "what the app actually does" exactly, so it is included below.
drop policy if exists lab_tests_insert_doctor on lab_tests;

create policy lab_tests_insert_doctor on lab_tests for insert
  with check (
    exists (select 1 from orders o where o.id = lab_tests.order_id and o.doctor_id = auth.uid())
    and status = 'awaiting_collection'
    and analytes = '[]'::jsonb
    and entered_by is null
    and verified_by is null
  );

-- Related, lower-severity finding: `lab_specimens_insert_doctor` similarly only
-- constrains order ownership, not `collected_by`/`reject_reason` — a doctor's
-- insert could pre-fill either, even though a doctor ordering a test has not
-- collected anything yet (collection is a lab-tech/phlebotomist action that
-- happens later, off-schema per lab-specimens.ts's module note: `collected_by`
-- is a free-text name, not a profiles FK, so this isn't an impersonation risk
-- the way lab_tests' entered_by/verified_by is — but a doctor-fabricated
-- `collected_by`/`collected_at`/`reject_reason` at order time would still be a
-- false statement of fact baked into the specimen's history). Tightened to match
-- what LabSpecimens.create() actually sends (orderId, type, container only).
drop policy if exists lab_specimens_insert_doctor on lab_specimens;

create policy lab_specimens_insert_doctor on lab_specimens for insert
  with check (
    exists (select 1 from orders o where o.id = lab_specimens.order_id and o.doctor_id = auth.uid())
    and collected_by is null
    and collected_at is null
    and reject_reason is null
  );
