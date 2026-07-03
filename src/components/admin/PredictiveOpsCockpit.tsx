"use client"

/* S7 — Predictive Operations Cockpit.
 *
 * Forward-looking 4-card grid: ED arrivals · OR utilisation · ICU pressure
 * · Staffing gap. Each card carries headline + metric + reasoning + a
 * suggested action with HITL accept / dismiss. Acceptance is audit-logged
 * (resource='ops_prediction') so the trail shows which AI suggestion the
 * ops manager actioned and which they ignored.
 *
 *   <PredictiveOpsCockpit />
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, TrendingUp, ArrowRight, Check, X, Activity, Bed, ScissorsLineDashed, Users } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useOTStore } from "@/store/useOTStore"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"
import {
  predictEdArrivals, predictOrUtilisation, predictIcuPressure, predictStaffingGap,
  type OpsPrediction,
} from "@/lib/predictiveOps"

const ICONS: Record<string, React.ElementType> = {
  ed_arrivals_4h: Activity,
  or_utilisation_24h: ScissorsLineDashed,
  icu_pressure: Bed,
  staffing_gap: Users,
}
const TONE_STYLES = {
  ok:     { ring: "ring-emerald-200/70", bg: "bg-gradient-to-br from-emerald-50/70 to-white",  badge: "bg-emerald-100 text-emerald-700", iconWrap: "bg-emerald-100 text-emerald-700" },
  warn:   { ring: "ring-amber-200/70",   bg: "bg-gradient-to-br from-amber-50/70 to-white",     badge: "bg-amber-100 text-amber-800",     iconWrap: "bg-amber-100 text-amber-700" },
  danger: { ring: "ring-rose-200/70",    bg: "bg-gradient-to-br from-rose-50/70 to-white",      badge: "bg-rose-100 text-rose-700",       iconWrap: "bg-rose-100 text-rose-700" },
} as const

// M11-F — each forecaster's "Action" routes to the operational surface
// where the manager can do something about it.
const OPS_DESTINATION: Record<string, { route: string; label: string }> = {
  ed_arrivals_4h:     { route: '/emergency/triage',  label: 'Open ER triage to pre-position staff' },
  or_utilisation_24h: { route: '/ot/schedule',        label: 'Open OT schedule to pull cases forward / defer' },
  icu_pressure:       { route: '/admission/beds',     label: 'Open bed map to flag step-down candidates' },
  staffing_gap:       { route: '/admin/roster',       label: 'Open roster to fill gap with floating pool' },
}

export function PredictiveOpsCockpit({ className }: { className?: string }) {
  const router      = useRouter()
  const patients   = usePatientStore((s) => s.patients)
  const inpatients = useInpatientStore((s) => s.inpatients)
  const otCases    = useOTStore((s) => s.procedures)
  const audit       = useAuditStore((s) => s.log)
  const [dismissed, setDismissed] = useState<Record<string, true>>({})
  const [actioned,   setActioned]  = useState<Record<string, true>>({})

  const predictions = useMemo<OpsPrediction[]>(() => {
    return [
      predictEdArrivals(patients ?? []),
      predictOrUtilisation((otCases ?? []).map(c => ({ id: c.id, status: c.status, scheduledTime: c.scheduledTime, durationMinutes: c.durationMinutes })), 4),
      predictIcuPressure((inpatients ?? []).map(i => ({ patientId: i.patientId, condition: i.condition, ward: i.ward })), 12),
      predictStaffingGap(28, 31),     // Phase-2: read useHRStore.duty + leaveStore. Static demo numbers for now.
    ]
  }, [patients, inpatients, otCases])

  function accept(p: OpsPrediction) {
    audit({
      action: "hitl_accept",
      resource: "ops_prediction",
      resourceId: p.id,
      detail: `Ops prediction actioned — ${p.title}: ${p.recommendation}`,
      userId: "user", userName: "Ops manager",
    })
    setActioned((m) => ({ ...m, [p.id]: true }))
    const dest = OPS_DESTINATION[p.id]
    if (dest) {
      // Slight delay so the user sees the "Actioned · audited" chip flip before navigating.
      setTimeout(() => router.push(dest.route), 350)
    }
  }
  function reject(p: OpsPrediction) {
    audit({
      action: "hitl_reject",
      resource: "ops_prediction",
      resourceId: p.id,
      detail: `Ops prediction dismissed — ${p.title}`,
      userId: "user", userName: "Ops manager",
    })
    setDismissed((m) => ({ ...m, [p.id]: true }))
  }

  return (
    <section className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">Predictive Operations Cockpit</h3>
        <span className="text-[11px] text-slate-500">Live forecast over current state</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--color-accent)]">
          <Sparkles className="h-3 w-3" /> HITL — accept or dismiss
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
        {predictions.map((p) => {
          if (dismissed[p.id]) return null
          const Icon = ICONS[p.id] ?? TrendingUp
          const t = TONE_STYLES[p.tone]
          const isActioned = actioned[p.id]
          return (
            <article key={p.id} className={`rounded-xl ${t.bg} ring-1 ${t.ring} p-3 flex flex-col gap-2.5`}>
              <header className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${t.iconWrap}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-[12.5px] font-semibold text-slate-900">{p.title}</h4>
                <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${t.badge}`}>
                  {p.tone}
                </span>
              </header>

              <p className="text-[13.5px] font-semibold text-slate-900">{p.headline}</p>

              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold text-slate-900 leading-none">{p.metric.value}</span>
                {p.metric.unit ? <span className="text-[12px] text-slate-500">{p.metric.unit}</span> : null}
                {typeof p.metric.deltaPct === 'number' && p.metric.deltaPct !== 0 ? (
                  <span className={`text-[10.5px] font-mono ml-1 ${p.metric.deltaPct > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {p.metric.deltaPct > 0 ? '+' : ''}{p.metric.deltaPct}%
                  </span>
                ) : null}
                <span className="ml-auto text-[10.5px] font-mono text-[var(--color-accent)]">{Math.round(p.confidence * 100)}% conf</span>
              </div>

              <ul className="text-[11.5px] text-slate-600 space-y-0.5 pl-3.5 list-disc marker:text-[var(--color-primary-light)]">
                {p.drivers.map((d, i) => <li key={i}>{d}</li>)}
              </ul>

              <div className="rounded-lg bg-white/80 ring-1 ring-slate-200/70 px-2.5 py-2 mt-auto">
                <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Suggested action</p>
                <p className="text-[12px] text-slate-800 leading-snug flex items-start gap-1.5">
                  <ArrowRight className="h-3 w-3 text-[var(--color-accent)] mt-0.5 flex-shrink-0" /> {p.recommendation}
                </p>
              </div>

              <footer className="flex items-center gap-2">
                {isActioned ? (
                  <ReasoningChip compact tone="ok" title="Actioned · audited" />
                ) : (
                  <>
                    <button type="button" onClick={() => reject(p)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                      <X className="h-3 w-3" /> Dismiss
                    </button>
                    <button type="button" onClick={() => accept(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white ml-auto">
                      <Check className="h-3 w-3" /> Action
                    </button>
                  </>
                )}
              </footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}
