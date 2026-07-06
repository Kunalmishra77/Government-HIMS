import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { VitalsReadings } from '@/lib/api/vitals-readings'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-VITALSTEST-1'
const testVisitId = 'VIS-VITALSTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const receptionEmail = 'vitals-test-reception@example.com'
const nurseEmail = 'vitals-test-nurse@example.com'
const password = 'Test-Pass-123!'
let receptionUserId: string
let nurseUserId: string

beforeAll(async () => {
  // Create reception user for setting up patients and visits
  const { data: recData, error: recError } = await admin.auth.admin.createUser({
    email: receptionEmail, password, email_confirm: true,
  })
  if (recError || !recData.user) throw new Error(`createUser reception failed: ${recError?.message}`)
  receptionUserId = recData.user.id
  const { error: recProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Vitals Test Reception',
  })
  if (recProfileError) throw new Error(`reception profile insert failed: ${recProfileError.message}`)

  // Create nurse user for recording vitals
  const { data: nurData, error: nurError } = await admin.auth.admin.createUser({
    email: nurseEmail, password, email_confirm: true,
  })
  if (nurError || !nurData.user) throw new Error(`createUser nurse failed: ${nurError?.message}`)
  nurseUserId = nurData.user.id
  const { error: nurProfileError } = await admin.from('profiles').insert({
    id: nurseUserId, role: 'nurse', full_name: 'Vitals Test Nurse',
  })
  if (nurProfileError) throw new Error(`nurse profile insert failed: ${nurProfileError.message}`)

  // Sign in as reception to create patients/visits
  const { error: recSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password,
  })
  if (recSignInError) throw new Error(`reception signIn failed: ${recSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-VITALSTEST-1', fullName: 'Vitals Test', phone: '9111111111', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'vitals' } as Parameters<typeof Visits.create>[0])

  // Sign in as nurse for the actual tests
  const { error: nurSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: nurseEmail, password,
  })
  if (nurSignInError) throw new Error(`nurse signIn failed: ${nurSignInError.message}`)
})

afterAll(async () => {
  await admin.from('vitals_readings').delete().eq('visit_id', testVisitId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

describe('VitalsReadings repository', () => {
  it('records a vitals reading for a visit', async () => {
    const saved = await VitalsReadings.create({
      visitId: testVisitId, recordedBy: nurseUserId, payload: { hr: 78, systolicBP: 120, diastolicBP: 80 },
    })
    expect(saved.visitId).toBe(testVisitId)
    expect(saved.payload.hr).toBe(78)
  })

  it('byVisit() returns the reading', async () => {
    await VitalsReadings.create({
      visitId: testVisitId, recordedBy: nurseUserId, payload: { hr: 80 },
    })
    const rows = await VitalsReadings.byVisit(testVisitId)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.visitId === testVisitId)).toBe(true)
  })
})
