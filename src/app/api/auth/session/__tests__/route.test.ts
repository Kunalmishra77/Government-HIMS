import './async-local-storage-polyfill'
import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { POST, DELETE } from '@/app/api/auth/session/route'
import { callRouteHandler } from './with-route-handler-context'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const staffEmail = 'session-route-test@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string | undefined

afterEach(async () => {
  if (staffUserId) {
    await admin.from('profiles').delete().eq('id', staffUserId)
    await admin.auth.admin.deleteUser(staffUserId)
    staffUserId = undefined
  }
})

function jsonRequest(method: string, body: unknown): Request {
  return new Request('http://localhost/api/auth/session', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/auth/session', () => {
  it('sets a server-side session from a valid access/refresh token pair and returns a Set-Cookie header', async () => {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: staffEmail, password: staffPassword, email_confirm: true,
    })
    if (userError || !userData.user) throw new Error(`createUser failed: ${userError?.message}`)
    staffUserId = userData.user.id
    await admin.from('profiles').insert({ id: staffUserId, role: 'reception', full_name: 'Session Route Test' })

    // Sign in with a throwaway client to get real tokens (not the shared getSupabaseClient()
    // singleton — this simulates what the browser's own sign-in call produces).
    const anon = createClient(url, anonKey)
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email: staffEmail, password: staffPassword,
    })
    if (signInError || !signInData.session) throw new Error(`signIn failed: ${signInError?.message}`)

    const req = jsonRequest('POST', {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    })
    const res = await callRouteHandler(req, () => POST(req))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeTruthy()
  })

  it('returns 400 for a missing token', async () => {
    const req = jsonRequest('POST', { access_token: '' })
    const res = await callRouteHandler(req, () => POST(req))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/auth/session', () => {
  it('clears the session and returns 200', async () => {
    const req = new Request('http://localhost/api/auth/session', { method: 'DELETE' })
    const res = await callRouteHandler(req, () => DELETE())
    expect(res.status).toBe(200)
  })
})
