-- Admission requests: a doctor's request to admit a patient to a ward/ICU/bed,
-- linked back to the real visit — Phase 3, Task 2.
--
-- Field list verified against src/store/useAdmissionStore.ts's AdmissionRequest type
-- (the client-side shape this mirrors), with two deliberate deltas: `visit_id` is new
-- (the local store predates Phase 2's real visits, but the backend row needs it to link
-- back to prescriptions/orders via visit_id), and the local store's `bundle` field
-- (denormalized prescriptions/labOrders/radiologyOrders snapshot) is left out — the
-- backend already has this data in real prescriptions/orders rows linked by visit_id,
-- so duplicating it isn't needed (YAGNI).

create type admission_type_t as enum ('General Ward', 'ICU', 'Private Room', 'Semi-Private', 'Day Care');
create type admission_status_t as enum ('requested', 'bed_assigned', 'admitted', 'cancelled');

create table admission_requests (
  id                    text primary key,                -- 'ADM-...'
  visit_id              text not null references visits(id),
  patient_id            text not null references patients(id),
  doctor_id             uuid not null references profiles(id),
  diagnosis             text,
  admission_type        admission_type_t not null,
  bed_type_preference   text,
  reason                text,
  department            text,
  triage_level          text,
  payer_type            text,
  status                admission_status_t not null default 'requested',
  requested_at          timestamptz not null default now()
);
create index admission_requests_patient_idx on admission_requests(patient_id);
create index admission_requests_doctor_idx on admission_requests(doctor_id);
create index admission_requests_active_idx on admission_requests(status) where status not in ('admitted', 'cancelled');

alter table admission_requests enable row level security;

create policy admission_requests_insert_doctor on admission_requests for insert
  with check (doctor_id = auth.uid());
create policy admission_requests_select_doctor on admission_requests for select
  using (doctor_id = auth.uid());
create policy admission_requests_select_staff on admission_requests for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));

-- Doctors get insert + select-own only — no update policy for anyone yet. Bed
-- assignment/status transitions are reception/admin's job in the future
-- Admin/Admission phase, not this one (add the transition when that phase arrives).
