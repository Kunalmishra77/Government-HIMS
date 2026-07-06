import { afterEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/admin/staff/route'
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

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/staff', () => {
  it('creates a staff login and returns the profile', async () => {
    const res = await POST(jsonRequest({
      email: 'route-test-nurse@example.com', password: 'Test-Pass-123!',
      role: 'nurse', fullName: 'Route Test Nurse',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    createdUserId = body.id
    expect(body.role).toBe('nurse')
  })

  it('returns 400 for an invalid body', async () => {
    const res = await POST(jsonRequest({ email: 'not-an-email', role: 'nurse' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
