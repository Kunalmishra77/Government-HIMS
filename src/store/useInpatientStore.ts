import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { news2FromRecord, type Consciousness, type O2Delivery } from '@/lib/vitals'
import { useDischargeStore } from './useDischargeStore'
import { usePatientFeedbackStore } from './usePatientFeedbackStore'
import { useNotificationStore } from './useNotificationStore'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { IpdVital } from '@/lib/api/ipd-vitals'
import type { IpdStay } from '@/lib/api/ipd-stays'

// The shared inpatient (IPD) journey — written by the doctor portal, mirrored
// in the patient portal. Every action appends to a single `events` log, which
// is the source of truth for history in both views (doctor sees the clinical
// record; the patient portal renders the curated `patientText`).

export type IpdStage =
  | 'admitted' | 'under_treatment' | 'pre_op' | 'in_surgery' | 'post_op'
  | 'recovering' | 'discharge_initiated' | 'discharged'
export type Condition = 'Critical' | 'Serious' | 'Stable' | 'Improving' | 'Discharge-ready'

export type Vitals = { bp: string; pulse: string; temp: string; spo2: string; rr?: string; avpu?: string }
export type Round = {
  id: string; scheduledAt: string; doctor: string; done: boolean
  doneAt?: string; note?: string; plan?: string; vitals?: Vitals; orders?: string[]
}
export type SurgeryStatus = 'requested' | 'consent_pending' | 'scheduled' | 'in_ot' | 'recovery' | 'done'
export type Surgery = {
  procedure: string; surgeon: string; ot?: string; reason?: string
  scheduledAt?: string; status: SurgeryStatus; consentSigned: boolean; preOpDone: boolean; postOpNote?: string
  consentSignedAt?: string
  consentSignedBy?: string
  consentRequestSentAt?: string
}

// ── Unified history log ───────────────────────────────────────────
export type IpdEventType =
  | 'admission' | 'round' | 'condition_change' | 'note'
  | 'med_start' | 'med_stop' | 'med_change'
  | 'test_order' | 'test_result' | 'diet_change'
  | 'referral' | 'icu_transfer' | 'ot_booking'
  | 'surgery_status' | 'discharge_step' | 'discharged'

export type IpdEvent = {
  id: string
  at: string
  type: IpdEventType
  actor: string
  title: string
  detail?: string
  patientText?: string
  severity?: 'info' | 'success' | 'warning' | 'critical'
  meta?: Record<string, unknown>
}

export type MedOrder = {
  name: string; dose: string; freq: string; route: string
  status: 'active' | 'stopped'
  startedAt: string
  stoppedAt?: string
  stopReason?: string
}
export type TestOrder = {
  id: string
  name: string
  status: 'Ordered' | 'In progress' | 'Ready' | 'Acknowledged'
  priority?: 'Routine' | 'Urgent'
  orderedAt: string
  result?: string
  resultAt?: string
  critical?: boolean
  acknowledgedAt?: string
}
export type ProgressNote = { id: string; at: string; doctor: string; text: string; condition: Condition }
export type DischargePillarKey = 'clinical' | 'nursing' | 'pharmacy' | 'billing' | 'insurance'
export type Discharge = {
  pillars: Record<DischargePillarKey, boolean>
  summary?: string; followUpDate?: string
  meds: { name: string; dose: string; freq: string; duration: string }[]
  redFlags: string[]; initiatedAt?: string; doneAt?: string
}

export type IvLine = { id: string; fluid: string; rate: string; startedAt: string; status: 'Running' | 'Completed' | 'Paused'; volume?: number }
export type WardVitals = { hr: number; bp: string; temp: number; spo2: number; at: string }

// Intake / output entries for the fluid-balance chart.
export type IoKind = 'intake' | 'output'
export type IoEntry = { id: string; at: string; kind: IoKind; type: string; volume: number; by: string }

// Comprehensive bedside vitals — the unified vitals timeline shared between the
// nurse portal (records them) and the doctor chart (reads them). Every field is
// optional so a quick check and a full set both fit the same record.
export type VitalsRecord = {
  id: string
  at: string
  by: string                 // who recorded (nurse / doctor name)
  hr?: number                // heart rate, bpm
  systolicBP?: number        // mmHg
  diastolicBP?: number       // mmHg
  rr?: number                // respiratory rate, /min
  spo2?: number              // %
  o2Delivery?: O2Delivery    // room air vs supplemental
  o2Flow?: number            // L/min, when on supplemental O₂
  temp?: number              // °F
  pain?: number              // 0–10
  bloodGlucose?: number      // mg/dL
  consciousness?: Consciousness  // AVPU
  gcs?: number               // 3–15 (optional, ICU)
  weight?: number            // kg
  height?: number            // cm
  capillaryRefill?: number   // seconds
  urineOutput?: number       // mL/hr
  note?: string
}
export type Referral = { id: string; specialty: string; toDoctor?: string; reason: string; urgent: boolean; at: string; status: 'sent' | 'accepted' }
export type IcuTransfer = { id: string; reason: string; urgency: 'Routine' | 'Urgent' | 'Emergency'; at: string; status: 'requested' | 'bed_assigned' | 'transferred' }
export type OtBooking = { id: string; procedure: string; surgeon: string; ot: string; scheduledAt: string; status: 'requested' | 'confirmed' }

export type Inpatient = {
  patientId: string; name: string; age: number; gender: 'Male' | 'Female' | 'Other'
  bed: string; ward: string; admittingDoctor: string; diagnosis: string
  admittedAt: string; expectedDischarge?: string
  stage: IpdStage; condition: Condition
  rounds: Round[]; meds: MedOrder[]; tests: TestOrder[]; diet?: string
  surgery?: Surgery; progressNotes: ProgressNote[]; discharge?: Discharge
  events: IpdEvent[]
  referrals?: Referral[]; icuTransfer?: IcuTransfer; otBooking?: OtBooking
  codeStatus?: string; allergies?: string[]; comorbidities?: string[]
  latestHbA1c?: number; latestBP?: string
  // Ward/nursing fields (shared with the nurse portal).
  ivLines?: IvLine[]; latestVitals?: WardVitals; dismissedInsight?: boolean
  vitals?: VitalsRecord[]    // comprehensive bedside vitals timeline (newest appended)
  mar?: MarRecord[]          // medication administration records (given/held)
  nurseAck?: string[]        // keys of doctor orders the nurse has actioned
  io?: IoEntry[]             // intake/output entries (fluid balance)
  realId?: string            // the real ipd_stays.id, once materialized (Phase 7 Task 3)
}

// Most-recent comprehensive vitals record (newest by timestamp), if any.
export const latestVitalsRecord = (ip: Inpatient): VitalsRecord | undefined =>
  (ip.vitals ?? []).slice().sort((a, b) => b.at.localeCompare(a.at))[0]

// MAR — a single administration event against a scheduled dose slot (or PRN).
// The MAR view itself is *derived* from the doctor's active `meds`; these records
// only capture what the nurse actually did (given/held), so status is computable.
export type MarAction = 'given' | 'held'
export type MarRecord = { id: string; medName: string; slot: string; action: MarAction; by: string; at: string; note?: string }

export const ROUND_HRS: Record<Condition, number> = { Critical: 4, Serious: 6, Stable: 12, Improving: 12, 'Discharge-ready': 24 }
export const DISCHARGE_PILLARS: { key: DischargePillarKey; label: string }[] = [
  { key: 'clinical', label: 'Clinical sign-off' }, { key: 'nursing', label: 'Nursing handover' },
  { key: 'pharmacy', label: 'Pharmacy / TTO meds' }, { key: 'billing', label: 'Billing cleared' }, { key: 'insurance', label: 'Insurance / TPA' },
]

let _seq = 0
const uid = (p: string) => `${p}-${++_seq}`
const hrsAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

// next due (earliest not-done) round
export const nextRound = (ip: Inpatient): Round | undefined =>
  ip.rounds.filter(r => !r.done).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
export const lastRound = (ip: Inpatient): Round | undefined =>
  ip.rounds.filter(r => r.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))[0]
export const isRoundDue = (ip: Inpatient): boolean => {
  const n = nextRound(ip); return !!n && new Date(n.scheduledAt).getTime() <= Date.now()
}

const ev = (type: IpdEventType, at: string, actor: string, title: string, opts: Partial<IpdEvent> = {}): IpdEvent =>
  ({ id: uid('e'), at, type, actor, title, ...opts })

const mkMed = (name: string, dose: string, freq: string, route: string, startedAt: string): MedOrder =>
  ({ name, dose, freq, route, status: 'active', startedAt })
const mkTest = (name: string, status: TestOrder['status'], priority: TestOrder['priority'] = 'Routine'): TestOrder =>
  ({ id: uid('t'), name, status, priority, orderedAt: hrsAgo(8) })

const mkVit = (h: number, by: string, v: Omit<VitalsRecord, 'id' | 'at' | 'by'>): VitalsRecord =>
  ({ id: uid('v'), at: hrsAgo(h), by, ...v })

const todayAt = (hhmm: string) => { const d = new Date(); const [h, m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString() }
const givenRec = (medName: string, slot: string, by = 'N. Anjali'): MarRecord =>
  ({ id: uid('mar'), medName, slot, action: 'given', by, at: todayAt(slot) })

// A short history of completed rounds with vitals trending toward recovery
// (so the NEWS sparkline shows a real trend), plus the next scheduled round.
function seedRounds(doctor: string, cond: Condition, lastDoneHrsAgo: number, note: string): Round[] {
  const iv = ROUND_HRS[cond]
  const trends: Vitals[] = [
    { bp: '138/88', pulse: '104 bpm', temp: '99.8°F', spo2: '95%', rr: '22/min', avpu: 'A' },
    { bp: '130/84', pulse: '92 bpm', temp: '99.1°F', spo2: '96%', rr: '19/min', avpu: 'A' },
    { bp: '124/80', pulse: '78 bpm', temp: '98.6°F', spo2: '98%', rr: '16/min', avpu: 'A' },
  ]
  const out: Round[] = trends.map((v, i) => {
    const doneAt = hrsAgo(lastDoneHrsAgo + (trends.length - 1 - i) * iv)
    return { id: uid('r'), scheduledAt: doneAt, doctor, done: true, doneAt, note: i === trends.length - 1 ? note : 'Reviewed on round; continuing plan.', plan: 'Continue current management.', vitals: v }
  })
  const lastDone = out[out.length - 1].doneAt!
  out.push({ id: uid('r'), scheduledAt: new Date(new Date(lastDone).getTime() + iv * 3600000).toISOString(), doctor, done: false })
  return out
}

function seedEvents(doctor: string, admittedAt: string, diagnosis: string, roundNote: string, roundHrsAgo: number): IpdEvent[] {
  return [
    ev('admission', admittedAt, 'Reception', `Admitted — ${diagnosis}`, { severity: 'info', patientText: 'You were admitted to the ward.' }),
    ev('note', admittedAt, doctor, 'Initial assessment', { detail: `Admitted with ${diagnosis}. Plan: monitor and treat.`, patientText: 'Your doctor completed your initial assessment.' }),
    ev('round', hrsAgo(roundHrsAgo), doctor, 'Doctor round', { detail: roundNote, severity: 'info', patientText: 'Your doctor reviewed you and updated your care plan.' }),
  ]
}

const DOC = 'Dr. Priya Nair'
function seed(): Inpatient[] {
  return [
    {
      // The logged-in demo patient (Kiran Patil) — OPD chest-pain visit led to admission,
      // so his patient-portal IPD view mirrors the doctor's rounds/orders here.
      patientId: 'PT-20394', name: 'Kiran Patil', age: 55, gender: 'Male', bed: 'CCU-04', ward: 'Cardiac Care',
      admittingDoctor: DOC, diagnosis: 'Chest pain — cardiac observation', admittedAt: hrsAgo(10), expectedDischarge: 'In 2–3 days',
      stage: 'under_treatment', condition: 'Serious',
      rounds: seedRounds(DOC, 'Serious', 3, 'Chest pain controlled on medication. Troponin trend awaited; continue monitoring.'),
      meds: [mkMed('Aspirin', '75mg', 'OD', 'Oral', hrsAgo(10)), mkMed('Atorvastatin', '40mg', 'OD (night)', 'Oral', hrsAgo(10)), mkMed('Metformin', '500mg', 'BD', 'Oral', hrsAgo(10))],
      tests: [mkTest('Troponin I', 'In progress', 'Urgent'), { ...mkTest('ECG', 'Ready'), result: 'Normal sinus rhythm; no acute ischaemic changes.', resultAt: hrsAgo(2) }, mkTest('Lipid Profile', 'Ordered')],
      diet: 'Cardiac diet · low salt', progressNotes: [{ id: uid('p'), at: hrsAgo(3), doctor: DOC, text: 'Acute coronary syndrome largely ruled out so far; observing. Diabetic — monitor sugars.', condition: 'Serious' }],
      allergies: ['No known drug allergies'], comorbidities: ['Type 2 Diabetes', 'Hypertension'], codeStatus: 'Full code',
      latestHbA1c: 8.2, latestBP: '138/88',
      vitals: [
        mkVit(8, 'N. Anjali', { hr: 104, systolicBP: 138, diastolicBP: 88, rr: 20, spo2: 96, o2Delivery: 'Room air', temp: 99.1, pain: 4, bloodGlucose: 184, consciousness: 'A', weight: 78, height: 172, capillaryRefill: 2, urineOutput: 55 }),
        mkVit(3, 'N. Anjali', { hr: 88, systolicBP: 130, diastolicBP: 84, rr: 18, spo2: 97, o2Delivery: 'Room air', temp: 98.6, pain: 2, bloodGlucose: 152, consciousness: 'A', urineOutput: 60 }),
      ],
      mar: [givenRec('Aspirin', '08:00')],
      referrals: [{ id: uid('ref'), specialty: 'Cardiology', toDoctor: 'Dr. Rohan Mehta', reason: 'Chest pain — risk stratification', urgent: false, at: hrsAgo(2), status: 'sent' }],
      events: seedEvents(DOC, hrsAgo(10), 'Chest pain — cardiac observation', 'Chest pain controlled on medication. Troponin trend awaited; continue monitoring.', 3),
    },
    {
      patientId: 'IP-3001', name: 'Sunita Devi', age: 64, gender: 'Female', bed: 'ICU-01', ward: 'ICU',
      admittingDoctor: DOC, diagnosis: 'Sepsis — under treatment', admittedAt: hrsAgo(28), expectedDischarge: 'In 4–5 days',
      stage: 'under_treatment', condition: 'Critical',
      rounds: seedRounds(DOC, 'Critical', 4.5, 'Febrile, on IV antibiotics; lactate trending down.'),
      meds: [mkMed('Piperacillin-Tazobactam', '4.5g', 'Q6H', 'IV', hrsAgo(28)), mkMed('Noradrenaline', 'titrated', 'infusion', 'IV', hrsAgo(28))],
      tests: [mkTest('Blood Culture', 'In progress', 'Urgent'), { ...mkTest('Lactate', 'Ready', 'Urgent'), result: 'Lactate 4.2 mmol/L — elevated', critical: true, resultAt: hrsAgo(1) }, mkTest('CBC', 'Ready')],
      diet: 'NPO — IV fluids', progressNotes: [{ id: uid('p'), at: hrsAgo(4.5), doctor: DOC, text: 'Septic but responding to resuscitation. Continue antibiotics, monitor lactate.', condition: 'Critical' }],
      allergies: ['Penicillin (rash)'], comorbidities: ['Type 2 Diabetes', 'CKD stage 3'], codeStatus: 'Full code',
      latestHbA1c: 9.1,
      vitals: [
        mkVit(5, 'N. Anjali', { hr: 122, systolicBP: 92, diastolicBP: 54, rr: 26, spo2: 91, o2Delivery: 'Nasal cannula', o2Flow: 4, temp: 102.4, pain: 5, bloodGlucose: 246, consciousness: 'V', gcs: 13, weight: 60, height: 158, capillaryRefill: 4, urineOutput: 18 }),
        mkVit(1, 'N. Anjali', { hr: 116, systolicBP: 96, diastolicBP: 58, rr: 24, spo2: 93, o2Delivery: 'Nasal cannula', o2Flow: 4, temp: 101.6, pain: 4, bloodGlucose: 212, consciousness: 'A', gcs: 15, capillaryRefill: 3, urineOutput: 22 }),
      ],
      ivLines: [{ id: uid('iv'), fluid: 'Noradrenaline infusion', rate: 'titrated', startedAt: hrsAgo(20), status: 'Running' }, { id: uid('iv'), fluid: 'NS 0.9% 500ml', rate: '80 ml/hr', startedAt: hrsAgo(5.5), status: 'Running', volume: 500 }],
      io: [
        { id: uid('io'), at: hrsAgo(4), kind: 'intake', type: 'IV fluids', volume: 320, by: 'N. Anjali' },
        { id: uid('io'), at: hrsAgo(3), kind: 'intake', type: 'Oral', volume: 60, by: 'N. Anjali' },
        { id: uid('io'), at: hrsAgo(3), kind: 'output', type: 'Urine', volume: 90, by: 'N. Anjali' },
        { id: uid('io'), at: hrsAgo(1), kind: 'output', type: 'Drain', volume: 40, by: 'N. Anjali' },
      ],
      events: seedEvents(DOC, hrsAgo(28), 'Sepsis', 'Febrile, on IV antibiotics; lactate trending down.', 4.5),
    },
    {
      patientId: 'IP-3002', name: 'Raju Singh', age: 52, gender: 'Male', bed: '102', ward: 'General Ward',
      admittingDoctor: DOC, diagnosis: 'Community-acquired pneumonia', admittedAt: hrsAgo(50), expectedDischarge: 'In 1–2 days',
      stage: 'recovering', condition: 'Improving',
      rounds: seedRounds(DOC, 'Improving', 6, 'Afebrile 24h, SpO₂ improved on room air. Step down O₂.'),
      meds: [mkMed('Amoxicillin-Clavulanate', '625mg', 'TDS', 'Oral', hrsAgo(50)), mkMed('Azithromycin', '500mg', 'OD', 'Oral', hrsAgo(50))],
      tests: [mkTest('Chest X-ray (repeat)', 'Ready'), mkTest('CRP', 'Ready')],
      diet: 'Normal diet', progressNotes: [{ id: uid('p'), at: hrsAgo(6), doctor: DOC, text: 'Clinically improving. Likely discharge in 48h if stable.', condition: 'Improving' }],
      allergies: ['No known drug allergies'], comorbidities: ['Ex-smoker'], codeStatus: 'Full code',
      vitals: [
        mkVit(6, 'N. Ravi', { hr: 84, systolicBP: 124, diastolicBP: 78, rr: 18, spo2: 96, o2Delivery: 'Room air', temp: 99.0, pain: 2, consciousness: 'A', weight: 70, height: 170, urineOutput: 50 }),
        mkVit(2, 'N. Ravi', { hr: 78, systolicBP: 122, diastolicBP: 76, rr: 16, spo2: 97, o2Delivery: 'Room air', temp: 98.4, pain: 1, consciousness: 'A', urineOutput: 55 }),
      ],
      mar: [givenRec('Amoxicillin-Clavulanate', '08:00', 'N. Ravi'), givenRec('Azithromycin', '08:00', 'N. Ravi')],
      events: seedEvents(DOC, hrsAgo(50), 'Community-acquired pneumonia', 'Afebrile 24h, SpO₂ improved on room air. Step down O₂.', 6),
    },
    {
      patientId: 'IP-3003', name: 'Vikram Nair', age: 54, gender: 'Male', bed: '—', ward: 'Pre-op',
      admittingDoctor: DOC, diagnosis: 'Acute MI — for angioplasty (PCI)', admittedAt: hrsAgo(6),
      stage: 'pre_op', condition: 'Serious',
      rounds: seedRounds(DOC, 'Serious', 2, 'Chest pain settled on GTN. Optimise for PCI. Consent in progress.'),
      meds: [mkMed('Aspirin', '75mg', 'OD', 'Oral', hrsAgo(6)), mkMed('Clopidogrel', '75mg', 'OD', 'Oral', hrsAgo(6)), mkMed('Atorvastatin', '40mg', 'OD (night)', 'Oral', hrsAgo(6))],
      tests: [mkTest('Troponin I', 'Ready', 'Urgent'), mkTest('ECG', 'Ready', 'Urgent'), mkTest('Echocardiogram', 'Ordered')],
      diet: 'Cardiac diet', progressNotes: [{ id: uid('p'), at: hrsAgo(2), doctor: DOC, text: 'Acute coronary syndrome. Planned for PCI. Awaiting consent + cath lab slot.', condition: 'Serious' }],
      surgery: { procedure: 'Coronary Angioplasty (PCI)', surgeon: 'Dr. Rohan Mehta', reason: 'Acute MI — culprit lesion', status: 'consent_pending', consentSigned: false, preOpDone: false },
      allergies: ['No known drug allergies'], comorbidities: ['Hypertension'], codeStatus: 'Full code',
      vitals: [
        mkVit(4, 'N. Ravi', { hr: 96, systolicBP: 142, diastolicBP: 90, rr: 18, spo2: 97, o2Delivery: 'Room air', temp: 98.8, pain: 3, consciousness: 'A', weight: 82, height: 175, urineOutput: 48 }),
        mkVit(2, 'N. Ravi', { hr: 88, systolicBP: 134, diastolicBP: 86, rr: 17, spo2: 98, o2Delivery: 'Room air', temp: 98.6, pain: 2, consciousness: 'A', urineOutput: 52 }),
      ],
      mar: [givenRec('Aspirin', '08:00', 'N. Ravi'), givenRec('Clopidogrel', '08:00', 'N. Ravi')],
      events: [
        ...seedEvents(DOC, hrsAgo(6), 'Acute MI — for angioplasty (PCI)', 'Chest pain settled on GTN. Optimise for PCI. Consent in progress.', 2),
        ev('surgery_status', hrsAgo(2), DOC, 'Surgery planned — Coronary Angioplasty (PCI)', { detail: 'Awaiting consent', severity: 'warning', patientText: 'A procedure (angioplasty) has been planned. Your consent is needed.' }),
      ],
    },
    {
      patientId: 'IP-3004', name: 'Mohan Lal', age: 58, gender: 'Male', bed: '202', ward: 'Semi-Private',
      admittingDoctor: DOC, diagnosis: 'Type 2 Diabetes — stabilised', admittedAt: hrsAgo(72), expectedDischarge: 'Today',
      stage: 'recovering', condition: 'Discharge-ready',
      rounds: seedRounds(DOC, 'Discharge-ready', 3, 'Glycaemic control achieved. Fit for discharge. Plan TTO + follow-up.'),
      meds: [mkMed('Metformin', '500mg', 'BD', 'Oral', hrsAgo(72)), mkMed('Glimepiride', '2mg', 'OD', 'Oral', hrsAgo(72))],
      tests: [mkTest('HbA1c', 'Ready'), mkTest('Fasting glucose', 'Ready')],
      diet: 'Diabetic diet', progressNotes: [{ id: uid('p'), at: hrsAgo(3), doctor: DOC, text: 'Sugars controlled on oral agents. Discharge today with follow-up in 1 week.', condition: 'Discharge-ready' }],
      allergies: ['No known drug allergies'], comorbidities: ['Type 2 Diabetes', 'Dyslipidaemia'], codeStatus: 'Full code',
      latestHbA1c: 6.8,
      vitals: [
        mkVit(6, 'N. Ravi', { hr: 76, systolicBP: 124, diastolicBP: 80, rr: 16, spo2: 98, o2Delivery: 'Room air', temp: 98.6, pain: 0, bloodGlucose: 112, consciousness: 'A', weight: 74, height: 168, urineOutput: 60 }),
        mkVit(3, 'N. Ravi', { hr: 74, systolicBP: 122, diastolicBP: 78, rr: 15, spo2: 99, o2Delivery: 'Room air', temp: 98.4, pain: 0, bloodGlucose: 104, consciousness: 'A', urineOutput: 62 }),
      ],
      mar: [givenRec('Metformin', '08:00', 'N. Ravi'), givenRec('Glimepiride', '08:00', 'N. Ravi')],
      events: seedEvents(DOC, hrsAgo(72), 'Type 2 Diabetes — stabilised', 'Glycaemic control achieved. Fit for discharge. Plan TTO + follow-up.', 3),
    },
    {
      // Bed 105 occupant — post-op appendectomy (consistent with her billing: laparoscopic
      // appendectomy + antibiotics). Matched to the bed by name + ward/bed in BedHoverCard.
      patientId: 'IP-3005', name: 'Priya Sharma', age: 34, gender: 'Female', bed: '105', ward: 'General Ward',
      admittingDoctor: DOC, diagnosis: 'Post-op — laparoscopic appendectomy (POD-2)', admittedAt: hrsAgo(60), expectedDischarge: 'In 1–2 days',
      stage: 'recovering', condition: 'Improving',
      rounds: seedRounds(DOC, 'Improving', 5, 'POD-2: afebrile, wound clean & dry, tolerating orals. Mobilising well — plan discharge once bowels open.'),
      meds: [mkMed('Cefuroxime', '500mg', 'BD', 'Oral', hrsAgo(36)), mkMed('Paracetamol', '1g', 'QDS PRN', 'Oral', hrsAgo(60)), mkMed('Pantoprazole', '40mg', 'OD', 'Oral', hrsAgo(60))],
      tests: [{ ...mkTest('CBC (post-op)', 'Ready'), result: 'WBC 8.9 ×10⁹/L — normalising', resultAt: hrsAgo(4) }, { ...mkTest('LFT', 'Ready'), result: 'Within normal limits', resultAt: hrsAgo(4) }, mkTest('Wound swab', 'Ordered')],
      diet: 'Light diet — as tolerated', progressNotes: [
        { id: uid('p'), at: hrsAgo(5), doctor: DOC, text: 'POD-2 review: pain well controlled, wound healthy, no signs of infection. Continue oral antibiotics, encourage mobilisation.', condition: 'Improving' },
        { id: uid('p'), at: hrsAgo(30), doctor: DOC, text: 'POD-1: stable post-op, started on orals, IV antibiotics switched to oral. Pain score 3/10.', condition: 'Stable' },
      ],
      allergies: ['Sulfa drugs (rash)'], comorbidities: ['None significant'], codeStatus: 'Full code',
      vitals: [
        mkVit(6, 'N. Anjali', { hr: 86, systolicBP: 118, diastolicBP: 74, rr: 17, spo2: 98, o2Delivery: 'Room air', temp: 99.2, pain: 3, consciousness: 'A', weight: 58, height: 162, urineOutput: 50 }),
        mkVit(2, 'N. Anjali', { hr: 78, systolicBP: 116, diastolicBP: 72, rr: 16, spo2: 99, o2Delivery: 'Room air', temp: 98.6, pain: 2, consciousness: 'A', urineOutput: 55 }),
      ],
      mar: [givenRec('Cefuroxime', '08:00'), givenRec('Pantoprazole', '08:00')],
      events: [
        ...seedEvents(DOC, hrsAgo(60), 'Acute appendicitis — for laparoscopic appendectomy', 'POD-2: afebrile, wound clean & dry, tolerating orals. Mobilising well.', 5),
        ev('surgery_status', hrsAgo(58), 'Dr. Anita Rao', 'Surgery done — Laparoscopic Appendectomy', { detail: 'Uncomplicated; specimen sent for histopathology.', severity: 'success', patientText: 'Your appendix was removed successfully.' }),
        ev('med_change', hrsAgo(36), DOC, 'IV antibiotics switched to oral', { detail: 'Cefuroxime IV → oral', severity: 'info' }),
      ],
    },
  ]
}

interface InpatientState {
  inpatients: Inpatient[]
  hydrateReal: () => Promise<void>
  admitFromRequest: (stay: {
    id: string; patientId: string; patientName: string; age?: number; gender?: string
    bed: string; ward: string; admittingDoctor: string; diagnosis: string; admittedAt: string
    condition: Condition
  }) => void
  logEvent: (patientId: string, e: Omit<IpdEvent, 'id' | 'at'> & { at?: string }) => void
  recordRound: (patientId: string, data: { note: string; plan?: string; vitals?: Vitals; orders?: string[] }) => void
  addMed: (patientId: string, med: { name: string; dose: string; freq: string; route: string }) => void
  discontinueMed: (patientId: string, medName: string, reason: string) => void
  changeMed: (patientId: string, medName: string, patch: Partial<Pick<MedOrder, 'dose' | 'freq' | 'route'>>) => void
  addProgressNote: (patientId: string, text: string, condition: Condition) => void
  setCondition: (patientId: string, condition: Condition) => void
  // ward/nursing
  recordVitals: (patientId: string, v: Omit<VitalsRecord, 'id' | 'at'>) => void
  addIvLine: (patientId: string, line: Omit<IvLine, 'id'>) => void
  dismissInsight: (patientId: string) => void
  administerMed: (patientId: string, a: { medName: string; slot: string; action: MarAction; note?: string; by?: string }) => void
  acknowledgeOrder: (patientId: string, o: { key: string; label: string }) => void
  addNursingNote: (patientId: string, text: string, by?: string) => void
  applyProfileClinical: (patientId: string, c: { allergies?: string[]; comorbidities?: string[] }) => void
  addIo: (patientId: string, e: { kind: IoKind; type: string; volume: number; by?: string }) => void
  setIvStatus: (patientId: string, ivId: string, status: IvLine['status']) => void
  // investigations
  addTest: (patientId: string, t: { name: string; priority?: 'Routine' | 'Urgent' }) => void
  setTestResult: (patientId: string, testId: string, r: { result: string; critical?: boolean }) => void
  acknowledgeTest: (patientId: string, testId: string) => void
  setDiet: (patientId: string, diet: string) => void
  // routed decisions
  referInpatient: (patientId: string, r: { specialty: string; toDoctor?: string; reason: string; urgent: boolean }) => void
  requestIcuTransfer: (patientId: string, t: { reason: string; urgency: 'Routine' | 'Urgent' | 'Emergency' }) => void
  bookOT: (patientId: string, o: { procedure: string; surgeon: string; ot: string; scheduledAt: string }) => void
  // surgery
  requestSurgery: (patientId: string, s: { procedure: string; surgeon: string; reason?: string }) => void
  signConsent: (patientId: string, meta?: { signedBy?: string; signedAt?: string }) => void
  scheduleSurgery: (patientId: string, d: { ot: string; scheduledAt: string }) => void
  advanceSurgery: (patientId: string) => void
  setPostOpNote: (patientId: string, note: string) => void
  // discharge
  initiateDischarge: (patientId: string) => void
  /** Cancel an in-progress discharge — return the patient to active ward care. */
  revertDischarge: (patientId: string) => void
  clearPillar: (patientId: string, key: DischargePillarKey) => void
  setDischargeSummary: (patientId: string, d: { summary: string; followUpDate: string; meds: Discharge['meds']; redFlags: string[] }) => void
  completeDischarge: (patientId: string) => void
}

const patch = (s: InpatientState, id: string, fn: (ip: Inpatient) => Inpatient) =>
  ({ inpatients: s.inpatients.map(ip => ip.patientId === id ? fn(ip) : ip) })

const append = (ip: Inpatient, e: Omit<IpdEvent, 'id' | 'at'> & { at?: string }): IpdEvent[] =>
  [...ip.events, { id: uid('e'), at: e.at ?? new Date().toISOString(), ...e }]

// Phase 7 Task 4 — resolves the REAL signed-in actor for an action whose
// signature takes an explicit, caller-suppliable "who did this" parameter
// (administerMed's `by`, addNursingNote's `by`, recordVitals'/addIo's `by`),
// from a *live* Supabase session + a `profiles.full_name` lookup — never
// from that caller-supplied string. Mirrors useLabOrdersStore.ts's
// resolveRealActor / useRadiologyStudiesStore.ts's resolveRealRadActor.
// Actions whose actor is an already-fixed record field (ip.admittingDoctor)
// rather than a caller-suppliable parameter do NOT use this — see this
// plan's Global Constraints for the full reasoning. Returns undefined (skip
// the write) if there's no live session or no matching profile row.
async function resolveRealIpdActor(): Promise<{ id: string; name: string } | undefined> {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return undefined
  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', session.user.id).maybeSingle()
  if (!profile) return undefined
  return { id: session.user.id, name: profile.full_name }
}

// Phase 7 Task 9 — discharge's jsonb column is shared with useDischargeStore
// (see this plan's Global Constraints and Task 9's preamble): read-then-merge
// before patching, since the OTHER store may have last written fields this
// store's local `ip.discharge` doesn't know about. Pass `dischargePartial:
// null` to explicitly clear the whole column (revertDischarge).
//
// `pillars` gets its OWN nested merge, on top of the outer shallow merge:
// verification (this task's throwaway script) caught that a plain shallow
// `{...current.discharge, ...dischargePartial}` merge still lets one store
// clobber the other's pillar keys, because BOTH clearPillar (this store) and
// useDischargeStore's setClearance only ever know their OWN local pillars
// snapshot — a caller here must pass `dischargePartial.pillars` as a partial
// object containing ONLY the key(s) it actually changed (never a full
// locally-recomputed 5-key record), and this function merges that partial
// onto the CURRENT real pillars (not the caller's local one) so the other
// store's already-written keys survive untouched.
type SharedDischargePartial =
  Omit<Partial<NonNullable<IpdStay['discharge']>>, 'pillars'> & { pillars?: Partial<NonNullable<IpdStay['discharge']>['pillars']> }

async function patchWithSharedDischarge(
  realId: string,
  dischargePartial: SharedDischargePartial | null,
  rest: Partial<IpdStay> = {},
) {
  const { IpdStays } = await import('@/lib/api')
  if (dischargePartial === null) {
    return IpdStays.patch(realId, { discharge: null as unknown as IpdStay['discharge'], ...rest })
  }
  const current = await IpdStays.get(realId)
  const mergedPillars = dischargePartial.pillars
    ? { ...(current?.discharge?.pillars ?? {}), ...dischargePartial.pillars }
    : undefined
  const merged = {
    ...(current?.discharge ?? {}),
    ...dischargePartial,
    ...(mergedPillars ? { pillars: mergedPillars } : {}),
  } as NonNullable<IpdStay['discharge']>
  return IpdStays.patch(realId, { discharge: merged, ...rest })
}

export const useInpatientStore = create<InpatientState>()(
  persist(
    (set, get) => ({
      inpatients: seed(),

      // Bug C fix — pulls in every real ipd_stays row not already represented
      // locally, mirroring useAdmissionStore.ts's own hydrateReal() exactly:
      // the real row's id is used as `realId` and its `patientId` as the
      // local key (this store's existing identity key everywhere else, e.g.
      // patch()/admitFromRequest above), with no fuzzy matching needed since
      // a freshly-hydrated entry has no other local representation to
      // reconcile against. Without this, a real admitted patient (whose
      // ipd_stays row was created by useAdmissionStore's markAdmitted bridge
      // in a different browser/session/reload) is otherwise only ever
      // visible here if admitFromRequest happened to run in *this* session —
      // i.e. never, for a doctor/nurse opening the ward list fresh.
      hydrateReal: async () => {
        const { data: { session } } = await getSupabaseClient().auth.getSession()
        if (!session) return
        const { IpdStays } = await import('@/lib/api')
        const rows = await IpdStays.list()
        const existingRealIds = new Set(get().inpatients.map(ip => ip.realId).filter(Boolean))
        const toHydrate = rows.filter(r => !existingRealIds.has(r.id))
        if (!toHydrate.length) return
        const fresh: Inpatient[] = toHydrate.map(stay => ({
          patientId: stay.patientId,
          name: stay.patientName,
          age: stay.age ?? 0,
          gender: stay.gender === 'Female' ? 'Female' : stay.gender === 'Other' ? 'Other' : 'Male',
          bed: stay.bed,
          ward: stay.ward,
          admittingDoctor: stay.admittingDoctor,
          diagnosis: stay.diagnosis,
          admittedAt: stay.admittedAt,
          expectedDischarge: stay.expectedDischarge,
          stage: stay.stage,
          condition: stay.condition,
          rounds: stay.rounds,
          meds: stay.meds,
          tests: stay.tests,
          diet: stay.diet,
          surgery: stay.surgery,
          progressNotes: stay.progressNotes,
          discharge: stay.discharge,
          events: stay.events,
          referrals: stay.referrals,
          icuTransfer: stay.icuTransfer,
          otBooking: stay.otBooking,
          codeStatus: stay.codeStatus,
          allergies: stay.allergies,
          comorbidities: stay.comorbidities,
          latestHbA1c: stay.latestHbA1c,
          latestBP: stay.latestBp,
          ivLines: stay.ivLines,
          latestVitals: stay.latestVitals,
          dismissedInsight: stay.dismissedInsight,
          mar: stay.mar,
          nurseAck: stay.nurseAck,
          io: stay.io,
          realId: stay.id,
        }))
        // Re-check against the CURRENT state at commit time (mirrors
        // useAdmissionStore.ts's hydrateReal fix) — closes the same race
        // where two overlapping hydrateReal() calls (React Strict Mode's
        // double-invoked mount effect, or the doctor ward list + doctor
        // chart both mounting at once) would otherwise both add the same
        // real row before either commits.
        set(s => {
          const already = new Set(s.inpatients.map(ip => ip.realId).filter(Boolean))
          const toAdd = fresh.filter(f => !already.has(f.realId))
          return toAdd.length ? { inpatients: [...s.inpatients, ...toAdd] } : s
        })
      },

      // Phase 7 Task 3 — the "order rewire" moment: called from
      // useAdmissionStore.ts's markAdmitted bridge once the real ipd_stays row
      // exists, so the admitted patient immediately shows up in the doctor/nurse
      // IPD chart with realId already stamped — no separate hydrate step needed
      // for this store (contrast with useAdmissionStore's own hydrateReal).
      admitFromRequest: (stay) => set(s => {
        if (s.inpatients.some(ip => ip.patientId === stay.patientId && ip.stage !== 'discharged')) return s
        const ip: Inpatient = {
          patientId: stay.patientId, name: stay.patientName, age: stay.age ?? 0,
          gender: stay.gender === 'Female' ? 'Female' : stay.gender === 'Other' ? 'Other' : 'Male',
          bed: stay.bed, ward: stay.ward, admittingDoctor: stay.admittingDoctor, diagnosis: stay.diagnosis,
          admittedAt: stay.admittedAt, stage: 'admitted', condition: stay.condition,
          rounds: [], meds: [], tests: [], progressNotes: [],
          events: [ev('admission', stay.admittedAt, 'Reception', `Admitted — ${stay.diagnosis}`, {
            severity: 'info', patientText: 'You were admitted to the ward.',
          })],
          realId: stay.id,
        }
        return { inpatients: [...s.inpatients, ip] }
      }),

      logEvent: (id, e) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({ ...ip, events: append(ip, e) }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { events })
          } catch (err) {
            console.error('[useInpatientStore] real backend logEvent failed (local chart still updated):', err)
          }
        })()
      },

      recordRound: (id, data) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const iv = ROUND_HRS[ip.condition]
            const now = new Date().toISOString()
            const pending = ip.rounds.filter(r => !r.done).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
            const completed: Round = pending
              ? { ...pending, done: true, doneAt: now, note: data.note, plan: data.plan, vitals: data.vitals, orders: data.orders }
              : { id: uid('r'), scheduledAt: now, doctor: ip.admittingDoctor, done: true, doneAt: now, note: data.note, plan: data.plan, vitals: data.vitals, orders: data.orders }
            const rounds = ip.rounds.map(r => r.id === completed.id ? completed : r)
            if (!pending) rounds.push(completed)
            rounds.push({ id: uid('r'), scheduledAt: new Date(Date.now() + iv * 3600000).toISOString(), doctor: ip.admittingDoctor, done: false })
            return { ...ip, rounds, events: append(ip, { type: 'round', actor: ip.admittingDoctor, title: 'Doctor round completed', detail: data.note, severity: 'info', patientText: 'Your doctor completed a round — you are being monitored closely.' }) }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { rounds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { rounds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend recordRound failed (local chart still updated):', err)
          }
        })()
      },

      addMed: (id, med) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            meds: [...ip.meds, { ...med, status: 'active', startedAt: new Date().toISOString() }],
            events: append(ip, { type: 'med_start', actor: ip.admittingDoctor, title: `Started ${med.name} ${med.dose}`, detail: `${med.freq} · ${med.route}`, patientText: `A new medicine (${med.name}) was started.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { meds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { meds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addMed failed (local chart still updated):', err)
          }
        })()
      },

      discontinueMed: (id, name, reason) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            meds: ip.meds.map(m => m.name === name && m.status === 'active' ? { ...m, status: 'stopped', stoppedAt: new Date().toISOString(), stopReason: reason } : m),
            events: append(ip, { type: 'med_stop', actor: ip.admittingDoctor, title: `Stopped ${name}`, detail: reason, severity: 'warning', patientText: `A medicine (${name}) was stopped.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { meds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { meds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend discontinueMed failed (local chart still updated):', err)
          }
        })()
      },

      changeMed: (id, name, p) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            meds: ip.meds.map(m => m.name === name && m.status === 'active' ? { ...m, ...p } : m),
            events: append(ip, { type: 'med_change', actor: ip.admittingDoctor, title: `Adjusted ${name}`, detail: Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(', '), patientText: `Your ${name} was adjusted.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { meds, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { meds, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend changeMed failed (local chart still updated):', err)
          }
        })()
      },

      addProgressNote: (id, text, condition) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, condition,
            progressNotes: [{ id: uid('p'), at: new Date().toISOString(), doctor: ip.admittingDoctor, text, condition }, ...ip.progressNotes],
            events: append(ip, { type: 'note', actor: ip.admittingDoctor, title: 'Progress note', detail: text }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { progressNotes, condition: cond, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { progressNotes, condition: cond, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addProgressNote failed (local chart still updated):', err)
          }
        })()
      },

      setCondition: (id, condition) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, condition,
            events: append(ip, { type: 'condition_change', actor: ip.admittingDoctor, title: `Condition set to ${condition}`, severity: condition === 'Critical' ? 'critical' : condition === 'Serious' ? 'warning' : 'info' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { condition: cond, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { condition: cond, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setCondition failed (local chart still updated):', err)
          }
        })()
      },

      recordVitals: (id, v) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        let localRec: VitalsRecord | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const rec: VitalsRecord = { id: uid('v'), at: new Date().toISOString(), ...v }
            localRec = rec
            const news = news2FromRecord(rec)
            const bp = (rec.systolicBP != null && rec.diastolicBP != null) ? `${rec.systolicBP}/${rec.diastolicBP}` : undefined
            const detail = [
              rec.hr != null ? `HR ${rec.hr}` : null,
              bp ? `BP ${bp}` : null,
              rec.rr != null ? `RR ${rec.rr}` : null,
              rec.spo2 != null ? `SpO₂ ${rec.spo2}%${rec.o2Delivery && rec.o2Delivery !== 'Room air' ? ` (${rec.o2Delivery})` : ''}` : null,
              rec.temp != null ? `Temp ${rec.temp}°F` : null,
              rec.pain != null ? `Pain ${rec.pain}/10` : null,
              rec.bloodGlucose != null ? `Glu ${rec.bloodGlucose}` : null,
              rec.consciousness && rec.consciousness !== 'A' ? `AVPU ${rec.consciousness}` : null,
            ].filter(Boolean).join(' · ')
            return {
              ...ip,
              vitals: [...(ip.vitals ?? []), rec],
              latestVitals: { hr: rec.hr ?? 0, bp: bp ?? '—', temp: rec.temp ?? 0, spo2: rec.spo2 ?? 0, at: rec.at },
              events: append(ip, {
                type: 'note', actor: rec.by || 'Nurse',
                title: `Vitals recorded · NEWS ${news.score}`,
                detail,
                severity: news.band === 'high' ? 'critical' : news.band === 'medium' ? 'warning' : 'info',
                patientText: 'Your vitals were checked by the nursing team.',
              }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated || !localRec) return
        const { latestVitals, events } = updated
        const rec = localRec
        void (async () => {
          const actor = await resolveRealIpdActor()
          if (!actor) return
          try {
            const { IpdVitals, IpdStays } = await import('@/lib/api')
            const vitalInput: Omit<IpdVital, 'id' | 'recordedAt' | 'recordedBy' | 'recordedByName'> = {
              ipdStayId: realId!, patientId: id,
              hr: rec.hr, systolicBp: rec.systolicBP, diastolicBp: rec.diastolicBP, rr: rec.rr,
              spo2: rec.spo2, o2Delivery: rec.o2Delivery, o2Flow: rec.o2Flow, temp: rec.temp,
              pain: rec.pain, bloodGlucose: rec.bloodGlucose, consciousness: rec.consciousness,
              gcs: rec.gcs, weight: rec.weight, height: rec.height,
              capillaryRefill: rec.capillaryRefill, urineOutput: rec.urineOutput, note: rec.note,
            }
            await IpdVitals.record(vitalInput, actor)
            const realEvents = events.map(e => e.id === events[events.length - 1]!.id ? { ...e, actor: actor.name } : e)
            await IpdStays.patch(realId!, { latestVitals, events: realEvents })
          } catch (err) {
            console.error('[useInpatientStore] real backend recordVitals failed (local chart still updated):', err)
          }
        })()
      },
      addIvLine: (id, line) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            ivLines: [...(ip.ivLines ?? []), { id: uid('iv'), ...line }],
            events: append(ip, { type: 'note', actor: 'Nurse', title: `IV started — ${line.fluid}`, detail: `${line.rate}` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { ivLines, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { ivLines, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addIvLine failed (local chart still updated):', err)
          }
        })()
      },
      dismissInsight: (id) => {
        let realId: string | undefined
        set(s => {
          const next = patch(s, id, ip => ({ ...ip, dismissedInsight: true }))
          realId = next.inpatients.find(x => x.patientId === id)?.realId
          return next
        })
        if (!realId) return
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { dismissedInsight: true })
          } catch (err) {
            console.error('[useInpatientStore] real backend dismissInsight failed (local chart still updated):', err)
          }
        })()
      },

      administerMed: (id, a) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        let localRec: MarRecord | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const rec: MarRecord = { id: uid('mar'), medName: a.medName, slot: a.slot, action: a.action, by: a.by || 'Nurse', at: new Date().toISOString(), note: a.note }
            localRec = rec
            const title = a.action === 'given' ? `Administered ${a.medName}` : `Held ${a.medName}`
            return {
              ...ip,
              mar: [...(ip.mar ?? []), rec],
              events: append(ip, {
                type: 'med_change', actor: rec.by, title,
                detail: `${a.slot}${a.note ? ` · ${a.note}` : ''}`,
                severity: a.action === 'held' ? 'warning' : 'info',
                patientText: a.action === 'given' ? `A nurse gave you your ${a.medName} dose.` : `A dose of ${a.medName} was held by the nursing team.`,
              }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated || !localRec) return
        const { mar, events } = updated
        void (async () => {
          const actor = await resolveRealIpdActor()
          if (!actor) return
          const realMar = (mar ?? []).map(m => m.id === localRec!.id ? { ...m, by: actor.name } : m)
          const realEvents = events.map(e => e.id === events[events.length - 1]!.id ? { ...e, actor: actor.name } : e)
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { mar: realMar, events: realEvents })
          } catch (err) {
            console.error('[useInpatientStore] real backend administerMed failed (local chart still updated):', err)
          }
        })()
      },

      acknowledgeOrder: (id, o) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            nurseAck: [...(ip.nurseAck ?? []), o.key],
            events: append(ip, { type: 'note', actor: 'Nurse', title: `Order actioned — ${o.label}`, severity: 'info' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { nurseAck, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { nurseAck, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend acknowledgeOrder failed (local chart still updated):', err)
          }
        })()
      },

      addNursingNote: (id, text, by) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            events: append(ip, { type: 'note', actor: by || 'Nurse', title: 'Nursing note', detail: text, patientText: 'A nurse updated your care notes.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addNursingNote failed (local chart still updated):', err)
          }
        })()
      },

      // Sync the nurse-completed profile's clinical fields onto the shared chart so
      // the doctor's IPD view reflects them (allergies/comorbidities already shown there).
      applyProfileClinical: (id, c) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            allergies: c.allergies && c.allergies.length ? c.allergies : ip.allergies,
            comorbidities: c.comorbidities && c.comorbidities.length ? c.comorbidities : ip.comorbidities,
            events: append(ip, { type: 'note', actor: 'Nurse', title: 'Profile completed', detail: 'Clinical history captured at first vitals.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { allergies, comorbidities, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { allergies, comorbidities, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend applyProfileClinical failed (local chart still updated):', err)
          }
        })()
      },

      addIo: (id, e) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        let localEntry: IoEntry | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const entry: IoEntry = { id: uid('io'), at: new Date().toISOString(), by: e.by || 'Nurse', kind: e.kind, type: e.type, volume: e.volume }
            localEntry = entry
            return {
              ...ip,
              io: [...(ip.io ?? []), entry],
              events: append(ip, { type: 'note', actor: e.by || 'Nurse', title: `${e.kind === 'intake' ? 'Intake' : 'Output'} recorded — ${e.type}`, detail: `${e.volume} mL` }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated || !localEntry) return
        const { io, events } = updated
        void (async () => {
          const actor = await resolveRealIpdActor()
          if (!actor) return
          const realIo = (io ?? []).map(x => x.id === localEntry!.id ? { ...x, by: actor.name } : x)
          const realEvents = events.map(x => x.id === events[events.length - 1]!.id ? { ...x, actor: actor.name } : x)
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { io: realIo, events: realEvents })
          } catch (err) {
            console.error('[useInpatientStore] real backend addIo failed (local chart still updated):', err)
          }
        })()
      },

      setIvStatus: (id, ivId, status) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            ivLines: (ip.ivLines ?? []).map(l => l.id === ivId ? { ...l, status } : l),
            events: append(ip, { type: 'note', actor: 'Nurse', title: `IV ${status.toLowerCase()} — ${(ip.ivLines ?? []).find(l => l.id === ivId)?.fluid ?? 'line'}` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { ivLines, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { ivLines, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setIvStatus failed (local chart still updated):', err)
          }
        })()
      },

      addTest: (id, t) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            tests: [...ip.tests, { id: uid('t'), name: t.name, status: 'Ordered', priority: t.priority ?? 'Routine', orderedAt: new Date().toISOString() }],
            events: append(ip, { type: 'test_order', actor: ip.admittingDoctor, title: `Ordered ${t.name}`, detail: t.priority ?? 'Routine', patientText: `A test (${t.name}) was ordered.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { tests, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { tests, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend addTest failed (local chart still updated):', err)
          }
        })()
      },

      setTestResult: (id, testId, r) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            tests: ip.tests.map(t => t.id === testId ? { ...t, status: 'Ready', result: r.result, resultAt: new Date().toISOString(), critical: r.critical } : t),
            events: append(ip, { type: 'test_result', actor: 'Laboratory', title: `Result: ${ip.tests.find(t => t.id === testId)?.name ?? 'test'}`, detail: r.result, severity: r.critical ? 'critical' : 'success' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { tests, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { tests, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setTestResult failed (local chart still updated):', err)
          }
        })()
      },

      acknowledgeTest: (id, testId) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            tests: ip.tests.map(t => t.id === testId ? { ...t, status: 'Acknowledged', acknowledgedAt: new Date().toISOString() } : t),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { tests } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { tests })
          } catch (err) {
            console.error('[useInpatientStore] real backend acknowledgeTest failed (local chart still updated):', err)
          }
        })()
      },

      setDiet: (id, diet) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, diet,
            events: append(ip, { type: 'diet_change', actor: ip.admittingDoctor, title: `Diet: ${diet}`, patientText: `Your diet was updated to: ${diet}.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { diet: realDiet, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { diet: realDiet, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setDiet failed (local chart still updated):', err)
          }
        })()
      },

      // Phase 7 Task 8 — referral/ICU-transfer/OT-booking/surgery status
      // bridges. Every action here uses `ip.admittingDoctor` (already a fixed
      // record field, not a caller parameter) as its event actor, except
      // `signConsent`, whose `meta.signedBy` stays a free-text, unverified
      // label per this plan's Global Constraints (the actual signer is
      // typically the patient/a relative, who has no `profiles` row to
      // resolve against — exactly analogous to Lab's `Specimen.collectedBy`
      // free-text precedent) — gated only by the live-session guard, no
      // `resolveRealIpdActor()` call for the signer field itself.
      referInpatient: (id, r) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            referrals: [...(ip.referrals ?? []), { id: uid('ref'), at: new Date().toISOString(), status: 'sent', ...r }],
            events: append(ip, { type: 'referral', actor: ip.admittingDoctor, title: `Referred to ${r.specialty}${r.toDoctor ? ` (${r.toDoctor})` : ''}`, detail: r.reason, severity: r.urgent ? 'warning' : 'info', patientText: `You were referred to a ${r.specialty} specialist.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { referrals, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { referrals, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend referInpatient failed (local chart still updated):', err)
          }
        })()
      },

      requestIcuTransfer: (id, t) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            icuTransfer: { id: uid('icu'), at: new Date().toISOString(), status: 'requested', ...t },
            events: append(ip, { type: 'icu_transfer', actor: ip.admittingDoctor, title: 'ICU transfer requested', detail: t.reason, severity: 'warning', patientText: 'Your care team requested a move to intensive care for closer monitoring.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { icuTransfer, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { icuTransfer, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend requestIcuTransfer failed (local chart still updated):', err)
          }
        })()
      },

      bookOT: (id, o) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip,
            stage: 'pre_op',
            otBooking: { id: uid('ot'), status: 'requested', ...o },
            surgery: ip.surgery ?? { procedure: o.procedure, surgeon: o.surgeon, status: 'scheduled', consentSigned: false, preOpDone: false, ot: o.ot, scheduledAt: o.scheduledAt },
            events: append(ip, { type: 'ot_booking', actor: ip.admittingDoctor, title: `OT booked — ${o.procedure}`, detail: `${o.surgeon} · ${o.ot} · ${o.scheduledAt}`, patientText: 'Your procedure has been scheduled.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { stage, otBooking, surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { stage, otBooking, surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend bookOT failed (local chart still updated):', err)
          }
        })()
      },

      requestSurgery: (id, sg) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, stage: 'pre_op',
            surgery: { ...sg, status: 'consent_pending', consentSigned: false, preOpDone: false },
            events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: `Surgery planned — ${sg.procedure}`, detail: 'Awaiting consent', severity: 'warning', patientText: `A procedure (${sg.procedure}) has been planned. Your consent is needed.` }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { stage, surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { stage, surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend requestSurgery failed (local chart still updated):', err)
          }
        })()
      },

      signConsent: (id, meta) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.surgery ? ({
            ...ip, surgery: {
              ...ip.surgery,
              consentSigned: true,
              consentSignedAt: meta?.signedAt ?? new Date().toISOString(),
              consentSignedBy: meta?.signedBy,
            },
            events: append(ip, {
              type: 'surgery_status', actor: meta?.signedBy ?? ip.name,
              title: 'Consent signed',
              detail: meta?.signedBy ? `Signed digitally by ${meta.signedBy}` : undefined,
              severity: 'success',
              patientText: 'Consent for your procedure was signed.',
            }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend signConsent failed (local chart still updated):', err)
          }
        })()
      },

      scheduleSurgery: (id, d) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.surgery ? ({
            ...ip, surgery: { ...ip.surgery, ...d, status: 'scheduled', preOpDone: true },
            events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: `Surgery scheduled — ${ip.surgery.procedure}`, detail: `${d.ot} · ${d.scheduledAt}`, patientText: 'Your procedure has been scheduled.' }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend scheduleSurgery failed (local chart still updated):', err)
          }
        })()
      },

      advanceSurgery: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => {
            if (!ip.surgery) return ip
            const flow: SurgeryStatus[] = ['scheduled', 'in_ot', 'recovery', 'done']
            const i = flow.indexOf(ip.surgery.status)
            const next = flow[Math.min(i + 1, flow.length - 1)]
            const stage: IpdStage = next === 'in_ot' ? 'in_surgery' : next === 'recovery' ? 'post_op' : next === 'done' ? 'recovering' : ip.stage
            const labels: Record<string, string> = { in_ot: 'In operating theatre', recovery: 'Moved to recovery', done: 'Procedure complete' }
            return { ...ip, surgery: { ...ip.surgery, status: next }, stage, events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: labels[next] ?? `Surgery: ${next}`, severity: 'info', patientText: next === 'done' ? 'Your procedure is complete and you are recovering.' : 'There is an update about your procedure.' }) }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { stage, surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { stage, surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend advanceSurgery failed (local chart still updated):', err)
          }
        })()
      },

      setPostOpNote: (id, note) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.surgery ? ({
            ...ip, surgery: { ...ip.surgery, postOpNote: note },
            events: append(ip, { type: 'surgery_status', actor: ip.admittingDoctor, title: 'Post-op note', detail: note }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.surgery) return
        const { surgery, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            const { IpdStays } = await import('@/lib/api')
            await IpdStays.patch(realId!, { surgery, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend setPostOpNote failed (local chart still updated):', err)
          }
        })()
      },

      initiateDischarge: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ({
            ...ip, stage: 'discharge_initiated',
            discharge: { pillars: { clinical: true, nursing: false, pharmacy: false, billing: false, insurance: false }, meds: [], redFlags: [], initiatedAt: new Date().toISOString() },
            events: append(ip, { type: 'discharge_step', actor: ip.admittingDoctor, title: 'Discharge initiated', severity: 'info', patientText: 'Your discharge process has started.' }),
          }))
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        // Bridge into the Discharge Portal queue (unchanged local behavior),
        // plus stamp the new queue entry's realId so useDischargeStore's own
        // Task 9 bridges can find this same real ipd_stays row.
        const ip = get().inpatients.find(i => i.patientId === id)
        if (ip) {
          const ds = useDischargeStore.getState()
          if (!ds.dischargeQueue.some(d => d.patientId === ip.patientId)) {
            ds.initDischarge({
              patientId: ip.patientId,
              patientName: ip.name,
              wardBed: `${ip.ward} ${ip.bed}`.trim(),
              diagnosis: ip.diagnosis,
              admittedOn: ip.admittedAt,
              expectedDischarge: new Date().toISOString(),
              attendingDoctor: ip.admittingDoctor,
              payerType: 'General',
              condition: ip.condition === 'Critical' ? 'Critical' : ip.condition === 'Serious' ? 'Monitoring' : 'Stable',
              ttoMeds: ip.meds.filter(m => m.status === 'active').map(m => ({ name: m.name, dose: m.dose, freq: m.freq, duration: '7 days' })),
            })
            if (ip.realId) ds.setRealId(ip.patientId, ip.realId)
          }
        }
        if (!realId || !updated) return
        const { discharge, stage, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, discharge ?? null, { stage, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend initiateDischarge failed (local chart still updated):', err)
          }
        })()
      },

      // Cancel an in-progress discharge — clear the discharge state and return
      // the patient to active ward care so they show in IPD / Inpatients again.
      revertDischarge: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => {
            const { discharge: _discharge, ...rest } = ip
            return {
              ...rest, stage: 'under_treatment',
              events: append(ip, { type: 'discharge_step', actor: ip.admittingDoctor, title: 'Discharge cancelled — returned to ward', severity: 'warning', patientText: 'Your discharge was paused; your care team is continuing treatment.' }),
            }
          })
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated) return
        const { stage, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, null, { stage, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend revertDischarge failed (local chart still updated):', err)
          }
        })()
      },

      clearPillar: (id, key) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.discharge ? ({
            ...ip, discharge: { ...ip.discharge, pillars: { ...ip.discharge.pillars, [key]: true } },
            events: append(ip, { type: 'discharge_step', actor: 'System', title: `Discharge: ${key} cleared` }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.discharge) return
        const { events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            // Send ONLY the one key this action changed (never the store's
            // full local pillars snapshot) — patchWithSharedDischarge merges
            // it onto the CURRENT real pillars, so a pillar the OTHER store
            // (useDischargeStore) already cleared is never clobbered back to
            // this store's stale local value for that key.
            await patchWithSharedDischarge(realId!, { pillars: { [key]: true } }, { events })
          } catch (err) {
            console.error('[useInpatientStore] real backend clearPillar failed (local chart still updated):', err)
          }
        })()
      },

      setDischargeSummary: (id, d) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.discharge ? ({ ...ip, discharge: { ...ip.discharge, ...d } }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        if (!realId || !updated?.discharge) return
        const { summary, followUpDate, meds, redFlags } = updated.discharge
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, { summary, followUpDate, meds, redFlags })
          } catch (err) {
            console.error('[useInpatientStore] real backend setDischargeSummary failed (local chart still updated):', err)
          }
        })()
      },

      completeDischarge: (id) => {
        let realId: string | undefined
        let updated: Inpatient | undefined
        set(s => {
          const next = patch(s, id, ip => ip.discharge ? ({
            ...ip, stage: 'discharged', condition: 'Discharge-ready',
            discharge: { ...ip.discharge, doneAt: new Date().toISOString() },
            events: append(ip, { type: 'discharged', actor: ip.admittingDoctor, title: 'Discharged', severity: 'success', patientText: 'You have been discharged. Your take-home instructions are in your summary.' }),
          }) : ip)
          updated = next.inpatients.find(x => x.patientId === id)
          realId = updated?.realId
          return next
        })
        // Local-only side effects (unchanged): feedback request + notification.
        const ip = get().inpatients.find(p => p.patientId === id)
        if (ip) {
          usePatientFeedbackStore.getState().createFeedbackRequest(
            ip.patientId, ip.name, 'ipd', id,
            ip.admittingDoctor, ip.ward, ip.diagnosis,
            new Date().toISOString(),
          )
          useNotificationStore.getState().add({
            type: 'feedback_requested', priority: 'low',
            title: 'How was your stay?',
            body: 'Your feedback helps us improve. It only takes 2 minutes.',
            targetRole: 'patient', channels: ['in_app'],
            link: '/patient/feedback',
          })
        }
        if (!realId || !updated?.discharge) return
        const { stage, condition, discharge, events } = updated
        void (async () => {
          const { data: { session } } = await getSupabaseClient().auth.getSession()
          if (!session) return
          try {
            await patchWithSharedDischarge(realId!, { doneAt: discharge.doneAt }, { stage, condition, events })
          } catch (err) {
            console.error('[useInpatientStore] real backend completeDischarge failed (local chart still updated):', err)
          }
        })()
      },
    }),
    {
      name: 'agentix-ipd', version: 5, storage: createJSONStorage(() => localStorage), skipHydration: true,
      // Bumped as the nurse model grew (v2: vitals timeline; v3: MAR seeds;
      // v4: orders/referral seed; v5: IV volume + I/O seed). Reseed on upgrade.
      migrate: () => ({ inpatients: seed() }) as unknown as InpatientState,
    },
  ),
)
