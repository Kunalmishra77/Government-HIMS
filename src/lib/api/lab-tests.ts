/* LabTests — bench workflow: claim -> enter results -> verify -> release, plus
 * microbiology's separate phase-advance workflow. Mirrors `TestRun` in
 * src/store/useLabOrdersStore.ts and the `lab_tests` table in
 * supabase/migrations/20260704210827_laboratory_schema.sql.
 *
 * IMPORTANT — actor identity (read before wiring a UI bridge to this module):
 * `assignedTo`/`enteredBy`/`verifiedBy` are jsonb LabTech objects
 * ({id, name, bench?}), NOT profiles FKs — the real lab roster (TECH_RAVI,
 * DR_PATHO, ...) plus the synthetic 'ANLZ' analyzer actor isn't backed by
 * Supabase-authenticated users (see the laboratory_schema migration's design
 * note, and Task 1's review that flagged this as a segregation-of-duties
 * risk). Every method below that records who performed an action takes that
 * identity as an explicit `actor: LabTech` parameter — never folded into a
 * generic partial-update object — specifically so the parameter is visibly
 * "the acting identity," not just another field to fill from whatever's
 * lying around in local state.
 *
 * This module does NOT and CANNOT verify `actor` is truthful — it is a dumb
 * persistence layer, same as every other src/lib/api/* module. Enforcing
 * "actor must be the real signed-in user" is the CALLER's job: the future
 * UI-bridge code (Phase 4 Tasks 5/6/7, wiring useLabOrdersStore.ts's claim/
 * finishEntry/verifyTest/microRelease actions) MUST source `actor` from a
 * live `getSupabaseClient().auth.getSession()`, never from the local
 * Zustand/UI-selected `LabTech` the store already carries — otherwise any
 * caller could claim to be any tech, including the verifying pathologist,
 * which would poison the audit trail. The one legitimate exception is the
 * 'ANLZ' analyzer actor: a fixed, server-known system constant with no live
 * session, not a spoofable human identity. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'
import { LabRejectReason } from './lab-specimens'

export { LabRejectReason }

export const LabBench = z.enum(['HEMA', 'BIOCHEM', 'IMMUNO', 'URINE', 'MICRO', 'HISTO'])
export const LabPriority = z.enum(['STAT', 'Urgent', 'Routine'])
export const LabTestStatus = z.enum([
  'awaiting_collection', 'collected', 'on_bench', 'in_progress',
  'entered', 'verified', 'released', 'rejected', 'recollect_requested',
])
export const LabAnalyteFlag = z.enum(['N', 'H', 'L', 'CH', 'CL'])
export const LabMicroPhase = z.enum(['inoculated', 'growth_check', 'identified', 'ast', 'final'])

// A lab-roster actor — a real signed-in tech/pathologist, or the fixed 'ANLZ'
// system constant. See the module-level note above: callers must source this
// from a live session, never from arbitrary client state.
export const LabTechSchema = z.object({
  id: z.string(),
  name: z.string(),
  bench: z.array(LabBench).optional(),
})
export type LabTech = z.infer<typeof LabTechSchema>

export const LabAnalyteResultSchema = z.object({
  analyte: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
  refLow: z.number().optional(),
  refHigh: z.number().optional(),
  critLow: z.number().optional(),
  critHigh: z.number().optional(),
  flag: LabAnalyteFlag,
})
export type LabAnalyteResult = z.infer<typeof LabAnalyteResultSchema>

export const LabMicrobioResultSchema = z.object({
  phase: LabMicroPhase,
  day: z.number(),
  growth: z.enum(['no_growth', 'growth']).optional(),
  organisms: z.array(z.object({
    name: z.string(),
    ast: z.array(z.object({
      drug: z.string(),
      result: z.enum(['S', 'I', 'R']),
      mic: z.string().optional(),
    })),
  })).optional(),
  finalReport: z.string().optional(),
})
export type LabMicrobioResult = z.infer<typeof LabMicrobioResultSchema>

export const LabCallbackSchema = z.object({
  calledBy: z.string(),
  calledAt: z.string(),
  recipient: z.string(),
  ackBy: z.string().optional(),
})

export const LabTestSchema = z.object({
  id: z.string(),                    // 'LT-...'
  orderId: z.string(),
  specimenId: z.string().optional(),
  code: z.string(),
  name: z.string(),
  bench: LabBench,
  priority: LabPriority.default('Routine'),
  status: LabTestStatus.default('awaiting_collection'),
  assignedTo: LabTechSchema.optional(),
  enteredBy: LabTechSchema.optional(),
  verifiedBy: LabTechSchema.optional(),
  releasedAt: z.string().optional(),
  rejectReason: LabRejectReason.optional(),
  recollectReason: LabRejectReason.optional(),
  // Spelled `expectedTatMin` (not the store's `expectedTATmin`) so _core.ts's
  // naive per-character camelCase<->snake_case conversion round-trips exactly
  // to/from the migration's `expected_tat_min` column — `expectedTATmin`
  // would convert to `expected_t_a_tmin` instead. A future store bridge maps
  // between the two spellings explicitly.
  expectedTatMin: z.number().int().default(60),
  orderedAt: z.string(),
  analytes: z.array(LabAnalyteResultSchema).default([]),
  micro: LabMicrobioResultSchema.optional(),
  callback: LabCallbackSchema.optional(),
  notes: z.string().optional(),
  acknowledgedAt: z.string().optional(),
  updatedAt: z.string(),
})
export type LabTest = z.infer<typeof LabTestSchema>

const labTests = table<LabTest>('lab_tests', LabTestSchema)

export const LabTests = {
  list: (filter?: (t: LabTest) => boolean) => labTests.list(filter),
  get: (id: string) => labTests.get(id),
  byOrder: (orderId: string) => labTests.list((t) => t.orderId === orderId),

  async create(input: Omit<LabTest, 'id' | 'status' | 'analytes' | 'updatedAt' | 'priority'> & {
    id?: string
    status?: LabTest['status']
    analytes?: LabAnalyteResult[]
    priority?: LabTest['priority']
  }) {
    const row: LabTest = {
      ...input,
      id: input.id ?? newId('LT'),
      status: input.status ?? 'awaiting_collection',
      analytes: input.analytes ?? [],
      priority: input.priority ?? 'Routine',
      updatedAt: isoNow(),
    }
    const saved = await labTests.insert(row)
    audit.emit({
      action: 'lab_order',
      resource: 'lab_test',
      resourceId: saved.id,
      detail: `${saved.name} ordered (${saved.bench})`,
    })
    return saved
  },

  // actor: the real signed-in lab tech claiming this test off the bench.
  // See module-level note — caller must source this from a live session.
  async claim(testId: string, actor: LabTech) {
    return labTests.patch(testId, { status: 'in_progress', assignedTo: actor, updatedAt: isoNow() })
  },

  async unclaim(testId: string) {
    // NB: `assignedTo: undefined` would NOT clear the column — _core.ts's patch()
    // passes the partial straight to Supabase's `.update()`, and JSON.stringify
    // drops undefined-valued keys before the request body is sent, so the column
    // would silently keep its previous value. An explicit `null` is required to
    // actually clear `assigned_to` in Postgres (rowToCamel maps it back to
    // `undefined` on the next read, matching this schema's `.optional()`).
    return labTests.patch(testId, {
      status: 'on_bench',
      assignedTo: null as unknown as LabTest['assignedTo'],
      updatedAt: isoNow(),
    })
  },

  // Upsert, not update-only: a real row's `analytes` starts as `[]` on
  // every insert (dispatchLabOrder never sends analyte placeholders, and the
  // doctor-side INSERT RLS policy hard-requires `analytes = '[]'::jsonb` —
  // see 20260705020000_tighten_lab_tests_insert_doctor.sql — reference
  // ranges/units live only in the client's LAB_CATALOG, by design: analytes
  // are populated by the bench, not the ordering doctor). A plain
  // find-and-replace over an empty array would silently do nothing forever,
  // discovered while verifying Phase 4 Task 5's enterAnalyte/analyzerAutoFeed
  // bridge against a real dispatched order. Appending a minimal entry when
  // not found keeps the signature unchanged (existing callers that pre-seed
  // a placeholder, e.g. this module's own test fixtures, still hit the
  // update branch and behave exactly as before).
  async enterAnalyte(testId: string, analyte: string, value: LabAnalyteResult['value'], flag?: LabAnalyteResult['flag']) {
    const t = await labTests.get(testId)
    if (!t) return undefined
    const idx = t.analytes.findIndex((a) => a.analyte === analyte)
    const analytes = idx >= 0
      ? t.analytes.map((a, i) => i === idx ? { ...a, value, flag: flag ?? a.flag } : a)
      : [...t.analytes, { analyte, value, unit: '', flag: flag ?? 'N' as const }]
    return labTests.patch(testId, { analytes, updatedAt: isoNow() })
  },

  // actor: the real signed-in lab tech who entered the result. See module-level note.
  async finishEntry(testId: string, actor: LabTech) {
    return labTests.patch(testId, { status: 'entered', enteredBy: actor, updatedAt: isoNow() })
  },

  // actor: the real signed-in pathologist verifying the result. See module-level
  // note — this is precisely the segregation-of-duties boundary Task 1's review
  // flagged: a caller that could pass any LabTech here could impersonate the
  // verifying pathologist regardless of who actually entered the result.
  async verify(testId: string, actor: LabTech) {
    const patched = await labTests.patch(testId, { status: 'verified', verifiedBy: actor, updatedAt: isoNow() })
    if (patched) {
      audit.emit({
        action: 'radiology_report_verified',  // shared "verified" audit code, same mapping useAuditStore uses for lab
        resource: 'lab_test',
        resourceId: testId,
        userId: actor.id,
        userName: actor.name,
        detail: `${patched.name} verified by ${actor.name}`,
      })
    }
    return patched
  },

  async release(testId: string) {
    const patched = await labTests.patch(testId, { status: 'released', releasedAt: isoNow(), updatedAt: isoNow() })
    if (patched) {
      const critical = patched.analytes.some((a) => a.flag === 'CH' || a.flag === 'CL')
      audit.emit({
        action: critical ? 'lab_critical_callback' : 'lab_result_released',
        resource: 'lab_test',
        resourceId: testId,
        detail: `${patched.name} released`,
      })
    }
    return patched
  },

  async reject(testId: string, reason: z.infer<typeof LabRejectReason>) {
    return labTests.patch(testId, { status: 'rejected', rejectReason: reason, updatedAt: isoNow() })
  },

  // Phase 4 Task 4 — no direct status-patch method existed for the
  // specimen-collected -> on-bench transition (useLabOrdersStore.collectOrder's
  // local logic moves every awaiting_collection test straight to 'on_bench'
  // once its specimen is collected, skipping the 'collected' status). Added
  // narrowly for that one bridge rather than a generic status setter, to keep
  // this module's actor-scoped-method convention (see the module-level note).
  async markOnBench(testId: string) {
    return labTests.patch(testId, { status: 'on_bench', updatedAt: isoNow() })
  },

  // Phase 4 Task 4 — reverses `reject`: clears rejectReason and returns the
  // test to awaiting_collection, mirroring useLabOrdersStore.recollectOrder's
  // local reset. Explicit `null` (not `undefined`) actually clears the
  // column — see unclaim()'s comment above on why undefined-valued keys never
  // reach Postgres via patch()'s JSON body.
  async recollect(testId: string) {
    return labTests.patch(testId, {
      status: 'awaiting_collection',
      rejectReason: null as unknown as LabTest['rejectReason'],
      updatedAt: isoNow(),
    })
  },

  async microAdvance(testId: string, patch: Partial<LabMicrobioResult>) {
    const t = await labTests.get(testId)
    if (!t) return undefined
    const current: LabMicrobioResult = t.micro ?? { phase: 'inoculated', day: 0 }
    return labTests.patch(testId, { micro: { ...current, ...patch }, updatedAt: isoNow() })
  },

  // actor: the real signed-in pathologist releasing the final microbiology report.
  // See module-level note.
  async microRelease(testId: string, actor: LabTech) {
    return labTests.patch(testId, {
      status: 'released', verifiedBy: actor, releasedAt: isoNow(), updatedAt: isoNow(),
    })
  },

  _table: labTests,
}
