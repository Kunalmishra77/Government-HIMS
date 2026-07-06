-- Phase 6, Task 3 (order rewire) — doctor INSERT/SELECT access on pharmacy_dispenses.
--
-- The pharmacy_schema migration (20260705050000) only granted `pharmacy`/`admin`
-- roles write access (pharmacy_dispenses_all_pharmacy), plus doctor/nurse
-- SELECT-only policies. That leaves no policy allowing a doctor to INSERT — but
-- this task wires sendRx (doctor dashboard) to materialize the real
-- pharmacy_dispenses row immediately after the doctor's own Prescriptions.sign()
-- call. Without this, that write 403s under RLS the moment a real doctor
-- session attempts it — confirmed against the live project via this task's own
-- throwaway verification script, exactly mirroring the gap Lab/Radiology Task 3
-- found for their own order-rewire tables.
--
-- Applying Lab/Radiology's lesson proactively rather than in a follow-up
-- migration: the WITH CHECK is tightened from the start to match exactly what
-- sendRx's bridge sends — a freshly-queued dispense, not one already prepared/
-- collected — so a doctor's INSERT cannot fabricate a dispense already past
-- the 'queued' stage, with a fake assignedTo/dispensedBy, bypassing the
-- claim -> prepare -> ready -> collect workflow the rest of this module is
-- built around.
--
-- pharmacy_dispenses_select_doctor already exists from the original migration
-- (20260705050000), so only the INSERT policy is added here — same
-- Postgres/PostgREST RLS interaction Lab/Radiology's own Task 3 documented in
-- detail (Table.insert() in _core.ts chains .insert(...).select().single(),
-- and the inserted row must also satisfy a SELECT policy for that RETURNING
-- projection to be visible to the caller).

create policy pharmacy_dispenses_insert_doctor on pharmacy_dispenses for insert
  with check (
    exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid())
    and status = 'queued'
    and assigned_to is null
    and dispensed_by is null
    and collected_by is null
    and collected_at is null
  );
