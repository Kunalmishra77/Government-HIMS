import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { table } from '@/lib/api/_core'
import { getSupabaseClient } from '@/lib/supabase/client'

const TestPatientSchema = z.object({
  id: z.string(),
  hn: z.string(),
  fullName: z.string(),
  phone: z.string(),
  sex: z.enum(['Male', 'Female', 'Other']),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
type TestPatient = z.infer<typeof TestPatientSchema>

const testId = 'PT-CORETEST-1'

// `table()` writes through the shared `getSupabaseClient()` singleton (anon key). RLS
// (Task 3) requires an authenticated reception/admin staff session for patients writes,
// so this suite signs in as a real staff user via that same singleton before exercising
// put/patch/list — this is what a signed-in browser session looks like in production.
// Setup/teardown of the staff fixture itself goes through the service-role admin client,
// same as src/lib/supabase/__tests__/rls.test.ts.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'core-test-reception@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'reception', full_name: 'Core Test Reception',
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

afterEach(async () => {
  await admin.from('patients').delete().eq('id', testId)
})

describe('table() against the real patients table', () => {
  it('put(): converts camelCase input to snake_case columns and back on read', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    const saved = await patients.put({
      id: testId, hn: 'HN-CORETEST-1', fullName: 'Core Test Patient', phone: '9000000000', sex: 'Other',
    })
    expect(saved.fullName).toBe('Core Test Patient')

    const fetched = await patients.get(testId)
    expect(fetched?.fullName).toBe('Core Test Patient')
    expect(fetched?.hn).toBe('HN-CORETEST-1')
  })

  it('patch(): partial camelCase update reaches the right snake_case column', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    await patients.put({ id: testId, hn: 'HN-CORETEST-1', fullName: 'Before', phone: '9000000000', sex: 'Other' })
    const patched = await patients.patch(testId, { fullName: 'After' })
    expect(patched?.fullName).toBe('After')
  })

  it('list(): returns camelCase rows and applies the client-side filter', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    await patients.put({ id: testId, hn: 'HN-CORETEST-1', fullName: 'Filter Me', phone: '9000000000', sex: 'Other' })
    const rows = await patients.list((p) => p.fullName === 'Filter Me')
    expect(rows.some((r) => r.id === testId)).toBe(true)
  })

  // Deviates from the task-5 brief's literal `remove()` assertion (`toBe(true)` on an
  // existing row). Verified live against Supabase: the RLS migration (Task 3) defines no
  // DELETE policy on `patients` for any role (reception, admin, or otherwise) — hard
  // deletes are unsupported by design, matching the app-level contract (`Patients` never
  // exposes `remove`; `Patients.softDelete` sets `deletedAt` instead, for the DISHA RTBF
  // audit trail). So `remove()` correctly reports `false` even for a row that exists,
  // because RLS silently filters it out of the DELETE (0 rows affected, no error).
  it('remove(): reports false for an existing row — patients has no DELETE RLS policy (hard delete is unsupported by design)', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    await patients.put({ id: testId, hn: 'HN-CORETEST-1', fullName: 'To Delete', phone: '9000000000', sex: 'Other' })
    expect(await patients.remove(testId)).toBe(false)
    expect(await patients.remove(testId)).toBe(false)
  })
})
