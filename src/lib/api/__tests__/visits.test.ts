import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-VISITSTEST-1'
const testVisitId = 'VIS-VISITSTEST-1'
const nurseScopeVisitId = 'VIS-VISITSTEST-NURSESCOPE-1'

// Visits.create/advance route through table('visits', ...) / table('patients', ...),
// which write via the shared getSupabaseClient() singleton (anon key). RLS (Task 3)
// requires an authenticated reception/admin staff session for patients/visits
// inserts/updates, so this suite signs in as a real staff user first — see
// core.test.ts / patients.test.ts for the same pattern.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'visits-test-reception@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'reception', full_name: 'Visits Test Reception',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-VISITSTEST-1', fullName: 'Visits Test', phone: '9222222222', sex: 'Female' } as Parameters<typeof Patients.create>[0])
})

afterAll(async () => {
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
})

afterEach(async () => {
  await admin.from('visits').delete().eq('id', testVisitId)
})

describe('Visits repository (Supabase-backed)', () => {
  it('creates a visit linked to a patient', async () => {
    const saved = await Visits.create({
      id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting',
    } as Parameters<typeof Visits.create>[0])
    expect(saved.patientId).toBe(testPatientId)
    expect(saved.status).toBe('waiting')
  })

  it('advance() moves the visit through queue_status', async () => {
    await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])
    const advanced = await Visits.advance(testVisitId, 'vitals')
    expect(advanced?.status).toBe('vitals')
  })

  it("byPatient() returns only that patient's visits", async () => {
    await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])
    const rows = await Visits.byPatient(testPatientId)
    expect(rows.every((v) => v.patientId === testPatientId)).toBe(true)
    expect(rows.some((v) => v.id === testVisitId)).toBe(true)
  })

  // Security-review fix: visits_update_nurse (20260704101500) was originally
  // role-only — any nurse could update any visit's any column. It's now
  // scoped (20260704122501) to exactly the intended transition: a visit
  // currently in 'vitals', moving to 'consulting'. This proves the narrowing
  // actually blocks the arbitrary case, exercising the real Visits.advance
  // call path (not a raw query) exactly as recordOpdVitals does in production.
  it("does not let a nurse advance a visit that is not currently in 'vitals' status", async () => {
    const nurseEmail = 'visits-test-nurse-scope@example.com'
    const nursePassword = 'Test-Pass-123!'
    const { data: nurseData, error: nurseCreateError } = await admin.auth.admin.createUser({
      email: nurseEmail, password: nursePassword, email_confirm: true,
    })
    if (nurseCreateError || !nurseData.user) throw new Error(`createUser failed: ${nurseCreateError?.message}`)
    const nurseUserId = nurseData.user.id
    const { error: profileError } = await admin.from('profiles').insert({
      id: nurseUserId, role: 'nurse', full_name: 'Visits Test Nurse Scope',
    })
    if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)

    // Fixture created directly via the service-role client, still in
    // 'waiting' — i.e. reception has not yet sent it to vitals.
    const { error: visitError } = await admin.from('visits').insert({
      id: nurseScopeVisitId, patient_id: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting',
    })
    if (visitError) throw new Error(`visit fixture insert failed: ${visitError.message}`)

    try {
      const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email: nurseEmail, password: nursePassword,
      })
      if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

      const patched = await Visits.advance(nurseScopeVisitId, 'consulting')
      expect(patched).toBeUndefined()

      const { data: remoteVisit } = await admin.from('visits').select('status').eq('id', nurseScopeVisitId).single()
      expect(remoteVisit?.status).toBe('waiting')
    } finally {
      await admin.from('visits').delete().eq('id', nurseScopeVisitId)
      await admin.from('profiles').delete().eq('id', nurseUserId)
      await admin.auth.admin.deleteUser(nurseUserId)
      // Restore the reception session subsequent tests in this file expect.
      const { error: reSignInError } = await getSupabaseClient().auth.signInWithPassword({
        email: staffEmail, password: staffPassword,
      })
      if (reSignInError) throw new Error(`re-signIn failed: ${reSignInError.message}`)
    }
  })
})
