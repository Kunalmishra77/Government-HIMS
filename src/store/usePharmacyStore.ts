import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuditStore } from '@/store/useAuditStore'
import { useNotificationStore } from '@/store/useNotificationStore'
import { usePharmacyInventoryStore } from '@/store/usePharmacyInventoryStore'
import { getSupabaseClient } from '@/lib/supabase/client'

// Phase 6 Task 3 — guarded on `isBrowser` (same pattern as _core.ts's
// readRaw/writeRaw/removeRaw, and useRadiologyStudiesStore.ts's safeStorage
// fix from Phase 5 Task 3). `createJSONStorage(() => localStorage)` always
// succeeded at store-creation time, but its bare `localStorage` reference
// threw uncaught the first time persist actually called getItem/setItem in
// any non-browser environment (SSR, this Node-based vitest suite) — any store
// action that calls `set()` would crash outside a real browser.
const isBrowser = typeof window !== 'undefined'
const safeStorage = {
  getItem: (name: string) => isBrowser ? localStorage.getItem(name) : null,
  setItem: (name: string, value: string) => { if (isBrowser) localStorage.setItem(name, value) },
  removeItem: (name: string) => { if (isBrowser) localStorage.removeItem(name) },
}

// Where a medicine order originated. Every order in the single queue is tagged
// with one of these so the pharmacy can manage OPD/IPD/OT/ICU/home/discharge in
// one place.
export type RxSource = 'OPD' | 'IPD' | 'OT' | 'ICU' | 'Home Rx' | 'Discharge'
export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Insurance' | 'Credit'
// How an individual line is being supplied. Defaults to 'pharmacy'. When a drug
// is out of stock the pharmacist either advises the patient to buy it outside or
// raises a purchase order to the inventory manager.
export type MedSupply = 'pharmacy' | 'advised_outside' | 'order_raised'
export type Pharmacist = { id: string; name: string }

// Sources that should notify the ward (nurse/MAR) rather than the patient.
const WARD_SOURCES: RxSource[] = ['IPD', 'ICU', 'OT']
const isWardRx = (p: { wardBed?: string; source?: RxSource; procurementStatus?: ProcurementStatus }) =>
  !!p.wardBed || (p.source ? WARD_SOURCES.includes(p.source) : false) ||
  p.procurementStatus === 'deferred_ipd' || p.procurementStatus === 'procurement_requested'

export type PrepStatus = 'queued' | 'preparing' | 'ready' | 'collected'
export type ProcurementStatus = 'immediate' | 'deferred_ipd' | 'procurement_requested'
export type ModificationReason = 'Has at home' | 'Partial fill' | 'Unable to afford' | 'Travelling today' | 'Out of stock'

export interface QuantityModification {
  medicineName: string
  originalQty: number
  adjustedQty: number
  reason: ModificationReason
  adjustedAt: string
  adjustedBy: string
  requiresSupervisorOverride: boolean
  supervisorApprovedBy?: string
}

export const UNIT_PRICES: Record<string, number> = {
  'Paracetamol 500mg': 8,
  'Amoxicillin 250mg': 18,
  'Amoxicillin 500mg': 22,
  'ORS Sachets': 12,
  'Atorvastatin 10mg': 22,
  'Aspirin 75mg': 5,
  'Metoprolol 25mg': 15,
  'Diclofenac 50mg': 14,
  'Pantoprazole 40mg': 20,
  'Aspirin 75mg (IPD)': 5,
  'Heparin 5000U (IV)': 180,
  'Insulin Actrapid (IV)': 95,
  'Normal Saline 0.9% (1L)': 60,
  'KCl 20mEq (IV)': 45,
  // Therapeutic alternatives (used when substituting out-of-stock lines).
  'Azithromycin 500mg':   35,
  'Cefixime 200mg':       28,
  'Enoxaparin 40mg (SC)': 220,
  'Clopidogrel 75mg':     15,
  'Rosuvastatin 10mg':    28,
  'Omeprazole 20mg':      18,
  'Rabeprazole 20mg':     22,
  'Ibuprofen 400mg':      6,
  'Naproxen 250mg':       12,
  'Atenolol 50mg':        8,
  'Bisoprolol 5mg':       18,
}

export interface PharmacyPrescription {
  id: string
  patientId: string
  patientName: string
  tokenNumber: number
  doctorName: string
  department: string
  source?: RxSource
  paymentMode?: PaymentMode
  medicines: PharmacyMedicine[]
  status: PrepStatus
  dispatchedAt: string
  estimatedReadyIn: number
  notes?: string
  triageLevel?: 'Low' | 'Medium' | 'High' | 'Critical'
  patientModifications?: string[]
  procurementStatus?: ProcurementStatus
  requestedByWardAt?: string
  wardBed?: string
  quantityModifications?: QuantityModification[]
  adjustedBillTotal?: number
  originalBillTotal?: number
  // Multi-pharmacist claim model + collected-record audit.
  assignedTo?: Pharmacist     // pharmacist who accepted it into their counter
  dispensedBy?: Pharmacist    // set at collection = whoever dispensed
  collectedBy?: string        // who physically collected (patient/relative/nurse)
  collectedAt?: string        // ISO timestamp of collection
  realId?: string             // the real pharmacy_dispenses.id, once materialized (Phase 6 Task 3)
}

export interface PharmacyMedicine {
  name: string
  dosage: string
  frequency: string
  duration: string
  quantity: number
  inStock?: boolean         // availability vs pharmacy inventory
  supply?: MedSupply        // how this line is supplied (default 'pharmacy')
  substitutedFrom?: string  // original drug name if this line was swapped for a substitute
}

interface PharmacyStore {
  prescriptions: PharmacyPrescription[]
  addPrescription: (p: PharmacyPrescription) => void
  updateStatus: (id: string, status: PrepStatus) => Promise<void>
  markCollected: (id: string, collectedBy?: string) => Promise<void>
  claim: (id: string, pharmacist: Pharmacist) => Promise<void>
  release: (id: string) => Promise<void>
  setMedicineSupply: (id: string, medicineName: string, supply: MedSupply) => Promise<void>
  substituteMedicine: (id: string, originalName: string, newName: string, substitutedBy: string) => Promise<void>
  togglePatientModification: (prescriptionId: string, medicineName: string) => void
  applyModification: (prescriptionId: string) => void
  requestProcurement: (id: string) => Promise<void>
  adjustQuantity: (prescriptionId: string, medicineName: string, newQty: number, reason: ModificationReason, adjustedBy: string) => Promise<void>
  approveSupervisorOverride: (prescriptionId: string, medicineName: string, supervisorId: string) => Promise<void>
  setRealId: (id: string, realId: string) => void
}

const RITU: Pharmacist = { id: 'PH-301', name: 'Ritu Sharma' }
const ANIL: Pharmacist = { id: 'PH-302', name: 'Anil Kumar' }
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()

// Phase 6 Task 4 — resolves the REAL signed-in actor for a human pharmacy
// action (claim/adjustQuantity/approveSupervisorOverride), from a *live*
// Supabase session + a `profiles.full_name` lookup — never from the local
// `Pharmacist` parameter the UI passed in. That local parameter (RITU, ANIL,
// or `me` built from useAuthStore.currentUser) is a display-friendly demo
// roster entry / persisted-and-spoofable local flag, not necessarily a real
// `profiles.id`; mirroring it into `assigned_to`/`quantity_modifications[].
// supervisorApprovedBy` verbatim would let any caller claim to be any
// pharmacist, poisoning the audit trail (see
// src/lib/api/pharmacy-dispenses.ts's module-level note). Returns undefined
// (skip the write) if there's no live session or the session has no matching
// profile row.
async function resolveRealPharmacyActor(): Promise<Pharmacist | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}

const DEMO_PRESCRIPTIONS: PharmacyPrescription[] = [
  {
    id: 'RX001', patientId: 'P001', patientName: 'Meera Pillai', tokenNumber: 7,
    doctorName: 'Dr. Priya Nair', department: 'General Medicine',
    source: 'OPD', paymentMode: 'UPI', status: 'preparing', assignedTo: RITU,
    dispatchedAt: minsAgo(8), estimatedReadyIn: 4, triageLevel: 'Medium',
    medicines: [
      { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15, inStock: true },
      // Out-of-stock line on Dr. Priya Nair's prescription → surfaces on the doctor panel.
      { name: 'Amoxicillin 250mg', dosage: '250mg', frequency: 'BD', duration: '7 days', quantity: 14, inStock: false },
      { name: 'ORS Sachets', dosage: '1 sachet', frequency: 'After loose motions', duration: 'As needed', quantity: 10, inStock: true },
    ],
  },
  {
    id: 'RX002', patientId: 'P006', patientName: 'Rakesh Verma', tokenNumber: 3,
    doctorName: 'Dr. Arjun Mehta', department: 'Cardiology',
    source: 'OPD', paymentMode: 'Cash', status: 'ready', assignedTo: ANIL,
    dispatchedAt: minsAgo(20), estimatedReadyIn: 0, triageLevel: 'High',
    medicines: [
      { name: 'Atorvastatin 10mg', dosage: '10mg', frequency: 'OD at night', duration: '30 days', quantity: 30, inStock: true },
      { name: 'Aspirin 75mg', dosage: '75mg', frequency: 'OD after breakfast', duration: '30 days', quantity: 30, inStock: true },
      { name: 'Metoprolol 25mg', dosage: '25mg', frequency: 'BD', duration: '30 days', quantity: 60, inStock: true },
    ],
  },
  {
    id: 'RX003', patientId: 'P004', patientName: 'Kiran Patil', tokenNumber: 12,
    doctorName: 'Dr. Sunita Rao', department: 'Orthopedics',
    source: 'OPD', paymentMode: 'Card', status: 'queued',
    dispatchedAt: minsAgo(2), estimatedReadyIn: 10, triageLevel: 'Low',
    medicines: [
      { name: 'Diclofenac 50mg', dosage: '50mg', frequency: 'BD after food', duration: '5 days', quantity: 10, inStock: true },
      // Out-of-stock demo line — drives the cross-panel flow.
      { name: 'Amoxicillin 250mg', dosage: '250mg', frequency: 'TDS', duration: '5 days', quantity: 15, inStock: false },
      { name: 'Pantoprazole 40mg', dosage: '40mg', frequency: 'OD before breakfast', duration: '5 days', quantity: 5, inStock: true },
    ],
  },
  {
    id: 'RX-OT-001', patientId: 'PT-10330', patientName: 'Arjun Reddy', tokenNumber: 0,
    doctorName: 'Dr. Kavita Joshi', department: 'Anaesthesia',
    source: 'OT', paymentMode: 'Insurance', status: 'queued', wardBed: 'OT-1',
    dispatchedAt: minsAgo(14), estimatedReadyIn: 0, triageLevel: 'High',
    medicines: [
      { name: 'Diclofenac 50mg', dosage: '50mg', frequency: 'Post-op', duration: '3 days', quantity: 6, inStock: true },
      { name: 'Pantoprazole 40mg', dosage: '40mg', frequency: 'OD', duration: '3 days', quantity: 3, inStock: true },
    ],
  },
  {
    id: 'RX-IPD-001', patientId: 'PT-10210', patientName: 'Vikram Nair', tokenNumber: 0,
    doctorName: 'Dr. Priya Menon', department: 'Cardiology',
    source: 'ICU', paymentMode: 'Credit', status: 'queued', wardBed: 'ICU-02',
    dispatchedAt: minsAgo(25), estimatedReadyIn: 0, triageLevel: 'Critical',
    medicines: [
      { name: 'Aspirin 75mg', dosage: '75mg', frequency: 'OD', duration: '30 days', quantity: 30, inStock: true },
      { name: 'Atorvastatin 10mg', dosage: '10mg', frequency: 'OD at night', duration: '30 days', quantity: 30, inStock: true },
      // Out-of-stock IPD line.
      { name: 'Heparin 5000U (IV)', dosage: '5000 units', frequency: 'Q6H', duration: 'Per protocol', quantity: 12, inStock: false },
    ],
  },
  {
    id: 'RX-IPD-002', patientId: 'PT-10211', patientName: 'Lakshmi Iyer', tokenNumber: 0,
    doctorName: 'Dr. Vikram Rathore', department: 'Endocrinology',
    source: 'IPD', paymentMode: 'Insurance', status: 'queued', wardBed: 'General Ward — 104',
    dispatchedAt: minsAgo(50), estimatedReadyIn: 0, triageLevel: 'High',
    medicines: [
      { name: 'Insulin Actrapid (IV)', dosage: '0.1 units/kg/hr', frequency: 'Continuous infusion', duration: 'Until DKA resolved', quantity: 3, inStock: true },
      { name: 'Normal Saline 0.9% (1L)', dosage: '1L', frequency: 'Per fluid protocol', duration: 'As needed', quantity: 5, inStock: true },
      { name: 'KCl 20mEq (IV)', dosage: '20mEq', frequency: 'Per potassium protocol', duration: 'As needed', quantity: 6, inStock: true },
    ],
  },
  {
    id: 'RX-DIS-001', patientId: 'PT-10203', patientName: 'Mohan Lal', tokenNumber: 0,
    doctorName: 'Dr. Vikram Rathore', department: 'General Surgery',
    source: 'Discharge', paymentMode: 'Insurance', status: 'queued', wardBed: 'Ward B — 12',
    dispatchedAt: minsAgo(35), estimatedReadyIn: 0, triageLevel: 'Medium',
    notes: 'Take-home (TTO) meds on discharge',
    medicines: [
      { name: 'Atorvastatin 10mg', dosage: '10mg', frequency: 'OD at night', duration: '30 days', quantity: 30, inStock: true },
      { name: 'Aspirin 75mg', dosage: '75mg', frequency: 'OD', duration: '30 days', quantity: 30, inStock: true },
      { name: 'Pantoprazole 40mg', dosage: '40mg', frequency: 'OD', duration: '14 days', quantity: 14, inStock: true },
    ],
  },
  // ── Collected (audit ledger) ───────────────────────────────────────────────
  {
    id: 'RX-C-001', patientId: 'P009', patientName: 'Sanjay Gupta', tokenNumber: 2,
    doctorName: 'Dr. Priya Nair', department: 'General Medicine',
    source: 'OPD', paymentMode: 'Cash', status: 'collected',
    assignedTo: ANIL, dispensedBy: ANIL, collectedBy: 'Self (patient)', collectedAt: hoursAgo(3),
    dispatchedAt: hoursAgo(4), estimatedReadyIn: 0, triageLevel: 'Low',
    medicines: [
      { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'SOS', duration: '3 days', quantity: 9, inStock: true },
      { name: 'Amoxicillin 250mg', dosage: '250mg', frequency: 'BD', duration: '5 days', quantity: 10, inStock: true },
    ],
  },
  {
    id: 'RX-C-002', patientId: 'P011', patientName: 'Anita Desai', tokenNumber: 5,
    doctorName: 'Dr. Arjun Mehta', department: 'Cardiology',
    source: 'OPD', paymentMode: 'UPI', status: 'collected',
    assignedTo: RITU, dispensedBy: RITU, collectedBy: 'Daughter — Priya', collectedAt: hoursAgo(1),
    dispatchedAt: hoursAgo(2), estimatedReadyIn: 0, triageLevel: 'Medium',
    medicines: [
      { name: 'Atorvastatin 10mg', dosage: '10mg', frequency: 'OD at night', duration: '30 days', quantity: 30, inStock: true },
      { name: 'Aspirin 75mg', dosage: '75mg', frequency: 'OD', duration: '30 days', quantity: 30, inStock: true },
    ],
  },
]

export const usePharmacyStore = create<PharmacyStore>()(persist((set, get) => ({
  prescriptions: DEMO_PRESCRIPTIONS,

  addPrescription: (p) => {
    // Stamp defaults + check each line against live pharmacy inventory so
    // out-of-stock drugs are flagged the moment the order arrives.
    const inStockByName = usePharmacyInventoryStore.getState().inStockByName
    const medicines = p.medicines.map(m => ({
      ...m,
      inStock: m.inStock ?? inStockByName(m.name),
      supply: m.supply ?? ('pharmacy' as MedSupply),
    }))
    const stamped: PharmacyPrescription = {
      ...p,
      source: p.source ?? 'OPD',
      paymentMode: p.paymentMode ?? 'Cash',
      medicines,
    }
    set(state => ({ prescriptions: [stamped, ...state.prescriptions] }))
  },

  updateStatus: async (id, status) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, status, estimatedReadyIn: status === 'ready' ? 0 : p.estimatedReadyIn }
      }),
    }))
    // Closing the loop: when meds are ready, alert the right party — the ward
    // (nurse/MAR) for inpatient scripts, the patient for OPD scripts.
    if (status === 'ready') {
      const p = get().prescriptions.find(x => x.id === id)
      if (p) {
        const ward = isWardRx(p)
        useNotificationStore.getState().add({
          type: 'medicines_ready',
          priority: p.triageLevel === 'Critical' ? 'high' : 'medium',
          title: ward ? `Ward meds ready — ${p.patientName}` : `Medicines ready — ${p.patientName}`,
          body: ward
            ? `${p.medicines.length} item(s) ready for ${p.patientName} (${p.wardBed ?? 'ward'}) — collect/administer.`
            : `Your medicines are ready for collection at the pharmacy (token ${p.tokenNumber}).`,
          targetRole: ward ? 'nurse' : 'patient',
          patientName: p.patientName,
          channels: ['in_app'],
        })
      }
    }

    // Phase 6 Task 4 — additive bridge into the real backend.
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses, Prescriptions } = await import('@/lib/api')
      const patched = await PharmacyDispenses.updateStatus(realId, status)
      if (patched?.status === 'preparing') await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensing')
      if (patched?.status === 'collected') await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensed')
    } catch (err) {
      console.error('[usePharmacyStore] real backend updateStatus failed (local prescription still updated):', err)
    }
  },

  // Final dispense: records who collected it + who dispensed (the assignee).
  markCollected: async (id, collectedBy) => {
    let realId: string | undefined
    let priorDispensedBy: Pharmacist | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        priorDispensedBy = p.dispensedBy ?? p.assignedTo
        return {
          ...p,
          status: 'collected' as PrepStatus,
          collectedBy: collectedBy ?? p.collectedBy ?? 'Self (patient)',
          collectedAt: new Date().toISOString(),
          dispensedBy: priorDispensedBy,
        }
      }),
    }))

    if (!realId) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyDispenses, Prescriptions } = await import('@/lib/api')
      const patched = await PharmacyDispenses.markCollected(realId, collectedBy, actor)
      if (patched) await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensed')
    } catch (err) {
      console.error('[usePharmacyStore] real backend markCollected failed (local prescription still updated):', err)
    }
  },

  // Accept an order from the global queue into a pharmacist's personal counter.
  claim: async (id, pharmacist) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, assignedTo: pharmacist, status: p.status === 'queued' ? ('preparing' as PrepStatus) : p.status }
      }),
    }))
    if (!realId) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyDispenses, Prescriptions } = await import('@/lib/api')
      const patched = await PharmacyDispenses.claim(realId, actor)
      if (patched?.status === 'preparing') {
        await Prescriptions.setDispenseStatus(patched.prescriptionId, 'dispensing')
      }
    } catch (err) {
      console.error('[usePharmacyStore] real backend claim failed (local prescription still updated):', err)
    }
  },

  release: async (id) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, assignedTo: undefined, status: p.status === 'preparing' ? ('queued' as PrepStatus) : p.status }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.release(realId)
    } catch (err) {
      console.error('[usePharmacyStore] real backend release failed (local prescription still updated):', err)
    }
  },

  setMedicineSupply: async (id, medicineName, supply) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, medicines: p.medicines.map(m => m.name === medicineName ? { ...m, supply } : m) }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.setMedicineSupply(realId, medicineName, supply)
    } catch (err) {
      console.error('[usePharmacyStore] real backend setMedicineSupply failed (local prescription still updated):', err)
    }
  },

  // Swap an out-of-stock line for a therapeutically equivalent one that's on
  // hand. Audited so the doctor/patient can see what was substituted and why.
  substituteMedicine: async (id, originalName, newName, substitutedBy) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return {
          ...p,
          medicines: p.medicines.map(m =>
            m.name === originalName
              ? { ...m, name: newName, inStock: true, supply: 'pharmacy' as MedSupply, substitutedFrom: m.substitutedFrom ?? originalName }
              : m
          ),
        }
      }),
    }))
    const rx = get().prescriptions.find(p => p.id === id)
    if (rx) {
      useAuditStore.getState().log({
        userId: substitutedBy,
        userName: substitutedBy,
        action: 'pharmacy_substituted',
        resource: 'pharmacy_prescription',
        resourceId: id,
        detail: `${originalName} → ${newName} (out of stock, substituted)`,
        before: { drug: originalName },
        after: { drug: newName },
      })
    }

    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.substituteMedicine(realId, originalName, newName)
    } catch (err) {
      console.error('[usePharmacyStore] real backend substituteMedicine failed (local prescription still updated):', err)
    }
  },

  togglePatientModification: (prescriptionId, medicineName) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        const mods = p.patientModifications ?? []
        return {
          ...p,
          patientModifications: mods.includes(medicineName)
            ? mods.filter(m => m !== medicineName)
            : [...mods, medicineName],
        }
      }),
    })),

  applyModification: (prescriptionId) =>
    set(state => ({
      prescriptions: state.prescriptions.map(p =>
        p.id === prescriptionId ? { ...p } : p
      ),
    })),

  requestProcurement: async (id) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== id) return p
        realId = p.realId
        return { ...p, procurementStatus: 'procurement_requested' as ProcurementStatus, requestedByWardAt: new Date().toISOString() }
      }),
    }))
    if (!realId) return
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.requestProcurement(realId)
    } catch (err) {
      console.error('[usePharmacyStore] real backend requestProcurement failed (local prescription still updated):', err)
    }
  },

  adjustQuantity: async (prescriptionId, medicineName, newQty, reason, adjustedBy) => {
    let realId: string | undefined
    let savedMod: QuantityModification | undefined
    let savedAdjustedBill: number | undefined
    let savedOriginalBill: number | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        const medicine = p.medicines.find(m => m.name === medicineName)
        if (!medicine) return p
        realId = p.realId
        const originalQty = medicine.quantity
        const safeQty = Math.max(0, Math.min(originalQty, newQty))
        const requiresSupervisorOverride = originalQty > 0 && (originalQty - safeQty) / originalQty > 0.5
        const existingMods = (p.quantityModifications ?? []).filter(m => m.medicineName !== medicineName)
        const newMod: QuantityModification = {
          medicineName,
          originalQty,
          adjustedQty: safeQty,
          reason,
          adjustedAt: new Date().toISOString(),
          adjustedBy,
          requiresSupervisorOverride,
        }
        const allMods = [...existingMods, newMod]
        const adjustedBillTotal = p.medicines.reduce((sum, m) => {
          const mod = allMods.find(mod => mod.medicineName === m.name)
          const qty = mod ? mod.adjustedQty : m.quantity
          const price = UNIT_PRICES[m.name] ?? 0
          return sum + qty * price
        }, 0)
        const originalBillTotal = p.originalBillTotal ?? p.medicines.reduce((sum, m) => sum + m.quantity * (UNIT_PRICES[m.name] ?? 0), 0)
        savedMod = newMod
        savedAdjustedBill = adjustedBillTotal
        savedOriginalBill = originalBillTotal

        useAuditStore.getState().log({
          userId: adjustedBy,
          userName: adjustedBy,
          action: 'pharmacy_qty_adjusted',
          resource: 'pharmacy_prescription',
          resourceId: prescriptionId,
          detail: `${medicineName}: ${originalQty} → ${safeQty} (${reason})`,
          before: { qty: originalQty },
          after: { qty: safeQty, reason },
        })

        return { ...p, quantityModifications: allMods, adjustedBillTotal, originalBillTotal }
      }),
    }))

    if (!realId || !savedMod) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      // Local state keeps the UI-supplied `adjustedBy` (untouched above, same
      // local/real divergence as claim()'s assignedTo) — only the single
      // entry sent to the real backend gets its actor swapped for the real
      // signed-in pharmacist. PharmacyDispenses.adjustQuantity reads the
      // row's current quantityModifications itself and patches only this
      // medicine's entry, so any OTHER already-adjusted medicine's real
      // adjustedBy on the same prescription is never touched by this call.
      const realMod: QuantityModification = { ...savedMod, adjustedBy: actor.name }
      await PharmacyDispenses.adjustQuantity(realId, realMod, savedAdjustedBill, savedOriginalBill)
    } catch (err) {
      console.error('[usePharmacyStore] real backend adjustQuantity failed (local prescription still updated):', err)
    }
  },

  approveSupervisorOverride: async (prescriptionId, medicineName, supervisorId) => {
    let realId: string | undefined
    set(state => ({
      prescriptions: state.prescriptions.map(p => {
        if (p.id !== prescriptionId) return p
        realId = p.realId
        const mods = (p.quantityModifications ?? []).map(m =>
          m.medicineName === medicineName ? { ...m, supervisorApprovedBy: supervisorId, requiresSupervisorOverride: false } : m
        )
        useAuditStore.getState().log({
          userId: supervisorId,
          userName: supervisorId,
          action: 'pharmacy_supervisor_override',
          resource: 'pharmacy_prescription',
          resourceId: prescriptionId,
          detail: `Supervisor override approved for ${medicineName}`,
        })
        return { ...p, quantityModifications: mods }
      }),
    }))

    if (!realId) return
    const actor = await resolveRealPharmacyActor()
    if (!actor) return
    try {
      const { PharmacyDispenses } = await import('@/lib/api')
      await PharmacyDispenses.approveSupervisorOverride(realId, medicineName, actor.name)
    } catch (err) {
      console.error('[usePharmacyStore] real backend approveSupervisorOverride failed (local prescription still updated):', err)
    }
  },

  // Phase 6 Task 3 — stamps the real backend id onto the matching local
  // prescription, once sendRx's materialization succeeds. One dispense row
  // per prescription (no grouping ambiguity), so a simple id match is
  // correct with no positional-matching caveat needed.
  setRealId: (id, realId) => set(state => ({
    prescriptions: state.prescriptions.map(p => p.id === id ? { ...p, realId } : p),
  })),
}),
  {
    name: 'agentix-pharmacystore', version: 1,
    storage: createJSONStorage(() => safeStorage),
    skipHydration: true,
  },
))
