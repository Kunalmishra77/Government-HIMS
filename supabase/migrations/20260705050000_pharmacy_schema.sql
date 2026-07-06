-- Pharmacy schema: pharmacy_dispenses, pharmacy_stock_items, pharmacy_purchase_orders,
-- narcotics_log — Phase 6, Task 1.
--
-- Field lists verified directly against the live client stores:
-- src/store/usePharmacyStore.ts (PharmacyPrescription, PharmacyMedicine, RxSource,
-- PaymentMode, MedSupply, PrepStatus, ProcurementStatus, ModificationReason,
-- QuantityModification, Pharmacist), src/store/usePharmacyInventoryStore.ts
-- (StockItem, DrugSchedule, PurchaseOrder, POKind, POStatus), and
-- src/store/useNarcoticsStore.ts (NarcoticEntry). src/lib/api/pharmacy.ts and
-- src/lib/api/drugs.ts are NOT used as a basis — confirmed via grep those two
-- modules have zero non-comment imports outside src/lib/api/_seed.ts, and their
-- shapes were written speculatively before these real stores were reverse-
-- engineered (pharmacy.ts's PharmacyClaim.status is a 6-value enum with no
-- 'preparing' state and three states -- 'claimed'/'verifying'/'cancelled' --
-- that don't exist in the real 4-value PrepStatus; DispenseEvent has a
-- `bedside` field with no real-store equivalent; NarcoticLog's
-- witnessId/returnedQty fields don't match the real NarcoticEntry's
-- prescriber/dispenser/secondSignatory/batchNo/runningStock shape). This
-- migration ignores both files entirely, same precedent as Phase 4 Task 1
-- ignoring the equally-orphaned src/lib/api/lab.ts.
--
-- Design decisions:
--   * pharmacy_dispenses.prescription_id references prescriptions(id), NOT
--     orders(id) -- unlike Lab/Radiology, a prescription's real parent record
--     (Phase 3) is the `prescriptions` table directly; sendRx (doctor
--     dashboard) never calls Orders.create() for a drug order, only
--     Prescriptions.draft()+.sign(). Confirmed by reading
--     src/app/doctor/dashboard/page.tsx's sendRx in full.
--   * medicines / quantity_modifications are jsonb arrays (no child table) --
--     same reasoning as Lab/Radiology's own nested-array precedent: every
--     medicine line and every quantity modification is written by the same
--     pharmacy-role actor set under the same RLS policy as the rest of the
--     row, with no independent lifecycle or distinct access-control need.
--   * patient_modifications is a native text[] (not jsonb) -- it is a plain
--     array of medicine-name strings in the local store (patientModifications?:
--     string[]), no nested object shape, mirroring patients.allergies's own
--     text[] precedent from the core schema.
--   * triage_level reuses the existing triage_t enum (core_schema migration)
--     rather than declaring a new one -- PharmacyPrescription.triageLevel is
--     exactly 'Low'|'Medium'|'High'|'Critical', identical to triage_t's values.
--   * pharmacy_stock_items and pharmacy_purchase_orders are TWO separate
--     tables, not one -- mirroring Lab's specimen/test split reasoning: a
--     stock item (standing inventory) and a purchase order (a single
--     procurement request against that inventory) are genuinely separate
--     real-world objects with independent lifecycles (many purchase orders
--     can be raised, ordered, and received against the same stock item over
--     time) and different actors at different points.
--   * pharmacy_stock_items.name has a UNIQUE constraint -- unlike medicines
--     (identified only by a free-text name with no natural single owner row),
--     stock items ARE a single real inventory line per drug name; the unique
--     constraint lets the repository's getOrCreateByName() reliably
--     upsert-by-name (Tasks 6/7's first-real-touch materialization pattern --
--     standing inventory has no natural "order" event to hang a realId off
--     of, unlike every other Phase 1-5 entity).
--   * narcotics_log has NO foreign key to any other table -- NarcoticEntry
--     carries no prescription/dispense id at all in the real store (only
--     patient/patientId as free display fields), and the local batchNo field
--     is a hardcoded placeholder string today, not real batch tracking --
--     kept as plain text, no over-engineered batch/lot management added.
--
-- ROLE NOTE: role_t (core_schema migration) has NO 'inventory' value -- its 7
-- values are 'doctor', 'nurse', 'pharmacy', 'lab', 'radiology', 'reception',
-- 'admin'. The client-side "Inventory Manager" persona (src/types/roles.ts's
-- ALL_ROLES includes a separate 'inventory' entry; src/app/inventory/layout.tsx
-- gates on RoleGuard allowedRole="inventory") has NO corresponding real backend
-- role. This is a genuine, deliberate limitation carried forward from Phase 1's
-- schema design (out of scope to fix in a pharmacy-focused phase -- adding a
-- role_t enum value is a schema-widening decision with implications beyond
-- pharmacy). Consequence: every RLS policy below that would conceptually be
-- "inventory-manager-scoped" instead grants to 'pharmacy'/'admin' -- a real,
-- live-session write from /inventory/requests/page.tsx (Task 7) only succeeds
-- today if the signed-in user's real profiles.role is 'pharmacy' or 'admin'.
--
-- CROSS-ROLE WRITE NOTE (verified against real call sites, not assumed): two
-- pharmacy_dispenses actions are invoked from OUTSIDE the pharmacy role's own
-- pages --
--   * src/app/nurse/medication/page.tsx calls usePharmacyStore's
--     requestProcurement(rx.id) directly (a nurse requesting pharmacy
--     procurement for an out-of-stock ward/ICU/OT prescription) -- needs a
--     nurse-scoped UPDATE (+ SELECT, for the PostgREST RETURNING projection --
--     see the lab_tests/radiology_studies doctor-INSERT precedent for why) on
--     pharmacy_dispenses, restricted to ward_bed IS NOT NULL rows (matching
--     isWardRx's primary condition in the local store).
--   * src/components/pharmacy/DoctorStockAlerts.tsx (rendered on the doctor
--     dashboard) calls usePharmacyStore's setMedicineSupply(rxId, med,
--     "advised_outside") directly -- needs a doctor-scoped UPDATE (+ SELECT)
--     on pharmacy_dispenses, restricted to rows whose prescription_id belongs
--     to that doctor (joining prescriptions.doctor_id = auth.uid()).
-- Both SELECT policies are added below in this task; their UPDATE
-- counterparts are added in Task 5, once the corresponding action is actually
-- bridged -- mirroring exactly how Lab/Radiology Task 1 added a doctor SELECT
-- policy upfront and Task 3 added the doctor INSERT policy once the concrete
-- write need was confirmed via a throwaway verification script.
--
-- KNOWN, ACCEPTED RISK (documented, not fixed, in this migration): Postgres
-- RLS policies filter ROWS, not COLUMNS, and Supabase runs every
-- RLS-authenticated request as the single Postgres role `authenticated` (no
-- separate Postgres role per application role) -- see
-- 20260704125515_nurse_visits_column_grant.sql's own finding. That migration
-- closed the equivalent gap for `visits` with a column-level GRANT, but that
-- fix is NOT repeated here: pharmacy_dispenses' pharmacy/admin role needs wide
-- column UPDATE access (medicines, status, assignedTo, quantityModifications,
-- ...), and a column-level GRANT is role-wide, not RLS-policy-scoped -- an
-- attempt to narrow nurse/doctor's column access via GRANT would equally
-- narrow the pharmacist's, breaking real pharmacy functionality. So a nurse or
-- doctor whose UPDATE passes this migration's row-level check could, at the
-- database layer alone, also rewrite columns their real application code
-- never touches (assignedTo, quantityModifications, ...) within a row they're
-- already allowed to reach. Every real call site today (requestProcurement's
-- and setMedicineSupply's bridges, Task 5) only ever sends the narrow field
-- set documented above, so no ROW that RLS allows either role to reach is
-- corrupted by real application code -- this mirrors the same
-- necessary-and-sufficient reasoning the visits precedent used, minus the
-- column-grant enforcement layer, which is out of scope to redesign in this
-- phase (would require moving these writes behind security-definer RPCs).

create type pharm_source_t as enum ('OPD', 'IPD', 'OT', 'ICU', 'Home Rx', 'Discharge');
create type pharm_payment_mode_t as enum ('Cash', 'UPI', 'Card', 'Insurance', 'Credit');
create type prep_status_t as enum ('queued', 'preparing', 'ready', 'collected');
create type procurement_status_t as enum ('immediate', 'deferred_ipd', 'procurement_requested');
create type po_kind_t as enum ('patient', 'restock');
create type po_status_t as enum ('pending', 'ordered', 'received');
create type pharm_drug_schedule_t as enum ('X', 'H1');

create table pharmacy_dispenses (
  id                     text primary key,               -- 'PD-...'
  prescription_id        text not null references prescriptions(id),
  patient_id             text not null,
  patient_name           text not null,
  token_number           integer not null default 0,
  doctor_name            text not null,
  department             text not null,
  source                 pharm_source_t not null default 'OPD',
  payment_mode           pharm_payment_mode_t not null default 'Cash',
  medicines              jsonb not null default '[]',    -- PharmacyMedicine[]
  status                 prep_status_t not null default 'queued',
  dispatched_at          timestamptz not null default now(),
  estimated_ready_in     integer not null default 0,
  notes                  text,
  triage_level           triage_t,
  patient_modifications  text[] not null default '{}',
  procurement_status     procurement_status_t,
  requested_by_ward_at   timestamptz,
  ward_bed               text,
  quantity_modifications jsonb not null default '[]',    -- QuantityModification[]
  adjusted_bill_total    numeric,
  original_bill_total    numeric,
  assigned_to            jsonb,                          -- Pharmacist {id, name} | null
  dispensed_by           jsonb,                          -- Pharmacist | null
  collected_by           text,
  collected_at           timestamptz,
  updated_at             timestamptz not null default now()
);
create index pharmacy_dispenses_prescription_idx on pharmacy_dispenses(prescription_id);
create index pharmacy_dispenses_active_idx on pharmacy_dispenses(status) where status <> 'collected';

create table pharmacy_stock_items (
  id          text primary key,                          -- 'PSI-...'
  name        text not null unique,
  category    text not null,
  qty         integer not null default 0,
  unit        text not null,
  reorder_at  integer not null default 0,
  max_stock   integer not null default 0,
  schedule    pharm_drug_schedule_t,
  updated_at  timestamptz not null default now()
);

create table pharmacy_purchase_orders (
  id          text primary key,                          -- 'PPO-...'
  drug        text not null,
  qty         integer not null,
  kind        po_kind_t not null,
  for_patient text,
  raised_by   text not null,                              -- resolved server-side (Task 5), never client-supplied
  status      po_status_t not null default 'pending',
  raised_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index pharmacy_purchase_orders_status_idx on pharmacy_purchase_orders(status);

create table narcotics_log (
  id               text primary key,                     -- 'NCL-...'
  drug             text not null,
  date             text not null,                         -- plain 'YYYY-MM-DD', mirrors the store's own string field
  time             text not null,                         -- plain 'HH:MM', mirrors the store's own string field
  patient          text not null,
  patient_id       text not null,
  dose             text not null,
  prescriber       text not null,
  dispenser        text not null,                         -- resolved server-side (Task 6), never client-supplied
  second_signatory text not null,
  batch_no         text not null,
  running_stock    integer not null
);

alter table pharmacy_dispenses enable row level security;
alter table pharmacy_stock_items enable row level security;
alter table pharmacy_purchase_orders enable row level security;
alter table narcotics_log enable row level security;

-- Pharmacy role: full read/write on all four tables.
create policy pharmacy_dispenses_all_pharmacy on pharmacy_dispenses for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')));
create policy pharmacy_stock_items_all_pharmacy on pharmacy_stock_items for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')));
create policy pharmacy_purchase_orders_all_pharmacy on pharmacy_purchase_orders for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')));
create policy narcotics_log_all_pharmacy on narcotics_log for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('pharmacy', 'admin')));

-- Doctor: read-only, own patients' dispenses (via the prescriptions table they own).
-- See the CROSS-ROLE WRITE NOTE above for why a doctor also needs this SELECT
-- policy (not just Lab/Radiology-style oversight reading) -- DoctorStockAlerts.tsx's
-- setMedicineSupply UPDATE (added Task 5) needs its RETURNING row visible too.
create policy pharmacy_dispenses_select_doctor on pharmacy_dispenses for select
  using (exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid()));

-- Nurse: read-only, ward-side dispenses only (ward_bed IS NOT NULL). See the
-- CROSS-ROLE WRITE NOTE above -- requestProcurement's UPDATE (added Task 5)
-- needs its RETURNING row visible too.
create policy pharmacy_dispenses_select_nurse on pharmacy_dispenses for select
  using (ward_bed is not null and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse'));

-- Explicitly deferred (out of scope for this task): doctor INSERT (added in
-- Task 3, mirroring Lab/Radiology's own Task 1 -> Task 3 sequencing),
-- doctor/nurse UPDATE (added in Task 5), reception/admin oversight reads,
-- patient-self read access -- none of the latter two are exercised by the
-- current stores.
