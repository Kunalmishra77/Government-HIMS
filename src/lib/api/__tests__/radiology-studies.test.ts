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
    // Postgres/PostgREST serializes `timestamptz` as `+00:00`, not `Z` — compare
    // timestamp equivalence, not raw string equality (same instant, different
    // but equivalent ISO-8601 representation; not a bug in schedule() itself).
    expect(new Date(scheduled?.scheduledFor ?? '').toISOString()).toBe('2026-07-06T10:00:00.000Z')
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
