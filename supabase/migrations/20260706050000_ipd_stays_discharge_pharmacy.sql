-- Phase 7 Task 9 — RLS gap found while wiring useDischargeStore's real
-- backend bridge: src/app/pharmacy/queue/page.tsx's confirmCollect calls
-- useDischargeStore.setClearance(patientId, 'pharmacy', 'cleared') for every
-- TTO ("Discharge"-source) prescription collection -- a real, already-live
-- pharmacy-role call site (pharmacy accounts are real Supabase users with
-- profiles.role = 'pharmacy', confirmed live in Phase 6's
-- pharmacy_dispenses/prescriptions work). setClearance's Task 9 bridge
-- (patchWithSharedDischarge) does one IpdStays.get(realId) read then one
-- IpdStays.patch(realId, { discharge, updated_at }) write -- but ipd_stays'
-- only existing policies (ipd_stays_all_clinical: doctor/nurse/admin;
-- ipd_stays_select_reception: reception/admin;
-- ipd_stays_select_patient: the patient themself) grant 'pharmacy' no row
-- visibility or write access at all.
--
-- Consequence without this fix: per the same lesson already twice
-- documented on this branch (20260706041000_prescriptions_update_pharmacy.sql
-- + 20260706042000_tighten_prescriptions_update_pharmacy.sql), this write
-- would silently no-op for every real pharmacy session -- no thrown error,
-- `patched` just comes back undefined -- pharmacy's discharge clearance
-- would never actually reach the real ipd_stays row, even though the local
-- useDischargeStore queue genuinely progressed.
--
-- Row-scoping: pharmacy's real call site (confirmCollect, gated on
-- srcOf(rx) === 'Discharge') only ever fires once a stay is already in
-- useInpatientStore's discharge pipeline (stage = 'discharge_initiated', set
-- by initiateDischarge) and never changes `stage` itself (the bridge patches
-- only `discharge`) -- so `stage = 'discharge_initiated'` on both USING and
-- WITH CHECK is both necessary (the real call needs it) and sufficient (no
-- real pharmacy call path needs a stay in any other stage), matching
-- prescriptions_update_pharmacy's status-scoping precedent. No cross-table
-- subquery is used (only `profiles`), so no infinite-recursion risk of the
-- kind documented in 20260706042000.
--
-- Column-level GRANT deliberately NOT added (same reasoning as
-- 20260706042000's prescriptions comment): ipd_stays_all_clinical already
-- requires full column UPDATE access for doctor/nurse (rounds/meds/tests/
-- discharge/... across Tasks 4-9's bridges) on the same shared `authenticated`
-- Postgres role (Supabase runs every RLS-authenticated request as this one
-- role) -- narrowing the column grant would break those. Known, accepted
-- risk: a pharmacy session that passes this policy's row-scope check could,
-- at the database layer alone, also rewrite this row's other columns -- but
-- the real setClearance bridge only ever sends { discharge, updated_at }, so
-- no real call path can exploit this.
--
-- SELECT policy included for the same reason documented in
-- 20260706041000/20260706042000: an UPDATE-typed policy alone does not grant
-- row-discovery for the UPDATE's row scan -- a matching SELECT policy is
-- required (also needed directly here, since patchWithSharedDischarge's
-- read-merge-write does its own IpdStays.get(realId) before patching).

create policy ipd_stays_update_pharmacy on ipd_stays for update
  using (
    stage = 'discharge_initiated'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pharmacy')
  )
  with check (
    stage = 'discharge_initiated'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pharmacy')
  );

create policy ipd_stays_select_pharmacy on ipd_stays for select
  using (
    stage = 'discharge_initiated'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'pharmacy')
  );
