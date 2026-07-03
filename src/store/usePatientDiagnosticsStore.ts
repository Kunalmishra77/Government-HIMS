import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Diagnostics for the logged-in patient — laboratory tests and radiology scans
// the doctor ordered, with their fulfilment status and report availability.
// Front-end simulation today; in production these surface as real-time events
// from the lab LIS / radiology PACS. Mirrors the test items the doctor ordered
// (see usePatientOrdersStore). Seeded for the demo patient (Kiran Patil, PT-20394).

export type DiagnosticKind = 'lab' | 'radiology'
export type DiagnosticStatus = 'ordered' | 'sample_collected' | 'processing' | 'completed'

export const STATUS_LABEL: Record<DiagnosticStatus, string> = {
  ordered: 'Ordered',
  sample_collected: 'Sample collected',
  processing: 'Processing',
  completed: 'Completed',
}

export interface DiagnosticItem {
  id: string
  kind: DiagnosticKind
  name: string
  dept: string                  // 'Pathology' | 'Radiology' | sub-department
  orderedAt: number             // timestamp ordered
  status: DiagnosticStatus
  reportAvailable: boolean
  summary?: string              // plain-language one-liner once verified
  reportUrl?: string            // link to the rendered report (mock: in-app route)
}

// ---- Pure derivations (shared across the dashboard & records page) ----
export const pendingItems = (items: DiagnosticItem[]) => items.filter(i => i.status !== 'completed')
export const completedItems = (items: DiagnosticItem[]) => items.filter(i => i.status === 'completed')
export const byKind = (items: DiagnosticItem[], kind: DiagnosticKind) => items.filter(i => i.kind === kind)

const HOUR = 3600_000

function seed(): DiagnosticItem[] {
  const now = Date.now()
  return [
    { id: 'd-cbc', kind: 'lab', name: 'Complete Blood Count (CBC)', dept: 'Pathology', orderedAt: now - 4 * HOUR, status: 'completed', reportAvailable: true, summary: 'All values within normal range — no infection markers.', reportUrl: '/patient/records' },
    { id: 'd-hba1c', kind: 'lab', name: 'HbA1c (3-month sugar)', dept: 'Pathology', orderedAt: now - 4 * HOUR, status: 'processing', reportAvailable: false },
    { id: 'd-lipid', kind: 'lab', name: 'Lipid Profile', dept: 'Pathology', orderedAt: now - 2 * HOUR, status: 'sample_collected', reportAvailable: false },
    { id: 'd-cxr', kind: 'radiology', name: 'Chest X-ray (PA view)', dept: 'Radiology', orderedAt: now - 5 * HOUR, status: 'completed', reportAvailable: true, summary: 'Clear lung fields — no active disease seen.', reportUrl: '/patient/records' },
    { id: 'd-usg', kind: 'radiology', name: 'USG Abdomen', dept: 'Radiology', orderedAt: now - 1 * HOUR, status: 'ordered', reportAvailable: false },
  ]
}

interface DiagnosticsStore {
  items: DiagnosticItem[]
  reset: () => void
}

export const usePatientDiagnosticsStore = create<DiagnosticsStore>()(persist((set) => ({
  items: seed(),
  reset: () => set({ items: seed() }),
}),
  {
    name: 'agentix-patientdiagnosticsstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
