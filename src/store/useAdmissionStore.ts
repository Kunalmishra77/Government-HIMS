import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useAuditStore } from './useAuditStore'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useInpatientStore } from './useInpatientStore'

export type BedStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Reserved' | 'Maintenance'

export type Bed = {
  id: string
  bedNumber: string
  ward: 'General Ward' | 'ICU' | 'Private Room' | 'Semi-Private' | 'Day Care'
  floor: string
  status: BedStatus
  occupantId?: string
  occupantName?: string
  cleaningAssignedTo?: string
  lastCleaned?: string
  gender?: 'Male' | 'Female' | 'Any'
  // When an occupied/cleaning bed is expected to become free (discharge ETA or
  // cleaning ready-by). A timestamp in the past means turnaround is overdue.
  expectedFreeAt?: string
}

// Helper for seeding relative expected-free times.
const inMins = (m: number) => new Date(Date.now() + m * 60000).toISOString()

export type AdmissionBundle = {
  prescriptions: Array<{ medicine: string; dosage: string; duration: string; instructions?: string }>
  labOrders: Array<{ testName: string; priority: string }>
  radiologyOrders: Array<{ scanType: string; bodyPart: string; priority: string }>
  allergies: string
  comorbidities: string
  specialInstructions: string
  urgency: 'Routine' | 'Urgent' | 'Emergency'
}

export type AdmissionRequest = {
  id: string
  patientId: string
  patientName: string
  patientAge: number
  patientGender: string
  diagnosis: string
  admissionType: string
  bedTypePreference: string
  reason: string
  requestedBy: string
  department: string
  triageLevel?: string
  payerType: string
  requestedAt: string
  status: 'Pending' | 'Assigned' | 'Admitted' | 'Cancelled'
  assignedBedId?: string
  bundle?: AdmissionBundle
  realId?: string                          // the real admission_requests.id, once hydrated/created (Phase 7 Task 3)
}

// ── Multi-branch bed availability ──────────────────────────────────
// The `beds` array is THIS branch (Agentix HIMS — MG Road). Other branches expose
// summary availability per ward so a doctor can find a bed elsewhere when the
// current branch is full.
export type WardName = Bed['ward']
export const WARD_ORDER: WardName[] = ['General Ward', 'ICU', 'Private Room', 'Semi-Private', 'Day Care']
export type BranchWard = { ward: WardName; total: number; available: number }
export type Branch = { id: string; name: string; location: string; distanceKm: number; phone: string; wards: BranchWard[] }

export const CURRENT_BRANCH = { id: 'mg-road', name: 'Agentix HIMS — MG Road', location: 'MG Road', distanceKm: 0, phone: '+91 80 1234 0000' }

export const OTHER_BRANCHES: Branch[] = [
  {
    id: 'whitefield', name: 'Agentix HIMS — Whitefield', location: 'Whitefield', distanceKm: 8.2, phone: '+91 80 1234 1111',
    wards: [
      { ward: 'General Ward', total: 24, available: 6 },
      { ward: 'ICU', total: 10, available: 3 },
      { ward: 'Private Room', total: 12, available: 5 },
      { ward: 'Semi-Private', total: 14, available: 0 },
      { ward: 'Day Care', total: 8, available: 4 },
    ],
  },
  {
    id: 'indiranagar', name: 'Agentix HIMS — Indiranagar', location: 'Indiranagar', distanceKm: 5.1, phone: '+91 80 1234 2222',
    wards: [
      { ward: 'General Ward', total: 18, available: 2 },
      { ward: 'ICU', total: 6, available: 1 },
      { ward: 'Private Room', total: 8, available: 0 },
      { ward: 'Semi-Private', total: 10, available: 3 },
      { ward: 'Day Care', total: 6, available: 2 },
    ],
  },
]

interface AdmissionState {
  beds: Bed[]
  admissionRequests: AdmissionRequest[]
  requestAdmission: (req: Omit<AdmissionRequest, 'id' | 'requestedAt' | 'status'>) => void
  assignBed: (requestId: string, bedId: string) => void
  markAdmitted: (requestId: string) => void
  markBedForCleaning: (bedId: string, staffName?: string) => void
  confirmBedReady: (bedId: string) => void
  cancelRequest: (requestId: string) => void
  setRealId: (id: string, realId: string) => void
  hydrateReal: () => Promise<void>
}

const MOCK_BEDS: Bed[] = [
  { id: 'BED-101', bedNumber: '101', ward: 'General Ward', floor: 'Ground', status: 'Available', gender: 'Male' },
  { id: 'BED-102', bedNumber: '102', ward: 'General Ward', floor: 'Ground', status: 'Occupied', occupantId: 'PT-10201', occupantName: 'Raju Singh', gender: 'Male', expectedFreeAt: inMins(40) },
  { id: 'BED-103', bedNumber: '103', ward: 'General Ward', floor: 'Ground', status: 'Cleaning', gender: 'Female', cleaningAssignedTo: 'Ramesh K.', expectedFreeAt: inMins(-15) },
  { id: 'BED-104', bedNumber: '104', ward: 'General Ward', floor: 'Ground', status: 'Available', gender: 'Female' },
  { id: 'BED-105', bedNumber: '105', ward: 'General Ward', floor: 'Ground', status: 'Occupied', occupantId: 'PT-10202', occupantName: 'Priya Sharma', gender: 'Female', expectedFreeAt: inMins(-35) },
  { id: 'BED-201', bedNumber: '201', ward: 'Semi-Private', floor: '1st', status: 'Available', gender: 'Any' },
  { id: 'BED-202', bedNumber: '202', ward: 'Semi-Private', floor: '1st', status: 'Occupied', occupantId: 'PT-10203', occupantName: 'Mohan Lal', gender: 'Any', expectedFreeAt: inMins(120) },
  { id: 'BED-301', bedNumber: '301', ward: 'Private Room', floor: '2nd', status: 'Available', gender: 'Any' },
  { id: 'BED-302', bedNumber: '302', ward: 'Private Room', floor: '2nd', status: 'Reserved', gender: 'Any', expectedFreeAt: inMins(25) },
  { id: 'BED-ICU-01', bedNumber: 'ICU-01', ward: 'ICU', floor: 'Ground', status: 'Occupied', occupantId: 'PT-10204', occupantName: 'Sunita Devi', gender: 'Any' },
  { id: 'BED-ICU-02', bedNumber: 'ICU-02', ward: 'ICU', floor: 'Ground', status: 'Available', gender: 'Any' },
  { id: 'BED-ICU-03', bedNumber: 'ICU-03', ward: 'ICU', floor: 'Ground', status: 'Maintenance', gender: 'Any' },
  { id: 'BED-DC-01', bedNumber: 'DC-01', ward: 'Day Care', floor: '1st', status: 'Available', gender: 'Any' },
  { id: 'BED-DC-02', bedNumber: 'DC-02', ward: 'Day Care', floor: '1st', status: 'Available', gender: 'Any' },
]

export const useAdmissionStore = create<AdmissionState>()(persist((set, get) => ({
  beds: MOCK_BEDS,
  admissionRequests: [
    {
      id: 'ADM-REQ-001',
      patientId: 'PT-10210',
      patientName: 'Vikram Nair',
      patientAge: 54,
      patientGender: 'Male',
      diagnosis: 'Acute MI — post-PCI',
      admissionType: 'ICU',
      bedTypePreference: 'ICU',
      reason: 'Post cardiac intervention monitoring required',
      requestedBy: 'Dr. Priya Menon',
      department: 'Cardiology',
      triageLevel: 'Critical',
      payerType: 'Cashless (HDFC Ergo)',
      requestedAt: new Date(Date.now() - 20 * 60000).toISOString(),
      status: 'Pending',
      bundle: {
        prescriptions: [
          { medicine: 'Aspirin 75mg', dosage: '75mg', duration: '30 days', instructions: 'OD after breakfast' },
          { medicine: 'Atorvastatin 10mg', dosage: '10mg', duration: '30 days', instructions: 'OD at night' },
        ],
        labOrders: [
          { testName: 'Troponin I', priority: 'Urgent' },
          { testName: 'Complete Blood Count (CBC)', priority: 'Routine' },
          { testName: 'Renal Function Test (RFT)', priority: 'Routine' },
        ],
        radiologyOrders: [
          { scanType: 'X-Ray', bodyPart: 'Chest', priority: 'Urgent' },
        ],
        allergies: 'Beta-blockers — causes bronchospasm',
        comorbidities: 'Hypertension, Type 2 Diabetes',
        specialInstructions: 'ECG monitoring continuous. Cardiac diet. NPO until further notice.',
        urgency: 'Emergency',
      },
    },
    {
      id: 'ADM-REQ-002',
      patientId: 'PT-10211',
      patientName: 'Lakshmi Iyer',
      patientAge: 38,
      patientGender: 'Female',
      diagnosis: 'Diabetic Ketoacidosis',
      admissionType: 'General Ward',
      bedTypePreference: 'General Ward',
      reason: 'IV insulin and electrolyte correction needed',
      requestedBy: 'Dr. Vikram Rathore',
      department: 'Endocrinology',
      triageLevel: 'High',
      payerType: 'General',
      requestedAt: new Date(Date.now() - 45 * 60000).toISOString(),
      status: 'Pending',
      bundle: {
        prescriptions: [
          { medicine: 'Insulin Actrapid (IV)', dosage: '0.1 units/kg/hr', duration: 'Until DKA resolved', instructions: 'IV infusion — titrate per protocol' },
          { medicine: 'Normal Saline 0.9%', dosage: '1L over 1 hour', duration: 'As per fluid protocol', instructions: 'IV bolus then maintenance' },
        ],
        labOrders: [
          { testName: 'Blood Glucose (FBS/PPBS)', priority: 'Urgent' },
          { testName: 'Serum Electrolytes', priority: 'Urgent' },
          { testName: 'HbA1c', priority: 'Routine' },
          { testName: 'Coagulation Profile (PT/APTT)', priority: 'Routine' },
        ],
        radiologyOrders: [],
        allergies: 'None known',
        comorbidities: 'Type 1 Diabetes since age 14',
        specialInstructions: 'Hourly CBG monitoring. Target glucose 150–250 mg/dL. Watch for hypokalemia.',
        urgency: 'Urgent',
      },
    },
  ],

  requestAdmission: (req) =>
    set((s) => ({
      admissionRequests: [
        ...s.admissionRequests,
        { ...req, id: `ADM-REQ-${Date.now()}`, requestedAt: new Date().toISOString(), status: 'Pending' },
      ],
    })),

  assignBed: (requestId, bedId) => {
    let assigned: { req?: AdmissionRequest; bed?: Bed } = {}
    set((s) => {
      const req = s.admissionRequests.find(r => r.id === requestId)
      if (!req) return s
      const bed = s.beds.find(b => b.id === bedId)
      assigned = { req, bed }
      return {
        admissionRequests: s.admissionRequests.map(r =>
          r.id === requestId ? { ...r, status: 'Assigned', assignedBedId: bedId } : r
        ),
        beds: s.beds.map(b =>
          b.id === bedId
            ? { ...b, status: 'Occupied', occupantId: req.patientId, occupantName: req.patientName }
            : b
        ),
      }
    })
    if (assigned.req && assigned.bed) {
      useAuditStore.getState().log({
        userId: 'ADM-1801', userName: 'Bed Manager',
        action: 'admission_admit',
        resource: 'admission_request', resourceId: requestId,
        detail: `${assigned.req.patientName} (${assigned.req.patientId}) → ${assigned.bed.ward} bed ${assigned.bed.bedNumber}`,
      })
    }
    void (async () => {
      if (!assigned.req?.realId) return
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      const updatedBed = get().beds.find(b => b.id === bedId)
      if (!updatedBed) return
      try {
        const { AdmissionRequests, Beds } = await import('@/lib/api')
        await AdmissionRequests.assignToBed(assigned.req!.realId!)
        await Beds.upsert(updatedBed)
      } catch (err) {
        console.error('[useAdmissionStore] real backend assignBed failed (local state still updated):', err)
      }
    })()
  },

  markAdmitted: (requestId) => {
    let snap: AdmissionRequest | undefined
    set((s) => {
      snap = s.admissionRequests.find(r => r.id === requestId)
      return {
        admissionRequests: s.admissionRequests.map(r =>
          r.id === requestId ? { ...r, status: 'Admitted' } : r
        ),
      }
    })
    if (!snap) return
    useAuditStore.getState().log({
      userId: 'ADM-1801', userName: 'Bed Manager',
      action: 'admission_admit',
      resource: 'admission_request', resourceId: requestId,
      detail: `Admitted ${snap.patientName} (${snap.patientId}) · ${snap.diagnosis}`,
    })

    const bed = snap.assignedBedId ? get().beds.find(b => b.id === snap!.assignedBedId) : undefined
    const admittedAt = new Date().toISOString()

    // Populate the IPD ward list IMMEDIATELY — this MUST run in the local/demo
    // flow too (no Supabase session), otherwise an admitted patient never shows
    // up in the doctor/nurse IPD chart (the reported Admission→IPD break). The
    // real DB write below only adds persistence + stamps the real id;
    // admitFromRequest dedups by patientId so the two paths can't double-add.
    useInpatientStore.getState().admitFromRequest({
      id: `IPD-${snap.patientId}-${Date.now()}`,
      patientId: snap.patientId,
      patientName: snap.patientName,
      age: snap.patientAge,
      gender: snap.patientGender,
      bed: bed?.bedNumber ?? snap.bedTypePreference,
      ward: bed?.ward ?? snap.admissionType,
      admittingDoctor: snap.requestedBy,
      diagnosis: snap.diagnosis,
      admittedAt,
      condition: snap.triageLevel === 'Critical' ? 'Critical' : 'Stable',
    })

    // Real backend persistence — only when this request has a real row + a live
    // session. On success, stamp the real ipd_stays id onto the local inpatient
    // so a later hydrateReal dedups against it instead of duplicating the row.
    void (async () => {
      if (!snap!.realId) return
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        const { AdmissionRequests, IpdStays } = await import('@/lib/api')
        await AdmissionRequests.markAdmitted(snap!.realId)
        const stay = await IpdStays.create({
          admissionRequestId: snap!.realId,
          patientId: snap!.patientId,
          patientName: snap!.patientName,
          age: snap!.patientAge,
          gender: snap!.patientGender,
          bed: bed?.bedNumber ?? snap!.bedTypePreference,
          ward: bed?.ward ?? snap!.admissionType,
          admittingDoctor: snap!.requestedBy,
          diagnosis: snap!.diagnosis,
          admittedAt,
          condition: snap!.triageLevel === 'Critical' ? 'Critical' : 'Stable',
          events: [{
            id: `e-admit-${Date.now()}`, at: admittedAt, type: 'admission',
            actor: 'Reception', title: `Admitted — ${snap!.diagnosis}`, severity: 'info',
            patientText: 'You were admitted to the ward.',
          }],
        })
        useInpatientStore.setState(s => ({
          inpatients: s.inpatients.map(ip =>
            ip.patientId === snap!.patientId && ip.stage !== 'discharged' ? { ...ip, realId: stay.id } : ip
          ),
        }))
      } catch (err) {
        console.error('[useAdmissionStore] real backend markAdmitted failed (local ward chart still updated):', err)
      }
    })()
  },

  markBedForCleaning: (bedId, staffName) => {
    set((s) => ({
      beds: s.beds.map(b =>
        b.id === bedId ? { ...b, status: 'Cleaning', cleaningAssignedTo: staffName } : b
      ),
    }))
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      const updatedBed = get().beds.find(b => b.id === bedId)
      if (!updatedBed) return
      try {
        const { Beds } = await import('@/lib/api')
        await Beds.upsert(updatedBed)
      } catch (err) {
        console.error('[useAdmissionStore] real backend markBedForCleaning failed (local state still updated):', err)
      }
    })()
  },

  confirmBedReady: (bedId) => {
    set((s) => ({
      beds: s.beds.map(b =>
        b.id === bedId ? { ...b, status: 'Available', cleaningAssignedTo: undefined, lastCleaned: new Date().toISOString() } : b
      ),
    }))
    void (async () => {
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      const updatedBed = get().beds.find(b => b.id === bedId)
      if (!updatedBed) return
      try {
        const { Beds } = await import('@/lib/api')
        await Beds.upsert(updatedBed)
      } catch (err) {
        console.error('[useAdmissionStore] real backend confirmBedReady failed (local state still updated):', err)
      }
    })()
  },

  cancelRequest: (requestId) => {
    let snap: AdmissionRequest | undefined
    set((s) => {
      snap = s.admissionRequests.find(r => r.id === requestId)
      return {
        admissionRequests: s.admissionRequests.map(r =>
          r.id === requestId ? { ...r, status: 'Cancelled' } : r
        ),
      }
    })
    void (async () => {
      if (!snap?.realId) return
      const { data: { session } } = await getSupabaseClient().auth.getSession()
      if (!session) return
      try {
        const { AdmissionRequests } = await import('@/lib/api')
        await AdmissionRequests.cancel(snap.realId)
      } catch (err) {
        console.error('[useAdmissionStore] real backend cancelRequest failed (local state still updated):', err)
      }
    })()
  },

  setRealId: (id, realId) => set(s => ({
    admissionRequests: s.admissionRequests.map(r => r.id === id ? { ...r, realId } : r),
  })),

  // Phase 7 Task 3 — pulls in every real admission_requests row not already
  // represented locally (the doctor dashboard's existing Phase 3 bridge
  // writes directly to the real table and never touches this local queue).
  // The real row's id is used as BOTH the local id and realId — no fuzzy
  // matching needed, since a freshly-hydrated entry has no other local
  // representation to reconcile against.
  hydrateReal: async () => {
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    if (!session) return
    const { AdmissionRequests, Patients } = await import('@/lib/api')
    const supabase = getSupabaseClient()
    const rows = await AdmissionRequests.list()
    const statusMap: Record<string, AdmissionRequest['status']> = {
      requested: 'Pending', bed_assigned: 'Assigned', admitted: 'Admitted', cancelled: 'Cancelled',
    }
    const existingRealIds = new Set(get().admissionRequests.map(r => r.realId).filter(Boolean))
    const toHydrate = rows.filter(r => !existingRealIds.has(r.id))
    const fresh: AdmissionRequest[] = []
    for (const r of toHydrate) {
      const patient = await Patients.get(r.patientId)
      const { data: doctorProfile } = await supabase.from('profiles').select('full_name').eq('id', r.doctorId).maybeSingle()
      fresh.push({
        id: r.id, realId: r.id,
        patientId: r.patientId,
        patientName: patient?.fullName ?? r.patientId,
        patientAge: patient?.age ?? 0,
        patientGender: patient?.sex ?? '',
        diagnosis: r.diagnosis ?? '',
        admissionType: r.admissionType,
        bedTypePreference: r.bedTypePreference ?? r.admissionType,
        reason: r.reason ?? '',
        requestedBy: doctorProfile?.full_name ?? 'Doctor',
        department: r.department ?? '',
        triageLevel: r.triageLevel,
        payerType: r.payerType ?? '',
        requestedAt: r.requestedAt,
        status: statusMap[r.status] ?? 'Pending',
      })
    }
    // Re-check against the CURRENT state at commit time, not the stale
    // `existingRealIds` snapshot taken before the awaits above — otherwise
    // two overlapping hydrateReal() calls (e.g. React Strict Mode's
    // double-invoked mount effect, or two consumer pages mounting at once)
    // each compute the same `fresh` list before either commits, and both
    // append it, duplicating the same real row locally.
    if (fresh.length) set(s => {
      const already = new Set(s.admissionRequests.map(r => r.realId).filter(Boolean))
      const toAdd = fresh.filter(f => !already.has(f.realId))
      return toAdd.length ? { admissionRequests: [...s.admissionRequests, ...toAdd] } : s
    })
  },
}),
  {
    name: 'agentix-admissionstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
