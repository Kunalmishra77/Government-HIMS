-- Admission-request status transitions — Phase 7, Task 1 (RLS only; the
-- application-level transition methods are added to
-- src/lib/api/admission-requests.ts in Task 2, and wired to
-- useAdmissionStore.ts's assignBed/markAdmitted/cancelRequest in Task 3).
--
-- The original admission_requests migration (20260704170000) deliberately
-- shipped with no UPDATE policy for anyone ("Bed assignment/status
-- transitions are reception/admin's job in the future Admin/Admission
-- phase, not this one" — that phase is this one). The bed-manager/
-- admission-desk portal (src/app/admission/dashboard/page.tsx) is the actor
-- performing these transitions, not the requesting doctor — so UPDATE is
-- granted to reception/admin only, mirroring beds_all_reception's role set
-- (the same desk manages both).

create policy admission_requests_update_reception on admission_requests for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')));
