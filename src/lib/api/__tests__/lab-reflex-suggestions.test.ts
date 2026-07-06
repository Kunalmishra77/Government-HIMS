import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Orders } from '@/lib/api/orders'
import { LabTests } from '@/lib/api/lab-tests'
import { LabReflexSuggestions } from '@/lib/api/lab-reflex-suggestions'
import { getSupabaseClient } from '@/lib/supabase/client'

// LabReflexSuggestions.create() routes through table('lab_reflex_suggestions', ...),
// which FKs `based_on_test_id` to a real lab_tests row — same multi-role fixture
// pattern as lab-tests.test.ts/lab-specimens.test.ts: reception creates patient+visit,
// doctor creates the real order + the lab_tests row this suggestion is "based on",
// then lab (role 'lab') performs the actual create() under test.
const testPatientId = 'PT-LABREFLEXTEST-1'
const testVisitId = 'VIS-LABREFLEXTEST-1'
const testTestId = 'LT-LABREFLEXTEST-1'
const testSuggestionId = 'RS-LABREFLEXTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'lab-reflex-test-reception@example.com'
const doctorEmail = 'lab-reflex-test-doctor@example.com'
const labEmail = 'lab-reflex-test-lab@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string
let labUserId: string
let testOrderId: string

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Lab Reflex Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Lab Reflex Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { data: labData, error: labError } = await admin.auth.admin.createUser({
    email: labEmail, password: testPassword, email_confirm: true,
  })
  if (labError || !labData.user) throw new Error(`createUser failed: ${labError?.message}`)
  labUserId = labData.user.id
  const { error: labProfileError } = await admin.from('profiles').insert({
    id: labUserId, role: 'lab', full_name: 'Lab Reflex Test Lab',
  })
  if (labProfileError) throw new Error(`profile insert failed: ${labProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-LABREFLEXTEST-1', fullName: 'Lab Reflex Test', phone: '9444444444', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  const { error: doctorSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: doctorEmail, password: testPassword,
  })
  if (doctorSignInError) throw new Error(`signIn failed: ${doctorSignInError.message}`)

  const order = await Orders.create({
    patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
    kind: 'lab', urgency: 'routine', items: [{ id: 'ITEM-1', name: 'HbA1c', qty: 1 }],
  } as Parameters<typeof Orders.create>[0])
  testOrderId = order.id

  await LabTests.create({
    id: testTestId, orderId: testOrderId, code: 'HBA1C', name: 'HbA1c',
    bench: 'BIOCHEM', expectedTatMin: 60, orderedAt: new Date().toISOString(),
  })

  const { error: labSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: labEmail, password: testPassword,
  })
  if (labSignInError) throw new Error(`signIn failed: ${labSignInError.message}`)
})

afterAll(async () => {
  await admin.from('lab_reflex_suggestions').delete().eq('based_on_test_id', testTestId)
  await admin.from('lab_tests').delete().eq('order_id', testOrderId)
  await admin.from('orders').delete().eq('id', testOrderId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', labUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(labUserId)
})

afterEach(async () => {
  await admin.from('lab_reflex_suggestions').delete().eq('id', testSuggestionId)
})

describe('LabReflexSuggestions repository', () => {
  it('creates a reflex suggestion based on a real test', async () => {
    const saved = await LabReflexSuggestions.create({
      id: testSuggestionId, basedOnTestId: testTestId, patientName: 'Lab Reflex Test',
      triggerSummary: 'HbA1c 7.2% (≥6.5)', code: 'GLUC',
      reason: 'Diabetic-range HbA1c — confirm with fasting blood sugar',
    })
    expect(saved.id).toBe(testSuggestionId)
    expect(saved.basedOnTestId).toBe(testTestId)
    expect(saved.orderedAt).toBeUndefined()
    expect(saved.createdAt).toBeTruthy()
  })

  it('byTest() returns the suggestion', async () => {
    await LabReflexSuggestions.create({
      id: testSuggestionId, basedOnTestId: testTestId, patientName: 'Lab Reflex Test',
      triggerSummary: 'HbA1c 7.2% (≥6.5)', code: 'GLUC',
      reason: 'Diabetic-range HbA1c — confirm with fasting blood sugar',
    })
    const rows = await LabReflexSuggestions.byTest(testTestId)
    expect(rows.some((r) => r.id === testSuggestionId)).toBe(true)
  })
})
