import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getSupabaseClient } from '@/lib/supabase/client'

// The nurse works in shifts, assigned to a ward with responsibilities. This store
// holds the logged-in nurse's assignment, the active-ward view (switcher), and a
// persisted, two-sided handover log for auditable shift-to-shift transitions.

export type ShiftType = 'Morning' | 'Evening' | 'Night'
export const SHIFT_WINDOWS: Record<ShiftType, string> = { Morning: '07:00–15:00', Evening: '15:00–23:00', Night: '23:00–07:00' }
export const WARDS = ['Cardiac Care', 'ICU', 'General Ward', 'Semi-Private', 'Pre-op'] as const
export const ALL_WARDS = 'All wards'

export type Assignment = { nurseId: string; nurseName: string; ward: string; shift: ShiftType; responsibilities: string[] }

export type HandoverRecord = {
  id: string
  ward: string
  date: string
  fromShift: ShiftType
  toShift: ShiftType
  fromNurse: string
  toNurse?: string
  sbar: string
  addendum?: string
  patientCount: number
  signedAt: string
  receivedAt?: string
  receivedBy?: string
  status: 'signed' | 'received'
  realId?: string                          // the real shift_handovers.id, once materialized (Phase 7 Task 10)
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()

// A previous-shift handover for Cardiac Care, signed by the night nurse and
// awaiting receipt — so the incoming nurse can demonstrate the two-sided flow.
const SEED_HANDOVERS: HandoverRecord[] = [
  {
    id: 'ho-seed-1', ward: 'Cardiac Care', date: todayStr(),
    fromShift: 'Night', toShift: 'Morning', fromNurse: 'Kavitha Nair',
    sbar: 'Night shift handover — Cardiac Care\nKiran Patil (CCU-04): chest pain settled, troponin trend awaited; aspirin/atorvastatin/metformin given overnight; NEWS stable. Continue cardiac monitoring; repeat troponin this morning.',
    patientCount: 1, signedAt: minsAgo(20), status: 'signed',
  },
]

interface ShiftState {
  currentNurseId: string
  currentNurseName: string
  assignments: Assignment[]
  activeWard: string
  handovers: HandoverRecord[]
  setActiveWard: (w: string) => void
  myAssignment: () => Assignment | undefined
  pendingIncoming: () => HandoverRecord[]
  signHandover: (rec: Omit<HandoverRecord, 'id' | 'signedAt' | 'status'>) => string
  receiveHandover: (id: string, by: string) => void
  setHandoverRealId: (id: string, realId: string) => void
}

let _seq = 0
const uid = () => `ho-${Date.now()}-${++_seq}`

// Phase 7 Task 10 — mirrors useInpatientStore.ts's resolveRealIpdActor
// line-for-line (per-store duplication, same precedent as Lab/Radiology):
// resolves the REAL signed-in nurse from a live session + profiles lookup,
// never from the local `fromNurse`/`toNurse`/`receivedBy` display strings —
// signing/receiving a shift handover is a real clinical accountability act.
async function resolveRealShiftActor(): Promise<{ id: string; name: string } | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      currentNurseId: 'NR-402',
      currentNurseName: 'Anjali Desai',
      assignments: [
        { nurseId: 'NR-402', nurseName: 'Anjali Desai', ward: 'Cardiac Care', shift: 'Morning', responsibilities: ['Bedside care & vitals', 'Medication administration (MAR)', 'Doctor orders & rounds support', 'Fluid balance & IV care'] },
        { nurseId: 'NR-410', nurseName: 'Pooja Shetty', ward: 'ICU', shift: 'Morning', responsibilities: ['Critical care monitoring', 'Infusions & titration'] },
        { nurseId: 'NR-415', nurseName: 'Ravi Menon', ward: 'General Ward', shift: 'Morning', responsibilities: ['Ward rounds', 'Discharges'] },
      ],
      activeWard: 'Cardiac Care',
      handovers: SEED_HANDOVERS,
      setActiveWard: (w) => set({ activeWard: w }),
      myAssignment: () => get().assignments.find(a => a.nurseId === get().currentNurseId),
      pendingIncoming: () => {
        const a = get().assignments.find(x => x.nurseId === get().currentNurseId)
        if (!a) return []
        return get().handovers.filter(h => h.status === 'signed' && h.ward === a.ward && h.toShift === a.shift)
      },
      signHandover: (rec) => {
        const id = uid()
        set(s => ({ handovers: [{ ...rec, id, signedAt: new Date().toISOString(), status: 'signed' }, ...s.handovers] }))
        void (async () => {
          const actor = await resolveRealShiftActor()
          if (!actor) return
          try {
            const { ShiftHandovers } = await import('@/lib/api')
            const saved = await ShiftHandovers.sign({
              ward: rec.ward, date: rec.date, fromShift: rec.fromShift, toShift: rec.toShift,
              sbar: rec.sbar, addendum: rec.addendum, patientCount: rec.patientCount,
            }, actor)
            get().setHandoverRealId(id, saved.id)
          } catch (err) {
            console.error('[useShiftStore] real backend signHandover failed (local handover still recorded):', err)
          }
        })()
        return id
      },
      receiveHandover: (id, by) => {
        let realId: string | undefined
        set(s => {
          const next = { handovers: s.handovers.map(h => h.id === id ? { ...h, status: 'received' as const, receivedAt: new Date().toISOString(), receivedBy: by } : h) }
          realId = next.handovers.find(h => h.id === id)?.realId
          return next
        })
        if (!realId) return
        void (async () => {
          const actor = await resolveRealShiftActor()
          if (!actor) return
          try {
            const { ShiftHandovers } = await import('@/lib/api')
            await ShiftHandovers.receive(realId!, actor)
          } catch (err) {
            console.error('[useShiftStore] real backend receiveHandover failed (local handover still updated):', err)
          }
        })()
      },
      setHandoverRealId: (id, realId) => set(s => ({
        handovers: s.handovers.map(h => h.id === id ? { ...h, realId } : h),
      })),
    }),
    { name: 'agentix-nurse-shift', version: 1, storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
)
