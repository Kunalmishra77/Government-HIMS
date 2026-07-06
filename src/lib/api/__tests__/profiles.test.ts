import { afterEach, describe, expect, it } from 'vitest'
import { Profiles } from '@/lib/api/profiles'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

let createdUserId: string | undefined

afterEach(async () => {
  if (createdUserId) {
    const admin = getSupabaseAdminClient()
    await admin.from('profiles').delete().eq('id', createdUserId)
    await admin.auth.admin.deleteUser(createdUserId)
    createdUserId = undefined
  }
})

describe('Profiles.createStaff', () => {
  it('creates an auth user and a matching profiles row', async () => {
    const result = await Profiles.createStaff({
      email: 'profiles-test-doctor@example.com', password: 'Test-Pass-123!',
      role: 'doctor', fullName: 'Profiles Test Doctor', department: 'General Medicine',
    })
    createdUserId = result.id
    expect(result.role).toBe('doctor')
    expect(result.fullName).toBe('Profiles Test Doctor')
  })
})
