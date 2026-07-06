import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Beds } from '@/lib/api/beds'
import { getSupabaseClient } from '@/lib/supabase/client'

const testBedId = 'BED-BEDSTEST-1'
const testPatientId = 'PT-BEDSTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'beds-test-reception@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: receptionEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  receptionUserId = data.user.id
  await admin.from('profiles').insert({ id: receptionUserId, role: 'reception', full_name: 'Beds Test Reception' })
  // beds.occupant_id has a NOT NULL... actually nullable, but FK'd to patients(id) —
  // a real patient row is required so the "occupied" upsert doesn't violate
  // beds_occupant_id_fkey.
  await admin.from('patients').insert({ id: testPatientId, hn: 'HN-BEDSTEST-1', full_name: 'Test Patient', phone: '9111111111', sex: 'Male' })
  await getSupabaseClient().auth.signInWithPassword({ email: receptionEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('beds').delete().eq('id', testBedId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
})

afterEach(async () => {
  await admin.from('beds').delete().eq('id', testBedId)
})

describe('Beds repository', () => {
  it('upsert() materializes a bed on first write', async () => {
    const saved = await Beds.upsert({ id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available' })
    expect(saved.status).toBe('Available')
  })

  it('upsert() updates the same row on a second write (no realId indirection)', async () => {
    await Beds.upsert({ id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available' })
    const occupied = await Beds.upsert({
      id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground',
      status: 'Occupied', occupantId: testPatientId, occupantName: 'Test Patient',
    })
    expect(occupied.status).toBe('Occupied')
    const rows = await Beds.list((b) => b.id === testBedId)
    expect(rows).toHaveLength(1)
  })

  it('byWard() filters by ward', async () => {
    await Beds.upsert({ id: testBedId, bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available' })
    const rows = await Beds.byWard('General Ward')
    expect(rows.some((b) => b.id === testBedId)).toBe(true)
  })
})
