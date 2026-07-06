-- Database-backed OPD queue for multi-device/multi-browser real-time sync.
--
-- The 7 department modules run in separate browsers (often separate machines),
-- so the OPD queue can no longer live in per-browser localStorage. Patients and
-- their visit status must live in Postgres and be read + subscribed to by every
-- module. This migration:
--   1. lets the anonymous self-check-in kiosk create a patient + visit,
--   2. adds these tables to the Realtime publication so every connected module
--      gets live INSERT/UPDATE events without polling or refresh.
--
-- Self-check-in is anonymous (no staff session), so anon needs INSERT here.
-- Staff already have their own scoped insert/select/update policies. Anon still
-- cannot SELECT the queue (patients_select_self/staff unchanged) — only staff
-- modules read it. FOLLOW-UP for production: replace anon INSERT with a
-- server-signed kiosk token / edge function.
create policy patients_insert_kiosk on patients
  for insert to anon with check (true);
create policy visits_insert_kiosk on visits
  for insert to anon with check (true);

-- Realtime: broadcast row changes on patients + visits to all subscribers.
alter publication supabase_realtime add table patients;
alter publication supabase_realtime add table visits;
