/* NurseTasks — the shift worklist. Mirrors `NurseTask` in
 * src/store/useNursingStore.ts and the `nurse_tasks` table in
 * supabase/migrations/20260706012000_nurse_shift_tables.sql. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const NurseTaskCategory = z.enum(['Vitals', 'Medication', 'Assessment', 'Hygiene', 'Mobility', 'Documentation', 'Procedure'])
export const NurseTaskPriority = z.enum(['High', 'Medium', 'Low'])
export const NurseTaskSource = z.enum(['ai', 'manual'])

export const NurseTaskSchema = z.object({
  id: z.string(),                          // 'TASK-...'
  key: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string(),
  title: z.string(),
  category: NurseTaskCategory,
  priority: NurseTaskPriority,
  source: NurseTaskSource,
  done: z.boolean().default(false),
  createdAt: z.string(),
  doneAt: z.string().optional(),
})
export type NurseTask = z.infer<typeof NurseTaskSchema>

const nurseTasks = table<NurseTask>('nurse_tasks', NurseTaskSchema)

export const NurseTasks = {
  list: (filter?: (t: NurseTask) => boolean) => nurseTasks.list(filter),
  byKeys: (keys: string[]) => nurseTasks.list((t) => !!t.key && keys.includes(t.key)),

  async create(input: Omit<NurseTask, 'id' | 'done' | 'createdAt'> & { id?: string }) {
    const row: NurseTask = { ...input, id: input.id ?? newId('TASK'), done: false, createdAt: isoNow() }
    return nurseTasks.insert(row)
  },

  async toggle(id: string, done: boolean) {
    return nurseTasks.patch(id, { done, doneAt: done ? isoNow() : null as unknown as NurseTask['doneAt'] })
  },

  async remove(id: string) {
    return nurseTasks.remove(id)
  },

  _table: nurseTasks,
}
