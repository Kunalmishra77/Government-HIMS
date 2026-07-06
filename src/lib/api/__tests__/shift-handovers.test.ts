import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ShiftHandovers } from '@/lib/api/shift-handovers'
import { getSupabaseClient } from '@/lib/supabase/client'

const testHandoverId = 'HO-HOTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const nurseEmail = 'shift-handovers-test-nurse@example.com'
const testPassword = 'Test-Pass-123!'
let nurseUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: nurseEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  nurseUserId = data.user.id
  await admin.from('profiles').insert({ id: nurseUserId, role: 'nurse', full_name: 'Handover Test Nurse' })
  await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('shift_handovers').delete().eq('ward', 'Cardiac Care')
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

afterEach(async () => {
  await admin.from('shift_handovers').delete().neq('id', '')
})

describe('ShiftHandovers repository', () => {
  it('sign() stamps the real signing nurse', async () => {
    const saved = await ShiftHandovers.sign(
      { ward: 'Cardiac Care', date: '2026-07-06', fromShift: 'Night', toShift: 'Morning', sbar: 'Handover text', patientCount: 1 },
      { id: nurseUserId, name: 'Handover Test Nurse' },
    )
    expect(saved.fromNurseId).toBe(nurseUserId)
    expect(saved.status).toBe('signed')
  })

  it('receive() stamps the real receiving nurse', async () => {
    const saved = await ShiftHandovers.sign(
      { ward: 'Cardiac Care', date: '2026-07-06', fromShift: 'Night', toShift: 'Morning', sbar: 'Handover text', patientCount: 1 },
      { id: nurseUserId, name: 'Handover Test Nurse' },
    )
    const received = await ShiftHandovers.receive(saved.id, { id: nurseUserId, name: 'Handover Test Nurse' })
    expect(received?.status).toBe('received')
    expect(received?.receivedById).toBe(nurseUserId)
  })

  it('pendingFor() filters by ward/shift/status', async () => {
    await ShiftHandovers.sign(
      { ward: 'Cardiac Care', date: '2026-07-06', fromShift: 'Night', toShift: 'Morning', sbar: 'Handover text', patientCount: 1 },
      { id: nurseUserId, name: 'Handover Test Nurse' },
    )
    const rows = await ShiftHandovers.pendingFor('Cardiac Care', 'Morning')
    expect(rows.length).toBeGreaterThan(0)
  })
})
