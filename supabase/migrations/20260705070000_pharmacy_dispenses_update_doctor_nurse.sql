-- Phase 6, Task 5 — doctor and nurse UPDATE access on pharmacy_dispenses.
--
-- Two real, non-pharmacy call sites write to pharmacy_dispenses (verified by
-- reading the actual files, not assumed from the task brief):
--   * src/components/pharmacy/DoctorStockAlerts.tsx (doctor dashboard) calls
--     setMedicineSupply(rxId, med, "advised_outside") -- a doctor advising a
--     patient to buy their own out-of-stock drug outside. The component
--     itself filters out any prescription whose status is already
--     'collected' before rendering the action button, and this bridge only
--     ever touches the `medicines` (+ updated_at) columns -- status is never
--     part of the payload.
--   * src/app/nurse/medication/page.tsx calls requestProcurement(rx.id) -- a
--     nurse flagging an out-of-stock ward/ICU/OT prescription for pharmacy
--     procurement. The page only ever renders the "Request Procurement"
--     button for rows already sitting in `procurement_status = 'deferred_ipd'`
--     (the "Pending Your Request" tab), and the action moves them to
--     `'procurement_requested'` -- never any other transition.
-- Both roles already have a SELECT policy (20260705050000) so this task's
-- bridge's PostgREST .update(...).select().single() RETURNING projection is
-- visible; this migration adds the matching UPDATE.
--
-- RLS LESSON APPLIED PROACTIVELY (per this project's own history --
-- admission_requests_update_reception and prescriptions_update_pharmacy both
-- initially shipped role-only, state-unscoped policies and both needed a
-- follow-up fix round once a live check found the row's CURRENT/resulting
-- state was left completely unconstrained): both policies below constrain
-- more than just the actor's role --
--   * doctor: USING/WITH CHECK both require status <> 'collected', matching
--     DoctorStockAlerts.tsx's own client-side filter -- a doctor's session
--     can never reach into (or leave a row in) a finalized, already-collected
--     dispense.
--   * nurse: USING requires procurement_status = 'deferred_ipd' (the only
--     real from-state the nurse's button acts on) and status <> 'collected';
--     WITH CHECK requires the resulting procurement_status =
--     'procurement_requested' (the only real to-state) and status <>
--     'collected' -- a nurse's session can neither re-request an
--     already-requested row nor touch any other procurement_status/status
--     combination.
--
-- See 20260705050000_pharmacy_schema.sql's own "KNOWN, ACCEPTED RISK" comment
-- for why these remain plain row-scoped policies rather than column-grant-
-- narrowed: narrowing via GRANT would equally narrow the pharmacist's own
-- broad column access, since Supabase runs every authenticated request as the
-- single Postgres role `authenticated`. The state-scoping above is the
-- available mitigation short of a security-definer RPC redesign (out of scope
-- here, same as documented in Task 1).
--
-- No cross-table recursion risk: the doctor policy's `prescriptions` subquery
-- mirrors the already-live, already-tested `pharmacy_dispenses_select_doctor`
-- policy's own shape (20260705050000) -- `prescriptions`' own policies
-- (prescriptions_update_pharmacy, prescriptions_select_pharmacy) are
-- role-only and never reference pharmacy_dispenses back, so there is no
-- mutual cross-table cycle (unlike the recursion incident documented in
-- phase6-task-4-report.md, which was a `prescriptions` policy querying
-- `pharmacy_dispenses` which in turn queried `prescriptions`).

create policy pharmacy_dispenses_update_doctor on pharmacy_dispenses for update
  using (
    exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid())
    and status <> 'collected'
  )
  with check (
    exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid())
    and status <> 'collected'
  );

create policy pharmacy_dispenses_update_nurse on pharmacy_dispenses for update
  using (
    ward_bed is not null
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
    and status <> 'collected'
    and procurement_status = 'deferred_ipd'
  )
  with check (
    ward_bed is not null
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
    and status <> 'collected'
    and procurement_status = 'procurement_requested'
  );
