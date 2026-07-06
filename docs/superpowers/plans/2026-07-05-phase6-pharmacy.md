# Phase 6 — Pharmacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pharmacy dispensing workflow — queue materialization from a doctor's signed prescription, claim/prepare/ready/collect, substitution, quantity modification with supervisor override, procurement, the controlled-substance register, and inventory-manager fulfillment — persist to Postgres end-to-end, with the doctor's real `prescriptions` table (Phase 3) as the single source of truth for what was prescribed, exactly as Phase 4 did for Laboratory and Phase 5 did for Radiology.

**Architecture:** Four existing, fully-built, localStorage-backed Zustand stores model this domain today: `src/store/usePharmacyStore.ts` (456 lines, the dispense queue — `PharmacyPrescription`/`PharmacyMedicine`, 12 actions), `src/store/usePharmacyInventoryStore.ts` (136 lines, stock + purchase orders — `StockItem`/`PurchaseOrder`, 6 actions), `src/store/useNarcoticsStore.ts` (42 lines, the controlled-substance register — `NarcoticEntry`, 1 action), and `src/store/useDrugMasterStore.ts` (56 lines, a read-only 8-drug formulary, explicitly out of scope — see "What this plan deliberately does not do"). This phase adds four new Postgres tables (`pharmacy_dispenses`, `pharmacy_stock_items`, `pharmacy_purchase_orders`, `narcotics_log`) shaped to mirror those stores exactly (not the orphaned, zero-real-import `src/lib/api/pharmacy.ts`/`src/lib/api/drugs.ts`, which stay untouched and unrelated), three new repository modules, and additive guarded bridges into the stores' existing actions — following the exact pattern proven across Phases 2-5.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, Zustand, Zod, Vitest (against the real live Supabase project, no mocks).

## Global Constraints

- **Guard pattern, no exceptions**: every real write is gated by a *live* session check — `const { data: { session } } = await getSupabaseClient().auth.getSession(); if (!session) return;` — never `useAuthStore` (a persisted "logged in" flag survives across restarts even after the real session has expired, and is precisely the field the pharmacy pages already use for local display purposes — e.g. `usePharmacyStore`'s queue page builds `me: Pharmacist = { id: currentUser?.id ?? "PH-301", name: currentUser?.name ?? "Ritu Sharma" }` from it — which is exactly why that value must never reach a real actor-identity column).
- **Actor-identity integrity**: any field recording "who did this" (`assigned_to`, `dispensed_by` on `pharmacy_dispenses`; `dispenser` on `narcotics_log`; `raised_by` on `pharmacy_purchase_orders`) must be derived server-side from the live session + a `profiles.full_name` lookup via a new `resolveRealPharmacyActor()` helper (defined once per store file that needs it, mirroring `useLabOrdersStore.ts`'s `resolveRealActor`/`useRadiologyStudiesStore.ts`'s `resolveRealRadActor` line-for-line — each prior phase defines its own private copy rather than sharing one across stores, and this phase follows that same convention). It is **never** sourced from the local `Pharmacist` parameter (`RITU`/`ANIL`, or `me` built from `useAuthStore.currentUser`) a UI action passes in — mirroring it into a real row would let any caller impersonate any pharmacist, poisoning the audit trail.
- **`realId` backreference pattern**: `PharmacyPrescription` and `PurchaseOrder` each get a new optional `realId?: string` field, stamped once a real row exists for that local entity. Every bridge checks `if (!realId) return` (silent skip, never throw) before attempting any real write — this lets pre-existing seed data (`RX001`..`RX-C-002`, `PO-1001`..`PO-1002`) and any demo-created entity with no live session coexist safely with real records. `StockItem` and `NarcoticEntry` do **not** get a `realId` field — see Tasks 6 and 7 for why standing inventory and the append-only narcotics log use different materialization strategies (a name-keyed upsert-on-first-touch, and an unconditional live-session-gated append, respectively).
- **Hybrid transport**: new repository methods use `src/lib/api/_core.ts`'s `table<T>()` (Supabase-backed, falls back to localStorage on `PGRST205`) and its `insert()` method (insert-only — required wherever RLS grants INSERT but not a column-set broad enough for `put()`'s `ON CONFLICT DO UPDATE`, exactly like `LabTests`/`RadiologyStudies`).
- **No consecutive-capital-letter TS field names.** None of this phase's fields have that shape (unlike Lab/Radiology's `expectedTATmin`), but every new Zod schema is still spelled to match its migration column name exactly (e.g. `tokenNumber` ↔ `token_number`), confirmed field-by-field in Task 1/Task 2.
- **RLS is verified against the LIVE Supabase project, never assumed.** Lab found two real gaps this way; Radiology's plan applied that lesson proactively. This plan does the same **and** found two *additional*, pharmacy-specific real gaps by reading actual call sites rather than assuming: `src/app/nurse/medication/page.tsx` calls `usePharmacyStore`'s `requestProcurement` directly (a **nurse** writing to what would otherwise look like a pharmacy-only table), and `src/components/pharmacy/DoctorStockAlerts.tsx` (rendered on the doctor dashboard) calls `setMedicineSupply` directly (a **doctor** writing to the same table). Task 1 adds SELECT policies for both roles up front; Task 5 adds their UPDATE counterparts once the concrete write is bridged — mirroring exactly how Lab/Radiology sequenced their own doctor-INSERT discovery.
- **`role_t` has no `'inventory'` value.** Verified directly against `supabase/migrations/20260703123305_core_schema.sql`: `role_t` is `('doctor', 'nurse', 'pharmacy', 'lab', 'radiology', 'reception', 'admin')` — seven values, no `'inventory'`. The client-side "Inventory Manager" persona (`src/types/roles.ts`'s `ALL_ROLES` includes a separate `'inventory'` entry; `src/app/inventory/layout.tsx` gates on `RoleGuard allowedRole="inventory"`) has **no corresponding real backend role**. This is a real, deliberate limitation inherited from Phase 1's schema design — out of scope to fix here (widening `role_t` is a cross-cutting decision, not a pharmacy-phase one). Consequence, documented in Task 1 and Task 7: every RLS policy that would conceptually be "inventory-manager-scoped" instead grants to `'pharmacy'`/`'admin'` — a real write from `/inventory/requests/page.tsx` only succeeds if the signed-in user's real `profiles.role` is `'pharmacy'` or `'admin'`.
- **Every task runs both `npm test` (Vitest, against the real live Supabase project, no mocks) AND `npx tsc --noEmit`.** A past task once shipped 13 unnoticed type errors by skipping the `tsc` check.
- Use PowerShell for all commands. Do not commit until told to (`git add` only — this repository's standing rule per the branch history). Credentials in `.env.local`. Confirm the current branch with `git branch --show-current` before starting; continue on whatever branch Phase 5's work landed on if it differs from `docs/backend-architecture-design`.
- **Before writing any task's code, read the actual current file** — this plan was written from a research pass; prior phases repeatedly found real drift between research snapshots and actual files by execution time.
- **Verification scripts are throwaway.** Every task that needs to prove a real Postgres row was written (not just that the local Zustand state changed) writes a `src/store/__tests__/_throwaway-taskN-verify.test.ts` (or `src/lib/api/__tests__/_throwaway-taskN-verify.test.ts` for Task 2/3), runs it, confirms the assertions, then **deletes it** — confirmed absent from `git status` afterward. Only Task 1's schema test and Task 2's repository-module tests are committed.

---

### Task 1: `pharmacy_dispenses` / `pharmacy_stock_items` / `pharmacy_purchase_orders` / `narcotics_log` schema + RLS

**Files:**
- Create: `supabase/migrations/20260705050000_pharmacy_schema.sql`
- Test: `src/lib/supabase/__tests__/pharmacy-schema.test.ts`

**Design decisions (all verified against the live store files, not assumed):**

1. **`pharmacy_dispenses.prescription_id` references `prescriptions(id)`, not `orders(id)`.** Unlike Lab/Radiology, a prescription's real parent record (Phase 3) is the `prescriptions` table directly — `sendRx` in `src/app/doctor/dashboard/page.tsx` (read in full for this plan) never calls `Orders.create()` for a drug order, only `Prescriptions.draft()` then `Prescriptions.sign()`. There is no `orders` row to reference.
2. **`medicines` and `quantity_modifications` are `jsonb` arrays, no child table** — mirrors Lab/Radiology's own nested-array precedent: every medicine line and every quantity modification is written by the same pharmacy-role actor set under the same RLS policy as the rest of the row, no independent lifecycle or distinct access-control need.
3. **`patient_modifications` is a native `text[]`, not `jsonb`** — the local field (`patientModifications?: string[]`) is a plain array of medicine-name strings, mirroring `patients.allergies text[]`'s own precedent in the core schema, not a nested-object shape.
4. **`triage_level` reuses the existing `triage_t` enum** (`core_schema` migration, `'Low' | 'Medium' | 'High' | 'Critical'`) rather than declaring a new one — `PharmacyPrescription.triageLevel` has exactly those four values.
5. **`pharmacy_stock_items` and `pharmacy_purchase_orders` are two separate tables** — mirrors Lab's specimen/test split reasoning: a stock item (standing inventory) and a purchase order (one procurement request against that inventory) are genuinely separate real-world objects with independent lifecycles (many purchase orders can be raised, ordered, and received against the same stock item over time).
6. **`pharmacy_stock_items.name` has a `unique` constraint** — unlike medicine lines (no natural single owner row), a stock item genuinely is one real inventory line per drug name; the constraint lets the repository's `getOrCreateByName()` (Tasks 6/7) reliably upsert-by-name. Standing inventory has no natural "order" event to hang a `realId` off of the way every other Phase 1-5 entity does, so this phase uses a different materialization strategy for it — see Task 6.
7. **`narcotics_log` has no foreign key to any other table** — `NarcoticEntry` carries no prescription/dispense id in the real store, only `patient`/`patientId` as free display fields, and `batchNo` is a hardcoded placeholder string today (not real batch tracking) — kept as plain text, no over-engineered batch/lot management added.
8. **`src/lib/api/pharmacy.ts` and `src/lib/api/drugs.ts` are ignored entirely**, same precedent as Phase 4 ignoring the equally-orphaned `src/lib/api/lab.ts` — confirmed via grep that neither has a single non-`_seed.ts` import anywhere in the app, and both were written speculatively before the real stores were reverse-engineered (`pharmacy.ts`'s `PharmacyClaim.status` is a 6-value enum with `'claimed'`/`'verifying'`/`'cancelled'` states that don't exist in the real 4-value `PrepStatus`, and is missing `'preparing'`; its `DispenseEvent.bedside` field has no real-store equivalent; `NarcoticLog`'s `witnessId`/`returnedQty` fields don't match the real `NarcoticEntry`'s `prescriber`/`dispenser`/`secondSignatory`/`batchNo`/`runningStock` shape).

**Before writing the migration, re-read `src/store/usePharmacyStore.ts`, `src/store/usePharmacyInventoryStore.ts`, and `src/store/useNarcoticsStore.ts` in full** (already researched below, but re-verify against the live files) for the exact current shape of `PharmacyPrescription`, `PharmacyMedicine`, `RxSource`, `PaymentMode`, `MedSupply`, `PrepStatus`, `ProcurementStatus`, `ModificationReason`, `QuantityModification`, `Pharmacist`, `StockItem`, `DrugSchedule`, `PurchaseOrder`, `POKind`, `POStatus`, and `NarcoticEntry`.

- [ ] **Step 1: Write the failing test**

`src/lib/supabase/__tests__/pharmacy-schema.test.ts`:

```ts
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('pharmacy schema', () => {
  it('pharmacy_dispenses table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expectedCols = [
        'id', 'prescription_id', 'patient_id', 'patient_name', 'token_number',
        'doctor_name', 'department', 'source', 'payment_mode', 'medicines',
        'status', 'dispatched_at', 'estimated_ready_in', 'notes', 'triage_level',
        'patient_modifications', 'procurement_status', 'requested_by_ward_at',
        'ward_bed', 'quantity_modifications', 'adjusted_bill_total',
        'original_bill_total', 'assigned_to', 'dispensed_by', 'collected_by',
        'collected_at', 'updated_at',
      ]
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = $1`, ['pharmacy_dispenses']
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual([...expectedCols].sort())
    } finally {
      await client.end()
    }
  })

  it('pharmacy_stock_items table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expectedCols = ['id', 'name', 'category', 'qty', 'unit', 'reorder_at', 'max_stock', 'schedule', 'updated_at']
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = $1`, ['pharmacy_stock_items']
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual([...expectedCols].sort())
    } finally {
      await client.end()
    }
  })

  it('pharmacy_purchase_orders table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expectedCols = ['id', 'drug', 'qty', 'kind', 'for_patient', 'raised_by', 'status', 'raised_at', 'updated_at']
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = $1`, ['pharmacy_purchase_orders']
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual([...expectedCols].sort())
    } finally {
      await client.end()
    }
  })

  it('narcotics_log table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expectedCols = [
        'id', 'drug', 'date', 'time', 'patient', 'patient_id', 'dose',
        'prescriber', 'dispenser', 'second_signatory', 'batch_no', 'running_stock',
      ]
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = $1`, ['narcotics_log']
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual([...expectedCols].sort())
    } finally {
      await client.end()
    }
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/supabase/__tests__/pharmacy-schema.test.ts`
Expected: FAIL — all four assertions fail with `expected [] to deeply equal [...]` (none of the tables exist yet).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260705050000_pharmacy_schema.sql`:

```sql
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
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db push --db-url "$env:DATABASE_URL" --include-all --yes`
Expected: applies cleanly, no errors.

- [ ] **Step 5: Run the schema test again, confirm it passes**

Run: `npx vitest run src/lib/supabase/__tests__/pharmacy-schema.test.ts`
Expected: `Test Files 1 passed (1)` / `Tests 4 passed (4)`.

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — expect all prior tests still passing plus these four new ones, zero regressions.
Run: `npx tsc --noEmit` — expect clean, no output.

```bash
git add supabase/migrations/20260705050000_pharmacy_schema.sql src/lib/supabase/__tests__/pharmacy-schema.test.ts
```

---

### Task 2: Repository modules — `PharmacyDispenses`, `PharmacyStock` + `PharmacyPurchaseOrders`, `NarcoticsLog`

**Files:**
- Create: `src/lib/api/pharmacy-dispenses.ts`
- Create: `src/lib/api/pharmacy-inventory.ts`
- Create: `src/lib/api/narcotics.ts`
- Modify: `src/lib/api/index.ts`
- Test: `src/lib/api/__tests__/pharmacy-dispenses.test.ts`
- Test: `src/lib/api/__tests__/pharmacy-inventory.test.ts`
- Test: `src/lib/api/__tests__/narcotics.test.ts`

**Interfaces:**
- Consumes: `table<T>`, `id as newId`, `isoNow`, `audit` from `./_core` (same as every other module).
- Produces: `PharmacyDispenses`, `PharmacyStock`, `PharmacyPurchaseOrders`, `NarcoticsLog` objects (methods listed below) and their Zod schemas, all consumed by Tasks 3-7's store bridges.

- [ ] **Step 1: Write `src/lib/api/pharmacy-dispenses.ts`**

```ts
/* PharmacyDispenses — the dispensing queue: one row per doctor-signed
 * prescription, covering the queued -> preparing -> ready -> collected
 * lifecycle plus substitution, quantity modification, and procurement.
 * Mirrors `PharmacyPrescription` in src/store/usePharmacyStore.ts and the
 * `pharmacy_dispenses` table in
 * supabase/migrations/20260705050000_pharmacy_schema.sql.
 *
 * IMPORTANT — actor identity (read before wiring a UI bridge to this module):
 * `assignedTo`/`dispensedBy` are jsonb Pharmacist objects ({id, name}), NOT
 * profiles FKs — the local pharmacy roster (RITU, ANIL) plus whatever
 * useAuthStore.currentUser happens to hold isn't necessarily backed by a real
 * Supabase-authenticated user. Every method below that records who performed
 * an action takes that identity as an explicit `actor: Pharmacist` parameter —
 * never folded into a generic partial-update object.
 *
 * This module does NOT and CANNOT verify `actor` is truthful — it is a dumb
 * persistence layer, same as every other src/lib/api/* module. Enforcing
 * "actor must be the real signed-in user" is the CALLER's job: the store
 * bridges (Phase 6 Tasks 4-6) MUST source `actor` from a live
 * `getSupabaseClient().auth.getSession()` + a `profiles` lookup, never from
 * the local Zustand/UI-selected `Pharmacist` the store already carries. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const PharmRxSource = z.enum(['OPD', 'IPD', 'OT', 'ICU', 'Home Rx', 'Discharge'])
export const PharmPaymentMode = z.enum(['Cash', 'UPI', 'Card', 'Insurance', 'Credit'])
export const MedSupply = z.enum(['pharmacy', 'advised_outside', 'order_raised'])
export const PrepStatus = z.enum(['queued', 'preparing', 'ready', 'collected'])
export const ProcurementStatus = z.enum(['immediate', 'deferred_ipd', 'procurement_requested'])
export const ModificationReason = z.enum(['Has at home', 'Partial fill', 'Unable to afford', 'Travelling today', 'Out of stock'])
export const PharmTriageLevel = z.enum(['Low', 'Medium', 'High', 'Critical'])

// A pharmacy-roster actor — a real signed-in pharmacist. See the module-level
// note above: callers must source this from a live session.
export const PharmacistSchema = z.object({ id: z.string(), name: z.string() })
export type Pharmacist = z.infer<typeof PharmacistSchema>

export const PharmacyMedicineSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  quantity: z.number().int().nonnegative(),
  inStock: z.boolean().optional(),
  supply: MedSupply.optional(),
  substitutedFrom: z.string().optional(),
})
export type PharmacyMedicine = z.infer<typeof PharmacyMedicineSchema>

export const QuantityModificationSchema = z.object({
  medicineName: z.string(),
  originalQty: z.number().int().nonnegative(),
  adjustedQty: z.number().int().nonnegative(),
  reason: ModificationReason,
  adjustedAt: z.string(),
  adjustedBy: z.string(),
  requiresSupervisorOverride: z.boolean(),
  supervisorApprovedBy: z.string().optional(),
})
export type QuantityModification = z.infer<typeof QuantityModificationSchema>

export const PharmacyDispenseSchema = z.object({
  id: z.string(),                    // 'PD-...'
  prescriptionId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  tokenNumber: z.number().int().nonnegative().default(0),
  doctorName: z.string(),
  department: z.string(),
  source: PharmRxSource.default('OPD'),
  paymentMode: PharmPaymentMode.default('Cash'),
  medicines: z.array(PharmacyMedicineSchema).default([]),
  status: PrepStatus.default('queued'),
  dispatchedAt: z.string(),
  estimatedReadyIn: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
  triageLevel: PharmTriageLevel.optional(),
  patientModifications: z.array(z.string()).default([]),
  procurementStatus: ProcurementStatus.optional(),
  requestedByWardAt: z.string().optional(),
  wardBed: z.string().optional(),
  quantityModifications: z.array(QuantityModificationSchema).default([]),
  adjustedBillTotal: z.number().optional(),
  originalBillTotal: z.number().optional(),
  assignedTo: PharmacistSchema.optional(),
  dispensedBy: PharmacistSchema.optional(),
  collectedBy: z.string().optional(),
  collectedAt: z.string().optional(),
  updatedAt: z.string(),
})
export type PharmacyDispense = z.infer<typeof PharmacyDispenseSchema>

const pharmacyDispenses = table<PharmacyDispense>('pharmacy_dispenses', PharmacyDispenseSchema)

export const PharmacyDispenses = {
  list: (filter?: (d: PharmacyDispense) => boolean) => pharmacyDispenses.list(filter),
  get: (id: string) => pharmacyDispenses.get(id),
  byPrescription: (prescriptionId: string) => pharmacyDispenses.list((d) => d.prescriptionId === prescriptionId),

  async create(input: Omit<PharmacyDispense, 'id' | 'status' | 'medicines' | 'patientModifications' | 'quantityModifications' | 'updatedAt'> & {
    id?: string
    status?: PharmacyDispense['status']
    medicines?: PharmacyMedicine[]
    patientModifications?: string[]
    quantityModifications?: QuantityModification[]
  }) {
    const row: PharmacyDispense = {
      ...input,
      id: input.id ?? newId('PD'),
      status: input.status ?? 'queued',
      medicines: input.medicines ?? [],
      patientModifications: input.patientModifications ?? [],
      quantityModifications: input.quantityModifications ?? [],
      updatedAt: isoNow(),
    }
    const saved = await pharmacyDispenses.insert(row)
    audit.emit({
      action: 'prescription_create',
      resource: 'pharmacy_dispense',
      resourceId: saved.id,
      detail: `${saved.medicines.length} medicine(s) queued for ${saved.patientId}`,
    })
    return saved
  },

  // actor: the real signed-in pharmacist claiming this queue entry.
  async claim(id: string, actor: Pharmacist) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const status = row.status === 'queued' ? ('preparing' as const) : row.status
    return pharmacyDispenses.patch(id, { assignedTo: actor, status, updatedAt: isoNow() })
  },

  async release(id: string) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const status = row.status === 'preparing' ? ('queued' as const) : row.status
    // NB: `assignedTo: undefined` would NOT clear the column — _core.ts's
    // patch() JSON-serializes the partial before sending it, and
    // JSON.stringify drops undefined-valued keys, so the column would
    // silently keep its previous value. An explicit `null` is required —
    // same precedent as lab-tests.ts's unclaim().
    return pharmacyDispenses.patch(id, {
      assignedTo: null as unknown as PharmacyDispense['assignedTo'], status, updatedAt: isoNow(),
    })
  },

  async updateStatus(id: string, status: PharmacyDispense['status']) {
    return pharmacyDispenses.patch(id, {
      status,
      estimatedReadyIn: status === 'ready' ? 0 : undefined,
      updatedAt: isoNow(),
    })
  },

  // actor: NOT re-derived here — the caller (usePharmacyStore.markCollected's
  // bridge, Task 6) passes through whichever Pharmacist the row's own
  // assignedTo/dispensedBy already holds, matching the local store's exact
  // `dispensedBy: p.dispensedBy ?? p.assignedTo` fallback semantics — the
  // person confirming collection is not necessarily who prepared it.
  async markCollected(id: string, collectedBy: string | undefined, dispensedBy: Pharmacist | undefined) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    return pharmacyDispenses.patch(id, {
      status: 'collected',
      collectedBy: collectedBy ?? row.collectedBy ?? 'Self (patient)',
      collectedAt: isoNow(),
      dispensedBy: dispensedBy ?? row.assignedTo,
      updatedAt: isoNow(),
    })
  },

  // Read-then-write (upsert-merge), same pattern as RadiologyStudies.attachImage.
  async setMedicineSupply(id: string, medicineName: string, supply: PharmacyMedicine['supply']) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const medicines = row.medicines.map((m) => m.name === medicineName ? { ...m, supply } : m)
    return pharmacyDispenses.patch(id, { medicines, updatedAt: isoNow() })
  },

  async substituteMedicine(id: string, originalName: string, newName: string) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const medicines = row.medicines.map((m) =>
      m.name === originalName
        ? { ...m, name: newName, inStock: true, supply: 'pharmacy' as const, substitutedFrom: m.substitutedFrom ?? originalName }
        : m
    )
    return pharmacyDispenses.patch(id, { medicines, updatedAt: isoNow() })
  },

  async requestProcurement(id: string) {
    return pharmacyDispenses.patch(id, {
      procurementStatus: 'procurement_requested', requestedByWardAt: isoNow(), updatedAt: isoNow(),
    })
  },

  // `allMods`/`adjustedBillTotal`/`originalBillTotal` are computed client-side
  // (UNIT_PRICES has no server-side equivalent) and passed through as
  // already-computed values, same as RadiologyStudies.recordDose's pattern.
  async adjustQuantity(id: string, allMods: QuantityModification[], adjustedBillTotal: number | undefined, originalBillTotal: number | undefined) {
    return pharmacyDispenses.patch(id, {
      quantityModifications: allMods, adjustedBillTotal, originalBillTotal, updatedAt: isoNow(),
    })
  },

  // actor: the real signed-in supervisor approving the override — resolved by
  // the caller, never a client-supplied id.
  async approveSupervisorOverride(id: string, medicineName: string, supervisorApprovedBy: string) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const quantityModifications = row.quantityModifications.map((m) =>
      m.medicineName === medicineName ? { ...m, supervisorApprovedBy, requiresSupervisorOverride: false } : m
    )
    return pharmacyDispenses.patch(id, { quantityModifications, updatedAt: isoNow() })
  },

  _table: pharmacyDispenses,
}
```

- [ ] **Step 2: Write `src/lib/api/pharmacy-inventory.ts`**

```ts
/* PharmacyStock + PharmacyPurchaseOrders — standing drug inventory and the
 * procurement requests raised against it. Mirrors `StockItem`/`PurchaseOrder`
 * in src/store/usePharmacyInventoryStore.ts and the `pharmacy_stock_items` /
 * `pharmacy_purchase_orders` tables in
 * supabase/migrations/20260705050000_pharmacy_schema.sql.
 *
 * IMPORTANT: unlike every other Phase 1-5 entity, a stock item has no natural
 * "order" event to materialize a real row from — it is standing inventory,
 * not per-patient. PharmacyStock.getOrCreateByName() is this module's answer:
 * an upsert-by-name (pharmacy_stock_items.name is UNIQUE) that either finds
 * the existing real row or creates it from whatever fields the caller has on
 * hand (typically the matching local StockItem). Callers (Tasks 6/7) are
 * expected to cache the returned row's `id` locally rather than re-resolving
 * by name on every call.
 *
 * `raisedBy` (PurchaseOrder) is NOT verified by this module — see
 * pharmacy-dispenses.ts's module-level note; the same actor-identity caveat
 * applies here. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const PharmDrugSchedule = z.enum(['X', 'H1'])
export const POKind = z.enum(['patient', 'restock'])
export const POStatus = z.enum(['pending', 'ordered', 'received'])

export const StockItemSchema = z.object({
  id: z.string(),                    // 'PSI-...'
  name: z.string(),
  category: z.string(),
  qty: z.number().int().nonnegative(),
  unit: z.string(),
  reorderAt: z.number().int().nonnegative(),
  maxStock: z.number().int().nonnegative(),
  schedule: PharmDrugSchedule.optional(),
  updatedAt: z.string(),
})
export type StockItem = z.infer<typeof StockItemSchema>

const stockItems = table<StockItem>('pharmacy_stock_items', StockItemSchema)

export const PharmacyStock = {
  list: (filter?: (s: StockItem) => boolean) => stockItems.list(filter),
  get: (id: string) => stockItems.get(id),

  async findByName(name: string) {
    const rows = await stockItems.list()
    return rows.find((s) => s.name === name)
  },

  async getOrCreateByName(input: Omit<StockItem, 'id' | 'updatedAt'>) {
    const existing = await PharmacyStock.findByName(input.name)
    if (existing) return existing
    return stockItems.insert({ ...input, id: newId('PSI'), updatedAt: isoNow() })
  },

  async decrementQty(id: string, qty: number) {
    const item = await stockItems.get(id)
    if (!item) return undefined
    return stockItems.patch(id, { qty: Math.max(0, item.qty - qty), updatedAt: isoNow() })
  },

  async restockQty(id: string, qty: number) {
    const item = await stockItems.get(id)
    if (!item) return undefined
    return stockItems.patch(id, { qty: Math.min(item.maxStock, item.qty + qty), updatedAt: isoNow() })
  },

  _table: stockItems,
}

export const PurchaseOrderSchema = z.object({
  id: z.string(),                    // 'PPO-...'
  drug: z.string(),
  qty: z.number().int().positive(),
  kind: POKind,
  forPatient: z.string().optional(),
  raisedBy: z.string(),
  status: POStatus.default('pending'),
  raisedAt: z.string(),
  updatedAt: z.string(),
})
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>

const purchaseOrders = table<PurchaseOrder>('pharmacy_purchase_orders', PurchaseOrderSchema)

export const PharmacyPurchaseOrders = {
  list: (filter?: (p: PurchaseOrder) => boolean) => purchaseOrders.list(filter),
  get: (id: string) => purchaseOrders.get(id),

  // raisedBy: resolved server-side by the caller — see module-level note.
  async create(input: { drug: string; qty: number; kind: PurchaseOrder['kind']; forPatient?: string }, raisedBy: string) {
    const row: PurchaseOrder = {
      ...input, id: newId('PPO'), raisedBy, status: 'pending', raisedAt: isoNow(), updatedAt: isoNow(),
    }
    return purchaseOrders.insert(row)
  },

  async setStatus(id: string, status: PurchaseOrder['status']) {
    return purchaseOrders.patch(id, { status, updatedAt: isoNow() })
  },

  _table: purchaseOrders,
}
```

- [ ] **Step 3: Write `src/lib/api/narcotics.ts`**

```ts
/* NarcoticsLog — controlled-substance (Schedule H1/X) dual-signature
 * register. Mirrors `NarcoticEntry` in src/store/useNarcoticsStore.ts and the
 * `narcotics_log` table in supabase/migrations/20260705050000_pharmacy_schema.sql.
 *
 * Unlike every other bridged action in this phase, NarcoticsLog.create() has
 * no `realId`-backed parent entity to gate on — the local NarcoticEntry
 * carries no prescription/dispense id at all (only free-text patient/
 * patientId display fields), so there is no local-vs-real distinction to
 * reconcile. The store bridge (Task 6) gates purely on live-session presence,
 * matching how src/lib/api/_core.ts's own `audit.emit()` fire-and-forgets
 * without a parent-entity handshake.
 *
 * `dispenser` is NOT verified by this module — see pharmacy-dispenses.ts's
 * module-level note; the same actor-identity caveat applies. `prescriber` and
 * `secondSignatory` are plain display-label copies of the prescription's
 * already-known doctor name (not "who is performing this action"), so they
 * carry no equivalent impersonation risk and are passed through as-is. */
import { z } from 'zod'
import { id as newId, table } from './_core'

export const NarcoticEntrySchema = z.object({
  id: z.string(),                    // 'NCL-...'
  drug: z.string(),
  date: z.string(),
  time: z.string(),
  patient: z.string(),
  patientId: z.string(),
  dose: z.string(),
  prescriber: z.string(),
  dispenser: z.string(),
  secondSignatory: z.string(),
  batchNo: z.string(),
  runningStock: z.number().int().nonnegative(),
})
export type NarcoticEntry = z.infer<typeof NarcoticEntrySchema>

const narcoticsLog = table<NarcoticEntry>('narcotics_log', NarcoticEntrySchema)

export const NarcoticsLog = {
  list: (filter?: (e: NarcoticEntry) => boolean) => narcoticsLog.list(filter),
  get: (id: string) => narcoticsLog.get(id),

  async create(input: Omit<NarcoticEntry, 'id'>) {
    return narcoticsLog.insert({ ...input, id: newId('NCL') })
  },

  _table: narcoticsLog,
}
```

- [ ] **Step 4: Export from `src/lib/api/index.ts`**

Add, after the existing `Pharmacy`/`PharmacyClaimSchema` legacy export (leave that line untouched — it stays unrelated) and before `Prescriptions`:

```ts
export {
  PharmacyDispenses, PharmacyDispenseSchema, PharmacistSchema, PharmacyMedicineSchema,
  QuantityModificationSchema, PharmRxSource, PharmPaymentMode, MedSupply, PrepStatus,
  ProcurementStatus, ModificationReason, PharmTriageLevel,
} from './pharmacy-dispenses'
export {
  PharmacyStock, StockItemSchema, PharmacyPurchaseOrders, PurchaseOrderSchema,
  PharmDrugSchedule, POKind, POStatus,
} from './pharmacy-inventory'
export { NarcoticsLog, NarcoticEntrySchema } from './narcotics'
```

- [ ] **Step 5: Write `src/lib/api/__tests__/pharmacy-dispenses.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Prescriptions } from '@/lib/api/prescriptions'
import { PharmacyDispenses } from '@/lib/api/pharmacy-dispenses'
import type { Pharmacist } from '@/lib/api/pharmacy-dispenses'
import { getSupabaseClient } from '@/lib/supabase/client'

// PharmacyDispenses.* routes through table('pharmacy_dispenses', ...) — same
// fixture pattern as lab-tests.test.ts / radiology-studies.test.ts: reception
// creates patient+visit, doctor drafts+signs the real prescription
// (pharmacy_dispenses.prescription_id FKs to prescriptions), then pharmacy
// (role 'pharmacy') performs the actual workflow operations under test.
const testPatientId = 'PT-PHARMTEST-1'
const testVisitId = 'VIS-PHARMTEST-1'
const testDispenseId = 'PD-PHARMTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'pharm-dispenses-test-reception@example.com'
const doctorEmail = 'pharm-dispenses-test-doctor@example.com'
const pharmacyEmail = 'pharm-dispenses-test-pharmacy@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string
let pharmacyUserId: string
let testPrescriptionId: string

const RITU: Pharmacist = { id: 'PH-301', name: 'Ritu Sharma' }

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Pharm Dispenses Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Pharm Dispenses Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { data: pharmacyData, error: pharmacyError } = await admin.auth.admin.createUser({
    email: pharmacyEmail, password: testPassword, email_confirm: true,
  })
  if (pharmacyError || !pharmacyData.user) throw new Error(`createUser failed: ${pharmacyError?.message}`)
  pharmacyUserId = pharmacyData.user.id
  const { error: pharmacyProfileError } = await admin.from('profiles').insert({
    id: pharmacyUserId, role: 'pharmacy', full_name: 'Pharm Dispenses Test Pharmacy',
  })
  if (pharmacyProfileError) throw new Error(`profile insert failed: ${pharmacyProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-PHARMTEST-1', fullName: 'Pharm Dispenses Test', phone: '9222222222', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  const { error: doctorSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: doctorEmail, password: testPassword,
  })
  if (doctorSignInError) throw new Error(`signIn failed: ${doctorSignInError.message}`)

  const rx = await Prescriptions.draft({
    visitId: testVisitId, patientId: testPatientId, doctorId: doctorUserId, doctorName: 'Pharm Dispenses Test Doctor',
    lines: [{ id: 'RL-1', drugName: 'Paracetamol 500mg', dose: '500mg', days: 5, quantity: 15, status: 'draft' }],
  })
  await Prescriptions.sign(rx.id, { allergyChecked: true, interactionChecked: true, doseChecked: true, narcoticChecked: false, flags: [] })
  testPrescriptionId = rx.id

  const { error: pharmacySignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: pharmacyEmail, password: testPassword,
  })
  if (pharmacySignInError) throw new Error(`signIn failed: ${pharmacySignInError.message}`)
})

afterAll(async () => {
  await admin.from('pharmacy_dispenses').delete().eq('prescription_id', testPrescriptionId)
  await admin.from('prescriptions').delete().eq('id', testPrescriptionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', pharmacyUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(pharmacyUserId)
})

afterEach(async () => {
  await admin.from('pharmacy_dispenses').delete().eq('id', testDispenseId)
})

function baseInput(overrides: Partial<Parameters<typeof PharmacyDispenses.create>[0]> = {}) {
  return {
    id: testDispenseId, prescriptionId: testPrescriptionId, patientId: testPatientId, patientName: 'Pharm Dispenses Test',
    tokenNumber: 7, doctorName: 'Dr. Pharm Dispenses Test Doctor', department: 'General Medicine',
    source: 'OPD' as const, paymentMode: 'Cash' as const,
    medicines: [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 }],
    dispatchedAt: new Date().toISOString(), estimatedReadyIn: 3,
    ...overrides,
  }
}

describe('PharmacyDispenses repository', () => {
  it('creates a dispense for a signed prescription', async () => {
    const saved = await PharmacyDispenses.create(baseInput())
    expect(saved.status).toBe('queued')
    expect(saved.medicines).toHaveLength(1)
  })

  it('byPrescription() returns the dispense', async () => {
    await PharmacyDispenses.create(baseInput())
    const rows = await PharmacyDispenses.byPrescription(testPrescriptionId)
    expect(rows.some((d) => d.id === testDispenseId)).toBe(true)
  })

  it('claim() assigns the actor and moves queued -> preparing', async () => {
    await PharmacyDispenses.create(baseInput())
    const claimed = await PharmacyDispenses.claim(testDispenseId, RITU)
    expect(claimed?.status).toBe('preparing')
    expect(claimed?.assignedTo?.id).toBe('PH-301')
  })

  it('release() clears the actor and moves preparing -> queued', async () => {
    await PharmacyDispenses.create(baseInput())
    await PharmacyDispenses.claim(testDispenseId, RITU)
    const released = await PharmacyDispenses.release(testDispenseId)
    expect(released?.status).toBe('queued')
    expect(released?.assignedTo).toBeUndefined()
  })

  it('updateStatus() moves to ready and zeroes estimatedReadyIn', async () => {
    await PharmacyDispenses.create(baseInput())
    const ready = await PharmacyDispenses.updateStatus(testDispenseId, 'ready')
    expect(ready?.status).toBe('ready')
    expect(ready?.estimatedReadyIn).toBe(0)
  })

  it('markCollected() stamps collectedBy/collectedAt/dispensedBy and moves to collected', async () => {
    await PharmacyDispenses.create(baseInput())
    await PharmacyDispenses.claim(testDispenseId, RITU)
    const collected = await PharmacyDispenses.markCollected(testDispenseId, 'Self (patient)', undefined)
    expect(collected?.status).toBe('collected')
    expect(collected?.collectedBy).toBe('Self (patient)')
    expect(collected?.dispensedBy?.id).toBe('PH-301')
  })

  it('setMedicineSupply() updates the matching medicine line', async () => {
    await PharmacyDispenses.create(baseInput())
    const updated = await PharmacyDispenses.setMedicineSupply(testDispenseId, 'Paracetamol 500mg', 'advised_outside')
    expect(updated?.medicines[0]?.supply).toBe('advised_outside')
  })

  it('substituteMedicine() swaps the name and records substitutedFrom', async () => {
    await PharmacyDispenses.create(baseInput())
    const substituted = await PharmacyDispenses.substituteMedicine(testDispenseId, 'Paracetamol 500mg', 'Ibuprofen 400mg')
    expect(substituted?.medicines[0]?.name).toBe('Ibuprofen 400mg')
    expect(substituted?.medicines[0]?.substitutedFrom).toBe('Paracetamol 500mg')
  })

  it('requestProcurement() sets procurementStatus and requestedByWardAt', async () => {
    await PharmacyDispenses.create(baseInput())
    const requested = await PharmacyDispenses.requestProcurement(testDispenseId)
    expect(requested?.procurementStatus).toBe('procurement_requested')
    expect(requested?.requestedByWardAt).toBeTruthy()
  })

  it('adjustQuantity() sets quantityModifications and bill totals', async () => {
    await PharmacyDispenses.create(baseInput())
    const adjusted = await PharmacyDispenses.adjustQuantity(testDispenseId, [{
      medicineName: 'Paracetamol 500mg', originalQty: 15, adjustedQty: 10, reason: 'Partial fill',
      adjustedAt: new Date().toISOString(), adjustedBy: 'Ritu Sharma', requiresSupervisorOverride: false,
    }], 80, 120)
    expect(adjusted?.quantityModifications).toHaveLength(1)
    expect(adjusted?.adjustedBillTotal).toBe(80)
  })

  it('approveSupervisorOverride() clears requiresSupervisorOverride', async () => {
    await PharmacyDispenses.create(baseInput())
    await PharmacyDispenses.adjustQuantity(testDispenseId, [{
      medicineName: 'Paracetamol 500mg', originalQty: 15, adjustedQty: 2, reason: 'Unable to afford',
      adjustedAt: new Date().toISOString(), adjustedBy: 'Ritu Sharma', requiresSupervisorOverride: true,
    }], 16, 120)
    const approved = await PharmacyDispenses.approveSupervisorOverride(testDispenseId, 'Paracetamol 500mg', 'Dr. Supervisor')
    expect(approved?.quantityModifications[0]?.requiresSupervisorOverride).toBe(false)
    expect(approved?.quantityModifications[0]?.supervisorApprovedBy).toBe('Dr. Supervisor')
  })
})
```

- [ ] **Step 6: Write `src/lib/api/__tests__/pharmacy-inventory.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { PharmacyStock, PharmacyPurchaseOrders } from '@/lib/api/pharmacy-inventory'
import { getSupabaseClient } from '@/lib/supabase/client'

const testStockName = 'Pharm Inventory Test Drug 500mg'
const testStockId = 'PSI-PHARMINVTEST-1'
const testPOId = 'PPO-PHARMINVTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const pharmacyEmail = 'pharm-inventory-test-pharmacy@example.com'
const testPassword = 'Test-Pass-123!'
let pharmacyUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: pharmacyEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  pharmacyUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: pharmacyUserId, role: 'pharmacy', full_name: 'Pharm Inventory Test Pharmacy',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: pharmacyEmail, password: testPassword })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', pharmacyUserId)
  await admin.auth.admin.deleteUser(pharmacyUserId)
})

afterEach(async () => {
  await admin.from('pharmacy_stock_items').delete().eq('id', testStockId)
  await admin.from('pharmacy_purchase_orders').delete().eq('id', testPOId)
})

describe('PharmacyStock repository', () => {
  it('getOrCreateByName() creates a new row when none exists', async () => {
    const created = await PharmacyStock.getOrCreateByName({
      id: testStockId, name: testStockName, category: 'Analgesic', qty: 100, unit: 'Tabs', reorderAt: 20, maxStock: 500,
    } as Parameters<typeof PharmacyStock.getOrCreateByName>[0])
    expect(created.name).toBe(testStockName)
    expect(created.qty).toBe(100)
  })

  it('getOrCreateByName() returns the existing row on a second call', async () => {
    const first = await PharmacyStock.getOrCreateByName({
      id: testStockId, name: testStockName, category: 'Analgesic', qty: 100, unit: 'Tabs', reorderAt: 20, maxStock: 500,
    } as Parameters<typeof PharmacyStock.getOrCreateByName>[0])
    const second = await PharmacyStock.getOrCreateByName({
      name: testStockName, category: 'Analgesic', qty: 999, unit: 'Tabs', reorderAt: 20, maxStock: 500,
    } as Parameters<typeof PharmacyStock.getOrCreateByName>[0])
    expect(second.id).toBe(first.id)
    expect(second.qty).toBe(100) // unchanged — the existing row wins, not the second call's qty
  })

  it('decrementQty() and restockQty() adjust qty within bounds', async () => {
    const item = await PharmacyStock.getOrCreateByName({
      id: testStockId, name: testStockName, category: 'Analgesic', qty: 100, unit: 'Tabs', reorderAt: 20, maxStock: 150,
    } as Parameters<typeof PharmacyStock.getOrCreateByName>[0])
    const decremented = await PharmacyStock.decrementQty(item.id, 30)
    expect(decremented?.qty).toBe(70)
    const restocked = await PharmacyStock.restockQty(item.id, 1000)
    expect(restocked?.qty).toBe(150) // capped at maxStock
  })
})

describe('PharmacyPurchaseOrders repository', () => {
  it('create() raises a pending purchase order', async () => {
    const po = await PharmacyPurchaseOrders.create(
      { drug: testStockName, qty: 50, kind: 'restock' },
      'Pharm Inventory Test Pharmacy',
    )
    expect(po.status).toBe('pending')
    expect(po.raisedBy).toBe('Pharm Inventory Test Pharmacy')
    await admin.from('pharmacy_purchase_orders').delete().eq('id', po.id)
  })

  it('setStatus() transitions pending -> ordered -> received', async () => {
    const po = await PharmacyPurchaseOrders.create(
      { id: testPOId, drug: testStockName, qty: 50, kind: 'patient', forPatient: 'Test Patient' } as Parameters<typeof PharmacyPurchaseOrders.create>[0],
      'Pharm Inventory Test Pharmacy',
    )
    const ordered = await PharmacyPurchaseOrders.setStatus(po.id, 'ordered')
    expect(ordered?.status).toBe('ordered')
    const received = await PharmacyPurchaseOrders.setStatus(po.id, 'received')
    expect(received?.status).toBe('received')
  })
})
```

- [ ] **Step 7: Write `src/lib/api/__tests__/narcotics.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NarcoticsLog } from '@/lib/api/narcotics'
import { getSupabaseClient } from '@/lib/supabase/client'

const testEntryId = 'NCL-NARCTEST-1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const pharmacyEmail = 'narcotics-test-pharmacy@example.com'
const testPassword = 'Test-Pass-123!'
let pharmacyUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: pharmacyEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  pharmacyUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: pharmacyUserId, role: 'pharmacy', full_name: 'Narcotics Test Pharmacy',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: pharmacyEmail, password: testPassword })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', pharmacyUserId)
  await admin.auth.admin.deleteUser(pharmacyUserId)
})

afterEach(async () => {
  await admin.from('narcotics_log').delete().eq('id', testEntryId)
})

describe('NarcoticsLog repository', () => {
  it('create() writes a dual-signature entry', async () => {
    const entry = await NarcoticsLog.create({
      id: testEntryId, drug: 'Morphine 10mg/mL', date: '2026-07-05', time: '08:30',
      patient: 'Narcotics Test Patient', patientId: 'PT-NARCTEST-1', dose: '5mg IV',
      prescriber: 'Dr. Narcotics Test', dispenser: 'Narcotics Test Pharmacy',
      secondSignatory: 'Dr. Narcotics Test', batchNo: 'BTH-20240501-M', runningStock: 12,
    } as Parameters<typeof NarcoticsLog.create>[0])
    expect(entry.drug).toBe('Morphine 10mg/mL')
    expect(entry.runningStock).toBe(12)
  })
})
```

- [ ] **Step 8: Run all three test files, confirm they pass**

Run: `npx vitest run src/lib/api/__tests__/pharmacy-dispenses.test.ts src/lib/api/__tests__/pharmacy-inventory.test.ts src/lib/api/__tests__/narcotics.test.ts`
Expected: `Test Files 3 passed (3)` / `Tests 15 passed (15)`.

- [ ] **Step 9: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/lib/api/pharmacy-dispenses.ts src/lib/api/pharmacy-inventory.ts src/lib/api/narcotics.ts src/lib/api/index.ts src/lib/api/__tests__/pharmacy-dispenses.test.ts src/lib/api/__tests__/pharmacy-inventory.test.ts src/lib/api/__tests__/narcotics.test.ts
```

---

### Task 3: Bridge prescription→queue materialization ("order rewire") + the `realId` backreference

**Files:**
- Modify: `src/store/usePharmacyStore.ts` — add `realId?: string` to `PharmacyPrescription`, add `setRealId` action, fix the SSR/Node storage crash.
- Modify: `src/app/doctor/dashboard/page.tsx` — `sendRx`.
- Create: `supabase/migrations/20260705060000_pharmacy_dispenses_insert_doctor.sql`

**Interfaces:**
- Consumes: `PharmacyDispenses.create` (Task 2), `Prescriptions.draft`/`Prescriptions.sign` (existing, Phase 3, already bridged in `sendRx`), `withLiveSession` (existing, `page.tsx` lines 229-241).
- Produces: `PharmacyPrescription.realId?: string`, `usePharmacyStore.getState().setRealId(localId, realId)` — consumed by every bridge in Tasks 4-6.

**Read before implementing:** `src/store/usePharmacyStore.ts` in full (already done for this plan — re-verify `addPrescription`'s exact current shape), `src/app/doctor/dashboard/page.tsx`'s `sendRx` (lines 534-586) and `dispatchLabOrder`/`dispatchRadOrder` (the templates this task mirrors, both already real-backend-bridged).

**Design decision — where does materialization live: `sendRx` (page component) or `usePharmacyStore.addPrescription` (store)?** Same choice Lab/Radiology made, for the same reason: `sendRx` is already the file where the Phase 3 `Prescriptions.draft`/`.sign()` bridge lives, already imports `withLiveSession`, and is the one place that knows both "a doctor just signed this prescription" and "here is the live session to attribute it to." Keeping it in `sendRx` also means `usePharmacyStore` stays purely local and reusable from any other future caller without dragging in a backend dependency.

**A required precondition found while planning this task: `usePharmacyStore.ts`'s persist storage will crash under Vitest (Node environment).** Its persist config is `storage: createJSONStorage(() => localStorage)` (line 453) — a bare reference to the global `localStorage`, the identical bug Phase 5 Task 3 found and fixed in `useRadiologyStudiesStore.ts`. `vitest.config.ts` sets `environment: 'node'` — the moment this task's throwaway verification script calls `usePharmacyStore.getState().addPrescription(...)`, zustand's persist middleware calls `storage.setItem(...)`, referencing the bare `localStorage` global and throwing `ReferenceError: localStorage is not defined`. This must be fixed in this task, not deferred — Task 3 is the first task to call this store's actions from a test.

- [ ] **Step 1: Write a failing test proving the storage crash**

`src/store/__tests__/_throwaway-task3-storage-check.test.ts` (throwaway — confirms the bug, then gets deleted once the real fix + real verification script replace it):

```ts
import { describe, expect, it } from 'vitest'
import { usePharmacyStore } from '@/store/usePharmacyStore'

describe('usePharmacyStore under Node (no window)', () => {
  it('addPrescription does not throw when persisted storage is touched', () => {
    expect(() => {
      usePharmacyStore.getState().addPrescription({
        id: 'RX-STORAGECHECK', patientId: 'PT-STORAGECHECK', patientName: 'Storage Check',
        tokenNumber: 1, doctorName: 'Dr. Test', department: 'General Medicine',
        status: 'queued', dispatchedAt: new Date().toISOString(), estimatedReadyIn: 3,
        medicines: [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 }],
      })
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/store/__tests__/_throwaway-task3-storage-check.test.ts`
Expected: FAIL — `ReferenceError: localStorage is not defined`.

- [ ] **Step 3: Fix the storage guard in `usePharmacyStore.ts`**

Add, near the top of the file (after the imports, before `WARD_SOURCES`):

```ts
// Phase 6 Task 3 — guarded on `isBrowser` (same pattern as _core.ts's
// readRaw/writeRaw/removeRaw, and useRadiologyStudiesStore.ts's safeStorage
// fix from Phase 5 Task 3). `createJSONStorage(() => localStorage)` always
// succeeded at store-creation time, but its bare `localStorage` reference
// threw uncaught the first time persist actually called getItem/setItem in
// any non-browser environment (SSR, this Node-based vitest suite) — any store
// action that calls `set()` would crash outside a real browser.
const isBrowser = typeof window !== 'undefined'
const safeStorage = {
  getItem: (name: string) => isBrowser ? localStorage.getItem(name) : null,
  setItem: (name: string, value: string) => { if (isBrowser) localStorage.setItem(name, value) },
  removeItem: (name: string) => { if (isBrowser) localStorage.removeItem(name) },
}
```

Replace:
```ts
    storage: createJSONStorage(() => localStorage),
```
with:
```ts
    storage: createJSONStorage(() => safeStorage),
```

- [ ] **Step 4: Run the storage-check test again, confirm it passes, then delete it**

Run: `npx vitest run src/store/__tests__/_throwaway-task3-storage-check.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task3-storage-check.test.ts
```

- [ ] **Step 5: Add `realId` + `setRealId`**

In `src/store/usePharmacyStore.ts`, add to the `PharmacyPrescription` interface (after `collectedAt?: string`):

```ts
  realId?: string             // the real pharmacy_dispenses.id, once materialized (Phase 6 Task 3)
```

Add to the `PharmacyStore` interface (after `approveSupervisorOverride`):

```ts
  setRealId: (id: string, realId: string) => void
```

Add to the store implementation (after `approveSupervisorOverride`'s implementation, before the closing `}),` of the `create<PharmacyStore>()(persist((set, get) => ({...` block):

```ts
  // Phase 6 Task 3 — stamps the real backend id onto the matching local
  // prescription, once sendRx's materialization succeeds. One dispense row
  // per prescription (no grouping ambiguity), so a simple id match is
  // correct with no positional-matching caveat needed.
  setRealId: (id, realId) => set(state => ({
    prescriptions: state.prescriptions.map(p => p.id === id ? { ...p, realId } : p),
  })),
```

- [ ] **Step 6: Rewire `sendRx` in `src/app/doctor/dashboard/page.tsx`**

Add an import (near the existing `useLabOrdersStore`/`useRadiologyStudiesStore` imports):

```ts
import { usePharmacyStore } from "@/store/usePharmacyStore"
```

(If `usePharmacyStore` is already imported for `addToPharmacy` at the top of `DoctorDashboard`, this import already exists — confirm before adding a duplicate. The existing binding is `const { addPrescription: addToPharmacy } = usePharmacyStore()`.)

Add a binding for the new action, near the existing `addToPharmacy` binding:

```ts
  const setPharmacyRealId = usePharmacyStore(s => s.setRealId)
```

Replace the existing `sendRx` (lines 534-586) with:

```ts
  const sendRx = async () => {
    if (!currentPatient || prescriptions.length === 0) return
    const localRxId = `RX-${Date.now()}`
    const medicines = prescriptions.map(p => ({
      name: p.medicine, dosage: p.dosage, frequency: p.instructions ?? "As directed",
      duration: p.duration, quantity: parseInt(qty) || 10,
    }))
    addToPharmacy({
      id: localRxId,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      tokenNumber: currentPatient.token,
      doctorName: currentPatient.doctor,
      department: currentPatient.department,
      status: "queued",
      dispatchedAt: new Date().toISOString(),
      estimatedReadyIn: prescriptions.length * 3,
      triageLevel: currentPatient.triageLevel,
      medicines,
    })
    sendToPharmacy()
    recordStat(doctorId, 'prescriptions', prescriptions.length)
    toast.success("Prescription sent to Pharmacy")

    // Phase 3 Task 4 — same additive real-backend bridge as dispatchLabOrder/dispatchRadOrder
    // above: gate on the *live* Supabase session (never a persisted auth flag) and only
    // when this patient has a real visit. A backend failure here must never break the
    // local pharmacy-queue UX above.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { Prescriptions, PharmacyDispenses } = await import('@/lib/api')
      const rx = await Prescriptions.draft({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        doctorName: currentPatient.doctor,
        lines: prescriptions.map((p, i) => ({
          id: `RL-${i}`,
          drugName: p.medicine,
          dose: p.dosage,
          days: parseDurationDays(p.duration),
          quantity: 0,
          instructions: p.instructions,
          status: 'draft' as const,
        })),
      })
      // Phase 3 Task 4 simplification — NOT a real safety verification. The local
      // useConsultationStore's Prescription type carries no allergy/interaction/dose/
      // narcotic check results at all today (no drug-safety-check UI exists client-side
      // yet), so these values are hardcoded placeholders and cannot reflect any actual
      // check performed. A future phase wiring real prescribing safety checks (against
      // useDrugMasterStore) must replace this with the genuine check results before this
      // can be treated as a verified safety envelope.
      await Prescriptions.sign(rx.id, {
        allergyChecked: true, interactionChecked: true, doseChecked: true, narcoticChecked: false, flags: [],
      })

      // Phase 6 Task 3 (order rewire) — materialize the real pharmacy_dispenses
      // row the pharmacy actually works against, mirroring
      // usePharmacyStore.addPrescription()'s client-side logic. `department`/
      // `tokenNumber`/`medicines` are the exact same values already sent to the
      // local store above — built once, reused for both writes.
      const dispense = await PharmacyDispenses.create({
        prescriptionId: rx.id,
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        tokenNumber: currentPatient.token,
        doctorName: currentPatient.doctor,
        department: currentPatient.department,
        source: 'OPD',
        paymentMode: 'Cash',
        medicines,
        dispatchedAt: rx.createdAt,
        estimatedReadyIn: prescriptions.length * 3,
        triageLevel: currentPatient.triageLevel,
      })
      setPharmacyRealId(localRxId, dispense.id)
    }, 'real prescription write failed (local pharmacy queue still updated)')
  }
```

- [ ] **Step 7: Write and run the throwaway verification script proving the doctor session can materialize a real dispense**

`src/lib/api/__tests__/_throwaway-task3-verify.test.ts` (same convention as Phase 4/5 Task 3's own throwaway scripts):

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Prescriptions } from '@/lib/api/prescriptions'
import { PharmacyDispenses } from '@/lib/api/pharmacy-dispenses'
import { getSupabaseClient } from '@/lib/supabase/client'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = `task3-verify-reception-${Date.now()}@example.com`
const doctorEmail = `task3-verify-doctor-${Date.now()}@example.com`
const testPassword = 'Test-Pass-123!'
const testPatientId = `PT-TASK3VERIFY-${Date.now()}`
const testVisitId = `VIS-TASK3VERIFY-${Date.now()}`
let receptionUserId: string
let doctorUserId: string
let testPrescriptionId: string

beforeAll(async () => {
  const { data: receptionData } = await admin.auth.admin.createUser({ email: receptionEmail, password: testPassword, email_confirm: true })
  receptionUserId = receptionData!.user!.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Task3 Verify Reception' })

  const { data: doctorData } = await admin.auth.admin.createUser({ email: doctorEmail, password: testPassword, email_confirm: true })
  doctorUserId = doctorData!.user!.id
  await admin.from('profiles').insert({ id: doctorUserId, role: 'doctor', full_name: 'Task3 Verify Doctor' })

  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
  await Patients.create({ id: testPatientId, hn: `HN-${testPatientId}`, fullName: 'Task3 Verify Patient', phone: '9555555555', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('pharmacy_dispenses').delete().eq('prescription_id', testPrescriptionId)
  await admin.from('prescriptions').delete().eq('id', testPrescriptionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

describe('Task 3 order rewire — doctor materializes a real pharmacy_dispenses row', () => {
  it('creates prescription + dispense with matching fields', async () => {
    const rx = await Prescriptions.draft({
      visitId: testVisitId, patientId: testPatientId, doctorId: doctorUserId, doctorName: 'Task3 Verify Doctor',
      lines: [{ id: 'RL-1', drugName: 'Paracetamol 500mg', dose: '500mg', days: 5, quantity: 15, status: 'draft' }],
    })
    await Prescriptions.sign(rx.id, { allergyChecked: true, interactionChecked: true, doseChecked: true, narcoticChecked: false, flags: [] })
    testPrescriptionId = rx.id

    const dispense = await PharmacyDispenses.create({
      prescriptionId: rx.id, patientId: testPatientId, patientName: 'Task3 Verify Patient',
      tokenNumber: 1, doctorName: 'Task3 Verify Doctor', department: 'General Medicine',
      source: 'OPD', paymentMode: 'Cash',
      medicines: [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 }],
      dispatchedAt: rx.createdAt, estimatedReadyIn: 3,
    })

    expect(dispense.status).toBe('queued')

    const { data: row } = await admin.from('pharmacy_dispenses').select('*').eq('id', dispense.id).single()
    expect(row.prescription_id).toBe(rx.id)
    expect(row.status).toBe('queued')
  })
})
```

Run: `npx vitest run src/lib/api/__tests__/_throwaway-task3-verify.test.ts`
Expected: this proves `PharmacyDispenses.create()` (Task 2) works end-to-end against the live project once the doctor-INSERT RLS gap (next step) is closed — run it *before* Step 8 first to see the expected 403, confirming the gap is real, then again after Step 8 to confirm the fix.

- [ ] **Step 8: Add the doctor-INSERT RLS policy** (expect the prior run to 403 without it — same discovery Lab/Radiology Task 3 made)

`supabase/migrations/20260705060000_pharmacy_dispenses_insert_doctor.sql`:

```sql
-- Phase 6, Task 3 (order rewire) — doctor INSERT/SELECT access on pharmacy_dispenses.
--
-- The pharmacy_schema migration (20260705050000) only granted `pharmacy`/`admin`
-- roles write access (pharmacy_dispenses_all_pharmacy), plus doctor/nurse
-- SELECT-only policies. That leaves no policy allowing a doctor to INSERT — but
-- this task wires sendRx (doctor dashboard) to materialize the real
-- pharmacy_dispenses row immediately after the doctor's own Prescriptions.sign()
-- call. Without this, that write 403s under RLS the moment a real doctor
-- session attempts it — confirmed against the live project via this task's own
-- throwaway verification script, exactly mirroring the gap Lab/Radiology Task 3
-- found for their own order-rewire tables.
--
-- Applying Lab/Radiology's lesson proactively rather than in a follow-up
-- migration: the WITH CHECK is tightened from the start to match exactly what
-- sendRx's bridge sends — a freshly-queued dispense, not one already prepared/
-- collected — so a doctor's INSERT cannot fabricate a dispense already past
-- the 'queued' stage, with a fake assignedTo/dispensedBy, bypassing the
-- claim -> prepare -> ready -> collect workflow the rest of this module is
-- built around.
--
-- pharmacy_dispenses_select_doctor already exists from the original migration
-- (20260705050000), so only the INSERT policy is added here — same
-- Postgres/PostgREST RLS interaction Lab/Radiology's own Task 3 documented in
-- detail (Table.insert() in _core.ts chains .insert(...).select().single(),
-- and the inserted row must also satisfy a SELECT policy for that RETURNING
-- projection to be visible to the caller).

create policy pharmacy_dispenses_insert_doctor on pharmacy_dispenses for insert
  with check (
    exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid())
    and status = 'queued'
    and assigned_to is null
    and dispensed_by is null
    and collected_by is null
    and collected_at is null
  );
```

Apply: `npx supabase db push --db-url "$env:DATABASE_URL" --include-all --yes`

- [ ] **Step 9: Re-run the throwaway verification script, confirm it now passes, then delete it**

Run: `npx vitest run src/lib/api/__tests__/_throwaway-task3-verify.test.ts`
Expected: PASS.

```bash
rm src/lib/api/__tests__/_throwaway-task3-verify.test.ts
```

- [ ] **Step 10: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions (confirm the baseline count from Task 2 plus no new committed tests from this task).
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/usePharmacyStore.ts src/app/doctor/dashboard/page.tsx supabase/migrations/20260705060000_pharmacy_dispenses_insert_doctor.sql
```

---

### Task 4: Bridge claim/release/status-advance — `claim`, `release`, `updateStatus`

**Files:**
- Modify: `src/store/usePharmacyStore.ts`

**Interfaces:**
- Consumes: `PharmacyDispenses.claim`/`release`/`updateStatus` (Task 2), `Prescriptions.setDispenseStatus` (existing, Phase 3, never previously called), `PharmacyPrescription.realId` (Task 3).
- Produces: `resolveRealPharmacyActor(): Promise<Pharmacist | undefined>` — consumed by every actor-bearing bridge in this and Task 6 (`claim` here; `adjustQuantity`/`approveSupervisorOverride` in Task 6). `claim`/`release`/`updateStatus` become `Promise<void>` (were `void`).

**Design decision — `setDispenseStatus` mapping.** `Prescriptions.status` (Phase 3) only has `'dispensing'`/`'dispensed'` as pharmacy-relevant states (plus `'draft'`/`'signed'`/`'cancelled'`, none of which pharmacy transitions into). Mapping from the real 4-state `PrepStatus`: `preparing → 'dispensing'` (fired whenever a real dispense's status becomes `'preparing'`, from either `claim` or `updateStatus`), `collected → 'dispensed'` (fired in `markCollected`, Task 6). `queued`/`ready` have no `Prescriptions.status` equivalent and trigger no call. `release`'s reverse transition (`preparing → queued`) does **not** call `setDispenseStatus` back to `'signed'` — `Prescriptions` exposes no such "undispense" method, and forcing one is out of scope; a prescription that was briefly claimed and released simply stays `'dispensing'` in the real table until a later `claim`/`updateStatus`/`markCollected` call advances it again, which is a stale-but-harmless read (Prescriptions.status is not surfaced anywhere in the current UI as a pharmacy-facing status).

Add near the top of the file (after the existing imports, before the persist-storage guard added in Task 3), the live-session import (already present via `_core.ts`'s own import if `usePharmacyStore.ts` already imports `getSupabaseClient` for another reason — confirm before duplicating):

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
```

- [ ] **Step 1: Add the `resolveRealPharmacyActor` helper** (mirrors `useLabOrdersStore.ts`'s `resolveRealActor`/`useRadiologyStudiesStore.ts`'s `resolveRealRadActor` line-for-line, minus any bench-hint equivalent — `Pharmacist` carries no such metadata field)

Add after the `minsAgo` helper (before `DEMO_PRESCRIPTIONS`):

```ts
// Phase 6 Task 4 — resolves the REAL signed-in actor for a human pharmacy
// action (claim/adjustQuantity/approveSupervisorOverride), from a *live*
// Supabase session + a `profiles.full_name` lookup — never from the local
// `Pharmacist` parameter the UI passed in. That local parameter (RITU, ANIL,
// or `me` built from useAuthStore.currentUser) is a display-friendly demo
// roster entry / persisted-and-spoofable local flag, not necessarily a real
// `profiles.id`; mirroring it into `assigned_to`/`quantity_modifications[].
// supervisorApprovedBy` verbatim would let any caller claim to be any
// pharmacist, poisoning the audit trail (see
// src/lib/api/pharmacy-dispenses.ts's module-level note). Returns undefined
// (skip the write) if there's no live session or the session has no matching
// profile row.
async function resolveRealPharmacyActor(): Promise<Pharmacist | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}
```

- [ ] **Step 2: Change the `PharmacyStore` interface signatures**

```ts
  claim: (id: string, pharmacist: Pharmacist) => Promise<void>
  release: (id: string) => Promise<void>
  updateStatus: (id: string, status: PrepStatus) => Promise<void>
```

Confirmed safe via `grep -rn "await (claim|release|updateStatus)(" src/app/pharmacy src/app/nurse src/components/pharmacy` — 0 matches (all fire-and-forget in `src/app/pharmacy/queue/page.tsx`).

- [ ] **Step 3: Bridge `claim`** (actor-bearing — uses `resolveRealPharmacyActor`, never the local `pharmacist` param)

Replace:

```ts
  claim: (id, pharmacist) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id
          ? { ...p, assignedTo: pharmacist, status: p.status === 'queued' ? ('preparing' as PrepStatus) : p.status }
          : p
      ),
    })),
```

with:

```ts
  claim: async (id, pharmacist) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, assignedTo: pharmacist, status: p.status === 'queued' ? ('preparing' as PrepStatus) : p.status }
      }),
    }))
    if (!realId) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyDispenses, Prescriptions } = await import('@/lib/api')
      const patched = await PharmacyDispenses.claim(realId, actor)
      if (patched?.status === 'preparing') {
        await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensing')
      }
    } catch (err) {
      console.error('[usePharmacyStore] real backend claim failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `release`** (no actor — clears the assignment, does not touch `Prescriptions.status`, see this task's design note)

Replace:

```ts
  release: (id) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id
          ? { ...p, assignedTo: undefined, status: p.status === 'preparing' ? ('queued' as PrepStatus) : p.status }
          : p
      ),
    })),
```

with:

```ts
  release: async (id) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, assignedTo: undefined, status: p.status === 'preparing' ? ('queued' as PrepStatus) : p.status }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.release(realId)
    } catch (err) {
      console.error('[usePharmacyStore] real backend release failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 5: Bridge `updateStatus`** (no actor — keeps the existing local ready-notification side effect untouched, called after `set()` exactly as today)

Replace:

```ts
  updateStatus: (id, status) => {
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id ? { ...p, status, estimatedReadyIn: status === 'ready' ? 0 : p.estimatedReadyIn } : p
      ),
    }))
    // Closing the loop: when meds are ready, alert the right party — the ward
    // (nurse/MAR) for inpatient scripts, the patient for OPD scripts.
    if (status === 'ready') {
      const p = get().prescriptions.find(x => x.id === id)
      if (p) {
        const ward = isWardRx(p)
        useNotificationStore.getState().add({
          type: 'medicines_ready',
          priority: p.triageLevel === 'Critical' ? 'high' : 'medium',
          title: ward ? `Ward meds ready — ${p.patientName}` : `Medicines ready — ${p.patientName}`,
          body: ward
            ? `${p.medicines.length} item(s) ready for ${p.patientName} (${p.wardBed ?? 'ward'}) — collect/administer.`
            : `Your medicines are ready for collection at the pharmacy (token ${p.tokenNumber}).`,
          targetRole: ward ? 'nurse' : 'patient',
          patientName: p.patientName,
          channels: ['in_app'],
        })
      }
    }
  },
```

with:

```ts
  updateStatus: async (id, status) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, status, estimatedReadyIn: status === 'ready' ? 0 : p.estimatedReadyIn }
      }),
    }))
    // Closing the loop: when meds are ready, alert the right party — the ward
    // (nurse/MAR) for inpatient scripts, the patient for OPD scripts.
    if (status === 'ready') {
      const p = get().prescriptions.find(x => x.id === id)
      if (p) {
        const ward = isWardRx(p)
        useNotificationStore.getState().add({
          type: 'medicines_ready',
          priority: p.triageLevel === 'Critical' ? 'high' : 'medium',
          title: ward ? `Ward meds ready — ${p.patientName}` : `Medicines ready — ${p.patientName}`,
          body: ward
            ? `${p.medicines.length} item(s) ready for ${p.patientName} (${p.wardBed ?? 'ward'}) — collect/administer.`
            : `Your medicines are ready for collection at the pharmacy (token ${p.tokenNumber}).`,
          targetRole: ward ? 'nurse' : 'patient',
          patientName: p.patientName,
          channels: ['in_app'],
        })
      }
    }

    // Phase 6 Task 4 — additive bridge into the real backend.
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses, Prescriptions } = await import('@/lib/api')
      const patched = await PharmacyDispenses.updateStatus(realId, status)
      if (patched?.status === 'preparing') await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensing')
      if (patched?.status === 'collected') await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensed')
    } catch (err) {
      console.error('[usePharmacyStore] real backend updateStatus failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 6: Write and run a throwaway verification script proving actor identity comes from the session**

`src/store/__tests__/_throwaway-task4-verify.test.ts` — same rigor as Phase 4/5's own actor-identity proofs: create a real `reception`/`doctor`/`pharmacy`-role auth user set, materialize a real prescription + dispense exactly as Task 3's bridge does it, then `usePharmacyStore.getState().setRealId(...)`, then sign in as the `pharmacy`-role user (whose `profiles.full_name` is deliberately different from the local demo roster, e.g. `'Verify Real Pharmacy (Task 4)'` vs. `RITU.name === 'Ritu Sharma'`), call `claim(localRxId, RITU)` (passing the **local** demo pharmacist exactly as the UI would), then independently re-query the real row via the service-role admin client and assert `assigned_to.id === pharmacyUserId` and `assigned_to.name === 'Verify Real Pharmacy (Task 4)'`, explicitly asserting `!== 'PH-301'` / `!== 'Ritu Sharma'`, and that the real `prescriptions.status` is now `'dispensing'`. Also exercise `updateStatus(localRxId, 'ready')` and confirm the real row's `status`/`estimated_ready_in` update, `release` and confirm `status`/`assigned_to` revert, plus a demo-seeded prescription (`RX001`, no `realId`) safety check confirming all three actions call without throwing.

Run: `npx vitest run src/store/__tests__/_throwaway-task4-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task4-verify.test.ts
```

- [ ] **Step 7: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/usePharmacyStore.ts
```

---

### Task 5: Bridge substitution/supply/procurement — `substituteMedicine`, `setMedicineSupply`, `requestProcurement`, `raisePurchaseOrder`, `requestRestock`

**Files:**
- Modify: `src/store/usePharmacyStore.ts`
- Modify: `src/store/usePharmacyInventoryStore.ts`
- Create: `supabase/migrations/20260705070000_pharmacy_dispenses_update_doctor_nurse.sql`

**Interfaces:**
- Consumes: `resolveRealPharmacyActor` (Task 4), `PharmacyDispenses.substituteMedicine`/`setMedicineSupply`/`requestProcurement` (Task 2), `PharmacyPurchaseOrders.create` (Task 2).
- Produces: a second, separately-defined `resolveRealPharmacyActor()` inside `usePharmacyInventoryStore.ts` (mirroring, not importing, Task 4's helper — same convention Lab/Radiology use of one private copy per store file), `PurchaseOrder.realId?: string`, `usePharmacyInventoryStore.getState().setPORealId(localId, realId)` — consumed by Task 7.

**A dispatcher-brief correction, found while re-reading the real store code for this task:** the background material's phrasing "`requestProcurement` (creates a real purchase-order row)" does not match `usePharmacyStore.requestProcurement`'s actual local implementation — it only sets `procurementStatus`/`requestedByWardAt` flags on the dispense row; it never creates a `PurchaseOrder`. The action that actually creates a purchase order is `usePharmacyInventoryStore.raisePurchaseOrder` (and its `requestRestock` wrapper), a **different store**, called directly from `src/app/pharmacy/queue/page.tsx`'s `orderFromInventory` and `src/app/pharmacy/inventory/page.tsx`'s `requestRestockFor` — never from `requestProcurement`. This task bridges both, correctly attributed to their real call sites.

**A second real finding: `requestProcurement` is called by a nurse, not by pharmacy.** `src/app/nurse/medication/page.tsx` (verified by reading it in full) calls `usePharmacyStore`'s `requestProcurement(rx.id)` directly from a "Request Procurement" button on the nurse's ward-medication view — this is why Task 1 pre-added a nurse-scoped SELECT policy on `pharmacy_dispenses`; this task adds its UPDATE counterpart.

**A third real finding: `setMedicineSupply` is also called by a doctor.** `src/components/pharmacy/DoctorStockAlerts.tsx` (rendered on the doctor dashboard) calls `setMedicineSupply(rxId, med, "advised_outside")` directly. Both call sites invoke the *same* store action, so bridging it once in `usePharmacyStore.ts` covers both UIs — only the live session's actual role differs at runtime, enforced by RLS, not by which component called it.

- [ ] **Step 1: Change the `PharmacyStore` interface signatures** (in `src/store/usePharmacyStore.ts`)

```ts
  substituteMedicine: (id: string, originalName: string, newName: string, substitutedBy: string) => Promise<void>
  setMedicineSupply: (id: string, medicineName: string, supply: MedSupply) => Promise<void>
  requestProcurement: (id: string) => Promise<void>
```

Confirmed safe via `grep -rn "await (substituteMedicine|setMedicineSupply|requestProcurement)(" src/app/pharmacy src/app/nurse src/components/pharmacy` — 0 matches.

- [ ] **Step 2: Bridge `substituteMedicine`** (actor-bearing — `substitutedBy` at the queue page's call site is `me.name`, sourced from `useAuthStore.currentUser`, spoofable; the audit-log emission stays local-only and unchanged, matching how Lab/Radiology never mirrored their own local notification side effects into the backend)

Replace:

```ts
  substituteMedicine: (id, originalName, newName, substitutedBy) => {
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id
          ? {
              ...p,
              medicines: p.medicines.map(m =>
                m.name === originalName
                  ? { ...m, name: newName, inStock: true, supply: 'pharmacy' as MedSupply, substitutedFrom: m.substitutedFrom ?? originalName }
                  : m
              ),
            }
          : p
      ),
    }))
    const rx = get().prescriptions.find(p => p.id === id)
    if (rx) {
      useAuditStore.getState().log({
        userId: substitutedBy,
        userName: substitutedBy,
        action: 'pharmacy_substituted',
        resource: 'pharmacy_prescription',
        resourceId: id,
        detail: `${originalName} → ${newName} (out of stock, substituted)`,
        before: { drug: originalName },
        after: { drug: newName },
      })
    }
  },
```

with:

```ts
  substituteMedicine: async (id, originalName, newName, substitutedBy) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return {
          ...p,
          medicines: p.medicines.map(m =>
            m.name === originalName
              ? { ...m, name: newName, inStock: true, supply: 'pharmacy' as MedSupply, substitutedFrom: m.substitutedFrom ?? originalName }
              : m
          ),
        }
      }),
    }))
    const rx = get().prescriptions.find(p => p.id === id)
    if (rx) {
      useAuditStore.getState().log({
        userId: substitutedBy,
        userName: substitutedBy,
        action: 'pharmacy_substituted',
        resource: 'pharmacy_prescription',
        resourceId: id,
        detail: `${originalName} → ${newName} (out of stock, substituted)`,
        before: { drug: originalName },
        after: { drug: newName },
      })
    }

    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.substituteMedicine(realId, originalName, newName)
    } catch (err) {
      console.error('[usePharmacyStore] real backend substituteMedicine failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 3: Bridge `setMedicineSupply`** (no actor — applies unconditionally, matching existing local behavior; called from both the pharmacy queue page and the doctor's `DoctorStockAlerts`)

Replace:

```ts
  setMedicineSupply: (id, medicineName, supply) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id
          ? { ...p, medicines: p.medicines.map(m => m.name === medicineName ? { ...m, supply } : m) }
          : p
      ),
    })),
```

with:

```ts
  setMedicineSupply: async (id, medicineName, supply) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, medicines: p.medicines.map(m => m.name === medicineName ? { ...m, supply } : m) }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.setMedicineSupply(realId, medicineName, supply)
    } catch (err) {
      console.error('[usePharmacyStore] real backend setMedicineSupply failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `requestProcurement`** (no actor — called from the nurse's ward-medication page)

Replace:

```ts
  requestProcurement: (id) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id
          ? { ...p, procurementStatus: 'procurement_requested' as ProcurementStatus, requestedByWardAt: new Date().toISOString() }
          : p
      ),
    })),
```

with:

```ts
  requestProcurement: async (id) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, procurementStatus: 'procurement_requested' as ProcurementStatus, requestedByWardAt: new Date().toISOString() }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.requestProcurement(realId)
    } catch (err) {
      console.error('[usePharmacyStore] real backend requestProcurement failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 5: Add the doctor/nurse UPDATE RLS policies**

`supabase/migrations/20260705070000_pharmacy_dispenses_update_doctor_nurse.sql`:

```sql
-- Phase 6, Task 5 — doctor and nurse UPDATE access on pharmacy_dispenses.
--
-- Two real, non-pharmacy call sites write to pharmacy_dispenses (verified by
-- reading the actual files, not assumed from the task brief):
--   * src/components/pharmacy/DoctorStockAlerts.tsx (doctor dashboard) calls
--     setMedicineSupply(rxId, med, "advised_outside") -- a doctor advising a
--     patient to buy their own out-of-stock drug outside.
--   * src/app/nurse/medication/page.tsx calls requestProcurement(rx.id) -- a
--     nurse flagging an out-of-stock ward/ICU/OT prescription for pharmacy
--     procurement.
-- Both roles already have a SELECT policy (20260705050000) so this task's
-- bridge's PostgREST .update(...).select().single() RETURNING projection is
-- visible; this migration adds the matching UPDATE.
--
-- See 20260705050000_pharmacy_schema.sql's own "KNOWN, ACCEPTED RISK" comment
-- for why these are plain row-scoped policies (not column-grant-narrowed):
-- narrowing via GRANT would equally narrow the pharmacist's own broad column
-- access, since Supabase runs every authenticated request as the single
-- Postgres role `authenticated`.

create policy pharmacy_dispenses_update_doctor on pharmacy_dispenses for update
  using (exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid()))
  with check (exists (select 1 from prescriptions rx where rx.id = pharmacy_dispenses.prescription_id and rx.doctor_id = auth.uid()));

create policy pharmacy_dispenses_update_nurse on pharmacy_dispenses for update
  using (ward_bed is not null and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse'))
  with check (ward_bed is not null and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'nurse'));
```

Apply: `npx supabase db push --db-url "$env:DATABASE_URL" --include-all --yes`

- [ ] **Step 6: Fix the storage guard in `usePharmacyInventoryStore.ts`** (identical bare-`localStorage` bug as Task 3 found for `usePharmacyStore.ts` — this is the first task to call any of this store's actions from a test)

Add, near the top of the file (after the imports, before `THERAPEUTIC_ALTERNATIVES`):

```ts
// Phase 6 Task 5 — same isBrowser-guarded storage fix as usePharmacyStore.ts's
// Task 3 fix (and useRadiologyStudiesStore.ts's Phase 5 Task 3 precedent).
const isBrowser = typeof window !== 'undefined'
const safeStorage = {
  getItem: (name: string) => isBrowser ? localStorage.getItem(name) : null,
  setItem: (name: string, value: string) => { if (isBrowser) localStorage.setItem(name, value) },
  removeItem: (name: string) => { if (isBrowser) localStorage.removeItem(name) },
}
```

Replace:
```ts
    storage: createJSONStorage(() => localStorage),
```
with:
```ts
    storage: createJSONStorage(() => safeStorage),
```

- [ ] **Step 7: Add `realId` + `setPORealId` + `resolveRealPharmacyActor` to `usePharmacyInventoryStore.ts`**

Add to the `PurchaseOrder` type (after `raisedAt: string`):

```ts
  realId?: string             // the real pharmacy_purchase_orders.id, once materialized (Phase 6 Task 5)
```

Add to the `InventoryState` interface (after `setPOStatus`):

```ts
  setPORealId: (id: string, realId: string) => void
```

Add near the top of the file, after the `safeStorage` block from Step 6:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'

// Phase 6 Task 5 — a private copy of the same resolveRealPharmacyActor shape
// defined in usePharmacyStore.ts (Task 4) -- each store file defines its own,
// matching the Lab/Radiology convention of not sharing this helper across
// store modules. `raisedBy` at both real call sites (orderFromInventory /
// requestRestockFor in the pharmacy UI) is `me.name`, sourced from
// useAuthStore.currentUser — spoofable local state, never the real actor.
async function resolveRealPharmacyActor(): Promise<{ id: string; name: string } | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}
```

Add to the store implementation (after `restock`'s implementation):

```ts
  setPORealId: (id, realId) => set(s => ({
    purchaseOrders: s.purchaseOrders.map(p => p.id === id ? { ...p, realId } : p),
  })),
```

- [ ] **Step 8: Change `raisePurchaseOrder`'s signature and bridge it** (actor-bearing — `raisedBy` is resolved server-side, never the local string the caller passes)

Change the interface:

```ts
  raisePurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'status' | 'raisedAt'>) => Promise<void>
```

Confirmed safe via `grep -rn "await raisePurchaseOrder(" src/app/pharmacy` — 0 matches.

Replace:

```ts
  raisePurchaseOrder: (po) =>
    set(s => ({ purchaseOrders: [{ ...po, id: `PO-${Date.now()}-${++_po}`, status: 'pending', raisedAt: new Date().toISOString() }, ...s.purchaseOrders] })),
```

with:

```ts
  raisePurchaseOrder: async (po) => {
    const localId = `PO-${Date.now()}-${++_po}`
    set(s => ({ purchaseOrders: [{ ...po, id: localId, status: 'pending', raisedAt: new Date().toISOString() }, ...s.purchaseOrders] }))

    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyPurchaseOrders } = await import('@/lib/api')
      const created = await PharmacyPurchaseOrders.create(
        { drug: po.drug, qty: po.qty, kind: po.kind, forPatient: po.forPatient },
        actor.name,
      )
      get().setPORealId(localId, created.id)
    } catch (err) {
      console.error('[usePharmacyInventoryStore] real backend raisePurchaseOrder failed (local PO still updated):', err)
    }
  },
```

`requestRestock` needs no code change — it already only calls `get().raisePurchaseOrder({...})` internally, which now performs the real write itself.

- [ ] **Step 9: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task5-verify.test.ts` — real reception/doctor/pharmacy/nurse-role auth users, a real prescription+dispense materialized exactly as Task 3's bridge does it (then `usePharmacyStore.getState().setRealId(...)`), sign in as the nurse-role user and call `requestProcurement(localRxId)`, re-query the real row via the service-role admin client and assert `procurement_status === 'procurement_requested'`; sign in as the doctor-role user (matching the prescription's own `doctor_id`) and call `setMedicineSupply(localRxId, 'Paracetamol 500mg', 'advised_outside')`, re-query and assert the real `medicines[0].supply`; sign in as the pharmacy-role user and call `substituteMedicine(localRxId, 'Paracetamol 500mg', 'Ibuprofen 400mg', 'Ritu Sharma')`, re-query and assert the real medicine name changed. A second scenario, in `usePharmacyInventoryStore`, calls `raisePurchaseOrder({drug:'Test Drug', qty:50, kind:'restock', raisedBy:'Ritu Sharma'})` while signed in as the pharmacy-role user (whose `profiles.full_name` differs from `'Ritu Sharma'`), re-queries the real `pharmacy_purchase_orders` row via the admin client, and asserts `raised_by` equals the real signed-in user's `full_name`, explicitly asserting `!== 'Ritu Sharma'`. A third scenario is the demo-seeded (`RX001`/`PO-1001`, no `realId`) safety check confirming no throw for all five actions.

Run: `npx vitest run src/store/__tests__/_throwaway-task5-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task5-verify.test.ts
```

- [ ] **Step 10: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/usePharmacyStore.ts src/store/usePharmacyInventoryStore.ts supabase/migrations/20260705070000_pharmacy_dispenses_update_doctor_nurse.sql
```

---

### Task 6: Bridge quantity modification + collection — `adjustQuantity`, `approveSupervisorOverride`, `markCollected`, `decrementByName`, `addEntry`

**Files:**
- Modify: `src/store/usePharmacyStore.ts`
- Modify: `src/store/usePharmacyInventoryStore.ts`
- Modify: `src/store/useNarcoticsStore.ts`

**Interfaces:**
- Consumes: `resolveRealPharmacyActor` (Task 4/5), `PharmacyDispenses.adjustQuantity`/`approveSupervisorOverride`/`markCollected` (Task 2), `PharmacyStock.findByName`/`getOrCreateByName`/`decrementQty` (Task 2), `NarcoticsLog.create` (Task 2), `Prescriptions.setDispenseStatus` (Phase 3).

**Design decision — three independent bridges, not one orchestrated write.** `src/app/pharmacy/queue/page.tsx`'s `confirmCollect` (read in full for this plan) calls THREE separate store actions independently: `markCollected(rx.id, who)` [`usePharmacyStore`], then, in a loop over `rx.medicines`, `decrementByName(m.name, qty)` [`usePharmacyInventoryStore`] and conditionally `addNarcoticEntry({...})` [`useNarcoticsStore`]. This task bridges each of those three store actions independently, exactly mirroring that independence, rather than reconstructing `confirmCollect`'s page-level orchestration logic inside any one store's bridge. This keeps the "which medicines get logged, does this one match a schedule-flagged stock item" business logic exactly where it already lives (the page component), and each bridge stays a faithful mirror of only the ONE local action it wires — the same principle every prior bridge in this plan and in Lab/Radiology followed.

**`togglePatientModification` and `applyModification` are explicitly NOT bridged in this task.** Confirmed via `grep -rn "togglePatientModification|applyModification" src/` that neither has a single call site anywhere in the app (both are unreferenced dead code) — and `applyModification`'s own local implementation (`(prescriptionId) => set(state => ({ prescriptions: state.prescriptions.map(p => p.id === prescriptionId ? { ...p } : p) }))`) is already a no-op spread with no field changes, so even if it were called there is nothing for a real write to mirror. Consistent with Phase 4/5's own precedent of not bridging store actions with no real exercised call site.

- [ ] **Step 1: Change the `PharmacyStore` interface signatures** (in `src/store/usePharmacyStore.ts`)

```ts
  adjustQuantity: (prescriptionId: string, medicineName: string, newQty: number, reason: ModificationReason, adjustedBy: string) => Promise<void>
  approveSupervisorOverride: (prescriptionId: string, medicineName: string, supervisorId: string) => Promise<void>
  markCollected: (id: string, collectedBy?: string) => Promise<void>
```

Confirmed safe via `grep -rn "await (adjustQuantity|approveSupervisorOverride|markCollected)(" src/app/pharmacy` — 0 matches.

- [ ] **Step 2: Bridge `adjustQuantity`** (actor-bearing — `adjustedBy` at the call site is `me.name`, spoofable; the local pricing computation stays exactly as-is and is captured for the real write, since `UNIT_PRICES` has no server-side equivalent)

Replace:

```ts
  adjustQuantity: (prescriptionId, medicineName, newQty, reason, adjustedBy) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        const medicine = p.medicines.find(m => m.name === medicineName)
        if (!medicine) return p
        const originalQty = medicine.quantity
        const safeQty = Math.max(0, Math.min(originalQty, newQty))
        const requiresSupervisorOverride = originalQty > 0 && (originalQty - safeQty) / originalQty > 0.5
        const existingMods = (p.quantityModifications ?? []).filter(m => m.medicineName !== medicineName)
        const newMod: QuantityModification = {
          medicineName,
          originalQty,
          adjustedQty: safeQty,
          reason,
          adjustedAt: new Date().toISOString(),
          adjustedBy,
          requiresSupervisorOverride,
        }
        const allMods = [...existingMods, newMod]
        const adjustedBillTotal = p.medicines.reduce((sum, m) => {
          const mod = allMods.find(mod => mod.medicineName === m.name)
          const qty = mod ? mod.adjustedQty : m.quantity
          const price = UNIT_PRICES[m.name] ?? 0
          return sum + qty * price
        }, 0)
        const originalBillTotal = p.originalBillTotal ?? p.medicines.reduce((sum, m) => sum + m.quantity * (UNIT_PRICES[m.name] ?? 0), 0)

        useAuditStore.getState().log({
          userId: adjustedBy,
          userName: adjustedBy,
          action: 'pharmacy_qty_adjusted',
          resource: 'pharmacy_prescription',
          resourceId: prescriptionId,
          detail: `${medicineName}: ${originalQty} → ${safeQty} (${reason})`,
          before: { qty: originalQty },
          after: { qty: safeQty, reason },
        })

        return { ...p, quantityModifications: allMods, adjustedBillTotal, originalBillTotal }
      }),
    })),
```

with:

```ts
  adjustQuantity: async (prescriptionId, medicineName, newQty, reason, adjustedBy) => {
    let realId: string | undefined
    let savedMods: QuantityModification[] | undefined
    let savedAdjustedBill: number | undefined
    let savedOriginalBill: number | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        const medicine = p.medicines.find(m => m.name === medicineName)
        if (!medicine) return p
        realId = p.realId
        const originalQty = medicine.quantity
        const safeQty = Math.max(0, Math.min(originalQty, newQty))
        const requiresSupervisorOverride = originalQty > 0 && (originalQty - safeQty) / originalQty > 0.5
        const existingMods = (p.quantityModifications ?? []).filter(m => m.medicineName !== medicineName)
        const newMod: QuantityModification = {
          medicineName,
          originalQty,
          adjustedQty: safeQty,
          reason,
          adjustedAt: new Date().toISOString(),
          adjustedBy,
          requiresSupervisorOverride,
        }
        const allMods = [...existingMods, newMod]
        const adjustedBillTotal = p.medicines.reduce((sum, m) => {
          const mod = allMods.find(mod => mod.medicineName === m.name)
          const qty = mod ? mod.adjustedQty : m.quantity
          const price = UNIT_PRICES[m.name] ?? 0
          return sum + qty * price
        }, 0)
        const originalBillTotal = p.originalBillTotal ?? p.medicines.reduce((sum, m) => sum + m.quantity * (UNIT_PRICES[m.name] ?? 0), 0)
        savedMods = allMods
        savedAdjustedBill = adjustedBillTotal
        savedOriginalBill = originalBillTotal

        useAuditStore.getState().log({
          userId: adjustedBy,
          userName: adjustedBy,
          action: 'pharmacy_qty_adjusted',
          resource: 'pharmacy_prescription',
          resourceId: prescriptionId,
          detail: `${medicineName}: ${originalQty} → ${safeQty} (${reason})`,
          before: { qty: originalQty },
          after: { qty: safeQty, reason },
        })

        return { ...p, quantityModifications: allMods, adjustedBillTotal, originalBillTotal }
      }),
    }))

    if (!realId || !savedMods) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.adjustQuantity(realId, savedMods, savedAdjustedBill, savedOriginalBill)
    } catch (err) {
      console.error('[usePharmacyStore] real backend adjustQuantity failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 3: Bridge `approveSupervisorOverride`** (actor-bearing — `supervisorId` at the call site is `me.name`, spoofable; resolved via `resolveRealPharmacyActor`, using the resolved actor's `name` for the real column since the local column is a display-name string, not a jsonb `Pharmacist`)

Replace:

```ts
  approveSupervisorOverride: (prescriptionId, medicineName, supervisorId) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        const mods = (p.quantityModifications ?? []).map(m =>
          m.medicineName === medicineName ? { ...m, supervisorApprovedBy: supervisorId, requiresSupervisorOverride: false } : m
        )
        useAuditStore.getState().log({
          userId: supervisorId,
          userName: supervisorId,
          action: 'pharmacy_supervisor_override',
          resource: 'pharmacy_prescription',
          resourceId: prescriptionId,
          detail: `Supervisor override approved for ${medicineName}`,
        })
        return { ...p, quantityModifications: mods }
      }),
    })),
```

with:

```ts
  approveSupervisorOverride: async (prescriptionId, medicineName, supervisorId) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        realId = p.realId
        const mods = (p.quantityModifications ?? []).map(m =>
          m.medicineName === medicineName ? { ...m, supervisorApprovedBy: supervisorId, requiresSupervisorOverride: false } : m
        )
        useAuditStore.getState().log({
          userId: supervisorId,
          userName: supervisorId,
          action: 'pharmacy_supervisor_override',
          resource: 'pharmacy_prescription',
          resourceId: prescriptionId,
          detail: `Supervisor override approved for ${medicineName}`,
        })
        return { ...p, quantityModifications: mods }
      }),
    }))

    if (!realId) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.approveSupervisorOverride(realId, medicineName, actor.name)
    } catch (err) {
      console.error('[usePharmacyStore] real backend approveSupervisorOverride failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `markCollected`** (no fresh actor resolution — `dispensedBy` is threaded through from the row's own prior `assignedTo`, matching the local `p.dispensedBy ?? p.assignedTo` fallback exactly; also fires `Prescriptions.setDispenseStatus(..., 'dispensed')`)

Replace:

```ts
  // Final dispense: records who collected it + who dispensed (the assignee).
  markCollected: (id, collectedBy) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === id
          ? {
              ...p,
              status: 'collected' as PrepStatus,
              collectedBy: collectedBy ?? p.collectedBy ?? 'Self (patient)',
              collectedAt: new Date().toISOString(),
              dispensedBy: p.dispensedBy ?? p.assignedTo,
            }
          : p
      ),
    })),
```

with:

```ts
  // Final dispense: records who collected it + who dispensed (the assignee).
  markCollected: async (id, collectedBy) => {
    let realId: string | undefined
    let priorDispensedBy: Pharmacist | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        priorDispensedBy = p.dispensedBy ?? p.assignedTo
        return {
          ...p,
          status: 'collected' as PrepStatus,
          collectedBy: collectedBy ?? p.collectedBy ?? 'Self (patient)',
          collectedAt: new Date().toISOString(),
          dispensedBy: priorDispensedBy,
        }
      }),
    }))

    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses, Prescriptions } = await import('@/lib/api')
      const patched = await PharmacyDispenses.markCollected(realId, collectedBy, priorDispensedBy)
      if (patched) await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensed')
    } catch (err) {
      console.error('[usePharmacyStore] real backend markCollected failed (local prescription still updated):', err)
    }
  },
```

- [ ] **Step 5: Fix the storage guard in `useNarcoticsStore.ts`** (identical bare-`localStorage` bug — this is the first task to call `addEntry` from a test)

Add, near the top of the file (after the imports, before `SEED`):

```ts
// Phase 6 Task 6 — same isBrowser-guarded storage fix as usePharmacyStore.ts's
// Task 3 fix and usePharmacyInventoryStore.ts's Task 5 fix.
const isBrowser = typeof window !== 'undefined'
const safeStorage = {
  getItem: (name: string) => isBrowser ? localStorage.getItem(name) : null,
  setItem: (name: string, value: string) => { if (isBrowser) localStorage.setItem(name, value) },
  removeItem: (name: string) => { if (isBrowser) localStorage.removeItem(name) },
}
```

Replace:
```ts
    storage: createJSONStorage(() => localStorage),
```
with:
```ts
    storage: createJSONStorage(() => safeStorage),
```

- [ ] **Step 6: Bridge `addEntry`** (in `src/store/useNarcoticsStore.ts` — live-session-gated only, no `realId` concept: unlike every other entity in this phase, `NarcoticEntry` has no parent local entity to backreference against — every entry is either historic demo-seed data or a freshly created local entry, and a freshly created entry should become real immediately whenever a live session exists)

Add the import at the top:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
```

Change the interface:

```ts
  addEntry: (e: Omit<NarcoticEntry, 'id'>) => Promise<void>
```

Confirmed safe via `grep -rn "await addNarcoticEntry(" src/app/pharmacy` — 0 matches.

Replace:

```ts
  addEntry: (e) => set(s => ({ log: [{ ...e, id: `N-${Date.now()}-${++_seq}` }, ...s.log] })),
```

with:

```ts
  addEntry: async (e) => {
    set(s => ({ log: [{ ...e, id: `N-${Date.now()}-${++_seq}` }, ...s.log] }))

    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { NarcoticsLog } = await import('@/lib/api')
      await NarcoticsLog.create(e)
    } catch (err) {
      console.error('[useNarcoticsStore] real backend addEntry failed (local log still updated):', err)
    }
  },
```

- [ ] **Step 7: Bridge `decrementByName`** (in `src/store/usePharmacyInventoryStore.ts` — first-real-touch materialization via `getOrCreateByName`, since standing inventory has no "order" event to gate a `realId` on; skip entirely if no LOCAL item matches the name at all, matching the existing local `decrementByName`'s own `if (!item) return undefined` short-circuit)

Change the interface:

```ts
  decrementByName: (name: string, qty: number) => Promise<StockItem | undefined>
```

Confirmed safe via `grep -rn "await decrementByName(" src/app/pharmacy` — 0 matches.

Replace:

```ts
  decrementByName: (name, qty) => {
    const item = get().items.find(i => i.name === name) ?? get().items.find(i => baseWord(i.name) === baseWord(name))
    if (!item) return undefined
    set(s => ({ items: s.items.map(i => i.id === item.id ? { ...i, qty: Math.max(0, i.qty - qty) } : i) }))
    return item
  },
```

with:

```ts
  decrementByName: async (name, qty) => {
    const item = get().items.find(i => i.name === name) ?? get().items.find(i => baseWord(i.name) === baseWord(name))
    if (!item) return undefined
    set(s => ({ items: s.items.map(i => i.id === item.id ? { ...i, qty: Math.max(0, i.qty - qty) } : i) }))

    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (session) {
      try {
        const { PharmacyStock } = await import('@/lib/api')
        const stock = await PharmacyStock.getOrCreateByName({
          name: item.name, category: item.category, qty: item.qty, unit: item.unit,
          reorderAt: item.reorderAt, maxStock: item.maxStock, schedule: item.schedule,
        })
        await PharmacyStock.decrementQty(stock.id, qty)
      } catch (err) {
        console.error('[usePharmacyInventoryStore] real backend decrementByName failed (local item still updated):', err)
      }
    }
    return item
  },
```

- [ ] **Step 8: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task6-verify.test.ts` — real reception/doctor/pharmacy-role auth users, a real prescription+dispense materialized exactly as Task 3's bridge does it, `usePharmacyStore.getState().setRealId(...)`, sign in as the pharmacy-role user (`full_name` distinct from `'Ritu Sharma'`) and drive `claim(localRxId, RITU) → adjustQuantity(localRxId, 'Paracetamol 500mg', 10, 'Partial fill', 'Ritu Sharma') → approveSupervisorOverride(localRxId, 'Paracetamol 500mg', 'Dr. Supervisor') → markCollected(localRxId, 'Self (patient)')`, re-querying the real row after each call and asserting `quantity_modifications`/`supervisor_approved_by`/`status === 'collected'`/`dispensed_by.id === pharmacyUserId` (explicitly `!== 'PH-301'`) all match, and that `prescriptions.status === 'dispensed'`. A second scenario calls `usePharmacyInventoryStore`'s `decrementByName('Paracetamol 500mg', 10)` while signed in, re-queries `pharmacy_stock_items` by name via the admin client, and asserts a real row now exists with the decremented `qty`. A third scenario calls `useNarcoticsStore`'s `addEntry({drug:'Morphine 10mg/mL', ...})` while signed in, re-queries `narcotics_log` via the admin client, and asserts the row exists with matching fields. A fourth is the demo-seeded (`RX001`/no matching real stock name/`N-001`) safety check confirming no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task6-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task6-verify.test.ts
```

- [ ] **Step 9: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/usePharmacyStore.ts src/store/usePharmacyInventoryStore.ts src/store/useNarcoticsStore.ts
```

---

### Task 7: Bridge inventory-manager fulfillment — `setPOStatus`

**Files:**
- Modify: `src/store/usePharmacyInventoryStore.ts`

**Interfaces:**
- Consumes: `PharmacyPurchaseOrders.setStatus`, `PharmacyStock.getOrCreateByName`/`restockQty` (Task 2), `PurchaseOrder.realId` (Task 5).

**Design decision — include this task rather than deferring it, per the background brief's own recommendation.** `setPOStatus` is called from `src/app/inventory/requests/page.tsx` (verified by reading it in full) — the SAME `usePharmacyInventoryStore` this phase already bridges for its pharmacy-side actions (Task 5). Leaving it unbridged would mean a purchase order's real `status` could never actually change once created, which defeats the purpose of Task 5's real `pharmacy_purchase_orders` rows. As documented in Task 1/Global Constraints, the real live-session write only succeeds if the signed-in user's `profiles.role` is `'pharmacy'` or `'admin'` (`role_t` has no `'inventory'` value) — this is a known, deliberate limitation, not a bug in this task.

- [ ] **Step 1: Change the `InventoryState` interface signature**

```ts
  setPOStatus: (id: string, status: POStatus) => Promise<void>
```

Confirmed safe via `grep -rn "await setPOStatus(" src/app/inventory` — 0 matches (`src/app/inventory/requests/page.tsx`'s `markOrdered`/`markReceived` call it fire-and-forget, immediately followed by a `toast.success(...)`, unaffected by the call becoming async).

- [ ] **Step 2: Bridge `setPOStatus`** (mirrors the existing local reducer's own auto-restock-on-receipt logic against the real tables — read `po` from `get()` before `set()` so the original nested reducer body can stay unchanged)

Replace:

```ts
  setPOStatus: (id, status) =>
    set(s => {
      const po = s.purchaseOrders.find(p => p.id === id)
      const purchaseOrders = s.purchaseOrders.map(p => p.id === id ? { ...p, status } : p)
      // On receipt, restock the matching stock line (or top it up to reorder level if new).
      if (status === 'received' && po) {
        const match = s.items.find(i => i.name === po.drug) ?? s.items.find(i => baseWord(i.name) === baseWord(po.drug))
        if (match) {
          return { purchaseOrders, items: s.items.map(i => i.id === match.id ? { ...i, qty: Math.min(i.maxStock, i.qty + po.qty) } : i) }
        }
      }
      return { purchaseOrders }
    }),
```

with:

```ts
  setPOStatus: async (id, status) => {
    const po = get().purchaseOrders.find(p => p.id === id)
    set(s => {
      const target = s.purchaseOrders.find(p => p.id === id)
      const purchaseOrders = s.purchaseOrders.map(p => p.id === id ? { ...p, status } : p)
      // On receipt, restock the matching stock line (or top it up to reorder level if new).
      if (status === 'received' && target) {
        const match = s.items.find(i => i.name === target.drug) ?? s.items.find(i => baseWord(i.name) === baseWord(target.drug))
        if (match) {
          return { purchaseOrders, items: s.items.map(i => i.id === match.id ? { ...i, qty: Math.min(i.maxStock, i.qty + target.qty) } : i) }
        }
      }
      return { purchaseOrders }
    })

    if (!po?.realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyPurchaseOrders, PharmacyStock } = await import('@/lib/api')
      await PharmacyPurchaseOrders.setStatus(po.realId, status)
      if (status === 'received') {
        const localItem = get().items.find(i => i.name === po.drug) ?? get().items.find(i => baseWord(i.name) === baseWord(po.drug))
        const stock = await PharmacyStock.getOrCreateByName({
          name: localItem?.name ?? po.drug,
          category: localItem?.category ?? 'Unknown',
          qty: 0,
          unit: localItem?.unit ?? 'Units',
          reorderAt: localItem?.reorderAt ?? 0,
          maxStock: localItem?.maxStock ?? po.qty,
          schedule: localItem?.schedule,
        })
        await PharmacyStock.restockQty(stock.id, po.qty)
      }
    } catch (err) {
      console.error('[usePharmacyInventoryStore] real backend setPOStatus failed (local PO still updated):', err)
    }
  },
```

- [ ] **Step 3: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task7-verify.test.ts` — a real `pharmacy`-role auth user (standing in for the "Inventory Manager" persona, per this task's design note above — there is no real `'inventory'` role to sign in as), a real purchase order raised via `raisePurchaseOrder` exactly as Task 5's bridge does it (capturing the local id and its stamped `realId`), then `setPOStatus(localId, 'ordered')` (re-query the real `pharmacy_purchase_orders` row via the admin client, assert `status === 'ordered'`), then `setPOStatus(localId, 'received')` (re-query and assert `status === 'received'`, and re-query `pharmacy_stock_items` by the PO's drug name and assert its `qty` increased by the PO's `qty`). A second scenario asserts a demo-seeded PO (`PO-1001`, no `realId`) safety check confirming no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task7-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task7-verify.test.ts
```

- [ ] **Step 4: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions; this is the last task in the phase, so also confirm the running total matches Task 1's baseline plus Task 2's 19 new committed tests (4 schema + 15 repository), with no other net-new committed test files (every bridge task's verification script was throwaway).
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/usePharmacyInventoryStore.ts
```

---

## What this plan deliberately does not do

- **No changes to `src/lib/api/pharmacy.ts` or `src/lib/api/drugs.ts`** — both stay exactly as they are: orphaned scaffolds with zero non-`_seed.ts` imports anywhere, unrelated to this phase's new tables. See Task 1's design-decision list for the specific shape mismatches confirmed by reading both files.
- **`useDrugMasterStore`'s 8-drug formulary is out of scope** — it is explicitly framed in its own UI as "AI-generated/read-only" (a fake resync button, no real AI call), has no write actions of any kind (`search`/`getById` are pure local lookups), and nothing else in this phase reads from it as a validation source (the local `checkRx` safety-check function in `src/lib/drugSafety.ts` uses its own independent, hardcoded interaction/allergy tables, not `useDrugMasterStore`). There is no real write path to bridge and no real read path that would benefit from a backend round-trip over the existing in-memory constant array. A future phase introducing genuine server-side prescribing-safety checks (the same gap `sendRx`'s hardcoded safety envelope already flags) is the natural place to revisit this, not a pharmacy-dispensing phase.
- **`togglePatientModification` and `applyModification` are not bridged** — confirmed via grep that neither has any call site anywhere in the app, and `applyModification`'s own local implementation is already a no-op. See Task 6's design note.
- **No changes to the patient-facing read surface** (`src/app/patient/pharmacy/page.tsx`, `src/app/patient/medications/page.tsx`) — both read `usePharmacyStore` directly today and need no backend bridge of their own; a future patient-portal phase may add real patient-scoped RLS reads, out of scope here.
- **No reception/admin oversight read policies, no patient-self RLS read access** — neither is exercised by the current stores, consistent with how Phase 4/5 deferred the analogous items for Lab/Radiology.
- **No `role_t` enum widening to add a real `'inventory'` role** — a genuine, pre-existing gap (see Global Constraints), but a cross-cutting schema decision out of scope for a pharmacy-focused phase; Task 7's bridge documents the practical consequence (a real `/inventory/requests` write only succeeds today when signed in as `'pharmacy'`/`'admin'`).
- **No column-level GRANT hardening for `pharmacy_dispenses`** — the nurse/doctor row-scoped UPDATE policies (Task 5) leave a known, documented, accepted column-leakage risk identical in shape to the one `20260704125515_nurse_visits_column_grant.sql` closed for `visits`, but not repeated here because pharmacy's own broad column-access needs make a shared-Postgres-role column GRANT actively harmful (it would equally restrict the pharmacist). See Task 1's migration comment for the full reasoning.
- **No cross-tab merge logic invented for any of the three newly-storage-guard-fixed stores** (`usePharmacyStore`, `usePharmacyInventoryStore`, `useNarcoticsStore`) — each fix only resolves the Node/SSR crash (the same minimal `isBrowser` guard as `_core.ts`'s helpers and `useRadiologyStudiesStore.ts`'s Phase 5 fix); Lab's `mergingStorage` cross-tab convergent-merge behavior is a separate feature none of these three stores has ever had, and this phase does not add it.
- **No batch/lot-level tracking for narcotics** — `batchNo` stays a plain text field (today a hardcoded placeholder string in the local store), matching the instruction not to over-engineer beyond what any other module in this codebase does.

## Next step after this plan ships

OPD/IPD is the remaining module per the roadmap noted at the end of Phase 4/5's plans.

---

## Self-review

**1. Spec coverage.** All 7 requested tasks are present, matching the requested granularity: (1) schema+RLS with explicit design-decision notes for every non-obvious call (parent-table FK choice, jsonb-vs-child-table, the two-table stock/PO split, the `'inventory'` role gap, the doctor/nurse cross-role writes, the accepted column-grant risk), (2) three repository modules, (3) order rewire with an explicit `sendRx`-vs-store design note and the storage-guard fix, (4) claim/release/updateStatus + `resolveRealPharmacyActor` + the `setDispenseStatus` mapping decision, (5) substitution/supply/procurement — corrected from the task brief's own phrasing once the real `raisePurchaseOrder`/`requestRestock` call sites were confirmed, plus the doctor/nurse UPDATE RLS migration, (6) quantity modification + collection, including the real narcotics/stock-decrement bridges (kept as three independent bridges rather than one synthesized inside `markCollected`, per the design note), (7) inventory-manager fulfillment, included (not deferred) per the task brief's own recommendation, with the `'inventory'`-role limitation explicitly documented rather than silently assumed away. Task 8 (drug master formulary) is explicitly declared out of scope with its reasoning folded into "What this plan deliberately does not do," per the task brief's own explicit permission to do so. Every action named in the background research (`addPrescription` via Task 3's `create`, `updateStatus`, `markCollected`, `claim`, `release`, `setMedicineSupply`, `substituteMedicine`, `requestProcurement`, `adjustQuantity`, `approveSupervisorOverride` on `usePharmacyStore`; `decrementByName`, `raisePurchaseOrder`, `requestRestock`, `setPOStatus` on `usePharmacyInventoryStore`; `addEntry` on `useNarcoticsStore`) has a named bridge in exactly one task, except `togglePatientModification`/`applyModification`, explicitly excluded with reasoning. The `role_t` enum was verified against the real Phase 1 migration (`'pharmacy'` is a real value; `'inventory'` is not, confirmed, not assumed).
**2. Placeholder scan.** No "TBD"/"add appropriate error handling" language appears in any code step. Task 4/5/6/7's verification-script steps summarize the *scenario* rather than reproducing 100+ lines of boilerplate auth-fixture setup identical to Task 2/3's fully-written-out scripts — this is the same deliberate, bounded exception Phase 5's own plan used and its self-review explicitly sanctioned (the fixture pattern is fully specified once, verbatim, in Task 2's committed tests and Task 3's fully-written throwaway script). Every piece of *shipped* code (all four migrations, all three repository modules, every store bridge, the `sendRx` rewrite) is written out in full, not summarized.
**3. Type consistency.** `Pharmacist` (store, `usePharmacyStore.ts`) ↔ `PharmacistSchema`/`Pharmacist` (repo, Task 2) — both `{id: string, name: string}`, consistent, and reused (structurally, via a second local type of the same shape) in `usePharmacyInventoryStore.ts`'s own `resolveRealPharmacyActor`. `PharmacyPrescription.realId?: string` (Task 3) and `PurchaseOrder.realId?: string` (Task 5) are referenced identically everywhere they're read. `resolveRealPharmacyActor()` has one definition per store file (Task 4 in `usePharmacyStore.ts`, Task 5 in `usePharmacyInventoryStore.ts`) with no signature drift between them. `PharmacyDispenses.markCollected(id, collectedBy, dispensedBy)`'s three-argument signature (Task 2) matches exactly how Task 6 calls it. `PharmacyDispenses.adjustQuantity(id, allMods, adjustedBillTotal, originalBillTotal)`'s four-argument signature (Task 2) matches Task 6's call. Column names in every migration match the Zod schema field names' snake_case conversion exactly (spot-checked: `tokenNumber`↔`token_number`, `requestedByWardAt`↔`requested_by_ward_at`, `secondSignatory`↔`second_signatory` — no consecutive-capital-letter fields exist in this phase's shapes, so no `expectedTatMin`-style respelling was needed). RLS policy names (`pharmacy_dispenses_all_pharmacy`, `_select_doctor`, `_select_nurse`, `_insert_doctor`, `_update_doctor`, `_update_nurse`, `pharmacy_stock_items_all_pharmacy`, `pharmacy_purchase_orders_all_pharmacy`, `narcotics_log_all_pharmacy`) are unique and consistently referenced across Tasks 1, 3, and 5's migration comments.
