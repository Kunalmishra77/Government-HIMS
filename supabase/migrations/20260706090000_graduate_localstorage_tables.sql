-- Graduate the remaining localStorage-only api tables to real Postgres.
--
-- These tables are referenced by src/lib/api/{bills,discharge,drugs,emergency,
-- lab,pharmacy,staff}.ts via table('<name>', <ZodSchema>), but never had a
-- migration — so every read/write 404'd (PGRST205) and _core.ts silently fell
-- back to per-browser localStorage. This graduates them so those calls return
-- 200 (no console 404) and the data persists to the shared DB.
--
-- Column names mirror _core.ts's camelCase->snake_case conversion of each Zod
-- schema. Enum-typed fields are stored as plain `text` (the Zod schema already
-- validates the value set client-side; text avoids a whole class of
-- invalid-enum insert failures). Client-supplied ISO timestamp strings are
-- `text` because their Zod type is z.string() (they must round-trip exactly).
-- Arrays/records are jsonb.
--
-- RLS: FOR ALL scoped to `authenticated`. Every one of these features is a
-- post-login staff surface (billing, discharge, drug master, ER, legacy lab,
-- legacy pharmacy, staff directory) — none is written from the anonymous
-- self-check-in kiosk — so authenticated-only is safe and doesn't break the
-- put() `.select().single()` return path. This intentionally mirrors the old
-- "any signed-in user could read/write" localStorage behavior. FOLLOW-UP
-- before production: scope each to its real role (esp. bills/payments/
-- pharmacy_narcotics, which are financial / controlled-substance records).

create table if not exists bills (
  id                 text primary key,
  patient_id         text not null,
  visit_id           text,
  ipd_stay_id        text,
  payer_type         text not null,
  payer_name         text,
  status             text not null default 'draft',
  lines              jsonb not null default '[]',
  total              numeric not null default 0,
  paid               numeric not null default 0,
  balance            numeric not null default 0,
  frozen_at          text,
  freeze_override_by text,
  created_at         text not null,
  updated_at         text not null
);

create table if not exists payments (
  id           text primary key,
  bill_id      text not null,
  mode         text not null,
  amount       numeric not null,
  ref          text,
  captured_by  text,
  captured_at  text not null
);

create table if not exists discharges (
  id                text primary key,
  ipd_stay_id       text not null,
  patient_id        text not null,
  initiated_by      text not null,
  initiated_by_name text,
  initiated_at      text not null,
  completed_at      text,
  pillars           jsonb not null,
  summary_md        text,
  follow_up_plan    text
);

create table if not exists drugs (
  id                text primary key,
  code              text,
  name              text not null,
  form              text,
  strength          text,
  route             text,
  class_class       text,
  narcotic_schedule text,
  allergy_tags      jsonb not null default '[]',
  interaction_tags  jsonb not null default '[]',
  on_hand           integer not null default 0,
  reorder_level     integer not null default 0,
  unit_price        numeric not null default 0,
  active            boolean not null default true
);

create table if not exists er_cases (
  id                text primary key,
  patient_id        text,
  patient_name      text not null,
  age               integer,
  sex               text,
  arrival_at        text not null,
  chief_complaint   text not null,
  esi               text,
  esi_ai_suggested  text,
  bay               text,
  doctor_id         text,
  doctor_name       text,
  disposition       text,
  disposed_at       text,
  notes             text
);

create table if not exists lab_results (
  id           text primary key,
  order_id     text not null,
  patient_id   text not null,
  panel_code   text not null,
  panel_name   text not null,
  bench        text not null,
  collected_at text,
  resulted_at  text,
  results      jsonb not null default '[]',
  qc_status    text not null default 'pending',
  qc_by        text,
  qc_at        text,
  verified_by  text,
  verified_at  text,
  released_at  text,
  critical     boolean not null default false,
  micro_stages jsonb not null default '[]'
);

create table if not exists pharmacy_claims (
  id                     text primary key,
  prescription_id        text not null,
  patient_id             text not null,
  tag                    text not null,
  claimed_by             text,
  claimed_by_name        text,
  claimed_at             text,
  status                 text not null default 'queued',
  substitution_drug_code text,
  substitution_reason    text,
  created_at             text not null,
  updated_at             text not null
);

create table if not exists pharmacy_dispense (
  id              text primary key,
  claim_id        text not null,
  prescription_id text not null,
  patient_id      text not null,
  pharmacist_id   text not null,
  pharmacist_name text not null,
  bedside         boolean not null default false,
  dispensed_at    text not null,
  drugs_summary   text
);

create table if not exists pharmacy_narcotics (
  id                 text primary key,
  drug_id            text not null,
  qty                integer not null,
  signed_out_by      text not null,
  signed_out_by_name text not null,
  witness_id         text not null,
  witness_name       text not null,
  patient_id         text,
  signed_out_at      text not null,
  returned_qty       integer not null default 0,
  returned_at        text
);

create table if not exists staff (
  id               text primary key,
  full_name        text not null,
  role             text not null,
  dept             text not null,
  primary_dept     text,
  registration_no  text,
  contact_phone    text,
  contact_email    text,
  active           boolean not null default true,
  shift            text
);

do $$
declare t text;
begin
  foreach t in array array[
    'bills','payments','discharges','drugs','er_cases','lab_results',
    'pharmacy_claims','pharmacy_dispense','pharmacy_narcotics','staff'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_all_authenticated', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      t || '_all_authenticated', t
    );
  end loop;
end $$;
