// Demo seed — 50 realistic, diverse Indian OPD/IPD patients.
//
// Purpose: the client demo must never look empty. These patients are prepended
// to usePatientStore's MOCK_PATIENTS so Reception, Aadhaar-pending, Vitals,
// Doctor, OPD and the journey boards all show an actively-used hospital.
// Generated deterministically (index-based, no Math.random) so the board is
// stable across reloads. Each record is unique: distinct name, age, gender,
// phone, UHID, ABHA, condition, department, doctor, vitals and history.
import type { Patient } from '@/store/usePatientStore'
import type { VitalsRecord } from '@/store/useInpatientStore'
import type { TriageLevel } from '@/store/usePatientStore'

const TODAY = new Date().toISOString().slice(0, 10)
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString()

type QS = Patient['queueStatus']

// Realistic clinical case templates — condition drives department, doctor,
// symptoms, history, triage and a plausible vitals set + age band + gender bias.
type Case = {
  cond: string
  dept: string
  doctor: string
  symptoms: string[]
  history: string[]
  triage: TriageLevel
  age: [number, number]
  gender?: 'Male' | 'Female'
  v: { sys: number; dia: number; hr: number; spo2: number; temp: number; rr: number; glucose?: number }
}

const CASES: Case[] = [
  { cond: 'Viral fever', dept: 'General Medicine', doctor: 'Dr. Priya Nair', symptoms: ['Fever 3 days', 'Body ache', 'Fatigue'], history: ['No known allergies'], triage: 'Medium', age: [16, 55], v: { sys: 118, dia: 78, hr: 96, spo2: 98, temp: 101.4, rr: 20 } },
  { cond: 'Hypertension follow-up', dept: 'General Medicine', doctor: 'Dr. Priya Nair', symptoms: ['Headache', 'Occasional dizziness'], history: ['Hypertension 5 yrs', 'On Amlodipine'], triage: 'Medium', age: [45, 72], v: { sys: 156, dia: 98, hr: 82, spo2: 98, temp: 98.4, rr: 18 } },
  { cond: 'Type 2 Diabetes review', dept: 'General Medicine', doctor: 'Dr. Priya Nair', symptoms: ['Increased thirst', 'Fatigue'], history: ['T2DM 8 yrs', 'On Metformin'], triage: 'Medium', age: [40, 70], v: { sys: 134, dia: 86, hr: 84, spo2: 97, temp: 98.6, rr: 18, glucose: 214 } },
  { cond: 'Acute gastroenteritis', dept: 'General Medicine', doctor: 'Dr. Arjun Kuldeep', symptoms: ['Loose motions', 'Vomiting', 'Abdominal cramps'], history: ['Ate out yesterday'], triage: 'High', age: [12, 60], v: { sys: 104, dia: 68, hr: 108, spo2: 98, temp: 100.2, rr: 22 } },
  { cond: 'Chest pain — rule out ACS', dept: 'Cardiology', doctor: 'Dr. Rohan Mehta', symptoms: ['Chest tightness', 'Left arm discomfort', 'Sweating'], history: ['Smoker', 'Family h/o CAD'], triage: 'Critical', age: [48, 75], gender: 'Male', v: { sys: 148, dia: 94, hr: 102, spo2: 95, temp: 98.6, rr: 22 } },
  { cond: 'Palpitations', dept: 'Cardiology', doctor: 'Dr. Rohan Mehta', symptoms: ['Racing heartbeat', 'Anxiety'], history: ['Hyperthyroid — on treatment'], triage: 'Medium', age: [25, 55], v: { sys: 126, dia: 80, hr: 118, spo2: 98, temp: 98.4, rr: 20 } },
  { cond: 'Bronchial asthma exacerbation', dept: 'Pulmonology', doctor: 'Dr. Kavya Reddy', symptoms: ['Breathlessness', 'Wheezing', 'Cough'], history: ['Asthma since childhood', 'Uses inhaler'], triage: 'High', age: [8, 50], v: { sys: 122, dia: 78, hr: 104, spo2: 93, temp: 98.8, rr: 26 } },
  { cond: 'Lower respiratory tract infection', dept: 'Pulmonology', doctor: 'Dr. Kavya Reddy', symptoms: ['Productive cough', 'Fever', 'Chest congestion'], history: ['Ex-smoker'], triage: 'Medium', age: [35, 70], v: { sys: 128, dia: 82, hr: 98, spo2: 95, temp: 100.8, rr: 22 } },
  { cond: 'Fracture — right forearm', dept: 'Orthopaedics', doctor: 'Dr. Vikram Rao', symptoms: ['Wrist pain after fall', 'Swelling', 'Deformity'], history: ['Fall from bike'], triage: 'High', age: [10, 45], v: { sys: 126, dia: 80, hr: 96, spo2: 99, temp: 98.4, rr: 18 } },
  { cond: 'Low back pain', dept: 'Orthopaedics', doctor: 'Dr. Vikram Rao', symptoms: ['Chronic lower back pain', 'Radiating to leg'], history: ['Desk job', 'Sciatica'], triage: 'Low', age: [30, 62], v: { sys: 130, dia: 84, hr: 78, spo2: 98, temp: 98.4, rr: 16 } },
  { cond: 'Allergic dermatitis', dept: 'Dermatology', doctor: 'Dr. Ananya Iyer', symptoms: ['Itchy rash', 'Redness on arms'], history: ['Seasonal allergy'], triage: 'Low', age: [14, 55], v: { sys: 120, dia: 78, hr: 76, spo2: 99, temp: 98.2, rr: 16 } },
  { cond: 'Acne vulgaris', dept: 'Dermatology', doctor: 'Dr. Ananya Iyer', symptoms: ['Facial acne', 'Oily skin'], history: ['Adolescent'], triage: 'Low', age: [15, 26], v: { sys: 116, dia: 74, hr: 74, spo2: 99, temp: 98.4, rr: 16 } },
  { cond: 'Antenatal check-up (2nd trimester)', dept: 'Gynaecology', doctor: 'Dr. Sunita Rao', symptoms: ['Routine ANC visit', 'Mild back ache'], history: ['G2P1', '20 weeks'], triage: 'Low', age: [22, 36], gender: 'Female', v: { sys: 118, dia: 76, hr: 88, spo2: 98, temp: 98.6, rr: 18 } },
  { cond: 'Menstrual irregularity', dept: 'Gynaecology', doctor: 'Dr. Sunita Rao', symptoms: ['Irregular periods', 'Fatigue'], history: ['Suspected PCOS'], triage: 'Low', age: [18, 40], gender: 'Female', v: { sys: 118, dia: 76, hr: 80, spo2: 99, temp: 98.4, rr: 16 } },
  { cond: 'Paediatric fever', dept: 'Paediatrics', doctor: 'Dr. Neha Kulkarni', symptoms: ['High fever', 'Reduced feeding', 'Irritable'], history: ['Immunised for age'], triage: 'High', age: [1, 8], v: { sys: 96, dia: 62, hr: 128, spo2: 98, temp: 102.6, rr: 28 } },
  { cond: 'Paediatric URTI', dept: 'Paediatrics', doctor: 'Dr. Neha Kulkarni', symptoms: ['Runny nose', 'Cough', 'Mild fever'], history: ['Attends daycare'], triage: 'Low', age: [2, 10], v: { sys: 98, dia: 64, hr: 110, spo2: 99, temp: 99.8, rr: 24 } },
  { cond: 'Migraine', dept: 'Neurology', doctor: 'Dr. Sameer Joshi', symptoms: ['Throbbing headache', 'Photophobia', 'Nausea'], history: ['Recurrent migraine'], triage: 'Medium', age: [20, 48], v: { sys: 124, dia: 80, hr: 82, spo2: 99, temp: 98.4, rr: 16 } },
  { cond: 'Seizure — follow-up', dept: 'Neurology', doctor: 'Dr. Sameer Joshi', symptoms: ['Follow-up post seizure', 'On medication'], history: ['Epilepsy', 'On Levetiracetam'], triage: 'Medium', age: [16, 55], v: { sys: 122, dia: 78, hr: 78, spo2: 99, temp: 98.4, rr: 16 } },
  { cond: 'Ear infection', dept: 'ENT', doctor: 'Dr. Rahul Menon', symptoms: ['Ear pain', 'Reduced hearing'], history: ['Recurrent otitis'], triage: 'Low', age: [4, 40], v: { sys: 118, dia: 76, hr: 82, spo2: 99, temp: 99.4, rr: 18 } },
  { cond: 'Chronic sinusitis', dept: 'ENT', doctor: 'Dr. Rahul Menon', symptoms: ['Nasal congestion', 'Facial pressure', 'Headache'], history: ['Allergic rhinitis'], triage: 'Low', age: [18, 50], v: { sys: 122, dia: 78, hr: 78, spo2: 99, temp: 98.6, rr: 16 } },
  { cond: 'Cataract evaluation', dept: 'Ophthalmology', doctor: 'Dr. Anjali Bhat', symptoms: ['Blurred vision', 'Glare at night'], history: ['Age-related', 'Diabetic'], triage: 'Low', age: [55, 78], v: { sys: 138, dia: 86, hr: 76, spo2: 98, temp: 98.4, rr: 16 } },
  { cond: 'Conjunctivitis', dept: 'Ophthalmology', doctor: 'Dr. Anjali Bhat', symptoms: ['Red eye', 'Watering', 'Irritation'], history: ['Contact with infected person'], triage: 'Low', age: [10, 45], v: { sys: 118, dia: 76, hr: 74, spo2: 99, temp: 98.6, rr: 16 } },
  { cond: 'Routine health check-up', dept: 'General Medicine', doctor: 'Dr. Priya Nair', symptoms: ['Annual master health check', 'Asymptomatic'], history: ['No complaints'], triage: 'Low', age: [28, 60], v: { sys: 120, dia: 80, hr: 74, spo2: 99, temp: 98.4, rr: 16 } },
  { cond: 'Dengue suspicion', dept: 'General Medicine', doctor: 'Dr. Arjun Kuldeep', symptoms: ['High fever', 'Severe body ache', 'Retro-orbital pain'], history: ['Monsoon season', 'Mosquito exposure'], triage: 'High', age: [14, 55], v: { sys: 108, dia: 70, hr: 104, spo2: 97, temp: 103.2, rr: 22 } },
  { cond: 'UTI', dept: 'General Medicine', doctor: 'Dr. Arjun Kuldeep', symptoms: ['Burning micturition', 'Frequency', 'Low fever'], history: ['Recurrent UTI'], triage: 'Medium', age: [20, 60], gender: 'Female', v: { sys: 120, dia: 78, hr: 88, spo2: 99, temp: 99.6, rr: 18 } },
]

// Distinct Indian name pools (paired by gender to keep records realistic).
const MALE = ['Rajesh Kumar', 'Amit Sharma', 'Suresh Patel', 'Vijay Singh', 'Anil Verma', 'Ravi Reddy', 'Manoj Gupta', 'Deepak Nair', 'Sanjay Rao', 'Arun Menon', 'Karthik Iyer', 'Rohan Das', 'Naveen Pillai', 'Prakash Joshi', 'Gopal Krishnan', 'Imran Sheikh', 'Farhan Ali', 'Harpreet Singh', 'Vikas Yadav', 'Mahesh Bhat', 'Ganesh Naik', 'Rahul Kapoor', 'Sandeep Chauhan', 'Ajay Mishra', 'Nitin Agarwal']
const FEMALE = ['Priya Sharma', 'Anjali Verma', 'Sunita Devi', 'Kavita Nair', 'Meena Reddy', 'Pooja Gupta', 'Lakshmi Iyer', 'Deepa Menon', 'Sneha Rao', 'Divya Pillai', 'Rekha Joshi', 'Fatima Khan', 'Aisha Begum', 'Simran Kaur', 'Neha Yadav', 'Shruti Bhat', 'Ananya Das', 'Radha Krishnan', 'Manisha Naik', 'Geeta Kapoor', 'Nisha Chauhan', 'Sarita Mishra', 'Vandana Agarwal', 'Jyoti Sharma', 'Komal Singh']
const BLOOD = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B+', 'O+']

// Queue-status distribution so EVERY board has patients (sums to 50).
const STATUS_PLAN: { status: QS; count: number }[] = [
  { status: 'waiting', count: 11 },
  { status: 'vitals', count: 8 },
  { status: 'consulting', count: 9 },
  { status: 'pharmacy', count: 6 },
  { status: 'billing', count: 5 },
  { status: 'done', count: 11 },
]

const statusSequence: QS[] = STATUS_PLAN.flatMap((s) => Array<QS>(s.count).fill(s.status))

function abhaFor(i: number): string {
  const n = (1000000000000 + i * 813579).toString().slice(0, 14).padEnd(14, '0')
  return `14-${n.slice(2, 6)}-${n.slice(6, 10)}-${n.slice(10, 14)}`
}

function buildDemoPatients(): Patient[] {
  const out: Patient[] = []
  let male = 0
  let female = 0
  for (let i = 0; i < 50; i++) {
    const c = CASES[i % CASES.length]
    const gender: 'Male' | 'Female' = c.gender ?? (i % 2 === 0 ? 'Male' : 'Female')
    const name = gender === 'Male' ? MALE[male++ % MALE.length] : FEMALE[female++ % FEMALE.length]
    const age = c.age[0] + ((i * 7) % Math.max(1, c.age[1] - c.age[0]))
    const status = statusSequence[i] ?? 'waiting'
    const pastVitals = status !== 'waiting' && status !== 'vitals'
    const uhid = `PUH-2026-${String(1400 + i).padStart(6, '0')}`
    const phone = `9${String(800000000 + i * 137923).slice(0, 9)}`
    const v = c.v
    const opd: VitalsRecord | undefined = pastVitals
      ? {
          id: `dov-${i}`, at: iso(0), by: 'Anjali Desai',
          hr: v.hr, systolicBP: v.sys, diastolicBP: v.dia, rr: v.rr, spo2: v.spo2, temp: v.temp,
          weight: 55 + ((i * 3) % 35), height: 150 + ((i * 5) % 35),
          bloodGlucose: v.glucose,
        }
      : undefined

    out.push({
      id: `PT-D${String(50001 + i)}`,
      uhid,
      name,
      age,
      gender,
      phone,
      bloodGroup: BLOOD[i % BLOOD.length],
      token: 200 + i,
      queueStatus: status,
      estimatedWait: status === 'waiting' ? 10 + ((i * 4) % 40) : 0,
      doctor: c.doctor,
      department: c.dept,
      vitals: pastVitals
        ? { bp: `${v.sys}/${v.dia}`, temp: `${v.temp}°F`, weight: `${55 + ((i * 3) % 35)} kg`, spo2: `${v.spo2}%`, pulse: `${v.hr} bpm` }
        : null,
      symptoms: c.symptoms,
      history: [...c.history, c.cond],
      registeredAt: `${String(9 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')} AM`,
      registeredDate: TODAY,
      triageLevel: c.triage,
      source: (['walk_in', 'online', 'appointment'] as const)[i % 3],
      aadhaarVerified: true,
      abhaId: abhaFor(i),
      opdVitals: opd,
      opdVitalsHistory: opd ? [opd] : undefined,
    })
  }
  return out
}

export const DEMO_PATIENTS: Patient[] = buildDemoPatients()
