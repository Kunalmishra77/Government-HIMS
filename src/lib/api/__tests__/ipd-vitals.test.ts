import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { IpdVitals } from '@/lib/api/ipd-vitals'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-IPDVITALTEST-1'
const testVisitId = 'VIS-IPDVITALTEST-1'
const testAdmissionId = 'ADM-IPDVITALTEST-1'
const testStayId = 'IPD-IPDVITALTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const nurseEmail = 'ipd-vitals-test-nurse@example.com'
const testPassword = 'Test-Pass-123!'
let nurseUserId: string

beforeAll(async () => {
  const { data: nurseData, error } = await admin.auth.admin.createUser({
    email: nurseEmail, password: testPassword, email_confirm: true,
  })
  if (error || !nurseData.user) throw new Error(`createUser failed: ${error?.message}`)
  nurseUserId = nurseData.user.id
  await admin.from('profiles').insert({ id: nurseUserId, role: 'nurse', full_name: 'Ipd Vitals Test Nurse' })
  await admin.from('patients').insert({ id: testPatientId, hn: 'HN-IPDVITALTEST-1', full_name: 'Ipd Vitals Test', phone: '9666666666', sex: 'Male' })

  // ipd_vitals.ipd_stay_id has a NOT NULL FK to ipd_stays(id), which in turn
  // requires a real admission_requests row (also NOT NULL FK'd to a visit) —
  // this repository test only exercises IpdVitals itself, so the upstream
  // chain is materialized directly via the service-role admin client
  // (bypassing RLS, since it's fixture setup, not the behavior under test).
  await admin.from('visits').insert({
    id: testVisitId, patient_id: testPatientId, kind: 'IPD', department: 'General Medicine', status: 'waiting',
  })
  await admin.from('admission_requests').insert({
    id: testAdmissionId, visit_id: testVisitId, patient_id: testPatientId, doctor_id: nurseUserId,
    admission_type: 'General Ward', status: 'admitted',
  })
  await admin.from('ipd_stays').insert({
    id: testStayId, admission_request_id: testAdmissionId, patient_id: testPatientId,
    patient_name: 'Ipd Vitals Test', bed: '104', ward: 'General Ward',
    admitting_doctor: 'Ipd Vitals Test Nurse', diagnosis: 'Test diagnosis', condition: 'Stable',
  })

  await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('ipd_vitals').delete().eq('patient_id', testPatientId)
  await admin.from('ipd_stays').delete().eq('id', testStayId)
  await admin.from('admission_requests').delete().eq('id', testAdmissionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

afterEach(async () => {
  await admin.from('ipd_vitals').delete().eq('ipd_stay_id', testStayId)
})

describe('IpdVitals repository', () => {
  it('record() stamps the real actor, not a caller-supplied name', async () => {
    const saved = await IpdVitals.record(
      { ipdStayId: testStayId, patientId: testPatientId, hr: 88, systolicBp: 128, diastolicBp: 82, spo2: 97 },
      { id: nurseUserId, name: 'Ipd Vitals Test Nurse' },
    )
    expect(saved.recordedBy).toBe(nurseUserId)
    expect(saved.recordedByName).toBe('Ipd Vitals Test Nurse')
    expect(saved.systolicBp).toBe(128)
  })

  it('byStay() returns the recording', async () => {
    await IpdVitals.record(
      { ipdStayId: testStayId, patientId: testPatientId, hr: 88 },
      { id: nurseUserId, name: 'Ipd Vitals Test Nurse' },
    )
    const rows = await IpdVitals.byStay(testStayId)
    expect(rows).toHaveLength(1)
  })

  it('byPatient() returns the recording', async () => {
    await IpdVitals.record(
      { ipdStayId: testStayId, patientId: testPatientId, hr: 88 },
      { id: nurseUserId, name: 'Ipd Vitals Test Nurse' },
    )
    const rows = await IpdVitals.byPatient(testPatientId)
    expect(rows.some((v) => v.ipdStayId === testStayId)).toBe(true)
  })
})
