import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getSupabaseClient } from '@/lib/supabase/client'

// Persisted nursing tasks — the shift worklist. Tasks are patient-linked and can
// be added manually or auto-built by the AI from the live ward state (overdue
// vitals, due meds, pending orders, acuity-driven assessments). `key` makes AI
// task generation idempotent so re-building doesn't duplicate.

export type NurseTaskCategory = 'Vitals' | 'Medication' | 'Assessment' | 'Hygiene' | 'Mobility' | 'Documentation' | 'Procedure'
export type NurseTaskPriority = 'High' | 'Medium' | 'Low'

export type NurseTask = {
  id: string
  key?: string                 // stable identity for AI-derived tasks (dedupe)
  patientId?: string
  patientName: string
  title: string
  category: NurseTaskCategory
  priority: NurseTaskPriority
  source: 'ai' | 'manual'
  done: boolean
  createdAt: string
  doneAt?: string
  realId?: string               // the real nurse_tasks.id, once materialized (Phase 7 Task 10)
}

let _seq = 0
const uid = () => `task-${Date.now()}-${++_seq}`

const SEED: NurseTask[] = [
  { id: uid(), patientName: 'Kiran Patil', patientId: 'PT-20394', title: 'Assist with morning hygiene', category: 'Hygiene', priority: 'Low', source: 'manual', done: true, createdAt: new Date(Date.now() - 5 * 3600000).toISOString(), doneAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: uid(), patientName: 'Raju Singh', patientId: 'IP-3002', title: 'Encourage mobilisation — short walk', category: 'Mobility', priority: 'Low', source: 'manual', done: false, createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
]

interface NursingState {
  tasks: NurseTask[]
  addTask: (t: Omit<NurseTask, 'id' | 'createdAt' | 'done'>) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  // Add AI-suggested tasks, skipping any whose `key` already exists.
  addAiTasks: (suggested: Omit<NurseTask, 'id' | 'createdAt' | 'done'>[]) => number
  setTaskRealId: (id: string, realId: string) => void
}

export const useNursingStore = create<NursingState>()(
  persist(
    (set, get) => ({
      tasks: SEED,
      addTask: (t) => {
        const id = uid()
        set(s => ({ tasks: [{ ...t, id, done: false, createdAt: new Date().toISOString() }, ...s.tasks] }))
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            const saved = await NurseTasks.create({
              key: t.key, patientId: t.patientId, patientName: t.patientName,
              title: t.title, category: t.category, priority: t.priority, source: t.source,
            })
            get().setTaskRealId(id, saved.id)
          } catch (err) {
            console.error('[useNursingStore] real backend addTask failed (local task still recorded):', err)
          }
        })()
      },
      toggleTask: (id) => {
        let realId: string | undefined
        let nowDone: boolean | undefined
        set(s => {
          const next = { tasks: s.tasks.map(t => t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined } : t) }
          const found = next.tasks.find(t => t.id === id)
          realId = found?.realId
          nowDone = found?.done
          return next
        })
        if (!realId || nowDone === undefined) return
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            await NurseTasks.toggle(realId!, nowDone!)
          } catch (err) {
            console.error('[useNursingStore] real backend toggleTask failed (local task still updated):', err)
          }
        })()
      },
      removeTask: (id) => {
        const realId = get().tasks.find(t => t.id === id)?.realId
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
        if (!realId) return
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            await NurseTasks.remove(realId)
          } catch (err) {
            console.error('[useNursingStore] real backend removeTask failed (local task still removed):', err)
          }
        })()
      },
      addAiTasks: (suggested) => {
        const existing = new Set(get().tasks.map(t => t.key).filter(Boolean))
        const fresh = suggested.filter(t => t.key && !existing.has(t.key))
        if (!fresh.length) return 0
        const withIds = fresh.map(t => ({ ...t, id: uid(), done: false, createdAt: new Date().toISOString() }))
        set(s => ({ tasks: [...withIds, ...s.tasks] }))
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { NurseTasks } = await import('@/lib/api')
            for (const t of withIds) {
              const saved = await NurseTasks.create({
                key: t.key, patientId: t.patientId, patientName: t.patientName,
                title: t.title, category: t.category, priority: t.priority, source: t.source,
              })
              get().setTaskRealId(t.id, saved.id)
            }
          } catch (err) {
            console.error('[useNursingStore] real backend addAiTasks failed (local tasks still recorded):', err)
          }
        })()
        return fresh.length
      },
      setTaskRealId: (id, realId) => set(s => ({
        tasks: s.tasks.map(t => t.id === id ? { ...t, realId } : t),
      })),
    }),
    { name: 'agentix-nursing-tasks', version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
)
