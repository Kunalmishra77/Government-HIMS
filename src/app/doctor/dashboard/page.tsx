"use client"
import { Select } from "@/components/ui/Select"
import { useState, useEffect, useRef } from "react"
import { SideDrawer } from "@/components/ui/SideDrawer"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, CheckCircle2, Stethoscope, Mic, MicOff, Pill, Plus, X, Search,
  AlertCircle, Sparkles, Clock, Send, FileText, FlaskConical, ScanLine,
  ArrowRight, GitBranch, Bed, Bot,
  PhoneOff, Users, ShieldAlert, HeartPulse, BadgeCheck,
} from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { deriveUhid } from "@/lib/uhid"
import { listActiveDoctors, belongsToDoctorQueue } from "@/lib/opd-doctors"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useDoctorStatsStore } from "@/store/useDoctorStatsStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { useLabStore } from "@/store/useLabStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { LAB_CATALOG, type SpecimenType } from "@/lib/labCatalog"
import { useRadiologyStore, codeForLegacy } from "@/store/useRadiologyStore"
import { useRadiologyStudiesStore, emptyReportSections } from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG } from "@/lib/radiologyCatalog"
import { useAdmissionStore, WARD_ORDER } from "@/store/useAdmissionStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { triageMeta, queueStatusMeta } from "@/lib/clinicalStatus"
import { AiPreBrief } from "@/components/features/AiPreBrief"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OrderSetPicker } from "@/components/doctor/OrderSetPicker"
import { materializeOrderSet, type OrderSetDef } from "@/lib/clinicalOrderSets"
import type { Patient } from "@/store/usePatientStore"
import { toast } from "sonner"
import { isSpeechSupported, startDictation, startVoiceCommand, toSOAP, type Recognition } from "@/lib/voiceScribe"
import { openPrint, olFrom, para } from "@/lib/printDoc"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { useHRStore } from "@/store/useHRStore"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { getSupabaseClient } from "@/lib/supabase/client"
import type { Session } from "@supabase/supabase-js"

const DRUGS = ["Paracetamol 500mg","Amoxicillin 500mg","Azithromycin 500mg","Cetirizine 10mg","Pantoprazole 40mg","Dolo 650mg","Metformin 500mg","Amlodipine 5mg","Atorvastatin 20mg","Omeprazole 20mg","Ibuprofen 400mg","Montelukast 10mg","Metronidazole 400mg","Ondansetron 4mg","Diclofenac 50mg"]
// Lab tests come straight from the central catalog so every doctor-selected
// name round-trips to a valid TestRun (no silent fallbacks at the shim).
const LAB_TESTS = Object.values(LAB_CATALOG).map(e => e.name)
const SPECIALTIES = ["Cardiology","Neurology","Orthopaedics","Gastroenterology","Pulmonology","Nephrology","Oncology","Endocrinology","Dermatology","Psychiatry","ENT","Ophthalmology","Urology","Internal Medicine"]
const BODY_PARTS = ["Chest","Abdomen","Head","Neck","Spine (Lumbar)","Spine (Cervical)","Knee","Shoulder","Hip","Pelvis","Wrist","Ankle","Whole Abdomen"]

// Soft acuity tint for the token square — strong-tone ink + a hue ring keep
// the token number legible while colour + the acuity chip together encode
// triage, so meaning survives in greyscale (patient-safety rule).
const ACUITY_TINT: Record<string, string> = {
  danger:  "bg-danger-bg text-danger-strong ring-1 ring-danger/25",
  warning: "bg-warning-bg text-brand-amber-strong ring-1 ring-warning/30",
  success: "bg-success-bg text-success-strong ring-1 ring-success/25",
  muted:   "bg-surface-sunken text-foreground-muted ring-1 ring-border",
}

function QueueEntry({ patient, selected, onClick, delay }: { patient: Patient; selected: boolean; onClick: () => void; delay: number }) {
  const acuity = triageMeta(patient.triageLevel)
  const q = queueStatusMeta(patient.queueStatus)
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full text-left p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-3 shadow-card",
        selected
          ? "bg-accent-soft border-primary/30 ring-1 ring-primary/20"
          : "bg-surface border-border hover:border-border-hover hover:shadow-card-hover hover:-translate-y-0.5",
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black tabular-nums", ACUITY_TINT[acuity.variant] ?? ACUITY_TINT.muted)}>
        #{patient.token}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold truncate", selected ? "text-accent" : "text-foreground")}>{patient.name}</p>
        <p className="t-caption text-foreground-lighter truncate mt-0.5">{patient.age}y · {patient.symptoms[0] ?? "No symptoms"}</p>
      </div>
      <NeonBadge variant={q.variant} className="flex-shrink-0">{q.label}</NeonBadge>
    </motion.button>
  )
}

// Always-visible patient identity + safety strip at the top of the consult.
function PatientProfileHeader({ patient, onOpenHistory }: { patient: Patient; onOpenHistory: () => void }) {
  const profile = usePatientProfileStore(s => s.profiles[patient.id])
  const acuity = patient.triageLevel ? triageMeta(patient.triageLevel) : null
  const hasAllergy = !profile?.noKnownAllergies && (profile?.allergies?.length ?? 0) > 0
  const allergyText = profile?.noKnownAllergies
    ? 'No known allergies'
    : hasAllergy ? profile!.allergies.join(', ') : 'Not recorded'
  const alerts: string[] = []
  if (patient.triageLevel === 'Critical' || patient.triageLevel === 'High') alerts.push(`${patient.triageLevel} triage`)
  if (hasAllergy) alerts.push(`Allergy: ${profile!.allergies.join(', ')}`)
  if (profile?.chronicConditions?.length) alerts.push(...profile.chronicConditions)
  const chief = patient.symptoms[0] ?? 'Not recorded'
  const vitals = patient.vitals ? Object.entries(patient.vitals) : []

  return (
    <div className="hms-card sticky top-0 z-20 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Avatar name={patient.name} size="lg" className="h-11 w-11 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground">{patient.name}</h2>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success-bg border border-success/25 rounded-lg px-2 py-0.5">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />{patient.uhid ?? deriveUhid(patient.id)}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent tabular-nums">#{patient.token}</span>
            {acuity && <NeonBadge variant={acuity.variant}>{acuity.label} triage</NeonBadge>}
          </div>
          <p className="text-xs font-medium mt-0.5 text-foreground-lighter">
            {patient.id} · {patient.age}y · {patient.gender} · {patient.phone}
          </p>
        </div>
        {vitals.length > 0 && (
          <div className="flex gap-1.5 flex-wrap flex-shrink-0">
            {vitals.map(([k, v]) => (
              <div key={k} className="text-center px-2.5 py-1.5 rounded-lg bg-surface-sunken">
                <p className="t-overline text-foreground-lighter">{k}</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
        <div className="flex items-start gap-2">
          <HeartPulse className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="t-overline text-foreground-lighter">Chief complaint</p>
            <p className="text-sm font-semibold text-foreground">{chief}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ShieldAlert className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', hasAllergy ? 'text-danger' : 'text-foreground-lighter')} aria-hidden="true" />
          <div className="min-w-0">
            <p className="t-overline text-foreground-lighter">Allergies</p>
            <p className={cn('text-sm font-semibold', hasAllergy ? 'text-danger' : 'text-foreground')}>{allergyText}</p>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mt-2.5 flex items-start gap-2 rounded-xl px-3 py-2 bg-danger-bg border border-danger/20" role="alert">
          <AlertCircle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="t-overline text-danger">Critical medical alerts</p>
            <p className="text-sm font-semibold text-danger-strong leading-snug">{alerts.join(' · ')}</p>
          </div>
        </div>
      )}

      {/* Symptoms — inline label + chips, kept tight */}
      <div className="mt-3 flex items-start gap-2 flex-wrap">
        <p className="t-overline text-foreground-lighter mt-1.5">Symptoms</p>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {patient.symptoms.length > 0 ? patient.symptoms.map((s, i) => (
            <span key={i} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-urgent-bg text-urgent">{s}</span>
          )) : <span className="text-sm font-medium italic text-foreground-lighter mt-0.5">No symptoms recorded</span>}
        </div>
      </div>

      {/* History — compact preview, opens full history in a drawer */}
      <button
        onClick={onOpenHistory}
        className="mt-2.5 w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition cursor-pointer bg-surface-sunken border border-border hover:brightness-[0.98]"
      >
        <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 2px 6px rgba(238,107,38,0.25)' }}>
          <FileText className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="t-overline text-foreground-lighter">History</p>
          <p className="text-sm font-medium text-foreground-muted truncate">{historyBrief(patient)}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-foreground-lighter flex-shrink-0" aria-hidden="true" />
      </button>
    </div>
  )
}

// Phase 3 Task 3 — local lab/radiology dispatch only ever offers 'Routine' | 'Urgent'
// (no 'stat' equivalent here), so the real backend OrderUrgency's 'stat' value is
// intentionally unreachable from this mapping.
function mapLocalPriorityToOrderUrgency(priority: 'Routine' | 'Urgent'): 'routine' | 'urgent' | 'stat' {
  return priority === 'Urgent' ? 'urgent' : 'routine'
}

// Phase 3 Task 4 — the local Prescription.duration field is free text (default
// "5 days", but doctors can type anything, e.g. "2 weeks" or "SOS"). Only the
// common "N day(s)" shape is parsed into a real day count for the backend's
// RxLine.days; anything else falls back to the RxLineSchema default of 5.
function parseDurationDays(duration: string): number {
  const m = /(\d+)\s*day/i.exec(duration)
  return m ? parseInt(m[1]!, 10) : 5
}

// Phase 3 cleanup — shared guard for every "local write also lands in the real
// backend" bridge in this file (dispatchLabOrder, dispatchRadOrder, sendRx,
// both of completeConsult's bridges, and handleSendAdmission). Centralizing
// this scaffolding means a future call site (Lab/Radiology/Pharmacy will
// likely add more of these) cannot forget the guard: it is structurally
// impossible to reach `write` without both a real live Supabase session and a
// real visitId, and any failure inside `write` is always caught and logged,
// never thrown into the local flow that triggered it.
//
// `session` is taken as a parameter rather than fetched inside the helper so a
// caller that already fetched a session for an earlier check in the same
// function (see completeConsult, which reuses one fetch across both of its
// bridges) can pass that same value straight through instead of hitting the
// SDK a second time. `visitId` is likewise re-handed to `write` (narrowed to
// `string`) so call sites never need a non-null assertion on
// `currentPatient.visitId`. The `write` callback's own `session`/`visitId`
// parameter names intentionally shadow the outer nullable/optional locals at
// each call site — that's deliberate: inside `write`, only the guaranteed-live
// values should ever be referenced.
async function withLiveSession(
  session: Session | null,
  visitId: string | undefined,
  write: (session: Session, visitId: string) => Promise<void>,
  errorContext: string,
): Promise<void> {
  if (!session || !visitId) return
  try {
    await write(session, visitId)
  } catch (err) {
    console.error(`[doctor/dashboard] ${errorContext}:`, err)
  }
}

// One-line AI crux of a patient's background, so the doctor gets the gist first.
function historyBrief(p: Patient): string {
  const chronic = p.history.filter(x => /diabet|hypertens|asthma|ckd|cardiac|copd|thyroid|arthrit|migrain|epileps/i.test(x))
  if (chronic.length) return `${chronic.length} chronic condition${chronic.length > 1 ? 's' : ''} (${chronic.join(', ')}) — review control, adherence & complications.`
  if (p.history.length === 0 || p.history.some(h => /no significant/i.test(h))) return 'No significant past medical history — treat as an acute presentation.'
  return `Background: ${p.history.join(', ')}.`
}

export default function DoctorDashboard() {
  const { patients, updateStatus, visits, addVisit } = usePatientStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const {
    currentPatient, setCurrentPatient, notes, setNotes, diagnosis, setDiagnosis,
    aiSuggestions, acceptAISuggestion, prescriptions, addPrescription, removePrescription,
    isDictating, toggleDictation, isPharmacySent, sendToPharmacy,
    labOrders, addLabOrder, removeLabOrder, markLabOrderSent,
    radiologyOrders, addRadiologyOrder, removeRadiologyOrder, markRadiologyOrderSent,
    referrals, addReferral, removeReferral,
    admissionOrder, setAdmissionOrder, markAdmissionSent, resetConsultation,
    isOnlineConsult, endOnlineCall,
  } = useConsultationStore()
  const recordStat = useDoctorStatsStore(s => s.record)
  const doctorId = currentUser?.id ?? 'DR-1012'

  // Names of currently-active real doctors, so the queue can tell a patient
  // genuinely assigned to ANOTHER on-duty doctor apart from one still carrying a
  // registration/seed default (e.g. self-check-in's 'Dr. Priya Nair'). Without
  // this, a patient registered via voice/appointment (always 'Dr. Priya Nair')
  // never matches a real logged-in doctor's profile name and silently drops off
  // the board even after vitals — the exact vitals→doctor break.
  const [activeDoctorNames, setActiveDoctorNames] = useState<string[]>([])
  useEffect(() => {
    void listActiveDoctors().then((docs) => setActiveDoctorNames(docs.map((d) => d.name)))
  }, [])
  const { addPrescription: addToPharmacy } = usePharmacyStore()
  const setPharmacyRealId = usePharmacyStore(s => s.setRealId)
  const { addOrderFromDoctor: addLabToStore } = useLabStore()
  const addLabRichOrder = useLabOrdersStore(s => s.addOrder)
  const { addOrderFromDoctor: addRadToStore } = useRadiologyStore()
  const addRadRichOrder = useRadiologyStudiesStore(s => s.addOrder)
  const { requestAdmission, beds } = useAdmissionStore()

  const wardSummary = WARD_ORDER.map(w => {
    const inWard = beds.filter(b => b.ward === w)
    return { ward: w, total: inWard.length, available: inWard.filter(b => b.status === 'Available').length }
  }).filter(w => w.total > 0)
  const totalFreeBeds = wardSummary.reduce((s, w) => s + w.available, 0)

  const [medSearch, setMedSearch] = useState("")
  const { confirm, view: dialogView } = useDialogs()
  const [showDrugs, setShowDrugs] = useState(false)
  const [activeDrug, setActiveDrug] = useState(-1)
  const [dosage, setDosage] = useState("1-0-1")
  const [duration, setDuration] = useState("5 days")
  const [frequency, setFrequency] = useState("TDS")
  const [qty, setQty] = useState("10")
  const [noteSaved, setNoteSaved] = useState(false)
  const [labTest, setLabTest] = useState("")
  const [labPriority, setLabPriority] = useState<'Routine' | 'Urgent'>("Routine")
  const [radScanType, setRadScanType] = useState<'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound'>("X-Ray")
  const [radBodyPart, setRadBodyPart] = useState("")
  const [radPriority, setRadPriority] = useState<'Routine' | 'Urgent'>("Routine")
  const [refSpecialty, setRefSpecialty] = useState("")
  const [refNotes, setRefNotes] = useState("")
  const [refUrgent, setRefUrgent] = useState(false)
  const [refListening, setRefListening] = useState(false)
  const refRecRef = useRef<Recognition | null>(null)
  useEffect(() => () => { refRecRef.current?.stop() }, [])
  const [admType, setAdmType] = useState<'General Ward' | 'ICU' | 'Private Room' | 'Semi-Private' | 'Day Care'>("General Ward")
  const [admReason, setAdmReason] = useState("")
  const [admAllergies, setAdmAllergies] = useState("")
  const [admComorbidities, setAdmComorbidities] = useState("")
  const [admSpecialInstructions, setAdmSpecialInstructions] = useState("")
  const [admUrgency, setAdmUrgency] = useState<'Routine' | 'Urgent' | 'Emergency'>("Urgent")
  // One clinical-action drawer open at a time; queue is its own left slide-out.
  const [activeDrawer, setActiveDrawer] = useState<'rx' | 'lab' | 'radiology' | 'referral' | 'admit' | 'brief' | 'history' | null>(null)
  const [showQueue, setShowQueue] = useState(true)

  const patientVisits = currentPatient ? visits.filter(v => v.patientId === currentPatient.id).sort((a, b) => b.date.localeCompare(a.date)) : []

  // Ambient voice scribe.
  const [speechOk, setSpeechOk] = useState(false)
  const recognitionRef = useRef<Recognition | null>(null)
  useEffect(() => { setSpeechOk(isSpeechSupported()) }, [])
  const handleDictate = () => {
    if (isDictating) { recognitionRef.current?.stop(); recognitionRef.current = null; toggleDictation(); return }
    if (!speechOk) { toast.error('Voice input not supported in this browser'); return }
    const rec = startDictation(
      (chunk) => { const cur = useConsultationStore.getState().notes; setNotes((cur ? cur + ' ' : '') + chunk) },
      () => { recognitionRef.current = null },
    )
    if (!rec) { toast.error('Could not start voice input'); return }
    recognitionRef.current = rec
    toggleDictation()
  }
  const profile = useDoctorProfileStore()
  const signature = profile.signature
  const printRx = () => {
    if (!currentPatient || prescriptions.length === 0) return
    const body = (diagnosis ? para('Provisional diagnosis', diagnosis) : '')
      + para('Medications', '')
      + olFrom(prescriptions.map(p => `${p.medicine} — ${p.dosage} · ${p.duration}${p.instructions ? ` · ${p.instructions}` : ''}`))
    openPrint({ kind: 'Prescription', patient: currentPatient.name, patientMeta: `${currentPatient.id} · ${currentPatient.age}y / ${currentPatient.gender}`, doctor: currentPatient.doctor, signature, bodyHtml: body })
  }
  const structureNote = () => {
    if (!notes.trim()) { toast.error('Add or dictate some notes first'); return }
    const v = currentPatient?.vitals ? `BP ${currentPatient.vitals.bp}, Pulse ${currentPatient.vitals.pulse}, Temp ${currentPatient.vitals.temp}, SpO₂ ${currentPatient.vitals.spo2}` : undefined
    setNotes(toSOAP(notes, { diagnosis, vitals: v }))
    toast.success('Note structured into SOAP')
  }

  // Live bed availability for the ward type selected in the admission modal.
  const wardFree = beds.filter(b => b.ward === admType && b.status === 'Available').length
  const wardTotal = beds.filter(b => b.ward === admType).length

  useEffect(() => {
    if (!notes) return
    setNoteSaved(false)
    const t = setTimeout(() => setNoteSaved(true), 800)
    return () => clearTimeout(t)
  }, [notes])
  useEffect(() => {
    if (!noteSaved) return
    const t = setTimeout(() => setNoteSaved(false), 2500)
    return () => clearTimeout(t)
  }, [noteSaved])

  // This doctor's patients: those explicitly assigned to them by name, PLUS any
  // patient whose assigned doctor is NOT a currently-active real doctor (i.e. a
  // registration/seed default like 'Dr. Priya Nair' that no logged-in real
  // doctor "owns"). This keeps strict per-doctor routing when multiple real
  // doctors are on duty, while ensuring a vitals-completed patient is never
  // stranded before consultation just because of a name-string mismatch.
  const mine     = patients.filter(p => belongsToDoctorQueue(p.doctor, currentUser?.name, activeDoctorNames))
  const queue    = mine.filter(p => ["waiting","vitals","consulting"].includes(p.queueStatus))
  const seen     = mine.filter(p => ["pharmacy","billing","done"].includes(p.queueStatus)).length
  const filtered = DRUGS.filter(d => d.toLowerCase().includes(medSearch.toLowerCase()) && medSearch.length > 0)

  // Open a patient → mark them in consultation (handoff signal to reception/queue).
  // M2 — When on leave or OPD-paused, confirm the override before opening.
  // Phase 4 / M4.1 — Also check the HR roster: if the doctor is Off today, warn.
  const openPatient = async (p: Patient) => {
    const { onLeave: ol, availableForOPD: aop } = useDoctorProfileStore.getState()
    if (ol || !aop) {
      const ok = await confirm({
        title: ol ? "You're marked on leave" : "You're not currently accepting OPD",
        body: "Starting the consultation anyway will be audit-logged.",
        tone: 'warn',
        confirmLabel: 'Start anyway',
      })
      if (!ok) return
    }
    const me = useAuthStore.getState().currentUser
    if (me) {
      const today = new Date().toISOString().split('T')[0]!
      const myShift = useHRStore.getState().getShift(me.id, today)
      if (myShift === 'Off') {
        const ok = await confirm({
          title: "Off-shift consultation",
          body: "Per the HR roster you're Off today. Starting the consultation anyway will be audit-logged.",
          tone: 'warn',
          confirmLabel: 'Start anyway',
        })
        if (!ok) return
      }
    }
    setCurrentPatient(p)
    setShowQueue(false)
    if (p.queueStatus !== 'consulting') updateStatus(p.id, 'consulting')
  }

  // End the consultation → advance the patient down the journey and clear the workspace.
  const completeConsult = async () => {
    if (!currentPatient) return
    recordStat(doctorId, isOnlineConsult ? 'online' : 'opd')
    // Close the loop: write a visit into the patient's history.
    const finalDiagnosis = diagnosis.trim() || (isOnlineConsult ? 'Teleconsultation' : 'OPD consultation')
    const finalNotes = notes.trim() || `${isOnlineConsult ? 'Online' : 'In-person'} consultation completed${diagnosis.trim() ? '' : '; no specific diagnosis recorded'}.`
    addVisit({
      patientId: currentPatient.id,
      date: new Date().toISOString().slice(0, 10),
      doctor: currentPatient.doctor,
      diagnosis: finalDiagnosis,
      notes: finalNotes,
      prescriptions: prescriptions.map(p => ({ medicine: p.medicine, dosage: p.dosage, duration: p.duration })),
      mode: isOnlineConsult ? 'online' : 'in_person',
    })

    // Phase 3 Task 5 — same additive real-backend bridge as dispatchLabOrder/dispatchRadOrder
    // (Task 3) and sendRx (Task 4): gate on the *live* Supabase session (never a persisted
    // auth flag) and only when this patient has a real visit. A backend failure here must
    // never block the local consult-completion flow above/below.
    // `session` is fetched once here and reused below for the admission-request bridge
    // (Task 6) further down this function — see withLiveSession's doc comment for why
    // it's passed in rather than re-fetched.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { Encounters } = await import('@/lib/api')
      // Field-mapping simplification: EncounterSchema has no dedicated `diagnosis` column,
      // only the SOAP fields (subjective/objective/assessment/plan/noteMarkdown). We map
      // local `diagnosis` -> backend `assessment` (the closest established clinical-note
      // field for a diagnosis) and local `notes` -> backend `plan`. This is a deliberate
      // simplification: the local store keeps `diagnosis`/`notes` as two free-text concepts
      // that don't cleanly split into SOAP's four fields. A future phase should revisit this
      // if the UI ever separates subjective/objective concerns from notes.
      // `aiPreBriefAccepted` is omitted: AiPreBrief (src/components/features/AiPreBrief.tsx)
      // is a read-only display with no accept/reject affordance or callback, so this signal
      // does not exist anywhere in local state to report.
      const enc = await Encounters.create({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        doctorName: currentPatient.doctor,
        kind: isOnlineConsult ? 'OnlineConsult' : 'SOAP',
        assessment: finalDiagnosis,
        plan: finalNotes,
      })
      await Encounters.sign(enc.id)
    }, 'real encounter write failed')

    if (isOnlineConsult) {
      toast.success(`Online consultation complete — ${currentPatient.name}`)
    } else if (admissionOrder && !admissionOrder.sent) {
      // Track A auto-stage — a staged admission (e.g. from an order set) routes
      // straight to the bed manager on consult completion, carrying the orders
      // bundle, instead of needing a separate "Send Admission" click.
      requestAdmission({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        patientAge: currentPatient.age,
        patientGender: currentPatient.gender,
        diagnosis: diagnosis.trim() || admissionOrder.reason,
        admissionType: admissionOrder.admissionType,
        bedTypePreference: admissionOrder.bedTypePreference,
        reason: admissionOrder.reason,
        requestedBy: currentPatient.doctor,
        department: currentPatient.department,
        triageLevel: currentPatient.triageLevel,
        payerType: 'General',
        bundle: {
          prescriptions: prescriptions.map(p => ({ medicine: p.medicine, dosage: p.dosage, duration: p.duration, instructions: p.instructions })),
          labOrders: labOrders.map(o => ({ testName: o.testName, priority: o.priority })),
          radiologyOrders: radiologyOrders.map(o => ({ scanType: o.scanType, bodyPart: o.bodyPart, priority: o.priority })),
          allergies: admAllergies,
          comorbidities: admComorbidities,
          specialInstructions: admSpecialInstructions,
          urgency: admUrgency,
        },
      })
      markAdmissionSent()

      // Phase 3 Task 6 — same additive real-backend bridge as handleSendAdmission
      // below: gate on the *live* Supabase session and only when this patient has
      // a real visit. A backend failure here must never block the local flow above.
      // Reuses the `session` fetched once above (Task 5) instead of re-fetching.
      await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
        const { AdmissionRequests } = await import('@/lib/api')
        await AdmissionRequests.create({
          visitId,
          patientId: currentPatient.id,
          doctorId: session.user.id,
          diagnosis: diagnosis.trim() || admissionOrder.reason,
          admissionType: admissionOrder.admissionType,
          bedTypePreference: admissionOrder.bedTypePreference,
          reason: admissionOrder.reason,
          department: currentPatient.department,
          triageLevel: currentPatient.triageLevel,
          payerType: 'General',
        })
      }, 'real admission request write failed')

      updateStatus(currentPatient.id, 'done')
      toast.success(`Consultation complete — ${currentPatient.name} → Admission requested (${admissionOrder.admissionType})`)
    } else {
      const next = (isPharmacySent || prescriptions.length > 0) ? 'pharmacy' : 'billing'
      updateStatus(currentPatient.id, next)
      toast.success(`Consultation complete — ${currentPatient.name} → ${next === 'pharmacy' ? 'Pharmacy' : 'Billing'}`)
    }
    setActiveDrawer(null)
    resetConsultation()
    setShowQueue(true)
  }

  const addMed = (name: string) => {
    if (!name.trim()) return
    addPrescription({ id: Math.random().toString(36), medicine: name, dosage, duration, instructions: frequency })
    setMedSearch("")
    setShowDrugs(false)
  }

  // Track A — apply a protocol bundle in one tap. Stages into the local
  // consultation workspace AND immediately dispatches lab/imaging to the
  // respective queues so they appear on the Lab and Radiology dashboards.
  const applyOrderSet = (def: OrderSetDef) => {
    if (!currentPatient) { toast.error("Select a patient first"); return }
    const m = materializeOrderSet(def)
    if (!diagnosis.trim()) setDiagnosis(m.diagnosis)
    m.prescriptions.forEach((p, i) => addPrescription({ id: `RX-${Date.now()}-${i}`, ...p }))
    m.labs.forEach(l => dispatchLabOrder(l.testName, l.priority ?? 'Routine'))
    m.imaging.forEach(im => dispatchRadOrder(im.scanType, im.bodyPart ?? '', im.priority ?? 'Routine'))
    if (m.admission) setAdmissionOrder(m.admission)
    const summary = [
      m.labs.length && `${m.labs.length} lab`,
      m.imaging.length && `${m.imaging.length} imaging`,
      m.prescriptions.length && `${m.prescriptions.length} Rx`,
      m.admission && 'admission',
    ].filter(Boolean).join(' · ')
    toast.success(`${def.label} applied`, { description: `${summary} dispatched to queues.` })
  }

  const sendRx = async () => {
    if (!currentPatient || prescriptions.length === 0) return
    const localRxId = `RX-${Date.now()}`
    const medicines = prescriptions.map(p => ({
      name: p.medicine, dosage: p.dosage, frequency: p.instructions ?? "As directed",
      duration: p.duration, quantity: parseInt(qty) || 10,
    }))
    addToPharmacy({
      id: localRxId,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      tokenNumber: currentPatient.token,
      doctorName: currentPatient.doctor,
      department: currentPatient.department,
      status: "queued",
      dispatchedAt: new Date().toISOString(),
      estimatedReadyIn: prescriptions.length * 3,
      triageLevel: currentPatient.triageLevel,
      medicines,
    })
    sendToPharmacy()
    recordStat(doctorId, 'prescriptions', prescriptions.length)
    console.info(`[workflow] sendRx(${currentPatient.id}) → Pharmacy queue · ${medicines.length} medicine(s), status 'queued'`)
    toast.success("Prescription sent to Pharmacy")

    // Phase 3 Task 4 — same additive real-backend bridge as dispatchLabOrder/dispatchRadOrder
    // above: gate on the *live* Supabase session (never a persisted auth flag) and only
    // when this patient has a real visit. A backend failure here must never break the
    // local pharmacy-queue UX above.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { Prescriptions, PharmacyDispenses } = await import('@/lib/api')
      const rx = await Prescriptions.draft({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        doctorName: currentPatient.doctor,
        lines: prescriptions.map((p, i) => ({
          id: `RL-${i}`,
          drugName: p.medicine,
          dose: p.dosage,
          days: parseDurationDays(p.duration),
          quantity: 0,
          instructions: p.instructions,
          status: 'draft' as const,
        })),
      })
      // Phase 3 Task 4 simplification — NOT a real safety verification. The local
      // useConsultationStore's Prescription type carries no allergy/interaction/dose/
      // narcotic check results at all today (no drug-safety-check UI exists client-side
      // yet), so these values are hardcoded placeholders and cannot reflect any actual
      // check performed. A future phase wiring real prescribing safety checks (against
      // useDrugMasterStore) must replace this with the genuine check results before this
      // can be treated as a verified safety envelope.
      await Prescriptions.sign(rx.id, {
        allergyChecked: true, interactionChecked: true, doseChecked: true, narcoticChecked: false, flags: [],
      })

      // Phase 6 Task 3 (order rewire) — materialize the real pharmacy_dispenses
      // row the pharmacy actually works against, mirroring
      // usePharmacyStore.addPrescription()'s client-side logic. `department`/
      // `tokenNumber`/`medicines` are the exact same values already sent to the
      // local store above — built once, reused for both writes.
      const dispense = await PharmacyDispenses.create({
        prescriptionId: rx.id,
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        tokenNumber: currentPatient.token,
        doctorName: currentPatient.doctor,
        department: currentPatient.department,
        source: 'OPD',
        paymentMode: 'Cash',
        medicines,
        dispatchedAt: rx.createdAt,
        estimatedReadyIn: prescriptions.length * 3,
        triageLevel: currentPatient.triageLevel,
      })
      setPharmacyRealId(localRxId, dispense.id)
    }, 'real prescription write failed (local pharmacy queue still updated)')
  }

  // Dispatches a single lab test immediately to the lab queue AND stages it in the
  // consultation store (marked sent to prevent double-dispatch via any legacy path).
  const dispatchLabOrder = async (testName: string, priority: 'Routine' | 'Urgent') => {
    if (!currentPatient) { toast.error("Select a patient from the queue first"); return }
    addLabOrder({ testName, priority })
    // Zustand mutations are synchronous — getState() reflects the change immediately.
    const newId = useConsultationStore.getState().labOrders.slice(-1)[0]?.id
    if (newId) markLabOrderSent(newId)
    const code = Object.values(LAB_CATALOG).find(e => e.name === testName || e.code === testName)?.code
    // Phase 4 — the real-id-alignment fix: capture the LOCAL order id addOrder()
    // returns so the real order/specimen/test ids materialized below can be
    // stamped back onto this exact local order via setRealIds(). Only set when
    // `code` resolved — the legacy addLabToStore fallback path below has no
    // catalog entry to bridge from, matching the `codes.length > 0` guard further
    // down that decides whether any real materialization happens at all.
    let localOrderId: string | undefined
    if (code) {
      localOrderId = addLabRichOrder({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        source: 'OPD',
        doctorName: currentPatient.doctor,
        paymentMode: 'Cash',
        testCodes: [code],
      })
    } else {
      addLabToStore({ patientName: currentPatient.name, patientId: currentPatient.id, testName, priority, orderedBy: currentPatient.doctor })
    }
    recordStat(doctorId, 'tests', 1)
    toast.success(`${testName} → Lab queue`)

    // Phase 3 Task 3 — additive bridge into the real backend `orders` table, so this
    // order also flows to Lab's real dashboards once wired. Same guarded pattern as
    // usePatientStore's addPatient/recordOpdVitals/updateStatus: gate on the *live*
    // Supabase session (never a persisted auth flag — see comments there for why),
    // and only when this patient has a real visit (Phase 2's reception flow stamps
    // `visitId`). A backend failure here must never break the local queue UX above.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { Orders, LabSpecimens, LabTests } = await import('@/lib/api')
      const order = await Orders.create({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        doctorName: currentPatient.doctor,
        kind: 'lab',
        urgency: mapLocalPriorityToOrderUrgency(priority),
        indication: undefined,
        items: [{ id: `OI-${Date.now()}`, name: testName, qty: 1 }],
        bench: code ? LAB_CATALOG[code]?.bench : undefined,
      })

      // Task 3 (order rewire) — materialize the real lab_specimens/lab_tests rows a
      // lab tech actually works against, mirroring useLabOrdersStore.addOrder()'s
      // client-side logic: group the ordered test codes into one specimen per
      // distinct specimen type, then create one lab_tests row per code referencing
      // the real order id and its matching specimen id. Only possible when `code`
      // resolved from LAB_CATALOG (same condition the local addLabRichOrder branch
      // above already requires) — the legacy addLabToStore fallback path has no
      // catalog entry to materialize from, exactly as on the client.
      const codes = code ? [code] : []
      if (codes.length > 0) {
        const specimensByType = new Map<string, { id: string }>()
        // Phase 4 — id-alignment fix: collect the real specimen/test ids as
        // they're created, so they can be stamped back onto the LOCAL order
        // (localOrderId) that addLabRichOrder built above from the same
        // `codes`/catalog grouping. Without this, the real orders/
        // lab_specimens/lab_tests rows have no recoverable link back to the
        // local LabOrder/Specimen/TestRun objects every lab-store bridge
        // (collectOrder/rejectSpecimen/recollectOrder, and later
        // claim/finishEntry/verifyTest/microRelease) keys off.
        const realSpecimens: { type: SpecimenType; realId: string }[] = []
        for (const c of codes) {
          const cat = LAB_CATALOG[c]
          if (!cat) continue
          if (!specimensByType.has(cat.specimen)) {
            const specimen = await LabSpecimens.create({
              orderId: order.id,
              type: cat.specimen,
              container: cat.container,
            })
            specimensByType.set(cat.specimen, specimen)
            realSpecimens.push({ type: cat.specimen, realId: specimen.id })
          }
        }
        const realTests: { code: string; realId: string }[] = []
        for (const c of codes) {
          const cat = LAB_CATALOG[c]
          if (!cat) continue
          const specimen = specimensByType.get(cat.specimen)
          const test = await LabTests.create({
            orderId: order.id,
            specimenId: specimen?.id,
            code: c,
            name: cat.name,
            bench: cat.bench,
            priority: cat.defaultPriority,
            // LabTests' `expectedTatMin` field (not the store's `expectedTATmin` —
            // see lab-tests.ts's module comment on why the spelling differs) mirrors
            // addOrder's own fallback: non-micro tests use expectedTATmin directly;
            // micro tests (no expectedTATmin) fall back to expectedDays converted to
            // minutes.
            expectedTatMin: cat.expectedTATmin ?? (cat.expectedDays ? cat.expectedDays * 24 * 60 : 60),
            orderedAt: order.createdAt,
          })
          realTests.push({ code: c, realId: test.id })
        }
        if (localOrderId) {
          useLabOrdersStore.getState().setRealIds(localOrderId, {
            orderId: order.id,
            specimens: realSpecimens,
            tests: realTests,
          })
        }
      }
    }, 'real lab order write failed (local queue still updated)')
  }

  // Same pattern for radiology.
  const dispatchRadOrder = async (scanType: typeof radScanType, bodyPart: string, priority: 'Routine' | 'Urgent') => {
    if (!currentPatient) { toast.error("Select a patient from the queue first"); return }
    addRadiologyOrder({ scanType, bodyPart, priority })
    const newId = useConsultationStore.getState().radiologyOrders.slice(-1)[0]?.id
    if (newId) markRadiologyOrderSent(newId)
    const code = codeForLegacy(scanType, bodyPart)
    // Phase 5 Task 3 — the real-id-alignment fix, mirroring Lab's Task 4:
    // capture the LOCAL study id addOrder() returns so the real order/study
    // ids materialized below can be stamped back onto this exact local study
    // via setRealId(). Only set when `code` resolved — the legacy addRadToStore
    // fallback path has no catalog entry to bridge from.
    let localStudyId: string | undefined
    if (code) {
      localStudyId = addRadRichOrder({
        patientId: currentPatient.id,
        patientName: currentPatient.name,
        source: 'OPD',
        doctorName: currentPatient.doctor,
        paymentMode: 'Cash',
        code,
        priority: priority === 'Urgent' ? 'Urgent' : undefined,
      })
    } else {
      addRadToStore({ patientName: currentPatient.name, patientId: currentPatient.id, scanType, bodyPart, priority, orderedBy: currentPatient.doctor })
    }
    recordStat(doctorId, 'tests', 1)
    toast.success(`${scanType} — ${bodyPart} → Radiology queue`)

    // Phase 3 Task 3 — additive bridge into the real backend `orders` table.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { Orders, RadiologyStudies } = await import('@/lib/api')
      const order = await Orders.create({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        doctorName: currentPatient.doctor,
        kind: 'radiology',
        urgency: mapLocalPriorityToOrderUrgency(priority),
        indication: undefined,
        items: [{ id: `OI-${Date.now()}`, name: `${scanType} — ${bodyPart}`, qty: 1 }],
        modality: scanType,
      })

      // Task 3 (order rewire) — materialize the real radiology_studies row a
      // radiology tech/radiologist actually works against, mirroring
      // useRadiologyStudiesStore.addOrder()'s client-side logic. Only possible
      // when `code` resolved from RADIOLOGY_CATALOG (same condition the local
      // addRadRichOrder branch above already requires).
      if (code) {
        const cat = RADIOLOGY_CATALOG[code]!
        const study = await RadiologyStudies.create({
          orderId: order.id,
          patientId: currentPatient.id,
          patientName: currentPatient.name,
          source: 'OPD',
          doctorName: currentPatient.doctor,
          paymentMode: 'Cash',
          code,
          name: cat.name,
          modality: cat.modality,
          bodyPart: cat.bodyPart,
          priority: priority === 'Urgent' ? 'Urgent' : cat.defaultPriority,
          reportSections: emptyReportSections(code),
          expectedTatMin: cat.expectedTATmin,
          orderedAt: order.createdAt,
        })
        if (localStudyId) {
          useRadiologyStudiesStore.getState().setRealId(localStudyId, study.id)
        }
      }
    }, 'real radiology order write failed (local queue still updated)')
  }

  const handleSendAdmission = async () => {
    if (!currentPatient) return
    if (!admReason.trim()) { toast.error("Please enter reason for admission"); return }
    // Build from the form state directly (avoids reading a not-yet-propagated store value).
    setAdmissionOrder({ admissionType: admType, reason: admReason, bedTypePreference: admType })
    requestAdmission({
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      patientAge: currentPatient.age,
      patientGender: currentPatient.gender,
      diagnosis,
      admissionType: admType,
      bedTypePreference: admType,
      reason: admReason,
      requestedBy: currentPatient.doctor,
      department: currentPatient.department,
      triageLevel: currentPatient.triageLevel,
      payerType: 'General',
      bundle: {
        prescriptions: prescriptions.map(p => ({ medicine: p.medicine, dosage: p.dosage, duration: p.duration, instructions: p.instructions })),
        labOrders: labOrders.map(o => ({ testName: o.testName, priority: o.priority })),
        radiologyOrders: radiologyOrders.map(o => ({ scanType: o.scanType, bodyPart: o.bodyPart, priority: o.priority })),
        allergies: admAllergies,
        comorbidities: admComorbidities,
        specialInstructions: admSpecialInstructions,
        urgency: admUrgency,
      },
    })
    markAdmissionSent()
    recordStat(doctorId, 'admissions', 1)

    // Phase 3 Task 6 — same additive real-backend bridge as dispatchLabOrder/
    // dispatchRadOrder (Task 3), sendRx (Task 4), and completeConsult's encounter
    // write (Task 5): gate on the *live* Supabase session (never a persisted auth
    // flag) and only when this patient has a real visit. A backend failure here
    // must never block the local admission-request flow above.
    const { data: { session } } = await getSupabaseClient().auth.getSession()
    await withLiveSession(session, currentPatient.visitId, async (session, visitId) => {
      const { AdmissionRequests } = await import('@/lib/api')
      await AdmissionRequests.create({
        visitId,
        patientId: currentPatient.id,
        doctorId: session.user.id,
        diagnosis,
        admissionType: admType,
        bedTypePreference: admType,
        reason: admReason,
        department: currentPatient.department,
        triageLevel: currentPatient.triageLevel,
        payerType: 'General',
      })
    }, 'real admission request write failed')

    setActiveDrawer(null)
    toast.success("Admission card + documents sent to Bed Manager")
  }

  const selectStyle = "w-full rounded-xl px-3 py-2 text-sm text-foreground bg-surface-sunken border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-border-focus transition-all"
  const selectInlineStyle = {}

  // M2 — Doctor "On leave" gate. Banner is shown on the dashboard, and any
  // "Start consultation" action confirms before proceeding.
  const { onLeave, leaveUntil, availableForOPD } = profile
  const leaveBanner = onLeave || !availableForOPD
  const leaveLabel = onLeave
    ? `You're marked on leave${leaveUntil ? ` until ${new Date(leaveUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}`
    : 'You are not currently accepting in-person consultations'

  // M4.1 — Shift-gate. If the doctor is Off per HR roster today, show a softer
  // (info) banner alongside the leave banner.
  const todayIso = new Date().toISOString().split('T')[0]!
  const getShiftFromHR = useHRStore(s => s.getShift)
  const todayShift = useAuthStore.getState().currentUser
    ? getShiftFromHR(useAuthStore.getState().currentUser!.id, todayIso)
    : 'Off'
  const offShiftBanner = !leaveBanner && todayShift === 'Off'

  return (
    <div className="flex flex-col lg:h-full lg:min-h-0 gap-4 px-1 py-1">

      {/* M2 — On-leave banner (full width above queue + workspace) */}
      {leaveBanner && (
        <div className="absolute top-0 left-0 right-0 z-30 mx-4 mt-2 rounded-xl bg-warning-bg border border-warning/30 px-4 py-2.5 flex items-start gap-2.5 shadow-sm" role="status">
          <AlertCircle className="h-4 w-4 text-brand-amber-strong flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] text-foreground leading-relaxed flex-1 min-w-0">
            <b>{leaveLabel}.</b> Starting a consultation will prompt for confirmation. Update this in <b>Settings</b>.
          </p>
        </div>
      )}

      {/* M4.1 — Off-shift soft banner (HR roster check) */}
      {offShiftBanner && (
        <div className="absolute top-0 left-0 right-0 z-30 mx-4 mt-2 rounded-xl bg-primary-soft border border-accent/20 px-4 py-2.5 flex items-start gap-2.5 shadow-sm" role="status">
          <AlertCircle className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[13px] text-accent leading-relaxed flex-1 min-w-0">
            <b>You&apos;re scheduled Off today per the roster.</b> You can still start a consultation if needed; it&apos;ll be logged with that context.
          </p>
        </div>
      )}

      {/* Floating live video — online consult runs alongside the full workspace */}
      <AnimatePresence>
        {isOnlineConsult && currentPatient && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-50 w-60 rounded-2xl overflow-hidden" style={{ background: '#0F172A', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
            <div className="relative h-28 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white text-lg font-bold">
                {currentPatient.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              <span className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold text-green-400"><span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE</span>
            </div>
            <div className="p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-[12.5px] font-bold truncate">{currentPatient.name}</p>
                <p className="text-white/50 text-[10px]">Online consultation</p>
              </div>
              <button onClick={endOnlineCall} aria-label="End call" className="h-8 px-2.5 rounded-lg bg-danger hover:bg-danger-strong text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95">
                <PhoneOff className="h-3.5 w-3.5" aria-hidden="true" /> End
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar: AI Brief (primary action) + Queue summary ──────── */}
      <div className="flex-shrink-0 flex items-stretch gap-3 flex-wrap">
        {/* AI Pre-Consultation Brief — independent primary action, set apart from the stats */}
        <button
          onClick={() => setActiveDrawer('brief')}
          disabled={!currentPatient}
          className="flex items-center gap-2 px-5 rounded-2xl font-bold text-[13px] text-foreground bg-surface border border-border shadow-card hover:bg-surface-sunken hover:border-border-hover active:scale-[0.98] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
          <span className="text-left leading-tight">AI Pre-Consultation Brief</span>
        </button>

        {/* Queue summary */}
        <div className="hms-card flex-1 min-w-0 flex items-center gap-3 flex-wrap px-4 py-3">
          <button
            onClick={() => setShowQueue(true)}
            className="h-10 px-4 rounded-full bg-primary hover:bg-primary-dark text-on-primary hover:text-on-primary font-bold text-[13px] flex items-center gap-2 shadow-sm active:scale-[0.98] transition cursor-pointer"
          >
            <Users className="h-4 w-4" aria-hidden="true" /> In Queue
            <span className="h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-white/25 tabular-nums">{queue.length}</span>
          </button>
          <div className="flex items-center gap-2">
            {[
              { label: "Total", value: mine.length, color: 'text-foreground' },
              { label: "Seen", value: seen, color: 'text-success' },
              { label: "Waiting", value: queue.length, color: 'text-warning' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-surface-sunken">
                <span className={cn("text-sm font-bold tabular-nums", color)}>{value}</span>
                <span className="text-xs font-semibold text-foreground-lighter">{label}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-medium text-foreground-lighter">
            <Clock className="h-4 w-4 text-foreground-placeholder" />
            Next: <span className="font-bold text-foreground">{queue[0]?.name ?? "No patients"}</span>
            {queue[0] && <span className="text-foreground-placeholder">~{queue[0].estimatedWait}m</span>}
          </div>
        </div>
      </div>

      {/* ── Main Panel ─────────────────────────────────── */}
      {!currentPatient ? (
        <div className="flex-1 hms-card flex items-center justify-center">
          <EmptyState
            icon={Stethoscope}
            title="Select a patient to begin"
            description="Choose a patient from the queue to start the consultation. AI pre-briefs load automatically."
            action={{ label: "Open today's queue", onClick: () => setShowQueue(true) }}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">

          {/* Center — primary consultation workspace */}
          <div className="flex-1 min-w-0 min-h-0 lg:overflow-y-auto lg:overscroll-contain space-y-4 px-2 lg:py-1">

            <PatientProfileHeader patient={currentPatient} onOpenHistory={() => setActiveDrawer('history')} />

            {/* Clinical Notes — primary focus */}
            <div className="hms-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-primary)', boxShadow: '0 2px 6px rgba(238,107,38,0.25)' }}>
                    <Activity className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Consultation Notes</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={structureNote} disabled={!notes.trim()} className="gap-2">
                    <Sparkles className="h-4 w-4" aria-hidden="true" /> Structure (SOAP)
                  </Button>
                  <Button variant={isDictating ? "danger" : "secondary"} size="sm" onClick={handleDictate} className="gap-2" title={speechOk ? undefined : "Voice input not supported in this browser"}>
                    {isDictating ? <><MicOff className="h-4 w-4 animate-pulse" aria-hidden="true" />Stop</> : <><Mic className="h-4 w-4" aria-hidden="true" />Dictate</>}
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="dx-input" className="block t-overline text-foreground-lighter mb-1.5">Diagnosis</label>
                  <Input id="dx-input" placeholder="E.g. Acute Viral Pharyngitis" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="bg-surface-sunken" />
                </div>

                {/* Prescription — permanent part of the consultation flow (Diagnosis → Prescription → Notes & Plan) */}
                <div className="pt-3 border-t border-dashed border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Pill className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                      <span className="t-overline text-foreground-lighter">Prescription</span>
                    </div>
                    {prescriptions.length > 0 && (
                      <span className="text-xs font-bold rounded-full px-2 py-0.5 bg-accent-soft text-accent">{prescriptions.length} med{prescriptions.length > 1 ? 's' : ''}</span>
                    )}
                  </div>

                  {diagnosis && prescriptions.length === 0 && (
                    <div className="mb-2.5">
                      <p className="t-overline text-accent mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" aria-hidden="true" /> AI Suggests
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {['Paracetamol 500mg', 'Amoxicillin 500mg', 'Pantoprazole 40mg'].map(drug => (
                          <button key={drug} onClick={() => addMed(drug)} className="text-xs font-semibold px-2.5 py-1.5 rounded-full cursor-pointer transition-all bg-accent-soft text-accent hover:brightness-95">
                            + {drug}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative mb-2.5">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-lighter" aria-hidden="true" />
                        <Input
                          id="med-search"
                          role="combobox"
                          aria-expanded={showDrugs && filtered.length > 0}
                          aria-controls="med-listbox"
                          aria-autocomplete="list"
                          aria-activedescendant={activeDrug >= 0 ? `med-opt-${activeDrug}` : undefined}
                          aria-label="Search medicine"
                          placeholder="Search medicine..."
                          value={medSearch}
                          onChange={e => { setMedSearch(e.target.value); setShowDrugs(true); setActiveDrug(-1) }}
                          onKeyDown={e => {
                            const opts = filtered.slice(0, 6)
                            if (e.key === 'ArrowDown' && showDrugs && opts.length) { e.preventDefault(); setActiveDrug(i => (i + 1) % opts.length) }
                            else if (e.key === 'ArrowUp' && showDrugs && opts.length) { e.preventDefault(); setActiveDrug(i => (i <= 0 ? opts.length - 1 : i - 1)) }
                            else if (e.key === 'Escape') { setShowDrugs(false); setActiveDrug(-1) }
                            else if (e.key === 'Enter') {
                              if (activeDrug >= 0 && opts[activeDrug]) { setMedSearch(opts[activeDrug]!); setShowDrugs(false); setActiveDrug(-1) }
                              else addMed(medSearch)
                            }
                          }}
                          className="pl-9 h-10 bg-surface-sunken"
                        />
                      </div>
                      <Button onClick={() => addMed(medSearch)} size="sm" className="h-10 px-4">Add</Button>
                    </div>
                    <AnimatePresence>
                      {showDrugs && filtered.length > 0 && (
                        <motion.ul
                          id="med-listbox"
                          role="listbox"
                          aria-label="Medicine suggestions"
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl bg-surface border border-border shadow-dropdown overflow-hidden list-none m-0 p-0"
                        >
                          {filtered.slice(0, 6).map((d, i) => (
                            <li
                              key={d}
                              id={`med-opt-${i}`}
                              role="option"
                              aria-selected={i === activeDrug}
                              onMouseEnter={() => setActiveDrug(i)}
                              onClick={() => { setMedSearch(d); setShowDrugs(false); setActiveDrug(-1) }}
                              className={cn(
                                "text-left text-sm px-4 py-2.5 text-foreground-muted font-medium transition-colors cursor-pointer border-b border-border-light last:border-b-0",
                                i === activeDrug && "bg-surface-sunken"
                              )}
                            >
                              {d}
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                    {[
                      { id: 'rx-dosage', label: 'Dosage', value: dosage, setter: setDosage, p: '1-0-1' },
                      { id: 'rx-duration', label: 'Duration', value: duration, setter: setDuration, p: '5 days' },
                      { id: 'rx-freq', label: 'Freq', value: frequency, setter: setFrequency, p: 'TDS' },
                      { id: 'rx-qty', label: 'Qty', value: qty, setter: setQty, p: '10' },
                    ].map(({ id, label, value, setter, p }) => (
                      <div key={label}>
                        <label htmlFor={id} className="block t-overline text-foreground-lighter mb-1">{label}</label>
                        <Input id={id} value={value} onChange={e => setter(e.target.value)} placeholder={p} className="h-9 text-sm bg-surface-sunken" />
                      </div>
                    ))}
                  </div>

                  {prescriptions.length > 0 ? (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {prescriptions.map(p => (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }}
                            className="flex items-start justify-between p-3.5 rounded-xl bg-surface-sunken border border-border"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{p.medicine}</p>
                              <p className="text-xs font-medium mt-0.5 text-foreground-lighter">{p.dosage} · {p.duration} · {p.instructions}</p>
                            </div>
                            <button onClick={() => removePrescription(p.id)} aria-label={`Remove ${p.medicine}`} className="tap p-1.5 rounded-lg ml-2 flex-shrink-0 cursor-pointer transition-colors text-foreground-placeholder hover:text-danger">
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-xl bg-surface-sunken border border-dashed border-border">
                      <Pill className="h-8 w-8 text-foreground-placeholder opacity-50" aria-hidden="true" />
                      <p className="text-xs font-medium text-foreground-lighter">No medicines added yet</p>
                    </div>
                  )}

                  {prescriptions.length > 0 && (
                    <div className="flex gap-2.5 mt-3">
                      <button
                        onClick={printRx}
                        className="flex-1 h-10 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer bg-surface-sunken text-foreground-muted hover:bg-neutral-200"
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" /> Print / Export
                      </button>
                      <button
                        onClick={sendRx}
                        disabled={isPharmacySent}
                        className="flex-1 h-10 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 text-white transition-all cursor-pointer disabled:opacity-50"
                        style={isPharmacySent
                          ? { background: 'linear-gradient(135deg,var(--color-success),var(--color-success-strong))', boxShadow: '0 4px 14px rgba(22,163,74,0.30)' }
                          : { background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))', boxShadow: '0 4px 14px rgba(238,107,38,0.30)' }}
                      >
                        {isPharmacySent
                          ? <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Sent to Pharmacy</>
                          : <><Send className="h-4 w-4" aria-hidden="true" /> Send to Pharmacy</>}
                      </button>
                    </div>
                  )}
                  {isPharmacySent && (
                    <p className="text-center text-xs font-semibold text-success mt-2">Pharmacy is preparing medicines</p>
                  )}
                </div>

                <div className="pt-3 border-t border-dashed border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="notes-plan" className="block t-overline text-foreground-lighter">Notes &amp; Plan</label>
                    {noteSaved && (
                      <span className="text-xs font-bold text-success flex items-center gap-1" role="status">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />Saved
                      </span>
                    )}
                  </div>
                  <textarea
                    id="notes-plan"
                    className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-surface-sunken border border-border placeholder:text-foreground-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-border-focus resize-y transition-all min-h-[220px]"
                    placeholder="Enter findings, follow-up instructions, etc..."
                    rows={9}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── QUICK ORDER SETS (Track A) ── */}
            <OrderSetPicker onApply={applyOrderSet} disabled={!currentPatient} />
          </div>

          {/* Right sidebar — AI Assistant + Clinical Actions + Bed Availability (secondary) */}
          <div className="w-full lg:w-80 flex-shrink-0 min-h-0 lg:overflow-y-auto lg:overscroll-contain space-y-4 px-1 lg:py-1">
            {/* AI Assistant */}
            <div className="ai-card p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 3px 8px rgba(238,107,38,0.30)' }}>
                  <Bot className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                </div>
                <span className="font-bold text-sm text-foreground">AI Assistant</span>
                <span className="ai-badge ml-auto">AI</span>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                <AnimatePresence>
                  {aiSuggestions.map((s, idx) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => acceptAISuggestion(s)}
                      className="w-full text-left text-xs rounded-xl p-3 flex items-center justify-between group cursor-pointer transition-all bg-surface/70 text-accent shadow-xs hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <span className="font-semibold leading-tight pr-2">{s}</span>
                      <Plus className="h-3.5 w-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
                    </motion.button>
                  ))}
                </AnimatePresence>
                {aiSuggestions.length === 0 && (
                  <div className="text-center py-3">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-primary-light" aria-hidden="true" />
                    <p className="text-xs font-medium text-foreground-lighter">No new suggestions</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Clinical Actions ── */}
            <div className="hms-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 3px 8px rgba(238,107,38,0.30)' }}>
                  <Activity className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Clinical Actions</h3>
              </div>
              <button
                onClick={completeConsult}
                className="w-full h-10 px-4 mb-3 rounded-xl font-bold text-[13px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-success/60 focus-visible:ring-offset-2"
                style={{ background: 'linear-gradient(135deg,var(--color-success),var(--color-success-strong))', boxShadow: '0 4px 12px rgba(22,163,74,0.30)' }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Complete consultation <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  { key: 'lab', label: 'Order Lab Tests', icon: FlaskConical, count: labOrders.length },
                  { key: 'radiology', label: 'Radiology Scan', icon: ScanLine, count: radiologyOrders.length },
                  { key: 'referral', label: 'Refer Specialist', icon: GitBranch, count: referrals.length },
                  { key: 'admit', label: 'Admit Patient', icon: Bed, count: admissionOrder?.sent ? 1 : 0 },
                ] as const).map(({ key, label, icon: Icon, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveDrawer(key)}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-2 px-2 py-3.5 rounded-xl text-[12px] font-bold text-center leading-tight transition active:scale-[0.98] cursor-pointer border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                      key === 'admit'
                        ? "col-span-2 flex-row bg-danger-bg text-danger border-danger/20 focus-visible:ring-danger/50"
                        : "bg-accent-soft text-accent border-accent/15 focus-visible:ring-primary/50"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span>{label}</span>
                    {count > 0 && (
                      <span
                        aria-label={`${count} pending`}
                        className={cn(
                          "absolute top-1.5 right-1.5 h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white tabular-nums",
                          key === 'admit' ? "bg-danger" : "bg-primary"
                        )}
                      >{count}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Bed Availability */}
            <div className="hms-card p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 3px 8px rgba(238,107,38,0.30)' }}>
                  <Bed className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                </div>
                <span className="font-bold text-sm text-foreground">Bed Availability</span>
                <span className={cn(
                  "ml-auto text-xs font-bold rounded-full px-2 py-0.5",
                  totalFreeBeds === 0 ? 'bg-danger-bg text-danger' : totalFreeBeds <= 3 ? 'bg-warning-bg text-brand-amber-strong' : 'bg-success-bg text-success'
                )}>{totalFreeBeds} free</span>
              </div>
              <div className="space-y-2">
                {wardSummary.map(w => {
                  const pct = w.total > 0 ? (w.available / w.total) * 100 : 0
                  const color = w.available === 0 ? 'bg-danger' : w.available <= Math.max(1, Math.round(w.total * 0.2)) ? 'bg-warning' : 'bg-success'
                  const textColor = w.available === 0 ? 'text-danger' : w.available <= Math.max(1, Math.round(w.total * 0.2)) ? 'text-brand-amber-strong' : 'text-success'
                  return (
                    <div key={w.ward} className="flex items-center gap-2">
                      <span className="text-xs text-foreground-muted flex-1 truncate">{w.ward}</span>
                      <div className="h-1.5 w-14 rounded-full bg-surface-sunken overflow-hidden flex-shrink-0">
                        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={cn("text-xs font-bold w-5 text-right flex-shrink-0 tabular-nums", textColor)}>{w.available}</span>
                    </div>
                  )
                })}
              </div>
              <Link href="/doctor/beds" className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-primary-dark transition-colors">
                View full board <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {dialogView}

      {/* ── Patient Queue (left slide-out) ── */}
      <SideDrawer open={showQueue} onClose={() => setShowQueue(false)} side="left" title="Today's Queue" icon={Users} badge={queue.length}>
        <div className="px-4 py-3 space-y-2">
          {queue.map((p, i) => (
            <QueueEntry key={p.id} patient={p} selected={currentPatient?.id === p.id} onClick={() => openPatient(p)} delay={i * 0.04} />
          ))}
          {queue.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center bg-success-bg">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-semibold text-foreground-lighter">Queue cleared</p>
            </div>
          )}
        </div>
      </SideDrawer>

      {/* ── AI Pre-Consultation Brief drawer ── */}
      <SideDrawer
        open={activeDrawer === 'brief' && !!currentPatient}
        onClose={() => setActiveDrawer(null)}
        title="AI Pre-Consultation Brief" icon={Sparkles} width="lg"
      >
        <div className="p-5">
          {currentPatient && <AiPreBrief patient={currentPatient} />}
        </div>
      </SideDrawer>

      {/* ── Medical History drawer ── */}
      <SideDrawer
        open={activeDrawer === 'history' && !!currentPatient}
        onClose={() => setActiveDrawer(null)}
        title="Medical History" icon={FileText} width="lg"
      >
        {currentPatient && (
          <div className="p-5 space-y-4">
            <div className="ai-card p-3.5">
              <p className="t-overline text-accent flex items-center gap-1 mb-1"><Sparkles className="h-3 w-3" aria-hidden="true" /> AI brief</p>
              <p className="text-[13px] font-medium leading-snug text-accent">{historyBrief(currentPatient)}</p>
            </div>
            <div>
              <p className="t-overline text-foreground-lighter mb-2">Past medical history</p>
              <div className="space-y-1.5">
                {currentPatient.history.length ? currentPatient.history.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5"><div className="h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 bg-accent" /><p className="text-sm font-medium text-foreground-muted">{h}</p></div>
                )) : <p className="text-sm italic text-foreground-lighter">No significant history</p>}
              </div>
            </div>
            <div>
              <p className="t-overline text-foreground-lighter mb-2">Past visits ({patientVisits.length})</p>
              {patientVisits.length ? patientVisits.map(v => (
                <div key={v.id} className="rounded-xl p-3 mb-1.5 bg-surface-sunken">
                  <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-foreground">{v.diagnosis}</p><span className="text-xs text-foreground-lighter">{new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                  <p className="text-xs mt-0.5 text-foreground-lighter">{v.doctor} · {v.prescriptions.map(p => p.medicine).join(', ') || 'no meds'}</p>
                </div>
              )) : <p className="text-sm italic text-foreground-lighter">No prior visits on record</p>}
            </div>
          </div>
        )}
      </SideDrawer>

      {/* ── Lab tests drawer ── */}
      <SideDrawer open={activeDrawer === 'lab' && !!currentPatient} onClose={() => setActiveDrawer(null)} title="Order Lab Tests" icon={FlaskConical} badge={labOrders.length}>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <Select aria-label="Lab test" value={labTest} onChange={e => setLabTest(e.target.value)} className={selectStyle} style={selectInlineStyle}>
              <option value="">Select test...</option>
              {LAB_TESTS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select aria-label="Lab priority" value={labPriority} onChange={e => setLabPriority(e.target.value as 'Routine' | 'Urgent')} className={cn(selectStyle, "w-24")} style={selectInlineStyle}>
              <option>Routine</option>
              <option>Urgent</option>
            </Select>
            <Button size="sm" variant="secondary" aria-label="Add lab test" disabled={!labTest || !currentPatient} onClick={() => { dispatchLabOrder(labTest, labPriority); setLabTest("") }}>
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <AnimatePresence>
            {labOrders.map(order => (
              <motion.div key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="flex items-center justify-between p-3 rounded-xl bg-accent-soft">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">{order.testName}</span>
                  <NeonBadge variant={order.priority === 'Urgent' ? 'danger' : 'muted'} className="text-[10px]">{order.priority}</NeonBadge>
                  {order.sentToLab && <NeonBadge variant="success" className="text-[10px]">Sent</NeonBadge>}
                </div>
                {!order.sentToLab && (
                  <button onClick={() => removeLabOrder(order.id)} aria-label={`Remove ${order.testName}`} className="tap p-1 rounded cursor-pointer text-foreground-placeholder hover:text-danger">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {labOrders.length === 0 && (
            <p className="text-sm font-medium italic text-center py-8 text-foreground-lighter">No lab orders yet</p>
          )}
        </div>
      </SideDrawer>

      {/* ── Radiology drawer ── */}
      <SideDrawer open={activeDrawer === 'radiology' && !!currentPatient} onClose={() => setActiveDrawer(null)} title="Order Radiology Scan" icon={ScanLine} badge={radiologyOrders.length}>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select aria-label="Scan type" value={radScanType} onChange={e => setRadScanType(e.target.value as 'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound')} className={selectStyle} style={selectInlineStyle}>
              <option>X-Ray</option><option>MRI</option><option>CT Scan</option><option>Ultrasound</option>
            </Select>
            <Select aria-label="Body part" value={radBodyPart} onChange={e => setRadBodyPart(e.target.value)} className={selectStyle} style={selectInlineStyle}>
              <option value="">Body part...</option>
              {BODY_PARTS.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Select aria-label="Scan priority" value={radPriority} onChange={e => setRadPriority(e.target.value as 'Routine' | 'Urgent')} className={cn(selectStyle, "w-28")} style={selectInlineStyle}>
              <option>Routine</option><option>Urgent</option>
            </Select>
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => {
              if (!radBodyPart) return
              dispatchRadOrder(radScanType, radBodyPart, radPriority)
              setRadBodyPart("")
            }}>
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Add Scan
            </Button>
          </div>
          <AnimatePresence>
            {radiologyOrders.map(order => (
              <motion.div key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="flex items-center justify-between p-3 rounded-xl bg-accent-soft">
                <div className="flex items-center gap-2">
                  <ScanLine className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">{order.scanType} — {order.bodyPart}</span>
                  <NeonBadge variant={order.priority === 'Urgent' ? 'danger' : 'muted'} className="text-[10px]">{order.priority}</NeonBadge>
                  {order.sentToRadiology && <NeonBadge variant="success" className="text-[10px]">Sent</NeonBadge>}
                </div>
                {!order.sentToRadiology && (
                  <button onClick={() => removeRadiologyOrder(order.id)} aria-label={`Remove ${order.scanType} ${order.bodyPart}`} className="tap p-1 rounded cursor-pointer text-foreground-placeholder hover:text-danger">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {radiologyOrders.length === 0 && (
            <p className="text-sm font-medium italic text-center py-8 text-foreground-lighter">No radiology orders yet</p>
          )}
        </div>
      </SideDrawer>

      {/* ── Referral drawer ── */}
      <SideDrawer open={activeDrawer === 'referral' && !!currentPatient} onClose={() => setActiveDrawer(null)} title="Refer to Specialist" icon={GitBranch} badge={referrals.length}>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <Select aria-label="Specialty" value={refSpecialty} onChange={e => setRefSpecialty(e.target.value)} className={cn(selectStyle, "flex-1")} style={selectInlineStyle}>
              <option value="">Select specialty...</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={refUrgent} onChange={e => setRefUrgent(e.target.checked)} className="rounded" />
              <span className="text-xs font-semibold text-danger">Urgent</span>
            </label>
          </div>
          <div className="relative">
            <textarea
              aria-label="Referral notes"
              value={refNotes}
              onChange={e => setRefNotes(e.target.value)}
              placeholder={refListening ? "Listening…" : "Referral notes for specialist..."}
              rows={3}
              className={selectStyle}
              style={{ ...selectInlineStyle, resize: 'none', paddingRight: '2.5rem' }}
            />
            {speechOk && (
              <button
                type="button"
                aria-label={refListening ? "Stop voice input" : "Dictate referral notes"}
                aria-pressed={refListening}
                onClick={() => {
                  if (refListening) { refRecRef.current?.stop(); return }
                  const base = refNotes.trim()
                  refRecRef.current = startVoiceCommand({
                    onPartial: t => setRefNotes(base ? base + ' ' + t : t),
                    onFinal: t => setRefNotes(base ? base + ' ' + t : t),
                    onEnd: () => { setRefListening(false); refRecRef.current = null },
                    onError: (err) => {
                      setRefListening(false); refRecRef.current = null
                      if (err === 'not-allowed') toast.error('Microphone permission denied — allow it in browser settings')
                      else if (err !== 'no-speech') toast.error('Voice input failed — please try again')
                    },
                  })
                  if (refRecRef.current) setRefListening(true)
                  else toast.error('Could not start voice input — check microphone permissions')
                }}
                className={cn(
                  "absolute right-2 top-2 h-7 w-7 rounded-full flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  refListening ? "bg-primary text-white animate-pulse" : "bg-accent-soft text-accent hover:brightness-95"
                )}
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <Button size="sm" variant="secondary" className="gap-2" onClick={() => {
            if (!refSpecialty) return
            addReferral({ specialty: refSpecialty, notes: refNotes, urgent: refUrgent })
            toast.success(`Referral to ${refSpecialty} recorded`)
            setRefSpecialty(""); setRefNotes(""); setRefUrgent(false)
          }}>
            <ArrowRight className="h-4 w-4" /> Add Referral
          </Button>
          <AnimatePresence>
            {referrals.map(ref => (
              <motion.div key={ref.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="flex items-center justify-between p-3 rounded-xl bg-accent-soft">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
                  <span className="text-sm font-medium text-foreground">{ref.specialty}</span>
                  {ref.urgent && <NeonBadge variant="danger" className="text-[10px]">Urgent</NeonBadge>}
                </div>
                <button onClick={() => removeReferral(ref.id)} aria-label={`Remove referral to ${ref.specialty}`} className="tap p-1 rounded cursor-pointer text-foreground-placeholder hover:text-danger">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SideDrawer>

      {/* ── Admit patient drawer ── */}
      <SideDrawer
        open={activeDrawer === 'admit' && !!currentPatient}
        onClose={() => setActiveDrawer(null)}
        title="Admission Card" icon={Bed} tone="danger" width="lg"
        footer={admissionOrder?.sent ? undefined : (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setActiveDrawer(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1 gap-2" onClick={handleSendAdmission}>
              <Send className="h-4 w-4" /> Send to Bed Manager
            </Button>
          </div>
        )}
      >
        {admissionOrder?.sent ? (
          <div className="p-5">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-success-bg">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-success-strong">Admission Card Sent to Bed Manager</p>
                <p className="text-xs text-success mt-0.5">{admissionOrder.admissionType} · {admissionOrder.reason}</p>
                <p className="text-xs text-success mt-0.5">{prescriptions.length} Rx · {labOrders.length} lab · {radiologyOrders.length} radiology orders bundled</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs font-medium text-foreground-lighter">{currentPatient?.name} · {currentPatient?.id}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="adm-ward" className="block t-overline text-foreground-lighter mb-1.5">Ward Type</label>
                <Select id="adm-ward" value={admType} onChange={e => setAdmType(e.target.value as typeof admType)} className={selectStyle} style={selectInlineStyle}>
                  <option>General Ward</option><option>ICU</option><option>Private Room</option><option>Semi-Private</option><option>Day Care</option>
                </Select>
              </div>
              <div>
                <label htmlFor="adm-urgency" className="block t-overline text-foreground-lighter mb-1.5">Urgency</label>
                <Select id="adm-urgency" value={admUrgency} onChange={e => setAdmUrgency(e.target.value as typeof admUrgency)} className={selectStyle} style={selectInlineStyle}>
                  <option>Routine</option><option>Urgent</option><option>Emergency</option>
                </Select>
              </div>
            </div>
            <div className={cn("flex items-center justify-between rounded-xl px-3.5 py-2.5", wardFree > 0 ? "bg-success-bg" : "bg-warning-bg")}>
              <span className={cn("text-[13px] font-semibold flex items-center gap-1.5", wardFree > 0 ? "text-success" : "text-brand-amber-strong")}>
                <Bed className="h-4 w-4" aria-hidden="true" />
                {wardFree > 0 ? `${wardFree} of ${wardTotal} ${admType} bed${wardFree !== 1 ? 's' : ''} free at this branch` : `No ${admType} beds free at this branch`}
              </span>
              <Link href="/doctor/beds" className="text-xs font-bold text-accent hover:text-primary-dark flex items-center gap-1 flex-shrink-0">
                {wardFree > 0 ? 'View beds' : 'Other branches'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div>
              <label htmlFor="adm-reason" className="block t-overline text-foreground-lighter mb-1.5">Reason for Admission</label>
              <Input id="adm-reason" placeholder="E.g. Post-PCI monitoring, IV therapy required..." value={admReason} onChange={e => setAdmReason(e.target.value)} className="bg-surface-sunken" />
            </div>
            <div>
              <label htmlFor="adm-allergies" className="block t-overline text-foreground-lighter mb-1.5">Allergies</label>
              <Input id="adm-allergies" placeholder="E.g. Penicillin, sulpha drugs..." value={admAllergies} onChange={e => setAdmAllergies(e.target.value)} className="bg-surface-sunken" />
            </div>
            <div>
              <label htmlFor="adm-comorbidities" className="block t-overline text-foreground-lighter mb-1.5">Co-morbidities</label>
              <Input id="adm-comorbidities" placeholder="E.g. Hypertension, T2 Diabetes, CKD..." value={admComorbidities} onChange={e => setAdmComorbidities(e.target.value)} className="bg-surface-sunken" />
            </div>
            <div>
              <label htmlFor="adm-instructions" className="block t-overline text-foreground-lighter mb-1.5">Special Instructions for Ward</label>
              <textarea
                id="adm-instructions"
                className="w-full rounded-xl px-4 py-3 text-sm text-foreground bg-surface-sunken border border-border placeholder:text-foreground-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-border-focus resize-none"
                placeholder="E.g. Continuous cardiac monitoring, NPO, isolation precautions..."
                rows={2}
                value={admSpecialInstructions}
                onChange={e => setAdmSpecialInstructions(e.target.value)}
              />
            </div>
            <div className="rounded-xl p-4 space-y-2 bg-surface-sunken border border-border">
              <p className="t-overline text-foreground-lighter">Documents to be bundled</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{prescriptions.length} prescription(s) · {labOrders.length} lab order(s) · {radiologyOrders.length} radiology order(s)</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>Diagnosis: {diagnosis || '(not set)'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  <span>All documents auto-sent to Bed Manager</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  )
}
