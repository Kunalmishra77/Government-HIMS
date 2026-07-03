import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// One comprehensive clinical profile per patient, keyed by patientId — shared by
// the OPD queue, the ward, the doctor's consult, and the patient portal. The nurse
// completes it at the first vitals encounter; `completedAt` marks it done, which is
// how the UI decides "first encounter" (show the wizard) vs "return" (quick form).

export type SmokingStatus = 'Never' | 'Former' | 'Current'
export type AlcoholStatus = 'Never' | 'Occasional' | 'Regular'
export type PregnancyStatus = 'N/A' | 'Not pregnant' | 'Pregnant' | 'Unsure'
export type PayerType = 'Self-pay' | 'Insurance' | 'Govt scheme' | 'Corporate'
export type AyushmanStatus = 'Active' | 'Pending' | 'Not enrolled'

export type PatientProfile = {
  // identity & contact
  uhid?: string
  abhaId?: string
  address?: string
  city?: string
  pincode?: string
  preferredLanguage?: string
  maritalStatus?: string
  occupation?: string
  // emergency contact / next of kin
  emergencyName?: string
  emergencyRelation?: string
  emergencyPhone?: string
  // clinical
  bloodGroup?: string
  noKnownAllergies?: boolean
  allergies: string[]
  chronicConditions: string[]
  currentMedications: string[]
  pastSurgeries: string[]
  familyHistory: string[]
  // lifestyle & measurements
  smoking?: SmokingStatus
  alcohol?: AlcoholStatus
  pregnancy?: PregnancyStatus
  heightCm?: number
  weightKg?: number
  // insurance
  payerType?: PayerType
  insurer?: string
  policyNo?: string
  ayushmanCardStatus?: AyushmanStatus
  ayushmanLinked?: boolean
  // care setting — the patient's home facility for this record
  primaryHospital?: string
  // consents
  consentRecords?: boolean
  consentFamily?: boolean
  consentResearch?: boolean
  // meta
  completedAt?: string
  completedBy?: string
}

export const emptyProfile = (): PatientProfile => ({
  allergies: [], chronicConditions: [], currentMedications: [], pastSurgeries: [], familyHistory: [],
})

// Kiran Patil (PT-20394) is the demo patient whose portal profile is shown; seed
// his as already complete so the patient portal renders real data.
const SEED: Record<string, PatientProfile> = {
  'PT-20394': {
    abhaId: '14-2841-7762-9012', address: '12, Shanti Nagar, Sector 4', city: 'Pune', pincode: '411014',
    preferredLanguage: 'Marathi', maritalStatus: 'Married', occupation: 'Schoolteacher',
    emergencyName: 'Sunita Patil', emergencyRelation: 'Spouse', emergencyPhone: '+91 98765 43211',
    bloodGroup: 'AB+', noKnownAllergies: false, allergies: ['Penicillin', 'Sulfa'],
    chronicConditions: ['Type 2 Diabetes', 'Hypertension'], currentMedications: ['Metformin 500mg', 'Amlodipine 5mg'],
    pastSurgeries: ['Appendectomy (2009)'], familyHistory: ['Father — ischaemic heart disease'],
    smoking: 'Former', alcohol: 'Occasional', pregnancy: 'N/A', heightCm: 172, weightKg: 78,
    payerType: 'Insurance', insurer: 'Star Health Insurance', policyNo: 'STAR-99x',
    ayushmanCardStatus: 'Active', ayushmanLinked: true, primaryHospital: 'Kamla Nehru Memorial Hospital',
    consentRecords: true, consentFamily: true, consentResearch: false,
    completedAt: new Date(Date.now() - 9 * 3600000).toISOString(), completedBy: 'N. Anjali Desai',
  },
}

interface ProfileState {
  profiles: Record<string, PatientProfile>
  getProfile: (id: string) => PatientProfile | undefined
  saveProfile: (id: string, p: PatientProfile, by: string) => void
  isComplete: (id: string) => boolean
}

export const usePatientProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: SEED,
      getProfile: (id) => get().profiles[id],
      saveProfile: (id, p, by) => set(s => ({
        profiles: { ...s.profiles, [id]: { ...p, completedAt: new Date().toISOString(), completedBy: by } },
      })),
      isComplete: (id) => !!get().profiles[id]?.completedAt,
    }),
    {
      name: 'agentix-patient-profiles', version: 2, storage: createJSONStorage(() => localStorage), skipHydration: true,
      // v2 added Ayushman + primary-hospital fields. Merge the fresh seed under any
      // persisted edits so the demo profile gains the new fields without losing
      // values the patient may have changed.
      migrate: (persisted, version) => {
        const state = persisted as ProfileState
        if (version < 2) {
          const prior = state.profiles?.['PT-20394']
          return { ...state, profiles: { ...state.profiles, 'PT-20394': { ...SEED['PT-20394'], ...prior } } }
        }
        return state
      },
    },
  ),
)
