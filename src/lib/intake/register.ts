// Shared OPD registration used by both the typed wizard and the voice assistant.
// Generates a permanent UHID, registers the patient, links ABHA when supplied,
// logs the new self-check-in into the patient's live journey, and notifies staff.

import { usePatientProfileStore, emptyProfile } from '@/store/usePatientProfileStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useJourneyStore } from '@/store/useJourneyStore'
import { usePatientLiveStore } from '@/store/usePatientLiveStore'
import { notifyAndAuditMany } from '@/lib/notifyAndAudit'
import type { Patient } from '@/store/usePatientStore'
import { effectiveTriage, type IntakeForm, type Gender } from '@/lib/intake/data'

export interface RegisterResult {
  patientId: string
  uhid: string
  token: number
  familyToken: string | null
  estWait: number
}

export interface RegisterDeps {
  patients: Patient[]
  addPatient: (patient: Partial<Patient> & { name: string; phone: string }) => void
  generateFamilyToken: (patientId: string, familyPhones: string[], consentGiven: boolean) => string
}

// PUH-<year>-<5-digit sequence>. Sequence continues from the highest UHID already
// issued this year so demo data stays monotonic; falls back to a timestamp tail.
export function generateUhid(patients: Patient[]): string {
  const year = new Date().getFullYear()
  const prefix = `PUH-${year}-`
  const maxSeq = patients.reduce((max, p) => {
    if (!p.uhid?.startsWith(prefix)) return max
    const seq = parseInt(p.uhid.slice(prefix.length), 10)
    return Number.isNaN(seq) ? max : Math.max(max, seq)
  }, 0)
  const seq = maxSeq > 0 ? maxSeq + 1 : Number(String(Date.now()).slice(-5))
  return `${prefix}${String(seq).padStart(5, '0')}`
}

// Returning-patient lookup (Decision Point #2): reuse the UHID already linked to
// this ABHA so repeat visitors keep one permanent identifier.
export function findUhidByAbha(abhaId: string): string | undefined {
  const clean = abhaId.trim()
  if (!clean) return undefined
  return Object.values(usePatientProfileStore.getState().profiles)
    .find(p => p.abhaId === clean && p.uhid)?.uhid
}

export function registerPatientFromIntake(form: IntakeForm, deps: RegisterDeps): RegisterResult {
  const { patients, addPatient, generateFamilyToken } = deps
  const mode = form.consultationType === 'video' ? 'video' : 'in_person'
  const newToken = Math.max(...patients.map(p => p.token), 1000) + 1
  const newId = `PT-${Date.now()}`
  // A self-check-in patient does NOT get a UHID here. Identity is verified at the
  // reception desk (Aadhaar → ABHA detect/create → UHID) before they can be sent
  // to vitals, so they enter the OPD queue as "Needs Aadhaar Verification". The
  // only exception is a returning patient whose ABHA already resolves to a UHID.
  const uhid = (form.abhaId && findUhidByAbha(form.abhaId)) || ''
  const triage = effectiveTriage(form)
  const estWaitMins = (patients.filter(p => ['waiting', 'vitals'].includes(p.queueStatus)).length + 1) * 4
  const isGovtScheme = form.payer === 'govtScheme'

  addPatient({
    id: newId,
    uhid,
    aadhaarVerified: !!uhid,
    source: 'appointment',
    name: form.name,
    age: parseInt(form.age, 10),
    gender: (form.gender || 'Male') as Gender,
    phone: form.phone,
    bloodGroup: 'A+',
    token: newToken,
    estimatedWait: estWaitMins,
    doctor: mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair',
    department: form.departments[0] ?? 'General Medicine',
    departments: form.departments,
    visitTypes: [mode === 'video' ? 'Video consult' : 'In-person OPD'],
    insurer: isGovtScheme ? form.schemeName : (form.payer === 'cashless' ? (form.insurer || undefined) : undefined),
    symptoms: form.symptoms,
    history: [],
    triageLevel: triage.level,
    hasReports: form.hasReports,
  })

  // Persist the permanent UHID↔ABHA link so future visits resolve the returning patient.
  if (form.abhaId && uhid) {
    usePatientProfileStore.getState().saveProfile(
      newId,
      {
        ...emptyProfile(),
        uhid,
        abhaId: form.abhaId,
        payerType: isGovtScheme ? 'Govt scheme' : undefined,
        insurer: isGovtScheme ? form.schemeName : undefined,
      },
      form.name,
    )
  }

  // Register the patient in the monitoring/SLA journey view so the admin cockpit
  // tracks self/voice check-ins the same as desk registrations.
  useJourneyStore.getState().addPatient(newId, form.name, mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair')

  let familyToken: string | null = null
  if (form.dishaConsent && form.familyPhone.trim()) {
    familyToken = generateFamilyToken(newId, [form.familyPhone.trim()], true)
  }

  const auth = useAuthStore.getState()
  auth.setRole('patient')
  auth.setUser({ id: newId, name: form.name, role: 'patient' })
  const apptDoctor = mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair'
  usePatientLiveStore.getState().startVisit(newToken, mode, form.apptDate, form.apptTime, apptDoctor)

  notifyAndAuditMany(['reception', 'doctor'], {
    type: 'appointment',
    priority: triage.level === 'Critical' ? 'critical' : triage.level === 'High' ? 'high' : 'medium',
    title: `Self check-in · ${form.name}`,
    body: `${form.name} just checked in (${uhid ? `UHID ${uhid}` : 'awaiting Aadhaar verification — no UHID yet'}). Triage: ${triage.level}. ${isGovtScheme ? `Govt scheme: ${form.schemeName} · ABHA verified. ` : ''}${form.symptoms.length ? 'Symptoms: ' + form.symptoms.join(', ') + '.' : 'No symptoms provided.'} Token #${newToken}.`,
    patientName: form.name,
    audit: { action: 'reception_registered', resource: 'patient', resourceId: newId, detail: `Self-check-in completed · ${uhid ? `UHID ${uhid}` : 'UHID pending Aadhaar verification'} · token ${newToken}`, userName: form.name },
  })

  return { patientId: newId, uhid, token: newToken, familyToken, estWait: estWaitMins }
}
