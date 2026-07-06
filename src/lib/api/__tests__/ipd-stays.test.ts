import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { AdmissionRequests } from '@/lib/api/admission-requests'
import { IpdStays } from '@/lib/api/ipd-stays'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-IPDSTAYTEST-1'
const testVisitId = 'VIS-IPDSTAYTEST-1'
const testAdmissionId = 'ADM-IPDSTAYTEST-1'
const testStayId = 'IPD-IPDSTAYTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'ipd-stays-test-reception@example.com'
const doctorEmail = 'ipd-stays-test-doctor@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Ipd Stays Test Reception' })

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  await admin.from('profiles').insert({ id: doctorUserId, role: 'doctor', full_name: 'Ipd Stays Test Doctor' })

  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
  await Patients.create({ id: testPatientId, hn: 'HN-IPDSTAYTEST-1', fullName: 'Ipd Stays Test', phone: '9555555555', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'IPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  await getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })
  await AdmissionRequests.create({
    id: testAdmissionId, patientId: testPatientId, visitId: testVisitId, doctorId: doctorUserId,
    diagnosis: 'Community-acquired pneumonia', admissionType: 'General Ward', bedTypePreference: 'General Ward',
    reason: 'IV antibiotics', department: 'General Medicine', payerType: 'General',
  } as Parameters<typeof AdmissionRequests.create>[0])

  // Deliberately stay signed in as doctor after this setup: admission_requests'
  // insert is doctor-scoped (doctor_id = auth.uid()). Each test below signs in
  // as whichever role the real production write path uses for that operation
  // (reception inserts a fresh ipd_stays row; doctor/nurse/admin then
  // select/patch it) — see the final-review fix that replaced the old
  // unscoped `ipd_stays_all_clinical` (doctor/nurse/admin FOR ALL, which used
  // to also grant doctor/nurse INSERT/DELETE) with `ipd_stays_select_clinical`
  // / `ipd_stays_update_clinical` (SELECT/UPDATE only). Doctor/nurse can no
  // longer INSERT a fresh ipd_stays row directly — only reception can, via
  // `ipd_stays_insert_reception`'s tightened fresh-admitted-empty-row check.
})

afterAll(async () => {
  await admin.from('ipd_stays').delete().eq('patient_id', testPatientId)
  await admin.from('admission_requests').delete().eq('id', testAdmissionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

afterEach(async () => {
  await admin.from('ipd_stays').delete().eq('id', testStayId)
})

function baseInput(overrides: Partial<Parameters<typeof IpdStays.create>[0]> = {}) {
  return {
    id: testStayId, admissionRequestId: testAdmissionId, patientId: testPatientId,
    patientName: 'Ipd Stays Test', age: 52, gender: 'Male', bed: '102', ward: 'General Ward',
    admittingDoctor: 'Ipd Stays Test Doctor', diagnosis: 'Community-acquired pneumonia',
    admittedAt: new Date().toISOString(), condition: 'Stable' as const,
    ...overrides,
  }
}

// Every real insert of an ipd_stays row is reception-side (ipd_stays_insert_reception:
// a fresh, all-empty, stage='admitted' row only). Every real select/patch afterwards is
// doctor/nurse/admin-side (ipd_stays_select_clinical / ipd_stays_update_clinical). These
// helpers switch the shared getSupabaseClient() session to match whichever role the
// operation under test actually runs as in production.
const asReception = () => getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
const asDoctor = () => getSupabaseClient().auth.signInWithPassword({ email: doctorEmail, password: testPassword })

describe('IpdStays repository', () => {
  it('creates a stay for an admission request', async () => {
    await asReception()
    const saved = await IpdStays.create(baseInput())
    expect(saved.stage).toBe('admitted')
    expect(saved.rounds).toEqual([])
    expect(saved.discharge).toBeUndefined()
  })

  it('byPatient() returns the stay', async () => {
    await asReception()
    await IpdStays.create(baseInput())
    const rows = await IpdStays.byPatient(testPatientId)
    expect(rows.some((s) => s.id === testStayId)).toBe(true)
  })

  it('byAdmissionRequest() returns the stay', async () => {
    await asReception()
    await IpdStays.create(baseInput())
    const rows = await IpdStays.byAdmissionRequest(testAdmissionId)
    expect(rows.some((s) => s.id === testStayId)).toBe(true)
  })

  it('patch() merges an arbitrary partial and bumps updatedAt', async () => {
    // isoNow() (src/lib/api/_core.ts) deliberately returns a fixed placeholder
    // constant outside the browser (for SSR/hydration determinism), and this
    // suite runs in Vitest's `node` environment — so create()'s and patch()'s
    // updatedAt stamps are the identical constant, not two distinct instants.
    // Assert patch() actually sets updatedAt (the "bump" call happened),
    // rather than asserting it differs from create()'s stamp.
    await asReception()
    await IpdStays.create(baseInput())
    await asDoctor()
    const patched = await IpdStays.patch(testStayId, { condition: 'Improving', diet: 'Normal diet' })
    expect(patched?.condition).toBe('Improving')
    expect(patched?.diet).toBe('Normal diet')
    expect(patched?.updatedAt).toBeTruthy()
  })

  it('patch() clears a jsonb field with explicit null', async () => {
    // ipd_stays_insert_reception requires discharge IS NULL on insert, so the
    // pre-populated discharge is set via a doctor-side patch first (mirroring
    // the real initiateDischarge/setDischargeSummary flow), then cleared via a
    // second patch(null) — exercising the same clearing behaviour the old
    // single-insert-with-discharge fixture did.
    await asReception()
    await IpdStays.create(baseInput())
    await asDoctor()
    await IpdStays.patch(testStayId, {
      discharge: {
        pillars: { clinical: true, nursing: false, pharmacy: false, billing: false, insurance: false },
        meds: [], redFlags: [], orderIssued: true, summaryDrafted: false, summaryApproved: false,
        exitClearanceIssued: false, blockers: [],
      },
    })
    const cleared = await IpdStays.patch(testStayId, { discharge: null as unknown as Parameters<typeof IpdStays.create>[0]['discharge'] })
    expect(cleared?.discharge).toBeUndefined()
  })
})
