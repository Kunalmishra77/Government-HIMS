"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  ScanLine, Upload, PencilLine, Fingerprint, ShieldCheck, IdCard, CheckCircle2,
  ArrowLeft, ArrowRight, Printer, Sparkles, Activity, UserPlus, Stethoscope,
  Loader2, RefreshCw, BadgeCheck, MapPin, Phone, Mail, Calendar, User, Camera,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/Select"
import { Avatar } from "@/components/ui/avatar"
import { AbhaCard, type AbhaCardData } from "@/components/abha/AbhaCard"
import { cn } from "@/lib/utils"
import { usePatientStore, type TriageLevel } from "@/store/usePatientStore"
import { usePatientProfileStore, emptyProfile } from "@/store/usePatientProfileStore"
import { useJourneyStore } from "@/store/useJourneyStore"
import { useAuditStore } from "@/store/useAuditStore"
import { doctorsForDept, firstDoctorOf, suggestTriage } from "@/lib/opd"
import { generateUhid, findUhidByAbha } from "@/lib/intake/register"
import { printableHtml } from "@/lib/fileIO"
import {
  extractAadhaarFromQr, parseAadhaarUpload, sendAadhaarOtp, verifyAadhaarOtp,
  fetchAadhaarDemographics, detectAbha, createAbha,
  type AadhaarDemographics, type AbhaProfile, type Gender,
} from "@/lib/intake/aadhaar-mock"

const DEPARTMENTS = ["General Medicine", "Cardiology", "Orthopaedics", "Gynaecology", "Paediatrics", "Dermatology", "ENT", "Ophthalmology"]
const TRIAGE_LEVELS: TriageLevel[] = ["Low", "Medium", "High", "Critical"]
const VISIT_TYPES = ["New consultation", "Follow-up", "Referral", "Review"]
const DEPT_KEY: Record<string, string> = {
  "General Medicine": "deptGeneralMedicine", "Cardiology": "deptCardiology", "Orthopaedics": "deptOrthopaedics",
  "Gynaecology": "deptGynaecology", "Paediatrics": "deptPaediatrics", "Dermatology": "deptDermatology",
  "ENT": "deptENT", "Ophthalmology": "deptOphthalmology",
}
const TRIAGE_KEY: Record<string, string> = { Low: "triageLow", Medium: "triageMedium", High: "triageHigh", Critical: "triageCritical" }
const VISIT_KEY: Record<string, string> = {
  "New consultation": "visitNewConsultation", "Follow-up": "visitFollowUp", "Referral": "visitReferral", "Review": "visitReview",
}
const GENDER_KEY: Record<string, string> = { Male: "genderMale", Female: "genderFemale", Other: "genderOther" }

type Stage = "method" | "otp" | "detect" | "profile" | "details" | "review" | "done"
type Method = "scan" | "upload" | "manual"

type RegForm = {
  name: string; fathersName: string; age: string; gender: Gender; phone: string; email: string
  address: string; city: string; district: string; state: string; pincode: string
  department: string; doctor: string; visitType: string; triage: TriageLevel; symptoms: string
  emergencyName: string; emergencyRelation: string; emergencyPhone: string
}

const EMPTY_FORM: RegForm = {
  name: "", fathersName: "", age: "", gender: "Male", phone: "", email: "",
  address: "", city: "", district: "", state: "", pincode: "",
  department: "General Medicine", doctor: firstDoctorOf("General Medicine"), visitType: "New consultation", triage: "Low", symptoms: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "",
}

export default function RegisterPatientPage() {
  const t = useTranslations('reception')
  const { addPatient, updateStatus } = usePatientStore()
  const journeyAdd = useJourneyStore((s) => s.addPatient)
  const saveProfile = usePatientProfileStore((s) => s.saveProfile)
  const audit = useAuditStore((s) => s.log)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>("method")
  const [method, setMethod] = useState<Method | null>(null)
  const [busy, setBusy] = useState(false)

  const [aadhaar, setAadhaar] = useState("")
  const [manualAadhaar, setManualAadhaar] = useState("")
  const [maskedMobile, setMaskedMobile] = useState("")
  const [otpRef, setOtpRef] = useState("")
  const [otp, setOtp] = useState("")

  const [aadhaarVerified, setAadhaarVerified] = useState(false)
  const [detectedExists, setDetectedExists] = useState(false)
  const [detectedProfile, setDetectedProfile] = useState<AbhaProfile | null>(null)
  const [abha, setAbha] = useState<AbhaProfile | null>(null)
  const [uhid, setUhid] = useState("")
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)

  const [form, setForm] = useState<RegForm>(EMPTY_FORM)
  const [result, setResult] = useState<{ id: string; token: number; sentToVitals: boolean } | null>(null)

  const isManual = method === "manual"
  const MACRO = isManual
    ? [t('register.macroIdentity'), t('register.macroDetails'), t('register.macroReview')]
    : [t('register.macroIdentity'), t('register.macroAbha'), t('register.macroDetails'), t('register.macroReview')]
  const macroIdx = (() => {
    if (stage === "method" || stage === "otp") return 0
    if (stage === "detect" || stage === "profile") return 1
    if (stage === "details") return isManual ? 1 : 2
    if (stage === "review") return isManual ? 2 : 3
    return MACRO.length
  })()

  const suggestion = suggestTriage(form.symptoms)
  const set = (patch: Partial<RegForm>) => setForm((f) => ({ ...f, ...patch }))

  // ── Identity capture ──────────────────────────────────────────────────────
  function beginOtp(rawAadhaar: string) {
    setAadhaar(rawAadhaar)
    const { demoCode, maskedMobile } = sendAadhaarOtp(rawAadhaar)
    setOtpRef(demoCode); setMaskedMobile(maskedMobile); setOtp(""); setStage("otp")
    toast.info(t('register.otpSentToast', { mobile: maskedMobile }), { description: t('register.otpDemoCode', { code: demoCode }) })
    audit({ action: "reception_registered", resource: "aadhaar_otp", detail: `Aadhaar OTP dispatched to ${maskedMobile}.`, userId: "user", userName: "Reception" })
  }

  async function chooseMethod(m: Method) {
    setMethod(m)
    if (m === "manual") { setForm(EMPTY_FORM); setStage("details"); return }
    setBusy(true)
    await new Promise((r) => setTimeout(r, 800))
    const { maskedAadhaar } = m === "scan" ? extractAadhaarFromQr() : parseAadhaarUpload()
    setBusy(false)
    audit({ action: "reception_registered", resource: m === "scan" ? "aadhaar_scan" : "aadhaar_upload", detail: `Aadhaar ${m === "scan" ? "QR scanned" : "uploaded"} → ${maskedAadhaar}.`, userId: "user", userName: "Reception" })
    beginOtp(maskedAadhaar)
  }

  function captureManualAadhaar() {
    const digits = manualAadhaar.replace(/\D/g, "")
    if (digits.length !== 12) { toast.error(t('register.enterValidAadhaar')); return }
    setMethod("scan"); beginOtp(digits)
  }

  function resendOtp() {
    const { demoCode, maskedMobile } = sendAadhaarOtp(aadhaar)
    setOtpRef(demoCode); setMaskedMobile(maskedMobile); setOtp("")
    toast.info(t('register.otpResentToast', { mobile: maskedMobile }), { description: t('register.otpDemoCode', { code: demoCode }) })
  }

  async function verifyOtp() {
    if (!verifyAadhaarOtp(otp, otpRef)) { toast.error(t('register.incorrectOtp')); return }
    setBusy(true)
    await new Promise((r) => setTimeout(r, 600))
    const demo = fetchAadhaarDemographics(aadhaar)
    const detected = detectAbha(aadhaar)
    setBusy(false)
    setAadhaarVerified(true)
    prefillFromDemographics(demo)
    setDetectedExists(detected.exists)
    setDetectedProfile(detected.profile ?? null)
    toast.success(t('register.aadhaarVerifiedToast'), { description: t('register.aadhaarVerifiedDesc', { name: demo.name }) })
    audit({ action: "reception_registered", resource: "aadhaar_otp", detail: `Aadhaar verified for ${demo.name}.`, userId: "user", userName: "Reception" })
    setStage("detect")
  }

  function prefillFromDemographics(d: AadhaarDemographics) {
    set({
      name: d.name, fathersName: d.fathersName ?? "", age: String(d.age), gender: d.gender, phone: d.phone, email: d.email ?? "",
      address: d.address, city: d.city, district: d.district, state: d.state, pincode: d.pincode,
    })
    if (d.photo) setPhotoUrl(d.photo)
  }

  function genUhid(abhaNumber: string) {
    const u = findUhidByAbha(abhaNumber) || generateUhid(usePatientStore.getState().patients)
    setUhid(u)
    return u
  }

  function continueExisting() {
    if (!detectedProfile) return
    setAbha(detectedProfile)
    genUhid(detectedProfile.abhaNumber)
    setStage("profile")
  }

  async function createNewAbha() {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 900))
    const created = createAbha()
    setBusy(false)
    setAbha(created); setDetectedExists(false)
    genUhid(created.abhaNumber)
    toast.success(t('register.abhaCreatedToast'), { description: created.abhaNumber })
    audit({ action: "reception_registered", resource: "abha_create", detail: `New ABHA ${created.abhaNumber} created for ${form.name}.`, userId: "user", userName: "Reception" })
    setStage("profile")
  }

  function onPhoto(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === "string") setPhotoUrl(reader.result) }
    reader.readAsDataURL(file)
  }

  function gotoReview() {
    if (!form.name.trim()) { toast.error(t('register.enterPatientName')); return }
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ""))) { toast.error(t('register.enterValidPhone')); return }
    setStage("review")
  }

  const abhaCardData = (): AbhaCardData => ({
    name: form.name,
    fathersName: form.fathersName || undefined,
    abhaNumber: abha?.abhaNumber ?? "",
    abhaAddress: abha?.abhaAddress ?? "",
    gender: form.gender,
    dob: fmtDob(aadhaar),
    mobile: form.phone,
    address: form.address || undefined,
    district: form.district || undefined,
    state: form.state || undefined,
    pincode: form.pincode || undefined,
    aadhaarVerified,
    photoUrl,
  })

  // ── Print ─────────────────────────────────────────────────────────────────
  function printAbhaCard() {
    if (!abha) return
    const body = `
      <div class="info-row">
        <div class="info-item"><div class="info-label">${t('register.slipAbhaNumber')}</div><div class="info-value">${abha.abhaNumber}</div></div>
        <div class="info-item"><div class="info-label">${t('register.slipAbhaAddress')}</div><div class="info-value">${abha.abhaAddress}</div></div>
      </div>
      <h3>${t('register.slipPersonalInformation')}</h3>
      <table><tbody>
        ${row(t('register.slipFullName'), form.name)}
        ${row(t('register.slipFathersName'), form.fathersName || "—")}
        ${row(t('register.slipMobile'), form.phone)}
        ${row(t('register.slipGender'), t(`register.${GENDER_KEY[form.gender]}`))}
        ${row(t('register.slipEmail'), form.email || "—")}
      </tbody></table>
      <h3>${t('register.slipAddressInformation')}</h3>
      <table><tbody>
        ${row(t('register.slipAddress'), form.address || "—")}
        ${row(t('register.slipCity'), form.city || "—")}
        ${row(t('register.slipDistrict'), form.district || "—")}
        ${row(t('register.slipState'), form.state || "—")}
        ${row(t('register.slipPinCode'), form.pincode || "—")}
      </tbody></table>`
    printableHtml(t('register.slipTitleAbhaCard'), body)
  }

  function printSlip() {
    const body = `
      <div class="info-row">
        <div class="info-item"><div class="info-label">${t('register.slipUhid')}</div><div class="info-value">${uhid || t('register.slipUhidPending')}</div></div>
        <div class="info-item"><div class="info-label">${t('register.slipPatient')}</div><div class="info-value">${form.name}</div></div>
        <div class="info-item"><div class="info-label">${t('register.slipAbha')}</div><div class="info-value">${abha?.abhaNumber ?? t('register.slipAbhaNotLinked')}</div></div>
      </div>
      <h3>${t('register.slipPatientDetails')}</h3>
      <table><tbody>
        ${row(t('register.slipName'), form.name)}
        ${row(t('register.slipAgeGender'), `${form.age || "—"} / ${t(`register.${GENDER_KEY[form.gender]}`)}`)}
        ${row(t('register.slipMobile'), form.phone)}
        ${row(t('register.slipAbhaAddress'), abha?.abhaAddress ?? "—")}
        ${row(t('register.slipAddress'), `${form.address || "—"}${form.pincode ? ` — ${form.pincode}` : ""}`)}
      </tbody></table>
      <h3>${t('register.slipVisit')}</h3>
      <table><tbody>
        ${row(t('register.slipDepartment'), t(`register.${DEPT_KEY[form.department]}`))}
        ${row(t('register.slipDoctor'), form.doctor)}
        ${row(t('register.slipVisitType'), t(`register.${VISIT_KEY[form.visitType]}`))}
        ${row(t('register.slipPriority'), t(`register.${TRIAGE_KEY[form.triage]}`))}
        ${row(t('register.slipChiefComplaint'), form.symptoms || "—")}
        ${row(t('register.slipRegistered'), new Date().toLocaleString("en-IN"))}
      </tbody></table>
      <p style="margin-top:14px" class="muted">${t('register.slipProceed')}</p>`
    printableHtml(t('register.slipTitleRegistration'), body)
  }

  // ── Add to queue ──────────────────────────────────────────────────────────
  // addPatient is async — it awaits the real backend Patients.create/Visits.create
  // calls (Phase 2) before stamping `visitId` onto the local patient record.
  // updateStatus's reception→vitals bridge only mirrors into the real `visits`
  // row when it finds that `visitId` (see usePatientStore.ts). Firing
  // updateStatus without awaiting addPatient first raced ahead of that stamp
  // every time, so the real visit stayed stuck at 'waiting' even though the
  // local queue (and this screen) showed "sent to Vitals" — the nurse's later
  // real advance-to-consulting then silently no-opped against RLS. Awaiting
  // addPatient here closes that race.
  async function addToQueue(sendToVitals: boolean) {
    setBusy(true)
    try {
      await addToQueueImpl(sendToVitals)
    } finally {
      setBusy(false)
    }
  }

  async function addToQueueImpl(sendToVitals: boolean) {
    const id = `PT-${Date.now()}`
    const finalUhid = uhid || generateUhid(usePatientStore.getState().patients)
    if (!uhid) setUhid(finalUhid)
    await addPatient({
      id,
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, "").slice(-10),
      age: parseInt(form.age) || 30,
      gender: form.gender,
      symptoms: form.symptoms.trim() ? [form.symptoms.trim()] : [],
      department: form.department,
      doctor: form.doctor,
      triageLevel: form.triage,
      visitTypes: [form.visitType],
      source: "walk_in",
      uhid: finalUhid || undefined,
      abhaId: abha?.abhaNumber,
      aadhaarVerified: aadhaarVerified || undefined,
      photoUrl,
    })
    // addPatient's real-backend bridge retries with a freshly bumped
    // candidate on a concurrent UHID collision (writeWithUhidRetry in
    // src/lib/intake/register.ts) — vanishingly rare for a single reception
    // desk, but if it happened the patient record now reflects the real,
    // persisted UHID, which may differ from `finalUhid` computed above.
    // Reconcile so this screen's display/print/profile-link never drifts
    // from what's actually in Postgres.
    const settledUhid = usePatientStore.getState().patients.find((p) => p.id === id)?.uhid ?? finalUhid
    if (settledUhid !== uhid) setUhid(settledUhid)
    if (settledUhid) {
      saveProfile(id, {
        ...emptyProfile(), uhid: settledUhid, abhaId: abha?.abhaNumber,
        address: form.address, city: form.city, pincode: form.pincode,
        emergencyName: form.emergencyName || undefined,
        emergencyRelation: form.emergencyRelation || undefined,
        emergencyPhone: form.emergencyPhone || undefined,
      }, "Reception")
    }
    journeyAdd(id, form.name.trim(), form.doctor)
    const token = usePatientStore.getState().patients.find((p) => p.id === id)?.token ?? 0
    if (sendToVitals) await updateStatus(id, "vitals")
    toast.success(t('register.addedToQueueToast', { name: form.name.trim() }), { description: sendToVitals ? t('register.addedSentToVitals', { token }) : t('register.addedWaiting', { token }) })
    setResult({ id, token, sentToVitals: sendToVitals })
    setStage("done")
  }

  function restart() {
    setStage("method"); setMethod(null); setAadhaar(""); setManualAadhaar(""); setOtp("")
    setAadhaarVerified(false); setDetectedExists(false); setDetectedProfile(null); setAbha(null)
    setUhid(""); setPhotoUrl(undefined); setForm(EMPTY_FORM); setResult(null)
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <PageHeader
        title={t('register.title')}
        subtitle={t('register.subtitle')}
      />

      {/* Progress indicator */}
      <ol className="flex items-center gap-2 mb-6" aria-label={t('register.progressLabel')}>
        {MACRO.map((label, i) => (
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none" aria-current={i === macroIdx ? "step" : undefined}>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold transition",
              i === macroIdx ? "bg-[var(--color-primary)] text-white"
                : i < macroIdx ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
            )}>
              <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[11px]", i === macroIdx ? "bg-white/20" : i < macroIdx ? "bg-emerald-200/60" : "bg-white")}>
                {i < macroIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {label}
            </div>
            {i < MACRO.length - 1 && <span className={cn("h-px flex-1", i < macroIdx ? "bg-emerald-300" : "bg-slate-200")} />}
          </li>
        ))}
      </ol>

      {/* ── Stage: Method ── */}
      {stage === "method" && (
        <div className="space-y-4">
          <p className="text-[13px] text-slate-500">{t('register.methodPrompt')}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <MethodCard icon={ScanLine} title={t('register.methodScanTitle')} desc={t('register.methodScanDesc')} recommendedLabel={t('register.recommended')} recommended busy={busy} onClick={() => chooseMethod("scan")} />
            <MethodCard icon={Upload} title={t('register.methodUploadTitle')} desc={t('register.methodUploadDesc')} recommendedLabel={t('register.recommended')} recommended busy={busy} onClick={() => chooseMethod("upload")} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <IdCard className="h-4 w-4 text-[var(--color-accent)]" />
              <p className="text-[12.5px] font-bold text-slate-700">{t('register.enterAadhaarManually')}</p>
            </div>
            <div className="flex gap-2">
              <Input value={manualAadhaar} onChange={(e) => setManualAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder={t('register.aadhaarPlaceholder')} inputMode="numeric" aria-label={t('register.aadhaarAriaLabel')} className="h-10 rounded-xl tracking-widest" />
              <Button onClick={captureManualAadhaar} className="h-10 px-4 rounded-xl gap-1.5"><ArrowRight className="h-4 w-4" /> {t('register.sendOtp')}</Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">{t('register.noAadhaar')}</span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>
          <button onClick={() => chooseMethod("manual")}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-slate-300 text-[13px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition">
            <PencilLine className="h-4 w-4" /> {t('register.manualRegistration')}
          </button>
        </div>
      )}

      {/* ── Stage: OTP ── */}
      {stage === "otp" && (
        <Panel icon={Fingerprint} title={t('register.verifyAadhaarOtp')}>
          <div className="flex items-center gap-2 rounded-xl bg-[rgba(238,107,38,0.05)] px-3 py-2">
            <IdCard className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-[12.5px] text-slate-700">{t('register.aadhaarOtpInfo', { aadhaar, mobile: maskedMobile })}</p>
          </div>
          <label htmlFor="reg-otp" className="block text-[12.5px] font-semibold text-slate-700">{t('register.enterOtp')}</label>
          <div className="flex gap-2">
            <Input id="reg-otp" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") verifyOtp() }} placeholder={t('register.otpPlaceholder')} inputMode="numeric" autoFocus className="h-11 rounded-xl tracking-[0.3em] font-bold" />
            <Button onClick={verifyOtp} disabled={busy || otp.length !== 6} className="h-11 px-5 rounded-xl gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {t('register.verify')}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={resendOtp} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)] hover:underline"><RefreshCw className="h-3 w-3" /> {t('register.resendOtp')}</button>
            <button onClick={() => setStage("method")} className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-600">{t('register.changeMethod')}</button>
          </div>
        </Panel>
      )}

      {/* ── Stage: ABHA Detection ── */}
      {stage === "detect" && (
        <Panel icon={ShieldCheck} title={t('register.abhaAccount')}>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-[12px] font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> {t('register.aadhaarVerifiedUidai')}
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className={cn("px-4 py-2.5 flex items-center gap-2 text-[12px] font-bold", detectedExists ? "bg-[rgba(238,107,38,0.08)] text-[var(--color-primary-dark)]" : "bg-amber-50 text-amber-800")}>
              <BadgeCheck className="h-4 w-4" />
              {detectedExists ? t('register.existingAbhaFound') : t('register.noAbhaLinked')}
            </div>
            <div className="p-4 grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
              <ReadRow icon={User} label={t('register.fieldName')} value={form.name} />
              <ReadRow icon={User} label={t('register.fieldGender')} value={t(`register.${GENDER_KEY[form.gender]}`)} />
              <ReadRow icon={Calendar} label={t('register.fieldDob')} value={fmtDob(aadhaar)} />
              <ReadRow icon={Phone} label={t('register.fieldMobile')} value={maskedMobile} />
              {form.email && <ReadRow icon={Mail} label={t('register.fieldEmail')} value={form.email} />}
              {detectedExists && detectedProfile && <ReadRow icon={IdCard} label={t('register.fieldAbhaNumber')} value={detectedProfile.abhaNumber} mono />}
              {detectedExists && detectedProfile && <ReadRow icon={IdCard} label={t('register.fieldAbhaAddress')} value={detectedProfile.abhaAddress} mono />}
              <ReadRow icon={MapPin} label={t('register.fieldStateDistrict')} value={`${form.state || "—"} / ${form.district || "—"}`} />
              <ReadRow icon={MapPin} label={t('register.fieldAddress')} value={`${form.address || "—"}${form.pincode ? ` — ${form.pincode}` : ""}`} className="sm:col-span-2" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={() => setStage("otp")} className="h-11 rounded-xl gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
            <div className="flex-1" />
            {detectedExists ? (
              <>
                <Button variant="outline" onClick={createNewAbha} disabled={busy} className="h-11 rounded-xl">{t('register.createNewAbha')}</Button>
                <Button onClick={continueExisting} className="h-11 rounded-xl gap-1.5"><ArrowRight className="h-4 w-4" /> {t('register.continueExistingAbha')}</Button>
              </>
            ) : (
              <Button onClick={createNewAbha} disabled={busy} className="h-11 rounded-xl gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {t('register.createAbhaAccount')}
              </Button>
            )}
          </div>
        </Panel>
      )}

      {/* ── Stage: ABHA Profile ── */}
      {stage === "profile" && abha && (
        <Panel icon={IdCard} title={t('register.abhaProfileCard')}>
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-surface-sunken px-5 py-4 flex items-center gap-4">
              {photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoUrl} alt={form.name} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white shadow" />
              ) : <Avatar name={form.name} size="lg" className="h-16 w-16 text-lg ring-2 ring-white shadow" />}
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-slate-900">{form.name}</p>
                <p className="text-[12.5px] font-mono text-[var(--color-primary-dark)]">{abha.abhaNumber}</p>
                <p className="text-[12px] font-mono text-slate-500">{abha.abhaAddress}</p>
                <span className={cn("inline-flex items-center gap-1 mt-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full", detectedExists ? "bg-emerald-100 text-emerald-700" : "bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]")}>
                  <BadgeCheck className="h-3 w-3" /> {detectedExists ? t('register.existingAbha') : t('register.newlyCreatedAbha')}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <Section title={t('register.personalInformation')}>
                <ReadRow icon={User} label={t('register.fieldFullName')} value={form.name} />
                {form.fathersName && <ReadRow icon={User} label={t('register.fieldFathersName')} value={form.fathersName} />}
                <ReadRow icon={Phone} label={t('register.fieldMobile')} value={form.phone} />
                <ReadRow icon={User} label={t('register.fieldGender')} value={t(`register.${GENDER_KEY[form.gender]}`)} />
                <ReadRow icon={Calendar} label={t('register.fieldDob')} value={fmtDob(aadhaar)} />
                {form.email && <ReadRow icon={Mail} label={t('register.fieldEmail')} value={form.email} />}
                <ReadRow icon={ShieldCheck} label={t('register.fieldAadhaar')} value={aadhaarVerified ? t('register.verified') : t('register.notVerified')} />
              </Section>
              <Section title={t('register.addressInformation')}>
                <ReadRow icon={MapPin} label={t('register.fieldState')} value={form.state || "—"} />
                <ReadRow icon={MapPin} label={t('register.fieldDistrict')} value={form.district || "—"} />
                <ReadRow icon={MapPin} label={t('register.fieldCity')} value={form.city || "—"} />
                <ReadRow icon={MapPin} label={t('register.fieldPincode')} value={form.pincode || "—"} />
                <ReadRow icon={MapPin} label={t('register.fieldAddress')} value={form.address || "—"} className="sm:col-span-2" />
              </Section>
            </div>
          </div>

          <div className="rounded-xl bg-[rgba(238,107,38,0.05)] border border-[rgba(238,107,38,0.15)] px-3 py-2 flex items-center gap-2 text-[12px] text-[var(--color-primary-dark)]">
            <Sparkles className="h-3.5 w-3.5" /> {t('register.uhidGenerated', { uhid })}
          </div>

          {/* Official-style ABHA card */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{t('register.abhaCard')}</p>
            <AbhaCard data={abhaCardData()} showBack={false} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStage("detect")} className="h-11 rounded-xl gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
            <Button variant="outline" onClick={printAbhaCard} className="h-11 rounded-xl gap-1.5"><Printer className="h-4 w-4" /> {t('register.printAbhaCard')}</Button>
            <div className="flex-1" />
            <Button onClick={() => setStage("details")} className="h-11 rounded-xl gap-1.5"><ArrowRight className="h-4 w-4" /> {t('register.continueRegistration')}</Button>
          </div>
        </Panel>
      )}

      {/* ── Stage: Details ── */}
      {stage === "details" && (
        <Panel icon={Stethoscope} title={t('register.completeRegistration')}>
          {!isManual ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /><span>{uhid ? t('register.demographicsVerifiedUhid', { uhid }) : t('register.demographicsVerified')}</span>
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-500">{t('register.enterManually')}</p>
          )}

          {/* Demographics */}
          <FieldGrid>
            <Field label={t('register.labelFullName')} required><Input value={form.name} onChange={(e) => set({ name: e.target.value })} className="h-10 rounded-xl" /></Field>
            <Field label={t('register.labelFathersName')}><Input value={form.fathersName} onChange={(e) => set({ fathersName: e.target.value })} className="h-10 rounded-xl" /></Field>
            <Field label={t('register.labelPhone')} required><Input type="tel" maxLength={10} value={form.phone} onChange={(e) => set({ phone: e.target.value })} className="h-10 rounded-xl" /></Field>
            <Field label={t('register.labelAge')}><Input type="number" min={1} max={120} value={form.age} onChange={(e) => set({ age: e.target.value })} className="h-10 rounded-xl" /></Field>
            <Field label={t('register.labelGender')}>
              <Select value={form.gender} onChange={(e) => set({ gender: e.target.value as Gender })} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {(["Male", "Female", "Other"] as const).map((g) => <option key={g} value={g}>{t(`register.${GENDER_KEY[g]}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('register.labelAddress')} className="sm:col-span-2"><Input value={form.address} onChange={(e) => set({ address: e.target.value })} className="h-10 rounded-xl" /></Field>
            <Field label={t('register.labelCity')}><Input value={form.city} onChange={(e) => set({ city: e.target.value })} className="h-10 rounded-xl" /></Field>
            <Field label={t('register.labelPincode')}><Input value={form.pincode} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} className="h-10 rounded-xl" /></Field>
          </FieldGrid>

          {/* Patient photo */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoUrl} alt={form.name || "Patient"} className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : <Avatar name={form.name || t('register.slipPatient')} className="h-12 w-12" />}
            <div className="flex-1">
              <p className="text-[12.5px] font-bold text-slate-700">{t('register.patientPhoto')}</p>
              <p className="text-[11px] text-slate-400">{t('register.patientPhotoDesc')}</p>
            </div>
            <Button variant="outline" onClick={() => photoInputRef.current?.click()} className="h-9 rounded-lg gap-1.5"><Camera className="h-4 w-4" /> {photoUrl ? t('register.changePhoto') : t('register.addPhoto')}</Button>
            <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.currentTarget.value = "" }} />
          </div>

          {/* Chief complaint + AI triage */}
          <Field label={t('register.labelChiefComplaint')}><Input value={form.symptoms} onChange={(e) => set({ symptoms: e.target.value })} placeholder={t('register.chiefComplaintPlaceholder')} className="h-10 rounded-xl" /></Field>
          {suggestion && form.symptoms.trim() && (
            <div className="rounded-xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-3">
              <div className="flex items-center gap-1.5 mb-1"><Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" /><span className="text-[12px] font-bold text-[var(--color-primary-dark)]">{t('register.aiTriageSuggestion')}</span></div>
              <p className="text-[12px] text-[var(--color-primary-dark)]">{t('register.aiTriageText', { triage: t(`register.${TRIAGE_KEY[suggestion.triage]}`), department: DEPT_KEY[suggestion.department] ? t(`register.${DEPT_KEY[suggestion.department]}`) : suggestion.department, reason: suggestion.reason })}</p>
              {(form.triage !== suggestion.triage || form.department !== suggestion.department) && (
                <button onClick={() => set({ triage: suggestion.triage, department: suggestion.department, doctor: firstDoctorOf(suggestion.department) })}
                  className="mt-2 text-[12px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] rounded-lg px-3 py-1.5 transition">{t('register.applySuggestion')}</button>
              )}
            </div>
          )}

          {/* Visit details */}
          <FieldGrid>
            <Field label={t('register.labelDepartment')}>
              <Select value={form.department} onChange={(e) => set({ department: e.target.value, doctor: firstDoctorOf(e.target.value) })} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{t(`register.${DEPT_KEY[d]}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('register.labelDoctorRoom')}>
              <Select value={form.doctor} onChange={(e) => set({ doctor: e.target.value })} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {doctorsForDept(form.department).length === 0
                  ? <option value="Dr. Priya Nair">Dr. Priya Nair</option>
                  : doctorsForDept(form.department).map((r) => <option key={r.doctor} value={r.doctor}>{r.doctor} · {r.room}</option>)}
              </Select>
            </Field>
            <Field label={t('register.labelVisitType')}>
              <Select value={form.visitType} onChange={(e) => set({ visitType: e.target.value })} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {VISIT_TYPES.map((v) => <option key={v} value={v}>{t(`register.${VISIT_KEY[v]}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('register.labelPriority')}>
              <Select value={form.triage} onChange={(e) => set({ triage: e.target.value as TriageLevel })} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                {TRIAGE_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{t(`register.${TRIAGE_KEY[lvl]}`)}</option>)}
              </Select>
            </Field>
          </FieldGrid>

          {/* Emergency contact */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{t('register.emergencyContact')}</p>
            <FieldGrid>
              <Field label={t('register.labelName')}><Input value={form.emergencyName} onChange={(e) => set({ emergencyName: e.target.value })} className="h-10 rounded-xl" /></Field>
              <Field label={t('register.labelRelation')}><Input value={form.emergencyRelation} onChange={(e) => set({ emergencyRelation: e.target.value })} className="h-10 rounded-xl" /></Field>
              <Field label={t('register.labelPhone')}><Input type="tel" maxLength={10} value={form.emergencyPhone} onChange={(e) => set({ emergencyPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })} className="h-10 rounded-xl" /></Field>
            </FieldGrid>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={() => setStage(isManual ? "method" : "profile")} className="h-11 rounded-xl gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
            <Button onClick={gotoReview} className="flex-1 h-11 rounded-xl gap-1.5">{t('register.review')} <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </Panel>
      )}

      {/* ── Stage: Review ── */}
      {stage === "review" && (
        <Panel icon={CheckCircle2} title={t('register.reviewRegistration')}>
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
            {photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoUrl} alt={form.name} className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200" />
            ) : <Avatar name={form.name} size="lg" className="h-16 w-16 text-lg" />}
            <div>
              <p className="text-[16px] font-bold text-slate-900">{form.name}</p>
              <p className="text-[12.5px] text-slate-500">{form.age || "—"}y · {t(`register.${GENDER_KEY[form.gender]}`)} · {form.phone}</p>
              {uhid && <p className="text-[12px] font-mono text-[var(--color-primary-dark)] mt-0.5">UHID {uhid}</p>}
            </div>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            <ReviewRow label={t('register.fieldAbhaNumber')} value={abha?.abhaNumber ?? t('register.notLinked')} mono={!!abha} />
            <ReviewRow label={t('register.fieldAbhaAddress')} value={abha?.abhaAddress ?? "—"} mono={!!abha} />
            {form.fathersName && <ReviewRow label={t('register.labelFathersName')} value={form.fathersName} />}
            <ReviewRow label={t('register.labelDepartment')} value={DEPT_KEY[form.department] ? t(`register.${DEPT_KEY[form.department]}`) : form.department} />
            <ReviewRow label={t('register.slipDoctor')} value={form.doctor} />
            <ReviewRow label={t('register.labelVisitType')} value={VISIT_KEY[form.visitType] ? t(`register.${VISIT_KEY[form.visitType]}`) : form.visitType} />
            <ReviewRow label={t('register.labelPriority')} value={t(`register.${TRIAGE_KEY[form.triage]}`)} />
            <ReviewRow label={t('register.slipChiefComplaint')} value={form.symptoms || "—"} className="sm:col-span-2" />
          </dl>

          {/* Generated ABHA card */}
          {abha && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">{t('register.generatedAbhaCard')}</p>
              <AbhaCard data={abhaCardData()} showBack={false} />
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant="outline" onClick={() => setStage("details")} disabled={busy} className="h-11 rounded-xl gap-1.5"><ArrowLeft className="h-4 w-4" /> {t('common.back')}</Button>
            <Button variant="outline" onClick={printSlip} disabled={busy} className="h-11 rounded-xl gap-1.5"><Printer className="h-4 w-4" /> {t('register.printSlip')}</Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => { void addToQueue(false) }} disabled={busy} className="h-11 rounded-xl gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {t('register.addToQueue')}
            </Button>
            <Button onClick={() => { void addToQueue(true) }} disabled={busy} className="h-11 rounded-xl gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />} {t('register.addAndSendToVitals')}
            </Button>
          </div>
        </Panel>
      )}

      {/* ── Stage: Done ── */}
      {stage === "done" && result && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center"><CheckCircle2 className="h-7 w-7 text-white" /></div>
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">{t('register.registeredHeading', { name: form.name })}</h3>
            <p className="text-[13px] text-slate-500 mt-1">
              Token <b>#{result.token}</b> · {result.sentToVitals
                ? <span className="text-amber-600 font-semibold inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" /> {t('register.sentToVitals')}</span>
                : t('register.addedToWaiting')}
              {uhid && <> · UHID <b className="font-mono">{uhid}</b></>}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <Button variant="outline" onClick={printSlip} className="h-10 rounded-xl gap-1.5"><Printer className="h-4 w-4" /> {t('register.printSlip')}</Button>
            <Link href="/reception/opd"><Button variant="secondary" className="h-10 rounded-xl">{t('register.goToOpdQueue')}</Button></Link>
            <Button onClick={restart} className="h-10 rounded-xl gap-1.5"><UserPlus className="h-4 w-4" /> {t('register.registerAnother')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── presentational helpers ───────────────────────────────────────────────────
function row(label: string, value: string) {
  return `<tr><td style="font-weight:600;color:#475569;width:38%">${label}</td><td>${value}</td></tr>`
}
function fmtDob(aadhaar: string) {
  return fetchAadhaarDemographics(aadhaar).dob
}

function MethodCard({ icon: Icon, title, desc, recommended, recommendedLabel, busy, onClick }: { icon: React.ElementType; title: string; desc: string; recommended?: boolean; recommendedLabel?: string; busy?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="group text-left rounded-2xl border-2 border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.04)] hover:bg-[rgba(238,107,38,0.08)] hover:border-[var(--color-primary)] transition p-4 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
      <div className="flex items-center justify-between mb-2">
        <span className="h-10 w-10 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </span>
        {recommended && <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary-dark)] bg-[rgba(238,107,38,0.12)] px-2 py-0.5 rounded-full">{recommendedLabel}</span>}
      </div>
      <p className="text-[13.5px] font-bold text-slate-900">{title}</p>
      <p className="text-[12px] text-slate-500 mt-0.5">{desc}</p>
    </button>
  )
}

function Panel({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg bg-[rgba(238,107,38,0.10)] text-[var(--color-accent)] flex items-center justify-center"><Icon className="h-4 w-4" /></span>
        <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] mb-2 pb-1.5 border-b border-slate-100">{title}</p>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3">{children}</div>
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children}
    </div>
  )
}

function ReadRow({ icon: Icon, label, value, mono, className }: { icon: React.ElementType; label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={cn("text-[13px] font-medium text-slate-900 break-words", mono && "font-mono")}>{value}</p>
      </div>
    </div>
  )
}

function ReviewRow({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={cn("text-slate-900 font-medium break-words", mono && "font-mono")}>{value}</dd>
    </div>
  )
}
