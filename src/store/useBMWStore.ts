import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuditStore } from './useAuditStore'

export type WasteCategory = 'Yellow' | 'Red' | 'Blue' | 'Black' | 'White' | 'Cytotoxic'
export type DisposalStatus = 'pending' | 'collected' | 'treated' | 'disposed' | 'non_compliant'

// Per CPCB 2016 BMW Rules — colour code → typical waste types.
export const CATEGORY_INFO: Record<WasteCategory, { types: string; treatment: string; tint: string }> = {
  Yellow:    { types: 'Human anatomical, soiled, expired meds',       treatment: 'Incineration / plasma pyrolysis',  tint: 'bg-amber-100 text-amber-800 ring-amber-200' },
  Red:       { types: 'Contaminated recyclable plastics, tubing',     treatment: 'Autoclave / microwave + shredding', tint: 'bg-red-100 text-red-700 ring-red-200' },
  Blue:      { types: 'Glassware, metallic implants',                 treatment: 'Disinfection + recycling',         tint: 'bg-surface-sunken text-accent ring-primary/25' },
  Black:     { types: 'General waste (non-hazardous)',                treatment: 'Municipal disposal',               tint: 'bg-slate-200 text-slate-700 ring-slate-300' },
  White:     { types: 'Sharps (needles, blades)',                     treatment: 'Encapsulation / autoclave',        tint: 'bg-slate-100 text-slate-700 ring-slate-300' },
  Cytotoxic: { types: 'Cytotoxic drugs and waste',                    treatment: 'Incineration ≥1200 °C',            tint: 'bg-accent-soft text-accent ring-primary/25' },
}

export interface WasteLog {
  id: string
  date: string
  ward: string
  category: WasteCategory
  weightKg: number
  bagCount: number
  collectedBy: string
  collectedByName?: string
  collectedAt: string
  treatedAt?: string
  disposedAt?: string
  status: DisposalStatus
  vendorId?: string
  manifestNumber?: string
  remarks?: string
}

export interface ComplianceReport {
  id: string
  month: string
  totalWeightKg: number
  byCategory: Record<WasteCategory, number>
  incidents: number
  complianceScore: number
  submittedAt?: string
  status: 'draft' | 'submitted' | 'approved'
}

interface BMWState {
  wasteLogs: WasteLog[]
  reports: ComplianceReport[]
  addLog: (l: Omit<WasteLog, 'id'>) => void
  updateLog: (id: string, update: Partial<WasteLog>) => void
  todaySummary: () => Record<WasteCategory, number>
  // Mark collected (sealed at source) — fires audit.
  collectBag: (input: { ward: string; category: WasteCategory; weightKg: number; bagCount: number; collectedBy: string; collectedByName?: string }) => void
  // Mark a log as treated (post sterilization / treatment).
  markTreated: (id: string) => void
  // Hand over to authorised vendor — generates manifest, fires audit (HIC chapter).
  handoverToVendor: (id: string, vendorId: string, actorName: string) => void
  // Generate monthly compliance report from existing logs.
  generateMonthlyReport: (month: string) => ComplianceReport
}

const now = (offsetMin = 0) => new Date(Date.now() + offsetMin * 60000).toISOString()
const today = new Date().toISOString().slice(0, 10)

const WASTE_LOGS: WasteLog[] = [
  { id: 'BMW-001', date: today, ward: 'General Ward', category: 'Yellow', weightKg: 4.2, bagCount: 3,
    collectedBy: 'BW-1501', collectedByName: 'Ganesh Rao', collectedAt: now(-180), status: 'collected' },
  { id: 'BMW-002', date: today, ward: 'ICU', category: 'Red', weightKg: 2.8, bagCount: 2,
    collectedBy: 'BW-1501', collectedByName: 'Ganesh Rao', collectedAt: now(-165), treatedAt: now(-45), status: 'treated' },
  { id: 'BMW-003', date: today, ward: 'OT', category: 'Yellow', weightKg: 6.1, bagCount: 5,
    collectedBy: 'BW-1501', collectedByName: 'Ganesh Rao', collectedAt: now(-120), treatedAt: now(-60), disposedAt: now(-15),
    status: 'disposed', vendorId: 'BMW-VENDOR-01', manifestNumber: 'MF-20260530-03' },
  { id: 'BMW-004', date: today, ward: 'Pharmacy', category: 'Blue', weightKg: 1.5, bagCount: 1,
    collectedBy: 'BW-1501', collectedByName: 'Ganesh Rao', collectedAt: now(-90), status: 'pending' },
  { id: 'BMW-005', date: today, ward: 'CSSD', category: 'White', weightKg: 0.6, bagCount: 1,
    collectedBy: 'BW-1501', collectedByName: 'Ganesh Rao', collectedAt: now(-30), status: 'collected' },
]

export const useBMWStore = create<BMWState>()(persist((set, get) => ({
  wasteLogs: WASTE_LOGS,
  reports: [],

  addLog: (l) =>
    set((state) => ({ wasteLogs: [{ ...l, id: `BMW-${Date.now()}` }, ...state.wasteLogs] })),

  updateLog: (id, update) =>
    set((state) => ({ wasteLogs: state.wasteLogs.map((l) => l.id === id ? { ...l, ...update } : l) })),

  todaySummary: () => {
    const t = new Date().toDateString()
    const todayLogs = get().wasteLogs.filter((l) => new Date(l.date).toDateString() === t)
    const summary: Record<WasteCategory, number> = { Yellow: 0, Red: 0, Blue: 0, Black: 0, White: 0, Cytotoxic: 0 }
    todayLogs.forEach((l) => { summary[l.category] = (summary[l.category] ?? 0) + l.weightKg })
    return summary
  },

  collectBag: (input) => {
    const id = `BMW-${Date.now()}`
    set(state => ({
      wasteLogs: [{
        id,
        date: today,
        ward: input.ward,
        category: input.category,
        weightKg: input.weightKg,
        bagCount: input.bagCount,
        collectedBy: input.collectedBy,
        collectedByName: input.collectedByName,
        collectedAt: new Date().toISOString(),
        status: 'collected' as const,
      }, ...state.wasteLogs],
    }))
    useAuditStore.getState().log({
      userId: input.collectedBy, userName: input.collectedByName ?? 'BMW Tech',
      action: 'bmw_waste_collected',
      resource: 'bmw_log', resourceId: id,
      detail: `${input.category} · ${input.weightKg}kg · ${input.bagCount} bag(s) · ${input.ward}`,
    })
  },

  markTreated: (id) => {
    const log = get().wasteLogs.find(l => l.id === id)
    if (!log) return
    set(state => ({
      wasteLogs: state.wasteLogs.map(l => l.id === id ? { ...l, status: 'treated' as const, treatedAt: new Date().toISOString() } : l),
    }))
  },

  handoverToVendor: (id, vendorId, actorName) => {
    const log = get().wasteLogs.find(l => l.id === id)
    if (!log) return
    const manifestNumber = `MF-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*900+100)}`
    set(state => ({
      wasteLogs: state.wasteLogs.map(l => l.id === id ? {
        ...l, status: 'disposed' as const, disposedAt: new Date().toISOString(), vendorId, manifestNumber,
      } : l),
    }))
    useAuditStore.getState().log({
      userId: log.collectedBy, userName: actorName,
      action: 'bmw_handover_to_vendor',
      resource: 'bmw_log', resourceId: id,
      detail: `${log.category} · ${log.weightKg}kg handed to vendor ${vendorId} · manifest ${manifestNumber} · CPCB compliant`,
    })
  },

  generateMonthlyReport: (month) => {
    const logs = get().wasteLogs.filter(l => l.date.startsWith(month))
    const byCategory: Record<WasteCategory, number> = { Yellow: 0, Red: 0, Blue: 0, Black: 0, White: 0, Cytotoxic: 0 }
    for (const l of logs) byCategory[l.category] += l.weightKg
    const totalWeightKg = Object.values(byCategory).reduce((a, b) => a + b, 0)
    const nonCompliant = logs.filter(l => l.status === 'non_compliant').length
    const disposed = logs.filter(l => l.status === 'disposed').length
    const complianceScore = logs.length ? Math.round((disposed / logs.length) * 100) : 100
    const report: ComplianceReport = {
      id: `RPT-${month}`,
      month,
      totalWeightKg: Math.round(totalWeightKg * 10) / 10,
      byCategory,
      incidents: nonCompliant,
      complianceScore,
      status: 'draft',
    }
    set(state => ({
      reports: [report, ...state.reports.filter(r => r.id !== report.id)],
    }))
    return report
  },
}),
  {
    name: 'agentix-bmwstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
