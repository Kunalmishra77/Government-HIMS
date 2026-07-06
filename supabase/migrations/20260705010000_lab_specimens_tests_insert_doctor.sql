-- Phase 4, Task 3 (order rewire) — doctor INSERT access on lab_specimens/lab_tests.
--
-- The laboratory_schema migration (20260704210827) only granted `lab`/`admin` roles
-- write access to lab_specimens/lab_tests (lab_specimens_all_lab / lab_tests_all_lab),
-- plus a doctor SELECT-only policy on lab_tests. That leaves no policy allowing a
-- doctor to INSERT — but Task 3 wires dispatchLabOrder (doctor dashboard) to
-- materialize the real lab_specimens/lab_tests rows immediately after the doctor's
-- own Orders.create() call, mirroring what useLabOrdersStore.addOrder() already does
-- client-side. Without this, that write 403s under RLS the moment a real doctor
-- session attempts it (confirmed against the live project while implementing Task 3).
--
-- Scoped narrowly (not full for-all) and only for rows tied to an order the doctor
-- themselves owns — the same ownership check orders_all_doctor already uses
-- (doctor_id = auth.uid()), joined through orders.id. No UPDATE/DELETE grant on
-- either table for doctor — only INSERT, plus SELECT (see below).
--
-- A SELECT policy is required in addition to INSERT/WITH CHECK, confirmed
-- empirically against the live project while implementing Task 3: `Table.insert()`
-- (src/lib/api/_core.ts) chains `.insert(...).select().single()`, and PostgREST
-- executes that as INSERT ... RETURNING under the hood — Postgres RLS requires the
-- inserted row to also satisfy a SELECT policy for that RETURNING projection to be
-- visible to the caller, it is NOT covered by the INSERT policy's WITH CHECK alone.
-- A plain `.insert()` with no `.select()` succeeded even before this fix (proving the
-- WITH CHECK/INSERT policy alone was already correct); adding `.select()` 403'd with
-- "new row violates row-level security policy" until a matching SELECT policy was
-- added. `lab_tests` already had `lab_tests_select_doctor` from the original
-- migration (20260704210827) — this migration adds the missing INSERT policy for it
-- plus the equivalent (missing) SELECT policy for `lab_specimens`.

create policy lab_specimens_insert_doctor on lab_specimens for insert
  with check (exists (select 1 from orders o where o.id = lab_specimens.order_id and o.doctor_id = auth.uid()));
create policy lab_specimens_select_doctor on lab_specimens for select
  using (exists (select 1 from orders o where o.id = lab_specimens.order_id and o.doctor_id = auth.uid()));

create policy lab_tests_insert_doctor on lab_tests for insert
  with check (exists (select 1 from orders o where o.id = lab_tests.order_id and o.doctor_id = auth.uid()));
