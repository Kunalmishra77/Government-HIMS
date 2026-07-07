"use client"

/* Aadhaar → ABHA → UHID verification flow.
 *
 * One self-contained state machine used in two places:
 *   1. The reception registration page (step 1).
 *   2. The OPD queue "Complete Aadhaar Verification" drawer.
 *
 * Stages: capture (upload / scan QR / manual) → OTP to linked mobile → ABHA
 * detect-or-create → UHID generation → onComplete. All mocked, no network.
 */

import { useState } from "react"
import {
  IdCard, ScanLine, Upload, Loader2, Check, ShieldCheck, Fingerprint, ArrowRight, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useAuditStore } from "@/store/useAuditStore"
import { usePatientStore } from "@/store/usePatientStore"
import { AbhaCard } from "@/components/abha/AbhaCard"
import { generateUhid, findUhidByAbha } from "@/lib/intake/register"
import {
  extractAadhaarFromQr, parseAadhaarUpload, sendAadhaarOtp, verifyAadhaarOtp,
  fetchAadhaarDemographics, detectAbha, createAbha,
  type AadhaarDemographics,
} from "@/lib/intake/aadhaar-mock"

export interface AadhaarAbhaResult {
  uhid: string
  abhaId: string
  aadhaarVerified: true
  demographics: AadhaarDemographics
}

interface Props {
  onComplete: (r: AadhaarAbhaResult) => void
  /** The patient being verified, so the ABHA card shows their name. */
  patientName?: string
  className?: string
}

type Stage = "capture" | "otp" | "abha" | "done"

export function AadhaarAbhaFlow({ onComplete, patientName, className }: Props) {
  const audit = useAuditStore((s) => s.log)
  const [stage, setStage] = useState<Stage>("capture")
  const [busy, setBusy] = useState(false)

  const [aadhaar, setAadhaar] = useState("")          // masked or raw, used for lookups
  const [manual, setManual] = useState("")            // manual 12-digit entry
  const [maskedMobile, setMaskedMobile] = useState("")

  const [otpRef, setOtpRef] = useState("")
  const [otp, setOtp] = useState("")

  const [demographics, setDemographics] = useState<AadhaarDemographics | null>(null)
  const [abhaId, setAbhaId] = useState("")
  const [abhaExisting, setAbhaExisting] = useState(false)
  const [uhid, setUhid] = useState("")

  // ── Stage 1: capture Aadhaar (upload / scan / manual) ────────────────────
  function beginOtp(rawAadhaar: string) {
    setAadhaar(rawAadhaar)
    const { demoCode, maskedMobile } = sendAadhaarOtp(rawAadhaar)
    setOtpRef(demoCode)
    setMaskedMobile(maskedMobile)
    setOtp("")
    setStage("otp")
    toast.info(`OTP sent to ${maskedMobile}`, { description: `Demo code: ${demoCode}` })
    audit({ action: "reception_registered", resource: "aadhaar_otp", detail: `Aadhaar OTP dispatched to ${maskedMobile}.`, userId: "user", userName: "Reception" })
  }

  async function captureViaScan() {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 800))
    const { maskedAadhaar } = extractAadhaarFromQr()
    setBusy(false)
    audit({ action: "reception_registered", resource: "aadhaar_scan", detail: `Aadhaar QR scanned → ${maskedAadhaar}.`, userId: "user", userName: "Reception" })
    beginOtp(maskedAadhaar)
  }

  async function captureViaUpload() {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 800))
    const { maskedAadhaar } = parseAadhaarUpload()
    setBusy(false)
    audit({ action: "reception_registered", resource: "aadhaar_upload", detail: `Aadhaar uploaded & parsed → ${maskedAadhaar}.`, userId: "user", userName: "Reception" })
    beginOtp(maskedAadhaar)
  }

  function captureViaManual() {
    const digits = manual.replace(/\D/g, "")
    if (digits.length !== 12) { toast.error("Enter a valid 12-digit Aadhaar number"); return }
    beginOtp(digits)
  }

  function resendOtp() {
    const { demoCode, maskedMobile } = sendAadhaarOtp(aadhaar)
    setOtpRef(demoCode)
    setMaskedMobile(maskedMobile)
    setOtp("")
    toast.info(`OTP re-sent to ${maskedMobile}`, { description: `Demo code: ${demoCode}` })
  }

  // ── Stage 2: verify OTP → fetch demographics → detect ABHA ───────────────
  async function handleVerify() {
    if (!verifyAadhaarOtp(otp, otpRef)) { toast.error("Incorrect OTP — try again"); return }
    setBusy(true)
    await new Promise((r) => setTimeout(r, 600))
    const demo = fetchAadhaarDemographics(aadhaar)
    setDemographics(demo)
    const detected = detectAbha(aadhaar)
    setBusy(false)
    toast.success("Aadhaar verified", { description: `${demo.name} · details fetched` })
    audit({ action: "reception_registered", resource: "aadhaar_otp", detail: `Aadhaar verified for ${demo.name}.`, userId: "user", userName: "Reception" })
    if (detected.exists && detected.profile) {
      setAbhaId(detected.profile.abhaNumber)
      setAbhaExisting(true)
    }
    setStage("abha")
  }

  // ── Stage 3: ABHA create (if none) → UHID generation ─────────────────────
  function finalize(linkedAbha: string) {
    const patients = usePatientStore.getState().patients
    const resolvedUhid = findUhidByAbha(linkedAbha) || generateUhid(patients)
    setUhid(resolvedUhid)
    setStage("done")
    onComplete({
      uhid: resolvedUhid,
      abhaId: linkedAbha,
      aadhaarVerified: true,
      demographics: demographics!,
    })
  }

  async function handleCreateAbha() {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 900))
    const created = createAbha()
    setBusy(false)
    setAbhaId(created.abhaNumber)
    toast.success("ABHA created", { description: created.abhaNumber })
    audit({ action: "reception_registered", resource: "abha_create", detail: `New ABHA ${created.abhaNumber} created for ${demographics?.name}.`, userId: "user", userName: "Reception" })
    finalize(created.abhaNumber)
  }

  function handleUseExistingAbha() {
    finalize(abhaId)
  }

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white overflow-hidden", className)}>
      {/* Stepper header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Fingerprint className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[13px] font-bold text-[var(--color-primary-dark)]">Aadhaar verification</h3>
        <div className="ml-auto flex items-center gap-1.5 text-[10.5px] font-bold">
          {(["Aadhaar", "OTP", "ABHA", "UHID"] as const).map((label, i) => {
            const order: Stage[] = ["capture", "otp", "abha", "done"]
            const active = order.indexOf(stage) >= i
            return (
              <span key={label} className={cn("px-2 py-0.5 rounded-full", active ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-400")}>
                {label}
              </span>
            )
          })}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Stage 1 — capture */}
        {stage === "capture" && (
          <>
            <p className="text-[12.5px] text-slate-500">Verify the patient&apos;s identity using their Aadhaar. Scan the secure QR, upload the card, or enter the number manually.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={captureViaScan} disabled={busy}
                className="flex flex-col items-center justify-center gap-1.5 h-24 rounded-xl border-2 border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.05)] hover:bg-[rgba(238,107,38,0.10)] transition disabled:opacity-50">
                {busy ? <Loader2 className="h-5 w-5 text-[var(--color-accent)] animate-spin" /> : <ScanLine className="h-5 w-5 text-[var(--color-accent)]" />}
                <span className="text-[12px] font-bold text-[var(--color-primary-dark)]">Scan Barcode / QR</span>
              </button>
              <button type="button" onClick={captureViaUpload} disabled={busy}
                className="flex flex-col items-center justify-center gap-1.5 h-24 rounded-xl border-2 border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.05)] hover:bg-[rgba(238,107,38,0.10)] transition disabled:opacity-50">
                {busy ? <Loader2 className="h-5 w-5 text-[var(--color-accent)] animate-spin" /> : <Upload className="h-5 w-5 text-[var(--color-accent)]" />}
                <span className="text-[12px] font-bold text-[var(--color-primary-dark)]">Upload Aadhaar</span>
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">or enter manually</span>
              <span className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="flex gap-2">
              <Input value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="12-digit Aadhaar number" inputMode="numeric" className="h-10 rounded-xl tracking-widest" />
              <Button onClick={captureViaManual} disabled={busy} className="h-10 px-4 rounded-xl gap-1.5">
                <ArrowRight className="h-4 w-4" /> Send OTP
              </Button>
            </div>
          </>
        )}

        {/* Stage 2 — OTP */}
        {stage === "otp" && (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-[rgba(238,107,38,0.05)] px-3 py-2">
              <IdCard className="h-4 w-4 text-[var(--color-accent)]" />
              <p className="text-[12px] text-slate-700">Aadhaar <b>{aadhaar}</b> · OTP sent to linked mobile <b>{maskedMobile}</b></p>
            </div>
            <label className="block text-[12px] font-semibold text-slate-700">Enter OTP</label>
            <div className="flex gap-2">
              <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter") handleVerify() }}
                placeholder="6-digit OTP" inputMode="numeric" autoFocus
                className="h-10 rounded-xl tracking-[0.3em] font-bold" />
              <Button onClick={handleVerify} disabled={busy || otp.length !== 6} className="h-10 px-4 rounded-xl gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={resendOtp} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-accent)] hover:underline">
                <RefreshCw className="h-3 w-3" /> Resend OTP
              </button>
              <button type="button" onClick={() => setStage("capture")} className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-600">
                Change Aadhaar
              </button>
            </div>
          </>
        )}

        {/* Stage 3 — ABHA */}
        {stage === "abha" && demographics && (
          <>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-800">
                <Check className="h-3.5 w-3.5" /> Aadhaar verified — demographics fetched
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px] text-slate-700">
                <span><b>{demographics.name}</b></span>
                <span>{demographics.age}y · {demographics.gender}</span>
                <span className="col-span-2 text-slate-500">{demographics.address} — {demographics.pincode}</span>
              </div>
            </div>

            {abhaExisting ? (
              <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.05)] px-3 py-2.5 space-y-2">
                <p className="text-[12px] text-slate-700">Existing ABHA found and retrieved:</p>
                <p className="font-mono text-[14px] font-bold text-[var(--color-primary-dark)]">{abhaId}</p>
                <Button onClick={handleUseExistingAbha} disabled={busy} className="w-full h-10 rounded-xl gap-1.5">
                  <ArrowRight className="h-4 w-4" /> Continue & generate UHID
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
                <p className="text-[12px] text-amber-800">No ABHA account is linked to this Aadhaar yet.</p>
                <Button onClick={handleCreateAbha} disabled={busy} className="w-full h-10 rounded-xl gap-1.5">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Create ABHA & generate UHID
                </Button>
              </div>
            )}
          </>
        )}

        {/* Stage 4 — done */}
        {stage === "done" && demographics && (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-center space-y-1.5">
              <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="h-5 w-5 text-white" />
              </div>
              <p className="text-[13px] font-bold text-emerald-800">Hospital identity established</p>
              <div className="text-[12px] text-slate-600 space-y-0.5">
                <p>UHID <b className="font-mono">{uhid}</b></p>
                <p>ABHA <b className="font-mono">{abhaId}</b> {abhaExisting ? "(retrieved)" : "(new)"}</p>
              </div>
            </div>

            {/* Full official ABHA card (front + instructions back, nothing
                skipped), just in compact sizing so it fits the drawer.
                `nameHindi`/`genderHindi` are explicitly cleared so the
                component's placeholder defaults never leak onto a real card. */}
            <AbhaCard
              compact
              data={{
                name: patientName ?? demographics.name,
                nameHindi: undefined,
                fathersName: demographics.fathersName,
                abhaNumber: abhaId,
                abhaAddress: `${abhaId.replace(/\D/g, "")}@abdm`,
                gender: demographics.gender,
                genderHindi: undefined,
                dob: demographics.dob,
                mobile: demographics.phone,
                address: demographics.address,
                district: demographics.district,
                state: demographics.state,
                pincode: demographics.pincode,
                aadhaarVerified: true,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
