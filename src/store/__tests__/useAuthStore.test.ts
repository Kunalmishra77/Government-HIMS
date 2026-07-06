import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { useAuthStore } from '@/store/useAuthStore'
import { getSupabaseClient } from '@/lib/supabase/client'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'authstore-test-doctor@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

afterEach(async () => {
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
  await getSupabaseClient().auth.signOut()
})

describe('useAuthStore.hydrateFromSession', () => {
  it('populates currentUser/activeRole from the real session + profile row', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: staffEmail, password: staffPassword, email_confirm: true,
    })
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
    staffUserId = data.user.id
    await admin.from('profiles').insert({
      id: staffUserId, role: 'doctor', full_name: 'AuthStore Test Doctor', department: 'Cardiology',
    })
    const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
      email: staffEmail, password: staffPassword,
    })
    if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

    await useAuthStore.getState().hydrateFromSession()

    expect(useAuthStore.getState().currentUser?.id).toBe(staffUserId)
    expect(useAuthStore.getState().currentUser?.name).toBe('AuthStore Test Doctor')
    expect(useAuthStore.getState().activeRole).toBe('doctor')
  })

  it('leaves currentUser null when there is no session', async () => {
    await getSupabaseClient().auth.signOut()
    await useAuthStore.getState().hydrateFromSession()
    expect(useAuthStore.getState().currentUser).toBeNull()
  })
})
