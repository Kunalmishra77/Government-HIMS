-- Phase 6 Task 4 — RLS gap found while wiring claim/updateStatus's
-- `Prescriptions.setDispenseStatus` call (never previously called by any
-- role): `prescriptions` has NO update policy at all for a pharmacy/admin
-- actor -- only `prescriptions_all_doctor` (for all, doctor_id = auth.uid(),
-- from 20260703124735_rls_policies.sql) and `prescriptions_select_staff`
-- (reception/admin, read-only) exist. Verified directly against the live
-- project via `pg_policy` before writing this migration (per the standing
-- RLS-verification lesson) -- confirmed 0 update/all policies grant
-- 'pharmacy' any access to `prescriptions`.
--
-- Consequence without this fix: `src/lib/api/_core.ts`'s `patch()` issues
-- `.update(...).eq('id', id).select().maybeSingle()` -- when RLS filters out
-- every row (no policy matches), Postgres reports 0 rows affected, which
-- PostgREST returns as a *successful* response with no data, not an error.
-- So `Prescriptions.setDispenseStatus` would silently no-op for a real
-- pharmacy session (no thrown error, `patched` just comes back undefined) --
-- the real `prescriptions.status` would never actually advance to
-- 'dispensing'/'dispensed', even though the pharmacy's own
-- `pharmacy_dispenses.status` genuinely progressed.
--
-- Fix: a new pharmacy/admin-scoped UPDATE policy, WITH CHECK-constrained to
-- the only two values `Prescriptions.setDispenseStatus`'s real (and only)
-- call site ever sends: 'dispensing' | 'dispensed'.
--
-- FIRST ATTEMPT (reverted, documented here to save the next reader from
-- re-discovering it): row-scoping the USING/WITH CHECK to
-- `exists (select 1 from pharmacy_dispenses pd where pd.prescription_id =
-- prescriptions.id)` seemed like the tighter, more-correct choice (mirrors
-- this task's own emphasis on not leaving row access broader than
-- necessary). Applying it live immediately failed every real prescriptions
-- write (including the unrelated doctor-side `Prescriptions.draft()`
-- upsert) with "infinite recursion detected in policy for relation
-- prescriptions". Root cause: `src/lib/api/_core.ts`'s `put()` uses
-- `.upsert()` (INSERT ... ON CONFLICT DO UPDATE), so Postgres must evaluate
-- BOTH insert- and update-applicable policies for every upsert --
-- including this UPDATE policy. Evaluating its USING/WITH CHECK subquery
-- against `pharmacy_dispenses` in turn evaluates THAT table's own RLS
-- policies, including `pharmacy_dispenses_select_doctor`
-- (20260705050000_pharmacy_schema.sql), whose USING clause does
-- `exists (select 1 from prescriptions rx where rx.id =
-- pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid())` -- a
-- SELECT back on `prescriptions`. Postgres treats this mutual
-- prescriptions<->pharmacy_dispenses policy reference as a rejected cycle
-- regardless of whether it would actually terminate. Fix: drop the
-- cross-table row-scope entirely and rely on role + status-value scoping
-- only (below) -- the same role-only scoping precedent
-- `pharmacy_dispenses_all_pharmacy` itself already uses.
--
-- Column-level GRANT is deliberately NOT added here (unlike the visits/nurse
-- precedent in 20260704125515_nurse_visits_column_grant.sql) -- `prescriptions`
-- already grants `authenticated` full column UPDATE access, required by the
-- pre-existing `prescriptions_all_doctor` policy (Prescriptions.sign() writes
-- status/signedAt/safety/updatedAt; Prescriptions.draft() via put() touches
-- every column). Narrowing that shared grant would break the doctor's own
-- real writes on the same `authenticated` Postgres role. So the same KNOWN,
-- ACCEPTED RISK already documented for `pharmacy_dispenses_all_pharmacy` in
-- 20260705050000_pharmacy_schema.sql applies here too: RLS filters rows, not
-- columns, and a pharmacy/admin UPDATE that passes this policy's role+status
-- check could, at the database layer alone, also rewrite this prescription's
-- other columns (lines, safety, doctorId, ...), or a prescription this
-- pharmacy actor never actually has a dispense for. The real
-- `Prescriptions.setDispenseStatus` call site (this task's
-- `usePharmacyStore.ts` bridges) only ever sends `{status, updatedAt}` on an
-- id it just read back from its own successful `pharmacy_dispenses` write,
-- so no row is corrupted by real application code.

create policy prescriptions_update_pharmacy on prescriptions for update
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin'))
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin'))
    and status in ('dispensing', 'dispensed')
  );

-- SECOND GAP found live-testing the above (raw pg simulation of the exact
-- `set local role authenticated` + JWT-claims request context PostgREST
-- uses): even with `prescriptions_update_pharmacy`'s USING/WITH CHECK both
-- independently verified true (confirmed via a direct
-- `select exists(...)`/`select auth.uid()` check inside the same simulated
-- transaction), `update prescriptions set status = 'dispensing' ... returning
-- id, status` still matched **0 rows** -- not merely "RETURNING came back
-- empty", the row was never modified at all (re-confirmed via a separate
-- admin/service-role read immediately after: status was still 'signed').
-- Root cause: Postgres requires a row to be visible under a SELECT-typed
-- policy (`polcmd = 'r'`) before an UPDATE/DELETE command's row-scan can even
-- target it for modification -- an UPDATE-typed policy (`polcmd = 'w'`) alone
-- governs the post-scan permission check, not row discovery. `prescriptions`
-- had no SELECT policy granting pharmacy any visibility at all (only
-- `prescriptions_all_doctor`, scoped to the owning doctor, and
-- `prescriptions_select_staff`, scoped to reception/admin) -- so the
-- pharmacy-role UPDATE's row scan found nothing to update, silently, exactly
-- like the earlier no-SELECT-policy symptom already independently documented
-- for pharmacy_dispenses' own nurse/doctor cross-role writes (see the
-- CROSS-ROLE WRITE NOTE in 20260705050000_pharmacy_schema.sql: "needs a
-- nurse-scoped UPDATE (+ SELECT, for the PostgREST RETURNING projection...)").
-- This confirms that same lesson applies even MORE fundamentally than that
-- comment's phrasing suggested: the SELECT policy is required for the
-- UPDATE's row-matching itself, not merely for the RETURNING projection.
--
-- Fix: a matching pharmacy/admin SELECT policy, role-scoped only (no
-- pharmacy_dispenses cross-reference, for the same infinite-recursion reason
-- documented above). This is a consistent, non-escalating scope: pharmacy
-- staff already see this same clinical detail (drug lines, doses) for every
-- patient via their own broad `pharmacy_dispenses_all_pharmacy` access
-- (medicines/patient name/doctor, with no per-row scoping either) -- granting
-- SELECT on `prescriptions` does not expose anything more sensitive than
-- what pharmacy already reads today.
create policy prescriptions_select_pharmacy on prescriptions for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin'))
  );
