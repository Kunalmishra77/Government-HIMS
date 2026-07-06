-- Core schema: identity, patients, visits, appointments (Phase 1 of the 7-portal backend).

create type role_t as enum (
  'doctor', 'nurse', 'pharmacy', 'lab', 'radiology', 'reception', 'admin'
);

create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           role_t not null,
  full_name      text not null,
  department     text,
  specialization text,
  phone          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

create type sex_t as enum ('Male', 'Female', 'Other');
create type payer_t as enum ('cash', 'corporate', 'insurance', 'govt');

create table patients (
  id                 text primary key,
  hn                 text not null,
  auth_user_id       uuid references auth.users(id),
  full_name          text not null,
  phone              text not null,
  dob                date,
  age                smallint,
  sex                sex_t not null,
  blood_group        text,
  primary_payer      payer_t not null default 'cash',
  insurer_name       text,
  address            text,
  allergies          text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  family_contacts    jsonb not null default '[]',
  disha_consent_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create unique index patients_hn_idx on patients(hn);
create index patients_phone_idx on patients(phone);
create unique index patients_auth_user_idx on patients(auth_user_id) where auth_user_id is not null;

create type visit_kind_t as enum ('OPD', 'ER', 'IPD', 'OnlineConsult');
create type visit_status_t as enum
  ('scheduled', 'waiting', 'vitals', 'consulting', 'pharmacy', 'billing', 'completed', 'cancelled');
create type triage_t as enum ('Low', 'Medium', 'High', 'Critical');

create table visits (
  id                  text primary key,
  patient_id          text not null references patients(id),
  kind                visit_kind_t not null,
  doctor_id           uuid references profiles(id),
  doctor_name         text,
  department          text not null,
  status              visit_status_t not null,
  token               integer,
  scheduled_at        timestamptz,
  arrived_at          timestamptz,
  served_at           timestamptz,
  completed_at        timestamptz,
  payer_type          payer_t not null default 'cash',
  chief_complaint     text,
  symptoms            text[] not null default '{}',
  estimated_wait_min  integer,
  triage_level        triage_t,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index visits_patient_idx on visits(patient_id);
create index visits_doctor_active_idx on visits(doctor_id, status)
  where status not in ('completed', 'cancelled');
create index visits_status_idx on visits(status)
  where status not in ('completed', 'cancelled');

create type appt_mode_t as enum ('online', 'in_person');
create type appt_status_t as enum ('upcoming', 'confirmed', 'cancelled');

create table appointments (
  id           text primary key,
  patient_id   text not null references patients(id),
  patient_name text,
  doctor_id    uuid references profiles(id),
  doctor_name  text not null,
  specialty    text not null,
  date         date not null,
  time         text not null,
  mode         appt_mode_t not null default 'in_person',
  status       appt_status_t not null default 'upcoming',
  created_at   timestamptz not null default now()
);
create index appointments_doctor_date_idx on appointments(doctor_id, date);
create index appointments_patient_idx on appointments(patient_id);
