# Phase 7 — OPD/IPD (IPD-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full rich IPD workflow — admission-request bed assignment, the shared doctor/nurse/patient inpatient chart (rounds, meds/MAR, bedside vitals, IV/IO, in-chart test tracking, referrals/ICU-transfer/OT-booking/surgery status, discharge clearance), the hospital bed board, and nurse shift/handover + task worklist — persist to Postgres end-to-end, following the exact pattern proven across Phases 2-6. This is IPD-only: OPD is already fully covered by Phases 2-3's Reception/Vitals/Doctor-Consultation flow, and no separate OPD module is needed.

**Architecture:** `src/store/useInpatientStore.ts` (669 lines, 24 actions) is the existing, fully-built, localStorage-backed shared doctor+patient IPD chart — one `Inpatient` per admitted patient. `src/store/useAdmissionStore.ts` holds the admission-request queue and the hospital's own bed board. `src/store/useDischargeStore.ts`, `src/store/useShiftStore.ts`, and `src/store/useNursingStore.ts` cover discharge clearance, nurse shift/handover, and the nurse task worklist respectively. This phase adds new Postgres tables shaped to mirror these stores exactly (never the orphaned, zero-import `src/lib/api/ipd.ts` / `discharge.ts` / `bills.ts`, which stay untouched and unrelated), new repository modules, and additive guarded bridges into every action — following the exact pattern proven across Phases 2-6.

**Tech Stack:** Same as prior phases — Next.js App Router, TypeScript, Supabase/Postgres, Zustand, Zod, Vitest (against the real live Supabase project, no mocks).

## Global Constraints

- **Guard pattern, no exceptions**: every real write is gated by a *live* session check — `const { data: { session } } = await getSupabaseClient().auth.getSession(); if (!session) return;` — never `useAuthStore`.
- **Actor-identity integrity, proportionately applied**: a `resolveRealIpdActor(): Promise<{ id: string; name: string } | undefined>` helper (added in Task 4, `useInpatientStore.ts`) resolves the REAL signed-in actor from a live session + a `profiles.full_name` lookup, mirroring `useLabOrdersStore.ts`'s `resolveRealActor`/`useRadiologyStudiesStore.ts`'s `resolveRealRadActor`. It is applied specifically to actions whose signature takes an explicit, caller-suppliable "who did this" parameter that a UI caller could spoof (`administerMed`'s `by`, `addNursingNote`'s `by`, `recordVitals`'s embedded `by`, `addIo`'s `by`, `signHandover`/`receiveHandover`'s implicit signer) — for these, the value PERSISTED to the real row is always the resolved real actor, never the caller-supplied string (the local optimistic UI is untouched and may keep showing whatever the caller passed). Actions whose actor is not a caller-suppliable parameter but an already-fixed record field (e.g. `recordRound`/`addProgressNote`/`setCondition`/`addMed` all use `ip.admittingDoctor`, a string fixed once at admission time from the real requesting doctor) are NOT re-resolved — there is no spoofable input surface to guard there, and re-deriving would just reproduce the same value. `signConsent`'s `meta.signedBy` is a further, deliberate exception: the actual signer is typically the patient or a relative, and patients have no `profiles.role` row to resolve against in this codebase's auth model (`profiles.role` is staff-only) — this field stays a free-text, unverified label, gated only by the live-session guard (a witnessing staff member must be signed in).
- **No signature churn — fire-and-forget internal IIFE, not `Promise<void>` actions.** Unlike Lab/Radiology (which changed bridged actions' return type to `Promise<void>` after confirming, per-action, that no caller awaits them), `useInpatientStore.ts` has 24 actions with call sites spread across three portals (doctor, nurse, patient) — re-verifying zero-await-safety for all 24 individually is a large, error-prone grep surface. Every bridge in this phase instead keeps its action's existing signature and return type completely unchanged, and fires the real write from an internal `void (async () => { ... })()` IIFE at the end of the action body. This achieves the identical runtime behavior (real write happens, never blocks or changes what the caller sees) with zero call-site risk. Applied uniformly in Tasks 3-10.
- **`realId` backreference pattern**: `Inpatient` (Task 3), `AdmissionRequest` (Task 3), `DischargePatient` (Task 9), and `HandoverRecord` (Task 10) each get an optional `realId?: string`, stamped once a real row exists. Every bridge checks `if (!realId) return` (inside the IIFE) before attempting a real write. **Deliberate exception — `Bed` gets no `realId`.** A bed is a fixed physical inventory item whose local id (e.g. `'BED-101'`) already IS a natural key; the `beds` table is keyed directly by that same string and upserted (`put()`, not `insert()`) the first time a bed is actually touched by a real write. No row is pre-seeded — the 14 demo `MOCK_BEDS` stay local-only until a real write against one of them occurs.
- **Hybrid transport**: new repository methods use `src/lib/api/_core.ts`'s `table<T>()` and its `insert()`/`put()`/`patch()` methods, exactly as established.
- **No consecutive-capital-letter field names.** `_core.ts`'s `toSnakeCase`/`toCamelCase` do naive per-character conversion and cannot round-trip two adjacent uppercase letters. This phase has three such fields: the store's `systolicBP`, `diastolicBP` (on `VitalsRecord`), and `latestBP` (on `Inpatient`) are spelled `systolicBp`, `diastolicBp`, `latestBp` in every new Zod schema/DB column — the store bridge maps between the two spellings explicitly at the call site, exactly mirroring Lab's `expectedTatMin`/`expectedTATmin` precedent. `latestHbA1c` has NO adjacent capitals (H and A are separated by a lowercase `b`) and round-trips correctly unchanged.
- **RLS is verified against the LIVE Supabase project, never assumed.** Every task that adds a new write path includes a throwaway verification script proving the real role can perform it (and, where relevant, that an unauthorized role cannot).
- **Every task runs both `npm test` (Vitest, against the real live Supabase project, no mocks) AND `npx tsc --noEmit`.**
- **`profiles.role` enum is `'doctor' | 'nurse' | 'pharmacy' | 'lab' | 'radiology' | 'reception' | 'admin'`** (verified directly against `supabase/migrations/20260703123305_core_schema.sql`) — there is no dedicated `'admission'` role. The admission-desk/bed-manager portal (`src/app/admission/dashboard/page.tsx`) authenticates as `'reception'` or `'admin'`, matching the existing `admission_requests_select_staff` policy's role set from Phase 3.
- **`admission_requests` already exists and is real (Phase 3).** Only `create()` exists today (always force-sets `status: 'requested'`), called from the doctor dashboard's `handleSendAdmission`/`completeConsult`. That flow is DONE and is not re-planned. This phase adds the missing `requested → bed_assigned → admitted → cancelled` transition capability (Task 2) and wires it to `useAdmissionStore.ts`'s `assignBed`/`markAdmitted`/`cancelRequest` (Task 3) — plus a `hydrateReal()` bridge, since `useAdmissionStore.ts`'s local `admissionRequests` queue and the real `admission_requests` table are two independent representations today (the doctor's real bridge never touches `useAdmissionStore`'s local queue).
- **Canonical discharge pillar set: `'clinical' | 'nursing' | 'pharmacy' | 'billing' | 'insurance'`** (`useInpatientStore.ts`'s own `DischargePillarKey` — chosen because that store is the one that actually creates the `discharge` object, at `initiateDischarge` time). `useDischargeStore.ts`'s `ClearancePillar` spells the same concept `'doctor' | 'nursing' | 'pharmacy' | 'billing' | 'insurance'` — Task 9 maps `'doctor' <-> 'clinical'` explicitly; every other key spells identically.
- **`discharge` lives as one shared `jsonb` column on `ipd_stays`, not a separate table.** `useInpatientStore.initiateDischarge` already pushes its discharge state directly into `useDischargeStore`'s queue today — the two stores represent one underlying discharge process, not two. Task 9 extends the `IpdDischargeSchema` (a TS/Zod change only, no new migration — the column is already `jsonb`) to also cover `useDischargeStore`'s own gate fields (`orderIssued`/`summaryDrafted`/`summaryApproved`/`exitClearanceIssued`/`blockers`/`dischargeInstructions`), and `useDischargeStore.DischargePatient` gets its own `realId?: string` cross-link, stamped by `useInpatientStore.initiateDischarge`'s existing cross-store push.
- **IPD's own `TestOrder` tracker stays self-contained** — it does NOT wire to the real Lab/Radiology `lab_tests`/`radiology_studies` tables. It is IPD's own simplified in-chart investigation list (`Ordered`/`In progress`/`Ready`/`Acknowledged`), a different concept from a lab/radiology order's full workflow, and no UI evidence links the two. Task 7 persists it as its own jsonb array on `ipd_stays`, matching today's actual behavior.
- **OT/surgery workflow is explicitly OUT OF SCOPE beyond status fields.** `Surgery`/`OtBooking`/`icuTransfer` persist only as `jsonb` status snapshots inline on `ipd_stays` (Task 8) — the full OT module (WHO checklist, ASA anaesthesia, `useOTStore`) is a future phase.
- **Explicitly out of scope, no action needed:** `useOTStore` (full OT/surgery workflow), `useCmoBedsStore`/`secretary/beds/page.tsx` (district/CMO-cockpit bed-network aggregates — architecturally separate from portal-level IPD), the multi-branch bed-network types in `useAdmissionStore.ts` (`WardName`/`BranchWard`/`Branch`/`CURRENT_BRANCH`/`OTHER_BRANCHES` — presentational only, no real data backing), AI features (`admission/forecast`, `discharge/summary/[id]` generation — these read store data but aren't a persistence concern once the underlying data is real).
- Use PowerShell for all commands. `git add` only — do not commit. Credentials in `.env.local`. Confirm the current branch with `git branch --show-current` before starting; continue on whatever branch Phase 6's work landed on.
- **Before writing any task's code, read the actual current file** — prior phases repeatedly found real drift between research snapshots and actual files by execution time.
- **Verification scripts are throwaway.** Every task that needs to prove a real Postgres row was written writes a `src/lib/api/__tests__/_throwaway-taskN-verify.test.ts` or `src/store/__tests__/_throwaway-taskN-verify.test.ts`, runs it, confirms the assertions, then deletes it — confirmed absent from `git status` afterward. Only Task 1's schema tests and Task 2's repository-module tests are committed.

---

### Task 1: Schema + RLS — `ipd_stays`, `ipd_vitals`, `beds`, `nurse_shift_assignments`, `shift_handovers`, `nurse_tasks`, plus `admission_requests`' missing UPDATE policy

**Files:**
- Create: `supabase/migrations/20260706010000_ipd_stays_schema.sql`
- Create: `supabase/migrations/20260706011000_beds_schema.sql`
- Create: `supabase/migrations/20260706012000_nurse_shift_tables.sql`
- Create: `supabase/migrations/20260706013000_admission_requests_transitions.sql`
- Test: `src/lib/supabase/__tests__/ipd-schema.test.ts`

**Before writing the migrations, re-read in full:** `src/store/useInpatientStore.ts`, `src/store/useAdmissionStore.ts`, `src/store/useDischargeStore.ts`, `src/store/useShiftStore.ts`, `src/store/useNursingStore.ts`, and `supabase/migrations/20260704170000_admission_requests.sql` (already read in full for this plan — re-verify against the live file for drift).

**Design decisions (see Global Constraints for the reasoning already established):**
1. `ipd_stays` is a single table, `jsonb` for every nested/compound shape (`rounds`, `meds`, `tests`, `progress_notes`, `discharge`, `events`, `referrals`, `icu_transfer`, `ot_booking`, `surgery`, `iv_lines`, `latest_vitals`, `mar`, `io`) — mirrors Lab/Radiology Task 1's precedent. One inpatient stay = one row for its whole admitted→discharged lifecycle, written by the same doctor/nurse-role actor set under the same RLS policy throughout.
2. `ipd_vitals` gets its own table (unlike the jsonb arrays above): nurses record bedside vitals independently and far more frequently than any other write to the stay, and a real audit trail benefits from one row per recording — the same reasoning Lab applied keeping `lab_specimens` separate from `lab_tests`. `useInpatientStore.ts`'s own `vitals?: VitalsRecord[]` array field is NOT persisted on `ipd_stays` at all; Task 6 reads/writes `ipd_vitals` directly.
3. `gender` on `ipd_stays` is `text`, not an enum — the source data (`AdmissionRequest.patientGender`) is free text, not tightly typed, and a real doctor-entered value could legitimately not match a strict `'Male'|'Female'|'Other'` enum at write time. Likewise `bed`/`ward`/`admitting_doctor` are free-text columns mirroring the store's own un-typed strings exactly (e.g. ward `'Cardiac Care'` vs. `beds.ward`'s tighter `admission_type_t` enum — these two concepts don't line up 1:1 in the client model today, and this table does not force them to).
4. Canonical discharge pillar set and shared `discharge` jsonb column: see Global Constraints.
5. No `realId` indirection on `beds`: see Global Constraints.

- [ ] **Step 1: Write the failing schema test**

`src/lib/supabase/__tests__/ipd-schema.test.ts`:

```ts
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

async function columnsOf(client: Client, table: string): Promise<string[]> {
  const res = await client.query(
    `select column_name from information_schema.columns where table_name = $1`, [table]
  )
  return res.rows.map((r) => r.column_name).sort()
}

describe('IPD schema', () => {
  it('ipd_stays table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'admission_request_id', 'patient_id', 'patient_name', 'age', 'gender',
        'bed', 'ward', 'admitting_doctor', 'diagnosis', 'admitted_at', 'expected_discharge',
        'stage', 'condition', 'rounds', 'meds', 'tests', 'diet', 'surgery', 'progress_notes',
        'discharge', 'events', 'referrals', 'icu_transfer', 'ot_booking', 'code_status',
        'allergies', 'comorbidities', 'latest_hb_a1c', 'latest_bp', 'iv_lines', 'latest_vitals',
        'dismissed_insight', 'mar', 'nurse_ack', 'io', 'updated_at',
      ]
      expect(await columnsOf(client, 'ipd_stays')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('ipd_vitals table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'ipd_stay_id', 'patient_id', 'recorded_at', 'recorded_by', 'recorded_by_name',
        'hr', 'systolic_bp', 'diastolic_bp', 'rr', 'spo2', 'o2_delivery', 'o2_flow', 'temp',
        'pain', 'blood_glucose', 'consciousness', 'gcs', 'weight', 'height', 'capillary_refill',
        'urine_output', 'note',
      ]
      expect(await columnsOf(client, 'ipd_vitals')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('beds table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'bed_number', 'ward', 'floor', 'status', 'occupant_id', 'occupant_name',
        'cleaning_assigned_to', 'last_cleaned', 'gender', 'expected_free_at',
      ]
      expect(await columnsOf(client, 'beds')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('nurse_shift_assignments table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = ['id', 'nurse_id', 'nurse_name', 'ward', 'shift', 'responsibilities']
      expect(await columnsOf(client, 'nurse_shift_assignments')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('shift_handovers table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'ward', 'date', 'from_shift', 'to_shift', 'from_nurse_id', 'from_nurse_name',
        'to_nurse_id', 'to_nurse_name', 'sbar', 'addendum', 'patient_count', 'signed_at',
        'received_at', 'received_by_id', 'received_by_name', 'status',
      ]
      expect(await columnsOf(client, 'shift_handovers')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })

  it('nurse_tasks table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expected = [
        'id', 'key', 'patient_id', 'patient_name', 'title', 'category', 'priority',
        'source', 'done', 'created_at', 'done_at',
      ]
      expect(await columnsOf(client, 'nurse_tasks')).toEqual([...expected].sort())
    } finally {
      await client.end()
    }
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/lib/supabase/__tests__/ipd-schema.test.ts`
Expected: FAIL — every `it` block's `expect([]).toEqual([...])` fails (none of the tables exist yet).

- [ ] **Step 3: Write `supabase/migrations/20260706010000_ipd_stays_schema.sql`**

```sql
-- IPD schema: ipd_stays + ipd_vitals — Phase 7, Task 1.
--
-- Field list verified directly against the live client stores:
-- src/store/useInpatientStore.ts (Inpatient, IpdStage, Condition, Round,
-- MedOrder, TestOrder, ProgressNote, Discharge, IpdEvent, IvLine, WardVitals,
-- IoEntry, VitalsRecord, MarRecord, Referral, IcuTransfer, OtBooking, Surgery)
-- and src/store/useAdmissionStore.ts (AdmissionRequest, for the FK).
--
-- Design decisions are documented in this plan's Task 1 preamble and Global
-- Constraints section: single ipd_stays table with jsonb nested shapes;
-- ipd_vitals as its own independently-written table; free-text gender/bed/
-- ward/admitting_doctor; shared discharge jsonb column (canonical pillar set
-- 'clinical'|'nursing'|'pharmacy'|'billing'|'insurance'); OT/surgery status-
-- only jsonb. `systolic_bp`/`diastolic_bp` (not the store's `systolicBP`/
-- `diastolicBP`) and `latest_bp` (not `latestBP`) — _core.ts's naive
-- camelCase<->snake_case conversion cannot round-trip two adjacent uppercase
-- letters, same reasoning as Lab's expected_tat_min/expectedTatMin.

create type ipd_stage_t as enum (
  'admitted', 'under_treatment', 'pre_op', 'in_surgery', 'post_op',
  'recovering', 'discharge_initiated', 'discharged'
);
create type ipd_condition_t as enum ('Critical', 'Serious', 'Stable', 'Improving', 'Discharge-ready');

create table ipd_stays (
  id                    text primary key,                  -- 'IPD-...'
  admission_request_id  text not null references admission_requests(id),
  patient_id            text not null references patients(id),
  patient_name          text not null,
  age                   integer,
  gender                text,
  bed                   text not null,
  ward                  text not null,
  admitting_doctor      text not null,
  diagnosis             text not null,
  admitted_at           timestamptz not null default now(),
  expected_discharge    text,
  stage                 ipd_stage_t not null default 'admitted',
  condition             ipd_condition_t not null,
  rounds                jsonb not null default '[]',
  meds                  jsonb not null default '[]',
  tests                 jsonb not null default '[]',
  diet                  text,
  surgery               jsonb,
  progress_notes        jsonb not null default '[]',
  discharge             jsonb,
  events                jsonb not null default '[]',
  referrals             jsonb,
  icu_transfer          jsonb,
  ot_booking            jsonb,
  code_status           text,
  allergies             text[],
  comorbidities         text[],
  latest_hb_a1c         numeric,
  latest_bp             text,
  iv_lines              jsonb not null default '[]',
  latest_vitals         jsonb,
  dismissed_insight     boolean not null default false,
  mar                   jsonb not null default '[]',
  nurse_ack             text[] not null default '{}',
  io                    jsonb not null default '[]',
  updated_at            timestamptz not null default now()
);
create index ipd_stays_patient_idx on ipd_stays(patient_id);
create index ipd_stays_admission_request_idx on ipd_stays(admission_request_id);
create index ipd_stays_active_idx on ipd_stays(stage) where stage != 'discharged';

alter table ipd_stays enable row level security;

-- Reception/admin materialize the row at admit time (Task 3's "order
-- rewire") — the bed-manager/admission-desk portal is the actor performing
-- this write, not the requesting doctor. Tightened per Lab/Radiology's
-- lesson: a fresh insert can only represent a just-admitted stay.
create policy ipd_stays_insert_reception on ipd_stays for insert
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin'))
    and stage = 'admitted'
    and rounds = '[]'::jsonb and meds = '[]'::jsonb and tests = '[]'::jsonb
    and progress_notes = '[]'::jsonb and mar = '[]'::jsonb and io = '[]'::jsonb
    and iv_lines = '[]'::jsonb and nurse_ack = '{}'::text[]
    and discharge is null and surgery is null and icu_transfer is null and ot_booking is null
  );
create policy ipd_stays_select_reception on ipd_stays for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')));

-- Doctor + nurse: full read/write at any stage — every subsequent bridge
-- task (rounds, meds, vitals cache, tests, referrals, surgery status,
-- discharge) is a doctor- or nurse-portal action against this same row,
-- mirroring Lab/Radiology's "any staff member may act on any record at any
-- stage" reasoning.
create policy ipd_stays_all_clinical on ipd_stays for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')));

-- Patient: read-only, own stay only (mirrors the patient portal's shared
-- events/patientText view of this exact record).
create policy ipd_stays_select_patient on ipd_stays for select
  using (exists (select 1 from patients p where p.id = ipd_stays.patient_id and p.auth_user_id = auth.uid()));

create type ipd_o2_delivery_t as enum ('Room air', 'Nasal cannula', 'Face mask', 'Non-rebreather', 'Ventilator');
create type ipd_consciousness_t as enum ('A', 'V', 'P', 'U');

create table ipd_vitals (
  id                text primary key,                      -- 'IPV-...'
  ipd_stay_id       text not null references ipd_stays(id),
  patient_id        text not null references patients(id),
  recorded_at       timestamptz not null default now(),
  recorded_by       uuid not null references profiles(id),
  recorded_by_name  text not null,
  hr                integer,
  systolic_bp       integer,
  diastolic_bp      integer,
  rr                integer,
  spo2              integer,
  o2_delivery       ipd_o2_delivery_t,
  o2_flow           numeric,
  temp              numeric,
  pain              smallint,
  blood_glucose     numeric,
  consciousness     ipd_consciousness_t,
  gcs               smallint,
  weight            numeric,
  height            numeric,
  capillary_refill  numeric,
  urine_output      numeric,
  note              text
);
create index ipd_vitals_stay_idx on ipd_vitals(ipd_stay_id);
create index ipd_vitals_patient_idx on ipd_vitals(patient_id);

alter table ipd_vitals enable row level security;

create policy ipd_vitals_all_clinical on ipd_vitals for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('doctor', 'nurse', 'admin')));

create policy ipd_vitals_select_patient on ipd_vitals for select
  using (exists (select 1 from patients p where p.id = ipd_vitals.patient_id and p.auth_user_id = auth.uid()));
```

- [ ] **Step 4: Write `supabase/migrations/20260706011000_beds_schema.sql`**

```sql
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
```

- [ ] **Step 5: Write `supabase/migrations/20260706012000_nurse_shift_tables.sql`**

```sql
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
```

- [ ] **Step 6: Write `supabase/migrations/20260706013000_admission_requests_transitions.sql`**

```sql
-- Admission-request status transitions — Phase 7, Task 1 (RLS only; the
-- application-level transition methods are added to
-- src/lib/api/admission-requests.ts in Task 2, and wired to
-- useAdmissionStore.ts's assignBed/markAdmitted/cancelRequest in Task 3).
--
-- The original admission_requests migration (20260704170000) deliberately
-- shipped with no UPDATE policy for anyone ("Bed assignment/status
-- transitions are reception/admin's job in the future Admin/Admission
-- phase, not this one" — that phase is this one). The bed-manager/
-- admission-desk portal (src/app/admission/dashboard/page.tsx) is the actor
-- performing these transitions, not the requesting doctor — so UPDATE is
-- granted to reception/admin only, mirroring beds_all_reception's role set
-- (the same desk manages both).

create policy admission_requests_update_reception on admission_requests for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')));
```

- [ ] **Step 7: Apply all four migrations**

Run: `npx supabase db push --db-url "$env:DATABASE_URL" --include-all --yes`
Expected: applies cleanly, no errors.

- [ ] **Step 8: Run the schema test again, confirm it passes**

Run: `npx vitest run src/lib/supabase/__tests__/ipd-schema.test.ts`
Expected: `Test Files 1 passed (1)` / `Tests 6 passed (6)`.

- [ ] **Step 9: Run the full suite and `tsc`, stage**

Run: `npm test` — expect all prior tests still passing plus these 6 new ones, zero regressions.
Run: `npx tsc --noEmit` — expect clean, no output.

```bash
git add supabase/migrations/20260706010000_ipd_stays_schema.sql supabase/migrations/20260706011000_beds_schema.sql supabase/migrations/20260706012000_nurse_shift_tables.sql supabase/migrations/20260706013000_admission_requests_transitions.sql src/lib/supabase/__tests__/ipd-schema.test.ts
```

---

### Task 2: Repository modules — `ipd-stays.ts`, `ipd-vitals.ts`, `beds.ts`, `shift-handovers.ts`, `nurse-tasks.ts`, plus `admission-requests.ts`'s transition methods

**Files:**
- Create: `src/lib/api/ipd-stays.ts`
- Create: `src/lib/api/ipd-vitals.ts`
- Create: `src/lib/api/beds.ts`
- Create: `src/lib/api/shift-handovers.ts`
- Create: `src/lib/api/nurse-tasks.ts`
- Modify: `src/lib/api/admission-requests.ts`
- Modify: `src/lib/api/index.ts`
- Test: `src/lib/api/__tests__/ipd-stays.test.ts`
- Test: `src/lib/api/__tests__/ipd-vitals.test.ts`
- Test: `src/lib/api/__tests__/beds.test.ts`
- Test: `src/lib/api/__tests__/shift-handovers.test.ts`
- Test: `src/lib/api/__tests__/nurse-tasks.test.ts`
- Modify: `src/lib/api/__tests__/admission-requests.test.ts`

**Interfaces:**
- Consumes: `table<T>`, `id as newId`, `isoNow`, `audit` from `./_core` (same as every other module).
- Produces: `IpdStays`, `IpdVitals`, `Beds`, `NurseShiftAssignments`, `ShiftHandovers`, `NurseTasks` objects and every Zod schema/type below — consumed by Tasks 3-10's store bridges.

**Design decision — `IpdStays` exposes a single generic `patch()`, no per-action named methods (unlike `LabTests`/`RadiologyStudies`).** Every `useInpatientStore.ts` action already computes its own COMPLETE derived slice locally before this module is ever called (e.g. `recordRound` assembles the full new `rounds` array, `logEvent`'s `append()` assembles the full new `events` array) — there is no server-side read-then-merge this module needs to perform, unlike `LabTests.enterAnalyte`, which merges a single new analyte value into a partially-known array. Every store bridge in Tasks 4-9 calls `IpdStays.patch(realId, { <exactly the fields that changed> })` directly. Where a value must be explicitly CLEARED (e.g. `revertDischarge` removing `discharge`), the bridge passes `null` — never `undefined` (see `LabTests.unclaim`'s comment on why `patch()`'s `JSON.stringify` silently drops undefined-valued keys).

- [ ] **Step 1: Write `src/lib/api/ipd-stays.ts`**

```ts
/* IpdStays — one row per inpatient admission, covering the full
 * admitted -> under_treatment -> ... -> discharged lifecycle. Mirrors
 * `Inpatient` in src/store/useInpatientStore.ts and the `ipd_stays` table in
 * supabase/migrations/20260706010000_ipd_stays_schema.sql.
 *
 * Design decision — a single generic `patch()`, no per-action named methods
 * (unlike LabTests/RadiologyStudies): every useInpatientStore.ts action
 * already computes its own COMPLETE derived slice locally before this module
 * is ever called — there is no server-side read-then-merge this module needs
 * to perform. The store bridge (Phase 7 Tasks 4-9) calls
 * `IpdStays.patch(realId, { <exactly the fields that changed> })` directly.
 * Pass `null` (never `undefined`) to explicitly clear a field — see
 * LabTests.unclaim's comment on why patch()'s JSON.stringify silently drops
 * undefined-valued keys. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const IpdStage = z.enum([
  'admitted', 'under_treatment', 'pre_op', 'in_surgery', 'post_op',
  'recovering', 'discharge_initiated', 'discharged',
])
export const IpdCondition = z.enum(['Critical', 'Serious', 'Stable', 'Improving', 'Discharge-ready'])

export const IpdVitalsSnapshotSchema = z.object({
  bp: z.string(), pulse: z.string(), temp: z.string(), spo2: z.string(),
  rr: z.string().optional(), avpu: z.string().optional(),
})
export const IpdRoundSchema = z.object({
  id: z.string(), scheduledAt: z.string(), doctor: z.string(), done: z.boolean(),
  doneAt: z.string().optional(), note: z.string().optional(), plan: z.string().optional(),
  vitals: IpdVitalsSnapshotSchema.optional(), orders: z.array(z.string()).optional(),
})
export const IpdMedOrderSchema = z.object({
  name: z.string(), dose: z.string(), freq: z.string(), route: z.string(),
  status: z.enum(['active', 'stopped']), startedAt: z.string(),
  stoppedAt: z.string().optional(), stopReason: z.string().optional(),
})
export const IpdTestOrderSchema = z.object({
  id: z.string(), name: z.string(),
  status: z.enum(['Ordered', 'In progress', 'Ready', 'Acknowledged']),
  priority: z.enum(['Routine', 'Urgent']).optional(),
  orderedAt: z.string(), result: z.string().optional(), resultAt: z.string().optional(),
  critical: z.boolean().optional(), acknowledgedAt: z.string().optional(),
})
export const IpdProgressNoteSchema = z.object({
  id: z.string(), at: z.string(), doctor: z.string(), text: z.string(), condition: IpdCondition,
})
export const IpdDischargePillarKey = z.enum(['clinical', 'nursing', 'pharmacy', 'billing', 'insurance'])
export const IpdDischargeBlockerSchema = z.object({
  id: z.string(), type: z.string(), description: z.string(), owner: z.string(), resolvedAt: z.string().optional(),
})
export const IpdDischargeSchema = z.object({
  pillars: z.record(IpdDischargePillarKey, z.boolean()),
  summary: z.string().optional(),
  followUpDate: z.string().optional(),
  meds: z.array(z.object({ name: z.string(), dose: z.string(), freq: z.string(), duration: z.string() })).default([]),
  redFlags: z.array(z.string()).default([]),
  initiatedAt: z.string().optional(),
  doneAt: z.string().optional(),
  // useDischargeStore.ts's own gate fields — folded into this same shared
  // shape (Phase 7 Task 9) since both stores represent one discharge
  // process (see this plan's Global Constraints).
  orderIssued: z.boolean().default(false),
  summaryDrafted: z.boolean().default(false),
  summaryApproved: z.boolean().default(false),
  exitClearanceIssued: z.boolean().default(false),
  blockers: z.array(IpdDischargeBlockerSchema).default([]),
  dischargeInstructions: z.string().optional(),
})
export const IpdEventType = z.enum([
  'admission', 'round', 'condition_change', 'note', 'med_start', 'med_stop', 'med_change',
  'test_order', 'test_result', 'diet_change', 'referral', 'icu_transfer', 'ot_booking',
  'surgery_status', 'discharge_step', 'discharged',
])
export const IpdEventSchema = z.object({
  id: z.string(), at: z.string(), type: IpdEventType, actor: z.string(), title: z.string(),
  detail: z.string().optional(), patientText: z.string().optional(),
  severity: z.enum(['info', 'success', 'warning', 'critical']).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})
export const IpdIvLineSchema = z.object({
  id: z.string(), fluid: z.string(), rate: z.string(), startedAt: z.string(),
  status: z.enum(['Running', 'Completed', 'Paused']), volume: z.number().optional(),
})
export const IpdWardVitalsSchema = z.object({ hr: z.number(), bp: z.string(), temp: z.number(), spo2: z.number(), at: z.string() })
export const IpdMarRecordSchema = z.object({
  id: z.string(), medName: z.string(), slot: z.string(), action: z.enum(['given', 'held']),
  by: z.string(), at: z.string(), note: z.string().optional(),
})
export const IpdIoEntrySchema = z.object({
  id: z.string(), at: z.string(), kind: z.enum(['intake', 'output']), type: z.string(),
  volume: z.number(), by: z.string(),
})
export const IpdReferralSchema = z.object({
  id: z.string(), specialty: z.string(), toDoctor: z.string().optional(), reason: z.string(),
  urgent: z.boolean(), at: z.string(), status: z.enum(['sent', 'accepted']),
})
export const IpdIcuTransferSchema = z.object({
  id: z.string(), reason: z.string(), urgency: z.enum(['Routine', 'Urgent', 'Emergency']),
  at: z.string(), status: z.enum(['requested', 'bed_assigned', 'transferred']),
})
export const IpdOtBookingSchema = z.object({
  id: z.string(), procedure: z.string(), surgeon: z.string(), ot: z.string(),
  scheduledAt: z.string(), status: z.enum(['requested', 'confirmed']),
})
export const IpdSurgerySchema = z.object({
  procedure: z.string(), surgeon: z.string(), ot: z.string().optional(), reason: z.string().optional(),
  scheduledAt: z.string().optional(),
  status: z.enum(['requested', 'consent_pending', 'scheduled', 'in_ot', 'recovery', 'done']),
  consentSigned: z.boolean(), preOpDone: z.boolean(), postOpNote: z.string().optional(),
  consentSignedAt: z.string().optional(), consentSignedBy: z.string().optional(),
  consentRequestSentAt: z.string().optional(),
})

export const IpdStaySchema = z.object({
  id: z.string(),                          // 'IPD-...'
  admissionRequestId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  age: z.number().optional(),
  gender: z.string().optional(),
  bed: z.string(),
  ward: z.string(),
  admittingDoctor: z.string(),
  diagnosis: z.string(),
  admittedAt: z.string(),
  expectedDischarge: z.string().optional(),
  stage: IpdStage.default('admitted'),
  condition: IpdCondition,
  rounds: z.array(IpdRoundSchema).default([]),
  meds: z.array(IpdMedOrderSchema).default([]),
  tests: z.array(IpdTestOrderSchema).default([]),
  diet: z.string().optional(),
  surgery: IpdSurgerySchema.optional(),
  progressNotes: z.array(IpdProgressNoteSchema).default([]),
  discharge: IpdDischargeSchema.optional(),
  events: z.array(IpdEventSchema).default([]),
  referrals: z.array(IpdReferralSchema).optional(),
  icuTransfer: IpdIcuTransferSchema.optional(),
  otBooking: IpdOtBookingSchema.optional(),
  codeStatus: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  comorbidities: z.array(z.string()).optional(),
  latestHbA1c: z.number().optional(),
  latestBp: z.string().optional(),
  ivLines: z.array(IpdIvLineSchema).default([]),
  latestVitals: IpdWardVitalsSchema.optional(),
  dismissedInsight: z.boolean().default(false),
  mar: z.array(IpdMarRecordSchema).default([]),
  nurseAck: z.array(z.string()).default([]),
  io: z.array(IpdIoEntrySchema).default([]),
  updatedAt: z.string(),
})
export type IpdStay = z.infer<typeof IpdStaySchema>

const ipdStays = table<IpdStay>('ipd_stays', IpdStaySchema)

export const IpdStays = {
  list: (filter?: (s: IpdStay) => boolean) => ipdStays.list(filter),
  get: (id: string) => ipdStays.get(id),
  byPatient: (patientId: string) => ipdStays.list((s) => s.patientId === patientId),
  byAdmissionRequest: (admissionRequestId: string) => ipdStays.list((s) => s.admissionRequestId === admissionRequestId),

  async create(input: Omit<IpdStay, 'id' | 'stage' | 'rounds' | 'meds' | 'tests' | 'progressNotes' | 'ivLines' | 'mar' | 'nurseAck' | 'io' | 'dismissedInsight' | 'updatedAt' | 'events'> & {
    id?: string
    stage?: IpdStay['stage']
    events?: IpdStay['events']
  }) {
    const row: IpdStay = {
      ...input,
      id: input.id ?? newId('IPD'),
      stage: input.stage ?? 'admitted',
      rounds: [], meds: [], tests: [], progressNotes: [], ivLines: [], mar: [], nurseAck: [], io: [],
      dismissedInsight: false,
      events: input.events ?? [],
      updatedAt: isoNow(),
    }
    const saved = await ipdStays.insert(row)
    audit.emit({
      action: 'admission_admit',
      resource: 'ipd_stay',
      resourceId: saved.id,
      detail: `${saved.patientName} admitted — ${saved.diagnosis} (${saved.ward} ${saved.bed})`,
    })
    return saved
  },

  async patch(id: string, partial: Partial<IpdStay>) {
    return ipdStays.patch(id, { ...partial, updatedAt: isoNow() })
  },

  _table: ipdStays,
}
```

- [ ] **Step 2: Write `src/lib/api/ipd-vitals.ts`**

```ts
/* IpdVitals — bedside vitals recorded independently by nursing staff, one row
 * per recording. Mirrors `VitalsRecord` in src/store/useInpatientStore.ts and
 * the `ipd_vitals` table in supabase/migrations/20260706010000_ipd_stays_schema.sql.
 *
 * `systolicBp`/`diastolicBp` (not the store's `systolicBP`/`diastolicBP`) —
 * _core.ts's naive camelCase<->snake_case conversion cannot round-trip two
 * adjacent uppercase letters. The store bridge (Task 6) maps between the two
 * spellings explicitly, exactly mirroring Lab's expectedTatMin precedent.
 *
 * `recordedBy`/`recordedByName` are a real `profiles.id` + denormalized
 * display name, not a free-text label — unlike Lab/Radiology's LabTech/
 * RadTech (whose local roster isn't backed by real auth users), IPD nursing
 * staff genuinely sign in as `role = 'nurse'` profiles, so `record()` takes
 * an explicit `actor: { id, name }` the caller MUST source from a live
 * session (see useInpatientStore.ts's `resolveRealIpdActor`, Task 4) — never
 * from the store's free-text `by` field, which stays a local-only display
 * convenience. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const IpdO2Delivery = z.enum(['Room air', 'Nasal cannula', 'Face mask', 'Non-rebreather', 'Ventilator'])
export const IpdConsciousness = z.enum(['A', 'V', 'P', 'U'])

export const IpdVitalActorSchema = z.object({ id: z.string(), name: z.string() })
export type IpdVitalActor = z.infer<typeof IpdVitalActorSchema>

export const IpdVitalSchema = z.object({
  id: z.string(),                          // 'IPV-...'
  ipdStayId: z.string(),
  patientId: z.string(),
  recordedAt: z.string(),
  recordedBy: z.string().uuid(),
  recordedByName: z.string(),
  hr: z.number().optional(),
  systolicBp: z.number().optional(),
  diastolicBp: z.number().optional(),
  rr: z.number().optional(),
  spo2: z.number().optional(),
  o2Delivery: IpdO2Delivery.optional(),
  o2Flow: z.number().optional(),
  temp: z.number().optional(),
  pain: z.number().optional(),
  bloodGlucose: z.number().optional(),
  consciousness: IpdConsciousness.optional(),
  gcs: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  capillaryRefill: z.number().optional(),
  urineOutput: z.number().optional(),
  note: z.string().optional(),
})
export type IpdVital = z.infer<typeof IpdVitalSchema>

const ipdVitals = table<IpdVital>('ipd_vitals', IpdVitalSchema)

export const IpdVitals = {
  byStay: (ipdStayId: string) => ipdVitals.list((v) => v.ipdStayId === ipdStayId),
  byPatient: (patientId: string) => ipdVitals.list((v) => v.patientId === patientId),

  async record(input: Omit<IpdVital, 'id' | 'recordedAt' | 'recordedBy' | 'recordedByName'>, actor: IpdVitalActor) {
    const row: IpdVital = {
      ...input,
      id: newId('IPV'),
      recordedAt: isoNow(),
      recordedBy: actor.id,
      recordedByName: actor.name,
    }
    return ipdVitals.insert(row)
  },

  _table: ipdVitals,
}
```

- [ ] **Step 3: Write `src/lib/api/beds.ts`**

```ts
/* Beds — the hospital's own bed board. Mirrors `Bed` in
 * src/store/useAdmissionStore.ts and the `beds` table in
 * supabase/migrations/20260706011000_beds_schema.sql.
 *
 * No `realId` indirection: a bed's local id (e.g. 'BED-101') IS the real
 * row's primary key directly (see this plan's Global Constraints).
 * `upsert()` uses `put()` (upsert), not `insert()`-only, so repeatedly
 * assigning/cleaning the same bed always updates the one real row. */
import { z } from 'zod'
import { audit, table } from './_core'

export const BedWard = z.enum(['General Ward', 'ICU', 'Private Room', 'Semi-Private', 'Day Care'])
export const BedStatus = z.enum(['Available', 'Occupied', 'Cleaning', 'Reserved', 'Maintenance'])
export const BedGender = z.enum(['Male', 'Female', 'Any'])

export const BedSchema = z.object({
  id: z.string(),                          // 'BED-...'
  bedNumber: z.string(),
  ward: BedWard,
  floor: z.string(),
  status: BedStatus.default('Available'),
  occupantId: z.string().optional(),
  occupantName: z.string().optional(),
  cleaningAssignedTo: z.string().optional(),
  lastCleaned: z.string().optional(),
  gender: BedGender.optional(),
  expectedFreeAt: z.string().optional(),
})
export type Bed = z.infer<typeof BedSchema>

const beds = table<Bed>('beds', BedSchema)

export const Beds = {
  list: (filter?: (b: Bed) => boolean) => beds.list(filter),
  get: (id: string) => beds.get(id),
  byWard: (ward: Bed['ward']) => beds.list((b) => b.ward === ward),

  async upsert(bed: Bed) {
    const saved = await beds.put(bed)
    audit.emit({
      action: bed.status === 'Occupied' ? 'admission_admit' : 'housekeeping_bed_turned',
      resource: 'bed',
      resourceId: saved.id,
      detail: `Bed ${saved.bedNumber} (${saved.ward}) -> ${saved.status}`,
    })
    return saved
  },

  _table: beds,
}
```

- [ ] **Step 4: Write `src/lib/api/shift-handovers.ts`**

```ts
/* NurseShiftAssignments (read-only reference data) + ShiftHandovers (the
 * real read/write workflow) — mirrors Assignment/HandoverRecord in
 * src/store/useShiftStore.ts and nurse_shift_assignments/shift_handovers in
 * supabase/migrations/20260706012000_nurse_shift_tables.sql.
 *
 * `fromNurse`/`toNurse`/`receivedBy` are, in the local store, free-text
 * display names — `sign`/`receive` take an explicit `actor: { id, name }`
 * sourced from a live session, since signing/receiving a shift handover is a
 * real clinical accountability act (mirrors IpdVitals' actor parameter). */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const ShiftType = z.enum(['Morning', 'Evening', 'Night'])
export const HandoverStatus = z.enum(['signed', 'received'])

export const NurseShiftAssignmentSchema = z.object({
  id: z.string(),                          // 'NSA-...'
  nurseId: z.string().uuid(),
  nurseName: z.string(),
  ward: z.string(),
  shift: ShiftType,
  responsibilities: z.array(z.string()).default([]),
})
export type NurseShiftAssignment = z.infer<typeof NurseShiftAssignmentSchema>

const nurseShiftAssignments = table<NurseShiftAssignment>('nurse_shift_assignments', NurseShiftAssignmentSchema)

export const NurseShiftAssignments = {
  list: () => nurseShiftAssignments.list(),
  byNurse: (nurseId: string) => nurseShiftAssignments.list((a) => a.nurseId === nurseId),
  _table: nurseShiftAssignments,
}

export const HandoverActorSchema = z.object({ id: z.string(), name: z.string() })
export type HandoverActor = z.infer<typeof HandoverActorSchema>

export const ShiftHandoverSchema = z.object({
  id: z.string(),                          // 'HO-...'
  ward: z.string(),
  date: z.string(),
  fromShift: ShiftType,
  toShift: ShiftType,
  fromNurseId: z.string().uuid(),
  fromNurseName: z.string(),
  toNurseId: z.string().uuid().optional(),
  toNurseName: z.string().optional(),
  sbar: z.string(),
  addendum: z.string().optional(),
  patientCount: z.number().int(),
  signedAt: z.string(),
  receivedAt: z.string().optional(),
  receivedById: z.string().uuid().optional(),
  receivedByName: z.string().optional(),
  status: HandoverStatus.default('signed'),
})
export type ShiftHandover = z.infer<typeof ShiftHandoverSchema>

const shiftHandovers = table<ShiftHandover>('shift_handovers', ShiftHandoverSchema)

export const ShiftHandovers = {
  list: (filter?: (h: ShiftHandover) => boolean) => shiftHandovers.list(filter),
  pendingFor: (ward: string, toShift: ShiftHandover['toShift']) =>
    shiftHandovers.list((h) => h.ward === ward && h.toShift === toShift && h.status === 'signed'),

  async sign(input: Omit<ShiftHandover, 'id' | 'fromNurseId' | 'fromNurseName' | 'signedAt' | 'status'>, actor: HandoverActor) {
    const row: ShiftHandover = {
      ...input,
      id: newId('HO'),
      fromNurseId: actor.id,
      fromNurseName: actor.name,
      signedAt: isoNow(),
      status: 'signed',
    }
    return shiftHandovers.insert(row)
  },

  async receive(id: string, actor: HandoverActor) {
    return shiftHandovers.patch(id, {
      status: 'received', receivedAt: isoNow(), receivedById: actor.id, receivedByName: actor.name,
    })
  },

  _table: shiftHandovers,
}
```

- [ ] **Step 5: Write `src/lib/api/nurse-tasks.ts`**

```ts
/* NurseTasks — the shift worklist. Mirrors `NurseTask` in
 * src/store/useNursingStore.ts and the `nurse_tasks` table in
 * supabase/migrations/20260706012000_nurse_shift_tables.sql. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const NurseTaskCategory = z.enum(['Vitals', 'Medication', 'Assessment', 'Hygiene', 'Mobility', 'Documentation', 'Procedure'])
export const NurseTaskPriority = z.enum(['High', 'Medium', 'Low'])
export const NurseTaskSource = z.enum(['ai', 'manual'])

export const NurseTaskSchema = z.object({
  id: z.string(),                          // 'TASK-...'
  key: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string(),
  title: z.string(),
  category: NurseTaskCategory,
  priority: NurseTaskPriority,
  source: NurseTaskSource,
  done: z.boolean().default(false),
  createdAt: z.string(),
  doneAt: z.string().optional(),
})
export type NurseTask = z.infer<typeof NurseTaskSchema>

const nurseTasks = table<NurseTask>('nurse_tasks', NurseTaskSchema)

export const NurseTasks = {
  list: (filter?: (t: NurseTask) => boolean) => nurseTasks.list(filter),
  byKeys: (keys: string[]) => nurseTasks.list((t) => !!t.key && keys.includes(t.key)),

  async create(input: Omit<NurseTask, 'id' | 'done' | 'createdAt'> & { id?: string }) {
    const row: NurseTask = { ...input, id: input.id ?? newId('TASK'), done: false, createdAt: isoNow() }
    return nurseTasks.insert(row)
  },

  async toggle(id: string, done: boolean) {
    return nurseTasks.patch(id, { done, doneAt: done ? isoNow() : null as unknown as NurseTask['doneAt'] })
  },

  async remove(id: string) {
    return nurseTasks.remove(id)
  },

  _table: nurseTasks,
}
```

- [ ] **Step 6: Add transition methods to `src/lib/api/admission-requests.ts`**

Read the current file first (already read in full for this plan). Add, after the existing `create` method (before `_table: admissionRequests,`):

```ts
  async assignToBed(id: string) {
    return admissionRequests.patch(id, { status: 'bed_assigned' })
  },
  async markAdmitted(id: string) {
    const patched = await admissionRequests.patch(id, { status: 'admitted' })
    if (patched) {
      audit.emit({
        action: 'admission_admit',
        resource: 'admission_request',
        resourceId: id,
        detail: `${patched.patientId} admitted`,
      })
    }
    return patched
  },
  async cancel(id: string) {
    return admissionRequests.patch(id, { status: 'cancelled' })
  },
```

- [ ] **Step 7: Export everything from `src/lib/api/index.ts`**

Add, alphabetically after the existing `AdmissionRequests`/`AdmissionRequestSchema` export:

```ts
export {
  IpdStays, IpdStaySchema, IpdStage, IpdCondition, IpdDischargePillarKey,
} from './ipd-stays'
export { IpdVitals, IpdVitalSchema, IpdVitalActorSchema } from './ipd-vitals'
export { Beds, BedSchema, BedWard, BedStatus, BedGender } from './beds'
export {
  NurseShiftAssignments, NurseShiftAssignmentSchema,
  ShiftHandovers, ShiftHandoverSchema, HandoverActorSchema,
} from './shift-handovers'
export { NurseTasks, NurseTaskSchema } from './nurse-tasks'
```

- [ ] **Step 8: Write `src/lib/api/__tests__/ipd-stays.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { AdmissionRequests } from '@/lib/api/admission-requests'
import { IpdStays } from '@/lib/api/ipd-stays'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-IPDSTAYTEST-1'
const testVisitId = 'VIS-IPDSTAYTEST-1'
const testAdmissionId = 'ADM-IPDSTAYTEST-1'
const testStayId = 'IPD-IPDSTAYTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'ipd-stays-test-reception@example.com'
const doctorEmail = 'ipd-stays-test-doctor@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Ipd Stays Test Reception' })

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  await admin.from('profiles').insert({ id: doctorUserId, role: 'doctor', full_name: 'Ipd Stays Test Doctor' })

  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
  await Patients.create({ id: testPatientId, hn: 'HN-IPDSTAYTEST-1', fullName: 'Ipd Stays Test', phone: '9555555555', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'IPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
  await AdmissionRequests.create({
    id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
    diagnosis: 'Community-acquired pneumonia', admissionType: 'General Ward', bedTypePreference: 'General Ward',
    reason: 'IV antibiotics', department: 'General Medicine', payerType: 'General',
  } as Parameters<typeof AdmissionRequests.create>[0])

  // ipd_stays_insert_reception requires the reception/admin role — switch back.
  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('ipd_stays').delete().eq('patient_id', testPatientId)
  await admin.from('admission_requests').delete().eq('id', testAdmissionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

afterEach(async () => {
  await admin.from('ipd_stays').delete().eq('id', testStayId)
})

function baseInput(overrides: Partial<Parameters<typeof IpdStays.create>[0]> = {}) {
  return {
    id: testStayId, admissionRequestId: testAdmissionId, patientId: testPatientId,
    patientName: 'Ipd Stays Test', age: 52, gender: 'Male', bed: '102', ward: 'General Ward',
    admittingDoctor: 'Ipd Stays Test Doctor', diagnosis: 'Community-acquired pneumonia',
    admittedAt: new Date().toISOString(), condition: 'Stable' as const,
    ...overrides,
  }
}

describe('IpdStays repository', () => {
  it('creates a stay for an admission request', async () => {
    const saved = await IpdStays.create(baseInput())
    expect(saved.stage).toBe('admitted')
    expect(saved.rounds).toEqual([])
    expect(saved.discharge).toBeUndefined()
  })

  it('byPatient() returns the stay', async () => {
    await IpdStays.create(baseInput())
    const rows = await IpdStays.byPatient(testPatientId)
    expect(rows.some((s) => s.id === testStayId)).toBe(true)
  })

  it('byAdmissionRequest() returns the stay', async () => {
    await IpdStays.create(baseInput())
    const rows = await IpdStays.byAdmissionRequest(testAdmissionId)
    expect(rows.some((s) => s.id === testStayId)).toBe(true)
  })

  it('patch() merges an arbitrary partial and bumps updatedAt', async () => {
    const saved = await IpdStays.create(baseInput())
    const patched = await IpdStays.patch(testStayId, { condition: 'Improving', diet: 'Normal diet' })
    expect(patched?.condition).toBe('Improving')
    expect(patched?.diet).toBe('Normal diet')
    expect(patched?.updatedAt).not.toBe(saved.updatedAt)
  })

  it('patch() clears a jsonb field with explicit null', async () => {
    await IpdStays.create(baseInput({
      discharge: {
        pillars: { clinical: true, nursing: false, pharmacy: false, billing: false, insurance: false },
        meds: [], redFlags: [], orderIssued: true, summaryDrafted: false, summaryApproved: false,
        exitClearanceIssued: false, blockers: [],
      },
    }))
    const cleared = await IpdStays.patch(testStayId, { discharge: null as unknown as Parameters<typeof IpdStays.create>[0]['discharge'] })
    expect(cleared?.discharge).toBeUndefined()
  })
})
```

- [ ] **Step 9: Write `src/lib/api/__tests__/ipd-vitals.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { IpdVitals } from '@/lib/api/ipd-vitals'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-IPDVITALTEST-1'
const testStayId = 'IPD-IPDVITALTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const nurseEmail = 'ipd-vitals-test-nurse@example.com'
const testPassword = 'Test-Pass-123!'
let nurseUserId: string

beforeAll(async () => {
  const { data: nurseData, error } = await admin.auth.admin.createUser({
    email: nurseEmail, password: testPassword, email_confirm: true,
  })
  if (error || !nurseData.user) throw new Error(`createUser failed: ${error?.message}`)
  nurseUserId = nurseData.user.id
  await admin.from('profiles').insert({ id: nurseUserId, role: 'nurse', full_name: 'Ipd Vitals Test Nurse' })
  await admin.from('patients').insert({ id: testPatientId, hn: 'HN-IPDVITALTEST-1', full_name: 'Ipd Vitals Test', phone: '9666666666', sex: 'Male' })

  await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('ipd_vitals').delete().eq('patient_id', testPatientId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

afterEach(async () => {
  await admin.from('ipd_vitals').delete().eq('ipd_stay_id', testStayId)
})

describe('IpdVitals repository', () => {
  it('record() stamps the real actor, not a caller-supplied name', async () => {
    const saved = await IpdVitals.record(
      { ipdStayId: testStayId, patientId: testPatientId, hr: 88, systolicBp: 128, diastolicBp: 82, spo2: 97 },
      { id: nurseUserId, name: 'Ipd Vitals Test Nurse' },
    )
    expect(saved.recordedBy).toBe(nurseUserId)
    expect(saved.recordedByName).toBe('Ipd Vitals Test Nurse')
    expect(saved.systolicBp).toBe(128)
  })

  it('byStay() returns the recording', async () => {
    await IpdVitals.record(
      { ipdStayId: testStayId, patientId: testPatientId, hr: 88 },
      { id: nurseUserId, name: 'Ipd Vitals Test Nurse' },
    )
    const rows = await IpdVitals.byStay(testStayId)
    expect(rows).toHaveLength(1)
  })

  it('byPatient() returns the recording', async () => {
    await IpdVitals.record(
      { ipdStayId: testStayId, patientId: testPatientId, hr: 88 },
      { id: nurseUserId, name: 'Ipd Vitals Test Nurse' },
    )
    const rows = await IpdVitals.byPatient(testPatientId)
    expect(rows.some((v) => v.ipdStayId === testStayId)).toBe(true)
  })
})
```

- [ ] **Step 10: Write `src/lib/api/__tests__/beds.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Beds } from '@/lib/api/beds'
import { getSupabaseClient } from '@/lib/supabase/client'

const testBedId = 'BED-BEDSTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'beds-test-reception@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: receptionEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  receptionUserId = data.user.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Beds Test Reception' })
  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('beds').delete().eq('id', testBedId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

afterEach(async () => {
  await admin.from('beds').delete().eq('id', testBedId)
})

describe('Beds repository', () => {
  it('upsert() materializes a bed on first write', async () => {
    const saved = await Beds.upsert({ id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available' })
    expect(saved.status).toBe('Available')
  })

  it('upsert() updates the same row on a second write (no realId indirection)', async () => {
    await Beds.upsert({ id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available' })
    const occupied = await Beds.upsert({
      id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground',
      status: 'Occupied', occupantId: 'PT-X', occupantName: 'Test Patient',
    })
    expect(occupied.status).toBe('Occupied')
    const rows = await Beds.list((b) => b.id === testBedId)
    expect(rows).toHaveLength(1)
  })

  it('byWard() filters by ward', async () => {
    await Beds.upsert({ id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available' })
    const rows = await Beds.byWard('General Ward')
    expect(rows.some((b) => b.id === testBedId)).toBe(true)
  })
})
```

- [ ] **Step 11: Write `src/lib/api/__tests__/shift-handovers.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ShiftHandovers } from '@/lib/api/shift-handovers'
import { getSupabaseClient } from '@/lib/supabase/client'

const testHandoverId = 'HO-HOTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const nurseEmail = 'shift-handovers-test-nurse@example.com'
const testPassword = 'Test-Pass-123!'
let nurseUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: nurseEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  nurseUserId = data.user.id
  await admin.from('profiles').insert({ id: nurseUserId, role: 'nurse', full_name: 'Handover Test Nurse' })
  await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('shift_handovers').delete().eq('ward', 'Cardiac Care')
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

afterEach(async () => {
  await admin.from('shift_handovers').delete().neq('id', '')
})

describe('ShiftHandovers repository', () => {
  it('sign() stamps the real signing nurse', async () => {
    const saved = await ShiftHandovers.sign(
      { ward: 'Cardiac Care', date: '2026-07-06', fromShift: 'Night', toShift: 'Morning', sbar: 'Handover text', patientCount: 1 },
      { id: nurseUserId, name: 'Handover Test Nurse' },
    )
    expect(saved.fromNurseId).toBe(nurseUserId)
    expect(saved.status).toBe('signed')
  })

  it('receive() stamps the real receiving nurse', async () => {
    const saved = await ShiftHandovers.sign(
      { ward: 'Cardiac Care', date: '2026-07-06', fromShift: 'Night', toShift: 'Morning', sbar: 'Handover text', patientCount: 1 },
      { id: nurseUserId, name: 'Handover Test Nurse' },
    )
    const received = await ShiftHandovers.receive(saved.id, { id: nurseUserId, name: 'Handover Test Nurse' })
    expect(received?.status).toBe('received')
    expect(received?.receivedById).toBe(nurseUserId)
  })

  it('pendingFor() filters by ward/shift/status', async () => {
    await ShiftHandovers.sign(
      { ward: 'Cardiac Care', date: '2026-07-06', fromShift: 'Night', toShift: 'Morning', sbar: 'Handover text', patientCount: 1 },
      { id: nurseUserId, name: 'Handover Test Nurse' },
    )
    const rows = await ShiftHandovers.pendingFor('Cardiac Care', 'Morning')
    expect(rows.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 12: Write `src/lib/api/__tests__/nurse-tasks.test.ts`**

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NurseTasks } from '@/lib/api/nurse-tasks'
import { getSupabaseClient } from '@/lib/supabase/client'

const testTaskId = 'TASK-NTTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const nurseEmail = 'nurse-tasks-test-nurse@example.com'
const testPassword = 'Test-Pass-123!'
let nurseUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: nurseEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  nurseUserId = data.user.id
  await admin.from('profiles').insert({ id: nurseUserId, role: 'nurse', full_name: 'Nurse Tasks Test Nurse' })
  await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

afterEach(async () => {
  await admin.from('nurse_tasks').delete().eq('id', testTaskId)
})

describe('NurseTasks repository', () => {
  it('create() inserts a manual task', async () => {
    const saved = await NurseTasks.create({
      id: testTaskId, patientName: 'Test Patient', title: 'Assist with hygiene',
      category: 'Hygiene', priority: 'Low', source: 'manual',
    })
    expect(saved.done).toBe(false)
  })

  it('toggle() marks a task done', async () => {
    await NurseTasks.create({
      id: testTaskId, patientName: 'Test Patient', title: 'Assist with hygiene',
      category: 'Hygiene', priority: 'Low', source: 'manual',
    })
    const done = await NurseTasks.toggle(testTaskId, true)
    expect(done?.done).toBe(true)
    expect(done?.doneAt).toBeTruthy()
  })

  it('byKeys() dedupes AI-generated tasks by key', async () => {
    await NurseTasks.create({
      id: testTaskId, key: 'ai-vitals-overdue-PT-1', patientName: 'Test Patient',
      title: 'Overdue vitals check', category: 'Vitals', priority: 'High', source: 'ai',
    })
    const rows = await NurseTasks.byKeys(['ai-vitals-overdue-PT-1'])
    expect(rows).toHaveLength(1)
  })
})
```

- [ ] **Step 13: Add the assignToBed/markAdmitted/cancel tests to `src/lib/api/__tests__/admission-requests.test.ts`**

Add these three `it` blocks inside the existing `describe('AdmissionRequests repository', ...)` block (the file's existing fixtures — `testPatientId`, `testVisitId`, `doctorUserId`, `receptionUserId` — are reused as-is; these new tests additionally sign in as reception to exercise the new UPDATE policy from Task 1):

```ts
  it('assignToBed() transitions requested -> bed_assigned (reception)', async () => {
    await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])

    await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
    const patched = await AdmissionRequests.assignToBed(testAdmissionId)
    expect(patched?.status).toBe('bed_assigned')
  })

  it('markAdmitted() transitions bed_assigned -> admitted (reception)', async () => {
    await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])

    await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
    await AdmissionRequests.assignToBed(testAdmissionId)
    const patched = await AdmissionRequests.markAdmitted(testAdmissionId)
    expect(patched?.status).toBe('admitted')
  })

  it('cancel() transitions requested -> cancelled (reception)', async () => {
    await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])

    await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
    const patched = await AdmissionRequests.cancel(testAdmissionId)
    expect(patched?.status).toBe('cancelled')
  })
```

- [ ] **Step 14: Run every new test file, confirm all pass**

Run: `npx vitest run src/lib/api/__tests__/ipd-stays.test.ts src/lib/api/__tests__/ipd-vitals.test.ts src/lib/api/__tests__/beds.test.ts src/lib/api/__tests__/shift-handovers.test.ts src/lib/api/__tests__/nurse-tasks.test.ts src/lib/api/__tests__/admission-requests.test.ts`
Expected: all test files pass, 0 failures.

- [ ] **Step 15: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/lib/api/ipd-stays.ts src/lib/api/ipd-vitals.ts src/lib/api/beds.ts src/lib/api/shift-handovers.ts src/lib/api/nurse-tasks.ts src/lib/api/admission-requests.ts src/lib/api/index.ts src/lib/api/__tests__/ipd-stays.test.ts src/lib/api/__tests__/ipd-vitals.test.ts src/lib/api/__tests__/beds.test.ts src/lib/api/__tests__/shift-handovers.test.ts src/lib/api/__tests__/nurse-tasks.test.ts src/lib/api/__tests__/admission-requests.test.ts
```

---

### Task 3: Admission-request transition bridge + order rewire — materialize the real `ipd_stays` row on `markAdmitted`

**Files:**
- Modify: `src/store/useAdmissionStore.ts` — add `realId?: string` to `AdmissionRequest`, add `setRealId`/`hydrateReal` actions, bridge `assignBed`/`markAdmitted`/`cancelRequest`.
- Modify: `src/store/useInpatientStore.ts` — add `realId?: string` to `Inpatient`, add `admitFromRequest` action.
- Modify: `src/app/admission/dashboard/page.tsx` — call `hydrateReal()` once on mount.

**Interfaces:**
- Consumes: `AdmissionRequests.assignToBed/markAdmitted/cancel` (Task 2), `IpdStays.create` (Task 2), `Beds.upsert` (Task 2), `Patients.get` (existing).
- Produces: `AdmissionRequest.realId?: string`, `useAdmissionStore.getState().setRealId`/`hydrateReal()`, `Inpatient.realId?: string`, `useInpatientStore.getState().admitFromRequest(stay)` — consumed by every bridge in Tasks 4-9.

**Read before implementing:** `src/store/useAdmissionStore.ts` and `src/store/useInpatientStore.ts` in full (already read in full for this plan — re-verify against the live files for drift), `src/app/admission/dashboard/page.tsx` (already read — `assignBed`/`markAdmitted`/`cancelRequest` call sites at lines ~143, ~295, ~335).

**A discovery made while planning this task: `useAdmissionStore.ts`'s local `admissionRequests` queue and the real `admission_requests` table are two independent representations today.** The doctor dashboard's existing Phase 3 bridge (`AdmissionRequests.create()`, called from `handleSendAdmission`/`completeConsult`) writes directly to the real table and never touches `useAdmissionStore`'s local queue at all — that queue is a separate, hardcoded-seed array read by the admission-desk portal. For `assignBed`/`markAdmitted`/`cancelRequest` to have any real row to transition, this task adds a `hydrateReal()` action that fetches every real `admission_requests` row not already represented locally and appends it to the local queue, using the REAL row's id as both the local `id` and `realId` (no fuzzy matching needed). The local `Pending`/`Assigned`/`Admitted`/`Cancelled` status strings map onto the real `requested`/`bed_assigned`/`admitted`/`cancelled` enum exactly as documented in this plan's spec.

- [ ] **Step 1: Write a failing test proving `hydrateReal()` pulls in a real request**

`src/store/__tests__/_throwaway-task3-hydrate-verify.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { AdmissionRequests } from '@/lib/api/admission-requests'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAdmissionStore } from '@/store/useAdmissionStore'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = `task3-hydrate-reception-${Date.now()}@example.com`
const doctorEmail = `task3-hydrate-doctor-${Date.now()}@example.com`
const testPassword = 'Test-Pass-123!'
const testPatientId = `PT-TASK3HYDRATE-${Date.now()}`
const testVisitId = `VIS-TASK3HYDRATE-${Date.now()}`
let receptionUserId: string
let doctorUserId: string
let testAdmissionId: string

beforeAll(async () => {
  const { data: receptionData } = await admin.auth.admin.createUser({ email: receptionEmail, password: testPassword, email_confirm: true })
  receptionUserId = receptionData!.user!.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Task3 Hydrate Reception' })

  const { data: doctorData } = await admin.auth.admin.createUser({ email: doctorEmail, password: testPassword, email_confirm: true })
  doctorUserId = doctorData!.user!.id
  await admin.from('profiles').insert({ id: doctorUserId, role: 'doctor', full_name: 'Task3 Hydrate Doctor' })

  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
  await Patients.create({ id: testPatientId, hn: `HN-${testPatientId}`, fullName: 'Task3 Hydrate Patient', phone: '9777777777', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
  const req = await AdmissionRequests.create({
    patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
    diagnosis: 'Test diagnosis', admissionType: 'General Ward', bedTypePreference: 'General Ward',
    reason: 'Test reason', department: 'General Medicine', payerType: 'General',
  } as Parameters<typeof AdmissionRequests.create>[0])
  testAdmissionId = req.id
})

afterAll(async () => {
  await admin.from('admission_requests').delete().eq('id', testAdmissionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

describe('Task 3 — hydrateReal pulls real admission_requests into the local queue', () => {
  it('appends the real request with realId set and status mapped to Pending', async () => {
    await useAdmissionStore.getState().hydrateReal()
    const hydrated = useAdmissionStore.getState().admissionRequests.find(r => r.realId === testAdmissionId)
    expect(hydrated).toBeTruthy()
    expect(hydrated?.status).toBe('Pending')
    expect(hydrated?.patientName).toBe('Task3 Hydrate Patient')
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/store/__tests__/_throwaway-task3-hydrate-verify.test.ts`
Expected: FAIL — `useAdmissionStore.getState().hydrateReal` is not a function.

- [ ] **Step 3: Add `realId`, `setRealId`, `hydrateReal` and bridge the three transition actions in `src/store/useAdmissionStore.ts`**

Add to the `Bed` type import list — no change needed (Bed stays unchanged, no `realId`, per this plan's Global Constraints). Add to the `AdmissionRequest` type (after `bundle?: AdmissionBundle`):

```ts
  realId?: string                          // the real admission_requests.id, once hydrated/created (Phase 7 Task 3)
```

Add imports at the top of the file:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
import { useInpatientStore } from './useInpatientStore'
```

Change the `AdmissionState` interface — add after `cancelRequest`:

```ts
  setRealId: (id: string, realId: string) => void
  hydrateReal: () => Promise<void>
```

Change the store creator's signature from `(set) =>` to `(set, get) =>` (the `get` parameter is needed by the new bridges below).

Add, after `cancelRequest`'s implementation (before the closing `}),` of the creator object):

```ts
  setRealId: (id, realId) => set(s => ({
    admissionRequests: s.admissionRequests.map(r => r.id === id ? { ...r, realId } : r),
  })),

  // Phase 7 Task 3 — pulls in every real admission_requests row not already
  // represented locally (the doctor dashboard's existing Phase 3 bridge
  // writes directly to the real table and never touches this local queue).
  // The real row's id is used as BOTH the local id and realId — no fuzzy
  // matching needed, since a freshly-hydrated entry has no other local
  // representation to reconcile against.
  hydrateReal: async () => {
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    const { AdmissionRequests, Patients } = await import('@/lib/api')
    const supabase = getSupabaseClient()
    const rows = await AdmissionRequests.list()
    const statusMap: Record<string, AdmissionRequest['status']> = {
      requested: 'Pending', bed_assigned: 'Assigned', admitted: 'Admitted', cancelled: 'Cancelled',
    }
    const existingRealIds = new Set(get().admissionRequests.map(r => r.realId).filter(Boolean))
    const toHydrate = rows.filter(r => !existingRealIds.has(r.id))
    const fresh: AdmissionRequest[] = []
    for (const r of toHydrate) {
      const patient = await Patients.get(r.patientId)
      const { data: doctorProfile } = await supabase.from('profiles').select('full_name').eq('id', r.doctorId).maybeSingle()
      fresh.push({
        id: r.id, realId: r.id,
        patientId: r.patientId,
        patientName: patient?.fullName ?? r.patientId,
        patientAge: patient?.age ?? 0,
        patientGender: patient?.sex ?? '',
        diagnosis: r.diagnosis ?? '',
        admissionType: r.admissionType,
        bedTypePreference: r.bedTypePreference ?? r.admissionType,
        reason: r.reason ?? '',
        requestedBy: doctorProfile?.full_name ?? 'Doctor',
        department: r.department ?? '',
        triageLevel: r.triageLevel,
        payerType: r.payerType ?? '',
        requestedAt: r.requestedAt,
        status: statusMap[r.status] ?? 'Pending',
      })
    }
    if (fresh.length) set(s => ({ admissionRequests: [...s.admissionRequests, ...fresh] }))
  },
```

- [ ] **Step 4: Run the hydrate test again, confirm it passes, then delete it**

Run: `npx vitest run src/store/__tests__/_throwaway-task3-hydrate-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task3-hydrate-verify.test.ts
```

- [ ] **Step 5: Add `realId` and `admitFromRequest` to `src/store/useInpatientStore.ts`**

Add to the `Inpatient` type (after `io?: IoEntry[]`):

```ts
  realId?: string                          // the real ipd_stays.id, once materialized (Phase 7 Task 3)
```

Add to the `InpatientState` interface (after `inpatients: Inpatient[]`):

```ts
  admitFromRequest: (stay: {
    id: string; patientId: string; patientName: string; age?: number; gender?: string
    bed: string; ward: string; admittingDoctor: string; diagnosis: string; admittedAt: string
    condition: Condition
  }) => void
```

Add to the store implementation (after `inpatients: seed(),`):

```ts
  // Phase 7 Task 3 — the "order rewire" moment: called from
  // useAdmissionStore.ts's markAdmitted bridge once the real ipd_stays row
  // exists, so the admitted patient immediately shows up in the doctor/nurse
  // IPD chart with realId already stamped — no separate hydrate step needed
  // for this store (contrast with useAdmissionStore's own hydrateReal).
  admitFromRequest: (stay) => set(s => {
    if (s.inpatients.some(ip => ip.patientId === stay.patientId && ip.stage !== 'discharged')) return s
    const ip: Inpatient = {
      patientId: stay.patientId, name: stay.patientName, age: stay.age ?? 0,
      gender: stay.gender === 'Female' ? 'Female' : stay.gender === 'Other' ? 'Other' : 'Male',
      bed: stay.bed, ward: stay.ward, admittingDoctor: stay.admittingDoctor, diagnosis: stay.diagnosis,
      admittedAt: stay.admittedAt, stage: 'admitted', condition: stay.condition,
      rounds: [], meds: [], tests: [], progressNotes: [],
      events: [ev('admission', stay.admittedAt, 'Reception', `Admitted — ${stay.diagnosis}`, {
        severity: 'info', patientText: 'You were admitted to the ward.',
      })],
      realId: stay.id,
    }
    return { inpatients: [...s.inpatients, ip] }
  }),
```

- [ ] **Step 6: Bridge `assignBed` in `src/store/useAdmissionStore.ts`**

Replace the existing `assignBed` implementation with:

```ts
  assignBed: (requestId, bedId) => {
    let assigned: { req?: AdmissionRequest; bed?: Bed } = {}
    set((s) => {
      const req = s.admissionRequests.find(r => r.id === requestId)
      if (!req) return s
      const bed = s.beds.find(b => b.id === bedId)
      assigned = { req, bed }
      return {
        admissionRequests: s.admissionRequests.map(r =>
          r.id === requestId ? { ...r, status: 'Assigned', assignedBedId: bedId } : r
        ),
        beds: s.beds.map(b =>
          b.id === bedId
            ? { ...b, status: 'Occupied', occupantId: req.patientId, occupantName: req.patientName }
            : b
        ),
      }
    })
    if (assigned.req && assigned.bed) {
      useAuditStore.getState().log({
        userId: 'ADM-1801', userName: 'Bed Manager',
        action: 'admission_admit',
        resource: 'admission_request', resourceId: requestId,
        detail: `${assigned.req.patientName} (${assigned.req.patientId}) → ${assigned.bed.ward} bed ${assigned.bed.bedNumber}`,
      })
    }
    void (async () => {
      if (!assigned.req?.realId) return
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      const updatedBed = get().beds.find(b => b.id === bedId)
      if (!updatedBed) return
      try {
        const { AdmissionRequests, Beds } = await import('@/lib/api')
        await AdmissionRequests.assignToBed(assigned.req!.realId!)
        await Beds.upsert(updatedBed)
      } catch (err) {
        console.error('[useAdmissionStore] real backend assignBed failed (local state still updated):', err)
      }
    })()
  },
```

- [ ] **Step 7: Bridge `markAdmitted` in `src/store/useAdmissionStore.ts`** — this is the order-rewire moment

Replace the existing `markAdmitted` implementation with:

```ts
  markAdmitted: (requestId) => {
    let snap: AdmissionRequest | undefined
    set((s) => {
      snap = s.admissionRequests.find(r => r.id === requestId)
      return {
        admissionRequests: s.admissionRequests.map(r =>
          r.id === requestId ? { ...r, status: 'Admitted' } : r
        ),
      }
    })
    if (snap) {
      useAuditStore.getState().log({
        userId: 'ADM-1801', userName: 'Bed Manager',
        action: 'admission_admit',
        resource: 'admission_request', resourceId: requestId,
        detail: `Admitted ${snap.patientName} (${snap.patientId}) · ${snap.diagnosis}`,
      })
    }
    void (async () => {
      if (!snap?.realId) return
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      const bed = snap.assignedBedId ? get().beds.find(b => b.id === snap!.assignedBedId) : undefined
      try {
        const { AdmissionRequests, IpdStays } = await import('@/lib/api')
        await AdmissionRequests.markAdmitted(snap.realId)
        const stay = await IpdStays.create({
          admissionRequestId: snap.realId,
          patientId: snap.patientId,
          patientName: snap.patientName,
          age: snap.patientAge,
          gender: snap.patientGender,
          bed: bed?.bedNumber ?? snap.bedTypePreference,
          ward: bed?.ward ?? snap.admissionType,
          admittingDoctor: snap.requestedBy,
          diagnosis: snap.diagnosis,
          admittedAt: new Date().toISOString(),
          condition: snap.triageLevel === 'Critical' ? 'Critical' : 'Stable',
          events: [{
            id: `e-admit-${Date.now()}`, at: new Date().toISOString(), type: 'admission',
            actor: 'Reception', title: `Admitted — ${snap.diagnosis}`, severity: 'info',
            patientText: 'You were admitted to the ward.',
          }],
        })
        useInpatientStore.getState().admitFromRequest(stay)
      } catch (err) {
        console.error('[useAdmissionStore] real backend markAdmitted failed (local state still updated):', err)
      }
    })()
  },
```

- [ ] **Step 8: Bridge `cancelRequest` in `src/store/useAdmissionStore.ts`**

Replace the existing `cancelRequest` implementation with:

```ts
  cancelRequest: (requestId) => {
    let snap: AdmissionRequest | undefined
    set((s) => {
      snap = s.admissionRequests.find(r => r.id === requestId)
      return {
        admissionRequests: s.admissionRequests.map(r =>
          r.id === requestId ? { ...r, status: 'Cancelled' } : r
        ),
      }
    })
    void (async () => {
      if (!snap?.realId) return
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        const { AdmissionRequests } = await import('@/lib/api')
        await AdmissionRequests.cancel(snap.realId)
      } catch (err) {
        console.error('[useAdmissionStore] real backend cancelRequest failed (local state still updated):', err)
      }
    })()
  },
```

- [ ] **Step 9: Call `hydrateReal()` once on mount in `src/app/admission/dashboard/page.tsx`**

Read the file's existing top-level hooks first. Add, near the top of the page component body (after the existing `useAdmissionStore()` destructure):

```ts
  useEffect(() => {
    void useAdmissionStore.getState().hydrateReal()
  }, [])
```

(Add `useEffect` to the existing `"react"` import if not already imported.)

- [ ] **Step 10: Write and run a throwaway verification script proving the full assign→admit flow materializes a real `ipd_stays` row**

`src/store/__tests__/_throwaway-task3-verify.test.ts` — creates real reception/doctor auth users, a real patient/visit/admission request (as Task 2's fixture does), signs in as reception, calls `useAdmissionStore.getState().hydrateReal()`, then `assignBed(hydratedId, someBedId)` and `markAdmitted(hydratedId)` against the LOCAL store, then re-queries `admission_requests`/`beds`/`ipd_stays` via the service-role admin client to assert: (a) `admission_requests.status === 'admitted'`, (b) the `beds` row exists with `status = 'Occupied'`, (c) an `ipd_stays` row exists with `stage = 'admitted'` and `admission_request_id` matching, and (d) `useInpatientStore.getState().inpatients` now contains an entry for that patient with `realId` equal to the new `ipd_stays.id`.

Run: `npx vitest run src/store/__tests__/_throwaway-task3-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task3-verify.test.ts
```

- [ ] **Step 11: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useAdmissionStore.ts src/store/useInpatientStore.ts src/app/admission/dashboard/page.tsx
```

---

### Task 4: Bridge rounds/progress-notes/condition — `recordRound`, `addProgressNote`, `setCondition`, `logEvent`, plus the `resolveRealIpdActor` helper

**Files:**
- Modify: `src/store/useInpatientStore.ts`

**Interfaces:**
- Consumes: `IpdStays.patch` (Task 2), `Inpatient.realId` (Task 3).
- Produces: `resolveRealIpdActor(): Promise<{ id: string; name: string } | undefined>` — consumed by every actor-bearing bridge in Tasks 5-6 and 10.

Add near the top of the file (after the existing imports):

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
```

- [ ] **Step 1: Add the `resolveRealIpdActor` helper**

Add after the `append` helper (before `export const useInpatientStore`):

```ts
// Phase 7 Task 4 — resolves the REAL signed-in actor for an action whose
// signature takes an explicit, caller-suppliable "who did this" parameter
// (administerMed's `by`, addNursingNote's `by`, recordVitals'/addIo's `by`),
// from a *live* Supabase session + a `profiles.full_name` lookup — never
// from that caller-supplied string. Mirrors useLabOrdersStore.ts's
// resolveRealActor / useRadiologyStudiesStore.ts's resolveRealRadActor.
// Actions whose actor is an already-fixed record field (ip.admittingDoctor)
// rather than a caller-suppliable parameter do NOT use this — see this
// plan's Global Constraints for the full reasoning. Returns undefined (skip
// the write) if there's no live session or no matching profile row.
async function resolveRealIpdActor(): Promise<{ id: string; name: string } | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}
```

- [ ] **Step 2: Bridge `recordRound`**

Replace the existing `recordRound` implementation with:

```ts
      recordRound: (id, data) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const iv = ROUND_HRS[ip.condition]
            const now = new Date().toISOString()
            const pending = ip.rounds.filter(r => !r.done).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
            const completed: Round = pending
              ? { ...pending, done: true, doneAt: now, note: data.note, plan: data.plan, vitals: data.vitals, orders: data.orders }
              : { id: uid('r'), scheduledAt: now, doctor: ip.admittingDoctor, done: true, doneAt: now, note: data.note, plan: data.plan, vitals: data.vitals, orders: data.orders }
            const rounds = ip.rounds.map(r => r.id === completed.id ? completed : r)
            if (!pending) rounds.push(completed)
            rounds.push({ id: uid('r'), scheduledAt: new Date(Date.now() + iv * 3600000).toISOString(), doctor: ip.admittingDoctor, done: false })
            return { ...ip, rounds, events: append(ip, { type: 'round', actor: ip.admittingDoctor, title: 'Doctor round completed', detail: data.note, severity: 'info', patientText: 'Your doctor completed a round — you are being monitored closely.' }) }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { rounds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { rounds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend recordRound failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 3: Bridge `addProgressNote`**

Replace the existing `addProgressNote` implementation with:

```ts
      addProgressNote: (id, text, condition) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, condition,
            progressNotes: [{ id: uid('p'), at: new Date().toISOString(), doctor: ip.admittingDoctor, text, condition }, ...ip.progressNotes],
            events: append(ip, { type: 'note', actor: ip.admittingDoctor, title: 'Progress note', detail: text }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { progressNotes, condition: cond, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { progressNotes, condition: cond, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addProgressNote failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 4: Bridge `setCondition`**

Replace the existing `setCondition` implementation with:

```ts
      setCondition: (id, condition) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, condition,
            events: append(ip, { type: 'condition_change', actor: ip.admittingDoctor, title: `Condition set to ${condition}`, severity: condition === 'Critical' ? 'critical' : condition === 'Serious' ? 'warning' : 'info' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { condition: cond, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { condition: cond, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setCondition failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 5: Bridge `logEvent`**

Replace the existing `logEvent` implementation with:

```ts
      logEvent: (id, e) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({ ...ip, events: append(ip, e) }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { events })
          } catch (err) {
            console.error('[useInpatientStore] real backend logEvent failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 6: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task4-verify.test.ts` — materialize a real `ipd_stays` row exactly as Task 3's bridge does it (real reception/doctor users, real admission request, `assignBed`+`markAdmitted` via `useAdmissionStore`), then call `useInpatientStore.getState().recordRound(patientId, {...})`, `addProgressNote(...)`, `setCondition(...)` against the resulting local `Inpatient`, and independently re-query the real `ipd_stays` row via the service-role admin client after each call to assert `rounds`/`progress_notes`/`condition`/`events` match. Also exercise a demo-seeded patient (`PT-20394`, no `realId`) through the same three actions and confirm no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task4-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task4-verify.test.ts
```

- [ ] **Step 7: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useInpatientStore.ts
```

---

### Task 5: Bridge meds/MAR — `addMed`, `discontinueMed`, `changeMed`, `administerMed`

**Files:**
- Modify: `src/store/useInpatientStore.ts`

**Interfaces:**
- Consumes: `IpdStays.patch` (Task 2), `resolveRealIpdActor` (Task 4).

- [ ] **Step 1: Bridge `addMed`**

Replace the existing `addMed` implementation with:

```ts
      addMed: (id, med) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            meds: [...ip.meds, { ...med, status: 'active', startedAt: new Date().toISOString() }],
            events: append(ip, { type: 'med_start', actor: ip.admittingDoctor, title: `Started ${med.name} ${med.dose}`, detail: `${med.freq} · ${med.route}`, patientText: `A new medicine (${med.name}) was started.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { meds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { meds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addMed failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 2: Bridge `discontinueMed`**

Replace the existing `discontinueMed` implementation with:

```ts
      discontinueMed: (id, name, reason) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            meds: ip.meds.map(m => m.name === name && m.status === 'active' ? { ...m, status: 'stopped', stoppedAt: new Date().toISOString(), stopReason: reason } : m),
            events: append(ip, { type: 'med_stop', actor: ip.admittingDoctor, title: `Stopped ${name}`, detail: reason, severity: 'warning', patientText: `A medicine (${name}) was stopped.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { meds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { meds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend discontinueMed failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 3: Bridge `changeMed`**

Replace the existing `changeMed` implementation with:

```ts
      changeMed: (id, name, p) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            meds: ip.meds.map(m => m.name === name && m.status === 'active' ? { ...m, ...p } : m),
            events: append(ip, { type: 'med_change', actor: ip.admittingDoctor, title: `Adjusted ${name}`, detail: Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(', '), patientText: `Your ${name} was adjusted.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { meds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { meds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend changeMed failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 4: Bridge `administerMed`** (actor-bearing — `a.by` is a caller-suppliable parameter; the PERSISTED `mar` entry's `by` is overridden with the resolved real actor's name, while the local optimistic state keeps whatever the caller passed, per this plan's Global Constraints)

Replace the existing `administerMed` implementation with:

```ts
      administerMed: (id, a) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        let localRec: MarRecord | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const rec: MarRecord = { id: uid('mar'), medName: a.medName, slot: a.slot, action: a.action, by: a.by || 'Nurse', at: new Date().toISOString(), note: a.note }
            localRec = rec
            const title = a.action === 'given' ? `Administered ${a.medName}` : `Held ${a.medName}`
            return {
              ...ip,
              mar: [...(ip.mar ?? []), rec],
              events: append(ip, {
                type: 'med_change', actor: rec.by, title,
                detail: `${a.slot}${a.note ? ` · ${a.note}` : ''}`,
                severity: a.action === 'held' ? 'warning' : 'info',
                patientText: a.action === 'given' ? `A nurse gave you your ${a.medName} dose.` : `A dose of ${a.medName} was held by the nursing team.`,
              }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated || !localRec) return
        const { mar, events } = updated
        void (async () => {
          const actor = await resolveRealIpdActor()
          if (!actor) return
          const realMar = mar.map(m => m.id === localRec!.id ? { ...m, by: actor.name } : m)
          const realEvents = events.map(e => e.id === events[events.length - 1]!.id ? { ...e, actor: actor.name } : e)
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { mar: realMar, events: realEvents })
          } catch (err) {
            console.error('[useInpatientStore] real backend administerMed failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 5: Write and run a throwaway verification script proving `administerMed`'s persisted `by` comes from the session, not the caller-supplied string**

`src/store/__tests__/_throwaway-task5-verify.test.ts` — materialize a real `ipd_stays` row (Task 3's flow), sign in as a `nurse`-role user whose `profiles.full_name` is deliberately different from the string the UI would pass (e.g. `'Real Nurse (Task 5)'` vs. calling `administerMed(patientId, { medName: 'Aspirin', slot: '08:00', action: 'given', by: 'N. Anjali' })`), then re-query the real `ipd_stays` row and assert the last `mar` entry's `by === 'Real Nurse (Task 5)'` and explicitly `!== 'N. Anjali'`. Also exercise `addMed`/`discontinueMed`/`changeMed` and confirm `meds`/`events` update, plus a demo-seeded patient safety check confirming no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task5-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task5-verify.test.ts
```

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useInpatientStore.ts
```

---

### Task 6: Bridge vitals/IV/IO — `recordVitals`, `addIvLine`, `setIvStatus`, `addIo`

**Files:**
- Modify: `src/store/useInpatientStore.ts`

**Interfaces:**
- Consumes: `IpdVitals.record` (Task 2), `IpdStays.patch` (Task 2), `resolveRealIpdActor` (Task 4).

Add near the top of the file (after the existing imports):

```ts
import type { IpdVital } from '@/lib/api/ipd-vitals'
```

- [ ] **Step 1: Bridge `recordVitals`** (actor-bearing — `v.by` is a caller-suppliable field embedded in the vitals payload; writes to the SEPARATE `ipd_vitals` table, Task 1's design decision, plus the `latestVitals` cache on `ipd_stays`. `systolicBP`/`diastolicBP` map to the repo's `systolicBp`/`diastolicBp` explicitly, per this plan's Global Constraints)

Replace the existing `recordVitals` implementation with:

```ts
      recordVitals: (id, v) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        let localRec: VitalsRecord | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const rec: VitalsRecord = { id: uid('v'), at: new Date().toISOString(), ...v }
            localRec = rec
            const news = news2FromRecord(rec)
            const bp = (rec.systolicBP != null && rec.diastolicBP != null) ? `${rec.systolicBP}/${rec.diastolicBP}` : undefined
            const detail = [
              rec.hr != null ? `HR ${rec.hr}` : null,
              bp ? `BP ${bp}` : null,
              rec.rr != null ? `RR ${rec.rr}` : null,
              rec.spo2 != null ? `SpO₂ ${rec.spo2}%${rec.o2Delivery && rec.o2Delivery !== 'Room air' ? ` (${rec.o2Delivery})` : ''}` : null,
              rec.temp != null ? `Temp ${rec.temp}°F` : null,
              rec.pain != null ? `Pain ${rec.pain}/10` : null,
              rec.bloodGlucose != null ? `Glu ${rec.bloodGlucose}` : null,
              rec.consciousness && rec.consciousness !== 'A' ? `AVPU ${rec.consciousness}` : null,
            ].filter(Boolean).join(' · ')
            return {
              ...ip,
              vitals: [...(ip.vitals ?? []), rec],
              latestVitals: { hr: rec.hr ?? 0, bp: bp ?? '—', temp: rec.temp ?? 0, spo2: rec.spo2 ?? 0, at: rec.at },
              events: append(ip, {
                type: 'note', actor: rec.by || 'Nurse',
                title: `Vitals recorded · NEWS ${news.score}`,
                detail,
                severity: news.band === 'high' ? 'critical' : news.band === 'medium' ? 'warning' : 'info',
                patientText: 'Your vitals were checked by the nursing team.',
              }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated || !localRec) return
        const { latestVitals, events } = updated
        const rec = localRec
        void (async () => {
          const actor = await resolveRealIpdActor()
          if (!actor) return
          try {
            const { IpdVitals, IpdStays } = await import('@/lib/api')
            const vitalInput: Omit<IpdVital, 'id' | 'recordedAt' | 'recordedBy' | 'recordedByName'> = {
              ipdStayId: realId!, patientId: id,
              hr: rec.hr, systolicBp: rec.systolicBP, diastolicBp: rec.diastolicBP, rr: rec.rr,
              spo2: rec.spo2, o2Delivery: rec.o2Delivery, o2Flow: rec.o2Flow, temp: rec.temp,
              pain: rec.pain, bloodGlucose: rec.bloodGlucose, consciousness: rec.consciousness,
              gcs: rec.gcs, weight: rec.weight, height: rec.height,
              capillaryRefill: rec.capillaryRefill, urineOutput: rec.urineOutput, note: rec.note,
            }
            await IpdVitals.record(vitalInput, actor)
            const realEvents = events.map(e => e.id === events[events.length - 1]!.id ? { ...e, actor: actor.name } : e)
            await IpdStays.patch(realId!, { latestVitals, events: realEvents })
          } catch (err) {
            console.error('[useInpatientStore] real backend recordVitals failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 2: Bridge `addIvLine`**

Replace the existing `addIvLine` implementation with:

```ts
      addIvLine: (id, line) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            ivLines: [...(ip.ivLines ?? []), { id: uid('iv'), ...line }],
            events: append(ip, { type: 'note', actor: 'Nurse', title: `IV started — ${line.fluid}`, detail: `${line.rate}` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { ivLines, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { ivLines, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addIvLine failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 3: Bridge `setIvStatus`**

Replace the existing `setIvStatus` implementation with:

```ts
      setIvStatus: (id, ivId, status) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            ivLines: (ip.ivLines ?? []).map(l => l.id === ivId ? { ...l, status } : l),
            events: append(ip, { type: 'note', actor: 'Nurse', title: `IV ${status.toLowerCase()} — ${(ip.ivLines ?? []).find(l => l.id === ivId)?.fluid ?? 'line'}` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { ivLines, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { ivLines, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setIvStatus failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 4: Bridge `addIo`** (actor-bearing — `e.by` is a caller-suppliable parameter)

Replace the existing `addIo` implementation with:

```ts
      addIo: (id, e) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        let localEntry: IoEntry | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const entry: IoEntry = { id: uid('io'), at: new Date().toISOString(), by: e.by || 'Nurse', kind: e.kind, type: e.type, volume: e.volume }
            localEntry = entry
            return {
              ...ip,
              io: [...(ip.io ?? []), entry],
              events: append(ip, { type: 'note', actor: e.by || 'Nurse', title: `${e.kind === 'intake' ? 'Intake' : 'Output'} recorded — ${e.type}`, detail: `${e.volume} mL` }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated || !localEntry) return
        const { io, events } = updated
        void (async () => {
          const actor = await resolveRealIpdActor()
          if (!actor) return
          const realIo = io.map(x => x.id === localEntry!.id ? { ...x, by: actor.name } : x)
          const realEvents = events.map(x => x.id === events[events.length - 1]!.id ? { ...x, actor: actor.name } : x)
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { io: realIo, events: realEvents })
          } catch (err) {
            console.error('[useInpatientStore] real backend addIo failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 5: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task6-verify.test.ts` — materialize a real `ipd_stays` row (Task 3's flow), sign in as a `nurse`-role user with a distinct `profiles.full_name`, then call `recordVitals(patientId, { systolicBP: 128, diastolicBP: 82, hr: 88, by: 'N. Anjali' })` and assert: (a) a real `ipd_vitals` row exists with `systolic_bp = 128`, `diastolic_bp = 82`, `recorded_by` equal to the signed-in nurse's id (not any local string), and (b) `ipd_stays.latest_vitals` reflects the new reading. Also exercise `addIvLine`/`setIvStatus`/`addIo` and confirm `iv_lines`/`io` update on the real row, plus a demo-seeded patient safety check confirming no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task6-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task6-verify.test.ts
```

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useInpatientStore.ts
```

---

### Task 7: Bridge IPD test-orders — `addTest`, `setTestResult`, `acknowledgeTest`, `acknowledgeOrder`

**Files:**
- Modify: `src/store/useInpatientStore.ts`

**Interfaces:**
- Consumes: `IpdStays.patch` (Task 2).

None of these four actions take a caller-suppliable actor parameter (`addTest`/`setTestResult`/`acknowledgeTest` are doctor-authored via the already-fixed `ip.admittingDoctor`; `acknowledgeOrder`'s actor is the hardcoded local `'Nurse'` constant, not a parameter) — no `resolveRealIpdActor` call needed here, per this plan's Global Constraints.

- [ ] **Step 1: Bridge `addTest`**

Replace the existing `addTest` implementation with:

```ts
      addTest: (id, t) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            tests: [...ip.tests, { id: uid('t'), name: t.name, status: 'Ordered', priority: t.priority ?? 'Routine', orderedAt: new Date().toISOString() }],
            events: append(ip, { type: 'test_order', actor: ip.admittingDoctor, title: `Ordered ${t.name}`, detail: t.priority ?? 'Routine', patientText: `A test (${t.name}) was ordered.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { tests, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { tests, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addTest failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 2: Bridge `setTestResult`**

Replace the existing `setTestResult` implementation with:

```ts
      setTestResult: (id, testId, r) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            tests: ip.tests.map(t => t.id === testId ? { ...t, status: 'Ready', result: r.result, resultAt: new Date().toISOString(), critical: r.critical } : t),
            events: append(ip, { type: 'test_result', actor: 'Laboratory', title: `Result: ${ip.tests.find(t => t.id === testId)?.name ?? 'test'}`, detail: r.result, severity: r.critical ? 'critical' : 'success' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { tests, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { tests, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setTestResult failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 3: Bridge `acknowledgeTest`**

Replace the existing `acknowledgeTest` implementation with:

```ts
      acknowledgeTest: (id, testId) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            tests: ip.tests.map(t => t.id === testId ? { ...t, status: 'Acknowledged', acknowledgedAt: new Date().toISOString() } : t),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { tests } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { tests })
          } catch (err) {
            console.error('[useInpatientStore] real backend acknowledgeTest failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 4: Bridge `acknowledgeOrder`**

Replace the existing `acknowledgeOrder` implementation with:

```ts
      acknowledgeOrder: (id, o) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            nurseAck: [...(ip.nurseAck ?? []), o.key],
            events: append(ip, { type: 'note', actor: 'Nurse', title: `Order actioned — ${o.label}`, severity: 'info' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { nurseAck, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { nurseAck, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend acknowledgeOrder failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 5: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task7-verify.test.ts` — materialize a real `ipd_stays` row (Task 3's flow), then call `addTest`, `setTestResult`, `acknowledgeTest`, `acknowledgeOrder` against the resulting local `Inpatient`, and re-query the real row after each call to assert `tests`/`nurse_ack`/`events` match. Also exercise a demo-seeded patient safety check confirming no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task7-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task7-verify.test.ts
```

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useInpatientStore.ts
```

---

### Task 8: Bridge referral/ICU-transfer/OT-booking/surgery status — `referInpatient`, `requestIcuTransfer`, `bookOT`, `requestSurgery`, `signConsent`, `scheduleSurgery`, `advanceSurgery`, `setPostOpNote`

**Files:**
- Modify: `src/store/useInpatientStore.ts`

**Interfaces:**
- Consumes: `IpdStays.patch` (Task 2).

Per this plan's Global Constraints, `signConsent`'s `meta.signedBy` stays a free-text, unverified label (the actual signer is typically the patient/a relative, who has no `profiles` row to resolve against) — gated only by the live-session guard, no `resolveRealIpdActor` call. Every other action here uses `ip.admittingDoctor` (already fixed, not a caller parameter).

- [ ] **Step 1: Bridge `referInpatient`**

Replace the existing `referInpatient` implementation with:

```ts
      referInpatient: (id, r) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            referrals: [...(ip.referrals ?? []), { id: uid('ref'), at: new Date().toISOString(), status: 'sent', ...r }],
            events: append(ip, { type: 'referral', actor: ip.admittingDoctor, title: `Referred to ${r.specialty}${r.toDoctor ? ` (${r.toDoctor})` : ''}`, detail: r.reason, severity: r.urgent ? 'warning' : 'info', patientText: `You were referred to a ${r.specialty} specialist.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { referrals, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { referrals, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend referInpatient failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 2: Bridge `requestIcuTransfer`**

Replace the existing `requestIcuTransfer` implementation with:

```ts
      requestIcuTransfer: (id, t) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            icuTransfer: { id: uid('icu'), at: new Date().toISOString(), status: 'requested', ...t },
            events: append(ip, { type: 'icu_transfer', actor: ip.admittingDoctor, title: 'ICU transfer requested', detail: t.reason, severity: 'warning', patientText: 'Your care team requested a move to intensive care for closer monitoring.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { icuTransfer, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { icuTransfer, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend requestIcuTransfer failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 3: Bridge `bookOT`**

Replace the existing `bookOT` implementation with:

```ts
      bookOT: (id, o) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            stage: 'pre_op',
            otBooking: { id: uid('ot'), status: 'requested', ...o },
            surgery: ip.surgery ?? { procedure: o.procedure, surgeon: o.surgeon, status: 'scheduled', consentSigned: false, preOpDone: false, ot: o.ot, scheduledAt: o.scheduledAt },
            events: append(ip, { type: 'ot_booking', actor: ip.admittingDoctor, title: `OT booked — ${o.procedure}`, detail: `${o.surgeon} · ${o.ot} · ${o.scheduledAt}`, patientText: 'Your procedure has been scheduled.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { stage, otBooking, surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { stage, otBooking, surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend bookOT failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 4: Bridge `requestSurgery`**

Replace the existing `requestSurgery` implementation with:

```ts
      requestSurgery: (id, sg) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, stage: 'pre_op',
            surgery: { ...sg, status: 'consent_pending', consentSigned: false, preOpDone: false },
            events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: `Surgery planned — ${sg.procedure}`, detail: 'Awaiting consent', severity: 'warning', patientText: `A procedure (${sg.procedure}) has been planned. Your consent is needed.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { stage, surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { stage, surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend requestSurgery failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 5: Bridge `signConsent`** (`meta.signedBy` stays free-text/unverified — see this task's preamble)

Replace the existing `signConsent` implementation with:

```ts
      signConsent: (id, meta) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.surgery ? ({
            ...ip, surgery: {
              ...ip.surgery,
              consentSigned: true,
              consentSignedAt: meta?.signedAt ?? new Date().toISOString(),
              consentSignedBy: meta?.signedBy,
            },
            events: append(ip, {
              type: 'surgery_status', actor: meta?.signedBy ?? ip.name,
              title: 'Consent signed',
              detail: meta?.signedBy ? `Signed digitally by ${meta.signedBy}` : undefined,
              severity: 'success',
              patientText: 'Consent for your procedure was signed.',
            }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend signConsent failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 6: Bridge `scheduleSurgery`**

Replace the existing `scheduleSurgery` implementation with:

```ts
      scheduleSurgery: (id, d) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.surgery ? ({
            ...ip, surgery: { ...ip.surgery, ...d, status: 'scheduled', preOpDone: true },
            events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: `Surgery scheduled — ${ip.surgery.procedure}`, detail: `${d.ot} · ${d.scheduledAt}`, patientText: 'Your procedure has been scheduled.' }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend scheduleSurgery failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 7: Bridge `advanceSurgery`**

Replace the existing `advanceSurgery` implementation with:

```ts
      advanceSurgery: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => {
            if (!ip.surgery) return ip
            const flow: SurgeryStatus[] = ['scheduled', 'in_ot', 'recovery', 'done']
            const i = flow.indexOf(ip.surgery.status)
            const next = flow[Math.min(i + 1, flow.length - 1)]
            const stage: IpdStage = next === 'in_ot' ? 'in_surgery' : next === 'recovery' ? 'post_op' : next === 'done' ? 'recovering' : ip.stage
            const labels: Record<string, string> = { in_ot: 'In operating theatre', recovery: 'Moved to recovery', done: 'Procedure complete' }
            return { ...ip, surgery: { ...ip.surgery, status: next }, stage, events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: labels[next] ?? `Surgery: ${next}`, severity: 'info', patientText: next === 'done' ? 'Your procedure is complete and you are recovering.' : 'There is an update about your procedure.' }) }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { stage, surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { stage, surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend advanceSurgery failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 8: Bridge `setPostOpNote`**

Replace the existing `setPostOpNote` implementation with:

```ts
      setPostOpNote: (id, note) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.surgery ? ({
            ...ip, surgery: { ...ip.surgery, postOpNote: note },
            events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: 'Post-op note', detail: note }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setPostOpNote failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 9: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task8-verify.test.ts` — materialize a real `ipd_stays` row (Task 3's flow), then drive `referInpatient` → `requestIcuTransfer` → `bookOT` → `requestSurgery` → `signConsent` → `scheduleSurgery` → `advanceSurgery` (twice) → `setPostOpNote` against the resulting local `Inpatient`, re-querying the real row after each call to assert `referrals`/`icu_transfer`/`ot_booking`/`surgery`/`stage`/`events` all match. Also exercise a demo-seeded patient (`IP-3003`, which already has `surgery` seeded, no `realId`) through the same sequence and confirm no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task8-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task8-verify.test.ts
```

- [ ] **Step 10: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useInpatientStore.ts
```

---

### Task 9: Bridge the discharge pipeline — `useInpatientStore`'s `initiateDischarge`/`revertDischarge`/`clearPillar`/`setDischargeSummary`/`completeDischarge`, plus `useDischargeStore`'s own clearance actions

**Files:**
- Modify: `src/store/useInpatientStore.ts`
- Modify: `src/store/useDischargeStore.ts`

**Interfaces:**
- Consumes: `IpdStays.patch`/`IpdStays.get` (Task 2).
- Produces: `DischargePatient.realId?: string`, `useDischargeStore.getState().setRealId` — the cross-link both stores' bridges rely on.

**Design decision — a shared `patchWithSharedDischarge` read-merge-write helper, duplicated once per store (mirrors `resolveRealIpdActor`'s per-store-duplication precedent from Lab/Radiology).** Every other bridge in this phase relies on the calling store already having the COMPLETE locally-computed slice, needing no server-side merge. Discharge is the one exception: `discharge` is a single shared `jsonb` column written by TWO independent stores (`useInpatientStore`'s pillars/summary/meds/redFlags/initiatedAt/doneAt and `useDischargeStore`'s clearances/orderIssued/summaryDrafted/summaryApproved/exitClearanceIssued/blockers/dischargeInstructions) — a bridge that blindly overwrote the whole column with only its own store's fields would silently erase whatever the OTHER store last wrote. Each store's bridge therefore does one `IpdStays.get(realId)` read immediately before patching, merges in only the fields its own action changed, and patches the merged whole object back.

- [ ] **Step 1: Add the `patchWithSharedDischarge` helper and bridge `useInpatientStore.ts`'s five discharge actions**

Add near the top of the file (after the existing imports):

```ts
import type { IpdStay } from '@/lib/api/ipd-stays'
```

Add after `resolveRealIpdActor` (Task 4):

```ts
// Phase 7 Task 9 — discharge's jsonb column is shared with useDischargeStore
// (see this plan's Global Constraints and Task 9's preamble): read-then-merge
// before patching, since the OTHER store may have last written fields this
// store's local `ip.discharge` doesn't know about. Pass `dischargePartial:
// null` to explicitly clear the whole column (revertDischarge).
async function patchWithSharedDischarge(
  realId: string,
  dischargePartial: Partial<NonNullable<IpdStay['discharge']>> | null,
  rest: Partial<IpdStay> = {},
) {
  const { IpdStays } = await import('@/lib/api')
  if (dischargePartial === null) {
    return IpdStays.patch(realId, { discharge: null as unknown as IpdStay['discharge'], ...rest })
  }
  const current = await IpdStays.get(realId)
  const merged = { ...(current?.discharge ?? {}), ...dischargePartial } as NonNullable<IpdStay['discharge']>
  return IpdStays.patch(realId, { discharge: merged, ...rest })
}
```

Replace the existing `initiateDischarge` implementation with:

```ts
      initiateDischarge: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, stage: 'discharge_initiated',
            discharge: { pillars: { clinical: true, nursing: false, pharmacy: false, billing: false, insurance: false }, meds: [], redFlags: [], initiatedAt: new Date().toISOString() },
            events: append(ip, { type: 'discharge_step', actor: ip.admittingDoctor, title: 'Discharge initiated', severity: 'info', patientText: 'Your discharge process has started.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        // Bridge into the Discharge Portal queue (unchanged local behavior),
        // plus stamp the new queue entry's realId so useDischargeStore's own
        // Task 9 bridges can find this same real ipd_stays row.
        const ip = get().inpatients.find(i => i.patientId === id)
        if (ip) {
          const ds = useDischargeStore.getState()
          if (!ds.dischargeQueue.some(d => d.patientId === ip.patientId)) {
            ds.initDischarge({
              patientId: ip.patientId,
              patientName: ip.name,
              wardBed: `${ip.ward} ${ip.bed}`.trim(),
              diagnosis: ip.diagnosis,
              admittedOn: ip.admittedAt,
              expectedDischarge: new Date().toISOString(),
              attendingDoctor: ip.admittingDoctor,
              payerType: 'General',
              condition: ip.condition === 'Critical' ? 'Critical' : ip.condition === 'Serious' ? 'Monitoring' : 'Stable',
              ttoMeds: ip.meds.filter(m => m.status === 'active').map(m => ({ name: m.name, dose: m.dose, freq: m.freq, duration: '7 days' })),
            })
            if (ip.realId) ds.setRealId(ip.patientId, ip.realId)
          }
        }
        if (!realId || !updated) return
        const { discharge, stage, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, discharge ?? null, { stage, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend initiateDischarge failed (local chart still updated):', err)
          }
        })()
      },
```

Replace the existing `revertDischarge` implementation with:

```ts
      revertDischarge: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const { discharge: _discharge, ...rest } = ip
            return {
              ...rest, stage: 'under_treatment',
              events: append(ip, { type: 'discharge_step', actor: ip.admittingDoctor, title: 'Discharge cancelled — returned to ward', severity: 'warning', patientText: 'Your discharge was paused; your care team is continuing treatment.' }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { stage, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, null, { stage, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend revertDischarge failed (local chart still updated):', err)
          }
        })()
      },
```

Replace the existing `clearPillar` implementation with:

```ts
      clearPillar: (id, key) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.discharge ? ({
            ...ip, discharge: { ...ip.discharge, pillars: { ...ip.discharge.pillars, [key]: true } },
            events: append(ip, { type: 'discharge_step', actor: 'System', title: `Discharge: ${key} cleared` }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.discharge) return
        const { discharge, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, { pillars: discharge.pillars }, { events })
          } catch (err) {
            console.error('[useInpatientStore] real backend clearPillar failed (local chart still updated):', err)
          }
        })()
      },
```

Replace the existing `setDischargeSummary` implementation with:

```ts
      setDischargeSummary: (id, d) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.discharge ? ({ ...ip, discharge: { ...ip.discharge, ...d } }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.discharge) return
        const { summary, followUpDate, meds, redFlags } = updated.discharge
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, { summary, followUpDate, meds, redFlags })
          } catch (err) {
            console.error('[useInpatientStore] real backend setDischargeSummary failed (local chart still updated):', err)
          }
        })()
      },
```

Replace the existing `completeDischarge` implementation with:

```ts
      completeDischarge: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.discharge ? ({
            ...ip, stage: 'discharged', condition: 'Discharge-ready',
            discharge: { ...ip.discharge, doneAt: new Date().toISOString() },
            events: append(ip, { type: 'discharged', actor: ip.admittingDoctor, title: 'Discharged', severity: 'success', patientText: 'You have been discharged. Your take-home instructions are in your summary.' }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        // Local-only side effects (unchanged): feedback request + notification.
        const ip = get().inpatients.find(p => p.patientId === id)
        if (ip) {
          usePatientFeedbackStore.getState().createFeedbackRequest(
            ip.patientId, ip.name, 'ipd', id,
            ip.admittingDoctor, ip.ward, ip.diagnosis,
            new Date().toISOString(),
          )
          useNotificationStore.getState().add({
            type: 'feedback_requested', priority: 'low',
            title: 'How was your stay?',
            body: 'Your feedback helps us improve. It only takes 2 minutes.',
            targetRole: 'patient', channels: ['in_app'],
            link: '/patient/feedback',
          })
        }
        if (!realId || !updated?.discharge) return
        const { stage, condition, discharge, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, { doneAt: discharge.doneAt }, { stage, condition, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend completeDischarge failed (local chart still updated):', err)
          }
        })()
      },
```

- [ ] **Step 2: Add `realId`/`setRealId` and the same `patchWithSharedDischarge` helper to `src/store/useDischargeStore.ts`**

Read the current file first (already read in full for this plan). Add to the `DischargePatient` type (after `ttoMeds?: ...`):

```ts
  realId?: string                          // the real ipd_stays.id, stamped by useInpatientStore's initiateDischarge (Phase 7 Task 9)
```

Add to the `DischargeState` interface (after `removeFromQueue`):

```ts
  setRealId: (patientId: string, realId: string) => void
```

Add imports at the top of the file:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
import type { IpdStay } from '@/lib/api/ipd-stays'
```

Add, after the `uid`/helper section (before `export const useDischargeStore`):

```ts
// Phase 7 Task 9 — mirrors useInpatientStore.ts's own patchWithSharedDischarge
// line-for-line (duplicated per-store, same precedent as resolveRealIpdActor):
// read-then-merge before patching, since useInpatientStore may have last
// written fields this store's local DischargePatient doesn't know about
// (pillars.clinical, meds, redFlags, initiatedAt, doneAt).
async function patchWithSharedDischarge(
  realId: string,
  dischargePartial: Partial<NonNullable<IpdStay['discharge']>>,
) {
  const { IpdStays } = await import('@/lib/api')
  const current = await IpdStays.get(realId)
  const merged = { ...(current?.discharge ?? {}), ...dischargePartial } as NonNullable<IpdStay['discharge']>
  return IpdStays.patch(realId, { discharge: merged })
}

// 'doctor' (this store) <-> 'clinical' (useInpatientStore.ts's own
// DischargePillarKey) — every other key spells identically. See this plan's
// Global Constraints for why 'clinical' was chosen as the canonical name.
function toSharedPillars(clearances: Record<ClearancePillar, 'pending' | 'cleared'>) {
  return {
    clinical: clearances.doctor === 'cleared',
    nursing: clearances.nursing === 'cleared',
    pharmacy: clearances.pharmacy === 'cleared',
    billing: clearances.billing === 'cleared',
    insurance: clearances.insurance === 'cleared',
  }
}
```

- [ ] **Step 3: Add `setRealId` and bridge `setClearance`/`setOrderIssued`**

Add, after the existing `removeFromQueue` implementation:

```ts
  setRealId: (patientId, realId) => set(s => ({
    dischargeQueue: s.dischargeQueue.map(p => p.patientId === patientId ? { ...p, realId } : p),
  })),
```

Replace the existing `setClearance` implementation with:

```ts
  setClearance: (patientId, pillar, status) => {
    let updated: DischargePatient | undefined
    set((s) => {
      const nextQueue = s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, clearances: { ...p.clearances, [pillar]: status } }
        if (pillar === 'doctor') {
          const on = status === 'cleared'
          next.orderIssued = on
          next.summaryDrafted = on
          next.summaryApproved = on
        }
        updated = next
        return next
      })
      return { dischargeQueue: nextQueue }
    })
    useAuditStore.getState().log({
      userId: 'DC-SYS', userName: 'Discharge',
      action: 'discharge_clearance', resource: 'discharge', resourceId: patientId,
      detail: `${pillar} → ${status}`,
    })
    if (!updated?.realId) return
    const { realId, clearances, orderIssued, summaryDrafted, summaryApproved } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { pillars: toSharedPillars(clearances), orderIssued, summaryDrafted, summaryApproved })
      } catch (err) {
        console.error('[useDischargeStore] real backend setClearance failed (local queue still updated):', err)
      }
    })()
  },
```

Replace the existing `setOrderIssued` implementation with:

```ts
  setOrderIssued: (patientId, issued) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, orderIssued: issued }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, orderIssued } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { orderIssued })
      } catch (err) {
        console.error('[useDischargeStore] real backend setOrderIssued failed (local queue still updated):', err)
      }
    })()
  },
```

- [ ] **Step 4: Bridge `draftSummary`/`approveSummary`/`undraftSummary`/`unapproveSummary`**

Replace each of the four existing implementations with:

```ts
  draftSummary: (patientId, summary) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryDrafted: true, dischargeSummary: summary }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, dischargeSummary } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryDrafted: true, summary: dischargeSummary })
      } catch (err) {
        console.error('[useDischargeStore] real backend draftSummary failed (local queue still updated):', err)
      }
    })()
  },

  approveSummary: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryApproved: true }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryApproved: true })
      } catch (err) {
        console.error('[useDischargeStore] real backend approveSummary failed (local queue still updated):', err)
      }
    })()
  },

  undraftSummary: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryDrafted: false, summaryApproved: false }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryDrafted: false, summaryApproved: false })
      } catch (err) {
        console.error('[useDischargeStore] real backend undraftSummary failed (local queue still updated):', err)
      }
    })()
  },

  unapproveSummary: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryApproved: false }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryApproved: false })
      } catch (err) {
        console.error('[useDischargeStore] real backend unapproveSummary failed (local queue still updated):', err)
      }
    })()
  },
```

- [ ] **Step 5: Bridge `issueExitClearance`/`setFollowUp`/`setInstructions`/`addBlocker`/`resolveBlocker`**

`dischargedAt` (a local-only `useDischargeStore` field) is deliberately NOT persisted separately — it's redundant with the shared `discharge.doneAt` that `useInpatientStore.completeDischarge` already writes (see this plan's Global Constraints on the shared discharge shape); only `exitClearanceIssued` is bridged.

Replace each of the five existing implementations with:

```ts
  issueExitClearance: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, exitClearanceIssued: true, dischargedAt: new Date().toISOString() }
        updated = next
        return next
      }),
    }))
    useAuditStore.getState().log({
      userId: 'DC-SYS', userName: 'Discharge',
      action: 'exit_clearance_issued', resource: 'discharge', resourceId: patientId,
      detail: `Exit clearance issued for ${patientId}`,
    })
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { exitClearanceIssued: true })
      } catch (err) {
        console.error('[useDischargeStore] real backend issueExitClearance failed (local queue still updated):', err)
      }
    })()
  },

  setFollowUp: (patientId, date) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, followUpDate: date }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { followUpDate: date })
      } catch (err) {
        console.error('[useDischargeStore] real backend setFollowUp failed (local queue still updated):', err)
      }
    })()
  },

  setInstructions: (patientId, instructions) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, dischargeInstructions: instructions }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { dischargeInstructions: instructions })
      } catch (err) {
        console.error('[useDischargeStore] real backend setInstructions failed (local queue still updated):', err)
      }
    })()
  },

  addBlocker: (patientId, blocker) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, blockers: [...p.blockers, { ...blocker, id: `BLK-${Date.now()}` }] }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, blockers } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { blockers })
      } catch (err) {
        console.error('[useDischargeStore] real backend addBlocker failed (local queue still updated):', err)
      }
    })()
  },

  resolveBlocker: (patientId, blockerId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, blockers: p.blockers.map(b => b.id === blockerId ? { ...b, resolvedAt: new Date().toISOString() } : b) }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, blockers } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { blockers })
      } catch (err) {
        console.error('[useDischargeStore] real backend resolveBlocker failed (local queue still updated):', err)
      }
    })()
  },
```

`removeFromQueue` is left entirely unchanged (local-only) — removing a patient from the discharge-desk's local queue does not delete or alter the real `ipd_stays` row; the row's `discharge` state is left exactly as it was, since removal here typically means the desk simply stopped tracking it locally, not that the discharge was retroactively erased.

- [ ] **Step 6: Write and run a throwaway verification script proving both stores converge on one real `discharge` object without clobbering each other**

`src/store/__tests__/_throwaway-task9-verify.test.ts` — materialize a real `ipd_stays` row (Task 3's flow), call `useInpatientStore.getState().initiateDischarge(patientId)`, confirm `useDischargeStore.getState().dischargeQueue` now has an entry with `realId` set, then interleave: `useInpatientStore.getState().clearPillar(patientId, 'nursing')` followed by `useDischargeStore.getState().setClearance(patientId, 'pharmacy', 'cleared')`, then re-query the real `ipd_stays.discharge` column via the service-role admin client and assert BOTH `pillars.nursing === true` AND `pillars.pharmacy === true` are present together (proving neither bridge clobbered the other's write). Continue through `setDischargeSummary`/`draftSummary`/`approveSummary`/`issueExitClearance`/`completeDischarge` and assert the final real row has `stage = 'discharged'` and every expected `discharge` field set. Also exercise a demo-seeded patient (`IP-3004`, no `realId`) through `initiateDischarge`/`completeDischarge` and confirm no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task9-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task9-verify.test.ts
```

- [ ] **Step 7: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useInpatientStore.ts src/store/useDischargeStore.ts
```

---

### Task 10: Bridge nurse shift/handover + nurse task worklist — `useShiftStore`'s `signHandover`/`receiveHandover`, `useNursingStore`'s `addTask`/`toggleTask`/`removeTask`/`addAiTasks`

**Files:**
- Modify: `src/store/useShiftStore.ts`
- Modify: `src/store/useNursingStore.ts`

**Interfaces:**
- Consumes: `ShiftHandovers.sign/receive` (Task 2), `NurseTasks.create/toggle/remove` (Task 2).

`useShiftStore.ts`'s `assignments` array has no bridge (Task 1's design decision: it is SELECT-only reference data with no mutating action in the store today — `setActiveWard` is a local-only UI selector, not a real write). `setActiveWard`/`myAssignment`/`pendingIncoming` are unchanged.

- [ ] **Step 1: Add `realId` + `resolveRealShiftActor` + bridge `signHandover`/`receiveHandover` in `src/store/useShiftStore.ts`**

Add to the `HandoverRecord` type (after `status: 'signed' | 'received'`):

```ts
  realId?: string                          // the real shift_handovers.id, once materialized (Phase 7 Task 10)
```

Add imports at the top of the file:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
```

Add to the `ShiftState` interface — change `signHandover`'s return type stays `string` (the LOCAL id, unchanged, so existing callers keep working), and add a new internal setter:

```ts
  setHandoverRealId: (id: string, realId: string) => void
```

Add, after the `uid` helper (before `export const useShiftStore`):

```ts
// Phase 7 Task 10 — mirrors useInpatientStore.ts's resolveRealIpdActor
// line-for-line (per-store duplication, same precedent as Lab/Radiology):
// resolves the REAL signed-in nurse from a live session + profiles lookup,
// never from the local `fromNurse`/`toNurse`/`receivedBy` display strings —
// signing/receiving a shift handover is a real clinical accountability act.
async function resolveRealShiftActor(): Promise<{ id: string; name: string } | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}
```

Add `setHandoverRealId` to the store implementation (after `receiveHandover`'s implementation):

```ts
      setHandoverRealId: (id, realId) => set(s => ({
        handovers: s.handovers.map(h => h.id === id ? { ...h, realId } : h),
      })),
```

Replace the existing `signHandover` implementation with:

```ts
      signHandover: (rec) => {
        const id = uid()
        set(s => ({ handovers: [{ ...rec, id, signedAt: new Date().toISOString(), status: 'signed' }, ...s.handovers] }))
        void (async () => {
          const actor = await resolveRealShiftActor()
          if (!actor) return
          try {
            const { ShiftHandovers } = await import('@/lib/api')
            const saved = await ShiftHandovers.sign({
              ward: rec.ward, date: rec.date, fromShift: rec.fromShift, toShift: rec.toShift,
              sbar: rec.sbar, addendum: rec.addendum, patientCount: rec.patientCount,
            }, actor)
            get().setHandoverRealId(id, saved.id)
          } catch (err) {
            console.error('[useShiftStore] real backend signHandover failed (local handover still recorded):', err)
          }
        })()
        return id
      },
```

Replace the existing `receiveHandover` implementation with:

```ts
      receiveHandover: (id, by) => {
        let realId: string | undefined
        set(s => {
          const next = { handovers: s.handovers.map(h => h.id === id ? { ...h, status: 'received' as const, receivedAt: new Date().toISOString(), receivedBy: by } : h) }
          realId = next.handovers.find(h => h.id === id)?.realId
          return next
        })
        if (!realId) return
        void (async () => {
          const actor = await resolveRealShiftActor()
          if (!actor) return
          try {
            const { ShiftHandovers } = await import('@/lib/api')
            await ShiftHandovers.receive(realId!, actor)
          } catch (err) {
            console.error('[useShiftStore] real backend receiveHandover failed (local handover still updated):', err)
          }
        })()
      },
```

- [ ] **Step 2: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task10a-verify.test.ts` — sign in as a real `nurse`-role user, call `useShiftStore.getState().signHandover({...})`, confirm the local handover gets a `realId` stamped (poll/await the async IIFE by awaiting a microtask flush, e.g. `await new Promise(r => setTimeout(r, 50))`), then re-query the real `shift_handovers` row via the service-role admin client and assert `from_nurse_id` equals the signed-in nurse's id (not any local string). Call `receiveHandover(id, 'Some Display Name')` and assert the real row's `status` becomes `'received'` and `received_by_id` equals the same nurse's id.

Run: `npx vitest run src/store/__tests__/_throwaway-task10a-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task10a-verify.test.ts
```

- [ ] **Step 3: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useShiftStore.ts
```

- [ ] **Step 4: Add `realId` and bridge `addTask`/`toggleTask`/`removeTask`/`addAiTasks` in `src/store/useNursingStore.ts`**

Add to the `NurseTask` type (after `doneAt?: string`):

```ts
  realId?: string                          // the real nurse_tasks.id, once materialized (Phase 7 Task 10)
```

Add imports at the top of the file:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
```

Add to the `NursingState` interface — add a setter:

```ts
  setTaskRealId: (id: string, realId: string) => void
```

Add `setTaskRealId` to the store implementation (after `addAiTasks`'s implementation):

```ts
      setTaskRealId: (id, realId) => set(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, realId } : t),
      })),
```

Replace the existing `addTask` implementation with:

```ts
      addTask: (t) => {
        const id = uid()
        set(s => ({ tasks: [{ ...t, id, done: false, createdAt: new Date().toISOString() }, ...s.tasks] }))
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            const saved = await NurseTasks.create({
              key: t.key, patientId: t.patientId, patientName: t.patientName,
              title: t.title, category: t.category, priority: t.priority, source: t.source,
            })
            get().setTaskRealId(id, saved.id)
          } catch (err) {
            console.error('[useNursingStore] real backend addTask failed (local task still recorded):', err)
          }
        })()
      },
```

Replace the existing `toggleTask` implementation with:

```ts
      toggleTask: (id) => {
        let realId: string | undefined
        let nowDone: boolean | undefined
        set(s => {
          const next = { tasks: s.tasks.map(t => t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined } : t) }
          const found = next.tasks.find(t => t.id === id)
          realId = found?.realId
          nowDone = found?.done
          return next
        })
        if (!realId || nowDone === undefined) return
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            await NurseTasks.toggle(realId!, nowDone!)
          } catch (err) {
            console.error('[useNursingStore] real backend toggleTask failed (local task still updated):', err)
          }
        })()
      },
```

Replace the existing `removeTask` implementation with:

```ts
      removeTask: (id) => {
        const realId = get().tasks.find(t => t.id === id)?.realId
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
        if (!realId) return
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            await NurseTasks.remove(realId)
          } catch (err) {
            console.error('[useNursingStore] real backend removeTask failed (local task still removed):', err)
          }
        })()
      },
```

Replace the existing `addAiTasks` implementation with:

```ts
      addAiTasks: (suggested) => {
        const existing = new Set(get().tasks.map(t => t.key).filter(Boolean))
        const fresh = suggested.filter(t => t.key && !existing.has(t.key))
        if (!fresh.length) return 0
        const withIds = fresh.map(t => ({ ...t, id: uid(), done: false, createdAt: new Date().toISOString() }))
        set(s => ({ tasks: [...withIds, ...s.tasks] }))
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            for (const t of withIds) {
              const saved = await NurseTasks.create({
                key: t.key, patientId: t.patientId, patientName: t.patientName,
                title: t.title, category: t.category, priority: t.priority, source: t.source,
              })
              get().setTaskRealId(t.id, saved.id)
            }
          } catch (err) {
            console.error('[useNursingStore] real backend addAiTasks failed (local tasks still recorded):', err)
          }
        })()
        return fresh.length
      },
```

- [ ] **Step 5: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task10b-verify.test.ts` — sign in as a real `nurse`-role user, call `useNursingStore.getState().addTask({...})`, await a microtask flush, confirm the local task gets a `realId` stamped and a real `nurse_tasks` row exists; call `toggleTask(id)` and confirm the real row's `done`/`done_at` update; call `removeTask(id)` and confirm the real row is gone. Separately call `addAiTasks([{ key: 'ai-test-1', ... }, { key: 'ai-test-1', ... }])` twice with the same key and confirm only one real row exists (dedup via `NurseTasks.byKeys`).

Run: `npx vitest run src/store/__tests__/_throwaway-task10b-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task10b-verify.test.ts
```

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useNursingStore.ts
```

---

## Self-Review

**Spec coverage:**
- Schema + RLS for `ipd_stays`, `ipd_vitals`, `beds`, `nurse_shift_assignments`, `shift_handovers`, `nurse_tasks`, plus the missing `admission_requests` UPDATE policy — Task 1. `profiles.role` enum verified directly against `20260703123305_core_schema.sql` before writing any policy (no assumed role names).
- Repository modules `ipd-stays.ts`, `beds.ts`, `shift-handovers.ts` as named in the brief, plus `ipd-vitals.ts` and `nurse-tasks.ts` (necessary additions the brief's four-module list didn't explicitly name but Task 10's spec requires) — `discharges.ts` deliberately folded into `ipd-stays.ts`'s shared `discharge` jsonb column, exactly the brief's suggested alternative — Task 2.
- Admission-request transition capability + `assignBed`/`markAdmitted`/`cancelRequest` bridge with the exact `Pending→requested, Assigned→bed_assigned, Admitted→admitted, Cancelled→cancelled` mapping — Task 3. `markAdmitted` is the order-rewire moment materializing `ipd_stays` — Task 3.
- `recordRound`, `addProgressNote`, `setCondition` — Task 4 (plus `logEvent`, folded in as the same category of action).
- `addMed`, `discontinueMed`, `changeMed`, `administerMed` — Task 5.
- `recordVitals`, `addIvLine`, `setIvStatus`, `addIo` — Task 6.
- `addTest`, `setTestResult`, `acknowledgeTest`, `acknowledgeOrder` — Task 7, with the self-contained-vs-real-Lab/Radiology decision explicitly documented (self-contained, per Global Constraints).
- `referInpatient`, `requestIcuTransfer`, `bookOT`, `requestSurgery`, `signConsent`, `scheduleSurgery`, `advanceSurgery`, `setPostOpNote` — Task 8, OT/surgery scope-limited to status jsonb per Global Constraints.
- `initiateDischarge`, `revertDischarge`, `clearPillar`, `setDischargeSummary`, `completeDischarge` plus `useDischargeStore`'s own actions — Task 9, with the canonical pillar mapping and shared-jsonb-column decision both documented and implemented (including the read-merge-write exception this specific task requires).
- `useShiftStore`'s `signHandover`/`receiveHandover` (assignments explicitly out of scope, documented why) and `useNursingStore`'s full task worklist — Task 10.
- All explicitly out-of-scope items (`useOTStore`, `useCmoBedsStore`, multi-branch bed network, AI features) stated once in Global Constraints, not re-litigated per task.

**Placeholder scan:** No "TBD"/"similar to Task N"/"add appropriate error handling" in any implementation code — every store bridge, repository method, and migration is fully written. Verification-script steps for the more repetitive later tasks (4, 7, 8, 10) describe the exact scenario and exact assertions in prose rather than restating full boilerplate already spelled out in full for Tasks 3/5/6/9 — this mirrors Phase 5 Task 4 Step 5's own established precedent for throwaway (uncommitted, deleted-after-use) verification scripts specifically, never for shipped implementation code.

**Type consistency:** `IpdStay`/`IpdStaySchema` (Task 2) field names are used identically in every later task's `IpdStays.patch(...)` call (`rounds`, `meds`, `tests`, `progressNotes`, `condition`, `events`, `mar`, `io`, `ivLines`, `nurseAck`, `referrals`, `icuTransfer`, `otBooking`, `surgery`, `stage`, `discharge`, `latestVitals`). `resolveRealIpdActor`'s return shape (`{ id, name }`) matches every call site in Tasks 5-6. `patchWithSharedDischarge`'s signature is identical in both its Task 9 duplications (`useInpatientStore.ts`/`useDischargeStore.ts`), differing only in the `null`-clearing overload, which only `useInpatientStore.ts`'s `revertDischarge` needs. `systolicBp`/`diastolicBp`/`latestBp` are spelled consistently (never `systolicBP`/`diastolicBP`/`latestBP`) across the Task 1 migration, Task 2's `ipd-vitals.ts`/`ipd-stays.ts` Zod schemas, and Task 6's bridge — the store's own `VitalsRecord.systolicBP`/`diastolicBP` and `Inpatient.latestBP` spellings are only ever read from, mapped explicitly at each bridge call site, never written into a Zod schema directly.
