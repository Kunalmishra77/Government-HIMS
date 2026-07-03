"use client"

import { useMemo } from "react"
import {
  ShieldCheck, Sparkles, CheckCircle, Clock, FileCheck2, FileWarning, MessageSquare,
  AlertTriangle, TrendingDown, Upload, Activity, Hourglass,
} from "lucide-react"
import { useInsuranceStore, type ClaimEvent, type InsuranceClaim } from "@/store/useInsuranceStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_TINT: Record<InsuranceClaim['status'], string> = {
  'Pending Pre-Auth': 'bg-amber-50 text-amber-700',
  'In Process': 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  'Approved': 'bg-emerald-50 text-emerald-700',
  'Rejected': 'bg-red-50 text-red-700',
}

const EVENT_ICONS: Record<ClaimEvent['kind'], { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  submitted: { icon: Hourglass, tone: 'text-amber-600' },
  queried: { icon: MessageSquare, tone: 'text-accent' },
  approved: { icon: CheckCircle, tone: 'text-emerald-600' },
  partially_approved: { icon: AlertTriangle, tone: 'text-amber-600' },
  rejected: { icon: AlertTriangle, tone: 'text-red-600' },
  document: { icon: Upload, tone: 'text-[var(--color-accent)]' },
  note: { icon: MessageSquare, tone: 'text-slate-500' },
}

const STAGES: { label: string; statuses: InsuranceClaim['status'][] }[] = [
  { label: 'Submitted',  statuses: ['Pending Pre-Auth', 'In Process', 'Approved', 'Rejected'] },
  { label: 'Pre-auth',   statuses: ['In Process', 'Approved', 'Rejected'] },
  { label: 'In review',  statuses: ['Approved', 'Rejected'] },
  { label: 'Resolved',   statuses: ['Approved', 'Rejected'] },
]

const dateOf = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function PatientInsurance() {
  const claims = useInsuranceStore(s => s.claims)
  const uploadDocument = useInsuranceStore(s => s.uploadDocument)
  const computeDenialRisk = useInsuranceStore(s => s.computeDenialRisk)
  const currentUser = useAuthStore(s => s.currentUser)
  const isPatient = currentUser?.role === 'patient'
  const id = isPatient ? currentUser.id : ''
  const name = isPatient ? currentUser.name : ''

  const mine = useMemo(
    () => claims.find(c => c.patientId === id || c.patientName === name),
    [claims, id, name],
  )

  if (!isPatient) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Insurance &amp; Claims</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your cashless coverage and claim status</p>
        </div>
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-6 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-bold text-amber-900">Patient view only</p>
        </div>
      </div>
    )
  }

  if (!mine) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Insurance &amp; Claims</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your cashless coverage and claim status</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-6 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No active claim on file</p>
          <p className="text-xs text-slate-500 mt-1">Once a claim is initiated by the insurance desk, it will appear here.</p>
        </div>
      </div>
    )
  }

  const docs = mine.documents ?? []
  const pending = docs.filter(d => d.status !== 'verified')
  const verified = docs.filter(d => d.status === 'verified')
  const docsCompleteness = docs.length ? Math.round((verified.length / docs.length) * 100) : 0
  const denialRisk = mine.aiDenialRisk
  const currentStageIdx = mine.status === 'Approved' || mine.status === 'Rejected' ? 3
                       : mine.status === 'In Process' ? 2
                       : mine.status === 'Pending Pre-Auth' ? 1 : 0

  const onUpload = (docId: string, docName: string) => {
    uploadDocument(mine.id, docId)
    toast.success(`${docName} uploaded — verified by AI`)
  }
  const onRunDenialAnalysis = () => {
    computeDenialRisk(mine.id)
    toast.success('Denial-risk analysis refreshed')
  }

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Insurance &amp; Claims</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your cashless coverage and claim status</p>
      </div>

      {/* Policy card */}
      <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] shadow-[0_10px_30px_rgba(238,107,38,0.25)]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /><span className="text-[13px] font-bold uppercase tracking-wider text-white/80">Cashless · Active</span></div>
          <span className="text-[13px] font-semibold text-white/90">{mine.provider}</span>
        </div>
        <p className="text-[13px] text-white/70 mt-4">Policy holder</p>
        <p className="text-[18px] font-bold">{mine.policyHolder ?? mine.patientName}</p>
        {mine.policyNumber && <p className="text-[11px] text-white/70 mt-0.5">Policy {mine.policyNumber}</p>}
        <div className="flex gap-8 mt-3 flex-wrap">
          {mine.sumInsured !== undefined && (
            <div><p className="text-[12px] text-white/70">Sum insured</p><p className="text-[16px] font-bold">₹{(mine.sumInsured / 100000).toFixed(1)}L</p></div>
          )}
          {mine.available !== undefined && (
            <div><p className="text-[12px] text-white/70">Available</p><p className="text-[16px] font-bold">₹{(mine.available / 100000).toFixed(1)}L</p></div>
          )}
          <div><p className="text-[12px] text-white/70">This claim</p><p className="text-[16px] font-bold">₹{mine.amount.toLocaleString('en-IN')}</p></div>
          {mine.approvedAmount !== undefined && (
            <div><p className="text-[12px] text-white/70">Approved</p><p className="text-[16px] font-bold">₹{mine.approvedAmount.toLocaleString('en-IN')}</p></div>
          )}
        </div>
      </div>

      {/* Claim pipeline + AI score */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-[15px] font-bold text-slate-900">Current claim · {mine.id}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', STATUS_TINT[mine.status])}>{mine.status}</span>
            {mine.aiProbability !== undefined && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center gap-1">
                <Sparkles className="h-3 w-3" />AI approval likelihood {mine.aiProbability}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center">
          {STAGES.map((s, i) => (
            <div key={s.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={cn('h-8 w-8 rounded-full flex items-center justify-center',
                  i <= currentStageIdx ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-400')}>
                  {i < currentStageIdx ? <CheckCircle className="h-4.5 w-4.5" /> : i === currentStageIdx ? <Clock className="h-4 w-4" /> : <span className="text-[12px] font-bold">{i + 1}</span>}
                </div>
                <span className={cn('text-[11px] font-semibold', i <= currentStageIdx ? 'text-[var(--color-accent)]' : 'text-slate-400')}>{s.label}</span>
              </div>
              {i < STAGES.length - 1 && <div className={cn('flex-1 h-0.5 mx-1 -mt-4 rounded', i < currentStageIdx ? 'bg-[var(--color-primary)]' : 'bg-slate-200')} />}
            </div>
          ))}
        </div>

        {/* AI denial-risk panel */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />AI denial risk
            </p>
            <button onClick={onRunDenialAnalysis}
              className="text-[10px] font-bold text-[var(--color-accent)] bg-white hover:bg-[rgba(238,107,38,0.10)] ring-1 ring-primary/25 px-2 py-0.5 rounded cursor-pointer">
              {denialRisk ? 'Refresh' : 'Run AI analysis'}
            </button>
          </div>
          {denialRisk ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={cn('text-lg font-bold',
                  denialRisk.score >= 70 ? 'text-red-700'
                  : denialRisk.score >= 40 ? 'text-amber-700' : 'text-emerald-700')}>{denialRisk.score}/100</span>
                <span className="text-[12px] text-slate-500">
                  {denialRisk.score >= 70 ? 'high risk · address quickly' : denialRisk.score >= 40 ? 'moderate · monitor' : 'low · trending to approval'}
                </span>
              </div>
              <ul className="text-[12px] text-slate-700 list-disc list-inside space-y-0.5">
                {denialRisk.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              <p className="text-[10px] text-slate-400 mt-1">Last computed {dateOf(denialRisk.computedAt)}</p>
            </div>
          ) : (
            <p className="text-[12px] text-slate-500 mt-1.5">Tap “Run AI analysis” to estimate the likelihood of TPA denial and the levers to reduce it.</p>
          )}
        </div>
      </div>

      {/* Treatment summary */}
      {mine.diagnosis && (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
            <Activity className="h-3 w-3" />Treatment claimed
          </p>
          <p className="text-[14px] font-bold text-slate-900 mt-1">{mine.diagnosis}</p>
          {mine.treatmentSummary && <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{mine.treatmentSummary}</p>}
        </div>
      )}

      {/* Documents */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-[15px] font-bold text-slate-900">Documents</h3>
          <span className="text-[11px] font-bold text-slate-500">
            {docsCompleteness}% complete · {verified.length}/{docs.length}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${docsCompleteness}%` }} />
        </div>
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
              <span className="flex items-center gap-2.5 text-[14px] text-slate-800">
                {d.status === 'verified' ? <FileCheck2 className="h-4.5 w-4.5 text-green-600" />
                  : d.status === 'rejected' ? <FileWarning className="h-4.5 w-4.5 text-red-500" />
                  : <FileWarning className="h-4.5 w-4.5 text-amber-500" />}
                {d.name}
                {d.rejectionReason && <span className="text-[10px] text-red-600">{d.rejectionReason}</span>}
              </span>
              {d.status === 'verified'
                ? <span className="text-[12px] font-semibold text-green-600">Verified · {dateOf(d.uploadedAt).split(' ').slice(0, 2).join(' ')}</span>
                : (
                  <button onClick={() => onUpload(d.id, d.name)}
                    className="text-[12.5px] font-semibold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1">
                    <Upload className="h-3 w-3" />Upload
                  </button>
                )}
            </div>
          ))}
        </div>
        {pending.length > 0 && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50 text-[12px] text-amber-800 flex items-start gap-2">
            <TrendingDown className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            Each verified document lowers your denial risk and accelerates the claim.
          </div>
        )}
      </div>

      {/* Timeline */}
      {(mine.timeline ?? []).length > 0 && (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
          <h3 className="text-[15px] font-bold text-slate-900 mb-3">Claim activity</h3>
          <div className="space-y-2.5">
            {mine.timeline!.slice().reverse().map((e, i) => {
              const cfg = EVENT_ICONS[e.kind]
              const Icon = cfg.icon
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', cfg.tone)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-800">{e.label}</p>
                    <p className="text-[11px] text-slate-400">{e.actor} · {dateOf(e.at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
