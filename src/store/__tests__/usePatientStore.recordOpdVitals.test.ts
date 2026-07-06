import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { usePatientStore } from '@/store/usePatientStore'
import { Visits, VitalsReadings } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase/client'

// recordOpdVitals's real-backend write checks the LIVE Supabase session
// directly (supabase.auth.getSession()) — the same corrected pattern used by
// addPatient (Task 8) — rather than any persisted Zustand auth flag. See
// usePatientStore.addPatient.test.ts for why: a Zustand `persist` flag
// survives in localStorage across app restarts and gets unconditionally
// rehydrated by StoreHydrator, so it can reflect a stale "logged in" state
// from an unrelated earlier session. These tests exercise the live-session
// guard directly: a genuine signed-in session triggers the real write;
// signed-out (no live session) must not, even proven via a spy so RLS isn't
// the only thing standing in the way.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'recordvitals-test-nurse@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string
const testPatientId = 'PT-VITALSREC-TEST-1'
const testVisitId = 'VIS-VITALSREC-TEST-1'

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'nurse', full_name: 'RecordVitals Test Nurse',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)

  // Fixture setup uses the service-role (admin) client directly, bypassing RLS,
  // rather than Patients.create/Visits.create under the nurse's own session:
  // patients/visits INSERT is restricted to reception/admin (patients_insert_staff,
  // visits_insert_staff) — a nurse legitimately cannot create either, so the
  // fixture must be seeded out-of-band, exactly like reception would have
  // already done this in the real flow (Task 8).
  const { error: patientError } = await admin.from('patients').insert({
    id: testPatientId, hn: testPatientId, full_name: 'RecordVitals Test', phone: '9555555555', sex: 'Male',
  })
  if (patientError) throw new Error(`patient fixture insert failed: ${patientError.message}`)
  const { error: visitError } = await admin.from('visits').insert({
    id: testVisitId, patient_id: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'vitals',
  })
  if (visitError) throw new Error(`visit fixture insert failed: ${visitError.message}`)

  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  await admin.from('vitals_readings').delete().eq('visit_id', testVisitId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
})

afterEach(async () => {
  await admin.from('vitals_readings').delete().eq('visit_id', testVisitId)
})

function seedQueuedPatient() {
  usePatientStore.setState({
    patients: [{
      id: testPatientId, name: 'RecordVitals Test', age: 40, gender: 'Male', phone: '9555555555',
      bloodGroup: 'A+', token: 1, queueStatus: 'vitals', estimatedWait: 0, doctor: 'Dr. Priya Nair',
      department: 'General Medicine', symptoms: [], history: [], registeredAt: '10:00 AM', visitId: testVisitId,
    } as never],
    queue: [],
  })
}

async function reSignInAsStaff() {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (error) throw new Error(`re-signIn failed: ${error.message}`)
}

describe('usePatientStore.recordOpdVitals — real backend write', () => {
  it('writes a vitals_readings row and advances the real visit to consulting when a live Supabase session exists', async () => {
    seedQueuedPatient()

    await usePatientStore.getState().recordOpdVitals(testPatientId, { by: 'RecordVitals Test Nurse', hr: 76, systolicBP: 118, diastolicBP: 76 })

    const readings = await VitalsReadings.byVisit(testVisitId)
    expect(readings.length).toBe(1)
    expect(readings[0].payload.hr).toBe(76)

    const visit = await Visits.get(testVisitId)
    expect(visit?.status).toBe('consulting')

    // Local (queue/UI) state still updates exactly as before.
    const localPatient = usePatientStore.getState().patients.find(p => p.id === testPatientId)
    expect(localPatient?.queueStatus).toBe('consulting')
  })

  it('does not attempt a real backend write when no live Supabase session exists (signed out)', async () => {
    // Prove the guard itself skips the call — not merely that RLS would
    // reject an unauthenticated write — by spying directly on VitalsReadings.create.
    const createSpy = vi.spyOn(VitalsReadings, 'create')
    const advanceSpy = vi.spyOn(Visits, 'advance')
    await getSupabaseClient().auth.signOut()
    // Reset the fixture visit back to 'vitals' via the service-role client —
    // the app's own client has no session at this point, so it cannot do this.
    await admin.from('visits').update({ status: 'vitals' }).eq('id', testVisitId)
    seedQueuedPatient()

    await usePatientStore.getState().recordOpdVitals(testPatientId, { by: 'RecordVitals Test Nurse', hr: 80, systolicBP: 120, diastolicBP: 80 })

    expect(createSpy).not.toHaveBeenCalled()
    expect(advanceSpy).not.toHaveBeenCalled()
    createSpy.mockRestore()
    advanceSpy.mockRestore()

    // Local state still advances (existing behavior is unchanged).
    const localPatient = usePatientStore.getState().patients.find(p => p.id === testPatientId)
    expect(localPatient?.queueStatus).toBe('consulting')

    // And no real row/status change landed in the backend — checked via the
    // service-role client since there is no signed-in session for the app's
    // own client to read through right now.
    const remoteReadings = await admin.from('vitals_readings').select('*').eq('visit_id', testVisitId)
    expect(remoteReadings.data?.length).toBe(0)
    const remoteVisit = await admin.from('visits').select('status').eq('id', testVisitId).single()
    expect(remoteVisit.data?.status).toBe('vitals')

    await reSignInAsStaff()
  })
})
