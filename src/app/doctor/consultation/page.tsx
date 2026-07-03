"use client"

/* M9-F — Doctor consultation workspace.
 *
 * Replaces the prior redirect-only page. Provides a focused workspace for
 * the current OPD encounter: patient strip + SOAP note (auto-saved) +
 * quick-orders rail (Rx · Lab · Imaging · Refer). Each action wires
 * through to existing stores and emits notifyAndAudit handoffs to the
 * next role.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Stethoscope, Pill, FlaskConical, ScanLine, ArrowLeft, Save, Sparkles, FileText, Send, Plus, X, Activity, AlertTriangle, Bed, Printer, Utensils, CalendarClock } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useJourneyStore } from "@/store/useJourneyStore"
import { LAB_CATALOG } from "@/lib/labCatalog"
import { RADIOLOGY_CATALOG } from "@/lib/radiologyCatalog"
import { Select } from "@/components/ui/Select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { printableHtml } from "@/lib/fileIO"
import { news2FromRecord, vitalsAnomalies } from "@/lib/vitals"
import { cn } from "@/lib/utils"

interface RxMed { name: string; dosage: string; frequency: string; duration: string; quantity: string }
const EMPTY_MED: RxMed = { name: '', dosage: '', frequency: '', duration: '', quantity: '' }
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const LAB_OPTIONS = Object.values(LAB_CATALOG).map(e => ({ code: e.code, name: e.name }))
const IMAGING_OPTIONS = Object.values(RADIOLOGY_CATALOG).map(e => ({ code: e.code, name: e.name }))
const REFERRAL_SPECIALTIES = ["Cardiology", "Orthopaedics", "Neurology", "Gastroenterology", "Nephrology", "Pulmonology", "Dermatology", "ENT", "Ophthalmology", "Psychiatry", "General Surgery", "Oncology"]
const ADMIT_WARDS = ["General Ward", "ICU", "Private Room", "Semi-Private", "Day Care"]

interface SoapDraft { subjective: string; objective: string; assessment: string; plan: string }
const EMPTY: SoapDraft = { subjective: '', objective: '', assessment: '', plan: '' }
const LS = (patientId: string) => `agentix.doctor.soap.${patientId}`

function loadSoap(patientId: string): SoapDraft {
  if (typeof window === 'undefined') return EMPTY
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(LS(patientId)) ?? '{}') as Partial<SoapDraft>) } } catch { return EMPTY }
}
function saveSoap(patientId: string, s: SoapDraft) {
  try { localStorage.setItem(LS(patientId), JSON.stringify(s)) } catch { /* ignore */ }
}

export default function DoctorConsultation() {
  const router = useRouter()
  const currentUser = useAuthStore(s => s.currentUser)
  const patients = usePatientStore(s => s.patients)
  // Pick the first consulting / vitals patient as the "active" encounter.
  const active = useMemo(() =>
    patients.find(p => p.queueStatus === 'consulting') ??
    patients.find(p => p.queueStatus === 'vitals') ??
    patients[0],
  [patients])

  const addLabOrder = useLabOrdersStore(s => s.addOrder)
  const addPrescription = usePharmacyStore(s => s.addPrescription)
  const updateStatus = usePatientStore(s => s.updateStatus)
  const addImagingOrder = useRadiologyStudiesStore(s => s.addOrder)
  const addReferral = useConsultationStore(s => s.addReferral)
  const requestAdmission = useAdmissionStore(s => s.requestAdmission)
  const journeyTransition = useJourneyStore(s => s.transition)

  const [soap, setSoap] = useState<SoapDraft>(EMPTY)
  const [hydrated, setHydrated] = useState(false)
  // Lab tests selected for the current encounter (catalog codes).
  const [labTests, setLabTests] = useState<string[]>([])
  const [labPick, setLabPick] = useState("")
  // Imaging studies selected for the current encounter (radiology catalog codes).
  const [imagingStudies, setImagingStudies] = useState<string[]>([])
  const [imagingPick, setImagingPick] = useState("")
  // Referral + admission drafts.
  const [referSpecialty, setReferSpecialty] = useState("")
  const [admitWard, setAdmitWard] = useState("General Ward")
  // Track whether an Rx was dispatched so "Complete consultation" routes to pharmacy vs billing.
  const [sentRx, setSentRx] = useState(false)
  // Prescription — medicines + diet/follow-up/imaging advice for the printout.
  const [meds, setMeds] = useState<RxMed[]>([])
  const [medDraft, setMedDraft] = useState<RxMed>(EMPTY_MED)
  const [diet, setDiet] = useState("")
  const [followUp, setFollowUp] = useState("")
  const [imagingAdvice, setImagingAdvice] = useState("")
  // Hydrate the SOAP draft and reset the encounter baskets whenever the patient changes.
  useEffect(() => {
    if (active) { setSoap(loadSoap(active.id)); setHydrated(true) }
    setLabTests([]); setLabPick("")
    setImagingStudies([]); setImagingPick(""); setReferSpecialty(""); setAdmitWard("General Ward"); setSentRx(false)
    setMeds([]); setMedDraft(EMPTY_MED); setDiet(""); setFollowUp(""); setImagingAdvice("")
  }, [active?.id])

  if (!active) {
    return (
      <div className="max-w-4xl mx-auto pt-10 text-center">
        <Stethoscope className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-slate-700">No active patient.</p>
        <p className="text-[12.5px] text-slate-500 mt-1">Pick a patient from the queue to start a consultation.</p>
        <button onClick={() => router.push('/doctor/dashboard')} className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C2481A] hover:bg-[#9A3A14] text-white text-[12.5px] font-semibold cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </button>
      </div>
    )
  }

  function persist(next: SoapDraft) {
    setSoap(next)
    if (active) saveSoap(active.id, next)
  }

  function signNote() {
    if (!active) return
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'low',
      title: `Note signed · ${active.name}`,
      body: `Doctor has signed the OPD note. Plan: ${soap.plan || 'see chart'}.`,
      patientName: active.name,
      audit: { action: 'prescription_create', resource: 'consultation_note', resourceId: active.id, detail: `SOAP signed for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`SOAP note signed for ${active.name} · nurse notified`)
  }

  const addMed = () => {
    if (!medDraft.name.trim()) { toast.error('Enter a medicine name'); return }
    setMeds(m => [...m, medDraft])
    setMedDraft(EMPTY_MED)
  }
  const removeMed = (i: number) => setMeds(m => m.filter((_, idx) => idx !== i))

  function orderRx() {
    if (!active) return
    if (meds.length === 0) { toast.error('Add at least one medicine to the prescription'); return }
    // Persist a real prescription so it lands in the Pharmacy queue.
    addPrescription({
      id: `RX-${Date.now()}`,
      patientId: active.id,
      patientName: active.name,
      tokenNumber: active.token,
      doctorName: currentUser?.name ?? active.doctor ?? 'Doctor',
      department: active.department,
      source: 'OPD',
      paymentMode: 'Cash',
      medicines: meds.map(m => ({
        name: m.name.trim(),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
        quantity: parseInt(m.quantity) || 1,
      })),
      status: 'queued',
      dispatchedAt: new Date().toISOString(),
      estimatedReadyIn: 15,
      notes: diet.trim() ? `Diet: ${diet.trim()}` : undefined,
    })
    notifyAndAudit({
      to: 'pharmacy', type: 'medicines_ready', priority: 'high',
      title: `New Rx · ${active.name}`,
      body: `Doctor prescribed ${meds.length} medicine(s) for ${active.name}: ${meds.map(m => m.name.trim()).join(', ')}. Begin dispense workflow.`,
      patientName: active.name,
      audit: { action: 'prescription_create', resource: 'consultation', resourceId: active.id, detail: `Rx (${meds.length} item(s)) ordered for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    setSentRx(true)
    toast.success(`Rx sent · pharmacy notified`, { description: `${meds.length} medicine(s)` })
  }

  function printRx() {
    if (!active) return
    if (meds.length === 0 && !diet.trim() && !followUp.trim() && !imagingAdvice.trim()) {
      toast.error('Nothing to print yet — add medicines or advice')
      return
    }
    const doctor = currentUser?.name ?? active.doctor ?? 'Doctor'
    const medRows = meds.length
      ? meds.map((m, i) => `<tr><td>${i + 1}</td><td><b>${escapeHtml(m.name || '—')}</b></td><td>${escapeHtml(m.dosage || '—')}</td><td>${escapeHtml(m.frequency || '—')}</td><td>${escapeHtml(m.duration || '—')}</td><td style="text-align:right">${escapeHtml(m.quantity || '—')}</td></tr>`).join('')
      : `<tr><td colspan="6" class="muted">No medicines prescribed.</td></tr>`
    const radiology = [imagingAdvice.trim(), ...labTests.map(c => LAB_CATALOG[c]?.name ?? c)].filter(Boolean)
    printableHtml(`Prescription · ${active.name}`, `
      <div class="info-row">
        <div class="info-item"><span class="info-label">Patient</span><span class="info-value">${escapeHtml(active.name)}</span></div>
        <div class="info-item"><span class="info-label">UHID / ID</span><span class="info-value">${escapeHtml(active.uhid ?? active.id)}</span></div>
        <div class="info-item"><span class="info-label">Age / Sex</span><span class="info-value">${active.age}y · ${active.gender}</span></div>
        <div class="info-item"><span class="info-label">Department</span><span class="info-value">${escapeHtml(active.department)}</span></div>
        <div class="info-item"><span class="info-label">Physician</span><span class="info-value">${escapeHtml(doctor)}</span></div>
      </div>
      ${soap.assessment.trim() ? `<h3>Diagnosis / Assessment</h3><p>${escapeHtml(soap.assessment.trim())}</p>` : ''}
      <h3>&#8478; Medicines</h3>
      <table><thead><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th style="text-align:right">Qty</th></tr></thead><tbody>${medRows}</tbody></table>
      ${diet.trim() ? `<h3>Food / Diet advice</h3><p>${escapeHtml(diet.trim())}</p>` : ''}
      ${radiology.length ? `<h3>Radiology / Investigations</h3><ul>${radiology.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
      ${followUp.trim() ? `<h3>Follow-up</h3><p>${escapeHtml(followUp.trim())}</p>` : ''}
      <p class="muted" style="margin-top:24px">Signed by ${escapeHtml(doctor)} · ${active.department}</p>
    `)
    notifyAndAudit({
      to: 'audit_officer', type: 'system', priority: 'low',
      title: `Prescription printed · ${active.name}`,
      body: `${doctor} printed a prescription for ${active.name} (${meds.length} medicine(s)).`,
      patientName: active.name,
      audit: { action: 'prescription_create', resource: 'prescription_print', resourceId: active.id, detail: `Prescription printed for ${active.name}`, userName: doctor },
    })
  }
  const addLabTest = () => {
    if (!labPick || labTests.includes(labPick)) return
    setLabTests(t => [...t, labPick])
    setLabPick("")
  }
  const removeLabTest = (code: string) => setLabTests(t => t.filter(c => c !== code))

  function orderLab() {
    if (!active) return
    if (labTests.length === 0) { toast.error('Select at least one test to order'); return }
    // Persist a real lab order so it lands in the Laboratory queue (awaiting collection).
    addLabOrder({
      patientId: active.id,
      patientName: active.name,
      source: 'OPD',
      doctorName: currentUser?.name ?? active.doctor ?? 'Doctor',
      paymentMode: 'Cash',
      testCodes: labTests,
    })
    notifyAndAudit({
      to: 'lab', type: 'system', priority: 'medium',
      title: `Lab order · ${active.name}`,
      body: `Doctor ordered ${labTests.length} test(s) for ${active.name}: ${labTests.map(c => LAB_CATALOG[c]?.name ?? c).join(', ')}. Assessment: ${soap.assessment || soap.plan || '—'}.`,
      patientName: active.name,
      audit: { action: 'lab_order', resource: 'consultation', resourceId: active.id, detail: `Lab ordered for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    journeyTransition(active.id, 'LAB_ORDERED', currentUser?.id ?? 'doctor', currentUser?.name ?? 'Doctor')
    toast.success(`${labTests.length} lab test(s) sent to Laboratory`)
    setLabTests([])
  }

  const addImagingStudy = () => {
    if (!imagingPick || imagingStudies.includes(imagingPick)) return
    setImagingStudies(s => [...s, imagingPick])
    setImagingPick("")
  }
  const removeImagingStudy = (code: string) => setImagingStudies(s => s.filter(c => c !== code))

  function orderImaging() {
    if (!active) return
    if (imagingStudies.length === 0) { toast.error('Select at least one imaging study to order'); return }
    // Persist real radiology studies so they land in the Radiology queue (status 'ordered').
    for (const code of imagingStudies) {
      addImagingOrder({
        patientId: active.id,
        patientName: active.name,
        source: 'OPD',
        doctorName: currentUser?.name ?? active.doctor ?? 'Doctor',
        paymentMode: 'Cash',
        code,
        clinicalQuestion: soap.assessment || soap.plan || undefined,
        priority: active.triageLevel === 'Critical' ? 'STAT' : active.triageLevel === 'High' ? 'Urgent' : 'Routine',
      })
    }
    notifyAndAudit({
      to: 'radiology', type: 'system', priority: 'medium',
      title: `Imaging order · ${active.name}`,
      body: `Doctor ordered ${imagingStudies.length} study(ies) for ${active.name}: ${imagingStudies.map(c => RADIOLOGY_CATALOG[c]?.name ?? c).join(', ')}. ${soap.assessment ? `Clinical question: ${soap.assessment}.` : ''}`,
      patientName: active.name,
      audit: { action: 'radiology_order', resource: 'consultation', resourceId: active.id, detail: `Imaging ordered for ${active.name}`, userName: currentUser?.name ?? 'Doctor' },
    })
    journeyTransition(active.id, 'RADIOLOGY_ORDERED', currentUser?.id ?? 'doctor', currentUser?.name ?? 'Doctor')
    toast.success(`${imagingStudies.length} imaging study(ies) sent to Radiology`)
    setImagingStudies([])
  }

  function refer() {
    if (!active) return
    if (!referSpecialty) { toast.error('Choose a specialty to refer to'); return }
    // Persist a real referral so it lands in the specialist referral inbox.
    addReferral({
      patientId: active.id,
      patientName: active.name,
      fromDepartment: active.department,
      specialty: referSpecialty,
      notes: soap.assessment || soap.plan || '',
      urgent: active.triageLevel === 'Critical' || active.triageLevel === 'High',
    })
    notifyAndAudit({
      to: 'reception', type: 'appointment', priority: 'medium',
      title: `Referral · ${active.name}`,
      body: `Doctor referred ${active.name} to ${referSpecialty}. Awaiting acceptance in the referral inbox.`,
      patientName: active.name,
      audit: { action: 'reception_registered', resource: 'referral', resourceId: active.id, detail: `Referral for ${active.name} → ${referSpecialty}`, userName: currentUser?.name ?? 'Doctor' },
    })
    toast.success(`Referral to ${referSpecialty} logged`)
    setReferSpecialty("")
  }

  function admit() {
    if (!active) return
    // Create a real admission request so it lands in the bed-manager admission queue.
    requestAdmission({
      patientId: active.id,
      patientName: active.name,
      patientAge: active.age,
      patientGender: active.gender,
      diagnosis: soap.assessment || soap.plan || 'See consultation note',
      admissionType: admitWard,
      bedTypePreference: admitWard,
      reason: soap.plan || soap.assessment || 'Admission advised at consultation',
      requestedBy: currentUser?.name ?? active.doctor ?? 'Doctor',
      department: active.department,
      triageLevel: active.triageLevel,
      payerType: active.insurer ? 'Insurance' : 'Cash',
    })
    notifyAndAudit({
      to: 'bed_manager', type: 'system', priority: active.triageLevel === 'Critical' ? 'critical' : 'high',
      title: `Admission request · ${active.name}`,
      body: `Doctor requested ${admitWard} admission for ${active.name} (${active.department}). Assign a bed.`,
      patientName: active.name,
      audit: { action: 'reception_registered', resource: 'admission_request', resourceId: active.id, detail: `Admission requested for ${active.name} · ${admitWard}`, userName: currentUser?.name ?? 'Doctor' },
    })
    // Leave the OPD queue and enter the IPD journey (override the COMPLETED sync from 'done').
    updateStatus(active.id, 'done')
    journeyTransition(active.id, 'ADMITTED_IPD', currentUser?.id ?? 'doctor', currentUser?.name ?? 'Doctor')
    toast.success(`Admission requested · ${admitWard} · bed manager notified`)
  }

  function completeConsultation() {
    if (!active) return
    const next = sentRx ? 'pharmacy' : 'billing'
    updateStatus(active.id, next)
    toast.success(`Consultation complete · ${active.name} sent to ${next === 'pharmacy' ? 'Pharmacy' : 'Billing'}`)
  }

  if (!hydrated) return null

  // Vitals — prefer the comprehensive OPD VitalsRecord (nurse M2 form), fall back
  // to simple string vitals from intake, or show a "not recorded" warning.
  const opdV = active.opdVitals ?? null
  const simpleV = active.vitals ?? null
  const news2 = opdV ? news2FromRecord(opdV) : null
  const anomalies = opdV ? vitalsAnomalies(opdV) : []

  const vitalsTimeAgo = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.round(mins / 60)}h ago`
  }

  // Build an array of vital chips for the comprehensive record.
  const opdChips = opdV ? [
    { label: 'HR', value: opdV.hr != null ? `${opdV.hr} bpm` : '—', crit: opdV.hr != null && (opdV.hr < 50 || opdV.hr > 110), warn: opdV.hr != null && (opdV.hr < 60 || opdV.hr > 100) },
    { label: 'BP', value: opdV.systolicBP != null ? `${opdV.systolicBP}/${opdV.diastolicBP ?? '?'} mmHg` : '—', crit: opdV.systolicBP != null && (opdV.systolicBP < 90 || opdV.systolicBP >= 180), warn: opdV.systolicBP != null && (opdV.systolicBP >= 140 || opdV.systolicBP < 100) },
    { label: 'RR', value: opdV.rr != null ? `${opdV.rr} /min` : '—', crit: opdV.rr != null && (opdV.rr < 8 || opdV.rr >= 30), warn: opdV.rr != null && (opdV.rr <= 11 || opdV.rr >= 25) },
    { label: 'SpO₂', value: opdV.spo2 != null ? `${opdV.spo2}%` : '—', crit: opdV.spo2 != null && opdV.spo2 < 92, warn: opdV.spo2 != null && opdV.spo2 < 95 },
    { label: 'Temp', value: opdV.temp != null ? `${opdV.temp}°F` : '—', crit: opdV.temp != null && (opdV.temp < 95 || opdV.temp >= 104), warn: opdV.temp != null && opdV.temp >= 100.4 },
    ...(opdV.pain != null ? [{ label: 'Pain', value: `${opdV.pain}/10`, crit: false, warn: opdV.pain >= 7 }] : []),
    ...(opdV.bloodGlucose != null ? [{ label: 'Glucose', value: `${opdV.bloodGlucose} mg/dL`, crit: opdV.bloodGlucose < 54 || opdV.bloodGlucose > 400, warn: opdV.bloodGlucose < 70 || opdV.bloodGlucose > 300 }] : []),
    ...(opdV.weight != null ? [{ label: 'Weight', value: `${opdV.weight} kg`, crit: false, warn: false }] : []),
    ...(opdV.consciousness != null ? [{ label: 'AVPU', value: opdV.consciousness === 'A' ? 'Alert' : opdV.consciousness === 'V' ? 'Voice' : opdV.consciousness === 'P' ? 'Pain' : 'Unresponsive', crit: opdV.consciousness !== 'A', warn: false }] : []),
  ] : []

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-4">
      {/* Patient header */}
      <div className="flex items-center gap-3 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
        <button onClick={() => router.push('/doctor/dashboard')} aria-label="Back" className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>
        <span className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#C2481A] to-[#EE6B26] flex items-center justify-center text-white text-[15px] font-bold">
          {active.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-slate-900">{active.name}</p>
          <p className="text-[12px] text-slate-500">{active.id} · {active.age}y · {active.gender} · {active.department}</p>
          {active.symptoms?.length ? <p className="text-[11.5px] text-slate-600 mt-0.5">Chief complaint: <b>{active.symptoms.join(', ')}</b></p> : null}
        </div>
        <span className="text-[10.5px] font-semibold text-[#B84A16] bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] rounded-full px-2 py-0.5 inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> AI scribe ready
        </span>
      </div>

      {/* ── Vitals strip ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#B84A16]" />
            <h3 className="text-[14px] font-semibold text-slate-900">Patient Vitals</h3>
            {opdV?.at && (
              <span className="text-[10.5px] text-slate-400">
                recorded {vitalsTimeAgo(opdV.at)} · by {opdV.by}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {active.triageLevel && (
              <span className={cn(
                "text-[10.5px] font-bold px-2 py-0.5 rounded-full border",
                active.triageLevel === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' :
                active.triageLevel === 'High'     ? 'bg-primary-soft text-accent border-primary/20' :
                active.triageLevel === 'Medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}>
                Triage: {active.triageLevel}
              </span>
            )}
            {news2 && (
              <span className={cn(
                "text-[10.5px] font-bold px-2 py-0.5 rounded-full border",
                news2.band === 'high'   ? 'bg-red-50 text-red-700 border-red-200' :
                news2.band === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                          'bg-emerald-50 text-emerald-700 border-emerald-200'
              )}>
                NEWS2 {news2.score} · {news2.band === 'high' ? 'High' : news2.band === 'medium' ? 'Medium' : 'Low'} risk
              </span>
            )}
          </div>
        </div>

        {/* No vitals recorded yet */}
        {!opdV && !simpleV && (
          <div className="flex items-center gap-2 text-[12.5px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Vitals not yet recorded — patient may still be in the vitals check stage.
          </div>
        )}

        {/* Comprehensive OPD vitals (VitalsRecord from nurse M2 form) */}
        {opdV && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {opdChips.map(chip => (
                <div key={chip.label} className={cn(
                  "rounded-lg p-2 text-center",
                  chip.crit ? 'bg-red-50 ring-1 ring-red-200' :
                  chip.warn ? 'bg-amber-50 ring-1 ring-amber-200' :
                              'bg-slate-50'
                )}>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">{chip.label}</p>
                  <p className={cn(
                    "text-[13px] font-bold leading-tight",
                    chip.crit ? 'text-red-700' :
                    chip.warn ? 'text-amber-700' :
                                'text-slate-900'
                  )}>{chip.value}</p>
                </div>
              ))}
            </div>
            {anomalies.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {anomalies.map((a, i) => (
                  <span key={i} className={cn(
                    "inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full",
                    a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    <AlertTriangle className="h-3 w-3" /> {a.label}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {/* Simple intake vitals (bp / temp / weight / spo2 / pulse strings) */}
        {simpleV && !opdV && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[
              { label: 'BP', value: simpleV.bp },
              { label: 'Pulse', value: simpleV.pulse },
              { label: 'SpO₂', value: simpleV.spo2 },
              { label: 'Temp', value: simpleV.temp },
              { label: 'Weight', value: simpleV.weight },
            ].map(chip => (
              <div key={chip.label} className="rounded-lg p-2 text-center bg-slate-50">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">{chip.label}</p>
                <p className="text-[13px] font-bold text-slate-900 leading-tight">{chip.value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SOAP note */}
        <div className="lg:col-span-2 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#B84A16]" />
            <h3 className="text-[14px] font-semibold text-slate-900">SOAP note</h3>
            <span className="ml-auto text-[10.5px] text-slate-400">auto-saves as you type</span>
          </div>
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => (
            <div key={k}>
              <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{k}</label>
              <textarea value={soap[k]} onChange={(e) => persist({ ...soap, [k]: e.target.value })}
                rows={k === 'plan' ? 3 : 2}
                placeholder={k === 'subjective' ? 'Patient reports…' : k === 'objective' ? 'On examination…' : k === 'assessment' ? 'Most likely…' : 'Plan: Rx, labs, follow-up, red-flag advice…'}
                className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] focus:outline-none focus:ring-[#EE6B26] resize-none" />
            </div>
          ))}
          <button onClick={signNote} className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C2481A] hover:bg-[#9A3A14] text-white text-[13.5px] font-semibold cursor-pointer">
            <Save className="h-4 w-4" /> Sign &amp; save SOAP
          </button>
        </div>

        {/* Quick-orders rail */}
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 space-y-2">
          <h3 className="text-[14px] font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#B84A16]" /> Quick orders
          </h3>
          <div className="rounded-lg bg-rose-50 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-800">
              <FlaskConical className="h-4 w-4" /> Order labs
            </div>
            <div className="flex gap-1.5">
              <Select value={labPick} onChange={e => setLabPick(e.target.value)} className="flex-1 h-8 rounded-lg border border-rose-200 bg-white text-[12px] px-2 text-slate-700">
                <option value="">Select test…</option>
                {LAB_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              </Select>
              <button onClick={addLabTest} aria-label="Add test" className="h-8 w-8 flex-shrink-0 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 flex items-center justify-center cursor-pointer">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {labTests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labTests.map(code => (
                  <span key={code} className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-800 bg-white border border-rose-200 rounded-full pl-2.5 pr-1.5 py-0.5">
                    {LAB_CATALOG[code]?.name ?? code}
                    <button onClick={() => removeLabTest(code)} aria-label={`Remove ${code}`} className="hover:text-rose-600 cursor-pointer"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <button onClick={orderLab} disabled={labTests.length === 0} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-[12.5px] font-semibold cursor-pointer">
              <Send className="h-3.5 w-3.5" /> Send {labTests.length > 0 ? `${labTests.length} ` : ''}to Laboratory
            </button>
          </div>
          {/* Order imaging */}
          <div className="rounded-lg bg-[rgba(238,107,38,0.06)] p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#B84A16]">
              <ScanLine className="h-4 w-4" /> Order imaging
            </div>
            <div className="flex gap-1.5">
              <Select value={imagingPick} onChange={e => setImagingPick(e.target.value)} className="flex-1 h-8 rounded-lg border border-[rgba(238,107,38,0.25)] bg-white text-[12px] px-2 text-slate-700">
                <option value="">Select study…</option>
                {IMAGING_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              </Select>
              <button onClick={addImagingStudy} aria-label="Add study" className="h-8 w-8 flex-shrink-0 rounded-lg bg-[rgba(238,107,38,0.14)] hover:bg-[rgba(238,107,38,0.22)] text-[#B84A16] flex items-center justify-center cursor-pointer">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {imagingStudies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {imagingStudies.map(code => (
                  <span key={code} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B84A16] bg-white border border-[rgba(238,107,38,0.25)] rounded-full pl-2.5 pr-1.5 py-0.5">
                    {RADIOLOGY_CATALOG[code]?.name ?? code}
                    <button onClick={() => removeImagingStudy(code)} aria-label={`Remove ${code}`} className="hover:text-[#9A3A14] cursor-pointer"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <button onClick={orderImaging} disabled={imagingStudies.length === 0} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#C2481A] hover:bg-[#9A3A14] disabled:opacity-50 text-white text-[12.5px] font-semibold cursor-pointer">
              <Send className="h-3.5 w-3.5" /> Send {imagingStudies.length > 0 ? `${imagingStudies.length} ` : ''}to Radiology
            </button>
          </div>

          {/* Refer to specialist */}
          <div className="rounded-lg bg-amber-50 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800">
              <Send className="h-4 w-4" /> Refer to specialist
            </div>
            <div className="flex gap-1.5">
              <Select value={referSpecialty} onChange={e => setReferSpecialty(e.target.value)} className="flex-1 h-8 rounded-lg border border-amber-200 bg-white text-[12px] px-2 text-slate-700">
                <option value="">Select specialty…</option>
                {REFERRAL_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <button onClick={refer} disabled={!referSpecialty} aria-label="Send referral" className="h-8 px-2.5 flex-shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white flex items-center justify-center cursor-pointer">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Admit */}
          <div className="rounded-lg bg-slate-50 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700">
              <Bed className="h-4 w-4" /> Admit patient
            </div>
            <div className="flex gap-1.5">
              <Select value={admitWard} onChange={e => setAdmitWard(e.target.value)} className="flex-1 h-8 rounded-lg border border-slate-200 bg-white text-[12px] px-2 text-slate-700">
                {ADMIT_WARDS.map(w => <option key={w} value={w}>{w}</option>)}
              </Select>
              <button onClick={admit} aria-label="Request admission" className="h-8 px-2.5 flex-shrink-0 rounded-lg bg-slate-700 hover:bg-slate-800 text-white flex items-center justify-center cursor-pointer">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={() => router.push('/doctor/beds')} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11.5px] font-semibold cursor-pointer">
              Check bed availability
            </button>
          </div>

          <button onClick={completeConsultation} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold cursor-pointer mt-1">
            <Send className="h-4 w-4" /> Complete consultation
          </button>
          <p className="text-[10.5px] text-slate-400 mt-1.5">Each action is audited and routes the patient onward; the right role is notified.</p>
        </div>
      </div>

      {/* Prescription — medicines + diet/follow-up/imaging, with print + dispatch. */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-[#B84A16]" />
          <h3 className="text-[14px] font-semibold text-slate-900">Prescription</h3>
          <span className="ml-auto text-[10.5px] text-slate-400">{meds.length} medicine{meds.length === 1 ? '' : 's'}</span>
        </div>

        {/* Medicine entry row */}
        <div className="grid grid-cols-12 gap-1.5">
          <Input value={medDraft.name} onChange={e => setMedDraft(d => ({ ...d, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addMed() }} placeholder="Medicine" className="col-span-4 h-9 rounded-lg text-[12.5px]" />
          <Input value={medDraft.dosage} onChange={e => setMedDraft(d => ({ ...d, dosage: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addMed() }} placeholder="Dosage" className="col-span-2 h-9 rounded-lg text-[12.5px]" />
          <Input value={medDraft.frequency} onChange={e => setMedDraft(d => ({ ...d, frequency: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addMed() }} placeholder="Frequency" className="col-span-2 h-9 rounded-lg text-[12.5px]" />
          <Input value={medDraft.duration} onChange={e => setMedDraft(d => ({ ...d, duration: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addMed() }} placeholder="Duration" className="col-span-2 h-9 rounded-lg text-[12.5px]" />
          <Input value={medDraft.quantity} onChange={e => setMedDraft(d => ({ ...d, quantity: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addMed() }} placeholder="Qty" inputMode="numeric" className="col-span-1 h-9 rounded-lg text-[12.5px]" />
          <button onClick={addMed} aria-label="Add medicine" className="col-span-1 h-9 rounded-lg bg-[#C2481A] hover:bg-[#9A3A14] text-white flex items-center justify-center cursor-pointer"><Plus className="h-4 w-4" /></button>
        </div>

        {meds.length > 0 && (
          <div className="rounded-lg ring-1 ring-slate-100 divide-y divide-slate-100">
            {meds.map((m, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                <span className="font-semibold text-slate-900 flex-1">{m.name}</span>
                <span className="text-slate-500">{[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ') || '—'}</span>
                {m.quantity && <span className="text-slate-400">×{m.quantity}</span>}
                <button onClick={() => removeMed(i)} aria-label={`Remove ${m.name}`} className="text-slate-300 hover:text-rose-500 cursor-pointer"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1"><Utensils className="h-3 w-3" /> Food / diet advice</label>
            <textarea value={diet} onChange={e => setDiet(e.target.value)} rows={2} placeholder="e.g. Low salt, avoid oily food, plenty of fluids" className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-[#EE6B26] resize-none" />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1"><ScanLine className="h-3 w-3" /> Radiology / imaging advice</label>
            <textarea value={imagingAdvice} onChange={e => setImagingAdvice(e.target.value)} rows={2} placeholder="e.g. CT Brain plain, USG whole abdomen" className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-[#EE6B26] resize-none" />
          </div>
          <div>
            <label className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mb-1"><CalendarClock className="h-3 w-3" /> Follow-up</label>
            <Input value={followUp} onChange={e => setFollowUp(e.target.value)} placeholder="e.g. Review after 5 days" className="h-9 rounded-lg text-[12.5px]" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={orderRx} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C2481A] hover:bg-[#9A3A14] text-white text-[13px] font-semibold cursor-pointer">
            <Send className="h-4 w-4" /> Send Rx to pharmacy
          </button>
          <button onClick={printRx} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-semibold cursor-pointer">
            <Printer className="h-4 w-4" /> Print prescription
          </button>
        </div>
      </div>
    </div>
  )
}
