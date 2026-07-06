-- Cross-device Lab / Radiology / Pharmacy orders.
--
-- The doctor dispatches lab tests, radiology scans and prescriptions; those must
-- appear in the Lab / Radiology / Pharmacy modules on OTHER machines. Rather than
-- map three rich store shapes onto three normalized schemas, this stores each
-- order as an opaque JSON payload keyed by the store's own id, so any module can
-- push (upsert) and pull (read) it verbatim. Realtime + polling then propagate
-- it to every device.
create table if not exists opd_orders (
  id           text primary key,          -- the store's own order id (LO-…, RS-…, RX…)
  order_type   text not null,             -- 'lab' | 'radiology' | 'pharmacy'
  patient_id   text,
  patient_name text,
  status       text,
  payload      jsonb not null,            -- the full local order object
  updated_at   timestamptz not null default now()
);
create index if not exists opd_orders_type_idx on opd_orders (order_type, updated_at desc);

alter table opd_orders enable row level security;

-- Any signed-in staff module may read + write the shared order board. (The
-- server route /api/opd-order uses the service role, so these policies mainly
-- cover direct client reads during hydrate.) FOLLOW-UP: scope per role.
drop policy if exists opd_orders_all_staff on opd_orders;
create policy opd_orders_all_staff on opd_orders
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table opd_orders;
