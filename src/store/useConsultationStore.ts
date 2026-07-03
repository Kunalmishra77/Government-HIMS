import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Patient } from './usePatientStore'
import type { NoteContext, NoteType } from '@/ai-services/documentation-engine'

export type Prescription = {
  id: string
  medicine: string
  dosage: string
  duration: string
  instructions?: string
}

export type LabOrder = {
  id: string
  testName: string
  priority: 'Routine' | 'Urgent'
  orderedAt: string
  sentToLab: boolean
}

export type RadiologyOrder = {
  id: string
  scanType: 'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound'
  bodyPart: string
  priority: 'Routine' | 'Urgent'
  orderedAt: string
  sentToRadiology: boolean
}

export type Referral = {
  id: string
  specialty: string
  notes: string
  urgent: boolean
  orderedAt: string
  // Patient linkage + inbox lifecycle (optional: legacy referral records omit these).
  patientId?: string
  patientName?: string
  fromDepartment?: string
  status?: 'pending' | 'accepted'
  acceptedAt?: string
}

export type AdmissionOrder = {
  id: string
  admissionType: 'General Ward' | 'ICU' | 'Private Room' | 'Semi-Private' | 'Day Care'
  reason: string
  bedTypePreference: string
  orderedAt: string
  sent: boolean
}

interface ConsultationState {
  currentPatient: Patient | null
  isOnlineConsult: boolean
  notes: string
  diagnosis: string
  aiSuggestions: string[]
  prescriptions: Prescription[]
  labOrders: LabOrder[]
  radiologyOrders: RadiologyOrder[]
  referrals: Referral[]
  admissionOrder: AdmissionOrder | null
  isDictating: boolean
  isPharmacySent: boolean
  aiSummaryVisible: boolean
  isGeneratingSummary: boolean
  noteType: NoteType
  noteContext: NoteContext
  isScribeMode: boolean

  setCurrentPatient: (patient: Patient | null) => void
  startOnlineConsult: (patient: Patient) => void
  endOnlineCall: () => void
  setNotes: (notes: string) => void
  setDiagnosis: (diagnosis: string) => void
  setNoteMetadata: (noteType: NoteType, noteContext: NoteContext) => void
  setScribeMode: (active: boolean) => void
  addPrescription: (prescription: Prescription) => void
  removePrescription: (id: string) => void
  addLabOrder: (order: Omit<LabOrder, 'id' | 'orderedAt' | 'sentToLab'>) => void
  removeLabOrder: (id: string) => void
  markLabOrderSent: (id: string) => void
  addRadiologyOrder: (order: Omit<RadiologyOrder, 'id' | 'orderedAt' | 'sentToRadiology'>) => void
  removeRadiologyOrder: (id: string) => void
  markRadiologyOrderSent: (id: string) => void
  addReferral: (referral: Omit<Referral, 'id' | 'orderedAt'>) => void
  acceptReferral: (id: string) => void
  removeReferral: (id: string) => void
  setAdmissionOrder: (order: Omit<AdmissionOrder, 'id' | 'orderedAt' | 'sent'> | null) => void
  markAdmissionSent: () => void
  toggleDictation: () => void
  sendToPharmacy: () => void
  acceptAISuggestion: (suggestion: string) => void
  resetConsultation: () => void
}

const DEFAULT_AI_SUGGESTIONS = ['Consider CBC + CRP blood test', 'Rule out bacterial infection', 'Check oxygen saturation trend', 'Evaluate for URTI / Bronchitis']

// Patient-aware clinical suggestions derived from the selected patient's
// symptoms & history — powers the in-consultation AI assistant panel.
function suggestionsFor(patient: Patient | null): string[] {
  if (!patient) return [...DEFAULT_AI_SUGGESTIONS]
  const t = [...patient.symptoms, ...patient.history].join(' ').toLowerCase()
  const out: string[] = []
  if (/chest|breath|palpitation/.test(t)) out.push('Order ECG + Troponin I', 'Examine chest — rule out ACS', 'Check BP in both arms')
  if (/fever|cough|cold|throat|flu/.test(t)) out.push('Order CBC + CRP', 'Chest X-ray if SpO₂ low', 'Advise hydration & antipyretics')
  if (/stomach|abdom|loose|vomit|nausea|diarr/.test(t)) out.push('Assess hydration; serum electrolytes', 'Stool routine if diarrhoea', 'Advise ORS')
  if (/diabet|sugar/.test(t)) out.push('Check HbA1c & fasting glucose', 'Review anti-diabetic adherence')
  if (/hypertens|\bbp\b|pressure/.test(t)) out.push('Recheck BP; review anti-hypertensives')
  if (/joint|swelling|arthrit/.test(t)) out.push('CRP/ESR; X-ray affected joint')
  if (/headache|migrain/.test(t)) out.push('Assess red-flag headache features', 'Advise analgesia & hydration')
  if (out.length === 0) out.push(...DEFAULT_AI_SUGGESTIONS)
  return out.slice(0, 5)
}

const RESET_BLOCK = {
  isPharmacySent: false, prescriptions: [] as Prescription[], notes: '', diagnosis: '',
  labOrders: [] as LabOrder[], radiologyOrders: [] as RadiologyOrder[], referrals: [] as Referral[], admissionOrder: null,
}

export const useConsultationStore = create<ConsultationState>()(persist((set) => ({
  currentPatient: null,
  isOnlineConsult: false,
  notes: '',
  diagnosis: '',
  aiSuggestions: [...DEFAULT_AI_SUGGESTIONS],
  prescriptions: [],
  labOrders: [],
  radiologyOrders: [],
  referrals: [],
  admissionOrder: null,
  isDictating: false,
  isPharmacySent: false,
  aiSummaryVisible: true,
  isGeneratingSummary: false,
  noteType: 'SOAP',
  noteContext: 'OPD',
  isScribeMode: false,

  setCurrentPatient: (patient) => set({
    currentPatient: patient,
    isOnlineConsult: false,
    ...RESET_BLOCK,
    aiSuggestions: suggestionsFor(patient),   // patient-aware suggestions
  }),

  // Launch an online (video) consultation — loads the patient into the same
  // workspace as OPD so the doctor has every tool, with the call running.
  startOnlineConsult: (patient) => set({
    currentPatient: patient,
    isOnlineConsult: true,
    ...RESET_BLOCK,
    aiSuggestions: suggestionsFor(patient),
  }),

  endOnlineCall: () => set({ isOnlineConsult: false }),

  setNotes: (notes) => set({ notes }),
  setDiagnosis: (diagnosis) => set({ diagnosis }),
  setNoteMetadata: (noteType, noteContext) => set({ noteType, noteContext }),
  setScribeMode: (active) => set({ isScribeMode: active }),

  addPrescription: (p) => set((s) => ({ prescriptions: [...s.prescriptions, p] })),
  removePrescription: (id) => set((s) => ({ prescriptions: s.prescriptions.filter(p => p.id !== id) })),

  addLabOrder: (order) =>
    set((s) => ({
      labOrders: [
        ...s.labOrders,
        { ...order, id: `LO-${Date.now()}`, orderedAt: new Date().toISOString(), sentToLab: false },
      ],
    })),
  removeLabOrder: (id) => set((s) => ({ labOrders: s.labOrders.filter(o => o.id !== id) })),
  markLabOrderSent: (id) =>
    set((s) => ({ labOrders: s.labOrders.map(o => o.id === id ? { ...o, sentToLab: true } : o) })),

  addRadiologyOrder: (order) =>
    set((s) => ({
      radiologyOrders: [
        ...s.radiologyOrders,
        { ...order, id: `RO-${Date.now()}`, orderedAt: new Date().toISOString(), sentToRadiology: false },
      ],
    })),
  removeRadiologyOrder: (id) => set((s) => ({ radiologyOrders: s.radiologyOrders.filter(o => o.id !== id) })),
  markRadiologyOrderSent: (id) =>
    set((s) => ({ radiologyOrders: s.radiologyOrders.map(o => o.id === id ? { ...o, sentToRadiology: true } : o) })),

  addReferral: (referral) =>
    set((s) => ({
      referrals: [...s.referrals, { status: 'pending' as const, ...referral, id: `REF-${Date.now()}`, orderedAt: new Date().toISOString() }],
    })),
  acceptReferral: (id) =>
    set((s) => ({
      referrals: s.referrals.map(r => r.id === id ? { ...r, status: 'accepted' as const, acceptedAt: new Date().toISOString() } : r),
    })),
  removeReferral: (id) => set((s) => ({ referrals: s.referrals.filter(r => r.id !== id) })),

  setAdmissionOrder: (order) =>
    set({
      admissionOrder: order
        ? { ...order, id: `ADM-${Date.now()}`, orderedAt: new Date().toISOString(), sent: false }
        : null,
    }),
  markAdmissionSent: () =>
    set((s) => ({ admissionOrder: s.admissionOrder ? { ...s.admissionOrder, sent: true } : null })),

  toggleDictation: () => set((s) => ({ isDictating: !s.isDictating })),
  sendToPharmacy: () => set({ isPharmacySent: true }),

  acceptAISuggestion: (suggestion) =>
    set((s) => ({
      notes: s.notes ? `${s.notes}\n• ${suggestion}` : `• ${suggestion}`,
      aiSuggestions: s.aiSuggestions.filter(sg => sg !== suggestion),
    })),

  resetConsultation: () =>
    set({
      currentPatient: null,
      isOnlineConsult: false,
      ...RESET_BLOCK,
      isDictating: false,
      aiSuggestions: [...DEFAULT_AI_SUGGESTIONS],
    }),
}),
  {
    name: 'agentix-consultationstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
