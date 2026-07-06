import { describe, expect, it } from 'vitest'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

describe('getSupabaseAdminClient', () => {
  it('returns a client that can list auth users (service-role only capability)', async () => {
    const client = getSupabaseAdminClient()
    const { data, error } = await client.auth.admin.listUsers()
    expect(error).toBeNull()
    expect(Array.isArray(data.users)).toBe(true)
  })

  it('throws if called from a browser context', () => {
    // Simulate a browser global existing (as it would in a client component bundle).
    ;(globalThis as { window?: unknown }).window = {}
    expect(() => getSupabaseAdminClient()).toThrow(/must not be called from the browser/)
    delete (globalThis as { window?: unknown }).window
  })
})
