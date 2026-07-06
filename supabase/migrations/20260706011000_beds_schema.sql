-- Beds — Phase 7, Task 1. Mirrors useAdmissionStore.ts's Bed type.
--
-- No realId indirection: a bed's local id (e.g. 'BED-101') IS the real row's
-- primary key directly (see this plan's Global Constraints). No row is
-- pre-seeded by this migration — the 14 demo MOCK_BEDS stay local-only until
-- a real write against one of them occurs (Task 3).

create type bed_gender_t as enum ('Male', 'Female', 'Any');
create type bed_status_t as enum ('Available', 'Occupied', 'Cleaning', 'Reserved', 'Maintenance');

create table beds (
  id                    text primary key,                  -- 'BED-...'
  bed_number            text not null,
  ward                  admission_type_t not null,
  floor                 text not null,
  status                bed_status_t not null default 'Available',
  occupant_id           text references patients(id),
  occupant_name         text,
  cleaning_assigned_to  text,
  last_cleaned          timestamptz,
  gender                bed_gender_t,
  expected_free_at      timestamptz
);
create index beds_ward_idx on beds(ward);
create index beds_status_idx on beds(status);

alter table beds enable row level security;

create policy beds_all_reception on beds for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')));

create policy beds_select_clinical on beds for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse')));
