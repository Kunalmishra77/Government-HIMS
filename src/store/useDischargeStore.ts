import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuditStore } from './useAuditStore'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { IpdStay } from '@/lib/api/ipd-stays'

export type ClearancePillar = 'doctor' | 'nursing' | 'pharmacy' | 'billing' | 'insurance'

export type DischargeBlocker = {
  id: string
  type: string
  description: string
  owner: string
  resolvedAt?: string
}

export type DischargePatient = {
  id: string
  patientId: string
  patientName: string
  wardBed: string
  diagnosis: string
  admittedOn: string
  expectedDischarge: string
  attendingDoctor: string
  clearances: Record<ClearancePillar, 'pending' | 'cleared'>
  blockers: DischargeBlocker[]
  orderIssued: boolean
  summaryDrafted: boolean
  summaryApproved: boolean
  exitClearanceIssued: boolean
  /** When exit clearance was issued (discharge completed) — drives history. */
  dischargedAt?: string
  dischargeSummary?: string
  dischargeInstructions?: string
  followUpDate?: string
  payerType: string
  condition?: 'Stable' | 'Monitoring' | 'Critical'
  inOT?: boolean
  otProcedure?: string
  otExpectedEnd?: string
  ttoMeds?: { name: string; dose: string; freq: string; duration: string }[]
  realId?: string                          // the real ipd_stays.id, stamped by useInpatientStore's initiateDischarge (Phase 7 Task 9)
}

interface DischargeState {
  dischargeQueue: DischargePatient[]
  initDischarge: (patient: Omit<DischargePatient, 'id' | 'clearances' | 'blockers' | 'orderIssued' | 'summaryDrafted' | 'summaryApproved' | 'exitClearanceIssued'>) => void
  setClearance: (patientId: string, pillar: ClearancePillar, status: 'pending' | 'cleared') => void
  /** Re-issue / revoke the discharge order (step 1). */
  setOrderIssued: (patientId: string, issued: boolean) => void
  addBlocker: (patientId: string, blocker: Omit<DischargeBlocker, 'id'>) => void
  resolveBlocker: (patientId: string, blockerId: string) => void
  draftSummary: (patientId: string, summary: string) => void
  approveSummary: (patientId: string) => void
  /** Re-open the drafted summary (also un-approves, since approval depends on a draft). */
  undraftSummary: (patientId: string) => void
  /** Re-open an approved summary back to drafted/in-progress. */
  unapproveSummary: (patientId: string) => void
  issueExitClearance: (patientId: string) => void
  setFollowUp: (patientId: string, date: string) => void
  setInstructions: (patientId: string, instructions: string) => void
  /** Remove a patient from the discharge queue (e.g. discharge cancelled — back to IPD). */
  removeFromQueue: (patientId: string) => void
  setRealId: (patientId: string, realId: string) => void
}

const MOCK_DISCHARGE_PATIENTS: DischargePatient[] = [
  {
    id: 'DC-001',
    patientId: 'PT-10203',
    patientName: 'Mohan Lal',
    wardBed: 'Semi-Private 202',
    diagnosis: 'Type 2 Diabetes — stabilised',
    admittedOn: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    expectedDischarge: new Date().toISOString(),
    attendingDoctor: 'Dr. Priya Menon',
    clearances: { doctor: 'cleared', nursing: 'cleared', pharmacy: 'pending', billing: 'pending', insurance: 'pending' },
    blockers: [
      { id: 'BLK-001', type: 'Billing', description: 'Final pharmacy bill not reconciled', owner: 'Billing Desk' },
      { id: 'BLK-002', type: 'Insurance', description: 'TPA pre-auth query pending since 6h', owner: 'Karan Patel (TPA)' },
    ],
    orderIssued: true,
    summaryDrafted: true,
    summaryApproved: false,
    exitClearanceIssued: false,
    payerType: 'Cashless (Star Health)',
    condition: 'Stable',
    ttoMeds: [
      { name: 'Metformin 500mg', dose: '500mg', freq: 'BD', duration: '30 days' },
      { name: 'Glimepiride 2mg', dose: '2mg', freq: 'OD', duration: '30 days' },
    ],
    dischargeSummary: `Patient Mohan Lal, 52 years, admitted on ${new Date(Date.now() - 4 * 24 * 3600000).toLocaleDateString()} for Type 2 Diabetes management. Presenting with HbA1c of 11.2%. Treated with IV insulin protocol for 2 days followed by oral hypoglycaemics. Blood glucose stabilised. Nephrology review done — no CKD progression. Discharged on Metformin 500mg BD and Glimepiride 2mg OD. Follow-up in 2 weeks.`,
  },
  {
    id: 'DC-003',
    patientId: 'PT-20394',
    patientName: 'Kiran Patil',
    wardBed: 'Cardiology — Bed 8',
    diagnosis: 'NSTEMI · post-PCI · stable',
    admittedOn: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
    expectedDischarge: new Date(Date.now() + 3 * 3600000).toISOString(),
    attendingDoctor: 'Dr. Vikram Rathore',
    clearances: { doctor: 'cleared', nursing: 'cleared', pharmacy: 'cleared', billing: 'pending', insurance: 'pending' },
    blockers: [
      { id: 'BLK-K1', type: 'Billing', description: 'Final billing summary being prepared', owner: 'Billing Desk' },
    ],
    orderIssued: true,
    summaryDrafted: true,
    summaryApproved: true,
    exitClearanceIssued: false,
    payerType: 'Cashless (HDFC ERGO)',
    condition: 'Stable',
    followUpDate: new Date(Date.now() + 14 * 24 * 3600000).toISOString(),
    dischargeInstructions: 'Dual antiplatelet therapy for 12 months. Continue statin. Cardiac rehabilitation enrolment via outpatient. No heavy lifting × 4 weeks. Report immediately if chest pain, breathlessness or palpitations recur.',
    ttoMeds: [
      { name: 'Aspirin 75mg', dose: '75mg', freq: 'OD', duration: '12 months' },
      { name: 'Clopidogrel 75mg', dose: '75mg', freq: 'OD', duration: '12 months' },
      { name: 'Atorvastatin 40mg', dose: '40mg', freq: 'HS', duration: 'continuous' },
      { name: 'Metoprolol 25mg', dose: '25mg', freq: 'BD', duration: 'continuous' },
      { name: 'Pantoprazole 40mg', dose: '40mg', freq: 'OD', duration: '1 month' },
    ],
    dischargeSummary: `Patient Kiran Patil, 58 years, admitted with acute-onset chest pain and elevated Troponin I (0.92 ng/mL). Diagnosed with Non-ST-Elevation Myocardial Infarction (NSTEMI). Underwent successful percutaneous coronary intervention (PCI) with drug-eluting stent placement in the LAD. Post-procedural course uneventful, vitals stable. Discharged on dual antiplatelet therapy, statin, beta-blocker and PPI. Follow-up in 2 weeks with cardiology OPD; cardiac rehabilitation enrolment scheduled.`,
  },
  {
    id: 'DC-002',
    patientId: 'PT-10202',
    patientName: 'Priya Sharma',
    wardBed: 'General Ward 105',
    diagnosis: 'Appendicitis — post-laparoscopic appendectomy',
    admittedOn: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    expectedDischarge: new Date().toISOString(),
    attendingDoctor: 'Dr. Ravi Kumar',
    clearances: { doctor: 'cleared', nursing: 'pending', pharmacy: 'pending', billing: 'pending', insurance: 'cleared' },
    blockers: [
      { id: 'BLK-003', type: 'Nursing', description: 'Post-op wound dressing change pending', owner: 'Nurse Anjali Desai' },
    ],
    orderIssued: true,
    summaryDrafted: false,
    summaryApproved: false,
    exitClearanceIssued: false,
    payerType: 'General (Cash)',
    condition: 'Monitoring',
    inOT: true,
    otProcedure: 'Laparoscopic Cholecystectomy',
    otExpectedEnd: '03:30 PM',
  },
]

// Already-discharged patients — populate the "Discharged Patients" history so the
// section isn't empty on first load. Injected into existing persisted state by
// the v2 migrate below (matched on patientId).
const DISCHARGED_HISTORY: DischargePatient[] = [
  {
    id: 'DC-H-001', patientId: 'PT-55001', patientName: 'Rohan Verma', wardBed: 'General Ward 108',
    diagnosis: 'Dengue fever — recovered', admittedOn: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    expectedDischarge: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), attendingDoctor: 'Dr. Priya Menon',
    clearances: { doctor: 'cleared', nursing: 'cleared', pharmacy: 'cleared', billing: 'cleared', insurance: 'cleared' },
    blockers: [], orderIssued: true, summaryDrafted: true, summaryApproved: true, exitClearanceIssued: true,
    dischargedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(), payerType: 'Cashless (HDFC ERGO)', condition: 'Stable',
  },
  {
    id: 'DC-H-002', patientId: 'PT-55002', patientName: 'Lakshmi Iyer', wardBed: 'Private Room 305',
    diagnosis: 'Cholecystectomy — post-op recovered', admittedOn: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    expectedDischarge: new Date(Date.now() - 6 * 3600000).toISOString(), attendingDoctor: 'Dr. Ravi Kumar',
    clearances: { doctor: 'cleared', nursing: 'cleared', pharmacy: 'cleared', billing: 'cleared', insurance: 'cleared' },
    blockers: [], orderIssued: true, summaryDrafted: true, summaryApproved: true, exitClearanceIssued: true,
    dischargedAt: new Date(Date.now() - 6 * 3600000).toISOString(), payerType: 'Self-pay', condition: 'Stable',
  },
]

// Phase 7 Task 9 — mirrors useInpatientStore.ts's own patchWithSharedDischarge
// line-for-line (duplicated per-store, same precedent as resolveRealIpdActor):
// read-then-merge before patching, since useInpatientStore may have last
// written fields this store's local DischargePatient doesn't know about
// (pillars.clinical, meds, redFlags, initiatedAt, doneAt).
//
// `pillars` gets its OWN nested merge, on top of the outer shallow merge: a
// caller here must pass `dischargePartial.pillars` as a partial object
// containing ONLY the key(s) it actually changed (never a full record
// recomputed from this store's own local `clearances`, which lags behind
// whatever useInpatientStore's clearPillar may have already written for a
// different key) — this function merges that partial onto the CURRENT real
// pillars (not this store's local one) so useInpatientStore's already-
// written keys survive untouched. Verification (this task's throwaway
// script) caught that setClearance originally sent a full 5-key
// `toSharedPillars(clearances)` object, which clobbered whatever
// useInpatientStore.clearPillar had just written for a key this store's own
// local `clearances` didn't yet know about.
type SharedDischargePartial =
  Omit<Partial<NonNullable<IpdStay['discharge']>>, 'pillars'> & { pillars?: Partial<NonNullable<IpdStay['discharge']>['pillars']> }

async function patchWithSharedDischarge(
  realId: string,
  dischargePartial: SharedDischargePartial,
) {
  const { IpdStays } = await import('@/lib/api')
  const current = await IpdStays.get(realId)
  const mergedPillars = dischargePartial.pillars
    ? { ...(current?.discharge?.pillars ?? {}), ...dischargePartial.pillars }
    : undefined
  const merged = {
    ...(current?.discharge ?? {}),
    ...dischargePartial,
    ...(mergedPillars ? { pillars: mergedPillars } : {}),
  } as NonNullable<IpdStay['discharge']>
  return IpdStays.patch(realId, { discharge: merged })
}

// 'doctor' (this store) <-> 'clinical' (useInpatientStore.ts's own
// DischargePillarKey) — every other key spells identically. See this plan's
// Global Constraints for why 'clinical' was chosen as the canonical name.
function toSharedPillarKey(pillar: ClearancePillar): 'clinical' | 'nursing' | 'pharmacy' | 'billing' | 'insurance' {
  return pillar === 'doctor' ? 'clinical' : pillar
}

export const useDischargeStore = create<DischargeState>()(persist((set) => ({
  dischargeQueue: [...MOCK_DISCHARGE_PATIENTS, ...DISCHARGED_HISTORY],

  initDischarge: (patient) =>
    set((s) => ({
      dischargeQueue: [
        ...s.dischargeQueue,
        {
          ...patient,
          id: `DC-${Date.now()}`,
          clearances: { doctor: 'pending', nursing: 'pending', pharmacy: 'pending', billing: 'pending', insurance: 'pending' },
          blockers: [],
          orderIssued: true,
          summaryDrafted: false,
          summaryApproved: false,
          exitClearanceIssued: false,
        },
      ],
    })),

  setClearance: (patientId, pillar, status) => {
    let updated: DischargePatient | undefined
    set((s) => {
      const nextQueue = s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, clearances: { ...p.clearances, [pillar]: status } }
        // The 'doctor' pillar is the master gate for all doctor-owned steps:
        // toggling it cascades to the order + summary draft/approval, so the
        // whole doctor block reverts (OFF) or re-clears (ON) in one action.
        if (pillar === 'doctor') {
          const on = status === 'cleared'
          next.orderIssued = on
          next.summaryDrafted = on
          next.summaryApproved = on
        }
        updated = next
        return next
      })
      return { dischargeQueue: nextQueue }
    })
    useAuditStore.getState().log({
      userId: 'DC-SYS', userName: 'Discharge',
      action: 'discharge_clearance', resource: 'discharge', resourceId: patientId,
      detail: `${pillar} → ${status}`,
    })
    if (!updated?.realId) return
    const { realId, orderIssued, summaryDrafted, summaryApproved } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        // Send ONLY the one pillar this action changed (never this store's
        // full local `clearances` record) — see patchWithSharedDischarge's
        // comment for why: this store's local `clearances` doesn't know
        // about pillars useInpatientStore.clearPillar already cleared.
        await patchWithSharedDischarge(realId, { pillars: { [toSharedPillarKey(pillar)]: status === 'cleared' }, orderIssued, summaryDrafted, summaryApproved })
      } catch (err) {
        console.error('[useDischargeStore] real backend setClearance failed (local queue still updated):', err)
      }
    })()
  },

  setOrderIssued: (patientId, issued) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, orderIssued: issued }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, orderIssued } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { orderIssued })
      } catch (err) {
        console.error('[useDischargeStore] real backend setOrderIssued failed (local queue still updated):', err)
      }
    })()
  },

  draftSummary: (patientId, summary) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryDrafted: true, dischargeSummary: summary }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, dischargeSummary } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryDrafted: true, summary: dischargeSummary })
      } catch (err) {
        console.error('[useDischargeStore] real backend draftSummary failed (local queue still updated):', err)
      }
    })()
  },

  approveSummary: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryApproved: true }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryApproved: true })
      } catch (err) {
        console.error('[useDischargeStore] real backend approveSummary failed (local queue still updated):', err)
      }
    })()
  },

  undraftSummary: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryDrafted: false, summaryApproved: false }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryDrafted: false, summaryApproved: false })
      } catch (err) {
        console.error('[useDischargeStore] real backend undraftSummary failed (local queue still updated):', err)
      }
    })()
  },

  unapproveSummary: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, summaryApproved: false }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { summaryApproved: false })
      } catch (err) {
        console.error('[useDischargeStore] real backend unapproveSummary failed (local queue still updated):', err)
      }
    })()
  },

  issueExitClearance: (patientId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, exitClearanceIssued: true, dischargedAt: new Date().toISOString() }
        updated = next
        return next
      }),
    }))
    useAuditStore.getState().log({
      userId: 'DC-SYS', userName: 'Discharge',
      action: 'exit_clearance_issued', resource: 'discharge', resourceId: patientId,
      detail: `Exit clearance issued for ${patientId}`,
    })
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { exitClearanceIssued: true })
      } catch (err) {
        console.error('[useDischargeStore] real backend issueExitClearance failed (local queue still updated):', err)
      }
    })()
  },

  setFollowUp: (patientId, date) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, followUpDate: date }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { followUpDate: date })
      } catch (err) {
        console.error('[useDischargeStore] real backend setFollowUp failed (local queue still updated):', err)
      }
    })()
  },

  setInstructions: (patientId, instructions) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, dischargeInstructions: instructions }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { dischargeInstructions: instructions })
      } catch (err) {
        console.error('[useDischargeStore] real backend setInstructions failed (local queue still updated):', err)
      }
    })()
  },

  addBlocker: (patientId, blocker) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, blockers: [...p.blockers, { ...blocker, id: `BLK-${Date.now()}` }] }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, blockers } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { blockers })
      } catch (err) {
        console.error('[useDischargeStore] real backend addBlocker failed (local queue still updated):', err)
      }
    })()
  },

  resolveBlocker: (patientId, blockerId) => {
    let updated: DischargePatient | undefined
    set((s) => ({
      dischargeQueue: s.dischargeQueue.map(p => {
        if (p.patientId !== patientId) return p
        const next = { ...p, blockers: p.blockers.map(b => b.id === blockerId ? { ...b, resolvedAt: new Date().toISOString() } : b) }
        updated = next
        return next
      }),
    }))
    if (!updated?.realId) return
    const { realId, blockers } = updated
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        await patchWithSharedDischarge(realId, { blockers })
      } catch (err) {
        console.error('[useDischargeStore] real backend resolveBlocker failed (local queue still updated):', err)
      }
    })()
  },

  removeFromQueue: (patientId) =>
    set((s) => ({ dischargeQueue: s.dischargeQueue.filter(p => p.patientId !== patientId) })),

  setRealId: (patientId, realId) => set(s => ({
    dischargeQueue: s.dischargeQueue.map(p => p.patientId === patientId ? { ...p, realId } : p),
  })),
}),
  {
    name: 'agentix-dischargestore', version: 2,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
    // v2: seed the discharged-patients history into existing persisted queues
    // (only the entries not already present, matched by patientId).
    migrate: (persisted) => {
      const p = persisted as { dischargeQueue?: DischargePatient[] } | undefined
      if (p?.dischargeQueue) {
        const existing = new Set(p.dischargeQueue.map(d => d.patientId))
        p.dischargeQueue = [...p.dischargeQueue, ...DISCHARGED_HISTORY.filter(d => !existing.has(d.patientId))]
      }
      return p as DischargeState
    },
  },
))
