import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { usePatientStore, type Patient } from '@/store/usePatientStore'
import { Patients } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase/client'

// AABHA/UHID bridge, mirror-image case to usePatientStore.addPatient.test.ts:
// here Aadhaar/ABHA verification completes AFTER the patient already exists
// in the real backend (src/app/reception/opd/page.tsx's "Complete Aadhaar"
// drawer, via AadhaarAbhaFlow.tsx -> linkPatientIdentity). Before this bridge,
// linkPatientIdentity only ever touched local Zustand state — the real
// `patients` row's uhid/abha_id/aadhaar_verified stayed null/false forever,
// silently diverging from what reception saw on screen.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'linkidentity-test-reception@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string
let createdPatientId: string | undefined

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'reception', full_name: 'LinkIdentity Test Reception',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
  await getSupabaseClient().auth.signOut()
})

afterEach(async () => {
  if (createdPatientId) {
    await admin.from('visits').delete().eq('patient_id', createdPatientId)
    await admin.from('patients').delete().eq('id', createdPatientId)
    createdPatientId = undefined
  }
})

async function reSignInAsStaff() {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email: staffEmail, password: staffPassword })
  if (error) throw new Error(`re-signIn failed: ${error.message}`)
}

describe('usePatientStore.linkPatientIdentity — real backend bridge', () => {
  it('mirrors reception completing Aadhaar/ABHA for an already-queued patient onto the REAL patients row', async () => {
    usePatientStore.setState({ patients: [], queue: [] })
    await usePatientStore.getState().addPatient({
      name: 'LinkIdentity Bridge Test Patient', phone: '9888800001', age: 29, gender: 'Female', department: 'General Medicine',
    })
    const created = usePatientStore.getState().patients[0]
    expect(created.visitId).toBeTruthy()
    createdPatientId = created.id

    const before = await admin.from('patients').select('uhid, abha_id, aadhaar_verified').eq('id', created.id).single()
    expect(before.data?.uhid).toBeNull()
    expect(before.data?.aadhaar_verified).toBe(false)

    await usePatientStore.getState().linkPatientIdentity(created.id, {
      uhid: 'PUH-2026-77001', abhaId: '14-7000-8000-9000', aadhaarVerified: true,
    })

    // Local state updates immediately, same as before this bridge existed.
    expect(usePatientStore.getState().patients.find(p => p.id === created.id)?.uhid).toBe('PUH-2026-77001')

    // ...and the REAL Postgres row now reflects it too.
    const after = await admin.from('patients').select('uhid, abha_id, aadhaar_verified').eq('id', created.id).single()
    expect(after.data?.uhid).toBe('PUH-2026-77001')
    expect(after.data?.abha_id).toBe('14-7000-8000-9000')
    expect(after.data?.aadhaar_verified).toBe(true)
  })

  it('does not attempt a real backend write for a patient with no real visitId (never bridged to the backend)', async () => {
    const localOnlyPatient: Patient = {
      id: 'PT-LOCALONLY-1', name: 'Local Only Patient', age: 30, gender: 'Male', phone: '9888800002',
      bloodGroup: 'O+', token: 1, queueStatus: 'waiting', estimatedWait: 4, doctor: 'Dr. Priya Nair',
      department: 'General Medicine', vitals: null, symptoms: [], history: [], registeredAt: '10:00 AM',
      registeredDate: new Date().toISOString().slice(0, 10), triageLevel: 'Low', hasReports: false,
      // deliberately no visitId — proves the real-write gate below
    }
    usePatientStore.setState({ patients: [localOnlyPatient], queue: [] })
    const updateSpy = vi.spyOn(Patients, 'update')

    await usePatientStore.getState().linkPatientIdentity('PT-LOCALONLY-1', {
      uhid: 'PUH-2026-77002', abhaId: '14-1000-2000-3000', aadhaarVerified: true,
    })

    expect(usePatientStore.getState().patients.find(p => p.id === 'PT-LOCALONLY-1')?.uhid).toBe('PUH-2026-77002')
    expect(updateSpy).not.toHaveBeenCalled()
    updateSpy.mockRestore()
  })

  it('does not attempt a real backend write when no live Supabase session exists (local record still updated)', async () => {
    usePatientStore.setState({ patients: [], queue: [] })
    await usePatientStore.getState().addPatient({
      name: 'LinkIdentity No-Session Test Patient', phone: '9888800003', age: 33, gender: 'Male', department: 'General Medicine',
    })
    const created = usePatientStore.getState().patients[0]
    expect(created.visitId).toBeTruthy()
    createdPatientId = created.id

    const updateSpy = vi.spyOn(Patients, 'update')
    await getSupabaseClient().auth.signOut()

    await usePatientStore.getState().linkPatientIdentity(created.id, {
      uhid: 'PUH-2026-77003', abhaId: '14-4000-5000-6000', aadhaarVerified: true,
    })

    expect(updateSpy).not.toHaveBeenCalled()
    updateSpy.mockRestore()
    expect(usePatientStore.getState().patients.find(p => p.id === created.id)?.uhid).toBe('PUH-2026-77003')

    const remote = await admin.from('patients').select('uhid').eq('id', created.id).single()
    expect(remote.data?.uhid).toBeNull()

    await reSignInAsStaff()
  })
})
