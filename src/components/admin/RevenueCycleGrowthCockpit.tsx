"use client"

/* S8 — Revenue-Cycle Growth Cockpit.
 *
 * Four growth-lever cards: Denial-risk exposure · Days-in-AR · Charge-
 * capture gaps · Payer-mix concentration. Each card has a single primary
 * action and HITL accept / dismiss. Action emits an audit row under
 * resource='rcm_growth' so leadership can see what the AI surfaced and
 * what was acted on.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Check, X, ArrowRight, IndianRupee, AlertTriangle, BarChart3, Receipt, ShieldCheck } from "lucide-react"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"
import {
  findDenialRiskClaims, findDaysInAr, findChargeCaptureGaps, findPayerMixConcentration,
  type GrowthFinding,
} from "@/lib/revenueGrowth"

const ICONS: Record<string, React.ElementType> = {
  denial_risk_heatmap:     ShieldCheck,
  days_in_ar:              AlertTriangle,
  charge_capture_gaps:     Receipt,
  payer_mix_concentration: BarChart3,
}
const TONE_STYLES = {
  ok:     { ring: "ring-emerald-200/70", bg: "bg-gradient-to-br from-emerald-50/70 to-white", badge: "bg-emerald-100 text-emerald-700", iconWrap: "bg-emerald-100 text-emerald-700" },
  warn:   { ring: "ring-amber-200/70",   bg: "bg-gradient-to-br from-amber-50/70 to-white",    badge: "bg-amber-100 text-amber-800",     iconWrap: "bg-amber-100 text-amber-700" },
  danger: { ring: "ring-rose-200/70",    bg: "bg-gradient-to-br from-rose-50/70 to-white",     badge: "bg-rose-100 text-rose-700",       iconWrap: "bg-rose-100 text-rose-700" },
} as const

const FMT_INR = (n: number) => '₹' + (n >= 100000 ? (n / 100000).toFixed(2) + 'L' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n))

const RCM_DESTINATION: Record<string, string> = {
  denial_risk_heatmap:     '/insurance/dashboard',
  days_in_ar:              '/insurance/claims',
  charge_capture_gaps:     '/admin/finance',
  payer_mix_concentration: '/admin/finance',
}

export function RevenueCycleGrowthCockpit({ className }: { className?: string }) {
  const router = useRouter()
  const claims = useInsuranceStore((s) => s.claims)
  const bills   = useBillingStore((s) => s.bills)
  const audit   = useAuditStore((s) => s.log)
  const [dismissed, setDismissed] = useState<Record<string, true>>({})
  const [actioned,  setActioned]  = useState<Record<string, true>>({})

  const findings = useMemo<GrowthFinding[]>(() => {
    const c = (claims ?? []).map((x) => ({
      id: x.id,
      status: x.status,
      amount: x.amount,
      aiDenialRisk: x.aiDenialRisk ? { score: x.aiDenialRisk.score, reasons: x.aiDenialRisk.reasons } : undefined,
      submittedAt: x.submittedAt,
      submissionStatus: x.submissionStatus,
      documents: x.documents?.map((d) => ({ status: d.status })),
    }))
    const b = (bills ?? []).map((x) => ({
      id: x.id,
      status: x.status,
      subtotal: x.subtotal,
      patientDue: x.patientDue,
      insuranceCovered: x.insuranceCovered,
      visitType: x.visitType,
      dischargeDate: x.dischargeDate,
    }))
    return [findDenialRiskClaims(c), findDaysInAr(c), findChargeCaptureGaps(b), findPayerMixConcentration(c)]
  }, [claims, bills])

  const totalImpact = findings.reduce((s, f) => s + f.impactInr, 0)

  function accept(f: GrowthFinding) {
    audit({
      action: "hitl_accept",
      resource: "rcm_growth",
      resourceId: f.id,
      detail: `RCM growth lever actioned — ${f.title}: ${f.recommendation}`,
      userId: "user", userName: "Finance lead",
    })
    setActioned((m) => ({ ...m, [f.id]: true }))
    const dest = RCM_DESTINATION[f.id]
    if (dest) setTimeout(() => router.push(dest), 350)
  }
  function reject(f: GrowthFinding) {
    audit({
      action: "hitl_reject",
      resource: "rcm_growth",
      resourceId: f.id,
      detail: `RCM growth lever dismissed — ${f.title}`,
      userId: "user", userName: "Finance lead",
    })
    setDismissed((m) => ({ ...m, [f.id]: true }))
  }

  return (
    <section className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">Revenue-Cycle Growth Cockpit</h3>
        <span className="text-[11px] text-slate-500">Four levers · live over claims + billing</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-mono font-semibold text-[var(--color-accent)]">
          <IndianRupee className="h-3 w-3" /> {FMT_INR(totalImpact)} total opportunity
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
        {findings.map((f) => {
          if (dismissed[f.id]) return null
          const Icon = ICONS[f.id] ?? BarChart3
          const t = TONE_STYLES[f.tone]
          const isActioned = actioned[f.id]
          return (
            <article key={f.id} className={`rounded-xl ${t.bg} ring-1 ${t.ring} p-3 flex flex-col gap-2.5`}>
              <header className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${t.iconWrap}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-[12.5px] font-semibold text-slate-900">{f.title}</h4>
                <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${t.badge}`}>
                  {f.tone}
                </span>
              </header>

              <p className="text-[13.5px] font-semibold text-slate-900">{f.headline}</p>

              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-bold text-slate-900 leading-none">{f.metric.value}</span>
                {f.metric.unit ? <span className="text-[12px] text-slate-500">{f.metric.unit}</span> : null}
                {f.impactInr > 0 ? <span className="ml-2 text-[10.5px] font-mono text-emerald-700">+{FMT_INR(f.impactInr)} opp.</span> : null}
                <span className="ml-auto text-[10.5px] font-mono text-[var(--color-accent)]">{Math.round(f.confidence * 100)}% conf</span>
              </div>

              <ul className="text-[11.5px] text-slate-600 space-y-0.5 pl-3.5 list-disc marker:text-[var(--color-primary-light)]">
                {f.drivers.map((d, i) => <li key={i}>{d}</li>)}
              </ul>

              <div className="rounded-lg bg-white/80 ring-1 ring-slate-200/70 px-2.5 py-2 mt-auto">
                <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Recommended action</p>
                <p className="text-[12px] text-slate-800 leading-snug flex items-start gap-1.5">
                  <ArrowRight className="h-3 w-3 text-[var(--color-accent)] mt-0.5 flex-shrink-0" /> {f.recommendation}
                </p>
              </div>

              <footer className="flex items-center gap-2">
                {isActioned ? (
                  <ReasoningChip compact tone="ok" title="Actioned · audited" />
                ) : (
                  <>
                    <button type="button" onClick={() => reject(f)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                      <X className="h-3 w-3" /> Dismiss
                    </button>
                    <button type="button" onClick={() => accept(f)}
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
