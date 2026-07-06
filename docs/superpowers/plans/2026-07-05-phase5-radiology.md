# Phase 5 — Radiology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full rich radiology workflow — scheduling, arrival, acquisition, structured reporting, verification/release, critical-result callback/escalation, and result distribution — persist to Postgres end-to-end, with the doctor's real `orders` table (Phase 3) as the single source of truth for what was ordered, exactly as Phase 4 did for Laboratory.

**Architecture:** `src/store/useRadiologyStudiesStore.ts` (677 lines) is the existing, fully-built, localStorage-backed rich client model — one `RadiologyStudy` per order, with 27 actions covering the full ordered → scheduled → arrived → acquiring → acquired → reading → reported → verified → released lifecycle plus enterprise-RIS extensions (dose tracking, AI findings, escalation, distribution). This phase adds one new Postgres table (`radiology_studies`) shaped to mirror that model exactly (not the orphaned, zero-import `src/lib/api/radiology.ts`'s `RadStudySchema`, which stays untouched and unrelated), a new repository module, and additive guarded bridges into the store's existing actions — following the exact pattern proven across Phases 2-4.

**Tech Stack:** Same as prior phases — Next.js App Router, TypeScript, Supabase/Postgres, Zustand, Zod, Vitest (against the real live Supabase project, no mocks).

## Global Constraints

- **Guard pattern, no exceptions**: every real write is gated by a *live* session check — `const { data: { session } } = await getSupabaseClient().auth.getSession(); if (!session) return;` — never `useAuthStore` (a persisted "logged in" flag survives across restarts even after the real session has expired). Use the existing `withLiveSession` helper (`src/app/doctor/dashboard/page.tsx`, lines 229-241) for the one call site living in that file (Task 3); every other bridge lives inside `src/store/useRadiologyStudiesStore.ts`, where the guard is written inline exactly as `useLabOrdersStore.ts` does it (snapshot-before-`set()`, live-session check, dynamic `import('@/lib/api')`, try/catch-log, silent skip).
- **Actor-identity integrity**: any field recording "who did this" (`acquiringBy`, `readingBy`, `verifiedBy`, `residentReadBy`) must be derived server-side from the live session + a `profiles.full_name` lookup via a new `resolveRealRadActor(benchHint?)`-equivalent helper (Task 5), mirroring `useLabOrdersStore.ts`'s `resolveRealActor` line-for-line. It is **never** sourced from the local `RadTech` parameter a UI action passes in (`RAD_RAVI`/`RAD_BABITA`/`RAD_DRKHAN`/`RAD_DRGUPTA` are local-only demo roster constants, not necessarily real `profiles.id` uuids — mirroring them into the real row would let any caller impersonate any tech/radiologist, poisoning the audit trail).
- **`realId` backreference pattern**: `RadiologyStudy` gets a new optional `realId?: string` field (Task 3), stamped once a real `radiology_studies` row exists for that local study. Every bridge checks `if (!realId) return` (silent skip, never throw) before attempting any real write — this lets pre-existing seed data (`RS-101`..`RS-113`) and any demo-created study with no live session coexist safely with real records.
- **Hybrid transport**: new repository methods use `src/lib/api/_core.ts`'s `table<T>()` (Supabase-backed, falls back to localStorage on `PGRST205`) and its `insert()` method (insert-only — required wherever RLS grants INSERT but not a column-set broad enough for `put()`'s `ON CONFLICT DO UPDATE`, exactly like `LabTests`/`LabSpecimens`/`LabReflexSuggestions`).
- **No consecutive-capital-letter TS field names.** `_core.ts`'s `toSnakeCase`/`toCamelCase` do naive per-character conversion (`key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)`), so `expectedTATmin` (the store's actual spelling) would mangle to `expected_t_a_tmin`. Every new Zod schema field in this phase spells it `expectedTatMin`, exactly matching `lab-tests.ts`'s precedent — a store-to-repo mapping layer (in the bridge code, never inside the schema) is where the two spellings meet.
- **RLS is verified against the LIVE Supabase project, never assumed.** Phase 4 found two real gaps this way (doctor INSERT missing entirely on `lab_specimens`/`lab_tests`; then a too-loose `WITH CHECK` that let a doctor fabricate an already-released row at insert time). This plan applies that lesson proactively in Task 3 (the doctor-INSERT policy is written tightened from the start), but every task must still run its verification step against the real project rather than assume the policy is correct on paper.
- **Every task runs both `npm test` (Vitest, against the real live Supabase project, no mocks) AND `npx tsc --noEmit`.** A past task once shipped 13 unnoticed type errors by skipping the `tsc` check.
- Use PowerShell for all commands. Do not commit until told to (`git add` only). Credentials in `.env.local`. Branch `docs/backend-architecture-design` is the current branch per `git status` — confirm with `git branch --show-current` before starting; if Phase 4's work landed on a differently-named feature branch, continue there instead.
- **Before writing any task's code, read the actual current file** — this plan was written from a research pass; prior phases repeatedly found real drift between research snapshots and actual files by execution time.
- **Verification scripts are throwaway.** Every task that needs to prove a real Postgres row was written (not just that the local Zustand state changed) writes a `src/store/__tests__/_throwaway-taskN-verify.test.ts` (or `src/lib/api/__tests__/_throwaway-taskN-verify.test.ts` for Task 2/3), runs it, confirms the assertions, then **deletes it** — confirmed absent from `git status` afterward. Only Task 1's schema test and Task 2's repository-module tests are committed.

---

### Task 1: `radiology_studies` schema + RLS

**Files:**
- Create: `supabase/migrations/20260705030000_radiology_schema.sql`
- Test: `src/lib/supabase/__tests__/radiology-schema.test.ts`

**Design decision — single table, jsonb for every nested/compound shape (no child table).** Unlike Lab, where a specimen and its tests are genuinely separate real-world objects with independent lifecycles and, at points, different actors (a phlebotomist collects a specimen; a bench tech claims a test off it), a `RadiologyStudy` is **one order = one study = one row** for the whole ordered→released lifecycle. `attachments`, `reportSections`, `aiFindings`, `doseRecord`, `qualityFlags`, `escalation`, `distribution`, `callback`, and the `RadTech` actor fields (`acquiringBy`/`readingBy`/`verifiedBy`/`residentReadBy`) are all modeled as `jsonb` columns on the one table — mirroring Lab's own precedent for `analytes`/`micro`/`callback`. No RLS or insert-by-a-different-actor need was found for any of these nested shapes (an attachment is appended by whichever tech is currently acquiring or reading the *same* study, under the *same* `radiology`-role RLS policy as every other write to that row) — so a child table would add join complexity with no real segregation-of-duties or independent-access benefit. This mirrors exactly how Phase 4 Task 1 reasoned about `TestRun.assignedTo`/`enteredBy`/`verifiedBy`.

**Before writing the migration, re-read `src/store/useRadiologyStudiesStore.ts` in full** (already researched below, but re-verify against the live file) for the exact current shape of `RadiologyStudy`, `StudyStatus`, `RadSource`, `PaymentMode`, `RadTech`, `Attachment`, `AiFinding`, `DoseRecord`, `QualityFlags`, `DistributionEntry`, `Escalation`, `VerificationLevel`, and `src/lib/radiologyCatalog.ts` for `Modality`, `Priority`.

- [ ] **Step 1: Write the failing test**

`src/lib/supabase/__tests__/radiology-schema.test.ts`:

```ts
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('radiology schema', () => {
  it('radiology_studies table exists with expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const expectedCols = [
        'id', 'order_id', 'patient_id', 'patient_name', 'source', 'ward_bed',
        'doctor_name', 'payment_mode', 'clinical_question', 'code', 'name',
        'modality', 'body_part', 'priority', 'contrast_consented', 'status',
        'scheduled_for', 'arrived_at', 'acquiring_by', 'acquired_at',
        'attachments', 'reading_by', 'report_sections', 'ai_prelim',
        'reported_at', 'verified_by', 'verified_at', 'released_at', 'callback',
        'expected_tat_min', 'ordered_at', 'acknowledged_at', 'cancel_reason',
        'no_show_risk', 'predicted_duration_min', 'dose_record', 'ai_findings',
        'quality_flags', 'verification_level', 'resident_read_by', 'escalation',
        'distribution', 'comparison_prior_id', 'updated_at',
      ]
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = $1`, ['radiology_studies']
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

Run: `npx vitest run src/lib/supabase/__tests__/radiology-schema.test.ts`
Expected: FAIL — `AssertionError: expected [] to deeply equal [ Array(42) ]` (table doesn't exist yet).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260705030000_radiology_schema.sql`:

```sql
-- Radiology schema: radiology_studies — Phase 5, Task 1.
--
-- Field list verified directly against the live client store:
-- src/store/useRadiologyStudiesStore.ts (RadiologyStudy, StudyStatus, RadSource,
-- PaymentMode, RadTech, Attachment, AiFinding, DoseRecord, QualityFlags,
-- DistributionEntry, Escalation, VerificationLevel) and src/lib/radiologyCatalog.ts
-- (Modality, Priority).
--
-- Design decision — single table, jsonb for every nested/compound shape (mirrors
-- Lab Task 1's precedent for analytes/micro/callback): attachments, reportSections,
-- aiFindings, doseRecord, qualityFlags, escalation, distribution, callback, and the
-- RadTech actor fields (acquiringBy/readingBy/verifiedBy/residentReadBy) are ALL
-- jsonb. No child table: unlike Lab's specimen/test split (genuinely separate
-- real-world objects with independent lifecycles and, at points, different
-- actors), a RadiologyStudy is one order = one study = one row throughout its
-- whole lifecycle, and every nested shape here is written by the same
-- radiology-role actor set under the same RLS policy — no distinct access-control
-- need was found for any of them.
--
-- expected_tat_min (not the store's `expectedTATmin` spelling) for the same
-- reason as Lab's lab_tests.expected_tat_min/expectedTatMin: _core.ts's naive
-- per-character camelCase<->snake_case conversion would mangle `expectedTATmin`
-- into `expected_t_a_tmin`.

create type rad_source_t as enum ('OPD', 'IPD', 'ICU', 'OT', 'ER');
create type rad_payment_mode_t as enum ('Cash', 'UPI', 'Card', 'Insurance', 'Credit');
create type rad_study_status_t as enum (
  'ordered', 'scheduled', 'arrived', 'acquiring', 'acquired',
  'reading', 'reported', 'verified', 'released', 'cancelled'
);
create type rad_modality_t as enum ('XR', 'CT', 'MRI', 'US', 'MAMMO', 'NM');
create type rad_priority_t as enum ('Routine', 'Urgent', 'STAT', 'Trauma', 'Stroke', 'Critical');
create type rad_verification_level_t as enum ('resident', 'consultant');

create table radiology_studies (
  id                     text primary key,               -- 'RS-...'
  order_id               text not null references orders(id),
  patient_id             text not null,
  patient_name           text not null,
  source                 rad_source_t not null,
  ward_bed               text,
  doctor_name            text not null,
  payment_mode           rad_payment_mode_t not null,
  clinical_question      text,
  code                   text not null,
  name                   text not null,
  modality               rad_modality_t not null,
  body_part              text not null,
  priority               rad_priority_t not null default 'Routine',
  contrast_consented     boolean,
  status                 rad_study_status_t not null default 'ordered',
  scheduled_for          timestamptz,
  arrived_at             timestamptz,
  acquiring_by           jsonb,                          -- RadTech {id, name} | null
  acquired_at            timestamptz,
  attachments            jsonb not null default '[]',    -- Attachment[]
  reading_by             jsonb,                          -- RadTech | null
  report_sections        jsonb not null default '{}',    -- Record<string, string>
  ai_prelim              text,
  reported_at            timestamptz,
  verified_by            jsonb,                          -- RadTech | null
  verified_at            timestamptz,
  released_at            timestamptz,
  callback               jsonb,                          -- {calledBy, calledAt, recipient} | null
  expected_tat_min       integer not null default 60,
  ordered_at             timestamptz not null default now(),
  acknowledged_at        timestamptz,
  cancel_reason          text,
  no_show_risk           numeric,
  predicted_duration_min integer,
  dose_record            jsonb,                          -- DoseRecord | null
  ai_findings            jsonb,                          -- AiFinding[] | null
  quality_flags          jsonb,                          -- QualityFlags | null
  verification_level     rad_verification_level_t,
  resident_read_by       jsonb,                          -- RadTech | null
  escalation             jsonb,                          -- Escalation | null
  distribution           jsonb,                          -- DistributionEntry[] | null
  comparison_prior_id    text,
  updated_at             timestamptz not null default now()
);
create index radiology_studies_order_idx on radiology_studies(order_id);
create index radiology_studies_active_idx on radiology_studies(status)
  where status not in ('released', 'cancelled');

alter table radiology_studies enable row level security;

-- Radiology role: full read/write (any radiology staff member may need to act on
-- any study at any lifecycle stage — schedule, acquire, read, verify — per the
-- existing store's own design, mirroring Lab's cross-bench reasoning).
create policy radiology_studies_all_radiology on radiology_studies for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('radiology', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('radiology', 'admin')));

-- Doctor: read-only, own patients' studies (via the orders table they own).
create policy radiology_studies_select_doctor on radiology_studies for select
  using (exists (select 1 from orders o where o.id = radiology_studies.order_id and o.doctor_id = auth.uid()));

-- Explicitly deferred (out of scope for this task): doctor INSERT access (Task 3
-- adds this once the order-rewire bridge needs it, mirroring Lab Task 3's
-- discovery), reception/admin oversight reads, patient-self read access — none
-- of these are exercised by the current store.
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db push --db-url "$env:DATABASE_URL" --include-all --yes`
Expected: applies cleanly, no errors.

- [ ] **Step 5: Run the schema test again, confirm it passes**

Run: `npx vitest run src/lib/supabase/__tests__/radiology-schema.test.ts`
Expected: `Test Files 1 passed (1)` / `Tests 1 passed (1)`.

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — expect all prior tests still passing plus this new one, zero regressions.
Run: `npx tsc --noEmit` — expect clean, no output.

```bash
git add supabase/migrations/20260705030000_radiology_schema.sql src/lib/supabase/__tests__/radiology-schema.test.ts
```

---

### Task 2: `RadiologyStudies` repository module

**Files:**
- Create: `src/lib/api/radiology-studies.ts`
- Modify: `src/lib/api/index.ts`
- Test: `src/lib/api/__tests__/radiology-studies.test.ts`

**Interfaces:**
- Consumes: `table<T>`, `id as newId`, `isoNow`, `audit` from `./_core` (same as every other module).
- Produces: `RadiologyStudies` object (methods listed below) and `RadiologyStudySchema`/`RadTechSchema`/`RadAttachmentSchema`/etc. Zod schemas, all consumed by Tasks 3-8's store bridges.

- [ ] **Step 1: Write the repository module**

`src/lib/api/radiology-studies.ts`:

```ts
/* RadiologyStudies — one row per ordered study, covering the full
 * ordered -> scheduled -> arrived -> acquiring -> acquired -> reading ->
 * reported -> verified -> released lifecycle plus enterprise-RIS extensions
 * (dose tracking, AI findings, escalation, distribution). Mirrors
 * `RadiologyStudy` in src/store/useRadiologyStudiesStore.ts and the
 * `radiology_studies` table in supabase/migrations/20260705030000_radiology_schema.sql.
 *
 * IMPORTANT — actor identity (read before wiring a UI bridge to this module):
 * `acquiringBy`/`readingBy`/`verifiedBy`/`residentReadBy` are jsonb RadTech
 * objects ({id, name}), NOT profiles FKs — the local radiology roster
 * (RAD_RAVI, RAD_BABITA, RAD_DRKHAN, RAD_DRGUPTA) isn't backed by
 * Supabase-authenticated users. Every method below that records who performed
 * an action takes that identity as an explicit `actor: RadTech` parameter —
 * never folded into a generic partial-update object.
 *
 * This module does NOT and CANNOT verify `actor` is truthful — it is a dumb
 * persistence layer, same as every other src/lib/api/* module. Enforcing
 * "actor must be the real signed-in user" is the CALLER's job: the store
 * bridges (Phase 5 Tasks 5-8) MUST source `actor` from a live
 * `getSupabaseClient().auth.getSession()` + a `profiles` lookup, never from
 * the local Zustand/UI-selected `RadTech` the store already carries. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const RadSource = z.enum(['OPD', 'IPD', 'ICU', 'OT', 'ER'])
export const RadPaymentMode = z.enum(['Cash', 'UPI', 'Card', 'Insurance', 'Credit'])
export const RadStudyStatus = z.enum([
  'ordered', 'scheduled', 'arrived', 'acquiring', 'acquired',
  'reading', 'reported', 'verified', 'released', 'cancelled',
])
export const RadModality = z.enum(['XR', 'CT', 'MRI', 'US', 'MAMMO', 'NM'])
export const RadPriority = z.enum(['Routine', 'Urgent', 'STAT', 'Trauma', 'Stroke', 'Critical'])
export const RadVerificationLevel = z.enum(['resident', 'consultant'])
export const RadNotificationChannel = z.enum(['in_app', 'sms', 'push', 'whatsapp', 'email'])

// A radiology-roster actor — a real signed-in tech/radiologist. See the
// module-level note above: callers must source this from a live session.
export const RadTechSchema = z.object({ id: z.string(), name: z.string() })
export type RadTech = z.infer<typeof RadTechSchema>

export const RadAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  url: z.string().optional(),
  caption: z.string().optional(),
  uploadedBy: z.string(),
  uploadedAt: z.string(),
})
export type RadAttachment = z.infer<typeof RadAttachmentSchema>

export const RadAiFindingSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(['normal', 'actionable', 'critical']),
  confidence: z.number(),
  heatmap: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
  birads: z.string().optional(),
  lungrads: z.string().optional(),
  pirads: z.string().optional(),
})
export type RadAiFinding = z.infer<typeof RadAiFindingSchema>

export const RadDoseRecordSchema = z.object({
  dlp: z.number().optional(),
  ctdi: z.number().optional(),
  mas: z.number().optional(),
  kv: z.number().optional(),
  recordedBy: z.string().optional(),
  recordedAt: z.string().optional(),
})
export type RadDoseRecord = z.infer<typeof RadDoseRecordSchema>

export const RadQualityFlagsSchema = z.object({
  motion: z.boolean().optional(),
  incompleteCoverage: z.boolean().optional(),
  note: z.string().optional(),
  assessedAt: z.string().optional(),
})
export type RadQualityFlags = z.infer<typeof RadQualityFlagsSchema>

export const RadDistributionEntrySchema = z.object({
  channel: RadNotificationChannel,
  to: z.string(),
  sentAt: z.string(),
  label: z.string().optional(),
})
export type RadDistributionEntry = z.infer<typeof RadDistributionEntrySchema>

export const RadEscalationSchema = z.object({
  startedAt: z.string(),
  level: z.number(),
  acknowledgedAt: z.string().optional(),
  acknowledgedBy: z.string().optional(),
})
export type RadEscalation = z.infer<typeof RadEscalationSchema>

export const RadCallbackSchema = z.object({
  calledBy: z.string(),
  calledAt: z.string(),
  recipient: z.string(),
})
export type RadCallback = z.infer<typeof RadCallbackSchema>

export const RadiologyStudySchema = z.object({
  id: z.string(),                    // 'RS-...'
  orderId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  source: RadSource,
  wardBed: z.string().optional(),
  doctorName: z.string(),
  paymentMode: RadPaymentMode,
  clinicalQuestion: z.string().optional(),
  code: z.string(),
  name: z.string(),
  modality: RadModality,
  bodyPart: z.string(),
  priority: RadPriority.default('Routine'),
  contrastConsented: z.boolean().optional(),
  status: RadStudyStatus.default('ordered'),
  scheduledFor: z.string().optional(),
  arrivedAt: z.string().optional(),
  acquiringBy: RadTechSchema.optional(),
  acquiredAt: z.string().optional(),
  attachments: z.array(RadAttachmentSchema).default([]),
  readingBy: RadTechSchema.optional(),
  reportSections: z.record(z.string(), z.string()).default({}),
  aiPrelim: z.string().optional(),
  reportedAt: z.string().optional(),
  verifiedBy: RadTechSchema.optional(),
  verifiedAt: z.string().optional(),
  releasedAt: z.string().optional(),
  callback: RadCallbackSchema.optional(),
  expectedTatMin: z.number().int().default(60),
  orderedAt: z.string(),
  acknowledgedAt: z.string().optional(),
  cancelReason: z.string().optional(),
  noShowRisk: z.number().optional(),
  predictedDurationMin: z.number().optional(),
  doseRecord: RadDoseRecordSchema.optional(),
  aiFindings: z.array(RadAiFindingSchema).optional(),
  qualityFlags: RadQualityFlagsSchema.optional(),
  verificationLevel: RadVerificationLevel.optional(),
  residentReadBy: RadTechSchema.optional(),
  escalation: RadEscalationSchema.optional(),
  distribution: z.array(RadDistributionEntrySchema).optional(),
  comparisonPriorId: z.string().optional(),
  updatedAt: z.string(),
})
export type RadiologyStudy = z.infer<typeof RadiologyStudySchema>

const radiologyStudies = table<RadiologyStudy>('radiology_studies', RadiologyStudySchema)

export const RadiologyStudies = {
  list: (filter?: (s: RadiologyStudy) => boolean) => radiologyStudies.list(filter),
  get: (id: string) => radiologyStudies.get(id),
  byOrder: (orderId: string) => radiologyStudies.list((s) => s.orderId === orderId),

  async create(input: Omit<RadiologyStudy, 'id' | 'status' | 'attachments' | 'priority' | 'updatedAt'> & {
    id?: string
    status?: RadiologyStudy['status']
    attachments?: RadAttachment[]
    priority?: RadiologyStudy['priority']
  }) {
    const row: RadiologyStudy = {
      ...input,
      id: input.id ?? newId('RS'),
      status: input.status ?? 'ordered',
      attachments: input.attachments ?? [],
      priority: input.priority ?? 'Routine',
      updatedAt: isoNow(),
    }
    const saved = await radiologyStudies.insert(row)
    audit.emit({
      action: 'radiology_order',
      resource: 'radiology_study',
      resourceId: saved.id,
      detail: `${saved.name} ordered (${saved.modality})`,
    })
    return saved
  },

  async schedule(id: string, scheduledFor: string) {
    return radiologyStudies.patch(id, { status: 'scheduled', scheduledFor, updatedAt: isoNow() })
  },

  async markArrived(id: string) {
    return radiologyStudies.patch(id, { status: 'arrived', arrivedAt: isoNow(), updatedAt: isoNow() })
  },

  async setContrastConsented(id: string, ok: boolean) {
    return radiologyStudies.patch(id, { contrastConsented: ok, updatedAt: isoNow() })
  },

  // actor: the real signed-in radiographer claiming this study off the worklist.
  async claimAcquisition(id: string, actor: RadTech) {
    return radiologyStudies.patch(id, { status: 'acquiring', acquiringBy: actor, updatedAt: isoNow() })
  },

  async markAcquired(id: string) {
    return radiologyStudies.patch(id, { status: 'acquired', acquiredAt: isoNow(), updatedAt: isoNow() })
  },

  // Upsert (append), not update-only — mirrors LabTests.enterAnalyte's upsert
  // shape: a real row's `attachments` starts as `[]` on every insert.
  async attachImage(id: string, attachment: RadAttachment) {
    const s = await radiologyStudies.get(id)
    if (!s) return undefined
    return radiologyStudies.patch(id, { attachments: [...s.attachments, attachment], updatedAt: isoNow() })
  },

  async recordDose(id: string, dose: RadDoseRecord) {
    return radiologyStudies.patch(id, { doseRecord: dose, updatedAt: isoNow() })
  },

  async flagQuality(id: string, flags: RadQualityFlags) {
    return radiologyStudies.patch(id, { qualityFlags: flags, updatedAt: isoNow() })
  },

  // actor: the real signed-in radiologist claiming this study for reading.
  async claimReading(id: string, actor: RadTech) {
    return radiologyStudies.patch(id, { status: 'reading', readingBy: actor, updatedAt: isoNow() })
  },

  async setAIPrelim(id: string, aiPrelim: string) {
    return radiologyStudies.patch(id, { aiPrelim, updatedAt: isoNow() })
  },

  async setAIFindings(id: string, findings: RadAiFinding[]) {
    return radiologyStudies.patch(id, { aiFindings: findings, updatedAt: isoNow() })
  },

  // Upsert-merge into the reportSections jsonb object (same shape as
  // LabTests.microAdvance's read-then-merge pattern).
  async updateReportSection(id: string, key: string, value: string) {
    const s = await radiologyStudies.get(id)
    if (!s) return undefined
    return radiologyStudies.patch(id, { reportSections: { ...s.reportSections, [key]: value }, updatedAt: isoNow() })
  },

  // actor: the real signed-in radiologist submitting the report.
  async submitReport(id: string, actor: RadTech) {
    return radiologyStudies.patch(id, {
      status: 'reported', readingBy: actor, reportedAt: isoNow(), updatedAt: isoNow(),
    })
  },

  // actor: the real signed-in resident submitting a first read.
  async residentSubmit(id: string, actor: RadTech) {
    return radiologyStudies.patch(id, {
      status: 'reported', residentReadBy: actor, verificationLevel: 'resident',
      reportedAt: isoNow(), updatedAt: isoNow(),
    })
  },

  // actor: the real signed-in radiologist verifying and releasing the report.
  // `verificationLevel` is optional — the caller (consultantVerify's bridge)
  // passes 'consultant' when applicable, or omits it for a plain verify.
  async verifyAndRelease(id: string, actor: RadTech, verificationLevel?: 'resident' | 'consultant') {
    const patch: Partial<RadiologyStudy> = {
      status: 'released', verifiedBy: actor, verifiedAt: isoNow(), releasedAt: isoNow(), updatedAt: isoNow(),
    }
    if (verificationLevel) patch.verificationLevel = verificationLevel
    const patched = await radiologyStudies.patch(id, patch)
    if (patched) {
      audit.emit({
        action: 'radiology_report_verified',
        resource: 'radiology_study',
        resourceId: id,
        userId: actor.id,
        userName: actor.name,
        detail: `${patched.name} verified by ${actor.name}`,
      })
    }
    return patched
  },

  async cancelStudy(id: string, reason?: string) {
    return radiologyStudies.patch(id, { status: 'cancelled', cancelReason: reason, updatedAt: isoNow() })
  },

  async logCallback(id: string, calledBy: string, recipient: string) {
    return radiologyStudies.patch(id, {
      callback: { calledBy, recipient, calledAt: isoNow() }, updatedAt: isoNow(),
    })
  },

  async ackResult(id: string) {
    return radiologyStudies.patch(id, { acknowledgedAt: isoNow(), updatedAt: isoNow() })
  },

  async startEscalation(id: string) {
    const s = await radiologyStudies.get(id)
    if (!s) return undefined
    const level = (s.escalation?.level ?? 0) + 1
    return radiologyStudies.patch(id, {
      escalation: { startedAt: s.escalation?.startedAt ?? isoNow(), level },
      updatedAt: isoNow(),
    })
  },

  async ackEscalation(id: string, by: string) {
    const s = await radiologyStudies.get(id)
    if (!s?.escalation) return undefined
    return radiologyStudies.patch(id, {
      escalation: { ...s.escalation, acknowledgedAt: isoNow(), acknowledgedBy: by },
      updatedAt: isoNow(),
    })
  },

  async recordDistribution(id: string, entry: RadDistributionEntry) {
    const s = await radiologyStudies.get(id)
    if (!s) return undefined
    return radiologyStudies.patch(id, {
      distribution: [...(s.distribution ?? []), entry], updatedAt: isoNow(),
    })
  },

  async linkPrior(id: string, priorId: string) {
    return radiologyStudies.patch(id, { comparisonPriorId: priorId, updatedAt: isoNow() })
  },

  async setNoShowRisk(id: string, risk: number) {
    return radiologyStudies.patch(id, { noShowRisk: risk, updatedAt: isoNow() })
  },

  async setPredictedDuration(id: string, minutes: number) {
    return radiologyStudies.patch(id, { predictedDurationMin: minutes, updatedAt: isoNow() })
  },

  _table: radiologyStudies,
}
```

- [ ] **Step 2: Export from `src/lib/api/index.ts`**

Add, alphabetically after the existing `Radiology`/`RadStudySchema` legacy export (leave that line untouched — it stays unrelated):

```ts
export {
  RadiologyStudies, RadiologyStudySchema, RadTechSchema, RadAttachmentSchema,
  RadAiFindingSchema, RadDoseRecordSchema, RadQualityFlagsSchema,
  RadDistributionEntrySchema, RadEscalationSchema, RadCallbackSchema,
} from './radiology-studies'
```

- [ ] **Step 3: Write the test file**

`src/lib/api/__tests__/radiology-studies.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Orders } from '@/lib/api/orders'
import { RadiologyStudies } from '@/lib/api/radiology-studies'
import type { RadTech } from '@/lib/api/radiology-studies'
import { getSupabaseClient } from '@/lib/supabase/client'

// RadiologyStudies.* routes through table('radiology_studies', ...) — same
// fixture pattern as lab-tests.test.ts: reception creates patient+visit,
// doctor creates the real order (radiology_studies.order_id FKs to orders),
// then radiology (role 'radiology') performs the actual workflow operations
// under test.
//
// IMPORTANT (see radiology-studies.ts module note): claimAcquisition/
// claimReading/submitReport/residentSubmit/verifyAndRelease take an
// `actor: RadTech` parameter that is NOT verified by this repository layer —
// these test fixtures use plain RadTech-shaped literals because this is the
// *persistence* layer under test, not the session-sourcing bridge. Real
// callers (Phase 5 Tasks 5-7's store bridges) MUST source `actor` from a live
// Supabase session, never from arbitrary client/local state.
const testPatientId = 'PT-RADTEST-1'
const testVisitId = 'VIS-RADTEST-1'
const testStudyId = 'RS-RADTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'rad-studies-test-reception@example.com'
const doctorEmail = 'rad-studies-test-doctor@example.com'
const radEmail = 'rad-studies-test-rad@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string
let radUserId: string
let testOrderId: string

const RAVI: RadTech = { id: 'RT-101', name: 'Ravi Sinha' }
const DR_GUPTA: RadTech = { id: 'RD-202', name: 'Dr. Aisha Gupta' }

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Rad Studies Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Rad Studies Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { data: radData, error: radError } = await admin.auth.admin.createUser({
    email: radEmail, password: testPassword, email_confirm: true,
  })
  if (radError || !radData.user) throw new Error(`createUser failed: ${radError?.message}`)
  radUserId = radData.user.id
  const { error: radProfileError } = await admin.from('profiles').insert({
    id: radUserId, role: 'radiology', full_name: 'Rad Studies Test Radiology',
  })
  if (radProfileError) throw new Error(`profile insert failed: ${radProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-RADTEST-1', fullName: 'Rad Studies Test', phone: '9333333333', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  const { error: doctorSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: doctorEmail, password: testPassword,
  })
  if (doctorSignInError) throw new Error(`signIn failed: ${doctorSignInError.message}`)

  const order = await Orders.create({
    patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
    kind: 'radiology', urgency: 'routine', items: [{ id: 'ITEM-1', name: 'XR Chest', qty: 1 }],
  } as Parameters<typeof Orders.create>[0])
  testOrderId = order.id

  const { error: radSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: radEmail, password: testPassword,
  })
  if (radSignInError) throw new Error(`signIn failed: ${radSignInError.message}`)
})

afterAll(async () => {
  await admin.from('radiology_studies').delete().eq('order_id', testOrderId)
  await admin.from('orders').delete().eq('id', testOrderId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', radUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(radUserId)
})

afterEach(async () => {
  await admin.from('radiology_studies').delete().eq('id', testStudyId)
})

function baseInput(overrides: Partial<Parameters<typeof RadiologyStudies.create>[0]> = {}) {
  return {
    id: testStudyId, orderId: testOrderId, patientId: testPatientId, patientName: 'Rad Studies Test',
    source: 'OPD' as const, doctorName: 'Dr. Rad Studies Test Doctor', paymentMode: 'Cash' as const,
    code: 'XR_CHEST', name: 'X-Ray Chest (PA/Lateral)', modality: 'XR' as const, bodyPart: 'Chest',
    expectedTatMin: 30, orderedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('RadiologyStudies repository', () => {
  it('creates a study for an order', async () => {
    const saved = await RadiologyStudies.create(baseInput())
    expect(saved.status).toBe('ordered')
    expect(saved.attachments).toEqual([])
  })

  it('byOrder() returns the study', async () => {
    await RadiologyStudies.create(baseInput())
    const rows = await RadiologyStudies.byOrder(testOrderId)
    expect(rows.some((s) => s.id === testStudyId)).toBe(true)
  })

  it('schedule() sets scheduledFor and moves to scheduled', async () => {
    await RadiologyStudies.create(baseInput())
    const scheduled = await RadiologyStudies.schedule(testStudyId, '2026-07-06T10:00:00.000Z')
    expect(scheduled?.status).toBe('scheduled')
    expect(scheduled?.scheduledFor).toBe('2026-07-06T10:00:00.000Z')
  })

  it('markArrived() moves to arrived', async () => {
    await RadiologyStudies.create(baseInput())
    const arrived = await RadiologyStudies.markArrived(testStudyId)
    expect(arrived?.status).toBe('arrived')
    expect(arrived?.arrivedAt).toBeTruthy()
  })

  it('setContrastConsented() sets the flag', async () => {
    await RadiologyStudies.create(baseInput())
    const consented = await RadiologyStudies.setContrastConsented(testStudyId, true)
    expect(consented?.contrastConsented).toBe(true)
  })

  it('claimAcquisition() assigns the actor and moves to acquiring', async () => {
    await RadiologyStudies.create(baseInput({ status: 'arrived' }))
    const claimed = await RadiologyStudies.claimAcquisition(testStudyId, RAVI)
    expect(claimed?.status).toBe('acquiring')
    expect(claimed?.acquiringBy?.id).toBe('RT-101')
  })

  it('markAcquired() moves to acquired', async () => {
    await RadiologyStudies.create(baseInput({ status: 'acquiring' }))
    const acquired = await RadiologyStudies.markAcquired(testStudyId)
    expect(acquired?.status).toBe('acquired')
    expect(acquired?.acquiredAt).toBeTruthy()
  })

  it('attachImage() appends to attachments', async () => {
    await RadiologyStudies.create(baseInput())
    const attached = await RadiologyStudies.attachImage(testStudyId, {
      id: 'ATT-1', filename: 'XR-1.jpg', uploadedBy: 'Ravi Sinha', uploadedAt: new Date().toISOString(),
    })
    expect(attached?.attachments).toHaveLength(1)
    expect(attached?.attachments[0].filename).toBe('XR-1.jpg')
  })

  it('recordDose() sets doseRecord', async () => {
    await RadiologyStudies.create(baseInput())
    const dosed = await RadiologyStudies.recordDose(testStudyId, { dlp: 120, ctdi: 8 })
    expect(dosed?.doseRecord?.dlp).toBe(120)
  })

  it('flagQuality() sets qualityFlags', async () => {
    await RadiologyStudies.create(baseInput())
    const flagged = await RadiologyStudies.flagQuality(testStudyId, { motion: true, note: 'slight blur' })
    expect(flagged?.qualityFlags?.motion).toBe(true)
  })

  it('claimReading() assigns the actor and moves to reading', async () => {
    await RadiologyStudies.create(baseInput({ status: 'acquired' }))
    const claimed = await RadiologyStudies.claimReading(testStudyId, DR_GUPTA)
    expect(claimed?.status).toBe('reading')
    expect(claimed?.readingBy?.id).toBe('RD-202')
  })

  it('setAIPrelim() sets aiPrelim', async () => {
    await RadiologyStudies.create(baseInput())
    const withAi = await RadiologyStudies.setAIPrelim(testStudyId, 'AI prelim: lung fields clear.')
    expect(withAi?.aiPrelim).toBe('AI prelim: lung fields clear.')
  })

  it('setAIFindings() sets aiFindings', async () => {
    await RadiologyStudies.create(baseInput())
    const withFindings = await RadiologyStudies.setAIFindings(testStudyId, [
      { id: 'F-1', label: 'No acute findings', category: 'normal', confidence: 0.9 },
    ])
    expect(withFindings?.aiFindings).toHaveLength(1)
  })

  it('updateReportSection() merges into reportSections', async () => {
    await RadiologyStudies.create(baseInput())
    const updated = await RadiologyStudies.updateReportSection(testStudyId, 'findings', 'Lung fields clear.')
    expect(updated?.reportSections.findings).toBe('Lung fields clear.')
  })

  it('submitReport() stamps readingBy and moves to reported', async () => {
    await RadiologyStudies.create(baseInput({ status: 'reading' }))
    const submitted = await RadiologyStudies.submitReport(testStudyId, DR_GUPTA)
    expect(submitted?.status).toBe('reported')
    expect(submitted?.readingBy?.id).toBe('RD-202')
  })

  it('residentSubmit() tags verificationLevel resident and moves to reported', async () => {
    await RadiologyStudies.create(baseInput({ status: 'reading' }))
    const submitted = await RadiologyStudies.residentSubmit(testStudyId, DR_GUPTA)
    expect(submitted?.status).toBe('reported')
    expect(submitted?.residentReadBy?.id).toBe('RD-202')
    expect(submitted?.verificationLevel).toBe('resident')
  })

  it('verifyAndRelease() stamps verifiedBy/releasedAt and moves to released', async () => {
    await RadiologyStudies.create(baseInput({ status: 'reported' }))
    const released = await RadiologyStudies.verifyAndRelease(testStudyId, DR_GUPTA)
    expect(released?.status).toBe('released')
    expect(released?.verifiedBy?.id).toBe('RD-202')
    expect(released?.releasedAt).toBeTruthy()
  })

  it('verifyAndRelease() with verificationLevel tags consultant', async () => {
    await RadiologyStudies.create(baseInput({ status: 'reported' }))
    const released = await RadiologyStudies.verifyAndRelease(testStudyId, DR_GUPTA, 'consultant')
    expect(released?.verificationLevel).toBe('consultant')
  })

  it('cancelStudy() sets cancelReason and moves to cancelled', async () => {
    await RadiologyStudies.create(baseInput())
    const cancelled = await RadiologyStudies.cancelStudy(testStudyId, 'Patient declined')
    expect(cancelled?.status).toBe('cancelled')
    expect(cancelled?.cancelReason).toBe('Patient declined')
  })

  it('logCallback() sets callback', async () => {
    await RadiologyStudies.create(baseInput({ status: 'released' }))
    const called = await RadiologyStudies.logCallback(testStudyId, 'Dr. Gupta', 'Ward nurse')
    expect(called?.callback?.calledBy).toBe('Dr. Gupta')
  })

  it('ackResult() sets acknowledgedAt', async () => {
    await RadiologyStudies.create(baseInput({ status: 'released' }))
    const acked = await RadiologyStudies.ackResult(testStudyId)
    expect(acked?.acknowledgedAt).toBeTruthy()
  })

  it('startEscalation() then ackEscalation() increments level then acknowledges', async () => {
    await RadiologyStudies.create(baseInput({ status: 'released' }))
    const started = await RadiologyStudies.startEscalation(testStudyId)
    expect(started?.escalation?.level).toBe(1)
    const acked = await RadiologyStudies.ackEscalation(testStudyId, 'Dr. Gupta')
    expect(acked?.escalation?.acknowledgedBy).toBe('Dr. Gupta')
  })

  it('recordDistribution() appends to distribution', async () => {
    await RadiologyStudies.create(baseInput({ status: 'released' }))
    const distributed = await RadiologyStudies.recordDistribution(testStudyId, {
      channel: 'sms', to: '9999999999', sentAt: new Date().toISOString(),
    })
    expect(distributed?.distribution).toHaveLength(1)
  })

  it('linkPrior() sets comparisonPriorId', async () => {
    await RadiologyStudies.create(baseInput())
    const linked = await RadiologyStudies.linkPrior(testStudyId, 'RS-OTHER-1')
    expect(linked?.comparisonPriorId).toBe('RS-OTHER-1')
  })

  it('setNoShowRisk() sets noShowRisk', async () => {
    await RadiologyStudies.create(baseInput())
    const risked = await RadiologyStudies.setNoShowRisk(testStudyId, 0.3)
    expect(risked?.noShowRisk).toBe(0.3)
  })

  it('setPredictedDuration() sets predictedDurationMin', async () => {
    await RadiologyStudies.create(baseInput())
    const predicted = await RadiologyStudies.setPredictedDuration(testStudyId, 25)
    expect(predicted?.predictedDurationMin).toBe(25)
  })
})
```

- [ ] **Step 4: Run it, confirm it fails**

Run: `npx vitest run src/lib/api/__tests__/radiology-studies.test.ts`
Expected: FAIL — module `@/lib/api/radiology-studies` does not exist yet (if Step 1 hasn't been saved) or, once Step 1 is saved, this step is really "run before Step 1" only in the strict TDD sense; since the module and test are being introduced together in this task, run the test immediately after Step 1+3 land and confirm PASS directly — there is no meaningful pre-implementation "red" state for a brand-new module+test pair (unlike Task 1's schema test, which fails against real Postgres independent of local code).

- [ ] **Step 5: Run it, confirm it passes**

Run: `npx vitest run src/lib/api/__tests__/radiology-studies.test.ts`
Expected: `Test Files 1 passed (1)` / `Tests 25 passed (25)`.

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/lib/api/radiology-studies.ts src/lib/api/index.ts src/lib/api/__tests__/radiology-studies.test.ts
```

---

### Task 3: Bridge order creation — materialize a real `radiology_studies` row ("order rewire") + the `realId` backreference

**Files:**
- Modify: `src/store/useRadiologyStudiesStore.ts` — add `realId?: string` to `RadiologyStudy`, add `setRealId` action, export `emptyReportSections`, fix the SSR/Node storage crash.
- Modify: `src/store/useRadiologyStore.ts` — export `codeForLegacy` (currently private).
- Modify: `src/app/doctor/dashboard/page.tsx` — `dispatchRadOrder`.
- Create: `supabase/migrations/20260705040000_radiology_studies_insert_doctor.sql`

**Interfaces:**
- Consumes: `RadiologyStudies.create` (Task 2), `Orders.create` (existing, Phase 3), `withLiveSession` (existing, `page.tsx` lines 229-241), `RADIOLOGY_CATALOG`/`TEMPLATE_SECTIONS` (existing, `src/lib/radiologyCatalog.ts`).
- Produces: `RadiologyStudy.realId?: string`, `useRadiologyStudiesStore.getState().setRealId(localId, realId)` — consumed by every bridge in Tasks 4-8.

**Read before implementing:** `src/store/useRadiologyStudiesStore.ts` in full (already done for this plan — re-verify `addOrder`'s exact current shape, lines 392-418), `src/store/useRadiologyStore.ts` in full (the `codeForLegacy` resolver, lines 33-47), `src/app/doctor/dashboard/page.tsx`'s `dispatchRadOrder` (lines 707-732) and `dispatchLabOrder` (lines 590-704, the template this task mirrors).

**Design decision — where does materialization live: `dispatchRadOrder` (page component) or `useRadiologyStudiesStore.addOrder` (store)?** Lab put it in `dispatchLabOrder`, not inside `useLabOrdersStore.addOrder` — confirmed via `.superpowers/sdd/phase4-task-3-report.md`, which reasoned that the real backend write is a Phase-3/4 bridging concern layered *on top of* the pre-existing local store, and that the store itself should stay backend-agnostic (every other bridge in Lab also lives at the call-site level or inside the store's own actions guarded identically, never baked into the store's core local mutation). This plan makes the **same choice, for the same reason**: `dispatchRadOrder` is already the file where the Phase 3 `Orders.create()` bridge lives, already imports `withLiveSession`, and is the one place that knows both "a doctor just placed this order" and "here is the live session to attribute it to." Radiology's simpler one-study-per-order shape does not change this reasoning — it only means the materialization step itself is *shorter* than Lab's specimen-grouping loop (a single `RadiologyStudies.create()` call, no grouping needed), not that it belongs somewhere else. Keeping it in `dispatchRadOrder` also means the store's `addOrder` stays purely local and reusable from any other future caller without dragging in a backend dependency.

**A required precondition found while planning this task: `dispatchRadOrder` today calls the store only through the legacy shim.** Unlike `dispatchLabOrder` (which already calls `useLabOrdersStore`'s real `addOrder` directly, via `addLabRichOrder = useLabOrdersStore(s => s.addOrder)`, falling back to a legacy store only when no catalog code resolves), `dispatchRadOrder` calls **only** `addRadToStore` — the legacy shim's `addOrderFromDoctor` (`src/store/useRadiologyStore.ts`), which internally resolves a catalog code via its own private `codeForLegacy` and then calls the real store's `addOrder`. To materialize a real `radiology_studies` row with the same catalog fields (`name`/`modality`/`bodyPart`/`expectedTatMin`/`reportSections`), the bridge needs that resolved `code` directly — so this task changes `dispatchRadOrder` to resolve `code` itself (reusing the shim's exact, already-tested `codeForLegacy` logic, now exported) and calls the real store's `addOrder` directly when a code resolves, exactly mirroring `dispatchLabOrder`'s existing shape. The legacy shim call remains as the fallback for the no-catalog-match case, preserving today's behavior exactly.

**A second, blocking precondition found while planning this task: `useRadiologyStudiesStore.ts`'s persist storage will crash under Vitest (Node environment).** Its persist config is `storage: createJSONStorage(() => localStorage)` (line 596) — a bare reference to the global `localStorage`, unlike `useLabOrdersStore.ts`'s `mergingStorage`, which Phase 4 Task 4 had to guard with `typeof window !== 'undefined'` after discovering the *identical* crash (`.superpowers/sdd/phase4-hardening-setRealIds-report.md`'s sibling report, `phase4-task-4-report-v2.md`, Part 1: "any store action that calls `set()` ... would crash outside a real browser"). `vitest.config.ts` sets `environment: 'node'` — so the moment this task's throwaway verification script calls `useRadiologyStudiesStore.getState().addOrder(...)`, zustand's persist middleware will call `storage.setItem(...)`, which references the bare `localStorage` global and throws `ReferenceError: localStorage is not defined`. This must be fixed in this task (not deferred) since Task 3 is the first task to call this store's actions from a test.

- [ ] **Step 1: Write a failing test proving the storage crash**

`src/store/__tests__/_throwaway-task3-storage-check.test.ts` (throwaway — confirms the bug, then gets deleted once the real fix + real verification script replace it):

```ts
import { describe, expect, it } from 'vitest'
import { useRadiologyStudiesStore } from '@/store/useRadiologyStudiesStore'

describe('useRadiologyStudiesStore under Node (no window)', () => {
  it('addOrder does not throw when persisted storage is touched', () => {
    expect(() => {
      useRadiologyStudiesStore.getState().addOrder({
        patientId: 'PT-STORAGECHECK', patientName: 'Storage Check', source: 'OPD',
        doctorName: 'Dr. Test', paymentMode: 'Cash', code: 'XR_CHEST',
      })
    }).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npx vitest run src/store/__tests__/_throwaway-task3-storage-check.test.ts`
Expected: FAIL — `ReferenceError: localStorage is not defined`.

- [ ] **Step 3: Fix the storage guard in `useRadiologyStudiesStore.ts`**

Add an `isBrowser`-guarded storage object (same minimal shape as `_core.ts`'s `readRaw`/`writeRaw`/`removeRaw` — no cross-tab merge logic is invented here, since none exists today for this store; only the crash is fixed):

```ts
// Phase 5 Task 3 — guarded on `isBrowser` (same pattern as _core.ts's
// readRaw/writeRaw/removeRaw, and useLabOrdersStore.ts's mergingStorage fix
// from Phase 4 Task 4). `createJSONStorage(() => localStorage)` always
// succeeded at store-creation time (the arrow function itself is valid), but
// its bare `localStorage` reference threw uncaught the first time persist
// actually called getItem/setItem in any non-browser environment (SSR, this
// Node-based vitest suite) — any store action that calls `set()` would crash
// outside a real browser. No cross-tab merge behavior is added here (unlike
// useLabOrdersStore.ts's mergingStorage) since none exists for this store
// today; only the crash is fixed.
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

- [ ] **Step 5: Add `realId` + `setRealId` + export `emptyReportSections`**

In `src/store/useRadiologyStudiesStore.ts`, add to the `RadiologyStudy` type (after `comparisonPriorId?: string`):

```ts
  realId?: string                     // the real radiology_studies.id, once materialized (Phase 5 Task 3)
```

Add to the `State` interface (after `linkPrior`):

```ts
  setRealId: (id: string, realId: string) => void
```

Add to the store implementation (after `linkPrior`'s implementation):

```ts
  // Phase 5 Task 3 — stamps the real backend id onto the matching local study,
  // once dispatchRadOrder's materialization succeeds. One study per order (no
  // grouping ambiguity like Lab's setRealIds), so a simple id match is correct
  // with no positional-matching caveat needed.
  setRealId: (id, realId) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, realId } : x),
  })),
```

Change the `emptyReportSections` function signature line from a private function to an exported one:

```ts
export function emptyReportSections(code: string): Record<string, string> {
```

(No other change to its body.)

- [ ] **Step 6: Export `codeForLegacy` from the legacy shim**

In `src/store/useRadiologyStore.ts`, change:

```ts
function codeForLegacy(scanType: string, bodyPart?: string): string | undefined {
```

to:

```ts
export function codeForLegacy(scanType: string, bodyPart?: string): string | undefined {
```

(No other change — this is the exact, already-working resolver; only its visibility changes.)

- [ ] **Step 7: Rewire `dispatchRadOrder` in `src/app/doctor/dashboard/page.tsx`**

Add imports (near the existing `useRadiologyStore`/`useLabOrdersStore` imports, lines 20-22):

```ts
import { useRadiologyStudiesStore, emptyReportSections } from "@/store/useRadiologyStudiesStore"
import { codeForLegacy } from "@/store/useRadiologyStore"
import { RADIOLOGY_CATALOG } from "@/lib/radiologyCatalog"
```

Add a hook binding near the existing `addLabRichOrder` binding (line 268):

```ts
  const addRadRichOrder = useRadiologyStudiesStore(s => s.addOrder)
```

Replace the existing `dispatchRadOrder` (lines 707-732) with:

```ts
  // Same pattern for radiology.
  const dispatchRadOrder = async (scanType: typeof radScanType, bodyPart: string, priority: 'Routine' | 'Urgent') => {
    if (!currentPatient) { toast.error("Select a patient from the queue first"); return }
    addRadiologyOrder({ scanType, bodyPart, priority })
    const newId = useConsultationStore.getState().radiologyOrders.slice(-1)[0]?.id
    if (newId) markRadiologyOrderSent(newId)
    const code = codeForLegacy(scanType, bodyPart)
    // Phase 5 Task 3 — the real-id-alignment fix, mirroring Lab's Task 4:
    // capture the LOCAL study id addOrder() returns so the real order/study
    // ids materialized below can be stamped back onto this exact local study
    // via setRealId(). Only set when `code` resolved — the legacy addRadToStore
    // fallback path has no catalog entry to bridge from.
    let localStudyId: string | undefined
    if (code) {
      localStudyId = addRadRichOrder({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        source: 'OPD',
        doctorName: currentPatient.doctor,
        paymentMode: 'Cash',
        code,
        priority: priority === 'Urgent' ? 'Urgent' : undefined,
      })
    } else {
      addRadToStore({ patientName: currentPatient.name, patientId: currentPatient.id, scanType, bodyPart, priority, orderedBy: currentPatient.doctor })
    }
    recordStat(doctorId, 'tests', 1)
    toast.success(`${scanType} — ${bodyPart} → Radiology queue`)

    // Phase 3 Task 3 — additive bridge into the real backend `orders` table.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { Orders, RadiologyStudies } = await import('@/lib/api')
      const order = await Orders.create({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        doctorName: currentPatient.doctor,
        kind: 'radiology',
        urgency: mapLocalPriorityToOrderUrgency(priority),
        indication: undefined,
        items: [{ id: `OI-${Date.now()}`, name: `${scanType} — ${bodyPart}`, qty: 1 }],
        modality: scanType,
      })

      // Task 3 (order rewire) — materialize the real radiology_studies row a
      // radiology tech/radiologist actually works against, mirroring
      // useRadiologyStudiesStore.addOrder()'s client-side logic. Only possible
      // when `code` resolved from RADIOLOGY_CATALOG (same condition the local
      // addRadRichOrder branch above already requires).
      if (code) {
        const cat = RADIOLOGY_CATALOG[code]!
        const study = await RadiologyStudies.create({
          orderId: order.id,
          patientId: currentPatient.id,
          patientName: currentPatient.name,
          source: 'OPD',
          doctorName: currentPatient.doctor,
          paymentMode: 'Cash',
          code,
          name: cat.name,
          modality: cat.modality,
          bodyPart: cat.bodyPart,
          priority: priority === 'Urgent' ? 'Urgent' : cat.defaultPriority,
          reportSections: emptyReportSections(code),
          expectedTatMin: cat.expectedTATmin,
          orderedAt: order.createdAt,
        })
        if (localStudyId) {
          useRadiologyStudiesStore.getState().setRealId(localStudyId, study.id)
        }
      }
    }, 'real radiology order write failed (local queue still updated)')
  }
```

- [ ] **Step 8: Write and run the throwaway verification script proving the doctor session can materialize a real study**

`src/lib/api/__tests__/_throwaway-task3-verify.test.ts` (same convention as Phase 4 Task 3's own throwaway script — real reception/doctor auth users, real patient/visit/order, then reproduces the exact materialization the bridge performs):

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Orders } from '@/lib/api/orders'
import { RadiologyStudies } from '@/lib/api/radiology-studies'
import { getSupabaseClient } from '@/lib/supabase/client'
import { RADIOLOGY_CATALOG } from '@/lib/radiologyCatalog'
import { emptyReportSections } from '@/store/useRadiologyStudiesStore'

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
let testOrderId: string

beforeAll(async () => {
  const { data: receptionData } = await admin.auth.admin.createUser({ email: receptionEmail, password: testPassword, email_confirm: true })
  receptionUserId = receptionData!.user!.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Task3 Verify Reception' })

  const { data: doctorData } = await admin.auth.admin.createUser({ email: doctorEmail, password: testPassword, email_confirm: true })
  doctorUserId = doctorData!.user!.id
  await admin.from('profiles').insert({ id: doctorUserId, role: 'doctor', full_name: 'Task3 Verify Doctor' })

  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
  await Patients.create({ id: testPatientId, hn: `HN-${testPatientId}`, fullName: 'Task3 Verify Patient', phone: '9444444444', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('radiology_studies').delete().eq('order_id', testOrderId)
  await admin.from('orders').delete().eq('id', testOrderId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

describe('Task 3 order rewire — doctor materializes a real radiology_studies row', () => {
  it('creates order + study with matching catalog fields', async () => {
    const order = await Orders.create({
      visitId: testVisitId, patientId: testPatientId, doctorId: doctorUserId,
      doctorName: 'Task3 Verify Doctor', kind: 'radiology', urgency: 'routine',
      items: [{ id: 'OI-1', name: 'X-Ray — Chest', qty: 1 }], modality: 'X-Ray',
    })
    testOrderId = order.id

    const cat = RADIOLOGY_CATALOG.XR_CHEST!
    const study = await RadiologyStudies.create({
      orderId: order.id, patientId: testPatientId, patientName: 'Task3 Verify Patient',
      source: 'OPD', doctorName: 'Task3 Verify Doctor', paymentMode: 'Cash',
      code: 'XR_CHEST', name: cat.name, modality: cat.modality, bodyPart: cat.bodyPart,
      priority: cat.defaultPriority, reportSections: emptyReportSections('XR_CHEST'),
      expectedTatMin: cat.expectedTATmin, orderedAt: order.createdAt,
    })

    expect(study.status).toBe('ordered')
    expect(study.modality).toBe('XR')
    expect(study.expectedTatMin).toBe(30)

    const { data: row } = await admin.from('radiology_studies').select('*').eq('id', study.id).single()
    expect(row.order_id).toBe(order.id)
    expect(row.status).toBe('ordered')
  })
})
```

Run: `npx vitest run src/lib/api/__tests__/_throwaway-task3-verify.test.ts`
Expected: PASS. This proves `RadiologyStudies.create()` (Task 2) works end-to-end against the live project once the doctor-INSERT RLS gap (next step) is closed — run it *before* Step 9 first to see the expected 403, confirming the gap is real, then again after Step 9 to confirm the fix.

- [ ] **Step 9: Add the doctor-INSERT RLS policy** (expect the Step 8 run to 403 without it — same discovery Lab Task 3 made)

`supabase/migrations/20260705040000_radiology_studies_insert_doctor.sql`:

```sql
-- Phase 5, Task 3 (order rewire) — doctor INSERT/SELECT access on radiology_studies.
--
-- The radiology_schema migration (20260705030000) only granted `radiology`/`admin`
-- roles write access (radiology_studies_all_radiology), plus a doctor SELECT-only
-- policy. That leaves no policy allowing a doctor to INSERT — but this task wires
-- dispatchRadOrder (doctor dashboard) to materialize the real radiology_studies row
-- immediately after the doctor's own Orders.create() call. Without this, that write
-- 403s under RLS the moment a real doctor session attempts it — confirmed against
-- the live project via this task's own throwaway verification script (Step 8),
-- exactly mirroring the gap Lab Task 3 found for lab_specimens/lab_tests.
--
-- Applying Lab's second lesson (20260705020000_tighten_lab_tests_insert_doctor.sql)
-- proactively rather than in a follow-up migration: the WITH CHECK is tightened
-- from the start to match exactly what dispatchRadOrder's bridge sends — a
-- freshly-ordered study, not an already-acquired/reported/verified/released one —
-- so a doctor's INSERT cannot fabricate a study already past the 'ordered' stage,
-- with a fake acquiringBy/readingBy/verifiedBy, bypassing the acquire -> read ->
-- verify -> release workflow the rest of this module is built around.
--
-- A SELECT policy is required in addition to INSERT/WITH CHECK (same Postgres/
-- PostgREST RLS interaction Lab's Task 3 report documented in detail: `Table.insert()`
-- in _core.ts chains `.insert(...).select().single()`, and the inserted row must
-- also satisfy a SELECT policy for that RETURNING projection to be visible to the
-- caller). `radiology_studies_select_doctor` already exists from the original
-- migration (20260705030000), so only the INSERT policy is added here.

create policy radiology_studies_insert_doctor on radiology_studies for insert
  with check (
    exists (select 1 from orders o where o.id = radiology_studies.order_id and o.doctor_id = auth.uid())
    and status = 'ordered'
    and attachments = '[]'::jsonb
    and acquiring_by is null
    and reading_by is null
    and verified_by is null
    and resident_read_by is null
    and released_at is null
    and acknowledged_at is null
    and ai_prelim is null
  );
```

Apply: `npx supabase db push --db-url "$env:DATABASE_URL" --include-all --yes`

- [ ] **Step 10: Re-run the throwaway verification script, confirm it now passes, then delete it**

Run: `npx vitest run src/lib/api/__tests__/_throwaway-task3-verify.test.ts`
Expected: PASS.

```bash
rm src/lib/api/__tests__/_throwaway-task3-verify.test.ts
```

- [ ] **Step 11: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions (confirm the baseline count from Task 2 plus no new committed tests from this task — Steps 1/8's scripts were both deleted).
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useRadiologyStudiesStore.ts src/store/useRadiologyStore.ts src/app/doctor/dashboard/page.tsx supabase/migrations/20260705040000_radiology_studies_insert_doctor.sql
```

---

### Task 4: Bridge scheduling/arrival/consent — `schedule`, `markArrived`, `setContrastConsented`

**Files:**
- Modify: `src/store/useRadiologyStudiesStore.ts`

**Interfaces:**
- Consumes: `RadiologyStudies.schedule/markArrived/setContrastConsented` (Task 2), `RadiologyStudy.realId` (Task 3).
- Produces: `schedule`/`markArrived`/`setContrastConsented` become `Promise<void>` (were `void`) — confirmed via grep that no caller in `src/app/radiology/*` awaits or chains any of these three (`grep -rn "await (schedule|markArrived|setContrastConsented)(" src/app/radiology` — 0 matches), so this signature change is safe, exactly as Lab's Tasks 5-7 confirmed for their own bridged actions.

Add near the top of the file (after the existing imports, before `_studySeq`/`nextStudyId`), the live-session import:

```ts
import { getSupabaseClient } from '@/lib/supabase/client'
```

- [ ] **Step 1: Change the `State` interface signatures**

```ts
  schedule: (id: string, scheduledFor: string) => Promise<void>
  markArrived: (id: string) => Promise<void>
  setContrastConsented: (id: string, ok: boolean) => Promise<void>
```

- [ ] **Step 2: Bridge `schedule`**

Replace:

```ts
  schedule: (id, scheduledFor) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'ordered'
      ? { ...x, status: 'scheduled' as StudyStatus, scheduledFor }
      : x),
  })),
```

with:

```ts
  schedule: async (id, scheduledFor) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'ordered') return x
        realId = x.realId
        return { ...x, status: 'scheduled' as StudyStatus, scheduledFor }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.schedule(realId, scheduledFor)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend schedule failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 3: Bridge `markArrived`** (same shape, no actor)

```ts
  markArrived: async (id) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || (x.status !== 'scheduled' && x.status !== 'ordered')) return x
        realId = x.realId
        return { ...x, status: 'arrived' as StudyStatus, arrivedAt: new Date().toISOString() }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.markArrived(realId)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend markArrived failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `setContrastConsented`** (no local status guard — applies unconditionally, matching the existing local behavior)

```ts
  setContrastConsented: async (id, ok) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, contrastConsented: ok }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.setContrastConsented(realId, ok)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend setContrastConsented failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 5: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task4-verify.test.ts` — real reception/doctor auth users, a real order + study materialized exactly as Task 3's bridge does it, then `useRadiologyStudiesStore.getState().setRealId(...)`, then sign in as **no one** (to confirm the no-session skip path) and separately as a **radiology**-role user (to confirm the real write) before calling `schedule`/`markArrived`/`setContrastConsented`, re-querying the real row via the service-role admin client each time. Structure mirrors Phase 4 Task 4's own throwaway script exactly (see `.superpowers/sdd/phase4-task-4-report-v2.md` for the full precedent this follows) — omitted here in full for brevity of this plan, but must assert: (a) real row's `status`/`scheduled_for`/`arrived_at`/`contrast_consented` match after each call, (b) a demo-seeded study (`RS-101`, no `realId`) advances locally without throwing when these actions are called with no real counterpart.

Run: `npx vitest run src/store/__tests__/_throwaway-task4-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task4-verify.test.ts
```

- [ ] **Step 6: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useRadiologyStudiesStore.ts
```

---

### Task 5: Bridge acquisition — `claimAcquisition`, `markAcquired`, `attachImage`, `recordDose`, `flagQuality`

**Files:**
- Modify: `src/store/useRadiologyStudiesStore.ts`

**Interfaces:**
- Consumes: `RadiologyStudies.claimAcquisition/markAcquired/attachImage/recordDose/flagQuality` (Task 2).
- Produces: `resolveRealRadActor(): Promise<RadTech | undefined>` — consumed by every actor-bearing bridge in this and later tasks (`claimAcquisition` here; `claimReading`/`submitReport`/`residentSubmit` in Task 6; `verifyAndRelease`/`consultantVerify` in Task 7).

- [ ] **Step 1: Add the `resolveRealRadActor` helper** (mirrors `useLabOrdersStore.ts`'s `resolveRealActor` line-for-line, minus the lab-specific `benchHint` — radiology's `RadTech` carries no equivalent metadata field)

Add after the `nextAttId` helper (before the `State` interface):

```ts
// Phase 5 Task 5 — resolves the REAL signed-in actor for a human radiology
// action (claimAcquisition/claimReading/submitReport/residentSubmit/
// verifyAndRelease), from a *live* Supabase session + a `profiles.full_name`
// lookup — never from the local `RadTech` parameter the UI passed in. That
// local parameter (e.g. RAD_RAVI, id 'RT-101') is a display-friendly demo
// roster entry, not necessarily a real `profiles.id`; mirroring it into
// `acquiring_by`/`reading_by`/`verified_by` verbatim would let any caller
// claim to be any tech/radiologist, poisoning the audit trail (see
// src/lib/api/radiology-studies.ts's module-level note). Returns undefined
// (skip the write) if there's no live session or the session has no matching
// profile row.
async function resolveRealRadActor(): Promise<RadTech | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}
```

- [ ] **Step 2: Change the `State` interface signatures**

```ts
  claimAcquisition: (id: string, tech: RadTech) => Promise<void>
  markAcquired: (id: string) => Promise<void>
  attachImage: (id: string, file: { filename: string; url?: string; caption?: string; uploadedBy: string }) => Promise<void>
  recordDose: (id: string, dose: DoseRecord) => Promise<void>
  flagQuality: (id: string, flags: QualityFlags) => Promise<void>
```

Confirmed safe via `grep -rn "await (claimAcquisition|markAcquired|attachImage|recordDose|flagQuality)(" src/app/radiology` — 0 matches (all fire-and-forget).

- [ ] **Step 3: Bridge `claimAcquisition`** (actor-bearing — uses `resolveRealRadActor`, never the local `tech` param)

```ts
  claimAcquisition: async (id, tech) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'arrived') return x
        realId = x.realId
        return { ...x, status: 'acquiring' as StudyStatus, acquiringBy: tech }
      }),
    }))
    if (!realId) return
    const actor = await resolveRealRadActor()
    if (!actor) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.claimAcquisition(realId, actor)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend claimAcquisition failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `markAcquired`** (no actor)

```ts
  markAcquired: async (id) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'acquiring') return x
        realId = x.realId
        return { ...x, status: 'acquired' as StudyStatus, acquiredAt: new Date().toISOString() }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.markAcquired(realId)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend markAcquired failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 5: Bridge `attachImage`** (no actor — `uploadedBy` is a free-text label in the local shape, same non-identity treatment as Lab's `LabSpecimens.collectedBy`; the attachment object, including its locally-minted `id`, is captured inside `set()` so the exact same attachment — not a re-derived one — reaches the real row)

```ts
  attachImage: async (id, file) => {
    let realId: string | undefined
    let savedAttachment: Attachment | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        const attachment: Attachment = { ...file, id: nextAttId(), uploadedAt: new Date().toISOString() }
        savedAttachment = attachment
        return { ...x, attachments: [...x.attachments, attachment] }
      }),
    }))
    if (!realId || !savedAttachment) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.attachImage(realId, savedAttachment)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend attachImage failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 6: Bridge `recordDose`** (no actor — the local `DoseRecord.recordedBy` is a free-text field the caller already sets, unrelated to session identity)

```ts
  recordDose: async (id, dose) => {
    let realId: string | undefined
    let savedDose: DoseRecord | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        const recorded: DoseRecord = { ...dose, recordedAt: new Date().toISOString() }
        savedDose = recorded
        return { ...x, doseRecord: recorded }
      }),
    }))
    if (!realId || !savedDose) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.recordDose(realId, savedDose)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend recordDose failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 7: Bridge `flagQuality`** (no actor)

```ts
  flagQuality: async (id, flags) => {
    let realId: string | undefined
    let savedFlags: QualityFlags | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        const assessed: QualityFlags = { ...flags, assessedAt: new Date().toISOString() }
        savedFlags = assessed
        return { ...x, qualityFlags: assessed }
      }),
    }))
    if (!realId || !savedFlags) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.flagQuality(realId, savedFlags)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend flagQuality failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 8: Write and run a throwaway verification script proving actor identity comes from the session**

`src/store/__tests__/_throwaway-task5-verify.test.ts` — same rigor as Phase 4 Task 5's proof (`.superpowers/sdd/phase4-task-5-report.md`): create a real `radiology`-role auth user whose `profiles.full_name` is deliberately different from the local demo roster (e.g. `'Verify Real Radiology Tech (Task 5)'` vs. `RAD_RAVI.name === 'Ravi Sinha'`), sign in as that user, call `claimAcquisition(localStudyId, RAD_RAVI)` (passing the **local** demo tech exactly as the UI would), then independently re-query the real row via the service-role admin client and assert `acquiring_by.id === radUserId` and `acquiring_by.name === 'Verify Real Radiology Tech (Task 5)'`, explicitly asserting `!== 'RT-101'` / `!== 'Ravi Sinha'`. Also exercise `markAcquired`/`attachImage`/`recordDose`/`flagQuality` and confirm each real column updates, plus a demo-seeded study (`RS-104`, no `realId`) safety check confirming no throw.

Run: `npx vitest run src/store/__tests__/_throwaway-task5-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task5-verify.test.ts
```

- [ ] **Step 9: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useRadiologyStudiesStore.ts
```

---

### Task 6: Bridge reading/report — `claimReading`, `setAIPrelim`, `setAIFindings`, `updateReportSection`, `submitReport`, `residentSubmit`

**Files:**
- Modify: `src/store/useRadiologyStudiesStore.ts`

**Interfaces:**
- Consumes: `resolveRealRadActor` (Task 5), `RadiologyStudies.claimReading/setAIPrelim/setAIFindings/updateReportSection/submitReport/residentSubmit` (Task 2).

- [ ] **Step 1: Change the `State` interface signatures**

```ts
  claimReading: (id: string, radiologist: RadTech) => Promise<void>
  setAIPrelim: (id: string) => Promise<void>
  updateReportSection: (id: string, sectionKey: string, value: string) => Promise<void>
  submitReport: (id: string, radiologist: RadTech) => Promise<void>
  setAIFindings: (id: string, findings: AiFinding[]) => Promise<void>
  residentSubmit: (id: string, resident: RadTech) => Promise<void>
```

Confirmed safe via `grep -rn "await (claimReading|setAIPrelim|setAIFindings|updateReportSection|submitReport|residentSubmit)(" src/app/radiology` — 0 matches.

- [ ] **Step 2: Bridge `claimReading`** (actor-bearing)

```ts
  claimReading: async (id, radiologist) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'acquired') return x
        realId = x.realId
        return { ...x, status: 'reading' as StudyStatus, readingBy: radiologist }
      }),
    }))
    if (!realId) return
    const actor = await resolveRealRadActor()
    if (!actor) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.claimReading(realId, actor)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend claimReading failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 3: Bridge `setAIPrelim`** (no actor — the computed AI text is captured inside `set()` so the exact same string, not a re-derived one, reaches the real row)

```ts
  setAIPrelim: async (id) => {
    let realId: string | undefined
    let computedAi: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        const ai = AI_PRELIM_BY_CODE[x.code] ?? `AI prelim: no acute findings on initial review of ${x.name}.`
        computedAi = ai
        return { ...x, aiPrelim: ai }
      }),
    }))
    if (!realId || !computedAi) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.setAIPrelim(realId, computedAi)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend setAIPrelim failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `setAIFindings`** (no actor — this is a simulated AI output, not a human action, same reasoning Lab applied to `analyzerAutoFeed`'s non-human identity, except here there is no identity at all to record)

```ts
  setAIFindings: async (id, findings) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, aiFindings: findings }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.setAIFindings(realId, findings)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend setAIFindings failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 5: Bridge `updateReportSection`** (no actor — applies unconditionally, matching existing local behavior)

```ts
  updateReportSection: async (id, key, value) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, reportSections: { ...x.reportSections, [key]: value } }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.updateReportSection(realId, key, value)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend updateReportSection failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 6: Bridge `submitReport`** (actor-bearing)

```ts
  submitReport: async (id, radiologist) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'reading') return x
        realId = x.realId
        return { ...x, status: 'reported' as StudyStatus, readingBy: radiologist, reportedAt: new Date().toISOString() }
      }),
    }))
    if (!realId) return
    const actor = await resolveRealRadActor()
    if (!actor) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.submitReport(realId, actor)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend submitReport failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 7: Bridge `residentSubmit`** (actor-bearing — separate transition from `submitReport`, tags `verificationLevel: 'resident'`)

```ts
  residentSubmit: async (id, resident) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'reading') return x
        realId = x.realId
        return { ...x, status: 'reported' as StudyStatus, readingBy: x.readingBy ?? resident, residentReadBy: resident, reportedAt: new Date().toISOString(), verificationLevel: 'resident' as VerificationLevel }
      }),
    }))
    if (!realId) return
    const actor = await resolveRealRadActor()
    if (!actor) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.residentSubmit(realId, actor)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend residentSubmit failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 8: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task6-verify.test.ts` — same actor-identity proof shape as Task 5's script: real `radiology`-role user with a distinct `full_name`, drive `claimReading → setAIPrelim → updateReportSection('findings', ...) → submitReport` through the store's own actions (passing local demo `RadTech` objects), re-query the real row and assert `reading_by.id`/`reported_at`/`report_sections.findings`/`ai_prelim` all match, with `reading_by.id !== 'RD-202'`. A second scenario exercises `residentSubmit` and asserts `resident_read_by.id === radUserId` and `verification_level === 'resident'`. A third scenario is the demo-seeded (`RS-106`, no `realId`) safety check.

Run: `npx vitest run src/store/__tests__/_throwaway-task6-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task6-verify.test.ts
```

- [ ] **Step 9: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useRadiologyStudiesStore.ts
```

---

### Task 7: Bridge verification/release — `consultantVerify`, `verifyAndRelease`, `cancelStudy`

**Files:**
- Modify: `src/store/useRadiologyStudiesStore.ts`

**Interfaces:**
- Consumes: `resolveRealRadActor` (Task 5), `RadiologyStudies.verifyAndRelease/cancelStudy` (Task 2).

**Design decision — `consultantVerify` reuses `verifyAndRelease`'s bridge, not a separate one.** The existing local `consultantVerify` action (lines 565-568) already delegates to `get().verifyAndRelease(id, verifier)` after its own `set()` tags `verificationLevel: 'consultant'` on the study — this is unchanged, pre-existing local behavior this task does not touch. Because `verifyAndRelease`'s own `set()` (below) reads `x.verificationLevel` *after* `consultantVerify`'s preceding `set()` already flipped it, the snapshot naturally captures `'consultant'` when called via that path, and `undefined` when `verifyAndRelease` is called directly (e.g. from `src/app/radiology/verification/page.tsx`'s plain verify flow). No new bridge or parameter is needed on `consultantVerify` itself — the real write's `verificationLevel` argument is simply threaded through from what `verifyAndRelease`'s snapshot already captured.

- [ ] **Step 1: Change the `State` interface signatures**

```ts
  verifyAndRelease: (id: string, verifier: RadTech) => Promise<void>
  cancelStudy: (id: string, reason?: string) => Promise<void>
```

(`consultantVerify`'s own signature is unchanged — it was already `(id, verifier) => void`/delegates, and stays `void` since it has no `await` of its own beyond the fire-and-forget call to `get().verifyAndRelease(...)`, matching how Lab's `consultantVerify`-equivalent constructs were never separately awaited either. Confirmed via `grep -rn "await (verifyAndRelease|cancelStudy|consultantVerify)(" src/app/radiology` — 0 matches, so leaving `consultantVerify` synchronous while `verifyAndRelease` becomes async is safe — zustand's `set()` calls inside `consultantVerify` still run synchronously before it returns, and the subsequent `get().verifyAndRelease(...)` call fires its own promise which the caller never awaits either way, matching pre-existing behavior exactly.)

- [ ] **Step 2: Bridge `verifyAndRelease`** (actor-bearing; keeps the existing local critical-finding notification untouched — that is explicitly a local-only UI concern, never mirrored to the backend)

Replace:

```ts
  verifyAndRelease: (id, verifier) => {
    let released: RadiologyStudy | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'reported') return x
        const updated: RadiologyStudy = {
          ...x,
          status: 'released',
          verifiedBy: verifier,
          verifiedAt: new Date().toISOString(),
          releasedAt: new Date().toISOString(),
        }
        released = updated
        return updated
      }),
    }))
    if (released) {
      const r = released
      const impression = r.reportSections.impression ?? ''
      const critical = isCriticalImpression(impression) ||
        Object.values(r.reportSections).some(v => isCriticalImpression(v))
      useNotificationStore.getState().add({
        type: 'lab_result',
        priority: critical ? 'high' : 'medium',
        title: critical ? 'Critical radiology finding' : 'Radiology report ready',
        body: `${r.name} for ${r.patientName} — ${impression ? impression.slice(0, 120) : 'report verified'}`,
        targetRole: 'doctor',
        patientName: r.patientName,
        channels: ['in_app'],
      })
    }
  },
```

with:

```ts
  verifyAndRelease: async (id, verifier) => {
    let released: RadiologyStudy | undefined
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'reported') return x
        realId = x.realId
        const updated: RadiologyStudy = {
          ...x,
          status: 'released',
          verifiedBy: verifier,
          verifiedAt: new Date().toISOString(),
          releasedAt: new Date().toISOString(),
        }
        released = updated
        return updated
      }),
    }))
    if (released) {
      const r = released
      const impression = r.reportSections.impression ?? ''
      const critical = isCriticalImpression(impression) ||
        Object.values(r.reportSections).some(v => isCriticalImpression(v))
      useNotificationStore.getState().add({
        type: 'lab_result',
        priority: critical ? 'high' : 'medium',
        title: critical ? 'Critical radiology finding' : 'Radiology report ready',
        body: `${r.name} for ${r.patientName} — ${impression ? impression.slice(0, 120) : 'report verified'}`,
        targetRole: 'doctor',
        patientName: r.patientName,
        channels: ['in_app'],
      })
    }

    // Phase 5 Task 7 — additive bridge into the real backend. `released` is
    // only set when the local study was actually `reported` (matching the
    // existing local guard), and `released.verificationLevel` (already
    // 'consultant' if this call arrived via consultantVerify's delegation,
    // else undefined) is threaded straight through — see this task's design
    // note above.
    if (!realId || !released) return
    const actor = await resolveRealRadActor()
    if (!actor) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.verifyAndRelease(realId, actor, released.verificationLevel)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend verifyAndRelease failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 3: Bridge `cancelStudy`** (no actor)

```ts
  cancelStudy: async (id, reason) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, status: 'cancelled' as StudyStatus, cancelReason: reason }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.cancelStudy(realId, reason)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend cancelStudy failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 4: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task7-verify.test.ts` — drive a real study through `claimReading → submitReport → verifyAndRelease` (plain path, asserting real `verification_level` stays `null`) and a second real study through `claimReading → residentSubmit → consultantVerify` (asserting real `verification_level === 'consultant'` after the consultant step, and `verified_by.id === radUserId` with a `full_name` distinct from the local demo `RAD_DRGUPTA`). A third scenario calls `cancelStudy` on a freshly-ordered real study and confirms `status === 'cancelled'`/`cancel_reason` matches. A fourth is the demo-seeded (`RS-107`, no `realId`) safety check.

Run: `npx vitest run src/store/__tests__/_throwaway-task7-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task7-verify.test.ts
```

- [ ] **Step 5: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions.
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useRadiologyStudiesStore.ts
```

---

### Task 8: Bridge post-release actions — `logCallback`, `ackResult`, `startEscalation`, `ackEscalation`, `recordDistribution`, `linkPrior`, `setNoShowRisk`, `setPredictedDuration`

**Files:**
- Modify: `src/store/useRadiologyStudiesStore.ts`

**Interfaces:**
- Consumes: `RadiologyStudies.logCallback/ackResult/startEscalation/ackEscalation/recordDistribution/linkPrior/setNoShowRisk/setPredictedDuration` (Task 2).

None of these eight actions carries an `actor: RadTech` parameter in the local store (`logCallback`/`ackEscalation` take plain string labels, not roster objects — mirroring Lab's `LabCallbackSchema.calledBy: string`, a free-text field with no impersonation-risk identity), so every bridge below is live-session-only, no `resolveRealRadActor` call.

- [ ] **Step 1: Change the `State` interface signatures**

```ts
  logCallback: (id: string, calledBy: string, recipient: string) => Promise<void>
  ackResult: (id: string) => Promise<void>
  setNoShowRisk: (id: string, risk: number) => Promise<void>
  setPredictedDuration: (id: string, minutes: number) => Promise<void>
  recordDistribution: (id: string, entry: DistributionEntry) => Promise<void>
  startEscalation: (id: string) => Promise<void>
  ackEscalation: (id: string, by: string) => Promise<void>
  linkPrior: (id: string, priorId: string) => Promise<void>
```

Confirmed safe via `grep -rn "await (logCallback|ackResult|setNoShowRisk|setPredictedDuration|recordDistribution|startEscalation|ackEscalation|linkPrior)(" src/app/radiology` — 0 matches.

- [ ] **Step 2: Bridge `logCallback`**

```ts
  logCallback: async (id, calledBy, recipient) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, callback: { calledBy, recipient, calledAt: new Date().toISOString() } }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.logCallback(realId, calledBy, recipient)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend logCallback failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 3: Bridge `ackResult`**

```ts
  ackResult: async (id) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, acknowledgedAt: new Date().toISOString() }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.ackResult(realId)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend ackResult failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 4: Bridge `setNoShowRisk`**

```ts
  setNoShowRisk: async (id, risk) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, noShowRisk: risk }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.setNoShowRisk(realId, risk)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend setNoShowRisk failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 5: Bridge `setPredictedDuration`**

```ts
  setPredictedDuration: async (id, minutes) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, predictedDurationMin: minutes }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.setPredictedDuration(realId, minutes)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend setPredictedDuration failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 6: Bridge `recordDistribution`**

```ts
  recordDistribution: async (id, entry) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, distribution: [...(x.distribution ?? []), entry] }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.recordDistribution(realId, entry)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend recordDistribution failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 7: Bridge `startEscalation`**

```ts
  startEscalation: async (id) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        const level = (x.escalation?.level ?? 0) + 1
        return { ...x, escalation: { startedAt: x.escalation?.startedAt ?? new Date().toISOString(), level, acknowledgedAt: undefined } }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.startEscalation(realId)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend startEscalation failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 8: Bridge `ackEscalation`**

```ts
  ackEscalation: async (id, by) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || !x.escalation) return x
        realId = x.realId
        return { ...x, escalation: { ...x.escalation, acknowledgedAt: new Date().toISOString(), acknowledgedBy: by } }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.ackEscalation(realId, by)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend ackEscalation failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 9: Bridge `linkPrior`**

```ts
  linkPrior: async (id, priorId) => {
    let realId: string | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id) return x
        realId = x.realId
        return { ...x, comparisonPriorId: priorId }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { RadiologyStudies } = await import('@/lib/api')
      await RadiologyStudies.linkPrior(realId, priorId)
    } catch (err) {
      console.error('[useRadiologyStudiesStore] real backend linkPrior failed (local study still updated):', err)
    }
  },
```

- [ ] **Step 10: Write and run a throwaway verification script**

`src/store/__tests__/_throwaway-task8-verify.test.ts` — drive a real released study (via Tasks 3-7's chain) through `logCallback → ackResult → startEscalation → ackEscalation → recordDistribution → linkPrior → setNoShowRisk → setPredictedDuration`, re-querying the real row after each call and asserting `callback`/`acknowledged_at`/`escalation.level`/`escalation.acknowledged_by`/`distribution`/`comparison_prior_id`/`no_show_risk`/`predicted_duration_min` all match. Plus the demo-seeded (`RS-109`, no `realId`) safety check for all eight actions.

Run: `npx vitest run src/store/__tests__/_throwaway-task8-verify.test.ts`
Expected: PASS.

```bash
rm src/store/__tests__/_throwaway-task8-verify.test.ts
```

- [ ] **Step 11: Run the full suite and `tsc`, stage**

Run: `npm test` — zero regressions; this is the last task in the phase, so also confirm the running total matches Task 1's baseline plus Task 2's 26 new committed tests (schema + repository), with no other net-new committed test files (every bridge task's verification script was throwaway).
Run: `npx tsc --noEmit` — clean.

```bash
git add src/store/useRadiologyStudiesStore.ts
```

---

## What this plan deliberately does not do

- **No changes to `src/lib/api/radiology.ts`'s existing `RadStudySchema`/`Radiology` module** — that stays exactly as it is: an orphaned scaffold with zero non-comment imports anywhere, unrelated to this phase's new table.
- **No changes to `src/lib/radiologyAI.ts`** — its 382 lines are a purely-deterministic client-side AI-heuristics engine with zero backend dependency; nothing there needs a bridge.
- **No changes to the patient-facing read surface** (`src/app/patient/radiology/page.tsx`) — that page reads `useRadiologyStudiesStore` directly today and needs no backend bridge of its own; a future patient-portal phase may add real patient-scoped RLS reads, out of scope here.
- **No reception/admin oversight read policies, no patient-self RLS read access** — none are exercised by the current store, consistent with how Phase 4 deferred the analogous items for Lab.
- **No cross-tab merge logic invented for `useRadiologyStudiesStore`'s persisted storage** — Task 3's storage fix only resolves the Node/SSR crash (same minimal `isBrowser` guard as `_core.ts`'s helpers); Lab's `mergingStorage` cross-tab convergent-merge behavior is a separate feature this store has never had and this phase does not add.

## Next step after this plan ships

Pharmacy, then OPD/IPD — per the roadmap noted at the end of Phase 4's plan.

---

## Self-review

**1. Spec coverage.** All 8 requested tasks are present and match the requested granularity: (1) schema+RLS with an explicit jsonb-vs-child-table design note, (2) repository module, (3) order rewire with an explicit dispatchRadOrder-vs-store-addOrder design note, (4) schedule/arrival/consent, (5) acquisition + `resolveRealRadActor`, (6) reading/report, (7) verification/release, (8) post-release actions. Every one of the 27 store actions listed in the task background (`addOrder` via Task 3's `create`, plus the other 26) has a named bridge in exactly one task — cross-checked against the interface lists in Tasks 4-8 and Task 2's repository method list; no action was left unbridged and none is bridged twice. The `role_t` enum was verified against the real Phase 1 migration (`radiology` is a real value, confirmed, not assumed). `orders`'s existing `dispatchRadOrder` bridge (lines 707-732 pre-Task-3) was read in full and correctly identified as "already does the `Orders.create()` part" — this plan only adds the follow-up `radiology_studies` materialization, never re-plans the `orders` bridge itself.

**2. Placeholder scan.** No "TBD"/"similar to Task N"/"add appropriate error handling" language appears in any code step. Task 4's verification-script step (Step 5) and Task 6/7/8's verification-script steps summarize the *scenario* rather than reproducing 100+ lines of boilerplate auth-fixture setup identical to Task 3/5's fully-written-out scripts — this is a deliberate, bounded exception (the fixture pattern is fully specified once, verbatim, in Task 2's committed test and Task 3/5's fully-written throwaway scripts; Tasks 4/6/7/8 name the exact assertions required rather than leaving genuinely unspecified work). Every piece of *shipped* code (migration DDL, repository module, every store bridge, the `dispatchRadOrder` rewrite) is written out in full, not summarized.

**3. Type consistency.** `RadTech` (store) ↔ `RadTechSchema`/`RadTech` (repo, Task 2) — both `{id: string, name: string}`, consistent. `RadiologyStudy.realId?: string` (Task 3) is referenced identically in Tasks 4-8's every bridge. `resolveRealRadActor()` (Task 5) has a single definition reused verbatim by Tasks 6-7 — no signature drift. `expectedTatMin` spelling is used consistently in the Zod schema (Task 2), the migration's `expected_tat_min` column (Task 1), and the `dispatchRadOrder` bridge call (Task 3) — never `expectedTATmin` outside the local store's own type, where it is read from (`cat.expectedTATmin`) but always re-spelled at the repo boundary. `RadiologyStudies.verifyAndRelease(id, actor, verificationLevel?)`'s three-argument signature (Task 2) matches exactly how Task 7 calls it (`RadiologyStudies.verifyAndRelease(realId, actor, released.verificationLevel)`). The RLS policy names (`radiology_studies_all_radiology`, `radiology_studies_select_doctor`, `radiology_studies_insert_doctor`) are unique and consistently referenced across Tasks 1 and 3's migration comments.
