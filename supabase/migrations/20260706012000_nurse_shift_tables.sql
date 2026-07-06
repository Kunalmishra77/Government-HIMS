-- Nurse shift assignments, shift handovers, nurse task worklist — Phase 7,
-- Task 1. Mirrors useShiftStore.ts's Assignment/HandoverRecord and
-- useNursingStore.ts's NurseTask.
--
-- nurse_shift_assignments is reference/roster data with no mutating action
-- anywhere in useShiftStore.ts today (the store's State interface exposes no
-- setter for `assignments`, only the local-only `setActiveWard` and the two
-- read-only selectors `myAssignment`/`pendingIncoming`) — SELECT-only from
-- the app's perspective; no Task 10 bridge writes to it.

create type shift_type_t as enum ('Morning', 'Evening', 'Night');
create type handover_status_t as enum ('signed', 'received');

create table nurse_shift_assignments (
  id                text primary key,                      -- 'NSA-...'
  nurse_id          uuid not null references profiles(id),
  nurse_name        text not null,
  ward              text not null,
  shift             shift_type_t not null,
  responsibilities  text[] not null default '{}'
);
create index nurse_shift_assignments_nurse_idx on nurse_shift_assignments(nurse_id);

alter table nurse_shift_assignments enable row level security;

create policy nurse_shift_assignments_select_clinical on nurse_shift_assignments for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse', 'doctor', 'admin')));

create table shift_handovers (
  id                text primary key,                      -- 'HO-...'
  ward              text not null,
  date              date not null,
  from_shift        shift_type_t not null,
  to_shift          shift_type_t not null,
  from_nurse_id     uuid not null references profiles(id),
  from_nurse_name   text not null,
  to_nurse_id       uuid references profiles(id),
  to_nurse_name     text,
  sbar              text not null,
  addendum          text,
  patient_count     integer not null,
  signed_at         timestamptz not null default now(),
  received_at       timestamptz,
  received_by_id    uuid references profiles(id),
  received_by_name  text,
  status            handover_status_t not null default 'signed'
);
create index shift_handovers_ward_idx on shift_handovers(ward, to_shift, status);

alter table shift_handovers enable row level security;

create policy shift_handovers_all_nurse on shift_handovers for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse', 'admin')));

create type nurse_task_category_t as enum ('Vitals', 'Medication', 'Assessment', 'Hygiene', 'Mobility', 'Documentation', 'Procedure');
create type nurse_task_priority_t as enum ('High', 'Medium', 'Low');
create type nurse_task_source_t as enum ('ai', 'manual');

create table nurse_tasks (
  id            text primary key,                          -- 'TASK-...'
  key           text,
  patient_id    text references patients(id),
  patient_name  text not null,
  title         text not null,
  category      nurse_task_category_t not null,
  priority      nurse_task_priority_t not null,
  source        nurse_task_source_t not null,
  done          boolean not null default false,
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);
create unique index nurse_tasks_key_idx on nurse_tasks(key) where key is not null;

alter table nurse_tasks enable row level security;

create policy nurse_tasks_all_nurse on nurse_tasks for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse', 'admin')));
