import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { NurseTasks } from '@/lib/api/nurse-tasks'
import { getSupabaseClient } from '@/lib/supabase/client'

const testTaskId = 'TASK-NTTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const nurseEmail = 'nurse-tasks-test-nurse@example.com'
const testPassword = 'Test-Pass-123!'
let nurseUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: nurseEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  nurseUserId = data.user.id
  await admin.from('profiles').insert({ id: nurseUserId, role: 'nurse', full_name: 'Nurse Tasks Test Nurse' })
  await getSupabaseClient().auth.signInWithPassword({ email: nurseEmail, password: testPassword })
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', nurseUserId)
  await admin.auth.admin.deleteUser(nurseUserId)
})

afterEach(async () => {
  await admin.from('nurse_tasks').delete().eq('id', testTaskId)
})

describe('NurseTasks repository', () => {
  it('create() inserts a manual task', async () => {
    const saved = await NurseTasks.create({
      id: testTaskId, patientName: 'Test Patient', title: 'Assist with hygiene',
      category: 'Hygiene', priority: 'Low', source: 'manual',
    })
    expect(saved.done).toBe(false)
  })

  it('toggle() marks a task done', async () => {
    await NurseTasks.create({
      id: testTaskId, patientName: 'Test Patient', title: 'Assist with hygiene',
      category: 'Hygiene', priority: 'Low', source: 'manual',
    })
    const done = await NurseTasks.toggle(testTaskId, true)
    expect(done?.done).toBe(true)
    expect(done?.doneAt).toBeTruthy()
  })

  it('byKeys() dedupes AI-generated tasks by key', async () => {
    await NurseTasks.create({
      id: testTaskId, key: 'ai-vitals-overdue-PT-1', patientName: 'Test Patient',
      title: 'Overdue vitals check', category: 'Vitals', priority: 'High', source: 'ai',
    })
    const rows = await NurseTasks.byKeys(['ai-vitals-overdue-PT-1'])
    expect(rows).toHaveLength(1)
  })
})
