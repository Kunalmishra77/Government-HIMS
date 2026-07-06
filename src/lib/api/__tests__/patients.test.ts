import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { getSupabaseClient } from '@/lib/supabase/client'

const testId = 'PT-PATIENTSTEST-1'

// Patients.create/softDelete route through table('patients', ...), which writes via the
// shared getSupabaseClient() singleton (anon key). RLS (Task 3) requires an authenticated
// reception/admin staff session for patients inserts/updates, so this suite signs in as a
// real staff user via that same singleton first — see core.test.ts for the same pattern.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'patients-test-reception@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'reception', full_name: 'Patients Test Reception',
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
})

const testId2 = 'PT-PATIENTSTEST-2'

afterEach(async () => {
  await admin.from('patients').delete().eq('id', testId)
  await admin.from('patients').delete().eq('id', testId2)
})

describe('Patients repository (Supabase-backed)', () => {
  it('creates a patient with a generated id and timestamps', async () => {
    const saved = await Patients.create({
      id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male',
    } as Parameters<typeof Patients.create>[0])
    expect(saved.id).toBe(testId)
    expect(saved.createdAt).toBeTruthy()
  })

  // AABHA/UHID bridge (Reception's Aadhaar -> ABHA -> UHID flow) — the real
  // columns added in supabase/migrations/20260706070000_patients_identity_columns.sql.
  it('creates a patient with uhid/abhaId/aadhaarVerified and round-trips them via get()', async () => {
    const saved = await Patients.create({
      id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male',
      uhid: 'PUH-2026-90001', abhaId: '14-1111-2222-3333', aadhaarVerified: true,
    } as Parameters<typeof Patients.create>[0])
    expect(saved.uhid).toBe('PUH-2026-90001')
    expect(saved.abhaId).toBe('14-1111-2222-3333')
    expect(saved.aadhaarVerified).toBe(true)

    const fetched = await Patients.get(testId)
    expect(fetched?.uhid).toBe('PUH-2026-90001')
    expect(fetched?.abhaId).toBe('14-1111-2222-3333')
    expect(fetched?.aadhaarVerified).toBe(true)
  })

  it('defaults aadhaarVerified to false and leaves uhid/abhaId unset when not provided', async () => {
    const saved = await Patients.create({
      id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male',
    } as Parameters<typeof Patients.create>[0])
    expect(saved.aadhaarVerified).toBe(false)
    expect(saved.uhid).toBeUndefined()
    expect(saved.abhaId).toBeUndefined()
  })

  it('rejects a second patient with the same uhid (partial unique index) — the real backstop behind writeWithUhidRetry', async () => {
    await Patients.create({
      id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male',
      uhid: 'PUH-2026-90002',
    } as Parameters<typeof Patients.create>[0])

    await expect(Patients.create({
      id: testId2, hn: 'HN-PATIENTSTEST-2', fullName: 'Patients Test Two', phone: '9222222222', sex: 'Female',
      uhid: 'PUH-2026-90002',
    } as Parameters<typeof Patients.create>[0])).rejects.toThrow(/patients_uhid_unique_idx/)
  })

  it('allows multiple patients with no uhid at all (partial index only constrains non-null values)', async () => {
    const a = await Patients.create({
      id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male',
    } as Parameters<typeof Patients.create>[0])
    const b = await Patients.create({
      id: testId2, hn: 'HN-PATIENTSTEST-2', fullName: 'Patients Test Two', phone: '9222222222', sex: 'Female',
    } as Parameters<typeof Patients.create>[0])
    expect(a.uhid).toBeUndefined()
    expect(b.uhid).toBeUndefined()
  })

  it('finds the patient via list() with a phone filter, matching findByPhone-style lookups', async () => {
    await Patients.create({ id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male' } as Parameters<typeof Patients.create>[0])
    const found = await Patients.list((p) => p.phone === '9111111111')
    expect(found.some((p) => p.id === testId)).toBe(true)
  })

  it('soft-deletes: softDelete sets deletedAt and list() excludes it by default', async () => {
    await Patients.create({ id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male' } as Parameters<typeof Patients.create>[0])
    await Patients.softDelete(testId)
    const active = await Patients.list()
    expect(active.some((p) => p.id === testId)).toBe(false)
  })
})
