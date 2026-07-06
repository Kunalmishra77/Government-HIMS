# Phase 3 — Doctor Consultation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a real doctor consultation persist to Postgres end-to-end: consult notes/diagnosis (`encounters`), prescriptions sent to pharmacy (`prescriptions`), lab/radiology orders dispatched during a consult (`orders`), and a basic admission request when a doctor decides IPD (`admission_requests`) — all tied to the real `visits`/`patients` rows Phase 2 already creates.

**Architecture:** `src/lib/api/encounters.ts`, `prescriptions.ts`, `orders.ts` already exist (pre-date this backend effort, zod-validated, localStorage-backed via the same `table()` function Phase 1 made hybrid). Once matching Postgres tables exist with the right column names, these modules automatically start persisting for real — **no code changes needed to those three files**. This phase only needs: (1) the migration, (2) one new repository module (`admission-requests.ts` — no pre-existing equivalent), and (3) bridging `src/app/doctor/dashboard/page.tsx`'s four independent write-points into the real backend, using the exact guard pattern Phase 2 proved correct after four rounds of review.

**Tech Stack:** Same as Phase 1/2 — Next.js 16.2.4, Supabase, existing `src/lib/api/*` repository layer, Vitest.

## Global Constraints

- **The only correct write-guard pattern is a live session check** — `const { data: { session } } = await getSupabaseClient().auth.getSession(); if (session) { const actorId = session.user.id; ... }`. Never gate a real backend write on any `useAuthStore` field (`currentUser`, `isRealSession`, or anything else) — Phase 2 needed four rounds to arrive at this after the persisted-flag approach proved exploitable via stale `localStorage` state. This is non-negotiable for every task in this plan.
- Every new Postgres table gets RLS enabled with explicit policies — no table ships without them.
- **Scope RLS to the real need, not role-only.** Phase 2's nurse policy started role-only (any nurse, any visit, any column) and had to be narrowed twice (once to a status-transition `using`/`with check` pair, once via a column-level GRANT) after review. For this phase, design each policy's `using`/`with check` around the actual transition/ownership it should allow from the start — doctor policies should scope by `doctor_id = auth.uid()` (matching the existing `visits_update_doctor` precedent), not merely by role.
- **Don't invent competing schemas.** `encounters.ts`, `prescriptions.ts`, `orders.ts` already define the camelCase zod shapes — the migration's column names are the snake_case mirror of those exact fields, nothing more, nothing invented. Read each file's actual current content before writing the migration (referenced below, but re-verify — this plan may have been written against a slightly earlier read).
- Every real backend write must be additive: existing local Zustand behavior (`useConsultationStore`, `usePatientStore`, `useAdmissionStore`, `usePharmacyStore`, `useLabOrdersStore`, `useRadiologyStore`) keeps working exactly as it does today; a real write is attempted alongside it, wrapped in try/catch, and a failure never breaks the local UX.
- Use the PowerShell tool for all commands — this environment's Bash tool lacks most POSIX coreutils.
- Do not commit anything until the user says so — stage with `git add`, never `git commit`.
- Credentials already live in `.env.local` (gitignored).
- You are working in `e:\Gov-HIMS` on branch `feat/backend-supabase-integration` (or whatever branch is current when this plan executes — check `git branch --show-current` first).

---

### Task 1: `encounters` / `prescriptions` / `orders` tables + RLS migration

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_doctor_consultation_schema.sql` (use `npx --yes supabase migration new doctor_consultation_schema`)
- Test: `src/lib/supabase/__tests__/doctor-consultation-schema.test.ts`

**Interfaces:**
- Consumes: `visits`, `patients`, `profiles` (Phase 1/2).
- Produces: `encounters`, `prescriptions`, `orders` tables — Task 2 is unaffected (it's a new, separate table); the *existing* `src/lib/api/encounters.ts`/`prescriptions.ts`/`orders.ts` modules automatically start using these tables (via the hybrid `table()` transport) the moment this migration lands — no code change to those three files in this task.

**Before writing the migration, read the actual current schemas yourself** (do not trust the field lists below blindly — re-verify against the real files, since drift is possible):
- `src/lib/api/encounters.ts` — `EncounterSchema`
- `src/lib/api/prescriptions.ts` — `PrescriptionSchema` / `RxLineSchema` / `SafetyEnvelopeSchema`
- `src/lib/api/orders.ts` — `OrderSchema` / `OrderItemSchema`

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/doctor-consultation-schema.test.ts`:

```ts
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('doctor consultation schema', () => {
  it('encounters, prescriptions, orders tables exist with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      for (const [table, expectedCols] of [
        ['encounters', ['id', 'visit_id', 'patient_id', 'doctor_id', 'doctor_name', 'started_at', 'ended_at', 'kind', 'subjective', 'objective', 'assessment', 'plan', 'note_markdown', 'ai_pre_brief_accepted', 'signed_at']],
        ['prescriptions', ['id', 'encounter_id', 'visit_id', 'patient_id', 'doctor_id', 'doctor_name', 'signed_at', 'status', 'lines', 'safety', 'created_at', 'updated_at']],
        ['orders', ['id', 'visit_id', 'encounter_id', 'patient_id', 'doctor_id', 'doctor_name', 'kind', 'urgency', 'status', 'indication', 'items', 'modality', 'bench', 'sent_at', 'completed_at', 'created_at', 'updated_at']],
      ] as const) {
        const res = await client.query(
          `select column_name from information_schema.columns where table_name = $1`, [table]
        )
        const columns = res.rows.map((r) => r.column_name).sort()
        expect(columns, `table ${table}`).toEqual([...expectedCols].sort())
      }
    } finally {
      await client.end()
    }
  })
})
```

(If your own reading of the actual zod schemas turned up a different field list than shown above, use the REAL field list in both this test and the migration — the point of this test is "migration matches the real zod schema," not "migration matches this plan's guess.")

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- doctor-consultation-schema.test.ts`
Expected: FAIL — all three `columns` arrays are `[]`.

- [ ] **Step 3: Write the migration**

Run: `npx --yes supabase migration new doctor_consultation_schema`, then replace its contents. Use `text` for all id/timestamp-as-iso-string fields (matching the existing `visits`/`patients` convention where the zod schema stores ISO strings, not native Postgres timestamps, for `startedAt`/`signedAt`/etc. — check whether `visits.registered_at` used `timestamptz` or `text` in the Phase 1 migration and follow that same convention here for consistency). `lines` (prescriptions) and `items` (orders) are nested arrays of objects — use `jsonb`, matching the pattern already used for `lab_tests.analytes`/`radiology_studies.report_sections` if those exist, or simply because a nested array of typed objects is the natural `jsonb` case. `safety` (prescriptions) is a single nested object — also `jsonb`, nullable.

Structure (adapt exact types/nullability to match your Step-1 verified field list):

```sql
create type encounter_kind_t as enum ('SOAP', 'Progress', 'Discharge', 'Triage', 'OnlineConsult');

create table encounters (
  id                     text primary key,             -- 'ENC-...'
  visit_id               text not null references visits(id),
  patient_id             text not null references patients(id),
  doctor_id              uuid not null references profiles(id),
  doctor_name            text not null,
  started_at             timestamptz not null default now(),
  ended_at               timestamptz,
  kind                   encounter_kind_t not null default 'SOAP',
  subjective             text,
  objective              text,
  assessment             text,
  plan                   text,
  note_markdown          text,
  ai_pre_brief_accepted  boolean,
  signed_at              timestamptz
);
create index encounters_visit_idx on encounters(visit_id);
create index encounters_patient_idx on encounters(patient_id);
create index encounters_doctor_idx on encounters(doctor_id);

create type rx_line_status_t as enum ('draft', 'signed', 'dispensed', 'cancelled');
create type prescription_status_t as enum ('draft', 'signed', 'dispensing', 'dispensed', 'cancelled');

create table prescriptions (
  id            text primary key,                      -- 'RX-...'
  encounter_id  text references encounters(id),
  visit_id      text references visits(id),
  patient_id    text not null references patients(id),
  doctor_id     uuid not null references profiles(id),
  doctor_name   text not null,
  signed_at     timestamptz,
  status        prescription_status_t not null default 'draft',
  lines         jsonb not null default '[]',    -- RxLineSchema[]
  safety        jsonb,                          -- SafetyEnvelopeSchema | null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index prescriptions_patient_idx on prescriptions(patient_id);
create index prescriptions_doctor_idx on prescriptions(doctor_id);
create index prescriptions_visit_idx on prescriptions(visit_id);

create type order_kind_t as enum ('lab', 'radiology', 'drug', 'procedure', 'referral');
create type order_urgency_t as enum ('routine', 'urgent', 'stat');
create type order_status_t as enum
  ('draft', 'sent', 'received', 'collecting', 'in_progress', 'reported', 'verified', 'released', 'cancelled');

create table orders (
  id            text primary key,                      -- 'ORD-...'
  visit_id      text references visits(id),
  encounter_id  text references encounters(id),
  patient_id    text not null references patients(id),
  doctor_id     uuid not null references profiles(id),
  doctor_name   text,
  kind          order_kind_t not null,
  urgency       order_urgency_t not null default 'routine',
  status        order_status_t not null default 'draft',
  indication    text,
  items         jsonb not null default '[]',    -- OrderItemSchema[]
  modality      text,
  bench         text,
  sent_at       timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index orders_patient_idx on orders(patient_id);
create index orders_doctor_idx on orders(doctor_id);
create index orders_visit_idx on orders(visit_id);
create index orders_active_idx on orders(kind, status) where status not in ('released', 'cancelled');

alter table encounters enable row level security;
alter table prescriptions enable row level security;
alter table orders enable row level security;

-- Doctor: full access to their own encounters/prescriptions/orders.
create policy encounters_all_doctor on encounters for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy prescriptions_all_doctor on prescriptions for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy orders_all_doctor on orders for all
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());

-- Reception/admin: read-only oversight across all three (continuity of care, no write access here).
create policy encounters_select_staff on encounters for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));
create policy prescriptions_select_staff on prescriptions for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));
create policy orders_select_staff on orders for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('reception','admin')));
```

**Explicitly deferred, do not add in this task:** lab/radiology role read/update access on `orders` (that's the Lab/Radiology phase's own trigger, per the established "add RLS when the actual worklist query needs it" pattern), pharmacy role read access on `prescriptions` (Pharmacy phase's trigger), patient-self read access on any of these three (Patient Journey phase's trigger).

- [ ] **Step 4: Apply the migration**

Run (PowerShell, set `$env:DATABASE_URL` from `.env.local` first):
```powershell
npx --yes supabase db push --db-url $env:DATABASE_URL --include-all --yes
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- doctor-consultation-schema.test.ts`
Expected: `1 passed`.

- [ ] **Step 6: Confirm the pre-existing modules now go to Supabase automatically**

Write a quick throwaway check (not a permanent test file — a scratch script, deleted after use) that calls `Encounters.create({...minimal valid fields...})` with a real signed-in doctor session and confirms the row appears in Postgres via the admin client. This proves the hybrid `table()` transport picked up the new table with zero code changes, which is the whole point of this task's architecture. Delete the scratch script after confirming; do not leave it in the repo.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: every test file passes, 0 failures.

- [ ] **Step 8: Stage (do not commit)**

```powershell
git add supabase/migrations/ src/lib/supabase/__tests__/doctor-consultation-schema.test.ts
```

---

### Task 2: `admission-requests.ts` repository module + RLS

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_admission_requests.sql` (new migration, separate from Task 1's)
- Create: `src/lib/api/admission-requests.ts`
- Modify: `src/lib/api/index.ts` (export it)
- Test: `src/lib/api/__tests__/admission-requests.test.ts`

**Interfaces:**
- Consumes: `table`, `id`, `isoNow` from `_core.ts`; `visits`/`patients`/`profiles`.
- Produces: `AdmissionRequests.{create, byPatient, byStatus}`, `AdmissionRequestSchema`, `AdmissionRequest` type. Task 6 (below) calls `AdmissionRequests.create(...)`.

**Before writing the schema, read `src/store/useAdmissionStore.ts`'s `AdmissionRequest` type** (the client-side shape this mirrors) to get the real field list — do not invent fields not already established there. At minimum it needs: `id`, `patientId`, `visitId` (new — the local store doesn't have this since it predates Phase 2's real visits, but the backend row needs it to link back), `doctorId`, `diagnosis`, `admissionType`, `bedTypePreference`, `reason`, `department`, `triageLevel`, `payerType`, `status`, `requestedAt`. Leave out the local store's `bundle` field (prescriptions/labOrders/radiologyOrders snapshot) for this phase — that's a denormalized convenience the local store keeps for its own UI; the backend already has this data in real `prescriptions`/`orders` rows linked by `visit_id`, so duplicating it isn't needed (YAGNI).

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/__tests__/admission-requests.test.ts` — follow the exact pattern established in `src/lib/api/__tests__/appointments.test.ts` (Phase 1): a `beforeAll` that creates a real doctor + reception staff session as needed (reception/admin create the patient+visit fixture per the established RLS, doctor creates the admission request), a test asserting `AdmissionRequests.create(...)` returns a saved row with `status: 'requested'`, and a `byPatient`/`byStatus` test. Full cleanup in `afterAll`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- admission-requests.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the migration**

```sql
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
```

Doctors get insert + select-own only (no update — bed assignment/status changes are reception/admin's job in the future Admin/Admission phase, not this one; explicitly no update policy for anyone yet, matching the "add the transition when the phase that needs it arrives" discipline).

- [ ] **Step 4: Apply the migration**

```powershell
npx --yes supabase db push --db-url $env:DATABASE_URL --include-all --yes
```

- [ ] **Step 5: Implement `admission-requests.ts`**

Follow the exact module shape of `src/lib/api/appointments.ts` (Phase 1) — `AdmissionRequestSchema` (zod, camelCase, matching Step 3's columns), `table<AdmissionRequest>('admission_requests', AdmissionRequestSchema)`, and an `AdmissionRequests` object with `create`, `byPatient`, `byStatus`. `create`'s audit action: reuse `'admission_admit'` if that's already a valid `AuditAction` value in this codebase (check `useAuditStore.ts`'s action-code list), otherwise pick the closest existing code rather than inventing a new one this phase doesn't own end-to-end.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- admission-requests.test.ts`
Expected: passes.

- [ ] **Step 7: Export from the public API surface**

Add to `src/lib/api/index.ts`, alphabetically: `export { AdmissionRequests, AdmissionRequestSchema } from './admission-requests'`.

- [ ] **Step 8: Run the full suite, stage**

```powershell
npm test
git add supabase/migrations/ src/lib/api/admission-requests.ts src/lib/api/index.ts src/lib/api/__tests__/admission-requests.test.ts
```

---

### Task 3: Bridge lab/radiology order dispatch to real `Orders.create()`

**Files:**
- Modify: `src/app/doctor/dashboard/page.tsx` — `dispatchLabOrder` and `dispatchRadOrder` functions
- Test: a Vitest test is impractical for a page component with no test harness (see Phase 2 Task 5's precedent — no RTL/jsdom in this project); verify via the same throwaway-script API-level technique Phase 2 used, PLUS a direct unit-style test against `Orders.create` itself proving the shape you pass in round-trips correctly (that part doesn't need a browser).

**Interfaces:**
- Consumes: `Orders` from `@/lib/api` (this task), `getSupabaseClient` (Phase 1), `currentPatient.visitId` (Phase 2's `Patient` type addition).
- Produces: nothing new exported — additive behavior only.

**Read the actual current `dispatchLabOrder`/`dispatchRadOrder` in `src/app/doctor/dashboard/page.tsx` first** (shown in this plan's research phase, but re-verify — the file may have changed). Both already call `recordStat` and push into `useLabOrdersStore`/`useRadiologyStore` immediately. Add, after those existing calls (don't disturb them), the same guarded pattern as Phase 2:

```ts
const { data: { session } } = await getSupabaseClient().auth.getSession()
if (session && currentPatient?.visitId) {
  try {
    const { Orders } = await import('@/lib/api')
    await Orders.create({
      visitId: currentPatient.visitId,
      patientId: currentPatient.id,
      doctorId: session.user.id,
      doctorName: currentPatient.doctor,
      kind: 'lab',                 // or 'radiology' in dispatchRadOrder
      urgency: /* map from the local priority value — check exact local type first */,
      indication: undefined,
      items: [{ id: `OI-${Date.now()}`, name: testName, qty: 1 }],
      bench: /* only for lab, if resolvable from LAB_CATALOG */,
    } as Parameters<typeof Orders.create>[0])
  } catch (err) {
    console.error('[doctor/dashboard] real lab/radiology order write failed:', err)
  }
}
```

Map the local `priority: 'Routine' | 'Urgent'` (check the exact local type) to `OrderUrgency` (`'routine' | 'urgent' | 'stat'`) — read both types yourself rather than assuming; there is no `'stat'` equivalent locally, so it should never be selected from this mapping (that's fine, `'stat'` remains reachable only via direct backend calls in a future phase if ever needed).

- [ ] **Step 1: Read current code, confirm exact local types (`priority`, `LAB_CATALOG` shape) before writing the bridge**
- [ ] **Step 2: Implement the guarded bridge in both `dispatchLabOrder` and `dispatchRadOrder`**
- [ ] **Step 3: Verify via a throwaway script**: real doctor session, real patient+visit (via Reception's real flow or direct fixture), call the bridge logic's equivalent directly against `Orders.create`, confirm a real row lands in Postgres with `kind: 'lab'`/`'radiology'` and the right `visit_id`. Delete the script after.
- [ ] **Step 4: Run the full suite, confirm no regressions, `tsc --noEmit` clean**
- [ ] **Step 5: Stage** (`git add src/app/doctor/dashboard/page.tsx`)

---

### Task 4: Bridge "Send to Pharmacy" to real `Prescriptions.draft()` + `sign()`

**Files:**
- Modify: `src/app/doctor/dashboard/page.tsx` — `sendRx` function

**Interfaces:**
- Consumes: `Prescriptions` from `@/lib/api`, live session, `currentPatient.visitId`.

`sendRx` (shown in research) already builds a `PharmacyPrescription`-shaped object and calls `addToPharmacy`/`sendToPharmacy`/`recordStat`. After those, add the guarded bridge:

```ts
const { data: { session } } = await getSupabaseClient().auth.getSession()
if (session && currentPatient?.visitId) {
  try {
    const { Prescriptions } = await import('@/lib/api')
    const rx = await Prescriptions.draft({
      visitId: currentPatient.visitId,
      patientId: currentPatient.id,
      doctorId: session.user.id,
      doctorName: currentPatient.doctor,
      lines: prescriptions.map((p, i) => ({
        id: `RL-${i}`, drugName: p.medicine, dose: p.dosage,
        days: /* parse from p.duration if it's a "N days" string, else default */ 5,
        quantity: 0, instructions: p.instructions, status: 'draft' as const,
      })),
    } as Parameters<typeof Prescriptions.draft>[0])
    await Prescriptions.sign(rx.id, {
      allergyChecked: true, interactionChecked: true, doseChecked: true, narcoticChecked: false, flags: [],
    })
  } catch (err) {
    console.error('[doctor/dashboard] real prescription write failed:', err)
  }
}
```

The `SafetyEnvelopeSchema` values are hardcoded `true`/appropriate defaults here because the local `useConsultationStore`'s `Prescription` type (per the research) has no safety-check fields at all today — this bridge cannot fabricate real safety-check provenance that doesn't exist client-side. **Flag this explicitly in your task report as a known simplification**: a future phase that wires real prescribing safety checks (drug interaction/allergy checking against `useDrugMasterStore`) should replace these hardcoded `true` values with the real check results once that UI exists. Do not silently ship this as if it were meaningfully verified — say so in the code with a comment and in your report.

- [ ] **Step 1: Read current `sendRx`, confirm exact local `Prescription`/duration-string shape**
- [ ] **Step 2: Implement the guarded bridge**, with the safety-envelope simplification clearly commented
- [ ] **Step 3: Verify via a throwaway script** against a real doctor session + real visit, confirm a real `prescriptions` row lands with `status: 'signed'` and the right `lines`
- [ ] **Step 4: Run the full suite, `tsc --noEmit` clean**
- [ ] **Step 5: Stage**

---

### Task 5: Bridge "Complete Consultation" to a real `Encounters` record

**Files:**
- Modify: `src/app/doctor/dashboard/page.tsx` — `completeConsult` function

**Interfaces:**
- Consumes: `Encounters` from `@/lib/api`.

`completeConsult` (shown in research) calls `recordStat`, `addVisit` (local), then branches (online / staged-admission / pharmacy-or-billing) before `resetConsultation()`. Add the guarded bridge right after the existing `recordStat`/`addVisit` calls, before the branch (so it runs on every path, online included):

```ts
const { data: { session } } = await getSupabaseClient().auth.getSession()
if (session && currentPatient?.visitId) {
  try {
    const { Encounters } = await import('@/lib/api')
    const enc = await Encounters.create({
      visitId: currentPatient.visitId,
      patientId: currentPatient.id,
      doctorId: session.user.id,
      doctorName: currentPatient.doctor,
      kind: isOnlineConsult ? 'OnlineConsult' : 'SOAP',
      assessment: diagnosis.trim() || undefined,
      plan: notes.trim() || undefined,
      aiPreBriefAccepted: /* check if this info is available in local state, e.g. from the AiPreBrief component's own state — if not accessible here, omit */,
    } as Parameters<typeof Encounters.create>[0])
    await Encounters.sign(enc.id)
  } catch (err) {
    console.error('[doctor/dashboard] real encounter write failed:', err)
  }
}
```

Note the field mapping: local `diagnosis` → backend `assessment` (the closest SOAP-note field per the research's identified gap — there is no dedicated `diagnosis` column, `assessment` is the established clinical-note field for it), local `notes` → backend `plan`. This is a real, deliberate simplification (the research noted the local store keeps `diagnosis`/`notes` as two separate free-text concepts that don't cleanly split into SOAP's four fields) — document it with a code comment, and flag it in your report so a future phase can revisit whether `notes` should instead split across `subjective`/`objective` if the UI ever separates those concerns.

- [ ] **Step 1: Read current `completeConsult`, confirm exact field availability (`aiPreBriefAccepted` source, if any)**
- [ ] **Step 2: Implement the guarded bridge**, documenting the diagnosis→assessment / notes→plan mapping decision inline
- [ ] **Step 3: Verify via a throwaway script**: real doctor session + real visit, confirm a real `encounters` row lands with `signed_at` set
- [ ] **Step 4: Run the full suite, `tsc --noEmit` clean**
- [ ] **Step 5: Stage**

---

### Task 6: Bridge "Send Admission" to a real `admission_requests` row

**Files:**
- Modify: `src/app/doctor/dashboard/page.tsx` — `handleSendAdmission` function (and the equivalent auto-staged branch inside `completeConsult`, Task 5's function, if not already covered by making this a shared helper — read both call sites before deciding whether to extract a small shared function or duplicate the ~10-line guarded block; prefer extracting if it avoids real duplication, per the codebase's existing conventions)

**Interfaces:**
- Consumes: `AdmissionRequests` from `@/lib/api` (Task 2).

`handleSendAdmission` (shown in research) already calls `setAdmissionOrder`, `requestAdmission` (local `useAdmissionStore`), `markAdmissionSent`, `recordStat`. Add the guarded bridge:

```ts
const { data: { session } } = await getSupabaseClient().auth.getSession()
if (session && currentPatient?.visitId) {
  try {
    const { AdmissionRequests } = await import('@/lib/api')
    await AdmissionRequests.create({
      visitId: currentPatient.visitId,
      patientId: currentPatient.id,
      doctorId: session.user.id,
      diagnosis,
      admissionType: admType,
      bedTypePreference: admType,
      reason: admReason,
      department: currentPatient.department,
      triageLevel: currentPatient.triageLevel,
      payerType: 'General',
    } as Parameters<typeof AdmissionRequests.create>[0])
  } catch (err) {
    console.error('[doctor/dashboard] real admission request write failed:', err)
  }
}
```

The `completeConsult` auto-staged admission branch (when `admissionOrder && !admissionOrder.sent`) performs the same local `requestAdmission` call with the same field shape — apply the identical guarded bridge there too, so a staged (order-set-triggered) admission is persisted just as reliably as an explicit "Send Admission" button click.

- [ ] **Step 1: Read both current call sites, decide extract-vs-duplicate**
- [ ] **Step 2: Implement the guarded bridge in both places**
- [ ] **Step 3: Verify via a throwaway script**: real doctor session + real visit, confirm a real `admission_requests` row lands with `status: 'requested'`
- [ ] **Step 4: Run the full suite, `tsc --noEmit` clean**
- [ ] **Step 5: Stage**

---

## What this plan deliberately does not do

- **No bed assignment / IPD charting / discharge** — that's a separate, later "OPD/IPD" phase per the user's own module breakdown; this phase only creates the admission *request*, matching "basic admission" scope as confirmed.
- **No lab/radiology/pharmacy portal wiring** — `orders`/`prescriptions` rows now exist for those portals to consume, but their own RLS read/update access and UI wiring is each their own future phase's trigger, per the established pattern.
- **No real drug-safety checking** — the `SafetyEnvelopeSchema` values sent in Task 4 are hardcoded placeholders, explicitly flagged as a simplification, not a real safety verification.
- **No `/doctor/consultation` (the simpler, second doctor page) wiring** — out of scope per your own choice; it stays exactly as it is today.
- **No changes to `encounters.ts`/`prescriptions.ts`/`orders.ts` themselves** — Task 1's migration alone makes them Supabase-backed via the existing hybrid transport.

## Next step after this plan ships

Laboratory (sample collection, test progress, results — the `orders` table this phase creates, filtered to `kind='lab'`, is what a Lab portal phase will consume and add its own RLS/status-transition policies for), then Radiology, Pharmacy, and finally OPD/IPD (admission fulfillment, bed allocation, discharge).
