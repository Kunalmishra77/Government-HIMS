"use client"

import { useInsuranceStore } from "@/store/useInsuranceStore"
import { VisibilityHeader, STAT_CARD } from "@/components/reception/VisibilityHeader"
import { ShieldCheck, Clock, CheckCircle2, FileText, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const STATUS_TINT: Record<string, string> = {
  'Approved': 'bg-green-50 text-green-700',
  'Rejected': 'bg-red-50 text-red-600',
  'In Process': 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  'Pending Pre-Auth': 'bg-amber-50 text-amber-700',
}
const STATUS_KEY: Record<string, string> = {
  'Approved': 'statusApproved',
  'Rejected': 'statusRejected',
  'In Process': 'statusInProcess',
  'Pending Pre-Auth': 'statusPendingPreAuth',
}

export default function ReceptionTPA() {
  const t = useTranslations('reception')
  const claims = useInsuranceStore(s => s.claims)
  const totalClaimsValue = useInsuranceStore(s => s.totalClaimsValue)

  const approved = claims.filter(c => c.status === 'Approved').length
  const pendingApprovals = claims.filter(c => c.status === 'Pending Pre-Auth' || c.status === 'In Process').length

  const tiles = [
    { label: t('tpa.tileClaimsValue'),    value: `₹${(totalClaimsValue / 100000).toFixed(1)}L`, icon: FileText,     tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('tpa.tilePendingApprovals'), value: `${pendingApprovals}`,                        icon: Clock,        tint: 'bg-amber-50 text-amber-600' },
    { label: t('tpa.tileApproved'),        value: `${approved}`,                                  icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
    { label: t('tpa.tileActiveClaims'),   value: `${claims.length}`,                             icon: ShieldCheck,  tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  ]

  return (
    <div className="pb-6">
      <VisibilityHeader title={t('tpa.title')} subtitle={t('tpa.subtitle')} owner={t('tpa.owner')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {tiles.map(t => (
          <div key={t.label} className={STAT_CARD}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.tint)}><t.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[20px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{t.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {claims.filter(c => c.approvalStage !== 'settled' && c.approvalStage !== 'rejected').map(c => (
          <div key={c.id} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-[14.5px] font-bold text-slate-900">{c.patientName}</p>
                  <p className="text-[12px] text-slate-500">{c.provider} · ₹{c.amount.toLocaleString('en-IN')}{c.tpaReferenceId ? ` · ${c.tpaReferenceId}` : ''}</p>
                </div>
              </div>
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", STATUS_TINT[c.status] ?? 'bg-slate-100 text-slate-600')}>{STATUS_KEY[c.status] ? t(`tpa.${STATUS_KEY[c.status]}`) : c.status}</span>
            </div>

            {typeof c.aiProbability === 'number' && (
              <div className="mt-3 rounded-xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-[var(--color-primary-dark)] flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {t('tpa.aiApprovalLikelihood')}</span>
                  <span className="text-[12px] font-bold text-[var(--color-accent)]">{c.aiProbability}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(238,107,38,0.12)] overflow-hidden">
                  <div className={cn("h-full rounded-full", c.aiProbability >= 80 ? "bg-green-500" : c.aiProbability >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${c.aiProbability}%` }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
