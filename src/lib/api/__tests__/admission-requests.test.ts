import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { AdmissionRequests } from '@/lib/api/admission-requests'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-ADMREQTEST-1'
const testVisitId = 'VIS-ADMREQTEST-1'
const testAdmissionId = 'ADM-ADMREQTEST-1'

// AdmissionRequests.create routes through table('admission_requests', ...), which writes
// via the shared getSupabaseClient() singleton (anon key). RLS restricts admission_requests
// inserts to the assigned doctor and reads to that doctor or reception/admin staff — so this
// suite signs in as reception first (to create the patient+visit fixture per the established
// visits/patients RLS) and then as a doctor (to create the admission request), matching the
// two-role fixture pattern in rls.test.ts.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'admission-requests-test-reception@example.com'
const doctorEmail = 'admission-requests-test-doctor@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Admission Requests Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Admission Requests Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-ADMREQTEST-1', fullName: 'Admission Requests Test', phone: '9444444444', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  const { error: doctorSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: doctorEmail, password: testPassword,
  })
  if (doctorSignInError) throw new Error(`signIn failed: ${doctorSignInError.message}`)
})

afterAll(async () => {
  await admin.from('admission_requests').delete().eq('patient_id', testPatientId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

afterEach(async () => {
  await admin.from('admission_requests').delete().eq('id', testAdmissionId)
})

describe('AdmissionRequests repository', () => {
  it('creates an admission request for a patient visit', async () => {
    const saved = await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])
    expect(saved.status).toBe('requested')
    expect(saved.patientId).toBe(testPatientId)
    expect(saved.visitId).toBe(testVisitId)
  })

  it('byPatient() returns the request', async () => {
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])
    const rows = await AdmissionRequests.byPatient(testPatientId)
    expect(rows.some((a) => a.id === testAdmissionId)).toBe(true)
  })

  it("byStatus() returns only requests in that status", async () => {
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])
    const rows = await AdmissionRequests.byStatus('requested')
    expect(rows.some((a) => a.id === testAdmissionId)).toBe(true)
    expect(rows.every((a) => a.status === 'requested')).toBe(true)
  })

  it('assignToBed() transitions requested -> bed_assigned (reception)', async () => {
    await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])

    await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
    const patched = await AdmissionRequests.assignToBed(testAdmissionId)
    expect(patched?.status).toBe('bed_assigned')
  })

  it('markAdmitted() transitions bed_assigned -> admitted (reception)', async () => {
    await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])

    await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
    await AdmissionRequests.assignToBed(testAdmissionId)
    const patched = await AdmissionRequests.markAdmitted(testAdmissionId)
    expect(patched?.status).toBe('admitted')
  })

  it('cancel() transitions requested -> cancelled (reception)', async () => {
    await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
    await AdmissionRequests.create({
      id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
      diagnosis: 'Acute MI — post-PCI', admissionType: 'ICU', bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required', department: 'Cardiology',
      triageLevel: 'Critical', payerType: 'Cashless (HDFC Ergo)',
    } as Parameters<typeof AdmissionRequests.create>[0])

    await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
    const patched = await AdmissionRequests.cancel(testAdmissionId)
    expect(patched?.status).toBe('cancelled')
  })
})
