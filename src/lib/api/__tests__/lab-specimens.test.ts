import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Orders } from '@/lib/api/orders'
import { LabSpecimens } from '@/lib/api/lab-specimens'
import { getSupabaseClient } from '@/lib/supabase/client'

// LabSpecimens.create/collect/reject route through table('lab_specimens', ...), which
// writes via the shared getSupabaseClient() singleton (anon key). RLS grants lab/admin
// role full read/write on lab_specimens, and the specimen's order_id FK requires a real
// orders row — so this suite signs in as reception (patient+visit), then doctor (order),
// then lab (the actual specimen operations under test), matching the multi-role fixture
// pattern in admission-requests.test.ts / vitals-readings.test.ts.
const testPatientId = 'PT-LABSPECTEST-1'
const testVisitId = 'VIS-LABSPECTEST-1'
const testAccession = 'ACC-LABSPECTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'lab-specimens-test-reception@example.com'
const doctorEmail = 'lab-specimens-test-doctor@example.com'
const labEmail = 'lab-specimens-test-lab@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string
let labUserId: string
// Orders.create always mints its own id (newId('ORD')) — it never honors a
// caller-supplied id — so the real order id must be captured from its return
// value, not assumed from a hardcoded constant.
let testOrderId: string

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Lab Specimens Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Lab Specimens Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { data: labData, error: labError } = await admin.auth.admin.createUser({
    email: labEmail, password: testPassword, email_confirm: true,
  })
  if (labError || !labData.user) throw new Error(`createUser failed: ${labError?.message}`)
  labUserId = labData.user.id
  const { error: labProfileError } = await admin.from('profiles').insert({
    id: labUserId, role: 'lab', full_name: 'Lab Specimens Test Lab',
  })
  if (labProfileError) throw new Error(`profile insert failed: ${labProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-LABSPECTEST-1', fullName: 'Lab Specimens Test', phone: '9333333333', sex: 'Male' } as Parameters<typeof Patients.create>[0])
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
  await admin.from('lab_specimens').delete().eq('order_id', testOrderId)
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
  await admin.from('lab_specimens').delete().eq('id', testAccession)
})

describe('LabSpecimens repository', () => {
  it('creates a specimen for an order', async () => {
    const saved = await LabSpecimens.create({
      id: testAccession, orderId: testOrderId, type: 'EDTA', container: 'Purple-top EDTA tube',
    })
    expect(saved.id).toBe(testAccession)
    expect(saved.orderId).toBe(testOrderId)
    expect(saved.collectedAt).toBeUndefined()
  })

  it('byOrder() returns the specimen', async () => {
    await LabSpecimens.create({ id: testAccession, orderId: testOrderId, type: 'EDTA', container: 'Purple-top EDTA tube' })
    const rows = await LabSpecimens.byOrder(testOrderId)
    expect(rows.some((s) => s.id === testAccession)).toBe(true)
  })

  it('collect() stamps collectedBy/collectedAt', async () => {
    await LabSpecimens.create({ id: testAccession, orderId: testOrderId, type: 'EDTA', container: 'Purple-top EDTA tube' })
    const collected = await LabSpecimens.collect(testAccession, 'Phlebo Saira')
    expect(collected?.collectedBy).toBe('Phlebo Saira')
    expect(collected?.collectedAt).toBeTruthy()
  })

  it('reject() sets rejectReason', async () => {
    await LabSpecimens.create({ id: testAccession, orderId: testOrderId, type: 'EDTA', container: 'Purple-top EDTA tube' })
    const rejected = await LabSpecimens.reject(testAccession, 'hemolyzed')
    expect(rejected?.rejectReason).toBe('hemolyzed')
  })
})
