-- Phase 7 final-review finding — ipd_stays_all_clinical (20260706010000)
-- reopens unscoped INSERT/DELETE for doctor/nurse.
--
-- Postgres OR-combines multiple permissive policies for the same command.
-- ipd_stays_insert_reception (same original migration) carefully restricts
-- INSERT to a fresh stage='admitted' row with every jsonb/array field empty
-- and discharge/surgery/icu_transfer/ot_booking all null. But because
-- ipd_stays_all_clinical is `FOR ALL` and also covers doctor/nurse, a
-- doctor/nurse session's INSERT was validated against EITHER policy — the
-- unscoped one wins, letting doctor/nurse insert an ipd_stays row in ANY
-- stage with a fully populated payload, defeating the tightened invariant.
-- The same policy also granted doctor/nurse unrestricted DELETE with zero
-- call sites anywhere in the app (confirmed via grep: only
-- useAdmissionStore.markAdmitted -> IpdStays.create() ever inserts, using
-- the reception-side policy; IpdStays exposes no delete method at all and
-- no call site anywhere in src/app relies on doctor/nurse INSERT/DELETE).
--
-- Fix: drop the FOR ALL grant and replace it with two narrower policies
-- covering only what doctor/nurse/admin genuinely need against this table --
-- SELECT and UPDATE (every Tasks 4-9 bridge action is a patch/read, never an
-- insert or delete) -- same role predicate as before, unchanged.
--
-- Admin scope: this project's established precedent (beds_all_reception +
-- beds_select_clinical in 20260706011000; lab_tests_all_lab in
-- 20260704210827) always folds 'admin' into whichever policy legitimately
-- needs the broadest access for a table, rather than granting admin a
-- separate unrestricted bypass beyond what any real write path exercises.
-- Here, the only broad (unrestricted, any-stage) grant this table's real
-- call sites ever need is doctor/nurse/admin's SELECT+UPDATE -- admin has no
-- real call site needing unscoped INSERT/DELETE either (reception/admin's
-- existing ipd_stays_insert_reception already covers admin's one real
-- insert path, deliberately scoped to a fresh admitted-stage row). So admin
-- stays folded into these same two narrower clinical policies, exactly as
-- instructed, with no separate admin-only FOR ALL added -- consistent with
-- the rest of this codebase never granting admin a bypass beyond a real
-- write path.

drop policy if exists ipd_stays_all_clinical on ipd_stays;

create policy ipd_stays_select_clinical on ipd_stays for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')));

create policy ipd_stays_update_clinical on ipd_stays for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')));
