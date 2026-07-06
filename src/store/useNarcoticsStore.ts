import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getSupabaseClient } from '@/lib/supabase/client'

// Phase 6 Task 6 — same isBrowser-guarded storage fix as usePharmacyStore.ts's
// Task 3 fix and usePharmacyInventoryStore.ts's Task 5 fix: bare
// `createJSONStorage(() => localStorage)` throws uncaught the first time
// persist actually calls getItem/setItem in any non-browser environment (SSR,
// this Node-based vitest suite) — this is the first task to call `addEntry`
// from a test.
const isBrowser = typeof window !== 'undefined'
const safeStorage = {
  getItem: (name: string) => isBrowser ? localStorage.getItem(name) : null,
  setItem: (name: string, value: string) => { if (isBrowser) localStorage.setItem(name, value) },
  removeItem: (name: string) => { if (isBrowser) localStorage.removeItem(name) },
}

// Phase 6 post-review fix — a private copy of the same resolveRealPharmacyActor
// shape defined in usePharmacyStore.ts (Task 4) and usePharmacyInventoryStore.ts
// (Task 5) — each store file defines its own, matching the Lab/Radiology
// convention of not sharing this helper across store modules. `dispenser` at
// the real call site (pharmacy/queue's confirmCollect) is `me.name`, sourced
// from useAuthStore.currentUser — a spoofable local flag, never the real
// actor. This table is the NDPS-Act controlled-substance audit log, so
// `dispenser` must be genuinely session-resolved before it reaches
// `narcotics_log`. Returns undefined (skip the real write) if there's no live
// session or the session has no matching profile row.
async function resolveRealPharmacyActor(): Promise<{ id: string; name: string } | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}

// Controlled-substance (Schedule H1/X) register. Dispensing a scheduled drug
// auto-appends a dual-signature entry (NDPS-style audit). Physical register still
// required in reality — this is the digital mirror.
export type NarcoticEntry = {
  id: string
  drug: string
  date: string
  time: string
  patient: string
  patientId: string
  dose: string
  prescriber: string
  dispenser: string
  secondSignatory: string
  batchNo: string
  runningStock: number
}

const SEED: NarcoticEntry[] = [
  { id: 'N-001', drug: 'Morphine 10mg/mL', date: '2026-05-26', time: '08:30', patient: 'Kiran Patil', patientId: 'PT-20394', dose: '5mg IV', prescriber: 'Dr. Priya Nair', dispenser: 'Ritu Sharma', secondSignatory: 'Dr. Priya Nair', batchNo: 'BTH-20240501-M', runningStock: 13 },
  { id: 'N-002', drug: 'Morphine 10mg/mL', date: '2026-05-26', time: '12:30', patient: 'Mohan Lal', patientId: 'PT-20398', dose: '5mg IV', prescriber: 'Dr. Vikram Rathore', dispenser: 'Ritu Sharma', secondSignatory: 'Dr. Vikram Rathore', batchNo: 'BTH-20240501-M', runningStock: 12 },
]

interface NarcoticsState {
  log: NarcoticEntry[]
  addEntry: (e: Omit<NarcoticEntry, 'id'>) => Promise<void>
}

let _seq = 0
export const useNarcoticsStore = create<NarcoticsState>()(persist((set) => ({
  log: SEED,
  addEntry: async (e) => {
    // Local state keeps the caller-supplied `dispenser` untouched (same
    // local/real divergence as claim()'s assignedTo in usePharmacyStore.ts) —
    // only the real write below gets its actor swapped for the genuinely
    // signed-in pharmacist.
    set(s => ({ log: [{ ...e, id: `N-${Date.now()}-${++_seq}` }, ...s.log] }))

    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { NarcoticsLog } = await import('@/lib/api')
      await NarcoticsLog.create({ ...e, dispenser: actor.name })
    } catch (err) {
      console.error('[useNarcoticsStore] real backend addEntry failed (local log still updated):', err)
    }
  },
}),
  {
    name: 'agentix-narcoticsstore', version: 1,
    storage: createJSONStorage(() => safeStorage),
    skipHydration: true,
  },
))
