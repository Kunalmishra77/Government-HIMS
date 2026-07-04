import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { news2FromRecord, type Band } from '@/lib/vitals'
import { useNotificationStore } from '@/store/useNotificationStore'
import { useEmergencyStore } from '@/store/useEmergencyStore'
import { useAuditStore } from '@/store/useAuditStore'
import { usePatientProfileStore, emptyProfile } from '@/store/usePatientProfileStore'
import { useJourneyStore, type JourneyState } from '@/store/useJourneyStore'
import type { VitalsRecord } from '@/store/useInpatientStore'

export type QueueStatus = 'waiting' | 'vitals' | 'consulting' | 'pharmacy' | 'billing' | 'done'
export type TriageLevel = 'Low' | 'Medium' | 'High' | 'Critical'

// Mirror the OPD queue position into the monitoring/SLA journey store so the admin
// cockpit tracks every patient regardless of how they registered. transition() is a
// no-op for patients without a journey entry, so this is always safe to call.
const JOURNEY_FOR_QUEUE: Partial<Record<QueueStatus, JourneyState>> = {
  vitals: 'VITALS_IN_PROGRESS',
  consulting: 'IN_CONSULT',
  pharmacy: 'PHARMACY_QUEUED',
  billing: 'BILLING_PENDING',
  done: 'COMPLETED',
}
function syncJourneyStage(id: string, status: QueueStatus) {
  const next = JOURNEY_FOR_QUEUE[status]
  if (next) useJourneyStore.getState().transition(id, next)
}

export type FamilyViewableStatus = {
  wardRoom?: string
  journeyStatus?: string
  condition?: 'Stable' | 'Monitoring' | 'Critical' | 'Discharging'
  lastUpdatedAt?: string
  estimatedWaitMinutes?: number
}

export type Patient = {
  id: string
  uhid?: string
  name: string
  age: number
  gender: 'Male' | 'Female' | 'Other'
  phone: string
  bloodGroup: string
  token: number
  queueStatus: QueueStatus
  estimatedWait: number
  doctor: string
  department: string
  vitals?: {
    bp: string
    temp: string
    weight: string
    spo2: string
    pulse: string
  } | null
  symptoms: string[]
  history: string[]
  registeredAt: string
  registeredDate?: string        // ISO date (YYYY-MM-DD) the patient registered
  triageLevel?: TriageLevel
  hasReports?: boolean
  photoUrl?: string              // patient photo captured at registration (data URL)
  phoneVerified?: boolean        // mobile verified via OTP at the desk
  source?: 'walk_in' | 'online' | 'appointment'  // how the patient entered the queue
  aadhaarVerified?: boolean      // Aadhaar OTP verified → hospital identity established
  abhaId?: string                // linked ABHA number (14-XXXX-XXXX-XXXX)
  familyAccessToken?: string
  familyPhones?: string[]
  dishaConsentGiven?: boolean
  familyViewableStatus?: FamilyViewableStatus
  // Captured at intake (multi-select); `department` above stays the primary for downstream pages.
  departments?: string[]
  visitTypes?: string[]
  insurer?: string
  // Latest chronic-disease readings for the registries (trace to real records).
  latestHbA1c?: number
  latestBP?: string
  // Comprehensive OPD vitals recorded by the nurse (M2 form) + AI triage flag.
  opdVitals?: VitalsRecord
  opdVitalsHistory?: VitalsRecord[]
  triageFlag?: { band: Band; label: string }
}

export type Appointment = {
  id: string
  patientId: string
  patientName?: string          // for walk-in / not-yet-registered bookings
  doctorName: string
  specialty: string
  date: string
  time: string
  mode?: 'online' | 'in_person'
  status: 'upcoming' | 'confirmed' | 'cancelled'
}

export type Visit = {
  id: string
  patientId: string
  date: string
  doctor: string
  diagnosis: string
  notes: string
  prescriptions: { medicine: string; dosage: string; duration: string }[]
  fee?: number
  mode?: 'online' | 'in_person'
}

interface PatientState {
  patients: Patient[]
  queue: Patient[]
  visits: Visit[]
  appointments: Appointment[]
  selectedPatient: Patient | null
  setSelectedPatient: (patient: Patient | null) => void
  updateStatus: (id: string, status: QueueStatus) => void
  reassignPatient: (id: string, patch: { department?: string; doctor?: string }) => void
  /** Link a verified hospital identity (UHID/ABHA) onto a queued patient. */
  linkPatientIdentity: (id: string, patch: { uhid?: string; abhaId?: string; aadhaarVerified?: boolean }) => void
  sendToEmergency: (id: string) => void
  recordOpdVitals: (id: string, rec: Omit<VitalsRecord, 'id' | 'at'>) => void
  addPatient: (patient: Partial<Patient> & { name: string; phone: string }) => void
  bookAppointment: (appt: Omit<Appointment, 'id'>) => void
  updateAppointment: (id: string, patch: Partial<Appointment>) => void
  cancelAppointment: (id: string) => void
  addVisit: (visit: Omit<Visit, 'id'>) => void
  generateFamilyToken: (patientId: string, familyPhones: string[], consentGiven: boolean) => string
  updateFamilyViewableStatus: (patientId: string, status: FamilyViewableStatus) => void
  getPatientByFamilyToken: (token: string) => Patient | undefined
  /** Track A dedup — existing records matching a phone (last-10-digit match). */
  findByPhone: (phone: string) => Patient[]
}

const TODAY = new Date().toISOString().slice(0, 10)
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

// Prior-visit OPD vitals so the Vitals Requests screen shows a real history.
let _pastVitSeq = 0
const pastVit = (daysAgo: number, v: Partial<Omit<VitalsRecord, 'id' | 'at' | 'by'>>): VitalsRecord => ({
  id: `ov-${++_pastVitSeq}`,
  at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
  by: 'Anjali Desai',
  ...v,
})

const MOCK_PATIENTS: Patient[] = [
  {
    id: 'PT-20391', name: 'Meera Pillai', age: 34, gender: 'Female', phone: '9876543210', bloodGroup: 'A+', token: 1,
    queueStatus: 'consulting', estimatedWait: 0, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: { bp: '118/76', temp: '98.4°F', weight: '58 kg', spo2: '99%', pulse: '72 bpm' },
    symptoms: ['Headache for 2 days', 'Mild nausea'], history: ['Migraine history'], registeredAt: '09:10 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
    opdVitals: pastVit(0, { hr: 72, systolicBP: 118, diastolicBP: 76, rr: 16, spo2: 99, temp: 98.4, weight: 58, height: 162 }),
    opdVitalsHistory: [
      pastVit(40, { hr: 78, systolicBP: 122, diastolicBP: 80, rr: 17, spo2: 98, temp: 98.6, weight: 58 }),
      pastVit(0, { hr: 72, systolicBP: 118, diastolicBP: 76, rr: 16, spo2: 99, temp: 98.4, weight: 58, height: 162 }),
    ],
    familyAccessToken: 'demo-family-token-meera-001',
    familyPhones: ['9876543211'],
    dishaConsentGiven: true,
    familyViewableStatus: {
      wardRoom: 'OPD Room 3',
      journeyStatus: 'In consultation with Dr. Priya Nair',
      condition: 'Stable',
      lastUpdatedAt: new Date().toISOString(),
      estimatedWaitMinutes: 0,
    },
  },
  {
    id: 'PT-20392', name: 'Aarav Sharma', age: 42, gender: 'Male', phone: '9871234560', bloodGroup: 'O+', token: 2,
    queueStatus: 'waiting', estimatedWait: 8, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: { bp: '120/80', temp: '98.6°F', weight: '75 kg', spo2: '98%', pulse: '80 bpm' },
    symptoms: ['Persistent cough for 3 days', 'Mild fever', 'Fatigue'], history: ['Hypertension (managed)', 'No known drug allergies'], registeredAt: '09:35 AM', registeredDate: TODAY,
    triageLevel: 'Low', latestBP: '146/92',
    source: 'walk_in', uhid: 'PUH-2026-00021', aadhaarVerified: true, abhaId: '14-7731-5520-8841',
  },
  {
    id: 'PT-20393', name: 'Sonal Desai', age: 28, gender: 'Female', phone: '9823456780', bloodGroup: 'B+', token: 3,
    queueStatus: 'waiting', estimatedWait: 20, doctor: 'Dr. Ananya Iyer', department: 'Dermatology',
    vitals: undefined,
    symptoms: ['Skin rash', 'Itching'], history: ['No significant history'], registeredAt: '09:50 AM', registeredDate: TODAY,
    triageLevel: 'Low',
    source: 'online', aadhaarVerified: false,
  },
  {
    id: 'PT-20398', name: 'Anita Rao', age: 49, gender: 'Female', phone: '9844112200', bloodGroup: 'O+', token: 7,
    queueStatus: 'consulting', estimatedWait: 0, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: { bp: '146/92', temp: '98.4°F', weight: '68 kg', spo2: '97%', pulse: '88 bpm' },
    symptoms: ['Palpitations', 'Breathlessness on exertion'], history: ['Hypertension'], registeredAt: '10:10 AM', registeredDate: TODAY,
    triageLevel: 'Medium', latestBP: '146/92',
    opdVitals: pastVit(0, { hr: 88, systolicBP: 146, diastolicBP: 92, rr: 18, spo2: 97, temp: 98.4, weight: 68, height: 158 }),
    opdVitalsHistory: [
      pastVit(30, { hr: 84, systolicBP: 150, diastolicBP: 94, rr: 18, spo2: 97, temp: 98.6, weight: 68 }),
      pastVit(0, { hr: 88, systolicBP: 146, diastolicBP: 92, rr: 18, spo2: 97, temp: 98.4, weight: 68, height: 158 }),
    ],
  },
  {
    id: 'PT-20394', name: 'Kiran Patil', age: 55, gender: 'Male', phone: '9900112233', bloodGroup: 'AB+', token: 4,
    queueStatus: 'waiting', estimatedWait: 35, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: undefined,
    symptoms: ['Chest tightness', 'Shortness of breath'], history: ['Diabetes Type 2', 'Hypertension'], registeredAt: '10:05 AM', registeredDate: TODAY,
    triageLevel: 'High', latestHbA1c: 8.2, latestBP: '138/88',
    source: 'online', uhid: 'PUH-2026-00012', abhaId: '14-2841-7762-9012', aadhaarVerified: true,
  },
  {
    id: 'PT-20395', name: 'Nalini Kumar', age: 19, gender: 'Female', phone: '9712345678', bloodGroup: 'O-', token: 5,
    queueStatus: 'vitals', estimatedWait: 12, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: undefined,
    symptoms: ['Fever', 'Sore throat'], history: ['No known allergies'], registeredAt: '09:55 AM', registeredDate: TODAY,
    triageLevel: 'Low',
    opdVitalsHistory: [
      pastVit(96, { hr: 88, systolicBP: 118, diastolicBP: 74, rr: 16, spo2: 99, temp: 98.6, weight: 52, height: 160 }),
      pastVit(20, { hr: 96, systolicBP: 116, diastolicBP: 72, rr: 18, spo2: 98, temp: 100.2, weight: 52 }),
    ],
  },
  {
    id: 'PT-20396', name: 'Rakesh Verma', age: 61, gender: 'Male', phone: '9988776655', bloodGroup: 'A-', token: 6,
    queueStatus: 'pharmacy', estimatedWait: 0, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: { bp: '140/90', temp: '97.8°F', weight: '82 kg', spo2: '97%', pulse: '78 bpm' },
    symptoms: ['Joint pain', 'Swelling in knee'], history: ['Osteoarthritis', 'CKD stage 3'], registeredAt: '08:45 AM', registeredDate: TODAY,
    triageLevel: 'Low',
    opdVitals: pastVit(0, { hr: 78, systolicBP: 140, diastolicBP: 90, rr: 17, spo2: 97, temp: 97.8, weight: 82, height: 174 }),
    opdVitalsHistory: [
      pastVit(60, { hr: 80, systolicBP: 138, diastolicBP: 88, rr: 16, spo2: 98, temp: 98.2, weight: 82 }),
      pastVit(0, { hr: 78, systolicBP: 140, diastolicBP: 90, rr: 17, spo2: 97, temp: 97.8, weight: 82, height: 174 }),
    ],
  },
  // M13.0 — OPD board expansion. Realistic mix: 22 patients across departments,
  // queue stages (waiting / vitals / consulting / pharmacy / billing / done),
  // acuities, and ages. Sustains a full-day demo without registering anyone.
  {
    id: 'PT-20399', name: 'Vikas Joshi', age: 38, gender: 'Male', phone: '9833445566', bloodGroup: 'A+', token: 8,
    queueStatus: 'consulting', estimatedWait: 0, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: { bp: '132/86', temp: '98.6°F', weight: '78 kg', spo2: '98%', pulse: '82 bpm' },
    symptoms: ['Exertional chest discomfort', 'Family h/o CAD'], history: ['Dyslipidaemia'], registeredAt: '10:20 AM', registeredDate: TODAY,
    triageLevel: 'Medium', latestBP: '132/86',
    opdVitals: pastVit(0, { hr: 82, systolicBP: 132, diastolicBP: 86, rr: 17, spo2: 98, temp: 98.6, weight: 78, height: 176 }),
    opdVitalsHistory: [
      pastVit(50, { hr: 84, systolicBP: 134, diastolicBP: 88, rr: 18, spo2: 98, temp: 98.4, weight: 78 }),
      pastVit(0, { hr: 82, systolicBP: 132, diastolicBP: 86, rr: 17, spo2: 98, temp: 98.6, weight: 78, height: 176 }),
    ],
  },
  {
    id: 'PT-20400', name: 'Priyanka Joshi', age: 26, gender: 'Female', phone: '9844556677', bloodGroup: 'O+', token: 9,
    queueStatus: 'waiting', estimatedWait: 18, doctor: 'Dr. Sunita Rao', department: 'Gynaecology',
    vitals: undefined,
    symptoms: ['Irregular menses · 3 months'], history: ['Nil significant'], registeredAt: '10:25 AM', registeredDate: TODAY,
    triageLevel: 'Low',
    source: 'online', aadhaarVerified: false,
  },
  {
    id: 'PT-20401', name: 'Rajesh Khanna', age: 67, gender: 'Male', phone: '9866778899', bloodGroup: 'B-', token: 10,
    queueStatus: 'vitals', estimatedWait: 8, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: undefined,
    symptoms: ['Breathlessness on exertion', 'Pedal oedema'], history: ['CAD post-PCI 2019', 'CKD III'], registeredAt: '10:30 AM', registeredDate: TODAY,
    triageLevel: 'High', latestBP: '152/96',
    opdVitalsHistory: [
      pastVit(120, { hr: 82, systolicBP: 148, diastolicBP: 90, rr: 18, spo2: 96, temp: 98.4, weight: 74, height: 170 }),
      pastVit(45, { hr: 90, systolicBP: 150, diastolicBP: 94, rr: 20, spo2: 95, temp: 98.6, weight: 75 }),
      pastVit(10, { hr: 98, systolicBP: 152, diastolicBP: 96, rr: 22, spo2: 93, temp: 98.8, weight: 76, o2Delivery: 'Room air' }),
    ],
  },
  {
    id: 'PT-20402', name: 'Ananya Bose', age: 7, gender: 'Female', phone: '9899001122', bloodGroup: 'A+', token: 11,
    queueStatus: 'waiting', estimatedWait: 22, doctor: 'Dr. Manish Gupta', department: 'Paediatrics',
    vitals: undefined,
    symptoms: ['Fever 102°F · 2 days', 'Throat pain'], history: ['Vaccinations up to date'], registeredAt: '10:35 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
  },
  {
    id: 'PT-20403', name: 'Suresh Pillai', age: 58, gender: 'Male', phone: '9890112233', bloodGroup: 'O+', token: 12,
    queueStatus: 'consulting', estimatedWait: 0, doctor: 'Dr. Vikram Rathore', department: 'Orthopaedics',
    vitals: { bp: '128/82', temp: '98.4°F', weight: '74 kg', spo2: '99%', pulse: '74 bpm' },
    symptoms: ['Right knee pain · climbing stairs', 'Morning stiffness'], history: ['Bilateral OA knee'], registeredAt: '10:40 AM', registeredDate: TODAY,
    triageLevel: 'Low',
  },
  {
    id: 'PT-20404', name: 'Latha Subramaniam', age: 52, gender: 'Female', phone: '9811223344', bloodGroup: 'AB+', token: 13,
    queueStatus: 'pharmacy', estimatedWait: 0, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: { bp: '128/80', temp: '98.6°F', weight: '64 kg', spo2: '98%', pulse: '76 bpm' },
    symptoms: ['Fatigue', 'Recent weight gain'], history: ['Hypothyroidism', 'T2DM'], registeredAt: '09:00 AM', registeredDate: TODAY,
    triageLevel: 'Low', latestHbA1c: 7.4,
  },
  {
    id: 'PT-20405', name: 'Tarun Mishra', age: 31, gender: 'Male', phone: '9822334455', bloodGroup: 'O-', token: 14,
    queueStatus: 'billing', estimatedWait: 0, doctor: 'Dr. Ananya Iyer', department: 'Dermatology',
    vitals: { bp: '120/78', temp: '98.4°F', weight: '70 kg', spo2: '99%', pulse: '74 bpm' },
    symptoms: ['Acne flare', 'Scarring'], history: ['No known allergies'], registeredAt: '09:15 AM', registeredDate: TODAY,
    triageLevel: 'Low',
  },
  {
    id: 'PT-20406', name: 'Sneha Kapur', age: 29, gender: 'Female', phone: '9844998877', bloodGroup: 'A-', token: 15,
    queueStatus: 'waiting', estimatedWait: 28, doctor: 'Dr. Ananya Iyer', department: 'Dermatology',
    vitals: undefined,
    symptoms: ['Hair loss', 'Scalp itching'], history: ['Anaemia'], registeredAt: '10:50 AM', registeredDate: TODAY,
    triageLevel: 'Low',
  },
  {
    id: 'PT-20407', name: 'Mohan Iyengar', age: 73, gender: 'Male', phone: '9866554433', bloodGroup: 'B+', token: 16,
    queueStatus: 'vitals', estimatedWait: 5, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: undefined,
    symptoms: ['Generalised weakness', 'Loss of appetite'], history: ['CKD IV', 'HTN'], registeredAt: '10:55 AM', registeredDate: TODAY,
    triageLevel: 'High', latestBP: '156/98',
    opdVitalsHistory: [
      pastVit(60, { hr: 78, systolicBP: 150, diastolicBP: 92, rr: 17, spo2: 97, temp: 98.2, bloodGlucose: 138, weight: 68, height: 168 }),
      pastVit(14, { hr: 84, systolicBP: 156, diastolicBP: 98, rr: 18, spo2: 96, temp: 98.4, bloodGlucose: 162, weight: 67 }),
    ],
  },
  {
    id: 'PT-20408', name: 'Kavita Bansal', age: 36, gender: 'Female', phone: '9876655443', bloodGroup: 'O+', token: 17,
    queueStatus: 'waiting', estimatedWait: 32, doctor: 'Dr. Sunita Rao', department: 'Gynaecology',
    vitals: undefined,
    symptoms: ['Antenatal · 28 weeks', 'Routine review'], history: ['Gravida 2 Para 1'], registeredAt: '11:00 AM', registeredDate: TODAY,
    triageLevel: 'Low',
  },
  {
    id: 'PT-20409', name: 'Devansh Singh', age: 4, gender: 'Male', phone: '9890900011', bloodGroup: 'A+', token: 18,
    queueStatus: 'consulting', estimatedWait: 0, doctor: 'Dr. Manish Gupta', department: 'Paediatrics',
    vitals: { bp: '95/60', temp: '99.4°F', weight: '17 kg', spo2: '98%', pulse: '108 bpm' },
    symptoms: ['Cough · 4 days', 'Rhinorrhoea'], history: ['Bronchial asthma'], registeredAt: '11:05 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
  },
  {
    id: 'PT-20410', name: 'Pradeep Reddy', age: 45, gender: 'Male', phone: '9988123456', bloodGroup: 'O+', token: 19,
    queueStatus: 'waiting', estimatedWait: 38, doctor: 'Dr. Vikram Rathore', department: 'Orthopaedics',
    vitals: undefined,
    symptoms: ['Low back pain · radiating L leg', 'Numbness L foot'], history: ['Nil significant'], registeredAt: '11:10 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
  },
  {
    id: 'PT-20411', name: 'Ishita Malhotra', age: 41, gender: 'Female', phone: '9876549988', bloodGroup: 'B+', token: 20,
    queueStatus: 'waiting', estimatedWait: 42, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: undefined,
    symptoms: ['Palpitations · intermittent', 'Anxiety'], history: ['Mitral valve prolapse'], registeredAt: '11:15 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
    source: 'online', aadhaarVerified: false,
  },
  {
    id: 'PT-20412', name: 'Vishal Mehrotra', age: 50, gender: 'Male', phone: '9844998800', bloodGroup: 'O+', token: 21,
    queueStatus: 'waiting', estimatedWait: 48, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: undefined,
    symptoms: ['Persistent dry cough · 3 weeks'], history: ['Ex-smoker'], registeredAt: '11:20 AM', registeredDate: TODAY,
    triageLevel: 'High',
  },
  {
    id: 'PT-20413', name: 'Geeta Sharma', age: 60, gender: 'Female', phone: '9866443322', bloodGroup: 'A+', token: 22,
    queueStatus: 'waiting', estimatedWait: 55, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: undefined,
    symptoms: ['Routine BP review', 'Mild giddiness'], history: ['HTN', 'T2DM'], registeredAt: '11:25 AM', registeredDate: TODAY,
    triageLevel: 'Low', latestHbA1c: 6.9, latestBP: '142/88',
  },
  // Walk-ins without ABHA / Aadhaar linkage — surface under "Needs Aadhaar".
  {
    id: 'PT-20414', name: 'Ramesh Yadav', age: 44, gender: 'Male', phone: '9835551201', bloodGroup: 'B+', token: 23,
    queueStatus: 'waiting', estimatedWait: 58, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: undefined,
    symptoms: ['Fever · 3 days', 'Body ache'], history: ['No significant history'], registeredAt: '11:30 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
    source: 'walk_in', aadhaarVerified: false,
  },
  {
    id: 'PT-20415', name: 'Sunita Devi', age: 51, gender: 'Female', phone: '9812007745', bloodGroup: 'O+', token: 24,
    queueStatus: 'waiting', estimatedWait: 62, doctor: 'Dr. Ananya Iyer', department: 'Dermatology',
    vitals: undefined,
    symptoms: ['Recurrent skin allergy'], history: ['Nil significant'], registeredAt: '11:35 AM', registeredDate: TODAY,
    triageLevel: 'Low',
    source: 'walk_in', aadhaarVerified: false,
  },
  {
    id: 'PT-20416', name: 'Mohd Aslam', age: 34, gender: 'Male', phone: '9899334417', bloodGroup: 'A+', token: 25,
    queueStatus: 'waiting', estimatedWait: 66, doctor: 'Dr. Vikram Rathore', department: 'Orthopaedics',
    vitals: undefined,
    symptoms: ['Wrist pain after fall', 'Swelling'], history: ['No known allergies'], registeredAt: '11:40 AM', registeredDate: TODAY,
    triageLevel: 'Medium',
    source: 'walk_in', aadhaarVerified: false,
  },
  {
    id: 'PT-20417', name: 'Kamla Prasad', age: 68, gender: 'Female', phone: '9866120099', bloodGroup: 'B-', token: 26,
    queueStatus: 'waiting', estimatedWait: 70, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: undefined,
    symptoms: ['Giddiness', 'Fatigue'], history: ['HTN'], registeredAt: '11:45 AM', registeredDate: TODAY,
    triageLevel: 'High', latestBP: '158/96',
    source: 'walk_in', aadhaarVerified: false,
  },
  // Yesterday (Yesterday tab) — completed visits.
  {
    id: 'PT-20384', name: 'Arjun Reddy', age: 47, gender: 'Male', phone: '9845012345', bloodGroup: 'O+', token: 18,
    queueStatus: 'done', estimatedWait: 0, doctor: 'Dr. Rohan Mehta', department: 'Cardiology',
    vitals: { bp: '134/88', temp: '98.2°F', weight: '79 kg', spo2: '98%', pulse: '76 bpm' },
    symptoms: ['Palpitations'], history: ['Hypertension'], registeredAt: '03:20 PM', registeredDate: YESTERDAY,
    triageLevel: 'Medium', latestBP: '134/86',
  },
  {
    id: 'PT-20385', name: 'Fatima Sheikh', age: 33, gender: 'Female', phone: '9812233445', bloodGroup: 'B+', token: 22,
    queueStatus: 'done', estimatedWait: 0, doctor: 'Dr. Ananya Iyer', department: 'Dermatology',
    vitals: { bp: '116/74', temp: '98.6°F', weight: '61 kg', spo2: '99%', pulse: '70 bpm' },
    symptoms: ['Skin rash', 'Itching'], history: ['No known allergies'], registeredAt: '04:45 PM', registeredDate: YESTERDAY,
    triageLevel: 'Low',
  },
  {
    id: 'PT-20386', name: 'Imran Khan', age: 39, gender: 'Male', phone: '9823456712', bloodGroup: 'O+', token: 25,
    queueStatus: 'done', estimatedWait: 0, doctor: 'Dr. Priya Nair', department: 'General Medicine',
    vitals: { bp: '124/80', temp: '98.4°F', weight: '76 kg', spo2: '98%', pulse: '78 bpm' },
    symptoms: ['Migraine'], history: ['Migraine'], registeredAt: '11:00 AM', registeredDate: YESTERDAY,
    triageLevel: 'Medium',
  },
  {
    id: 'PT-20387', name: 'Rohit Aggarwal', age: 56, gender: 'Male', phone: '9844123455', bloodGroup: 'B+', token: 30,
    queueStatus: 'done', estimatedWait: 0, doctor: 'Dr. Vikram Rathore', department: 'Orthopaedics',
    vitals: { bp: '130/82', temp: '98.5°F', weight: '82 kg', spo2: '99%', pulse: '76 bpm' },
    symptoms: ['Frozen shoulder', 'Pain at night'], history: ['T2DM'], registeredAt: '02:10 PM', registeredDate: YESTERDAY,
    triageLevel: 'Low', latestHbA1c: 7.1,
  },
]

const MOCK_VISITS: Visit[] = [
  {
    id: 'V-001', patientId: 'PT-20392', date: '2026-04-20', doctor: 'Dr. Priya Nair',
    diagnosis: 'Viral Upper Respiratory Tract Infection',
    notes: 'Advised rest and hydration. Follow up in 5 days if not improving.',
    prescriptions: [
      { medicine: 'Paracetamol 500mg', dosage: '1-0-1', duration: '5 days' },
      { medicine: 'Cetirizine 10mg', dosage: '0-0-1', duration: '3 days' },
    ],
  },
  {
    id: 'V-002', patientId: 'PT-20392', date: '2026-03-05', doctor: 'Dr. Priya Nair',
    diagnosis: 'Hypertension Follow-up',
    notes: 'BP controlled. Continue current medication.',
    prescriptions: [
      { medicine: 'Amlodipine 5mg', dosage: '1-0-0', duration: '30 days' },
    ],
  },
]

const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'APT-001', patientId: 'PT-20391', doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
    date: new Date().toISOString().slice(0, 10), time: '10:30 AM', mode: 'in_person', status: 'confirmed',
  },
  {
    id: 'APT-002', patientId: 'PT-20391', doctorName: 'Dr. Rohan Mehta', specialty: 'Cardiology',
    date: new Date(Date.now() + 6 * 24 * 3600000).toISOString().slice(0, 10), time: '11:00 AM', mode: 'online', status: 'upcoming',
  },
]

export const usePatientStore = create<PatientState>()(persist((set, get) => ({
  patients: MOCK_PATIENTS,
  queue: MOCK_PATIENTS.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)),
  visits: MOCK_VISITS,
  appointments: MOCK_APPOINTMENTS,
  selectedPatient: null,

  setSelectedPatient: (patient) => set({ selectedPatient: patient }),

  updateStatus: (id, status) => {
    set((state) => {
      const updated = state.patients.map(p => p.id === id ? { ...p, queueStatus: status } : p)
      return {
        patients: updated,
        queue: updated.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)),
      }
    })
    const p = get().patients.find(x => x.id === id)
    syncJourneyStage(id, status)
    // Reception sending a patient for vitals alerts the nursing station.
    if (status === 'vitals' && p) {
      useNotificationStore.getState().add({
        type: 'vitals_request',
        priority: (p.triageLevel === 'Critical' || p.triageLevel === 'High') ? 'high' : 'medium',
        title: 'Vitals requested',
        body: `${p.name} (Token ${p.token}) sent for vitals — ${p.department}${p.triageLevel ? ` · ${p.triageLevel} acuity` : ''}`,
        targetRole: 'nurse',
        patientName: p.name,
        channels: ['in_app'],
      })
    }
    if (p) {
      useAuditStore.getState().log({
        userId: 'RC-1101', userName: 'Reception',
        action: 'reception_queue_advance',
        resource: 'opd_patient', resourceId: p.id,
        detail: `${p.name} (Token ${p.token}) → ${status}${p.triageLevel ? ` · ${p.triageLevel}` : ''}`,
      })
    }
  },

  // Re-route a patient to a different department/doctor — used when a specialist
  // referral is accepted and the patient is re-queued under the new specialty.
  reassignPatient: (id, patch) => {
    set((state) => {
      const updated = state.patients.map(p => p.id === id ? { ...p, ...patch } : p)
      return {
        patients: updated,
        queue: updated.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)),
      }
    })
  },

  // Aadhaar verification at the desk (or via the queue quick-action) establishes a
  // hospital identity for an online/appointment patient: stamp the UHID + ABHA on the
  // record and persist the UHID↔ABHA link so future visits resolve the same patient.
  linkPatientIdentity: (id, patch) => {
    set((state) => ({
      patients: state.patients.map(p => p.id === id ? { ...p, ...patch } : p),
      queue: state.queue.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
    const p = get().patients.find(x => x.id === id)
    if (p && patch.abhaId && patch.uhid) {
      const store = usePatientProfileStore.getState()
      store.saveProfile(id, { ...(store.getProfile(id) ?? emptyProfile()), uhid: patch.uhid, abhaId: patch.abhaId }, 'Reception')
    }
    if (p) {
      useAuditStore.getState().log({
        userId: 'RC-1101', userName: 'Reception',
        action: 'reception_registered',
        resource: 'patient_identity', resourceId: p.id,
        detail: `${p.name} identity linked · UHID ${patch.uhid ?? '—'}${patch.abhaId ? ` · ABHA ${patch.abhaId}` : ''}`,
      })
    }
  },

  // Reception escalates a patient straight to the ER — pushes them into the
  // emergency triage queue (acuity mapped), notifies the ER, and clears them from
  // the OPD board.
  sendToEmergency: (id) => {
    const p = get().patients.find(x => x.id === id)
    if (!p) return
    const severity: 'Red' | 'Yellow' | 'Green' = p.triageLevel === 'Critical' ? 'Red' : p.triageLevel === 'High' ? 'Yellow' : 'Green'
    useEmergencyStore.getState().addToTriage({ name: p.name, eta: 'Walked over from OPD', severity, chiefComplaint: p.symptoms[0] ?? 'Acute deterioration in OPD' })
    useNotificationStore.getState().add({
      type: 'emergency_transfer', priority: severity === 'Red' ? 'critical' : 'high',
      title: `ER transfer — ${p.name}`,
      body: `${p.name} (Token ${p.token}) sent from reception to Emergency · ${severity} · ${p.symptoms[0] ?? 'acute'}`,
      targetRole: 'emergency', patientName: p.name, channels: ['in_app'],
    })
    set((state) => {
      const updated = state.patients.map(x => x.id === id ? { ...x, queueStatus: 'done' as QueueStatus } : x)
      return { patients: updated, queue: updated.filter(x => ['waiting', 'vitals', 'consulting'].includes(x.queueStatus)) }
    })
  },

  // Nurse records the OPD vitals (comprehensive M2 set) → stores the full record,
  // mirrors the legacy summary, attaches an AI triage flag, and advances the
  // patient into the doctor's queue (consulting).
  recordOpdVitals: (id, rec) => {
    const news = news2FromRecord(rec)
    const full: VitalsRecord = { id: `v-${Date.now()}`, at: new Date().toISOString(), ...rec }
    const legacy = {
      bp: (rec.systolicBP != null && rec.diastolicBP != null) ? `${rec.systolicBP}/${rec.diastolicBP}` : '—',
      temp: rec.temp != null ? `${rec.temp}°F` : '—',
      weight: rec.weight != null ? `${rec.weight} kg` : '—',
      spo2: rec.spo2 != null ? `${rec.spo2}%` : '—',
      pulse: rec.hr != null ? `${rec.hr} bpm` : '—',
    }
    const triageFlag: { band: Band; label: string } = {
      band: news.band,
      label: news.band === 'high' ? `NEWS ${news.score} — fast-track to doctor`
        : news.band === 'medium' ? `NEWS ${news.score} — prioritise review`
          : `NEWS ${news.score} — routine`,
    }
    set((state) => {
      const updated = state.patients.map(p =>
        p.id === id ? { ...p, vitals: legacy, opdVitals: full, opdVitalsHistory: [...(p.opdVitalsHistory ?? []), full], triageFlag, queueStatus: 'consulting' as QueueStatus } : p
      )
      return {
        patients: updated,
        queue: updated.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)),
      }
    })
    syncJourneyStage(id, 'consulting')
  },

  bookAppointment: (appt) => {
    const apptId = `APT-${Date.now()}`
    set((s) => ({ appointments: [...s.appointments, { ...appt, id: apptId }] }))

    // Auto-queue today's in-person appointments so they appear in OPD Waiting Room
    // and reception + nursing are both notified immediately.
    const todayStr = new Date().toISOString().slice(0, 10)
    if (appt.date === todayStr && (appt.mode ?? 'in_person') === 'in_person') {
      const state = get()

      // Resolve existing patient record first (by ID or name) to get full demographics
      const existing = state.patients.find(p =>
        p.id === appt.patientId ||
        (appt.patientName && p.name.toLowerCase() === appt.patientName.toLowerCase())
      )
      const patientName = appt.patientName ?? existing?.name ?? 'Patient'

      // De-dup: skip if already in today's active queue
      const alreadyQueued = state.patients.find(p =>
        p.name.toLowerCase() === patientName.toLowerCase() &&
        p.registeredDate === todayStr &&
        ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)
      )
      if (alreadyQueued) return

      const nextToken = Math.max(...state.patients.map(p => p.token), 0) + 1
      const queuedPatient: Patient = {
        id: existing?.id ?? `PT-APT-${Date.now()}`,
        name: patientName,
        age: existing?.age ?? 30,
        gender: existing?.gender ?? 'Male',
        phone: existing?.phone ?? '',
        bloodGroup: existing?.bloodGroup ?? 'A+',
        token: nextToken,
        queueStatus: 'waiting',
        estimatedWait: nextToken * 4,
        doctor: appt.doctorName,
        department: appt.specialty,
        vitals: null,
        symptoms: existing?.symptoms ?? [],
        history: existing?.history ?? [],
        registeredAt: appt.time,
        registeredDate: todayStr,
        triageLevel: existing?.triageLevel ?? 'Low',
        hasReports: existing?.hasReports ?? false,
        source: 'appointment',
        uhid: existing?.uhid,
        abhaId: existing?.abhaId,
        aadhaarVerified: existing?.aadhaarVerified,
      }

      set((s) => ({
        patients: [queuedPatient, ...s.patients.filter(p => p.id !== queuedPatient.id)],
        queue: [queuedPatient, ...s.queue.filter(p => p.id !== queuedPatient.id)],
      }))

      // Notify reception — new patient in OPD Waiting Room
      useNotificationStore.getState().add({
        type: 'system',
        priority: 'medium',
        title: `Appointment check-in · ${patientName}`,
        body: `${patientName} has a ${appt.time} appointment with ${appt.doctorName} (${appt.specialty}). Token #${nextToken} added to OPD Waiting Room.`,
        targetRole: 'reception',
        patientName,
        channels: ['in_app'],
      })

      // Notify nursing — patient arriving for vitals
      useNotificationStore.getState().add({
        type: 'vitals_request',
        priority: 'medium',
        title: `Incoming for vitals · ${patientName}`,
        body: `${patientName} (Token #${nextToken}, ${appt.time}) is in the OPD Waiting Room — ${appt.specialty} · ${appt.doctorName}. Please prepare for vitals.`,
        targetRole: 'nurse',
        patientName,
        channels: ['in_app'],
      })

      useAuditStore.getState().log({
        userId: 'RC-1101', userName: 'Reception',
        action: 'reception_registered',
        resource: 'opd_patient', resourceId: queuedPatient.id,
        detail: `${patientName} (Token #${nextToken}) auto-queued from ${appt.time} appointment · ${appt.specialty} · ${appt.doctorName}`,
      })
    }
  },

  updateAppointment: (id, patch) => set((s) => ({
    appointments: s.appointments.map(a => a.id === id ? { ...a, ...patch } : a),
  })),

  cancelAppointment: (id) => set((s) => ({
    appointments: s.appointments.map(a => a.id === id ? { ...a, status: 'cancelled' } : a),
  })),

  // Completing a consultation (or discharge) appends a visit — closes the loop so
  // the patient's history actually grows over time.
  addVisit: (visit) => set((s) => ({ visits: [{ ...visit, id: `V-${Date.now()}` }, ...s.visits] })),

  generateFamilyToken: (patientId, familyPhones, consentGiven) => {
    const token = crypto.randomUUID()
    set(state => ({
      patients: state.patients.map(p =>
        p.id === patientId
          ? { ...p, familyAccessToken: token, familyPhones, dishaConsentGiven: consentGiven, familyViewableStatus: { lastUpdatedAt: new Date().toISOString() } }
          : p
      ),
    }))
    return token
  },

  updateFamilyViewableStatus: (patientId, status) =>
    set(state => ({
      patients: state.patients.map(p =>
        p.id === patientId ? { ...p, familyViewableStatus: { ...status, lastUpdatedAt: new Date().toISOString() } } : p
      ),
    })),

  getPatientByFamilyToken: (token) => {
    return get().patients.find(p => p.familyAccessToken === token)
  },

  findByPhone: (phone) => {
    const norm = phone.replace(/\D/g, '').slice(-10)
    if (norm.length < 10) return []
    return get().patients.filter(p => p.phone.replace(/\D/g, '').slice(-10) === norm)
  },

  addPatient: (partial) => {
    let created: Patient | null = null
    set((state) => {
    const nextToken = Math.max(...state.patients.map(p => p.token), 0) + 1
    const patient: Patient = {
      id: partial.id ?? `PT-${Date.now()}`,
      uhid: partial.uhid,
      name: partial.name,
      age: partial.age ?? 30,
      gender: partial.gender ?? 'Male',
      phone: partial.phone,
      bloodGroup: partial.bloodGroup ?? 'A+',
      token: partial.token ?? nextToken,
      queueStatus: 'waiting',
      estimatedWait: partial.estimatedWait ?? nextToken * 4,
      doctor: partial.doctor ?? 'Dr. Priya Nair',
      department: partial.department ?? 'General Medicine',
      vitals: null,
      symptoms: partial.symptoms ?? [],
      history: partial.history ?? [],
      registeredAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      registeredDate: new Date().toISOString().slice(0, 10),
      triageLevel: partial.triageLevel ?? 'Low',
      hasReports: partial.hasReports ?? false,
      photoUrl: partial.photoUrl,
      phoneVerified: partial.phoneVerified,
      source: partial.source ?? 'walk_in',
      aadhaarVerified: partial.aadhaarVerified,
      abhaId: partial.abhaId,
      departments: partial.departments,
      visitTypes: partial.visitTypes,
      insurer: partial.insurer,
    }
    created = patient
    return {
      patients: [patient, ...state.patients],
      queue: [patient, ...state.queue],
    }
    })
    if (created) {
      const p = created as Patient
      useAuditStore.getState().log({
        userId: 'RC-1101', userName: 'Reception',
        action: 'reception_registered',
        resource: 'opd_patient', resourceId: p.id,
        detail: `${p.name} (Token ${p.token}) registered · ${p.department} · ${p.triageLevel ?? 'Low'}`,
      })
    }
  },
}),
  {
    name: 'agentix-patientstore', version: 5,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
    // v3 added identity fields (source / uhid / abhaId) and reseeded the demo board.
    // v4 seeds prior-visit OPD vitals (opdVitalsHistory) so the Vitals Requests
    // screen shows a real history. v5 seeds recorded-today opdVitals so the Vitals
    // Requests "Done" tab is populated. Migrations reset to the fresh seed.
    migrate: (persisted, version) => {
      if (version < 5) {
        return {
          ...(persisted as Record<string, unknown>),
          patients: MOCK_PATIENTS,
          queue: MOCK_PATIENTS.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)),
          visits: MOCK_VISITS,
          appointments: MOCK_APPOINTMENTS,
          selectedPatient: null,
        } as unknown as PatientState
      }
      return persisted as PatientState
    },
  },
))
