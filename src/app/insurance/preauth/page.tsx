"use client"

import { useState } from "react"
import { draftPreAuth } from "@/ai-services/insurance-preauth"
import type { PreAuthDraft } from "@/ai-services/insurance-preauth"
import type { AiEnvelope } from "@/types/ai"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { Bot, Loader2, ShieldCheck, IndianRupee } from "lucide-react"
import { toast } from "sonner"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"

const PENDING_ADMISSIONS = [
  { id: 'ADM-2026-0089', patient: 'Kiran Patil', diagnosis: 'Community Acquired Pneumonia', insurer: 'Star Health' },
  { id: 'ADM-2026-0091', patient: 'Meena Devi', diagnosis: 'Knee Osteoarthritis — TKR Planned', insurer: 'HDFC ERGO' },
  { id: 'ADM-2026-0094', patient: 'Rajesh Kumar', diagnosis: 'Acute Appendicitis', insurer: 'Niva Bupa' },
]

const PENDING_AYUSHMAN = [
  {
    id: 'ADM-2026-0097',
    patient: 'Sunita Devi',
    abhaId: '14-8821-3341-7090',
    schemeName: 'AB-PMJAY' as const,
    preAuthRef: 'PMJAY-PRE-4729103',
    diagnosis: 'Uterine Fibroid — Laparoscopic Myomectomy',
    coverage: 'Covered up to ₹5,00,000/year',
  },
  {
    id: 'ADM-2026-0099',
    patient: 'Ramesh Yadav',
    abhaId: '14-3312-8891-0041',
    schemeName: 'CMHIS-UP' as const,
    preAuthRef: 'CMHIS-PRE-8812047',
    diagnosis: 'Cataract — Phacoemulsification',
    coverage: 'Covered up to ₹5,00,000/year (CMHIS-UP)',
  },
]

export default function InsurancePreAuthPage() {
  const [draft, setDraft] = useState<AiEnvelope<PreAuthDraft> | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState<string[]>([])
  const [ayushmanSubmitted, setAyushmanSubmitted] = useState<string[]>([])
  const [ayushmanLoading, setAyushmanLoading] = useState<string | null>(null)

  const generate = async (admissionId: string) => {
    setLoading(true)
    setDraft(null)
    const result = await draftPreAuth(admissionId)
    setDraft(result)
    setLoading(false)
  }

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pre-Authorisation Drafts</h2>
        <p className="text-slate-500 text-sm mt-1">AI-drafted pre-auth letters — insurance coordinator review required</p>
      </div>

      <div className="space-y-3">
        {PENDING_ADMISSIONS.map((adm) => (
          <div key={adm.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{adm.patient}</p>
                <p className="text-xs text-slate-500">{adm.id} · {adm.insurer}</p>
                <p className="text-xs text-slate-400 mt-0.5">{adm.diagnosis}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {submitted.includes(adm.id) && (
                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-full">Submitted</span>
              )}
              <button
                onClick={() => generate(adm.id)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                Draft Pre-Auth
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Ayushman / Govt Scheme Pre-Auth */}
      <div className="mt-8">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Govt Scheme Pre-Auth (Ayushman)</h3>
        <p className="text-slate-500 text-sm mb-4">AB-PMJAY and CMHIS-UP patients awaiting NHA pre-authorisation</p>
        <div className="space-y-3">
          {PENDING_AYUSHMAN.map((adm) => (
            <div key={adm.id} className="bg-white rounded-xl border border-primary/20 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-sm">{adm.patient}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-soft text-accent border border-primary/20">
                      {adm.schemeName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{adm.id} · ABHA: {adm.abhaId}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{adm.diagnosis}</p>
                  <p className="text-xs text-accent mt-0.5 font-medium">{adm.coverage}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {ayushmanSubmitted.includes(adm.id) ? (
                  <div className="text-right">
                    <span className="text-xs font-bold text-accent bg-primary-soft border border-primary/20 px-2 py-1 rounded-full">Submitted</span>
                    <p className="text-[10px] text-slate-400 mt-1">Ref: {adm.preAuthRef}</p>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setAyushmanLoading(adm.id)
                      await new Promise(r => setTimeout(r, 900))
                      setAyushmanSubmitted(prev => [...prev, adm.id])
                      setAyushmanLoading(null)
                      notifyAndAuditMany(['billing', 'patient'], {
                        type: 'system', priority: 'high',
                        title: `Ayushman pre-auth submitted · ${adm.id}`,
                        body: `Pre-auth submitted to NHA for ${adm.patient} (${adm.schemeName}). Ref: ${adm.preAuthRef}.`,
                        audit: {
                          action: 'insurance_claim_submitted',
                          resource: 'preauth',
                          resourceId: adm.id,
                          detail: `Ayushman pre-auth submitted · ref ${adm.preAuthRef}`,
                          userName: 'Insurance desk',
                        },
                      })
                      toast.success(`Pre-auth submitted · ref ${adm.preAuthRef}`)
                    }}
                    disabled={ayushmanLoading === adm.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-60 transition-colors"
                  >
                    {ayushmanLoading === adm.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <ShieldCheck className="h-3.5 w-3.5" />}
                    Submit to NHA
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {draft && (
        <HitlReviewCard
          envelope={draft}
          title="AI Pre-Authorization Draft"
          featureId="insurance-preauth"
          renderContent={(d) => (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-bold text-slate-500 uppercase tracking-wide mb-1">Insurer ID</p>
                  <p className="text-slate-800 font-semibold">{d.insurerId}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-bold text-slate-500 uppercase tracking-wide mb-1">Policy Number</p>
                  <p className="text-slate-800 font-semibold">{d.policyNumber}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">ICD-10 Diagnosis Codes</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.diagnosisCodes.map((c, i) => (
                    <span key={i} className="text-xs bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] px-2 py-0.5 rounded border border-[rgba(238,107,38,0.20)] font-mono">{c}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Planned Procedures</p>
                <ul className="space-y-1">
                  {d.plannedProcedures.map((p, i) => (
                    <li key={i} className="text-xs text-slate-700 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-light)] flex-shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <IndianRupee className="h-4 w-4 text-green-700 flex-shrink-0" />
                <div className="flex gap-6 text-xs">
                  <div>
                    <p className="text-slate-500 font-medium">Estimated Cost</p>
                    <p className="font-black text-slate-900 text-base">₹{d.estimatedCost.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Requested Amount</p>
                    <p className="font-black text-green-700 text-base">₹{d.requestedAmount.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Clinical Justification</p>
                <p className="text-slate-700 leading-relaxed text-xs">{d.clinicalJustification}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Attachments Required</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.attachmentsRequired.map((a, i) => (
                    <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          onAccept={() => {
            if (draft.data.admissionId) {
              setSubmitted((prev) => [...prev, draft.data.admissionId])
              notifyAndAuditMany(['billing', 'patient'], {
                type: 'system', priority: 'high',
                title: `Pre-auth submitted · ${draft.data.admissionId}`,
                body: `Pre-authorisation letter submitted to insurer ${draft.data.insurerId}. Tracking ID: TPA-${Date.now().toString(36).toUpperCase()}.`,
                audit: { action: 'insurance_claim_submitted', resource: 'preauth', resourceId: draft.data.admissionId, detail: `Pre-auth submitted to ${draft.data.insurerId}`, userName: 'Insurance desk' },
              })
            }
            setDraft(null)
            toast.success('Pre-auth submitted to insurer · billing + patient notified')
          }}
          onReject={() => {
            setDraft(null)
            toast.info('Draft rejected — coordinator will draft manually')
          }}
        />
      )}
    </div>
  )
}
