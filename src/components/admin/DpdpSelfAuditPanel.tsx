"use client"

/* S10 — DPDP / DISHA Self-Audit Panel.
 *
 * Scores the hospital's own data-protection posture across five DPDP /
 * DISHA principles and surfaces remediation per principle. HITL action
 * is audit-logged under resource='dpdp_audit' so the DPO can show the
 * regulator exactly what was flagged and what was actioned.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Check, X, ShieldCheck, ArrowRight, Lock, Eye, Trash2, AlertTriangle, Users } from "lucide-react"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"
import { scoreAllDimensions, overallDpdpScore, type DpdpDimension } from "@/lib/dpdpAudit"

const ICONS: Record<DpdpDimension["id"], React.ElementType> = {
  consent_rate:     ShieldCheck,
  rtbf_sla:         Trash2,
  export_audit:     Eye,
  breach_response:  AlertTriangle,
  rbac_discipline:  Users,
}
const TONE_STYLES = {
  ok:     { ring: "ring-emerald-200/70", bg: "bg-gradient-to-br from-emerald-50/70 to-white", badge: "bg-emerald-100 text-emerald-700", iconWrap: "bg-emerald-100 text-emerald-700", score: "text-emerald-700" },
  warn:   { ring: "ring-amber-200/70",   bg: "bg-gradient-to-br from-amber-50/70 to-white",    badge: "bg-amber-100 text-amber-800",     iconWrap: "bg-amber-100 text-amber-700", score: "text-amber-700" },
  danger: { ring: "ring-rose-200/70",    bg: "bg-gradient-to-br from-rose-50/70 to-white",     badge: "bg-rose-100 text-rose-700",       iconWrap: "bg-rose-100 text-rose-700", score: "text-rose-700" },
} as const

const DPDP_DESTINATION: Record<string, string> = {
  consent_rate:     '/admin/disha',
  rtbf_sla:         '/admin/disha',
  export_audit:     '/audit/log',
  breach_response:  '/admin/disha',
  rbac_discipline:  '/audit/log',
}

export function DpdpSelfAuditPanel({ className }: { className?: string }) {
  const router  = useRouter()
  const entries = useAuditStore((s) => s.entries)
  const audit    = useAuditStore((s) => s.log)
  const [actioned,  setActioned]  = useState<Record<string, true>>({})
  const [dismissed, setDismissed] = useState<Record<string, true>>({})

  const dims = useMemo<DpdpDimension[]>(() => scoreAllDimensions(entries), [entries])
  const overall = overallDpdpScore(dims)
  const overallTone = overall >= 80 ? "ok" : overall >= 50 ? "warn" : "danger"

  function accept(d: DpdpDimension) {
    audit({
      action: "hitl_accept",
      resource: "dpdp_audit",
      resourceId: d.id,
      detail: `DPDP self-audit actioned — ${d.title} (score ${d.score}): ${d.recommendation}`,
      userId: "user", userName: "DPO",
    })
    setActioned((m) => ({ ...m, [d.id]: true }))
    const dest = DPDP_DESTINATION[d.id]
    if (dest) setTimeout(() => router.push(dest), 350)
  }
  function reject(d: DpdpDimension) {
    audit({
      action: "hitl_reject",
      resource: "dpdp_audit",
      resourceId: d.id,
      detail: `DPDP self-audit suggestion dismissed — ${d.title} (score ${d.score}).`,
      userId: "user", userName: "DPO",
    })
    setDismissed((m) => ({ ...m, [d.id]: true }))
  }

  return (
    <section className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">DPDP / DISHA Self-Audit</h3>
        <span className="text-[11px] text-slate-500">Five principles · live over audit trail</span>
        <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${TONE_STYLES[overallTone].badge}`}>
          <Lock className="h-3 w-3" /> {overall}/100 overall
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        {dims.map((d) => {
          if (dismissed[d.id]) return null
          const Icon = ICONS[d.id] ?? ShieldCheck
          const t = TONE_STYLES[d.tone]
          const isActioned = actioned[d.id]
          return (
            <article key={d.id} className={`rounded-xl ${t.bg} ring-1 ${t.ring} p-3 flex flex-col gap-2`}>
              <header className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${t.iconWrap}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-[12.5px] font-semibold text-slate-900">{d.title}</h4>
                <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${t.badge}`}>
                  {d.tone}
                </span>
              </header>

              <div className="flex items-baseline gap-2">
                <span className={`text-[28px] font-bold leading-none ${t.score}`}>{d.score}</span>
                <span className="text-[11px] text-slate-500">/100</span>
                <span className="ml-auto text-[10.5px] font-mono text-slate-500">{d.metric.value}{d.metric.unit ? ' ' + d.metric.unit : ''}</span>
              </div>

              <ul className="text-[11.5px] text-slate-600 space-y-0.5 pl-3.5 list-disc marker:text-[var(--color-primary-light)]">
                {d.drivers.map((line, i) => <li key={i}>{line}</li>)}
              </ul>

              <div className="rounded-lg bg-white/80 ring-1 ring-slate-200/70 px-2.5 py-2 mt-auto">
                <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Recommended action</p>
                <p className="text-[12px] text-slate-800 leading-snug flex items-start gap-1.5">
                  <ArrowRight className="h-3 w-3 text-[var(--color-accent)] mt-0.5 flex-shrink-0" /> {d.recommendation}
                </p>
              </div>

              <footer className="flex items-center gap-2">
                {isActioned ? (
                  <ReasoningChip compact tone="ok" title="Actioned · audited" />
                ) : (
                  <>
                    <button type="button" onClick={() => reject(d)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                      <X className="h-3 w-3" /> Dismiss
                    </button>
                    <button type="button" onClick={() => accept(d)}
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
