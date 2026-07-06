-- Phase 6 fix — tighten `pharmacy_dispenses_insert_doctor` (security review finding).
--
-- The prior migration (20260705060000) scoped the doctor INSERT policy to
-- order ownership (`rx.doctor_id = auth.uid()`), `status = 'queued'`, and the
-- four actor-identity columns (`assigned_to`, `dispensed_by`, `collected_by`,
-- `collected_at`) -- but stopped short of the full lesson
-- 20260705020000_tighten_lab_tests_insert_doctor.sql already taught: tighten
-- the check to match EVERY progression/audit column the app never populates
-- at insert, not just the actor-identity ones. `pharmacy_dispenses` left
-- several such columns unconstrained:
--
--   * `quantity_modifications` (jsonb, QuantityModification[]) -- carries a
--     `supervisorApprovedBy` field per element; unconstrained, a doctor's
--     live session (via a raw PostgREST call, not the app UI) could INSERT a
--     row with a fabricated pre-approved quantity override, forging a
--     supervisor sign-off that never happened.
--   * `procurement_status` / `requested_by_ward_at` / `ward_bed` --
--     unconstrained, a doctor could fabricate an already-flagged ward
--     procurement request on a fresh OPD dispense.
--   * `patient_modifications` (text[]) -- unconstrained, could fabricate that
--     the patient already declined a medicine before pharmacy ever saw the row.
--   * `adjusted_bill_total` / `original_bill_total` -- unconstrained, could
--     misstate billing before pharmacy ever touches the row.
--
-- None of these are sent by the real sendRx bridge today
-- (src/app/doctor/dashboard/page.tsx's PharmacyDispenses.create() call passes
-- only prescriptionId/patientId/patientName/tokenNumber/doctorName/department/
-- source/paymentMode/medicines/dispatchedAt/estimatedReadyIn/triageLevel;
-- src/lib/api/pharmacy-dispenses.ts's create() signature omits
-- quantityModifications/patientModifications entirely, defaulting both to
-- `[]`, and never accepts procurementStatus/requestedByWardAt/wardBed/
-- adjustedBillTotal/originalBillTotal as create() inputs at all) -- so
-- tightening costs nothing functionally, while closing a real gap since RLS,
-- not app self-restraint, is the actual security boundary.
--
-- Column types confirmed directly against 20260705050000_pharmacy_schema.sql's
-- DDL: quantity_modifications is `jsonb not null default '[]'`,
-- patient_modifications is `text[] not null default '{}'`, procurement_status/
-- requested_by_ward_at/ward_bed/adjusted_bill_total/original_bill_total are
-- all nullable with no default.

drop policy if exists pharmacy_dispenses_insert_doctor on pharmacy_dispenses;

create policy pharmacy_dispenses_insert_doctor on pharmacy_dispenses for insert
  with check (
    exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid())
    and status = 'queued'
    and assigned_to is null
    and dispensed_by is null
    and collected_by is null
    and collected_at is null
    and quantity_modifications = '[]'::jsonb
    and patient_modifications = '{}'::text[]
    and procurement_status is null
    and requested_by_ward_at is null
    and ward_bed is null
    and adjusted_bill_total is null
    and original_bill_total is null
  );
