create table vitals_readings (
  id           text primary key,              -- 'VR-...'
  visit_id     text not null references visits(id),
  recorded_by  uuid not null references profiles(id),
  recorded_at  timestamptz not null default now(),
  payload      jsonb not null
);
create index vitals_readings_visit_idx on vitals_readings(visit_id, recorded_at desc);

alter table vitals_readings enable row level security;

-- Staff (nurse/doctor/reception/admin) can see every vitals reading.
create policy vitals_readings_select_staff on vitals_readings for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse','doctor','reception','admin'))
  );

-- A patient can see vitals recorded against their own visits.
create policy vitals_readings_select_self on vitals_readings for select
  using (
    exists (
      select 1 from visits v
      join patients pt on pt.id = v.patient_id
      where v.id = vitals_readings.visit_id and pt.auth_user_id = auth.uid()
    )
  );

-- Only nurse/doctor/admin can record a vitals reading.
create policy vitals_readings_insert_staff on vitals_readings for insert
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse','doctor','admin'))
  );
