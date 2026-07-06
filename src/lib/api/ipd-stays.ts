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
