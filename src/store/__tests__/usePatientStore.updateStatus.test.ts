import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { usePatientStore } from '@/store/usePatientStore'
import { Visits } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase/client'

// Whole-phase review finding (critical-in-effect): Task 8's addPatient
// creates the real backend `visits` row at status 'waiting'. Reception's
// "send this patient to vitals" action — updateStatus(id, 'vitals'), called
// from src/app/reception/opd/page.tsx and src/app/reception/register/page.tsx
// — used to touch ONLY local Zustand state, so the real visit stayed stuck
// at 'waiting' forever. That meant the nurse's real
// Visits.advance(visitId, 'consulting') (Task 9's recordOpdVitals) always
// matched 0 rows against the RLS policy requiring the row's current status
// to be 'vitals' (20260704122501_narrow_nurse_visits_update.sql) and
// silently no-opped in production, even though every existing test passed
// (they seed status:'vitals' directly via the service-role client, which is
// not what the real reception flow does).
//
// This file proves the fixed bridge end-to-end against the real Postgres
// `visits` table — not local state — using genuine reception and nurse
// sessions, exactly like the real app flow.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'updatestatus-test-reception@example.com'
const nurseEmail = 'updatestatus-test-nurse@example.com'
const password = 'Test-Pass-123!'
let receptionUserId: string
let nurseUserId: string
let createdPatientId: string | undefined
let createdVisitId: string | undefined

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser (reception) failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'UpdateStatus Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert (reception) failed: ${receptionProfileError.message}`)

  const { data: nurseData, error: nurseError } = await admin.auth.admin.createUser({
    email: nurseEmail, password, email_confirm: true,
  })
  if (nurseError || !nurseData.user) throw new Error(`createUser (nurse) failed: ${nurseError?.message}`)
  nurseUserId = nurseData.user.id
  const { error: nurseProfileError } = await admin.from('profiles').insert({
    id: nurseUserId, role: 'nurse', full_name: 'UpdateStatus Test Nurse',
  })
  if (nurseProfileError) throw new Error(`profile insert (nurse) failed: ${nurseProfileError.message}`)
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
  await getSupabaseClient().auth.signOut()
})

afterEach(async () => {
  if (createdVisitId) {
    await admin.from('vitals_readings').delete().eq('visit_id', createdVisitId)
  }
  if (createdPatientId) {
    await admin.from('visits').delete().eq('patient_id', createdPatientId)
    await admin.from('patients').delete().eq('id', createdPatientId)
  }
  createdPatientId = undefined
  createdVisitId = undefined
})

async function signInAsReception() {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password })
  if (error) throw new Error(`reception signIn failed: ${error.message}`)
}

async function signInAsNurse() {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password })
  if (error) throw new Error(`nurse signIn failed: ${error.message}`)
}

describe('usePatientStore.updateStatus — reception→vitals real backend bridge', () => {
  it('mirrors reception sending a patient to vitals onto the REAL Postgres visits row (not just local state)', async () => {
    await signInAsReception()
    usePatientStore.setState({ patients: [], queue: [] })

    await usePatientStore.getState().addPatient({
      name: 'UpdateStatus Bridge Test Patient', phone: '9333300001', age: 30, gender: 'Male', department: 'General Medicine',
    })
    const created = usePatientStore.getState().patients[0]
    expect(created.visitId).toBeTruthy()
    createdPatientId = created.id
    createdVisitId = created.visitId

    const beforeVisit = await admin.from('visits').select('status').eq('id', created.visitId!).single()
    expect(beforeVisit.data?.status).toBe('waiting')

    await usePatientStore.getState().updateStatus(created.id, 'vitals')

    // Local (queue/UI) state still advances exactly as before.
    expect(usePatientStore.getState().patients.find(p => p.id === created.id)?.queueStatus).toBe('vitals')

    // ...and the REAL Postgres row now does too, checked via the
    // service-role admin client (independent of the reception session).
    const afterVisit = await admin.from('visits').select('status').eq('id', created.visitId!).single()
    expect(afterVisit.data?.status).toBe('vitals')
  })

  it('does not attempt a real backend write when no live Supabase session exists (local queue still advances)', async () => {
    await signInAsReception()
    usePatientStore.setState({ patients: [], queue: [] })
    await usePatientStore.getState().addPatient({
      name: 'UpdateStatus No-Session Test Patient', phone: '9333300002', age: 41, gender: 'Female', department: 'General Medicine',
    })
    const created = usePatientStore.getState().patients[0]
    expect(created.visitId).toBeTruthy()
    createdPatientId = created.id
    createdVisitId = created.visitId

    const advanceSpy = vi.spyOn(Visits, 'advance')
    await getSupabaseClient().auth.signOut()

    await usePatientStore.getState().updateStatus(created.id, 'vitals')

    expect(advanceSpy).not.toHaveBeenCalled()
    advanceSpy.mockRestore()
    expect(usePatientStore.getState().patients.find(p => p.id === created.id)?.queueStatus).toBe('vitals')

    const remoteVisit = await admin.from('visits').select('status').eq('id', created.visitId!).single()
    expect(remoteVisit.data?.status).toBe('waiting')
  })

  it('completes the full real chain: reception creates (waiting) → reception sends to vitals (vitals) → nurse records vitals and advances (consulting)', async () => {
    await signInAsReception()
    usePatientStore.setState({ patients: [], queue: [] })

    await usePatientStore.getState().addPatient({
      name: 'UpdateStatus Full Chain Test Patient', phone: '9333300003', age: 52, gender: 'Male', department: 'General Medicine',
    })
    const created = usePatientStore.getState().patients[0]
    expect(created.visitId).toBeTruthy()
    createdPatientId = created.id
    const visitId = created.visitId!
    createdVisitId = visitId

    const initialVisit = await admin.from('visits').select('status').eq('id', visitId).single()
    expect(initialVisit.data?.status).toBe('waiting')

    // Reception sends the patient to vitals — the bridge under test in this file.
    await usePatientStore.getState().updateStatus(created.id, 'vitals')
    const afterBridge = await admin.from('visits').select('status').eq('id', visitId).single()
    expect(afterBridge.data?.status).toBe('vitals')

    // Nurse takes over: records vitals and advances the visit — Task 9's
    // real Visits.advance(visitId, 'consulting'), which only matches a row
    // because it is genuinely at 'vitals' thanks to the bridge above.
    await signInAsNurse()
    await usePatientStore.getState().recordOpdVitals(created.id, {
      by: 'UpdateStatus Test Nurse', hr: 82, systolicBP: 124, diastolicBP: 78,
    })

    const finalVisit = await admin.from('visits').select('status').eq('id', visitId).single()
    expect(finalVisit.data?.status).toBe('consulting')
    expect(usePatientStore.getState().patients.find(p => p.id === created.id)?.queueStatus).toBe('consulting')
  })
})
