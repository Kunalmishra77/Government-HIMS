import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Orders } from '@/lib/api/orders'
import { LabTests } from '@/lib/api/lab-tests'
import type { LabTech } from '@/lib/api/lab-tests'
import { getSupabaseClient } from '@/lib/supabase/client'

// LabTests.* routes through table('lab_tests', ...) — same fixture pattern as
// lab-specimens.test.ts: reception creates patient+visit, doctor creates the real
// order (lab_tests.order_id FKs to orders), then lab (role 'lab') performs the
// actual bench-workflow operations under test.
//
// IMPORTANT (see lab-tests.ts module note / Phase 4 Task 2 report): claim/finishEntry/
// verify/microRelease take an `actor: LabTech` parameter that is NOT verified by this
// repository layer — these test fixtures use plain LabTech-shaped literals because
// this is the *persistence* layer under test, not the session-sourcing bridge. Real
// callers (Phase 4 Tasks 5/6/7's store bridges) MUST source `actor` from a live
// Supabase session, never from arbitrary client/local state.
const testPatientId = 'PT-LABTESTTEST-1'
const testVisitId = 'VIS-LABTESTTEST-1'
const testTestId = 'LT-LABTESTTEST-1'
const testMicroTestId = 'LT-LABTESTTEST-2'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'lab-tests-test-reception@example.com'
const doctorEmail = 'lab-tests-test-doctor@example.com'
const labEmail = 'lab-tests-test-lab@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string
let labUserId: string
// Orders.create always mints its own id (newId('ORD')) — it never honors a
// caller-supplied id — so the real order id must be captured from its return
// value, not assumed from a hardcoded constant.
let testOrderId: string

const RAVI: LabTech = { id: 'LT-101', name: 'Ravi Menon', bench: ['HEMA'] }
const DR_PATHO: LabTech = { id: 'LP-201', name: 'Dr. Asha Rao', bench: ['HEMA', 'BIOCHEM', 'IMMUNO', 'URINE', 'MICRO'] }

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Lab Tests Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Lab Tests Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { data: labData, error: labError } = await admin.auth.admin.createUser({
    email: labEmail, password: testPassword, email_confirm: true,
  })
  if (labError || !labData.user) throw new Error(`createUser failed: ${labError?.message}`)
  labUserId = labData.user.id
  const { error: labProfileError } = await admin.from('profiles').insert({
    id: labUserId, role: 'lab', full_name: 'Lab Tests Test Lab',
  })
  if (labProfileError) throw new Error(`profile insert failed: ${labProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-LABTESTTEST-1', fullName: 'Lab Tests Test', phone: '9222222222', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  const { error: doctorSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: doctorEmail, password: testPassword,
  })
  if (doctorSignInError) throw new Error(`signIn failed: ${doctorSignInError.message}`)

  const order = await Orders.create({
    patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
    kind: 'lab', urgency: 'routine', items: [{ id: 'ITEM-1', name: 'CBC', qty: 1 }],
  } as Parameters<typeof Orders.create>[0])
  testOrderId = order.id

  const { error: labSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: labEmail, password: testPassword,
  })
  if (labSignInError) throw new Error(`signIn failed: ${labSignInError.message}`)
})

afterAll(async () => {
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
  await admin.from('lab_tests').delete().in('id', [testTestId, testMicroTestId])
})

describe('LabTests repository', () => {
  it('creates a test for an order', async () => {
    const saved = await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', priority: 'Routine', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    expect(saved.status).toBe('awaiting_collection')
    expect(saved.analytes).toEqual([])
  })

  it('byOrder() returns the test', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    const rows = await LabTests.byOrder(testOrderId)
    expect(rows.some((t) => t.id === testTestId)).toBe(true)
  })

  it('claim() assigns the actor and moves to in_progress', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', status: 'on_bench', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    const claimed = await LabTests.claim(testTestId, RAVI)
    expect(claimed?.status).toBe('in_progress')
    expect(claimed?.assignedTo?.id).toBe('LT-101')
  })

  it('unclaim() clears assignedTo and returns to on_bench', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', status: 'on_bench', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    await LabTests.claim(testTestId, RAVI)
    const unclaimed = await LabTests.unclaim(testTestId)
    expect(unclaimed?.status).toBe('on_bench')
    expect(unclaimed?.assignedTo).toBeUndefined()
  })

  it('enterAnalyte() updates a single analyte value', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count', bench: 'HEMA',
      status: 'in_progress', expectedTatMin: 60, orderedAt: new Date().toISOString(),
      analytes: [{ analyte: 'Haemoglobin', value: '', unit: 'g/dL', refLow: 13, refHigh: 17, flag: 'N' }],
    })
    const updated = await LabTests.enterAnalyte(testTestId, 'Haemoglobin', 14.2, 'N')
    expect(updated?.analytes[0].value).toBe(14.2)
  })

  it('finishEntry() stamps enteredBy and moves to entered', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', status: 'in_progress', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    const finished = await LabTests.finishEntry(testTestId, RAVI)
    expect(finished?.status).toBe('entered')
    expect(finished?.enteredBy?.id).toBe('LT-101')
  })

  it('verify() stamps verifiedBy and moves to verified', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', status: 'entered', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    const verified = await LabTests.verify(testTestId, DR_PATHO)
    expect(verified?.status).toBe('verified')
    expect(verified?.verifiedBy?.id).toBe('LP-201')
  })

  it('release() stamps releasedAt and moves to released', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', status: 'verified', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    const released = await LabTests.release(testTestId)
    expect(released?.status).toBe('released')
    expect(released?.releasedAt).toBeTruthy()
  })

  it('reject() sets rejectReason and moves to rejected', async () => {
    await LabTests.create({
      id: testTestId, orderId: testOrderId, code: 'CBC', name: 'Complete Blood Count',
      bench: 'HEMA', status: 'on_bench', expectedTatMin: 60, orderedAt: new Date().toISOString(),
    })
    const rejected = await LabTests.reject(testTestId, 'hemolyzed')
    expect(rejected?.status).toBe('rejected')
    expect(rejected?.rejectReason).toBe('hemolyzed')
  })

  it('microAdvance() merges into the micro jsonb', async () => {
    await LabTests.create({
      id: testMicroTestId, orderId: testOrderId, code: 'CULT_BLOOD', name: 'Blood Culture',
      bench: 'MICRO', status: 'in_progress', expectedTatMin: 4320, orderedAt: new Date().toISOString(),
    })
    const advanced = await LabTests.microAdvance(testMicroTestId, { phase: 'growth_check', day: 1, growth: 'growth' })
    expect(advanced?.micro?.phase).toBe('growth_check')
    expect(advanced?.micro?.day).toBe(1)
  })

  it('microRelease() stamps verifiedBy/releasedAt and moves to released', async () => {
    await LabTests.create({
      id: testMicroTestId, orderId: testOrderId, code: 'CULT_BLOOD', name: 'Blood Culture', bench: 'MICRO',
      status: 'in_progress', expectedTatMin: 4320, orderedAt: new Date().toISOString(),
      micro: { phase: 'final', day: 2, finalReport: 'No growth' },
    })
    const released = await LabTests.microRelease(testMicroTestId, DR_PATHO)
    expect(released?.status).toBe('released')
    expect(released?.verifiedBy?.id).toBe('LP-201')
    expect(released?.releasedAt).toBeTruthy()
  })
})
