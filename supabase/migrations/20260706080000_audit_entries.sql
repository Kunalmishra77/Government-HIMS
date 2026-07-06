-- Audit trail — audit_entries table.
--
-- src/lib/api/audit.ts owns `table<AuditEntry>('audit_entries', ...)`, but no
-- migration ever created the table, so every audit read/write 404'd
-- (PGRST205) and _core.ts's table() silently fell back to per-browser
-- localStorage. That "worked" but (a) spammed a 404 on the browser console for
-- every audit call and (b) meant the audit trail never persisted to Postgres
-- and was invisible across devices/sessions. This migration graduates it to a
-- real table so the calls stop 404ing and audit becomes a genuine, shared,
-- append-only evidence log.
--
-- Column names mirror _core.ts's camelCase->snake_case conversion of
-- AuditEntrySchema: userId->user_id, userName->user_name,
-- resourceId->resource_id, ipStub->ip_stub; the rest are unchanged. `before`,
-- `after` and `timestamp` are quoted only because they collide with SQL
-- keywords — they are ordinary columns.
create table audit_entries (
  id           text primary key,               -- 'AUD-...'
  user_id      text not null,
  user_name    text not null,
  action       text not null,
  resource     text not null,
  resource_id  text,
  detail       text,
  "before"     jsonb,
  "after"      jsonb,
  "timestamp"  timestamptz not null default now(),
  ip_stub      text not null
);
create index audit_entries_ts_idx on audit_entries ("timestamp" desc);
create index audit_entries_resource_idx on audit_entries (resource_id);

alter table audit_entries enable row level security;

-- Intentionally permissive, matching the exact pre-existing behavior this
-- replaces (the localStorage fallback accepted every append and read). Audit
-- is an append-only activity log emitted from many actors — including the
-- anonymous self-check-in kiosk (src/lib/intake/register.ts) — and read back
-- immediately by _core.ts's put() `.select().single()`, so both INSERT and
-- SELECT must succeed for anon and authenticated alike or the write would
-- throw. No UPDATE/DELETE policies: RLS default-denies them, keeping the log
-- append-only. FOLLOW-UP: once every audit emit runs under a real staff
-- session, scope SELECT to admin and INSERT to authenticated profile-holders.
create policy audit_entries_insert on audit_entries for insert
  with check (true);
create policy audit_entries_select on audit_entries for select
  using (true);
