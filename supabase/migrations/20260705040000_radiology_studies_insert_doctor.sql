-- Phase 5, Task 3 (order rewire) — doctor INSERT/SELECT access on radiology_studies.
--
-- The radiology_schema migration (20260705030000) only granted `radiology`/`admin`
-- roles write access (radiology_studies_all_radiology), plus a doctor SELECT-only
-- policy. That leaves no policy allowing a doctor to INSERT — but this task wires
-- dispatchRadOrder (doctor dashboard) to materialize the real radiology_studies row
-- immediately after the doctor's own Orders.create() call. Without this, that write
-- 403s under RLS the moment a real doctor session attempts it — confirmed against
-- the live project via this task's own throwaway verification script, exactly
-- mirroring the gap Lab Task 3 found for lab_specimens/lab_tests.
--
-- Applying Lab's second lesson (20260705020000_tighten_lab_tests_insert_doctor.sql)
-- proactively rather than in a follow-up migration: the WITH CHECK is tightened
-- from the start to match exactly what dispatchRadOrder's bridge sends — a
-- freshly-ordered study, not an already-acquired/reported/verified/released one —
-- so a doctor's INSERT cannot fabricate a study already past the 'ordered' stage,
-- with a fake acquiringBy/readingBy/verifiedBy, bypassing the acquire -> read ->
-- verify -> release workflow the rest of this module is built around.
--
-- A SELECT policy is required in addition to INSERT/WITH CHECK (same Postgres/
-- PostgREST RLS interaction Lab's Task 3 report documented in detail: `Table.insert()`
-- in _core.ts chains `.insert(...).select().single()`, and the inserted row must
-- also satisfy a SELECT policy for that RETURNING projection to be visible to the
-- caller). `radiology_studies_select_doctor` already exists from the original
-- migration (20260705030000), so only the INSERT policy is added here.

create policy radiology_studies_insert_doctor on radiology_studies for insert
  with check (
    exists (select 1 from orders o where o.id = radiology_studies.order_id and o.doctor_id = auth.uid())
    and status = 'ordered'
    and attachments = '[]'::jsonb
    and acquiring_by is null
    and reading_by is null
    and verified_by is null
    and resident_read_by is null
    and released_at is null
    and acknowledged_at is null
    and ai_prelim is null
  );
