import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useNotificationStore } from './useNotificationStore'
import { useAuditStore } from './useAuditStore'
import { LAB_CATALOG, computeFlag, type Bench, type Priority, type SpecimenType, type AnalyteSpec } from '@/lib/labCatalog'
import { evaluateReflex } from '@/lib/reflexRules'
import { getSupabaseClient } from '@/lib/supabase/client'

// ─── Domain types ──────────────────────────────────────────────────────────

export type LabSource = 'OPD' | 'IPD' | 'ICU' | 'OT' | 'ER'
export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Insurance' | 'Credit'
export type TestStatus =
  | 'awaiting_collection' | 'collected' | 'on_bench'
  | 'in_progress' | 'entered' | 'verified' | 'released'
  | 'rejected' | 'recollect_requested'
export type AnalyteFlag = 'N' | 'H' | 'L' | 'CH' | 'CL'
export type MicroPhase = 'inoculated' | 'growth_check' | 'identified' | 'ast' | 'final'
export type RejectReason = 'hemolyzed' | 'clotted' | 'insufficient' | 'wrong_tube' | 'unlabeled' | 'contaminated'

export type LabTech = { id: string; name: string; bench?: Bench[] }

export type AnalyteResult = {
  analyte: string
  value: number | string
  unit: string
  refLow?: number
  refHigh?: number
  critLow?: number
  critHigh?: number
  flag: AnalyteFlag
}

export type MicrobioResult = {
  phase: MicroPhase
  day: number
  growth?: 'no_growth' | 'growth'
  organisms?: { name: string; ast: { drug: string; result: 'S' | 'I' | 'R'; mic?: string }[] }[]
  finalReport?: string
}

export type Specimen = {
  accession: string
  orderId: string
  type: SpecimenType
  container: string
  collectedBy?: string
  collectedAt?: string
  volume?: string
  rejectReason?: RejectReason
  // Phase 4 — the real `lab_specimens.id` once this specimen has been
  // materialized in the real backend (stamped by the doctor-dashboard's
  // dispatchLabOrder via useLabOrdersStore.setRealIds, right after
  // LabSpecimens.create resolves). Same backreference pattern as
  // usePatientStore's Patient.visitId: undefined for demo-seeded orders or
  // whenever the real write never fired (no live session) — every bridge
  // keyed off this field must treat a missing realId as "no real
  // counterpart exists, skip the backend write silently".
  realId?: string
}

export type TestRun = {
  id: string
  orderId: string
  specimenId?: string
  code: string
  name: string
  bench: Bench
  priority: Priority
  status: TestStatus
  assignedTo?: LabTech
  enteredBy?: LabTech
  verifiedBy?: LabTech
  releasedAt?: string
  rejectReason?: RejectReason
  recollectReason?: RejectReason
  expectedTATmin: number
  orderedAt: string
  analytes: AnalyteResult[]
  micro?: MicrobioResult
  callback?: { calledBy: string; calledAt: string; recipient: string; ackBy?: string }
  notes?: string
  acknowledgedAt?: string
  // Set automatically on every mutation that changes this test (see stamping set
  // wrapper). Drives last-write-wins conflict resolution in the cross-tab merge.
  updatedAt?: string
  // Phase 4 — the real `lab_tests.id`, same backreference pattern as
  // Specimen.realId above (see that field's doc comment for the full
  // rationale). Set by useLabOrdersStore.setRealIds once LabTests.create
  // resolves in dispatchLabOrder.
  realId?: string
}

export type LabOrder = {
  id: string
  patientId: string
  patientName: string
  source: LabSource
  wardBed?: string
  doctorName: string
  orderedAt: string
  paymentMode: PaymentMode
  fastingStatus?: 'fasting' | 'non_fasting' | 'unknown'
  clinicalNotes?: string
  tests: TestRun[]
  specimens: Specimen[]
  // Phase 4 — the real `orders.id`, same backreference pattern as
  // Specimen.realId/TestRun.realId (see Specimen.realId's doc comment for
  // the full rationale).
  realId?: string
}

export type ReflexSuggestion = {
  id: string
  basedOnTestId: string
  patientName: string
  triggerSummary: string
  code: string
  reason: string
  createdAt: string
  orderedAt?: string
}

// Lab roster (shared constants — also exported for UI to reference "me")
export const TECH_RAVI: LabTech = { id: 'LT-101', name: 'Ravi Menon', bench: ['HEMA', 'BIOCHEM'] }
export const TECH_SHALU: LabTech = { id: 'LT-102', name: 'Shalu Iyer', bench: ['IMMUNO', 'URINE'] }
export const TECH_BIJU: LabTech = { id: 'LT-103', name: 'Biju Verma', bench: ['MICRO'] }
export const DR_PATHO: LabTech = { id: 'LP-201', name: 'Dr. Asha Rao', bench: ['HEMA', 'BIOCHEM', 'IMMUNO', 'URINE', 'MICRO'] }

// ─── Helpers ──────────────────────────────────────────────────────────────

let _accSeq = 1000
let _testSeq = 1000
let _rsSeq = 0
const nextAccession = () => `ACC-${++_accSeq}`
const nextTestId = () => `LT-${Date.now()}-${++_testSeq}`

function emptyAnalytes(code: string): AnalyteResult[] {
  const cat = LAB_CATALOG[code]
  if (!cat) return []
  return cat.analytes.map(a => ({
    analyte: a.analyte,
    value: '',
    unit: a.unit,
    refLow: a.refLow,
    refHigh: a.refHigh,
    critLow: a.critLow,
    critHigh: a.critHigh,
    flag: 'N' as AnalyteFlag,
  }))
}

function filledAnalytes(code: string, values: Record<string, number | string>): AnalyteResult[] {
  const cat = LAB_CATALOG[code]
  if (!cat) return []
  return cat.analytes.map(a => {
    const v = values[a.analyte] ?? ''
    return {
      analyte: a.analyte,
      value: v,
      unit: a.unit,
      refLow: a.refLow,
      refHigh: a.refHigh,
      critLow: a.critLow,
      critHigh: a.critHigh,
      flag: computeFlag(v, a),
    }
  })
}

// M13.9 — Deterministic plausible value generator for analyzer auto-feed.
// Uses a stable hash of testId + analyte name + bucket so the same test
// always pushes the same simulated result (matches how analyzers' QC
// would behave on real samples — same patient + same prep → same range).
// 80% within reference / 15% mildly out (H or L) / 5% critical.
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function generateAnalyzerValue(testCode: string, spec: AnalyteSpec, idx: number): number | string {
  const h = hashStr(`${testCode}:${spec.analyte}:${idx}`)
  // Bucket selection — drives whether result is normal / mild abnormal / critical.
  const bucket = h % 20  // 0-19
  const refLow = spec.refLow ?? 0
  const refHigh = spec.refHigh ?? (refLow * 2 || 100)
  const refMid = (refLow + refHigh) / 2
  const refWidth = (refHigh - refLow) || 1

  // Sub-position within band — adds variety while staying deterministic.
  const t = ((h >> 5) % 1000) / 1000

  let raw: number
  if (bucket < 16) {
    // 80% — normal, scattered across reference range
    raw = refLow + t * refWidth
  } else if (bucket < 18 && spec.critLow != null) {
    // 10% — high range (1-1.5× refHigh) toward critical
    raw = refHigh + t * (refHigh - refMid) * 0.5
  } else if (bucket < 19 && spec.critHigh != null) {
    // 5% — critical-high
    raw = (spec.critHigh ?? refHigh) + t * Math.max(1, refWidth * 0.2)
  } else if (spec.critLow != null) {
    // 5% — critical-low
    raw = (spec.critLow ?? refLow) - t * Math.max(1, refWidth * 0.2)
  } else {
    raw = refLow + t * refWidth
  }

  // Round per scale of reference — pH-like ranges get 1 decimal,
  // counts get integers, mg/dL get 1 decimal.
  if (refHigh >= 1000) return Math.round(raw)
  if (refHigh >= 100)  return Math.round(raw)
  if (refHigh >= 10)   return Math.round(raw * 10) / 10
  return Math.round(raw * 100) / 100
}

// Phase 4 Task 5 — resolves the REAL signed-in actor for a human bench action
// (claim/finishEntry), from a *live* Supabase session + a `profiles.full_name`
// lookup — never from the local `LabTech` parameter the UI passed in. That
// local parameter (e.g. TECH_RAVI, id 'LT-101') is a display-friendly demo
// roster entry, not necessarily a real `profiles.id`; mirroring it into
// `assigned_to`/`entered_by` verbatim would let any caller claim to be any
// tech, poisoning the audit trail (see src/lib/api/lab-tests.ts's
// module-level note, and Task 1's review). `benchHint` carries over the local
// LabTech's non-identity `bench` metadata only — it plays no part in who the
// actor "is". Returns undefined (skip the write) if there's no live session
// or the session has no matching profile row.
async function resolveRealActor(benchHint?: Bench[]): Promise<LabTech | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name, bench: benchHint }
}

// ─── Cross-tab convergent merge (prevents last-write-wins clobber) ──────────
// Multiple tabs (doctor, lab, reception …) each hold an independent in-memory
// copy of `orders`. Without merging, whichever tab persists last overwrites the
// whole array and can drop another tab's just-written order or reset its
// in-progress work. We merge instead of replace:
//   • orders are append-only (unique id) → union by id, no order is ever lost;
//   • each test carries an `updatedAt` stamp (set on every real mutation) →
//     last-write-wins per test, which correctly handles forward AND backward
//     transitions (unclaim, recollect) and ignores a stale tab's untouched tests.
const rev = (t: TestRun) => t.updatedAt ?? ''        // ISO strings sort chronologically
const maxRev = (tests: TestRun[]) => tests.reduce((m, t) => (rev(t) > m ? rev(t) : m), '')

function mergeTests(prev: TestRun[], next: TestRun[]): TestRun[] {
  const byId = new Map(prev.map(t => [t.id, t]))
  for (const t of next) {
    const ex = byId.get(t.id)
    // Newer updatedAt wins; tie / new test → outgoing (next).
    byId.set(t.id, !ex || rev(t) >= rev(ex) ? t : ex)
  }
  return [...byId.values()]
}

function mergeOrders(prev: LabOrder[], next: LabOrder[]): LabOrder[] {
  const byId = new Map(prev.map(o => [o.id, o]))
  for (const o of next) {
    const ex = byId.get(o.id)
    if (!ex) { byId.set(o.id, o); continue }
    const tests = mergeTests(ex.tests, o.tests)
    // Specimens lack their own stamp; take them from whichever side's tests were
    // most recently touched (collection advances both together).
    const specimens = maxRev(o.tests) >= maxRev(ex.tests) ? o.specimens : ex.specimens
    byId.set(o.id, { ...o, tests, specimens })
  }
  // Newest first by orderedAt (matches addOrder prepend behaviour).
  return [...byId.values()].sort((a, b) =>
    new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
}

function mergeById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const byId = new Map(prev.map(x => [x.id, x]))
  for (const x of next) byId.set(x.id, x)
  return [...byId.values()]
}

// Read-merge-write wrapper: every persist merges with the latest localStorage
// snapshot, so concurrent tabs converge instead of clobbering one another. The
// stored value is the Zustand persist envelope { state, version }.
//
// Phase 4 Task 4 — guarded on `isBrowser` (same pattern as _core.ts's
// readRaw/writeRaw/removeRaw), found while adding this task's real-backend
// integration test: `createJSONStorage(() => mergingStorage)` (below) always
// succeeds — `mergingStorage` is a plain object, unlike `() => localStorage`
// elsewhere, whose ReferenceError zustand's createJSONStorage catches and
// treats as "storage unavailable" — so its methods only fail lazily, the
// first time persist actually calls getItem/setItem, at which point the bare
// `localStorage` reference threw uncaught in any non-browser environment
// (SSR, this Node-based vitest suite, ...). Any store action that calls
// `set()` (e.g. addOrder/collectOrder) would crash outside a real browser.
const isBrowser = typeof window !== 'undefined'
const mergingStorage = {
  getItem: (name: string) => isBrowser ? localStorage.getItem(name) : null,
  setItem: (name: string, value: string) => {
    if (!isBrowser) return
    try {
      const incoming = JSON.parse(value)
      const existingRaw = localStorage.getItem(name)
      if (existingRaw && incoming?.state) {
        const existing = JSON.parse(existingRaw)
        const es = existing?.state ?? {}
        incoming.state.orders = mergeOrders(es.orders ?? [], incoming.state.orders ?? [])
        incoming.state.reflexSuggestions =
          mergeById(es.reflexSuggestions ?? [], incoming.state.reflexSuggestions ?? [])
        localStorage.setItem(name, JSON.stringify(incoming))
        return
      }
    } catch { /* fall through to plain write */ }
    localStorage.setItem(name, value)
  },
  removeItem: (name: string) => { if (isBrowser) localStorage.removeItem(name) },
}

// ─── State ────────────────────────────────────────────────────────────────

interface State {
  orders: LabOrder[]
  reflexSuggestions: ReflexSuggestion[]
  addOrder: (input: {
    patientId: string
    patientName: string
    source: LabSource
    wardBed?: string
    doctorName: string
    paymentMode: PaymentMode
    testCodes: string[]
    fastingStatus?: 'fasting' | 'non_fasting' | 'unknown'
    clinicalNotes?: string
  }) => string
  // Phase 4 — stamps the real order/specimen/test ids returned by
  // Orders.create/LabSpecimens.create/LabTests.create (dispatchLabOrder, in
  // src/app/doctor/dashboard/page.tsx) back onto the LOCAL order/specimens/
  // tests that produced them, so every later action here (collectOrder/
  // rejectSpecimen/recollectOrder, and future claim/finishEntry/verifyTest/
  // microRelease bridges) has an unambiguous real id to key off. Matches by
  // POSITION, not by type/code: dispatchLabOrder builds `real.specimens`/
  // `real.tests` by iterating the exact same ordered `codes` list (via the
  // same LAB_CATALOG grouping logic) that addOrder used to build the local
  // `o.specimens`/`o.tests` arrays, so index i on one side always
  // corresponds to index i on the other — including if a future caller ever
  // submits duplicate test codes (e.g. ['CBC','CBC']), which a `find(r =>
  // r.code === t.code)` lookup would ambiguously map to the same real row
  // twice. The type/code check per index is kept as a belt-and-suspenders
  // sanity check: a mismatch there means the ordering assumption above no
  // longer holds, so we skip stamping that item and warn instead of risking
  // a silent mislink.
  setRealIds: (localOrderId: string, real: {
    orderId: string
    specimens: { type: SpecimenType; realId: string }[]
    tests: { code: string; realId: string }[]
  }) => void
  collectOrder: (orderId: string, collectedBy: string) => Promise<void>
  rejectSpecimen: (orderId: string, accession: string, reason: RejectReason) => Promise<void>
  recollectOrder: (orderId: string) => Promise<void>
  claim: (testId: string, tech: LabTech) => Promise<void>
  unclaim: (testId: string) => Promise<void>
  enterAnalyte: (testId: string, analyte: string, value: number | string) => Promise<void>
  finishEntry: (testId: string, enteredBy: LabTech) => Promise<void>
  verifyTest: (testId: string, verifiedBy: LabTech) => Promise<void>
  releaseTest: (testId: string) => Promise<void>
  rejectTest: (testId: string, reason: RejectReason) => Promise<void>
  // M13.9 — analyzer auto-feed. Simulates the modern lab workflow where
  // barcoded samples are loaded onto analyzers and the analyzer pushes
  // results back over HL7/ASTM (no human typing). Generates realistic
  // values within reference / occasionally flagged ranges + audit row.
  analyzerAutoFeed: (testId: string) => Promise<void>
  microAdvance: (testId: string, patch: Partial<MicrobioResult>) => Promise<void>
  microRelease: (testId: string, verifiedBy: LabTech) => Promise<void>
  logCallback: (testId: string, calledBy: string, recipient: string) => void
  ackResult: (testId: string) => void
  pushReflex: (s: Omit<ReflexSuggestion, 'id' | 'createdAt'>) => void
  orderReflex: (suggestionId: string) => Promise<void>
  dismissReflex: (suggestionId: string) => Promise<void>
}

// ─── Seed builder ─────────────────────────────────────────────────────────

type SeedTest = {
  code: string
  status: TestStatus
  values?: Record<string, number | string>
  micro?: MicrobioResult
  assignedTo?: LabTech
  enteredBy?: LabTech
  verifiedBy?: LabTech
  releasedMinAgo?: number
  callback?: TestRun['callback']
}

function buildSeedOrder(p: {
  id: string
  patientId: string
  patientName: string
  source: LabSource
  wardBed?: string
  doctorName: string
  orderedMinAgo: number
  paymentMode: PaymentMode
  collected: boolean
  collectedMinAgo?: number
  collectedBy?: string
  tests: SeedTest[]
}): LabOrder {
  const orderedAt = new Date(Date.now() - p.orderedMinAgo * 60000).toISOString()
  const collectedAt = p.collected ? new Date(Date.now() - (p.collectedMinAgo ?? 5) * 60000).toISOString() : undefined

  // Group test codes by specimen type to de-dup specimens.
  const specimensByType = new Map<SpecimenType, Specimen>()
  for (const t of p.tests) {
    const cat = LAB_CATALOG[t.code]
    if (!cat) continue
    if (!specimensByType.has(cat.specimen)) {
      specimensByType.set(cat.specimen, {
        accession: `ACC-${p.id.slice(3)}-${cat.specimen.slice(0, 4).toUpperCase()}`,
        orderId: p.id,
        type: cat.specimen,
        container: cat.container,
        collectedBy: p.collected ? (p.collectedBy ?? 'Phlebo Saira') : undefined,
        collectedAt,
      })
    }
  }

  const tests: TestRun[] = p.tests.map((t, i) => {
    const cat = LAB_CATALOG[t.code]!
    const spec = specimensByType.get(cat.specimen)
    return {
      id: `LT-${p.id.slice(3)}-${i + 1}`,
      orderId: p.id,
      specimenId: spec?.accession,
      code: t.code,
      name: cat.name,
      bench: cat.bench,
      priority: cat.defaultPriority,
      status: t.status,
      assignedTo: t.assignedTo,
      enteredBy: t.enteredBy,
      verifiedBy: t.verifiedBy,
      releasedAt: t.status === 'released' ? new Date(Date.now() - (t.releasedMinAgo ?? 20) * 60000).toISOString() : undefined,
      expectedTATmin: cat.expectedTATmin ?? (cat.expectedDays ? cat.expectedDays * 24 * 60 : 60),
      orderedAt,
      analytes: t.values ? filledAnalytes(t.code, t.values) : emptyAnalytes(t.code),
      micro: t.micro,
      callback: t.callback,
    }
  })

  return {
    id: p.id,
    patientId: p.patientId,
    patientName: p.patientName,
    source: p.source,
    wardBed: p.wardBed,
    doctorName: p.doctorName,
    orderedAt,
    paymentMode: p.paymentMode,
    tests,
    specimens: Array.from(specimensByType.values()),
  }
}

const SEED_ORDERS: LabOrder[] = [
  // LO-401: Aarav Sharma — OPD CBC on bench, unclaimed
  buildSeedOrder({
    id: 'LO-401', patientId: 'PT-10234', patientName: 'Aarav Sharma', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 50, paymentMode: 'UPI',
    collected: true, collectedMinAgo: 40,
    tests: [{ code: 'CBC', status: 'on_bench' }],
  }),

  // LO-402: Sunita Sharma — IPD multi-test, mixed statuses
  buildSeedOrder({
    id: 'LO-402', patientId: 'PT-10235', patientName: 'Sunita Sharma', source: 'IPD', wardBed: 'Ward A — 7',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 130, paymentMode: 'Insurance',
    collected: true, collectedMinAgo: 115,
    tests: [
      // CBC claimed by Ravi, in progress (no values yet)
      { code: 'CBC', status: 'in_progress', assignedTo: TECH_RAVI },
      // LFT entered by Ravi, awaiting verify
      { code: 'LFT', status: 'entered', assignedTo: TECH_RAVI, enteredBy: TECH_RAVI,
        values: { 'Total bilirubin': 1.0, 'Direct bilirubin': 0.2, 'AST (SGOT)': 38, 'ALT (SGPT)': 42, 'ALP': 110, 'Albumin': 4.2 } },
      // RFT verified by Dr. Patho, awaiting release
      { code: 'RFT', status: 'verified', assignedTo: TECH_RAVI, enteredBy: TECH_RAVI, verifiedBy: DR_PATHO,
        values: { 'Urea': 18, 'Creatinine': 1.1, 'Sodium': 140, 'Potassium': 4.2, 'Chloride': 103 } },
      // CRP released — critical (155 mg/L, ref ≤5, crit ≥100). No callback logged.
      { code: 'CRP', status: 'released', assignedTo: TECH_RAVI, enteredBy: TECH_RAVI, verifiedBy: DR_PATHO,
        releasedMinAgo: 8, values: { 'CRP': 155 } },
      // Blood culture — in progress, growth check on day 1
      { code: 'CULT_BLOOD', status: 'in_progress', assignedTo: TECH_BIJU,
        micro: { phase: 'growth_check', day: 1, growth: 'growth' } },
    ],
  }),

  // LO-403: Ramesh Kumar — OPD, both still awaiting collection
  buildSeedOrder({
    id: 'LO-403', patientId: 'PT-10236', patientName: 'Ramesh Kumar', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 12, paymentMode: 'Cash',
    collected: false,
    tests: [
      { code: 'LIPID', status: 'awaiting_collection' },
      { code: 'HBA1C', status: 'awaiting_collection' },
    ],
  }),

  // LO-404: Meera Pillai — OPD RFT released, normal
  buildSeedOrder({
    id: 'LO-404', patientId: 'PT-20391', patientName: 'Meera Pillai', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 80, paymentMode: 'UPI',
    collected: true, collectedMinAgo: 70,
    tests: [
      { code: 'RFT', status: 'released', assignedTo: TECH_RAVI, enteredBy: TECH_RAVI, verifiedBy: DR_PATHO,
        releasedMinAgo: 25, values: { 'Urea': 16, 'Creatinine': 0.9, 'Sodium': 138, 'Potassium': 4.1, 'Chloride': 102 } },
    ],
  }),

  // LO-405: Kiran Patil — ER, TROPI critical-high released (no callback yet), CBC verified
  buildSeedOrder({
    id: 'LO-405', patientId: 'PT-20394', patientName: 'Kiran Patil', source: 'ER',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 35, paymentMode: 'Card',
    collected: true, collectedMinAgo: 28,
    tests: [
      // Troponin I critical-high (0.92, crit ≥0.5). No callback logged.
      { code: 'TROPI', status: 'released', assignedTo: TECH_SHALU, enteredBy: TECH_SHALU, verifiedBy: DR_PATHO,
        releasedMinAgo: 12, values: { 'Troponin I': 0.92 } },
      // CBC verified — pending release
      { code: 'CBC', status: 'verified', assignedTo: TECH_RAVI, enteredBy: TECH_RAVI, verifiedBy: DR_PATHO,
        values: { 'Haemoglobin': 14.2, 'WBC count': 9800, 'Platelets': 280, 'RBC count': 4.9, 'Haematocrit': 42, 'MCV': 88, 'Neutrophils': 62 } },
    ],
  }),

  // ── Microbiology phase coverage ─────────────────────────────────────────
  // LO-406: Asha Bhat — IPD urine culture freshly inoculated (day 0)
  buildSeedOrder({
    id: 'LO-406', patientId: 'PT-10240', patientName: 'Asha Bhat', source: 'IPD', wardBed: 'Ward B — 12',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 240, paymentMode: 'Insurance',
    collected: true, collectedMinAgo: 220,
    tests: [
      { code: 'CULT_URINE', status: 'in_progress', assignedTo: TECH_BIJU,
        micro: { phase: 'inoculated', day: 0 } },
    ],
  }),

  // LO-407: Manish Yadav — OPD wound culture, organism identified (day 2)
  buildSeedOrder({
    id: 'LO-407', patientId: 'PT-10241', patientName: 'Manish Yadav', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 48 * 60, paymentMode: 'Cash',
    collected: true, collectedMinAgo: 47 * 60,
    tests: [
      { code: 'CULT_WOUND', status: 'in_progress', assignedTo: TECH_BIJU,
        micro: {
          phase: 'identified', day: 2,
          organisms: [{ name: 'Staphylococcus aureus', ast: [] }],
        } },
    ],
  }),

  // LO-408: Vivek Sharma — IPD blood culture, AST in review (day 3, partial sensitivities)
  buildSeedOrder({
    id: 'LO-408', patientId: 'PT-10242', patientName: 'Vivek Sharma', source: 'IPD', wardBed: 'Ward A — 9',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 72 * 60, paymentMode: 'Credit',
    collected: true, collectedMinAgo: 71 * 60,
    tests: [
      { code: 'CULT_BLOOD', status: 'in_progress', assignedTo: TECH_BIJU,
        micro: {
          phase: 'ast', day: 3,
          organisms: [{
            name: 'Escherichia coli',
            ast: [
              { drug: 'Ceftriaxone',   result: 'S' },
              { drug: 'Ciprofloxacin', result: 'R' },
              { drug: 'Gentamicin',    result: 'S' },
              { drug: 'Meropenem',     result: 'S' },
            ],
          }],
        } },
    ],
  }),

  // LO-409: Priya Gupta — OPD urine culture finalised + released (day 2)
  buildSeedOrder({
    id: 'LO-409', patientId: 'PT-10243', patientName: 'Priya Gupta', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 48 * 60, paymentMode: 'UPI',
    collected: true, collectedMinAgo: 47 * 60,
    tests: [
      { code: 'CULT_URINE', status: 'released', assignedTo: TECH_BIJU, verifiedBy: DR_PATHO,
        releasedMinAgo: 30,
        micro: {
          phase: 'final', day: 2,
          organisms: [{
            name: 'Escherichia coli',
            ast: [
              { drug: 'Nitrofurantoin', result: 'S' },
              { drug: 'Ciprofloxacin',  result: 'R' },
              { drug: 'Ceftriaxone',    result: 'S' },
            ],
          }],
          finalReport: 'Significant growth of E. coli — sensitive to nitrofurantoin and ceftriaxone, resistant to ciprofloxacin. Treat based on AST.',
        } },
    ],
  }),

  // ── M13.1 — Fresh today's work for the phlebotomy bench demo ──────────
  // LO-410: Rajesh Khanna — STAT cardiac panel from cards OPD, just ordered
  buildSeedOrder({
    id: 'LO-410', patientId: 'PT-20401', patientName: 'Rajesh Khanna', source: 'OPD',
    doctorName: 'Dr. Rohan Mehta', orderedMinAgo: 6, paymentMode: 'Insurance',
    collected: false,
    tests: [
      { code: 'TROPI', status: 'awaiting_collection' },
      { code: 'CBC', status: 'awaiting_collection' },
    ],
  }),
  // LO-411: Mohan Iyengar — CKD-IV labs, STAT
  buildSeedOrder({
    id: 'LO-411', patientId: 'PT-20407', patientName: 'Mohan Iyengar', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 4, paymentMode: 'Cash',
    collected: false,
    tests: [
      { code: 'RFT', status: 'awaiting_collection' },
      { code: 'CBC', status: 'awaiting_collection' },
    ],
  }),
  // LO-412: Anil Kumar Verma — IPD CBC + LFT, just collected, on bench
  buildSeedOrder({
    id: 'LO-412', patientId: 'PT-44012', patientName: 'Anil Kumar Verma', source: 'IPD', wardBed: 'Ward A — 5',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 38, paymentMode: 'Insurance',
    collected: true, collectedMinAgo: 25, collectedBy: 'Phlebo Saira',
    tests: [
      { code: 'CBC', status: 'on_bench' },
      { code: 'LFT', status: 'on_bench' },
    ],
  }),
  // LO-413: Latha Subramaniam — OPD HbA1c routine, ready for pathologist verify
  buildSeedOrder({
    id: 'LO-413', patientId: 'PT-20404', patientName: 'Latha Subramaniam', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 110, paymentMode: 'UPI',
    collected: true, collectedMinAgo: 95,
    tests: [
      { code: 'HBA1C', status: 'entered', assignedTo: TECH_SHALU, enteredBy: TECH_SHALU,
        values: { 'HbA1c': 7.4 } },
    ],
  }),
  // LO-414: Vikas Joshi — STAT ECG-equivalent panel, on bench
  buildSeedOrder({
    id: 'LO-414', patientId: 'PT-20399', patientName: 'Vikas Joshi', source: 'OPD',
    doctorName: 'Dr. Rohan Mehta', orderedMinAgo: 18, paymentMode: 'Card',
    collected: true, collectedMinAgo: 12,
    tests: [
      { code: 'LIPID', status: 'on_bench' },
    ],
  }),
]

// ─── Store ────────────────────────────────────────────────────────────────

export const useLabOrdersStore = create<State>()(persist((rawSet, get) => {
  // Stamping set wrapper: whenever an action produces a new/changed test object
  // (detected by reference inequality vs. the previous state — actions return the
  // same `t` reference for untouched tests), we tag it with `updatedAt`. This is
  // what makes the cross-tab merge a correct last-write-wins (see mergeTests).
  const set: typeof rawSet = ((partial, replace) => {
    rawSet((state) => {
      const next = typeof partial === 'function'
        ? (partial as (s: State) => Partial<State>)(state)
        : partial
      if (next && Array.isArray(next.orders)) {
        const prevTests = new Map<string, TestRun>()
        for (const o of state.orders) for (const t of o.tests) prevTests.set(t.id, t)
        const now = new Date().toISOString()
        next.orders = next.orders.map(o => {
          let changed = false
          const tests = o.tests.map(t => {
            if (prevTests.get(t.id) === t) return t   // untouched → keep stamp
            changed = true
            return { ...t, updatedAt: now }            // new or modified → stamp
          })
          return changed ? { ...o, tests } : o
        })
      }
      return next
    }, replace as false | undefined)
  }) as typeof rawSet

  return {
  orders: SEED_ORDERS,
  reflexSuggestions: [],

  addOrder: (input) => {
    const id = `LO-${Date.now()}`
    const orderedAt = new Date().toISOString()
    const specimensByType = new Map<SpecimenType, Specimen>()
    for (const code of input.testCodes) {
      const cat = LAB_CATALOG[code]
      if (!cat) continue
      if (!specimensByType.has(cat.specimen)) {
        specimensByType.set(cat.specimen, {
          accession: nextAccession(),
          orderId: id,
          type: cat.specimen,
          container: cat.container,
        })
      }
    }
    const tests: TestRun[] = []
    for (const code of input.testCodes) {
      const cat = LAB_CATALOG[code]
      if (!cat) continue
      const spec = specimensByType.get(cat.specimen)
      tests.push({
        id: nextTestId(),
        orderId: id,
        specimenId: spec?.accession,
        code,
        name: cat.name,
        bench: cat.bench,
        priority: cat.defaultPriority,
        status: 'awaiting_collection',
        expectedTATmin: cat.expectedTATmin ?? (cat.expectedDays ? cat.expectedDays * 24 * 60 : 60),
        orderedAt,
        analytes: emptyAnalytes(code),
      })
    }
    const order: LabOrder = {
      id,
      patientId: input.patientId,
      patientName: input.patientName,
      source: input.source,
      wardBed: input.wardBed,
      doctorName: input.doctorName,
      orderedAt,
      paymentMode: input.paymentMode,
      fastingStatus: input.fastingStatus,
      clinicalNotes: input.clinicalNotes,
      tests,
      specimens: Array.from(specimensByType.values()),
    }
    set(s => ({ orders: [order, ...s.orders] }))
    useAuditStore.getState().log({
      userId: 'LAB-SYS', userName: input.doctorName ?? 'Lab',
      action: 'lab_order', resource: 'lab_order', resourceId: id,
      detail: `${input.patientName} · ${tests.length} test(s) ordered (${input.source})`,
    })
    return id
  },

  setRealIds: (localOrderId, real) => set(s => ({
    orders: s.orders.map(o => o.id !== localOrderId ? o : ({
      ...o,
      realId: real.orderId,
      specimens: o.specimens.map((sp, i) => {
        const match = real.specimens[i]
        if (!match) return sp
        if (match.type !== sp.type) {
          console.warn(`[useLabOrdersStore] setRealIds: specimen index ${i} type mismatch for order ${localOrderId} (local=${sp.type}, real=${match.type}) — skipping realId link`)
          return sp
        }
        return { ...sp, realId: match.realId }
      }),
      tests: o.tests.map((t, i) => {
        const match = real.tests[i]
        if (!match) return t
        if (match.code !== t.code) {
          console.warn(`[useLabOrdersStore] setRealIds: test index ${i} code mismatch for order ${localOrderId} (local=${t.code}, real=${match.code}) — skipping realId link`)
          return t
        }
        return { ...t, realId: match.realId }
      }),
    })),
  })),

  collectOrder: async (orderId, collectedBy) => {
    const at = new Date().toISOString()
    // Snapshot before the local mutation — decides which real specimens/tests
    // this call is actually about to advance, mirroring the local `set()`
    // logic below exactly (an already-collected specimen / a test that isn't
    // awaiting_collection is left untouched here too).
    const before = get().orders.find(o => o.id === orderId)
    const specimensToCollect = (before?.specimens ?? []).filter(sp => !sp.collectedAt && sp.realId)
    const testsToBench = (before?.tests ?? []).filter(t => t.status === 'awaiting_collection' && t.realId)

    set(s => ({
      orders: s.orders.map(o => o.id !== orderId ? o : ({
        ...o,
        specimens: o.specimens.map(sp => sp.collectedAt ? sp : ({ ...sp, collectedBy, collectedAt: at })),
        tests: o.tests.map(t => t.status === 'awaiting_collection' ? { ...t, status: 'on_bench' as TestStatus } : t),
      })),
    }))

    // Phase 4 Task 4 — additive bridge into the real backend, guarded exactly
    // like usePatientStore's addPatient/updateStatus/recordOpdVitals: a
    // *live* Supabase session (never useAuthStore — see those actions'
    // comments for why), try/catch so a backend failure never breaks the
    // local bench workflow above. Specimens/tests with no `realId` have no
    // real counterpart (demo-seeded order, or the real write in
    // dispatchLabOrder never fired) and are skipped silently.
    if (specimensToCollect.length === 0 && testsToBench.length === 0) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabSpecimens, LabTests } = await import('@/lib/api')
      await Promise.all([
        ...specimensToCollect.map(sp => LabSpecimens.collect(sp.realId!, collectedBy)),
        ...testsToBench.map(t => LabTests.markOnBench(t.realId!)),
      ])
    } catch (err) {
      console.error('[useLabOrdersStore] real backend collect failed (local order still updated):', err)
    }
  },

  rejectSpecimen: async (orderId, accession, reason) => {
    const before = get().orders.find(o => o.id === orderId)
    const specimen = before?.specimens.find(sp => sp.accession === accession)
    const affectedTests = (before?.tests ?? []).filter(t =>
      t.specimenId === accession && t.status !== 'released' && t.status !== 'verified')

    set(s => ({
      orders: s.orders.map(o => o.id !== orderId ? o : ({
        ...o,
        specimens: o.specimens.map(sp => sp.accession === accession ? { ...sp, rejectReason: reason } : sp),
        tests: o.tests.map(t => t.specimenId === accession && t.status !== 'released' && t.status !== 'verified'
          ? { ...t, status: 'rejected' as TestStatus, rejectReason: reason } : t),
      })),
    }))

    // Phase 4 Task 4 — same guarded real-backend bridge as collectOrder above.
    if (!specimen?.realId && affectedTests.every(t => !t.realId)) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabSpecimens, LabTests } = await import('@/lib/api')
      const writes: Promise<unknown>[] = []
      if (specimen?.realId) writes.push(LabSpecimens.reject(specimen.realId, reason))
      for (const t of affectedTests) if (t.realId) writes.push(LabTests.reject(t.realId, reason))
      await Promise.all(writes)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend reject failed (local order still updated):', err)
    }
  },

  recollectOrder: async (orderId) => {
    const before = get().orders.find(o => o.id === orderId)
    const specimensToRecollect = (before?.specimens ?? []).filter(sp => sp.rejectReason && sp.realId)
    const testsToRecollect = (before?.tests ?? []).filter(t => t.status === 'rejected' && t.realId)

    set(s => ({
      orders: s.orders.map(o => o.id !== orderId ? o : ({
        ...o,
        specimens: o.specimens.map(sp => sp.rejectReason ? { ...sp, rejectReason: undefined, collectedAt: undefined, collectedBy: undefined } : sp),
        tests: o.tests.map(t => t.status === 'rejected' ? { ...t, status: 'awaiting_collection' as TestStatus, rejectReason: undefined } : t),
      })),
    }))

    // Phase 4 Task 4 — same guarded real-backend bridge as collectOrder above.
    if (specimensToRecollect.length === 0 && testsToRecollect.length === 0) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabSpecimens, LabTests } = await import('@/lib/api')
      await Promise.all([
        ...specimensToRecollect.map(sp => LabSpecimens.recollect(sp.realId!)),
        ...testsToRecollect.map(t => LabTests.recollect(t.realId!)),
      ])
    } catch (err) {
      console.error('[useLabOrdersStore] real backend recollect failed (local order still updated):', err)
    }
  },

  claim: async (testId, tech) => {
    // Snapshot the real id BEFORE the local mutation, exactly like
    // collectOrder/rejectSpecimen/recollectOrder above — only a test that was
    // actually eligible (on_bench/collected) and has a real counterpart gets
    // a backend write.
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId || (t.status !== 'on_bench' && t.status !== 'collected')) return t
          realId = t.realId
          return { ...t, status: 'in_progress' as TestStatus, assignedTo: tech }
        }),
      })),
    }))

    // Phase 4 Task 5 — additive bridge into the real backend, guarded like
    // every Task 4 bridge (live session, try/catch, silent skip with no
    // realId). The actor written to `assigned_to` is resolveRealActor()'s
    // session-derived identity, NOT the local `tech` param — see that
    // function's doc comment and src/lib/api/lab-tests.ts's module note.
    if (!realId) return
    const actor = await resolveRealActor(tech.bench)
    if (!actor) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.claim(realId, actor)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend claim failed (local test still updated):', err)
    }
  },

  unclaim: async (testId) => {
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId || t.status !== 'in_progress') return t
          realId = t.realId
          return { ...t, status: 'on_bench' as TestStatus, assignedTo: undefined }
        }),
      })),
    }))

    // Phase 4 Task 5 — same guarded real-backend bridge as claim above.
    // unclaim() clears `assigned_to` unconditionally (no actor recorded —
    // see src/lib/api/lab-tests.ts's unclaim()), so this only needs a live
    // session to authorize the write under RLS, not a profile lookup.
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.unclaim(realId)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend unclaim failed (local test still updated):', err)
    }
  },

  enterAnalyte: async (testId, analyte, value) => {
    let realId: string | undefined
    let realFlag: AnalyteFlag | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId) return t
          const cat = LAB_CATALOG[t.code]
          const spec: AnalyteSpec | undefined = cat?.analytes.find(a => a.analyte === analyte)
          const flag = spec ? computeFlag(value, spec) : undefined
          realId = t.realId
          realFlag = flag
          return {
            ...t,
            analytes: t.analytes.map(a => a.analyte === analyte
              ? { ...a, value, flag: flag ?? a.flag }
              : a),
          }
        }),
      })),
    }))

    // Phase 4 Task 5 — same guarded real-backend bridge as claim above.
    // No actor recorded here (LabTests.enterAnalyte takes none), just a live
    // session to authorize the write under RLS.
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.enterAnalyte(realId, analyte, value, realFlag)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend enterAnalyte failed (local test still updated):', err)
    }
  },

  finishEntry: async (testId, enteredBy) => {
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId || t.status !== 'in_progress') return t
          realId = t.realId
          return { ...t, status: 'entered' as TestStatus, enteredBy }
        }),
      })),
    }))

    // Phase 4 Task 5 — same guarded real-backend bridge as claim above. The
    // actor written to `entered_by` is resolveRealActor()'s session-derived
    // identity, NOT the local `enteredBy` param.
    if (!realId) return
    const actor = await resolveRealActor(enteredBy.bench)
    if (!actor) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.finishEntry(realId, actor)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend finishEntry failed (local test still updated):', err)
    }
  },

  verifyTest: async (testId, verifiedBy) => {
    let verified: TestRun | undefined
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId || t.status !== 'entered') return t
          const v: TestRun = { ...t, status: 'verified', verifiedBy }
          verified = v
          realId = t.realId
          return v
        }),
      })),
    }))
    if (verified) {
      useAuditStore.getState().log({
        userId: verifiedBy.id, userName: verifiedBy.name,
        action: 'radiology_report_verified',  // shared "verified" code; module re-mapped via SEVERITY
        resource: 'lab_test', resourceId: testId,
        detail: `${verified.name} verified by ${verifiedBy.name}`,
      })
    }

    // Phase 4 Task 6 — additive bridge into the real backend, same guarded
    // shape as claim/finishEntry (Task 5): live session, try/catch, silent
    // skip with no realId. The actor written to `verified_by` is
    // resolveRealActor()'s session-derived identity, NEVER the local
    // `verifiedBy` parameter — see that helper's doc comment and
    // src/lib/api/lab-tests.ts's module note, which calls this out as
    // precisely the segregation-of-duties boundary Task 1's review flagged
    // (verified_by must be the actual pathologist, not whoever the caller
    // claims it is).
    if (!realId) return
    const actor = await resolveRealActor(verifiedBy.bench)
    if (!actor) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.verify(realId, actor)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend verify failed (local test still updated):', err)
    }
  },

  releaseTest: async (testId) => {
    let releasedTest: TestRun | undefined
    let parentOrder: LabOrder | undefined
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => {
        const tests = o.tests.map(t => {
          if (t.id !== testId || t.status !== 'verified') return t
          const updated: TestRun = { ...t, status: 'released', releasedAt: new Date().toISOString() }
          releasedTest = updated
          parentOrder = o
          realId = t.realId
          return updated
        })
        return { ...o, tests }
      }),
    }))
    let reflexMatches: ReturnType<typeof evaluateReflex> = []
    if (releasedTest && parentOrder) {
      const t = releasedTest
      const critical = t.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')
      const abnormal = t.analytes.filter(a => a.flag !== 'N')
      const summary = abnormal.length
        ? abnormal.map(a => `${a.analyte} ${a.value} ${a.unit} ${a.flag}`).join(' · ')
        : 'Within reference range'
      useNotificationStore.getState().add({
        type: 'lab_result',
        priority: critical ? 'high' : 'medium',
        title: critical ? 'Critical lab value' : 'Lab result ready',
        body: `${t.name} for ${parentOrder.patientName} — ${summary}`,
        targetRole: 'doctor',
        patientName: parentOrder.patientName,
        channels: ['in_app'],
      })
      useAuditStore.getState().log({
        userId: 'LAB-SYS', userName: 'Lab',
        action: critical ? 'lab_critical_callback' : 'lab_result_released',
        resource: 'lab_test', resourceId: testId,
        detail: `${t.name} released · ${summary}`,
      })
      // Reflex auto-trigger — any rule matches land on the incharge's reflex queue
      reflexMatches = evaluateReflex(t, parentOrder.patientName)
      for (const m of reflexMatches) get().pushReflex(m)
    }

    // Phase 4 Task 6 — additive bridge into the real backend, same guarded
    // shape as unclaim/analyzerAutoFeed (Task 5): release() takes no actor
    // (see lab-tests.ts's release() — status/releasedAt only), so this only
    // needs a live session to authorize the write under RLS, not a profile
    // lookup.
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabTests, LabReflexSuggestions } = await import('@/lib/api')
      await LabTests.release(realId)
      // Any reflex match also gets a REAL lab_reflex_suggestions row, keyed
      // off the REAL test id (not the local one — the table's FK requires an
      // actual lab_tests row), so Task 8's accept/dismiss bridge has
      // something real to act on. No actor concern here (see
      // lab-reflex-suggestions.ts's module note — this table has no
      // identity-bearing field to protect).
      for (const m of reflexMatches) {
        await LabReflexSuggestions.create({
          basedOnTestId: realId,
          patientName: m.patientName,
          triggerSummary: m.triggerSummary,
          code: m.code,
          reason: m.reason,
        })
      }
    } catch (err) {
      console.error('[useLabOrdersStore] real backend release failed (local test still updated):', err)
    }
  },

  // M13.9 — Analyzer auto-feed.
  // Simulates HL7/ASTM push from a Sysmex / Roche / Abbott / Beckman analyzer.
  // For any on-bench analyzer-feedable test, generates plausible analyte
  // values (80% within reference, 15% mildly out, 5% critical), computes
  // flags, sets status → 'entered', and stamps `enteredBy` with the
  // analyzer name so pathologists can tell "auto" from "manual".
  analyzerAutoFeed: async (testId) => {
    let order: LabOrder | undefined
    let result: TestRun | undefined
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => {
        const t = o.tests.find(x => x.id === testId)
        if (!t || t.status !== 'on_bench' && t.status !== 'collected') return o
        const cat = LAB_CATALOG[t.code]
        if (!cat || cat.micro || cat.bench === 'HISTO') return o   // manual-only
        order = o
        realId = t.realId
        const analyzerName = (cat as { analyzer?: string }).analyzer ?? 'Auto-analyzer'
        const enteredBy: LabTech = { id: 'ANLZ', name: analyzerName }
        const newAnalytes: AnalyteResult[] = cat.analytes.map((spec, idx) => {
          const value = generateAnalyzerValue(t.code, spec, idx)
          return {
            analyte: spec.analyte,
            value,
            unit: spec.unit,
            refLow: spec.refLow,
            refHigh: spec.refHigh,
            critLow: spec.critLow,
            critHigh: spec.critHigh,
            flag: computeFlag(value, spec),
          }
        })
        const updated: TestRun = {
          ...t,
          status: 'entered',
          assignedTo: enteredBy,
          enteredBy,
          analytes: newAnalytes,
        }
        result = updated
        return { ...o, tests: o.tests.map(x => x.id === testId ? updated : x) }
      }),
    }))
    if (order && result) {
      useAuditStore.getState().log({
        userId: 'ANLZ', userName: result.enteredBy?.name ?? 'Auto-analyzer',
        action: 'lab_order',
        resource: 'lab_test', resourceId: result.id,
        detail: `${result.name} auto-fed by ${result.enteredBy?.name} · ${result.analytes.filter(a => a.flag !== 'N').length} flag(s) · awaiting pathologist verification`,
      })
    }

    // Phase 4 Task 5 — additive bridge into the real backend, same guard
    // shape as claim/finishEntry above. analyzerAutoFeed is a SYSTEM action:
    // there is no human actor to authenticate, so unlike claim/finishEntry
    // this never does a profiles lookup and always records the fixed 'ANLZ'
    // constant (never the session's identity) as `entered_by` — unlike a
    // human action, "who is signed in" is irrelevant to what gets written.
    // A live session is still required here purely so the write is
    // authorized under lab_tests' RLS policy (`auth.uid()` must match a
    // lab/admin profile — see the laboratory_schema migration) — whichever
    // lab user has this analyzer-feed page open. Reuses the existing
    // enterAnalyte/finishEntry methods one analyte at a time (sequentially,
    // not Promise.all — each call does its own get()+patch() round trip, so
    // parallel calls could race and clobber each other's analyte writes)
    // rather than adding a new combined API method, per the brief's
    // "bridge each additively."
    if (!realId || !result) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabTests } = await import('@/lib/api')
      for (const a of result.analytes) {
        await LabTests.enterAnalyte(realId, a.analyte, a.value, a.flag)
      }
      await LabTests.finishEntry(realId, { id: 'ANLZ', name: result.enteredBy?.name ?? 'Auto-analyzer' })
    } catch (err) {
      console.error('[useLabOrdersStore] real backend analyzerAutoFeed failed (local test still updated):', err)
    }
  },

  rejectTest: async (testId, reason) => {
    let realId: string | undefined
    // Marks the test rejected AND stamps the underlying specimen so the inbox
    // and bench views stay in sync (both surface "recollect required").
    set(s => ({
      orders: s.orders.map(o => {
        const target = o.tests.find(t => t.id === testId)
        if (!target || target.status === 'released') return o
        realId = target.realId
        return {
          ...o,
          tests: o.tests.map(t => t.id === testId
            ? { ...t, status: 'rejected' as TestStatus, rejectReason: reason }
            : t),
          specimens: o.specimens.map(sp => sp.accession === target.specimenId
            ? { ...sp, rejectReason: reason }
            : sp),
        }
      }),
    }))

    // Phase 4 Task 6 — additive bridge into the real backend, same guarded
    // shape as rejectSpecimen (Task 4). LabTests.reject() takes no actor
    // (status/rejectReason only, matching lab-specimens.ts's reject()), so
    // this only needs a live session to authorize the write under RLS.
    // Mirrors rejectSpecimen's scope: the underlying specimen's real row is
    // NOT touched here — rejecting one test on a shared specimen must not
    // reject the specimen itself while its other tests are still active;
    // specimen-level rejection remains rejectSpecimen's job.
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.reject(realId, reason)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend rejectTest failed (local test still updated):', err)
    }
  },

  microAdvance: async (testId, patch) => {
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId) return t
          realId = t.realId
          const current: MicrobioResult = t.micro ?? { phase: 'inoculated', day: 0 }
          return { ...t, micro: { ...current, ...patch } }
        }),
      })),
    }))

    // Phase 4 Task 7 — additive bridge into the real backend, same guarded
    // shape as enterAnalyte/unclaim (Task 5): live session, try/catch, silent
    // skip with no realId. LabTests.microAdvance() takes no actor (just
    // merges the `micro` jsonb patch, mirroring the local mutation above), so
    // this only needs a live session to authorize the write under RLS
    // (lab_tests_all_lab, `for all`, requires a lab/admin profile).
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.microAdvance(realId, patch)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend microAdvance failed (local test still updated):', err)
    }
  },

  microRelease: async (testId, verifiedBy) => {
    let releasedTest: TestRun | undefined
    let parentOrder: LabOrder | undefined
    let realId: string | undefined
    set(s => ({
      orders: s.orders.map(o => {
        const tests = o.tests.map(t => {
          if (t.id !== testId) return t
          if (!t.micro || t.micro.phase !== 'final') return t
          const updated: TestRun = { ...t, status: 'released', verifiedBy, releasedAt: new Date().toISOString() }
          releasedTest = updated
          parentOrder = o
          realId = t.realId
          return updated
        })
        return { ...o, tests }
      }),
    }))
    if (releasedTest && parentOrder) {
      const t = releasedTest
      useNotificationStore.getState().add({
        type: 'lab_result',
        priority: 'medium',
        title: 'Microbiology report ready',
        body: `${t.name} for ${parentOrder.patientName} — final report released`,
        targetRole: 'doctor',
        patientName: parentOrder.patientName,
        channels: ['in_app'],
      })
    }

    // Phase 4 Task 7 — additive bridge into the real backend, same guarded
    // shape as verifyTest/finishEntry (Tasks 5/6). microRelease is
    // conceptually closest to verifyTest+releaseTest collapsed into a single
    // atomic write (status + verified_by + released_at) — LabTests.microRelease
    // already exists for exactly this shape (see Task 1's schema/lab-tests.ts).
    // No reflex handling here: unlike releaseTest, the local microRelease
    // action above never calls evaluateReflex/pushReflex (micro releases are
    // final-phase culture reports, not the analyte-driven reflex path), so
    // none is invented here either. The actor written to `verified_by` is
    // resolveRealActor()'s session-derived identity, NEVER the local
    // `verifiedBy` parameter — same segregation-of-duties boundary as
    // verifyTest (Task 6).
    if (!realId) return
    const actor = await resolveRealActor(verifiedBy.bench)
    if (!actor) return
    try {
      const { LabTests } = await import('@/lib/api')
      await LabTests.microRelease(realId, actor)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend microRelease failed (local test still updated):', err)
    }
  },

  logCallback: (testId, calledBy, recipient) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => t.id === testId
        ? { ...t, callback: { calledBy, recipient, calledAt: new Date().toISOString() } }
        : t),
    })),
  })),

  ackResult: (testId) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => t.id === testId ? { ...t, acknowledgedAt: new Date().toISOString() } : t),
    })),
  })),

  pushReflex: (sugg) => set(s => ({
    reflexSuggestions: [{ ...sugg, id: `RS-${Date.now()}-${++_rsSeq}`, createdAt: new Date().toISOString() }, ...s.reflexSuggestions],
  })),

  orderReflex: async (suggestionId) => {
    const sugg = get().reflexSuggestions.find(rs => rs.id === suggestionId)
    if (!sugg || sugg.orderedAt) return
    const origin = get().orders.find(o => o.tests.some(t => t.id === sugg.basedOnTestId))
    if (!origin) return
    const cat = LAB_CATALOG[sugg.code]
    if (!cat) return
    const originTest = origin.tests.find(t => t.id === sugg.basedOnTestId)
    const newLocalOrderId = get().addOrder({
      patientId: origin.patientId,
      patientName: origin.patientName,
      source: origin.source,
      wardBed: origin.wardBed,
      doctorName: origin.doctorName,
      paymentMode: origin.paymentMode,
      testCodes: [sugg.code],
      clinicalNotes: `Reflex from ${sugg.code} — ${sugg.reason}`,
    })
    set(s => ({
      reflexSuggestions: s.reflexSuggestions.map(rs => rs.id === suggestionId ? { ...rs, orderedAt: new Date().toISOString() } : rs),
    }))

    // Phase 4 Task 8 — additive bridge into the real backend.
    //
    // Design decision (the brief's open question): a reflex order is for a
    // SINGLE already-known test code against the SAME patient/order-context as
    // the original test, not a doctor's independent multi-item order — so this
    // does NOT call Orders.create() to mint a brand-new real `orders` row.
    // Confirmed against the live project: `orders`' only write-granting RLS
    // policy is `orders_all_doctor` (`for all`, `doctor_id = auth.uid()`) — this
    // action is invoked from the LAB incharge's reflex queue
    // (src/app/lab/reflex/page.tsx), signed in as lab/admin, which has NO write
    // grant on `orders` at all (only `orders_select_staff`, reception/admin
    // SELECT). Calling Orders.create() here would 403 under RLS. Instead, this
    // attaches a new lab_specimens + lab_tests row to the ORIGINAL real order
    // (`origin.realId`) — `lab_specimens_all_lab`/`lab_tests_all_lab` already
    // grant lab/admin unconditional read/write on both tables, so no RLS change
    // is needed for this path. This mirrors dispatchLabOrder's real
    // materialization (src/app/doctor/dashboard/page.tsx, Task 3) simplified to
    // exactly one code instead of N, which is also why a simpler direct
    // LabSpecimens.create + LabTests.create pair is used here rather than
    // duplicating dispatchLabOrder's whole order-creation flow.
    const originRealId = origin.realId
    const originTestRealId = originTest?.realId
    if (!originRealId || !originTestRealId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabSpecimens, LabTests, LabReflexSuggestions } = await import('@/lib/api')
      const specimen = await LabSpecimens.create({
        orderId: originRealId,
        type: cat.specimen,
        container: cat.container,
      })
      const test = await LabTests.create({
        orderId: originRealId,
        specimenId: specimen.id,
        code: sugg.code,
        name: cat.name,
        bench: cat.bench,
        priority: cat.defaultPriority,
        expectedTatMin: cat.expectedTATmin ?? (cat.expectedDays ? cat.expectedDays * 24 * 60 : 60),
        orderedAt: new Date().toISOString(),
      })
      // Stamp the new LOCAL order (created via addOrder above — always exactly
      // one specimen + one test for a single-code order) with the real ids just
      // created, reusing setRealIds — same positional-match contract
      // dispatchLabOrder relies on (see setRealIds' doc comment).
      get().setRealIds(newLocalOrderId, {
        orderId: originRealId,
        specimens: [{ type: cat.specimen, realId: specimen.id }],
        tests: [{ code: sugg.code, realId: test.id }],
      })
      // Best-effort: also stamp the real suggestion row's ordered_at, so a lab
      // incharge querying lab_reflex_suggestions directly (outside this UI)
      // sees it as actioned too — mirrors the local mutation above exactly
      // (orderedAt stamped, row otherwise left in place). There is no realId
      // link on the LOCAL ReflexSuggestion (it's a display-only local queue
      // item — Task 6 never stamped one back, since pushReflex/LabReflexSuggestions.create
      // mint unrelated ids), so the real row is found by querying every
      // suggestion keyed to the origin's real test id and matching this
      // suggestion's code — safe because releaseTest (Task 6) creates at most
      // one real row per (test, code) pair per release.
      const realMatches = await LabReflexSuggestions.byTest(originTestRealId)
      const realMatch = realMatches.find(r => r.code === sugg.code && !r.orderedAt)
      if (realMatch) await LabReflexSuggestions.orderIt(realMatch.id)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend orderReflex failed (local reflex order still updated):', err)
    }
  },

  dismissReflex: async (suggestionId) => {
    const sugg = get().reflexSuggestions.find(rs => rs.id === suggestionId)
    set(s => ({
      reflexSuggestions: s.reflexSuggestions.filter(rs => rs.id !== suggestionId),
    }))
    if (!sugg) return

    // Phase 4 Task 8 — additive bridge into the real backend. "Dismiss" deletes
    // the real row outright (rather than marking it, e.g., a `dismissed`
    // column) because `lab_reflex_suggestions` has no such column (Task 1's
    // schema: id, based_on_test_id, patient_name, trigger_summary, code,
    // reason, ordered_at, created_at — confirmed against the migration) and
    // because it exactly matches the LOCAL behavior above: a dismissed
    // suggestion is filtered out of `reflexSuggestions` entirely, with no
    // "dismissed" history retained anywhere in the UI (src/app/lab/reflex/page.tsx
    // only ever renders `pending`/`ordered`, never a dismissed list).
    const origin = get().orders.find(o => o.tests.some(t => t.id === sugg.basedOnTestId))
    const originTestRealId = origin?.tests.find(t => t.id === sugg.basedOnTestId)?.realId
    if (!originTestRealId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { LabReflexSuggestions } = await import('@/lib/api')
      // Same code-matching lookup as orderReflex above — no realId link exists
      // on the LOCAL ReflexSuggestion, so the real row is found via the origin
      // test's real id + this suggestion's code.
      const realMatches = await LabReflexSuggestions.byTest(originTestRealId)
      const realMatch = realMatches.find(r => r.code === sugg.code && !r.orderedAt)
      if (realMatch) await LabReflexSuggestions.dismiss(realMatch.id)
    } catch (err) {
      console.error('[useLabOrdersStore] real backend dismissReflex failed (local reflex dismiss still applied):', err)
    }
  },
  }
},
  {
    name: 'agentix-labordersstore', version: 5,
    // mergingStorage makes every persist a read-merge-write against the latest
    // localStorage snapshot, so concurrent tabs converge instead of clobbering
    // each other (no lost doctor orders, no reset lab progress — see mergeOrders).
    storage: createJSONStorage(() => mergingStorage),
    skipHydration: true,
    // Orders are persisted so cross-tab sync works: every addOrder() call writes to
    // localStorage, firing the storage event in every other open tab, which triggers
    // rehydrate() there. On a fresh start (or migration from v4), SEED_ORDERS are
    // loaded via the migrate fallback so the demo queue is never empty.
    partialize: (state) => ({ reflexSuggestions: state.reflexSuggestions, orders: state.orders }),
    migrate: (persisted: unknown, _fromVersion: number) => {
      const s = persisted as Partial<{ reflexSuggestions: ReflexSuggestion[]; orders: LabOrder[] }>
      return {
        reflexSuggestions: Array.isArray(s?.reflexSuggestions) ? s.reflexSuggestions : [],
        orders: Array.isArray(s?.orders) && s.orders.length > 0 ? s.orders : SEED_ORDERS,
      }
    },
  },
))

// ─── Back-compat: flat sample view for legacy consumers ───────────────────

export type FlatSample = {
  id: string
  patientName: string
  patientId?: string
  testName: string
  status: 'Collected' | 'Processing' | 'Analyzing' | 'Completed'
  priority: 'Routine' | 'Urgent'
  orderedBy?: string
  orderedAt?: string
  expectedTAT?: number
  criticalValue?: boolean
  criticalAcknowledgedBy?: string
  aiAnomalyAlert?: string
  result?: string
  acknowledgedAt?: string
}

const STATUS_MAP: Record<TestStatus, FlatSample['status']> = {
  awaiting_collection: 'Collected',
  collected: 'Collected',
  on_bench: 'Processing',
  in_progress: 'Analyzing',
  entered: 'Analyzing',
  verified: 'Analyzing',
  released: 'Completed',
  rejected: 'Processing',
  recollect_requested: 'Collected',
}

export function flatTests(orders: LabOrder[]): FlatSample[] {
  // Filter rejected tests out of the legacy view — the old flat union has no
  // "Rejected" state, and mapping rejects to "Processing" wrongly inflates
  // legacy "in-progress" counters. A recollect (recollect_requested) IS still
  // surfaced because the patient is mid-flow.
  return orders.flatMap(o => o.tests
    .filter(t => t.status !== 'rejected')
    .map(t => ({
      id: t.id,
      patientName: o.patientName,
      patientId: o.patientId,
      testName: t.name,
      status: STATUS_MAP[t.status],
      priority: t.priority === 'Routine' ? 'Routine' as const : 'Urgent' as const,
      orderedBy: o.doctorName,
      orderedAt: t.orderedAt,
      expectedTAT: t.expectedTATmin,
      criticalValue: t.analytes.some(a => a.flag === 'CH' || a.flag === 'CL'),
      criticalAcknowledgedBy: t.callback?.recipient,
      result: t.status === 'released'
        ? t.analytes.map(a => `${a.analyte} ${a.value} ${a.unit}${a.flag !== 'N' ? ' ' + a.flag : ''}`).join(' · ')
        : undefined,
      acknowledgedAt: t.acknowledgedAt,
    })))
}
