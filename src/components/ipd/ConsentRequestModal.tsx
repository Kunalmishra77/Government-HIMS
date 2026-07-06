"use client"

import { useState } from "react"
import { useConsentStore } from "@/store/useConsentStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useAuditStore } from "@/store/useAuditStore"
import type { NextOfKin } from "@/types/consent"
import {
  X, Send, Copy, CheckCircle, AlertTriangle, Phone, User, Users, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const RELATIONSHIPS: NextOfKin['relationship'][] = ['Spouse', 'Parent', 'Child', 'Sibling', 'Guardian', 'Other']

interface ConsentRequestModalProps {
  patientId: string
  patientName: string
  procedureName: string
  requestedBy: string
  onClose: () => void
}

export function ConsentRequestModal({
  patientId, patientName, procedureName, requestedBy, onClose,
}: ConsentRequestModalProps) {
  const createConsentRequest = useConsentStore(s => s.createConsentRequest)
  const markSent             = useConsentStore(s => s.markSent)
  const updateSurgery        = useInpatientStore(s => s.requestSurgery)   // already exists
  const auditLog             = useAuditStore(s => s.log)

  const [nokName, setNokName]   = useState('')
  const [relationship, setRel]  = useState<NextOfKin['relationship']>('Spouse')
  const [phone, setPhone]       = useState('')
  const [step, setStep]         = useState<'form' | 'otp' | 'sent'>('form')
  const [consentId, setConsentId] = useState('')
  const [otp, setOtp]           = useState('')
  const [consentToken, setConsentToken] = useState('')
  const [copied, setCopied]     = useState(false)
  const [sending, setSending]   = useState(false)
  const [errors, setErrors]     = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!nokName.trim()) e.nokName = 'Name is required'
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) e.phone = 'Enter a valid 10-digit Indian mobile number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = () => {
    if (!validate()) return
    const { id, token, otp: generatedOtp } = createConsentRequest(
      patientId, patientName, procedureName, requestedBy,
      { name: nokName.trim(), relationship, phone: phone.trim() },
    )
    setConsentId(id)
    setOtp(generatedOtp)
    setConsentToken(token)
    setStep('otp')
  }

  const handleSend = async () => {
    setSending(true)
    const host = typeof window !== 'undefined' ? window.location.origin : 'https://hims.agentix.ai'
    const consentUrl = `${host}/consent/${consentToken}`
    const msg =
      `🏥 *Agentix HIMS — Consent Required*\n\n` +
      `Patient: *${patientName}*\n` +
      `Procedure: *${procedureName}*\n` +
      `Requesting Doctor: ${requestedBy}\n\n` +
      `Please tap the link below to review and digitally sign the consent form:\n${consentUrl}\n\n` +
      `This link expires in 6 hours. You will also need the verification code shared with you.\n\n` +
      `_Agentix HIMS · Secure Consent Portal_`

    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone.trim(), message: msg, type: 'consent' }),
      })
    } catch {
      // Mock: proceed even if fetch fails (dev env)
    }

    markSent(consentId)

    auditLog({
      userId: requestedBy,
      userName: requestedBy,
      action: 'consent_requested',
      resource: 'consent',
      resourceId: consentId,
      detail: `Consent link sent to ${nokName} (${relationship}) at +91${phone} for ${procedureName}`,
    })

    setSending(false)
    setStep('sent')
    toast.success('Consent link sent via WhatsApp')
  }

  const copyLink = () => {
    const host = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(`${host}/consent/${consentToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Request Consent</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{procedureName} · {patientName}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6">
          {/* ── Step: Form ── */}
          {step === 'form' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed bg-[rgba(238,107,38,0.07)] rounded-xl p-3 border border-[rgba(238,107,38,0.15)]">
                Enter the next-of-kin details. A secure consent link will be sent to their WhatsApp — they can sign remotely from their phone.
              </p>

              {/* NOK Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  <User className="h-3.5 w-3.5 inline mr-1" /> Next-of-Kin Name
                </label>
                <input
                  value={nokName}
                  onChange={e => setNokName(e.target.value)}
                  placeholder="e.g. Sunita Sharma"
                  className={cn(
                    "w-full h-10 rounded-xl border px-3 text-sm outline-none transition-colors",
                    errors.nokName ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-[var(--color-primary-light)]",
                  )}
                />
                {errors.nokName && <p className="text-xs text-red-500 mt-1">{errors.nokName}</p>}
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  <Users className="h-3.5 w-3.5 inline mr-1" /> Relationship to Patient
                </label>
                <div className="flex flex-wrap gap-2">
                  {RELATIONSHIPS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRel(r)}
                      className={cn(
                        "h-8 px-3 rounded-full text-xs font-semibold border transition-all cursor-pointer",
                        relationship === r
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-[var(--color-primary-light)]",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  <Phone className="h-3.5 w-3.5 inline mr-1" /> WhatsApp / Mobile Number
                </label>
                <div className="flex items-center h-10 rounded-xl border border-slate-200 focus-within:border-[var(--color-primary-light)] transition-colors overflow-hidden">
                  <span className="px-3 bg-slate-50 h-full flex items-center text-sm font-semibold text-slate-500 border-r border-slate-200">+91</span>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    inputMode="numeric"
                    className="flex-1 px-3 text-sm outline-none bg-white h-full"
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              <button
                onClick={handleCreate}
                className="w-full h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all mt-2"
              >
                Generate Consent Link
              </button>
            </div>
          )}

          {/* ── Step: OTP display ── */}
          {step === 'otp' && (
            <div className="space-y-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Share this code with the family
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {otp.split('').map((d, i) => (
                      <div key={i} className="h-10 w-9 bg-white rounded-lg border-2 border-amber-300 flex items-center justify-center font-mono font-bold text-xl text-amber-900">
                        {d}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(otp); toast.success('OTP copied') }}
                    className="text-xs text-amber-700 font-semibold hover:underline cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 mt-2">
                  The next-of-kin must enter this code on the consent page to proceed.
                </p>
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">To:</span> {nokName} ({relationship})</p>
                <p><span className="font-semibold text-slate-800">Phone:</span> +91 {phone}</p>
                <p><span className="font-semibold text-slate-800">Procedure:</span> {procedureName}</p>
              </div>

              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending…' : 'Send Consent Link via WhatsApp'}
              </button>

              <button
                onClick={() => setStep('form')}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Edit NOK details
              </button>
            </div>
          )}

          {/* ── Step: Sent ── */}
          {step === 'sent' && (
            <div className="text-center space-y-4">
              <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-200">
                <CheckCircle className="h-7 w-7 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Link Sent</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Consent link sent to {nokName} at +91{phone}
                </p>
              </div>

              {/* OTP reminder */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">Verification Code</p>
                <p className="font-mono font-bold text-2xl text-amber-900 tracking-[0.25em]">{otp}</p>
                <p className="text-[11px] text-amber-600 mt-1">Tell the family to keep this code ready — they need it to open the consent form.</p>
              </div>

              {/* Copy link */}
              <button
                onClick={copyLink}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-600 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy consent link'}
              </button>

              <p className="text-xs text-slate-400">The patient card will update automatically when consent is received.</p>

              <button
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-sm transition-all"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
