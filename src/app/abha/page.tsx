"use client"

import React, { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { PageContainer } from "@/components/ui/PageContainer"
import { PageHeader } from "@/components/ui/PageHeader"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NeonBadge } from "@/components/ui/neon-badge"
import { AbhaCard } from "@/components/abha/AbhaCard"
import { toast } from "sonner"
import {
  ShieldCheck, CheckCircle2, Lock, AlertCircle, ArrowRight,
  Sparkles, Download, Database, RefreshCw, Heart, Key, Send,
  Shield, User, X
} from "lucide-react"

// ── Types & Mock Data ────────────────────────────────────────────────────────
interface MockConsentRequest {
  id: string
  hiuName: string
  patientAddress: string
  dataTypes: string[]
  purpose: string
  validityDays: number
  status: "PENDING" | "GRANTED" | "DENIED"
  createdAt: string
}

const MOCK_FHIR_BUNDLE = {
  resourceType: "Bundle",
  id: "abdm-bundle-2026",
  type: "document",
  timestamp: "2026-06-26T16:24:00Z",
  entry: [
    {
      resource: {
        resourceType: "Patient",
        id: "pat-abha-1",
        name: [{ text: "Ramesh Kumar" }],
        gender: "male",
        birthDate: "1984-04-12"
      }
    },
    {
      resource: {
        resourceType: "DiagnosticReport",
        id: "lab-report-1",
        status: "final",
        category: [{ text: "Laboratory" }],
        code: { text: "Complete Blood Count (CBC)" },
        subject: { reference: "Patient/pat-abha-1" },
        effectiveDateTime: "2026-05-10T08:30:00Z",
        performer: [{ display: "Mithlesh Labs, Lucknow" }],
        result: [
          { display: "Haemoglobin: 14.2 g/dL (Normal: 13.5 - 17.5)" },
          { display: "WBC Count: 6,800 /mcL (Normal: 4,000 - 11,000)" },
          { display: "Platelets: 210,000 /mcL (Normal: 150,000 - 450,000)" }
        ]
      }
    },
    {
      resource: {
        resourceType: "MedicationRequest",
        id: "rx-1",
        status: "active",
        intent: "order",
        subject: { reference: "Patient/pat-abha-1" },
        authoredOn: "2026-05-10T09:00:00Z",
        requester: { display: "Dr. Alok Verma, Cardiologist" },
        medicationCodeableConcept: { text: "Amlodipine 5mg OD" },
        dosageInstruction: [{ text: "Once daily in the morning for 30 days" }]
      }
    }
  ]
}

const ENCRYPTED_CIPHERTEXT = `-----BEGIN ABDM SECURE DATA BLOCK-----
Version: ABDM-V2.1.0-Crypto
Algorithm: ECDH-AES256-GCM-SHA256
Payload-Hash: 4a2d3b8f109c3e4f7a8b9c0d1e2f3a4b
Sender-HIP: HIP-LUCKNOW-DIAGNOSTICS-01
Receiver-HIU: HIU-AGENTIX-HIMS-01

MIIEwTADAgECAgEBMA0GCSqGSIb3DQEBCwUAMGExCzAJBgNVBAYTAklOMQswCQYD
VQQIDAJVUDEQMA4GA1UEBwwHTHVja25vdzElMCMGA1UECgwcUGVvcGxl4oCZcyBV
bml2ZXJzaXR5IEhJTVMxEzARBgNVBAMMCkFCRE0tSFVCLTAxMB4XDTI2MDYyNjEw
NTgwMloXDTI3MDYyNjEwNTgwMlowYTEJMBcGA1UEBhMCOUNIRU1FLUFCSUEtMDEw
NDIxMTMwNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
NDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIzNDIz
-----END ABDM SECURE DATA BLOCK-----`

export default function AbhaSandboxPage() {
  const t = useTranslations("abha")
  const [activeTab, setActiveTab] = useState<"onboarding" | "consent">("onboarding")

  // Onboarding creation state
  const [createStep, setCreateStep] = useState<"mobile" | "aadhaar" | "details" | "card">("mobile")
  const [mobileNum, setMobileNum] = useState("")
  const [mobileOtp, setMobileOtp] = useState("")
  const [mobileVerifying, setMobileVerifying] = useState(false)

  const [aadhaarNum, setAadhaarNum] = useState("")
  const [aadhaarOtp, setAadhaarOtp] = useState("")
  const [aadhaarVerifying, setAadhaarVerifying] = useState(false)

  const [customAddress, setCustomAddress] = useState("")
  const [createdAbhaId, setCreatedAbhaId] = useState("")
  const [createdAbhaAddress, setCreatedAbhaAddress] = useState("")
  const [createdCardData, setCreatedCardData] = useState<{
    name: string
    dob: string
    gender: string
    mobile: string
    photo: string
  } | null>(null)

  // Login simulation state
  const [loginMode, setLoginMode] = useState<"mobile" | "address">("mobile")
  const [loginVal, setLoginVal] = useState("")
  const [loginOtp, setLoginOtp] = useState("")
  const [loginStep, setLoginStep] = useState<"input" | "otp" | "success">("input")
  const [loginVerifying, setLoginVerifying] = useState(false)

  // Consent & HIE state
  const [consentRequests, setConsentRequests] = useState<MockConsentRequest[]>([
    {
      id: "REQ-2026-004",
      hiuName: "Agentix HIMS",
      patientAddress: "ramesh.kumar@abdm",
      dataTypes: ["DiagnosticReport", "MedicationRequest"],
      purpose: "Care Management",
      validityDays: 14,
      status: "PENDING",
      createdAt: new Date().toISOString()
    }
  ])
  const [targetAbhaAddress, setTargetAbhaAddress] = useState("ramesh.kumar@abdm")
  const [reqDataTypes, setReqDataTypes] = useState<string[]>(["DiagnosticReport", "MedicationRequest"])
  const [reqPurpose, setReqPurpose] = useState("Care Management")
  const [reqValidity, setReqValidity] = useState(14)
  const [selectedReqId, setSelectedReqId] = useState<string>("REQ-2026-004")
  const [otpSentForReqId, setOtpSentForReqId] = useState<string | null>(null)
  const [smartphoneOtp, setSmartphoneOtp] = useState("")
  const [smartphoneVerifying, setSmartphoneVerifying] = useState(false)

  // Decryption workflow state
  const [exchangeState, setExchangeState] = useState<"idle" | "requesting" | "encrypting" | "decrypting" | "completed">("idle")
  const [showEncryptedCode, setShowEncryptedCode] = useState(true)

  // Timer helpers
  const [timer, setTimer] = useState(0)
  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [timer])

  // Reset creation onboarding
  const handleResetOnboarding = () => {
    setCreateStep("mobile")
    setMobileNum("")
    setMobileOtp("")
    setAadhaarNum("")
    setAadhaarOtp("")
    setCustomAddress("")
  }

  // Handle Mobile OTP request
  const handleSendMobileOtp = () => {
    if (!/^\d{10}$/.test(mobileNum)) {
      toast.error(t("toastInvalidMobile"))
      return
    }
    setTimer(30)
    toast.success(t("toastMobileOtpSent"))
    setMobileOtp("")
  }

  // Handle Mobile verification
  const handleVerifyMobile = async () => {
    if (mobileOtp !== "483910") {
      toast.error(t("toastInvalidMobileOtp"))
      return
    }
    setMobileVerifying(true)
    await new Promise(r => setTimeout(r, 1000))
    setMobileVerifying(false)
    setCreateStep("aadhaar")
    toast.success(t("toastMobileVerified"))
  }

  // Handle Aadhaar OTP request
  const handleSendAadhaarOtp = () => {
    if (!/^\d{12}$/.test(aadhaarNum)) {
      toast.error(t("toastInvalidAadhaar"))
      return
    }
    setTimer(30)
    toast.success(t("toastAadhaarOtpSent"))
    setAadhaarOtp("")
  }

  // Handle Aadhaar verification
  const handleVerifyAadhaar = async () => {
    if (aadhaarOtp !== "882941") {
      toast.error(t("toastInvalidAadhaarOtp"))
      return
    }
    setAadhaarVerifying(true)
    await new Promise(r => setTimeout(r, 1000))
    setAadhaarVerifying(false)
    setCreatedCardData({
      name: "Ramesh Kumar",
      dob: "1984-04-12",
      gender: "Male",
      mobile: mobileNum || "9876543210",
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop"
    })
    setCustomAddress("ramesh.kumar")
    setCreateStep("details")
    toast.success(t("toastAadhaarAuthenticated"))
  }

  // Handle final card creation
  const handleCreateAbhaCard = async () => {
    if (!customAddress.trim()) {
      toast.error(t("toastEnterAbhaPrefix"))
      return
    }
    const cleanPrefix = customAddress.toLowerCase().replace(/[^a-z0-9._-]/g, "")
    const fullAddress = `${cleanPrefix}@abdm`
    const generatedNum = `14-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`

    setCreatedAbhaId(generatedNum)
    setCreatedAbhaAddress(fullAddress)
    setCreateStep("card")
    setTargetAbhaAddress(fullAddress)
    toast.success(t("toastCardCreated"))
  }

  // Handle Login flow verify
  const handleSendLoginOtp = () => {
    if (!loginVal.trim()) {
      toast.error(t("toastEnterLoginId"))
      return
    }
    setLoginStep("otp")
    setTimer(30)
    toast.success(t("toastLoginOtpSent"))
    setLoginOtp("")
  }

  // Handle Login authentication
  const handleVerifyLogin = async () => {
    if (loginOtp !== "554321") {
      toast.error(t("toastInvalidLoginOtp"))
      return
    }
    setLoginVerifying(true)
    await new Promise(r => setTimeout(r, 1000))
    setLoginVerifying(false)
    setCreatedAbhaId("14-8821-3341-7090")
    setCreatedAbhaAddress("ramesh.kumar@abdm")
    setCreatedCardData({
      name: "Ramesh Kumar",
      dob: "1984-04-12",
      gender: "Male",
      mobile: "9876543210",
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop"
    })
    setLoginStep("success")
    toast.success(t("toastLoggedIn"))
  }

  // Handle consent creation
  const handleCreateConsentRequest = () => {
    if (!targetAbhaAddress.trim()) {
      toast.error(t("toastEnterPatientAddress"))
      return
    }
    if (reqDataTypes.length === 0) {
      toast.error(t("toastSelectDataType"))
      return
    }
    const newId = `REQ-2026-00${consentRequests.length + 5}`
    const newRequest: MockConsentRequest = {
      id: newId,
      hiuName: "Agentix HIMS",
      patientAddress: targetAbhaAddress.trim().toLowerCase(),
      dataTypes: reqDataTypes,
      purpose: reqPurpose,
      validityDays: reqValidity,
      status: "PENDING",
      createdAt: new Date().toISOString()
    }
    setConsentRequests([newRequest, ...consentRequests])
    setSelectedReqId(newId)
    setExchangeState("idle")
    setOtpSentForReqId(null)
    toast.success(t("toastConsentInitiated", { id: newId }))
  }

  // Toggle checklist inside request creator
  const toggleDataType = (type: string) => {
    setReqDataTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // Current active consent request in focus
  const currentReq = consentRequests.find(r => r.id === selectedReqId)

  // Handle smartphone patient action (Accept / Deny)
  const handlePatientConsent = (status: "GRANTED" | "DENIED") => {
    if (!currentReq) return
    if (status === "GRANTED") {
      setOtpSentForReqId(currentReq.id)
      setSmartphoneOtp("")
      toast.info(t("toastEnterPin"))
    } else {
      setConsentRequests(prev =>
        prev.map(r => (r.id === currentReq.id ? { ...r, status: "DENIED" } : r))
      )
      toast.warning(t("toastConsentDenied"))
    }
  }

  // Submit secure PIN to grant consent
  const handleVerifySmartphoneOtp = async () => {
    if (smartphoneOtp !== "1234") {
      toast.error(t("toastIncorrectPin"))
      return
    }
    setSmartphoneVerifying(true)
    await new Promise(r => setTimeout(r, 800))
    setSmartphoneVerifying(false)
    setConsentRequests(prev =>
      prev.map(r => (r.id === selectedReqId ? { ...r, status: "GRANTED" } : r))
    )
    setOtpSentForReqId(null)
    toast.success(t("toastConsentGranted"))
  }

  // Run HIE Data Transfer animation
  const handleTriggerDataExchange = async () => {
    if (!currentReq || currentReq.status !== "GRANTED") return
    setExchangeState("requesting")
    await new Promise(r => setTimeout(r, 1500))
    setExchangeState("encrypting")
    await new Promise(r => setTimeout(r, 1800))
    setExchangeState("decrypting")
    await new Promise(r => setTimeout(r, 1800))
    setExchangeState("completed")
    toast.success(t("toastDecryptionComplete"))
  }

  return (
    <PageContainer width="xl" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <PageHeader
            title={t("pageTitle")}
            subtitle={t("pageSubtitle")}
            as="h1"
            className="mb-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "onboarding" ? "primary" : "outline"}
            onClick={() => setActiveTab("onboarding")}
            className="rounded-full shadow-sm"
          >
            <User className="h-4 w-4 mr-1.5" />
            {t("tabIdentity")}
          </Button>
          <Button
            variant={activeTab === "consent" ? "primary" : "outline"}
            onClick={() => setActiveTab("consent")}
            className="rounded-full shadow-sm"
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            {t("tabConsent")}
          </Button>
          <LocaleToggle />
        </div>
      </div>

      {/* ── TAB 1: ONBOARDING & LOGIN ────────────────────────────────────────── */}
      {activeTab === "onboarding" && (
        <div className="space-y-6">
        {createdCardData && (createdAbhaId || createStep === "card") && (
          <AbhaCard
            data={{
              name: createdCardData.name,
              abhaNumber: createdAbhaId || "14-8821-3341-7090",
              abhaAddress: createdAbhaAddress || "ramesh.kumar@abdm",
              gender: createdCardData.gender,
              genderHindi: createdCardData.gender === "Female" ? "महिला" : "पुरुष",
              dob: createdCardData.dob,
              mobile: createdCardData.mobile,
              photoUrl: createdCardData.photo,
            }}
          />
        )}
        <div className="grid md:grid-cols-12 gap-6">
          {/* Onboarding creation flow card */}
          <Card className="md:col-span-7 p-6 border-slate-200 bg-white space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  {t("createAbhaNumber")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t("createAbhaSubtitle")}</p>
              </div>
              <button
                onClick={handleResetOnboarding}
                className="text-xs text-[var(--color-accent)] hover:underline font-semibold flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> {t("resetFlow")}
              </button>
            </div>

            {/* Stepper indicators */}
            <div className="flex items-center gap-2">
              {[
                { step: "mobile", label: t("stepMobileOtp") },
                { step: "aadhaar", label: t("stepAadhaarOtp") },
                { step: "details", label: t("stepAbhaDetails") },
                { step: "card", label: t("stepDigitalCard") }
              ].map((s, idx) => {
                const currentIdx = ["mobile", "aadhaar", "details", "card"].indexOf(createStep)
                const active = idx <= currentIdx
                const isCurrent = s.step === createStep
                return (
                  <React.Fragment key={s.step}>
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs border transition-all ${
                          isCurrent
                            ? "bg-primary text-white border-primary shadow"
                            : active
                            ? "bg-primary-soft text-accent border-primary/20"
                            : "bg-slate-50 text-slate-400 border-slate-200"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] font-semibold text-center hidden md:inline ${isCurrent ? "text-accent font-bold" : "text-slate-500"}`}>
                        {s.label}
                      </span>
                    </div>
                    {idx < 3 && (
                      <div className={`h-0.5 flex-1 transition-all ${idx < currentIdx ? "bg-primary" : "bg-slate-200"}`} />
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {/* Steps Container */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 min-h-[220px] flex flex-col justify-center">
              {/* Step 1: Mobile verification */}
              {createStep === "mobile" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">{t("enterMobileNumber")}</label>
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={mobileNum}
                        onChange={e => setMobileNum(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder={t("mobilePlaceholder")}
                        className="flex-1 h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSendMobileOtp}
                        disabled={mobileNum.length !== 10 || timer > 0}
                      >
                        {timer > 0 ? t("resendIn", { seconds: timer }) : t("sendOtp")}
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{t("mobileBypassHint", { code: "483910" })}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">{t("enter6DigitOtp")}</label>
                    <input
                      type="text"
                      value={mobileOtp}
                      onChange={e => setMobileOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("otp6Placeholder")}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    />
                  </div>

                  <Button
                    variant="primary"
                    className="w-full bg-primary hover:bg-primary-dark h-11 rounded-xl text-sm"
                    onClick={handleVerifyMobile}
                    isLoading={mobileVerifying}
                    disabled={mobileOtp.length !== 6}
                  >
                    {t("verifyMobileNumber")}
                  </Button>
                </div>
              )}

              {/* Step 2: Aadhaar verification */}
              {createStep === "aadhaar" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">{t("enterAadhaar")}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aadhaarNum}
                        onChange={e => setAadhaarNum(e.target.value.replace(/\D/g, "").slice(0, 12))}
                        placeholder={t("aadhaarPlaceholder")}
                        className="flex-1 h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleSendAadhaarOtp}
                        disabled={aadhaarNum.length !== 12 || timer > 0}
                      >
                        {timer > 0 ? t("resendIn", { seconds: timer }) : t("sendOtp")}
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{t("aadhaarBypassHint", { code: "882941" })}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">{t("enterAadhaarOtp")}</label>
                    <input
                      type="text"
                      value={aadhaarOtp}
                      onChange={e => setAadhaarOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("otp6Placeholder")}
                      className="w-full h-11 px-3 rounded-xl border border-slate-200 text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    />
                  </div>

                  <Button
                    variant="primary"
                    className="w-full bg-primary hover:bg-primary-dark h-11 rounded-xl text-sm"
                    onClick={handleVerifyAadhaar}
                    isLoading={aadhaarVerifying}
                    disabled={aadhaarOtp.length !== 6}
                  >
                    {t("authenticateAadhaar")}
                  </Button>
                </div>
              )}

              {/* Step 3: ABHA Address Creation */}
              {createStep === "details" && createdCardData && (
                <div className="space-y-4">
                  <div className="flex gap-4 items-center bg-white p-3 rounded-xl border border-slate-200">
                    <img src={createdCardData.photo} alt={t("aadhaarPhotoAlt")} className="h-12 w-12 rounded-xl object-cover border border-slate-100" />
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{createdCardData.name}</p>
                      <p className="text-xs text-slate-500">{t("genderDobLine", { gender: createdCardData.gender, dob: createdCardData.dob })}</p>
                      <p className="text-xs text-green-600 font-semibold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("authenticatedFromAadhaar")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">{t("setAbhaAddress")}</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={customAddress}
                        onChange={e => setCustomAddress(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                        placeholder={t("abhaAddressPlaceholder")}
                        className="w-full h-11 pl-3 pr-20 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400">@abdm</span>
                    </div>
                    <p className="text-[11.5px] text-slate-400 mt-1">{t("abhaAddressHint")}</p>
                  </div>

                  <Button
                    variant="primary"
                    className="w-full bg-primary hover:bg-primary-dark h-11 rounded-xl text-sm"
                    onClick={handleCreateAbhaCard}
                    disabled={!customAddress.trim()}
                  >
                    {t("confirmCreateCard")}
                  </Button>
                </div>
              )}

              {/* Step 4: ABHA Success Screen */}
              {createStep === "card" && (
                <div className="text-center space-y-4">
                  <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-base">{t("abhaGeneratedTitle")}</p>
                    <p className="text-xs text-slate-500 mt-1">{t("abhaGeneratedSubtitle")}</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast.success(t("toastMockDownload"))
                      }}
                    >
                      <Download className="h-4 w-4 mr-1.5" /> {t("downloadPdfCard")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="bg-primary hover:bg-primary-dark"
                      onClick={() => {
                        setActiveTab("consent")
                        setExchangeState("idle")
                      }}
                    >
                      {t("testConsentFlow")} <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Login Simulator & Generated Card Display */}
          <div className="md:col-span-5 space-y-6">
            {/* ABHA Card view (displays when registered or logged in) */}
            {createdCardData && (createdAbhaId || createStep === "card") ? (
              <Card className="overflow-hidden border-none shadow-[0_8px_30px_rgb(12,97,122,0.18)]">
                <div
                  className="p-6 text-white relative"
                  style={{ background: "linear-gradient(135deg,#C2481A 0%,var(--color-primary) 45%,var(--color-primary) 100%)" }}
                >
                  {/* Card Background Overlay pattern */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ backgroundImage: "radial-gradient(ellipse at 90% 10%,rgba(255,255,255,0.4) 0%,transparent 60%)" }}
                  />

                  <div className="relative space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-white/10 pb-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-white/70">{t("cardMinistry")}</p>
                        <p className="text-[14px] font-bold tracking-tight">{t("cardTitle")}</p>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
                        <Heart className="h-5 w-5 text-rose-400 fill-rose-400" />
                      </div>
                    </div>

                    {/* Main content body */}
                    <div className="flex gap-4">
                      {/* Avatar */}
                      <img
                        src={createdCardData?.photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"}
                        alt={t("cardAvatarAlt")}
                        className="h-16 w-16 rounded-xl object-cover border-2 border-white/20"
                      />
                      <div className="space-y-1">
                        <p className="text-base font-bold leading-tight">{createdCardData?.name || "Ramesh Kumar"}</p>
                        <p className="text-xs text-white/70">{t("cardDob", { dob: createdCardData?.dob || "1984-04-12" })}</p>
                        <p className="text-xs text-white/70">{t("cardGender", { gender: createdCardData?.gender || "Male" })}</p>
                      </div>
                    </div>

                    {/* Identifiers */}
                    <div className="grid grid-cols-2 gap-2 bg-white/10 p-3 rounded-xl border border-white/10">
                      <div>
                        <p className="text-[9px] text-white/50 uppercase font-black tracking-wider">{t("cardAbhaNumber")}</p>
                        <p className="text-xs font-mono font-bold mt-0.5 text-primary-light">
                          {createdAbhaId || "14-8821-3341-7090"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/50 uppercase font-black tracking-wider">{t("cardAbhaAddress")}</p>
                        <p className="text-xs font-semibold mt-0.5 truncate text-primary-light">
                          {createdAbhaAddress || "ramesh.kumar@abdm"}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[11px] text-white/70 pt-1">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5 text-primary-light" /> {t("cardGatewayVerified")}
                      </span>
                      <span className="font-mono text-white/40">NHA-GOI</span>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              /* No card created - Login card */
              <Card className="p-5 border-slate-200 bg-white space-y-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Key className="h-4.5 w-4.5 text-[var(--color-accent)]" />
                    {t("loginTitle")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t("loginSubtitle")}</p>
                </div>

                <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => { setLoginMode("mobile"); setLoginStep("input"); setLoginVal("") }}
                    className={`flex-1 py-1.5 rounded font-semibold transition-all ${loginMode === "mobile" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                  >
                    {t("loginTabMobile")}
                  </button>
                  <button
                    onClick={() => { setLoginMode("address"); setLoginStep("input"); setLoginVal("") }}
                    className={`flex-1 py-1.5 rounded font-semibold transition-all ${loginMode === "address" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}
                  >
                    {t("loginTabAddress")}
                  </button>
                </div>

                {loginStep === "input" && (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      {loginMode === "mobile" ? t("loginEnterMobile") : t("loginEnterAddress")}
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={loginVal}
                        onChange={e => setLoginVal(e.target.value)}
                        placeholder={loginMode === "mobile" ? t("mobilePlaceholder") : t("loginAddressPlaceholder")}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                      {loginMode === "address" && (
                        <span className="absolute right-3 text-xs font-bold text-slate-400">@abdm</span>
                      )}
                    </div>
                    <Button
                      variant="primary"
                      className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"
                      onClick={handleSendLoginOtp}
                      disabled={!loginVal.trim()}
                    >
                      {t("loginViaOtp")}
                    </Button>
                  </div>
                )}

                {loginStep === "otp" && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">{t("loginOtpHint", { code: "554321" })}</p>
                    </div>
                    <input
                      type="text"
                      value={loginOtp}
                      onChange={e => setLoginOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={t("loginOtpPlaceholder")}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-center text-base font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <Button
                      variant="primary"
                      className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"
                      onClick={handleVerifyLogin}
                      isLoading={loginVerifying}
                      disabled={loginOtp.length !== 6}
                    >
                      {t("verifyLoadProfile")}
                    </Button>
                  </div>
                )}

                {loginStep === "success" && (
                  <div className="text-center py-2 space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-800">{t("profileLoaded")}</p>
                    <button
                      onClick={() => setLoginStep("input")}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      {t("signOut")}
                    </button>
                  </div>
                )}
              </Card>
            )}

            {/* Sandbox details help card */}
            <Card className="p-4 border-slate-200 bg-slate-50/50 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-slate-400" />
                {t("sandboxGuidelines")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("sandboxGuidelinesBody")}
              </p>
              <ul className="space-y-1 text-xs text-slate-500 list-disc pl-4">
                <li>{t("sandboxGuideline1")}</li>
                <li>{t("sandboxGuideline2")}</li>
              </ul>
            </Card>
          </div>
        </div>
        </div>
      )}

      {/* ── TAB 2: CONSENT & HEALTH INFORMATION EXCHANGE ─────────────────────── */}
      {activeTab === "consent" && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Left: HIU Consent Request Creator */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="p-5 border-slate-200 bg-white space-y-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-[var(--color-accent)]" />
                    {t("createConsentRequest")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t("createConsentSubtitle")}</p>
                </div>

                <div className="space-y-3">
                  {/* Patient ABHA address */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t("patientAbhaAddress")}</label>
                    <input
                      type="text"
                      value={targetAbhaAddress}
                      onChange={e => setTargetAbhaAddress(e.target.value)}
                      placeholder={t("patientAbhaPlaceholder")}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>

                  {/* Purpose Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">{t("purposeOfRequest")}</label>
                    <select
                      value={reqPurpose}
                      onChange={e => setReqPurpose(e.target.value)}
                      className="w-full h-10 px-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
                    >
                      <option value="Care Management">{t("purposeCareManagement")}</option>
                      <option value="Emergency Care">{t("purposeEmergencyCare")}</option>
                      <option value="Referral Treatment">{t("purposeReferralTreatment")}</option>
                      <option value="Medical Research">{t("purposeMedicalResearch")}</option>
                    </select>
                  </div>

                  {/* Data types checkboxes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{t("requestedDataTypes")}</label>
                    <div className="space-y-1.5">
                      {[
                        { key: "DiagnosticReport", label: t("dataTypeDiagnostic") },
                        { key: "MedicationRequest", label: t("dataTypePrescriptions") },
                        { key: "DischargeSummary", label: t("dataTypeDischarge") }
                      ].map(type => {
                        const checked = reqDataTypes.includes(type.key)
                        return (
                          <label key={type.key} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDataType(type.key)}
                              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-primary"
                            />
                            {type.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Validity slider */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      <span>{t("accessValidity")}</span>
                      <span className="text-accent font-bold">{t("validityDays", { days: reqValidity })}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={90}
                      value={reqValidity}
                      onChange={e => setReqValidity(Number(e.target.value))}
                      className="w-full accent-orange-600 cursor-pointer"
                    />
                  </div>

                  <Button
                    variant="primary"
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"
                    onClick={handleCreateConsentRequest}
                  >
                    {t("sendConsentRequest")}
                  </Button>
                </div>
              </Card>

              {/* Consent Requests Queue */}
              <Card className="p-5 border-slate-200 bg-white space-y-3 shadow-sm">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t("activeRequests")}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t("activeRequestsHint")}</p>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {consentRequests.map(r => {
                    const active = selectedReqId === r.id
                    const badgeType = r.status === "GRANTED" ? "success" : r.status === "DENIED" ? "danger" : "warning"
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedReqId(r.id)
                          setExchangeState("idle")
                          setOtpSentForReqId(null)
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          active ? "border-primary bg-primary-soft" : "border-slate-100 bg-slate-50 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{r.id}</span>
                          <NeonBadge variant={badgeType} className="text-[9px] px-1.5 py-0">
                            {t(`status${r.status}`)}
                          </NeonBadge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-1">{t("requestPatient", { address: r.patientAddress })}</p>
                        <p className="text-[10px] text-slate-400">{t("requestPurposeValidity", { purpose: t.has(`purpose.${r.purpose}`) ? t(`purpose.${r.purpose}`) : r.purpose, days: r.validityDays })}</p>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            {/* Middle: Mock Smartphone Consent Simulator */}
            <div className="lg:col-span-4 flex items-center justify-center">
              {/* Smartphone Frame */}
              <div className="relative border-[8px] border-slate-800 rounded-[36px] bg-slate-900 w-[290px] h-[550px] shadow-2xl flex flex-col overflow-hidden">
                {/* Speaker pill notch */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 h-4 w-20 bg-slate-800 rounded-full z-20 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 bg-slate-700 rounded-full" />
                </div>

                {/* Smartphone Display screen */}
                <div className="flex-1 bg-slate-50 text-slate-800 flex flex-col p-4 pt-8 overflow-y-auto relative animate-fade-in">
                  {/* Screen Header */}
                  <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-3">
                    <div className="h-6 w-6 rounded bg-[var(--color-primary)] flex items-center justify-center">
                      <Heart className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-900 leading-tight">{t("personalHealthApp")}</p>
                      <p className="text-[8px] text-slate-400 leading-none">{t("consentManager")}</p>
                    </div>
                  </div>

                  {currentReq ? (
                    <div className="flex-grow flex flex-col justify-between">
                      {/* Request Info */}
                      {currentReq.status === "PENDING" && !otpSentForReqId && (
                        <div className="space-y-4 flex-1">
                          <div className="text-center py-2">
                            <div className="h-10 w-10 bg-primary-soft border border-primary/20 text-accent rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                              <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-slate-800">{t("consentRequestReceived")}</p>
                          </div>

                          <div className="bg-white rounded-xl border border-slate-200 p-3 text-[11px] space-y-2">
                            <p className="font-semibold text-slate-700">{t("requestingEntity")}</p>
                            <p className="font-bold text-slate-900 leading-snug">{currentReq.hiuName}</p>

                            <div className="h-px bg-slate-100 my-1" />

                            <p className="font-semibold text-slate-700">{t("purposeOfAccess")}</p>
                            <p className="font-bold text-slate-900">{t.has(`purpose.${currentReq.purpose}`) ? t(`purpose.${currentReq.purpose}`) : currentReq.purpose}</p>

                            <div className="h-px bg-slate-100 my-1" />

                            <p className="font-semibold text-slate-700">{t("requestedRecords")}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {currentReq.dataTypes.map(t => (
                                <span key={t} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-400 text-center">
                            {t("dpdpNotice")}
                          </p>
                        </div>
                      )}

                      {/* Request Info OTP PIN input step */}
                      {currentReq.status === "PENDING" && otpSentForReqId && (
                        <div className="space-y-4 flex-1 flex flex-col justify-center">
                          <div className="text-center space-y-1">
                            <Lock className="h-8 w-8 text-accent mx-auto" />
                            <p className="text-xs font-bold text-slate-800">{t("confirmAuthorization")}</p>
                            <p className="text-[9.5px] text-slate-400">{t("enterPinHint")}</p>
                          </div>

                          <input
                            type="password"
                            maxLength={4}
                            value={smartphoneOtp}
                            onChange={e => setSmartphoneOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                            placeholder="••••"
                            className="w-full h-11 border border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          />

                          <Button
                            variant="primary"
                            className="w-full bg-primary hover:bg-primary-dark text-xs h-10"
                            onClick={handleVerifySmartphoneOtp}
                            isLoading={smartphoneVerifying}
                            disabled={smartphoneOtp.length !== 4}
                          >
                            {t("signApprove")}
                          </Button>

                          <button
                            onClick={() => setOtpSentForReqId(null)}
                            className="text-[10px] text-slate-400 text-center hover:underline cursor-pointer"
                          >
                            {t("back")}
                          </button>
                        </div>
                      )}

                      {/* Granted state display */}
                      {currentReq.status === "GRANTED" && (
                        <div className="flex-grow flex flex-col items-center justify-center text-center space-y-4">
                          <div className="h-12 w-12 bg-green-50 border border-green-200 text-green-600 rounded-full flex items-center justify-center shadow-sm">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{t("consentGranted")}</p>
                            <p className="text-[9px] text-slate-500 mt-1 max-w-[180px] mx-auto">
                              {t("consentGrantedBody")}
                            </p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-3 text-[10px] text-left w-full space-y-1">
                            <p className="text-slate-400 font-semibold mb-1">{t("statusLog")}</p>
                            <p className="text-slate-800 font-bold">{t("grantedTo", { entity: currentReq.hiuName })}</p>
                            <p className="text-slate-500">{t("logValidity", { days: currentReq.validityDays })}</p>
                            <p className="text-slate-500">{t("logTransferred")}</p>
                          </div>
                        </div>
                      )}

                      {/* Denied state display */}
                      {currentReq.status === "DENIED" && (
                        <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3">
                          <div className="h-12 w-12 bg-red-50 border border-red-200 text-red-600 rounded-full flex items-center justify-center">
                            <X className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-950">{t("consentDenied")}</p>
                            <p className="text-[9px] text-slate-400 mt-1 max-w-[160px] mx-auto">
                              {t("consentDeniedBody")}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Consent Buttons Footer */}
                      {currentReq.status === "PENDING" && !otpSentForReqId && (
                        <div className="space-y-2 pt-4 border-t border-slate-200">
                          <Button
                            variant="primary"
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-xs h-10 rounded-xl"
                            onClick={() => handlePatientConsent("GRANTED")}
                          >
                            {t("grantAccess")}
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full text-red-600 hover:bg-red-50 text-xs h-10 rounded-xl"
                            onClick={() => handlePatientConsent("DENIED")}
                          >
                            {t("denyAccess")}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-grow flex items-center justify-center text-center">
                      <p className="text-xs text-slate-400">{t("noActiveRequest")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: cryptographic visualization & HIE push */}
            <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
              {/* Crypto flow control panel */}
              <Card className="p-5 border-slate-200 bg-white space-y-4 shadow-sm flex-1">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Database className="h-4.5 w-4.5 text-[var(--color-accent)]" />
                    {t("cryptoPipeline")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t("cryptoPipelineSubtitle")}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t("selectedConsentId")}</span>
                    <span className="font-bold text-slate-800">{selectedReqId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t("authorizationStatus")}</span>
                    <span className={`font-bold flex items-center gap-1 ${currentReq?.status === "GRANTED" ? "text-green-600" : "text-amber-500"}`}>
                      {currentReq?.status ? t(`status${currentReq.status}`) : t("statusNone")}
                    </span>
                  </div>
                  {currentReq?.status === "GRANTED" && (
                    <Button
                      variant="primary"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 rounded-xl"
                      onClick={handleTriggerDataExchange}
                      disabled={exchangeState !== "idle" && exchangeState !== "completed"}
                    >
                      {t("triggerDataTransfer")}
                    </Button>
                  )}
                </div>

                {/* Animated pipeline representation */}
                {exchangeState !== "idle" && (
                  <div className="space-y-3 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[10.5px]">
                    <div className="flex items-center justify-between text-[9px] border-b border-slate-800 pb-1.5 text-slate-400">
                      <span>{t("gatewayLogs")}</span>
                      <span className="animate-pulse text-green-500">● {t("live")}</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400">[✓]</span>
                        <span>{t("logHiuRequests")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={["encrypting", "decrypting", "completed"].includes(exchangeState) ? "text-green-400 animate-pulse" : "text-slate-500"}>
                          {exchangeState === "requesting" ? "[…]" : "[✓]"}
                        </span>
                        <span>{t("logHipEncrypts")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={["decrypting", "completed"].includes(exchangeState) ? "text-green-400 animate-pulse" : "text-slate-500"}>
                          {exchangeState === "encrypting" ? "[…]" : exchangeState === "requesting" ? "[ ]" : "[✓]"}
                        </span>
                        <span>{t("logDataTransferred")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={exchangeState === "completed" ? "text-green-400" : "text-slate-500"}>
                          {exchangeState === "decrypting" ? "[…]" : exchangeState === "completed" ? "[✓]" : "[ ]"}
                        </span>
                        <span>{t("logHiuDecrypts")}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Secure documentation guidelines */}
              <Card className="p-4 border-slate-200 bg-slate-50/50 space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-slate-400" />
                  {t("dishaFramework")}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t("dishaFrameworkBody")}
                </p>
              </Card>
            </div>
          </div>

          {/* Bottom Cryptographic JSON view panel */}
          {exchangeState !== "idle" && (
            <Card className="p-6 border-slate-200 bg-slate-950 text-slate-100 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2 text-primary-light">
                    <Lock className="h-4.5 w-4.5" />
                    {t("payloadViewer")}
                  </h4>
                  <p className="text-[11px] text-slate-500">{t("payloadViewerSubtitle")}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEncryptedCode(true)}
                    className={`text-xs px-3 py-1.5 rounded font-semibold cursor-pointer ${showEncryptedCode ? "bg-primary-dark text-primary-light" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {t("encryptedPayloadTab")}
                  </button>
                  <button
                    onClick={() => setShowEncryptedCode(false)}
                    className={`text-xs px-3 py-1.5 rounded font-semibold cursor-pointer ${!showEncryptedCode ? "bg-primary-dark text-primary-light" : "text-slate-400 hover:text-slate-200"}`}
                    disabled={exchangeState !== "completed" && exchangeState !== "decrypting"}
                  >
                    {t("decryptedBundleTab")}
                  </button>
                </div>
              </div>

              {/* Code viewer display */}
              <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 max-h-[300px] overflow-y-auto font-mono text-xs text-slate-300">
                {showEncryptedCode ? (
                  <pre className="whitespace-pre-wrap select-all">{ENCRYPTED_CIPHERTEXT}</pre>
                ) : (
                  <pre className="whitespace-pre-wrap select-all">{JSON.stringify(MOCK_FHIR_BUNDLE, null, 2)}</pre>
                )}
              </div>

              {/* Decrypted Clinical data timeline (renders once decryption finishes) */}
              {exchangeState === "completed" && (
                <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 mt-4 space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> {t("recordsImported")}
                    </span>
                    <span className="text-[10px] text-slate-500">{t("patientSummary")}</span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Clinical Lab findings */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <p className="text-[10px] text-primary-light font-bold uppercase tracking-wider">{t("labLocation")}</p>
                      <p className="text-xs font-bold text-slate-200">{t("labReportLine")}</p>
                      <div className="space-y-1.5 pt-2 border-t border-slate-900 text-xs">
                        <p className="text-slate-400">Haemoglobin: <span className="text-slate-200 font-semibold">14.2 g/dL</span> <span className="text-green-500 font-bold">✓ {t("resultNormal")}</span></p>
                        <p className="text-slate-400">WBC Count: <span className="text-slate-200 font-semibold">6,800 /mcL</span> <span className="text-green-500 font-bold">✓ {t("resultNormal")}</span></p>
                        <p className="text-slate-400">Platelets: <span className="text-slate-200 font-semibold">210,000 /mcL</span> <span className="text-green-500 font-bold">✓ {t("resultNormal")}</span></p>
                      </div>
                    </div>

                    {/* Prescription details */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <p className="text-[10px] text-primary-light font-bold uppercase tracking-wider">{t("hospitalLocation")}</p>
                      <p className="text-xs font-bold text-slate-200">{t("prescriptionLine")}</p>
                      <div className="space-y-1 pt-2 border-t border-slate-900 text-xs">
                        <p className="text-slate-200 font-bold">Amlodipine 5mg OD</p>
                        <p className="text-slate-400">{t("prescriptionDosage")}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{t("authoredOn")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  )
}
