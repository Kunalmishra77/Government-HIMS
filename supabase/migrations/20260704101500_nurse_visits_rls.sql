-- Phase 2 (Task 9) — Nurse vitals recording needs to read the visit it's
-- attached to and advance its status to 'consulting'. The Phase 1 RLS file
-- explicitly deferred this ("Nurse/lab/radiology/pharmacy policies are added
-- in their respective later phases as those workflows come online") — this
-- is that later phase, scoped to the visits table only (vitals_readings
-- already grants nurse insert/select from Phase 1's schema work).

create policy visits_select_nurse on visits for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
  );

create policy visits_update_nurse on visits for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse')
  );
