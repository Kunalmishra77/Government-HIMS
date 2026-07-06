"use client"

import Link from "next/link"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import {
  Activity, BedDouble, Ambulance, Scissors, Stethoscope, IndianRupee,
  ShieldAlert, Users, Clock, ArrowUpRight, AlertTriangle, Sparkles,
} from "lucide-react"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useERStore } from "@/store/useERStore"
import { useOTStore } from "@/store/useOTStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { useHRStore } from "@/store/useHRStore"
import {
  bedMetrics, erMetrics, otMetrics, ipdMetrics, revenueMetrics, claimMetrics, staffMetrics, inr,
} from "@/lib/opsMetrics"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

function occColor(pct: number) {
  return pct >= 90 ? '#DC2626' : pct >= 75 ? '#D97706' : '#059669'
}

export default function CommandCenter() {
  const t = useTranslations('admin')
  // Live domain state (reactive — tiles update as the stores change).
  const beds = useAdmissionStore(s => s.beds)
  const erPatients = useERStore(s => s.patients)
  const procedures = useOTStore(s => s.procedures)
  const inpatients = useInpatientStore(s => s.inpatients)
  const bills = useBillingStore(s => s.bills)
  const claims = useInsuranceStore(s => s.claims)
  const staff = useHRStore(s => s.staff)

  // Tiles are reactive — they recompute whenever any source store changes.
  const bed = bedMetrics(beds)
  const er = erMetrics(erPatients)
  const ot = otMetrics(procedures)
  const ipd = ipdMetrics(inpatients)
  const rev = revenueMetrics(bills)
  const claim = claimMetrics(claims)
  const staffM = staffMetrics(staff)

  const highAcuityEr = erPatients.filter(p => p.phase !== 'disposed' && p.esi != null && p.esi <= 2)
  const dischargePending = inpatients.filter(i => i.stage === 'discharge_initiated' || i.condition === 'Discharge-ready')

  const tiles = [
    { label: t('cmdCenter.bedOccupancy'), value: `${bed.occupancyPct}%`, sub: t('cmdCenter.bedOccupancySub', { occupied: bed.occupied, total: bed.total, available: bed.available }), icon: BedDouble, tint: occColor(bed.occupancyPct) },
    { label: t('cmdCenter.erActive'), value: er.active, sub: t('cmdCenter.erActiveSub', { highAcuity: er.highAcuity, awaitingTriage: er.awaitingTriage }), icon: Ambulance, tint: er.highAcuity > 0 ? '#DC2626' : 'var(--color-primary)' },
    { label: t('cmdCenter.otInUse'), value: `${ot.utilizationPct}%`, sub: t('cmdCenter.otInUseSub', { inProgress: ot.inProgress, scheduled: ot.scheduled }), icon: Scissors, tint: 'var(--color-primary-dark)' },
    { label: t('cmdCenter.ipdCensus'), value: ipd.census, sub: t('cmdCenter.ipdCensusSub', { critical: ipd.critical, dischargePending: ipd.dischargePending }), icon: Stethoscope, tint: 'var(--color-primary)' },
    { label: t('cmdCenter.alos'), value: `${ipd.alosDays}d`, sub: t('cmdCenter.alosSub', { census: ipd.census }), icon: Clock, tint: '#475569' },
    { label: t('cmdCenter.collected'), value: inr(rev.collected), sub: t('cmdCenter.collectedSub', { outstanding: inr(rev.outstanding), openCount: rev.openCount }), icon: IndianRupee, tint: '#059669' },
    { label: t('cmdCenter.claimsAtRisk'), value: inr(claim.atRiskValue), sub: t('cmdCenter.claimsAtRiskSub', { pending: claim.pending, rejected: claim.rejected }), icon: ShieldAlert, tint: claim.atRiskValue > 0 ? '#D97706' : '#059669' },
    { label: t('cmdCenter.staffOnRoll'), value: staffM.active, sub: t('cmdCenter.staffOnRollSub', { onLeave: staffM.onLeave, total: staffM.total }), icon: Users, tint: 'var(--color-primary)' },
  ]

  const wardChart = bed.byWard.map(w => ({ ward: w.ward.replace(' Ward', '').replace(' Room', ''), pct: w.pct, label: `${w.occupied}/${w.total}` }))

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-600" />{t('cmdCenter.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('cmdCenter.subtitle')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden="true" />{t('cmdCenter.live')}
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{tile.label}</span>
              <tile.icon className="h-4 w-4" style={{ color: tile.tint }} aria-hidden="true" />
            </div>
            <p className="text-2xl font-black mt-1.5 tabular-nums" style={{ color: tile.tint }}>{tile.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{tile.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ward occupancy chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3">{t('cmdCenter.occupancyByWard')}</h2>
          {wardChart.length === 0 ? (
            <p className="text-xs text-slate-400 py-10 text-center">{t('cmdCenter.noBedData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220} aria-label={`Ward occupancy: ${bed.byWard.map(w => `${w.ward} ${w.pct}%`).join(', ')}`}>
              <BarChart data={wardChart} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                <YAxis type="category" dataKey="ward" width={90} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }}
                  formatter={(value, _name, item) => [
                    `${value}% (${(item as { payload?: { label?: string } })?.payload?.label ?? ''})`,
                    t('cmdCenter.occupied'),
                  ]}
                />
                <Bar dataKey="pct" radius={[0, 6, 6, 0]} barSize={18}>
                  {wardChart.map((w, i) => <Cell key={i} fill={occColor(w.pct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Needs attention now */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />{t('cmdCenter.needsAttention')}
          </h2>
          <div className="space-y-2">
            <WatchRow tone="red" show={highAcuityEr.length > 0}
              text={t('cmdCenter.watchHighAcuity', { count: highAcuityEr.length })} href="/emergency/dashboard" cta={t('cmdCenter.ctaErBoard')} />
            <WatchRow tone="red" show={er.awaitingDisposition > 0}
              text={t('cmdCenter.watchAwaitingDisposition', { count: er.awaitingDisposition })} href="/emergency/dashboard" cta={t('cmdCenter.ctaDecide')} />
            <WatchRow tone="amber" show={bed.occupancyPct >= 85}
              text={t('cmdCenter.watchBedOccupancy', { pct: bed.occupancyPct, available: bed.available, cleaning: bed.cleaning })} href="/admission/beds" cta={t('cmdCenter.ctaBeds')} />
            <WatchRow tone="amber" show={dischargePending.length > 0}
              text={t('cmdCenter.watchDischarge', { count: dischargePending.length })} href="/discharge/dashboard" cta={t('cmdCenter.ctaDischarge')} />
            <WatchRow tone="amber" show={claim.atRiskValue > 0}
              text={t('cmdCenter.watchClaims', { value: inr(claim.atRiskValue), pending: claim.pending })} href="/insurance/claims" cta={t('cmdCenter.ctaClaims')} />
            <WatchRow tone="slate" show={rev.outstanding > 0}
              text={t('cmdCenter.watchOutstanding', { value: inr(rev.outstanding), openCount: rev.openCount })} href="/admin/finance" cta={t('cmdCenter.ctaFinance')} />
            {highAcuityEr.length === 0 && er.awaitingDisposition === 0 && bed.occupancyPct < 85 && dischargePending.length === 0 && claim.atRiskValue === 0 && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 py-4"><Sparkles className="h-3.5 w-3.5 text-emerald-500" />{t('cmdCenter.allClear')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function WatchRow({ show, tone, text, href, cta }: {
  show: boolean; tone: 'red' | 'amber' | 'slate'; text: string; href: string; cta: string
}) {
  if (!show) return null
  const tint = tone === 'red'
    ? 'bg-red-50 border-red-200 text-red-800'
    : tone === 'amber' ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-slate-50 border-slate-200 text-slate-700'
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", tint)}>
      <p className="text-[12px] font-medium flex-1">{text}</p>
      <Link href={href} aria-label={`${cta} — ${text}`}
        className="inline-flex items-center gap-0.5 text-[11px] font-bold hover:underline whitespace-nowrap rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400">
        {cta}<ArrowUpRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  )
}
