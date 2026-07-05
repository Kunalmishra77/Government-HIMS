import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useNotificationStore } from './useNotificationStore'
import { useAuditStore } from './useAuditStore'
import { LAB_CATALOG, computeFlag, type Bench, type Priority, type SpecimenType, type AnalyteSpec } from '@/lib/labCatalog'
import { evaluateReflex } from '@/lib/reflexRules'
import { deriveUhid } from '@/lib/uhid'

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
}

export type LabOrder = {
  id: string
  patientId: string
  patientName: string
  uhid: string
  department: string
  source: LabSource
  wardBed?: string
  doctorName: string
  orderedAt: string
  paymentMode: PaymentMode
  fastingStatus?: 'fasting' | 'non_fasting' | 'unknown'
  clinicalNotes?: string
  tests: TestRun[]
  specimens: Specimen[]
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
const mergingStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
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
  removeItem: (name: string) => localStorage.removeItem(name),
}

// ─── State ────────────────────────────────────────────────────────────────

interface State {
  orders: LabOrder[]
  reflexSuggestions: ReflexSuggestion[]
  addOrder: (input: {
    patientId: string
    patientName: string
    uhid?: string
    department?: string
    source: LabSource
    wardBed?: string
    doctorName: string
    paymentMode: PaymentMode
    testCodes: string[]
    fastingStatus?: 'fasting' | 'non_fasting' | 'unknown'
    clinicalNotes?: string
  }) => string
  collectOrder: (orderId: string, collectedBy: string) => void
  rejectSpecimen: (orderId: string, accession: string, reason: RejectReason) => void
  recollectOrder: (orderId: string) => void
  claim: (testId: string, tech: LabTech) => void
  unclaim: (testId: string) => void
  enterAnalyte: (testId: string, analyte: string, value: number | string) => void
  finishEntry: (testId: string, enteredBy: LabTech) => void
  verifyTest: (testId: string, verifiedBy: LabTech) => void
  releaseTest: (testId: string) => void
  rejectTest: (testId: string, reason: RejectReason) => void
  // M13.9 — analyzer auto-feed. Simulates the modern lab workflow where
  // barcoded samples are loaded onto analyzers and the analyzer pushes
  // results back over HL7/ASTM (no human typing). Generates realistic
  // values within reference / occasionally flagged ranges + audit row.
  analyzerAutoFeed: (testId: string) => void
  microAdvance: (testId: string, patch: Partial<MicrobioResult>) => void
  microRelease: (testId: string, verifiedBy: LabTech) => void
  logCallback: (testId: string, calledBy: string, recipient: string) => void
  ackResult: (testId: string) => void
  pushReflex: (s: Omit<ReflexSuggestion, 'id' | 'createdAt'>) => void
  orderReflex: (suggestionId: string) => void
  dismissReflex: (suggestionId: string) => void
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
  uhid?: string
  department?: string
  source: LabSource
  wardBed?: string
  doctorName: string
  orderedMinAgo: number
  paymentMode: PaymentMode
  fastingStatus?: 'fasting' | 'non_fasting' | 'unknown'
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
    uhid: p.uhid ?? deriveUhid(p.patientId),
    department: p.department ?? 'General Medicine',
    source: p.source,
    wardBed: p.wardBed,
    doctorName: p.doctorName,
    orderedAt,
    paymentMode: p.paymentMode,
    fastingStatus: p.fastingStatus,
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
    department: 'General Medicine',
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
    department: 'Cardiology',
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
    department: 'Nephrology',
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

  // ── In Queue demo — freshly ordered tests awaiting collection ───────────
  // LO-415: Neha Reddy — Cardiology STAT cardiac + lipid workup
  buildSeedOrder({
    id: 'LO-415', patientId: 'PT-20411', patientName: 'Neha Reddy', source: 'OPD',
    department: 'Cardiology',
    doctorName: 'Dr. Anjali Desai', orderedMinAgo: 3, paymentMode: 'Insurance',
    collected: false,
    tests: [
      { code: 'TROPI', status: 'awaiting_collection' },
      { code: 'LIPID', status: 'awaiting_collection' },
    ],
  }),
  // LO-416: Farhan Ali — Gastroenterology LFT
  buildSeedOrder({
    id: 'LO-416', patientId: 'PT-20415', patientName: 'Farhan Ali', source: 'OPD',
    department: 'Gastroenterology',
    doctorName: 'Dr. Sameer Khan', orderedMinAgo: 8, paymentMode: 'UPI',
    collected: false, fastingStatus: 'fasting',
    tests: [
      { code: 'LFT', status: 'awaiting_collection' },
    ],
  }),
  // LO-417: Deepa Nair — Nephrology inpatient renal + haemogram
  buildSeedOrder({
    id: 'LO-417', patientId: 'PT-44021', patientName: 'Deepa Nair', source: 'IPD', wardBed: 'Ward C — 4',
    department: 'Nephrology',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 15, paymentMode: 'Insurance',
    collected: false,
    tests: [
      { code: 'RFT', status: 'awaiting_collection' },
      { code: 'CBC', status: 'awaiting_collection' },
    ],
  }),
  // LO-418: Arjun Menon — Endocrinology diabetic review
  buildSeedOrder({
    id: 'LO-418', patientId: 'PT-20418', patientName: 'Arjun Menon', source: 'OPD',
    department: 'Endocrinology',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 10, paymentMode: 'Cash',
    collected: false, fastingStatus: 'fasting',
    tests: [
      { code: 'HBA1C', status: 'awaiting_collection' },
      { code: 'LIPID', status: 'awaiting_collection' },
    ],
  }),
  // LO-419: Sana Sheikh — Emergency STAT sepsis screen
  buildSeedOrder({
    id: 'LO-419', patientId: 'PT-20420', patientName: 'Sana Sheikh', source: 'ER',
    department: 'Emergency',
    doctorName: 'Dr. Rohan Mehta', orderedMinAgo: 2, paymentMode: 'Credit',
    collected: false,
    tests: [
      { code: 'CBC', status: 'awaiting_collection' },
      { code: 'CRP', status: 'awaiting_collection' },
      { code: 'CULT_BLOOD', status: 'awaiting_collection' },
    ],
  }),
  // LO-420: Gopal Das — Urology urine culture
  buildSeedOrder({
    id: 'LO-420', patientId: 'PT-20424', patientName: 'Gopal Das', source: 'OPD',
    department: 'Urology',
    doctorName: 'Dr. Meena Iyer', orderedMinAgo: 22, paymentMode: 'UPI',
    collected: false,
    tests: [
      { code: 'CULT_URINE', status: 'awaiting_collection' },
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
      uhid: input.uhid ?? deriveUhid(input.patientId),
      department: input.department ?? 'General Medicine',
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

  collectOrder: (orderId, collectedBy) => {
    const at = new Date().toISOString()
    set(s => ({
      orders: s.orders.map(o => o.id !== orderId ? o : ({
        ...o,
        specimens: o.specimens.map(sp => sp.collectedAt ? sp : ({ ...sp, collectedBy, collectedAt: at })),
        tests: o.tests.map(t => t.status === 'awaiting_collection' ? { ...t, status: 'on_bench' as TestStatus } : t),
      })),
    }))
  },

  rejectSpecimen: (orderId, accession, reason) => {
    set(s => ({
      orders: s.orders.map(o => o.id !== orderId ? o : ({
        ...o,
        specimens: o.specimens.map(sp => sp.accession === accession ? { ...sp, rejectReason: reason } : sp),
        tests: o.tests.map(t => t.specimenId === accession && t.status !== 'released' && t.status !== 'verified'
          ? { ...t, status: 'rejected' as TestStatus, rejectReason: reason } : t),
      })),
    }))
  },

  recollectOrder: (orderId) => {
    set(s => ({
      orders: s.orders.map(o => o.id !== orderId ? o : ({
        ...o,
        specimens: o.specimens.map(sp => sp.rejectReason ? { ...sp, rejectReason: undefined, collectedAt: undefined, collectedBy: undefined } : sp),
        tests: o.tests.map(t => t.status === 'rejected' ? { ...t, status: 'awaiting_collection' as TestStatus, rejectReason: undefined } : t),
      })),
    }))
  },

  claim: (testId, tech) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => t.id === testId && (t.status === 'on_bench' || t.status === 'collected')
        ? { ...t, status: 'in_progress' as TestStatus, assignedTo: tech }
        : t),
    })),
  })),

  unclaim: (testId) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => t.id === testId && t.status === 'in_progress'
        ? { ...t, status: 'on_bench' as TestStatus, assignedTo: undefined }
        : t),
    })),
  })),

  enterAnalyte: (testId, analyte, value) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => {
        if (t.id !== testId) return t
        const cat = LAB_CATALOG[t.code]
        const spec: AnalyteSpec | undefined = cat?.analytes.find(a => a.analyte === analyte)
        return {
          ...t,
          analytes: t.analytes.map(a => a.analyte === analyte
            ? { ...a, value, flag: spec ? computeFlag(value, spec) : a.flag }
            : a),
        }
      }),
    })),
  })),

  finishEntry: (testId, enteredBy) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => t.id === testId && t.status === 'in_progress'
        ? { ...t, status: 'entered' as TestStatus, enteredBy }
        : t),
    })),
  })),

  verifyTest: (testId, verifiedBy) => {
    let verified: TestRun | undefined
    set(s => ({
      orders: s.orders.map(o => ({
        ...o,
        tests: o.tests.map(t => {
          if (t.id !== testId || t.status !== 'entered') return t
          const v: TestRun = { ...t, status: 'verified', verifiedBy }
          verified = v
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
  },

  releaseTest: (testId) => {
    let releasedTest: TestRun | undefined
    let parentOrder: LabOrder | undefined
    set(s => ({
      orders: s.orders.map(o => {
        const tests = o.tests.map(t => {
          if (t.id !== testId || t.status !== 'verified') return t
          const updated: TestRun = { ...t, status: 'released', releasedAt: new Date().toISOString() }
          releasedTest = updated
          parentOrder = o
          return updated
        })
        return { ...o, tests }
      }),
    }))
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
      const reflexMatches = evaluateReflex(t, parentOrder.patientName)
      for (const m of reflexMatches) get().pushReflex(m)
    }
  },

  // M13.9 — Analyzer auto-feed.
  // Simulates HL7/ASTM push from a Sysmex / Roche / Abbott / Beckman analyzer.
  // For any on-bench analyzer-feedable test, generates plausible analyte
  // values (80% within reference, 15% mildly out, 5% critical), computes
  // flags, sets status → 'entered', and stamps `enteredBy` with the
  // analyzer name so pathologists can tell "auto" from "manual".
  analyzerAutoFeed: (testId) => {
    let order: LabOrder | undefined
    let result: TestRun | undefined
    set(s => ({
      orders: s.orders.map(o => {
        const t = o.tests.find(x => x.id === testId)
        if (!t || t.status !== 'on_bench' && t.status !== 'collected') return o
        const cat = LAB_CATALOG[t.code]
        if (!cat || cat.micro || cat.bench === 'HISTO') return o   // manual-only
        order = o
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
  },

  rejectTest: (testId, reason) => set(s => ({
    // Marks the test rejected AND stamps the underlying specimen so the inbox
    // and bench views stay in sync (both surface "recollect required").
    orders: s.orders.map(o => {
      const target = o.tests.find(t => t.id === testId)
      if (!target || target.status === 'released') return o
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
  })),

  microAdvance: (testId, patch) => set(s => ({
    orders: s.orders.map(o => ({
      ...o,
      tests: o.tests.map(t => {
        if (t.id !== testId) return t
        const current: MicrobioResult = t.micro ?? { phase: 'inoculated', day: 0 }
        return { ...t, micro: { ...current, ...patch } }
      }),
    })),
  })),

  microRelease: (testId, verifiedBy) => {
    let releasedTest: TestRun | undefined
    let parentOrder: LabOrder | undefined
    set(s => ({
      orders: s.orders.map(o => {
        const tests = o.tests.map(t => {
          if (t.id !== testId) return t
          if (!t.micro || t.micro.phase !== 'final') return t
          const updated: TestRun = { ...t, status: 'released', verifiedBy, releasedAt: new Date().toISOString() }
          releasedTest = updated
          parentOrder = o
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

  orderReflex: (suggestionId) => {
    const sugg = get().reflexSuggestions.find(rs => rs.id === suggestionId)
    if (!sugg || sugg.orderedAt) return
    const origin = get().orders.find(o => o.tests.some(t => t.id === sugg.basedOnTestId))
    if (!origin) return
    if (!LAB_CATALOG[sugg.code]) return
    get().addOrder({
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
  },

  dismissReflex: (suggestionId) => set(s => ({
    reflexSuggestions: s.reflexSuggestions.filter(rs => rs.id !== suggestionId),
  })),
  }
},
  {
    name: 'agentix-labordersstore', version: 6,
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
      const orders = Array.isArray(s?.orders) && s.orders.length > 0
        // Backfill uhid/department for orders persisted before v6 introduced them.
        ? s.orders.map(o => ({
            ...o,
            uhid: o.uhid ?? deriveUhid(o.patientId),
            department: o.department ?? 'General Medicine',
          }))
        : SEED_ORDERS
      return {
        reflexSuggestions: Array.isArray(s?.reflexSuggestions) ? s.reflexSuggestions : [],
        orders,
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
