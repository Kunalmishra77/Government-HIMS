import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Appointments } from '@/lib/api/appointments'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-APPTTEST-1'
const testApptId = 'APT-APPTTEST-1'

// Appointments.create/updateStatus and Patients.create (used in beforeAll) route through
// table(...), which writes via the shared getSupabaseClient() singleton (anon key). RLS
// (Task 3) requires an authenticated reception/admin staff session for patients and
// appointments inserts/updates, so this suite signs in as a real staff user via that same
// singleton first — see rls.test.ts and patients.test.ts for the same pattern.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'appointments-test-reception@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'reception', full_name: 'Appointments Test Reception',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-APPTTEST-1', fullName: 'Appt Test', phone: '9333333333', sex: 'Male' } as Parameters<typeof Patients.create>[0])
})

afterAll(async () => {
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
})

afterEach(async () => {
  await admin.from('appointments').delete().eq('id', testApptId)
})

describe('Appointments repository', () => {
  it('books an appointment for a patient', async () => {
    const saved = await Appointments.create({
      id: testApptId, patientId: testPatientId, doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
      date: '2026-08-01', time: '10:30 AM', mode: 'in_person',
    })
    expect(saved.status).toBe('upcoming')
    expect(saved.patientId).toBe(testPatientId)
  })

  it('byPatient() returns the booking', async () => {
    await Appointments.create({
      id: testApptId, patientId: testPatientId, doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
      date: '2026-08-01', time: '10:30 AM', mode: 'in_person',
    })
    const rows = await Appointments.byPatient(testPatientId)
    expect(rows.some((a) => a.id === testApptId)).toBe(true)
  })

  it('updateStatus() cancels an appointment', async () => {
    await Appointments.create({
      id: testApptId, patientId: testPatientId, doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
      date: '2026-08-01', time: '10:30 AM', mode: 'in_person',
    })
    const cancelled = await Appointments.updateStatus(testApptId, 'cancelled')
    expect(cancelled?.status).toBe('cancelled')
  })
})
