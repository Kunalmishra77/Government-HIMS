-- Row-Level Security for Phase 1 tables. Nurse/lab/radiology/pharmacy policies
-- are added in their respective later phases as those workflows come online.

alter table profiles enable row level security;
alter table patients enable row level security;
alter table visits enable row level security;
alter table appointments enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────
create policy profiles_select_self on profiles for select
  using (id = auth.uid());

-- profiles_select_admin's check must not query `profiles` directly from within
-- a policy defined on `profiles` — Postgres evaluates every permissive select
-- policy on a table to compute the OR, so a self-referencing subquery here
-- recurses infinitely (and poisons every other table's policies that look up
-- `profiles`, e.g. patients_select_staff). A `security definer` function run
-- as the table owner bypasses RLS for this internal check, breaking the cycle
-- while keeping identical semantics (admin sees all profiles).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create policy profiles_select_admin on profiles for select
  using (public.is_admin());

-- ── patients ────────────────────────────────────────────────────────────
create policy patients_select_staff on patients for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('doctor', 'nurse', 'reception', 'admin', 'lab', 'radiology', 'pharmacy')
  ));

create policy patients_select_self on patients for select
  using (auth_user_id = auth.uid());

create policy patients_insert_staff on patients for insert
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy patients_update_staff on patients for update
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

-- ── visits ──────────────────────────────────────────────────────────────
create policy visits_select_staff on visits for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy visits_select_doctor on visits for select
  using (doctor_id = auth.uid());

create policy visits_select_self on visits for select
  using (exists (
    select 1 from patients pt where pt.id = visits.patient_id and pt.auth_user_id = auth.uid()
  ));

create policy visits_insert_staff on visits for insert
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy visits_update_staff on visits for update
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy visits_update_doctor on visits for update
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- ── appointments ────────────────────────────────────────────────────────
create policy appointments_select_staff on appointments for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy appointments_select_doctor on appointments for select
  using (doctor_id = auth.uid());

create policy appointments_select_self on appointments for select
  using (exists (
    select 1 from patients pt where pt.id = appointments.patient_id and pt.auth_user_id = auth.uid()
  ));

create policy appointments_insert_staff on appointments for insert
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy appointments_update_staff on appointments for update
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));
