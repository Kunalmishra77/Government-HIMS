-- Phase 6 Task 4 follow-up — RLS gap found in code review of
-- 20260706041000_prescriptions_update_pharmacy.sql: `prescriptions_update_pharmacy`'s
-- USING clause had no restriction on the row's CURRENT (from-)state, only
-- WITH CHECK constrained the target value. A pharmacy/admin session could
-- therefore reach into ANY prescription row -- 'draft', 'cancelled', already
-- 'dispensed', or one with no associated dispense at all -- and flip it to
-- 'dispensing'/'dispensed'.
--
-- Verified against the real call pattern before writing this fix:
-- `Prescriptions.setDispenseStatus` (src/lib/api/prescriptions.ts) is only
-- ever invoked from src/store/usePharmacyStore.ts's `claim`/`updateStatus`
-- bridges, and only ever as 'signed' -> 'dispensing' (claim/updateStatus,
-- when the linked pharmacy_dispenses row's status first becomes 'preparing')
-- then 'dispensing' -> 'dispensed' (updateStatus, when it becomes
-- 'collected'). The dispense row itself is only ever created
-- (src/app/doctor/dashboard/page.tsx) AFTER `Prescriptions.sign()` has
-- already moved the prescription to 'signed', so no real call path ever
-- reaches this policy while the prescription is still 'draft'/'cancelled'.
-- `release` (src/lib/api/pharmacy-dispenses.ts) never calls
-- `setDispenseStatus` at all. So `status in ('signed', 'dispensing')` on the
-- USING clause covers both real transitions with no functional regression.
--
-- Zero recursion risk: unlike the FIRST ATTEMPT documented in the prior
-- migration, this only inspects `prescriptions.status` on the row itself --
-- no cross-table subquery, so no mutual-policy-reference cycle is possible.

drop policy if exists prescriptions_update_pharmacy on prescriptions;

create policy prescriptions_update_pharmacy on prescriptions for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin'))
    and status in ('signed', 'dispensing')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin'))
    and status in ('dispensing', 'dispensed')
  );
