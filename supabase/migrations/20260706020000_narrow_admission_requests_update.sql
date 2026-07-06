-- Security review finding: admission_requests_update_reception (added in
-- 20260706013000) was role-only, with no restriction on which rows or what
-- columns a reception/admin actor could touch — a single UPDATE could jump a
-- request straight from 'requested' to 'admitted' (skipping 'bed_assigned'),
-- resurrect a 'cancelled' request, or silently rewrite diagnosis/doctor_id/
-- patient_id/admission_type alongside a legitimate status change. Same class
-- of bug already fixed twice before on this branch: visits_update_nurse
-- (20260704122501 + 20260704125515) and lab_tests_insert_doctor
-- (20260705020000). Applying the same discipline here.
--
-- Row-scoping: Task 2 (src/lib/api/admission-requests.ts) isn't built yet,
-- but the real transition flow is fully specified by
-- src/store/useAdmissionStore.ts's assignBed/markAdmitted/cancelRequest
-- actions plus the live admission_status_t enum
-- ('requested'|'bed_assigned'|'admitted'|'cancelled', from 20260704170000):
--   - assignBed:      Pending  (requested)   -> Assigned (bed_assigned)
--   - markAdmitted:   Assigned (bed_assigned) -> Admitted (admitted)
--   - cancelRequest:  Pending or Assigned (requested or bed_assigned) -> Cancelled (cancelled)
-- So a reception/admin-driven UPDATE may only start from a non-terminal row
-- ('requested' or 'bed_assigned') and may only land on 'bed_assigned',
-- 'admitted', or 'cancelled' — never touching an already-'admitted' or
-- already-'cancelled' row, and never resulting in 'requested'.
--
-- Column-scoping: audited the current admission_requests schema
-- (20260704170000_admission_requests.sql) and the live beds table
-- (20260706011000_beds_schema.sql, this phase's Task 1) — admission_requests
-- has no bed-assignment column of its own (no assigned_bed_id or
-- equivalent); bed occupancy is tracked on the separate `beds` row
-- (occupant_id/occupant_name/status), which already has its own correctly-
-- scoped reception/admin RLS (beds_all_reception, for all). So the only
-- column Task 2's real transition calls will ever need to patch on
-- admission_requests itself is `status` — matching this migration's
-- precedent (visits' {status, updated_at} grant), minus updated_at since
-- admission_requests has no such column at all.

drop policy if exists admission_requests_update_reception on admission_requests;

create policy admission_requests_update_reception on admission_requests for update
  using (
    status in ('requested', 'bed_assigned')
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin'))
  )
  with check (
    status in ('bed_assigned', 'admitted', 'cancelled')
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin'))
  );

revoke update on admission_requests from authenticated;
grant update (status) on admission_requests to authenticated;
