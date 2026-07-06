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

  async create(input: Omit<RadiologyStudy, 'id' | 'status' | 'attachments' | 'priority' | 'reportSections' | 'updatedAt'> & {
    id?: string
    status?: RadiologyStudy['status']
    attachments?: RadAttachment[]
    priority?: RadiologyStudy['priority']
    reportSections?: RadiologyStudy['reportSections']
  }) {
    const row: RadiologyStudy = {
      ...input,
      id: input.id ?? newId('RS'),
      status: input.status ?? 'ordered',
      attachments: input.attachments ?? [],
      priority: input.priority ?? 'Routine',
      reportSections: input.reportSections ?? {},
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
