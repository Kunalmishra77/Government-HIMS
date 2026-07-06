import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NarcoticsLog } from '@/lib/api/narcotics'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-NARCTEST-1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const pharmacyEmail = 'narcotics-test-pharmacy@example.com'
const testPassword = 'Test-Pass-123!'
let pharmacyUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: pharmacyEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  pharmacyUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: pharmacyUserId, role: 'pharmacy', full_name: 'Narcotics Test Pharmacy',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: pharmacyEmail, password: testPassword })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', pharmacyUserId)
  await admin.auth.admin.deleteUser(pharmacyUserId)
})

// Cleanup is keyed on `patient_id` (a stable value this test controls), not
// a fixed `id` — NarcoticsLog.create() always mints its own id via
// `_core.ts`'s `newId()` on insert (see narcotics.ts's module-level note: no
// realId-backed parent entity to gate on). A fixed test id in the `afterEach`
// filter would never match the real generated id and would leak a row into
// the live table on every run.
afterEach(async () => {
  await admin.from('narcotics_log').delete().eq('patient_id', testPatientId)
})

describe('NarcoticsLog repository', () => {
  it('create() writes a dual-signature entry', async () => {
    const entry = await NarcoticsLog.create({
      drug: 'Morphine 10mg/mL', date: '2026-07-05', time: '08:30',
      patient: 'Narcotics Test Patient', patientId: testPatientId, dose: '5mg IV',
      prescriber: 'Dr. Narcotics Test', dispenser: 'Narcotics Test Pharmacy',
      secondSignatory: 'Dr. Narcotics Test', batchNo: 'BTH-20240501-M', runningStock: 12,
    })
    expect(entry.drug).toBe('Morphine 10mg/mL')
    expect(entry.runningStock).toBe(12)
  })
})
