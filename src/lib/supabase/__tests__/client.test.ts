import { describe, expect, it } from 'vitest'
import { getSupabaseClient } from '@/lib/supabase/client'

describe('getSupabaseClient', () => {
  it('returns a client that can reach the profiles table', async () => {
    const client = getSupabaseClient()
    const { error } = await client.from('profiles').select('id').limit(1)
    expect(error).toBeNull()
  })

  it('returns the same instance on repeated calls', () => {
    expect(getSupabaseClient()).toBe(getSupabaseClient())
  })
})
