-- Security review finding: visits_update_nurse (from
-- 20260704101500_nurse_visits_rls.sql) was role-only, with no restriction on
-- which rows or what changes — a nurse could update ANY visit's ANY column
-- (reassign patient_id, change department, jump status straight to
-- 'billing'/'completed', etc). The intended nurse workflow is exactly one
-- transition: advancing a visit from 'vitals' to 'consulting' after
-- recording vitals (see usePatientStore.recordOpdVitals). Row-scoping the
-- policy to that transition follows the same discipline already applied to
-- visits_update_doctor (doctor_id = auth.uid()) in the Phase 1 RLS file.

drop policy if exists visits_update_nurse on visits;

create policy visits_update_nurse on visits for update
  using (
    status = 'vitals'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
  )
  with check (
    status = 'consulting'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
  );
