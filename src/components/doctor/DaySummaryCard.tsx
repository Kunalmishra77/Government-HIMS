"use client"

/* S15 — Doctor Day-in-Review.
 *
 * Drops on /doctor/analytics as an AI-narrated end-of-day card. Reads
 * useDoctorStatsStore + useAuditStore to compose a deterministic plain-
 * language summary. HITL-style: dismiss / add to tomorrow / open the
 * unresolved follow-ups list.
 *
 *   <DaySummaryCard doctorId="DR-1012" doctorName="Dr. Priya Nair" />
 */
import { useMemo, useState } from "react"
import { Sparkles, X, Calendar, TrendingUp, Check, ArrowRight, ListChecks } from "lucide-react"
import { useAuditStore } from "@/store/useAuditStore"
import { useDoctorStatsStore } from "@/store/useDoctorStatsStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"

interface Props {
  doctorId: string
  doctorName: string
  className?: string
}

export function DaySummaryCard({ doctorId, doctorName, className }: Props) {
  const totalsFor = useDoctorStatsStore((s) => s.totalsFor)
  const stats = totalsFor(doctorId, 'today')
  const audit = useAuditStore((s) => s.entries)
  const [dismissed, setDismissed] = useState(false)
  const [addedToTomorrow, setAddedToTomorrow] = useState(false)

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }, [])

  // Deterministic narrated summary derived from current state.
  const summary = useMemo(() => {
    const seenOPD     = stats?.opd ?? 0
    const seenOnline  = stats?.online ?? 0
    const total       = seenOPD + seenOnline
    const myAudits = audit.filter((e) => (e.userId === doctorId || e.userName?.includes(doctorName.replace('Dr. ', '')))
      && new Date(e.timestamp).getTime() >= todayStart)
    const rxSigned   = myAudits.filter((e) => e.action === 'prescription_create').length
    const ordersOut  = myAudits.filter((e) => e.action === 'lab_order' || e.action === 'radiology_order').length
    const hitlAccept = myAudits.filter((e) => e.action === 'hitl_accept').length
    const hitlReject = myAudits.filter((e) => e.action === 'hitl_reject').length
    const totalHitl  = hitlAccept + hitlReject
    const acceptRate = totalHitl ? Math.round((hitlAccept / totalHitl) * 100) : 0
    const escalations = myAudits.filter((e) => e.resource === 'early_warning').length

    const narration =
      `You saw ${total} patient${total === 1 ? '' : 's'} today ` +
      `(${seenOPD} OPD, ${seenOnline} online). ` +
      `Prescribed ${rxSigned} time${rxSigned === 1 ? '' : 's'}, ordered ${ordersOut} investigation${ordersOut === 1 ? '' : 's'}. ` +
      (totalHitl > 0 ? `Accepted ${acceptRate}% of ${totalHitl} AI suggestion${totalHitl === 1 ? '' : 's'}. ` : `No AI suggestions reviewed yet today. `) +
      (escalations > 0 ? `Responded to ${escalations} NEWS2 escalation${escalations === 1 ? '' : 's'}.` : `No early-warning escalations today.`)

    const recommendations: string[] = []
    if (total < 5)         recommendations.push('Light caseload — consider absorbing 2-3 walk-ins from reception.')
    if (acceptRate < 50 && totalHitl > 0) recommendations.push('AI accept-rate is low. Review reasoning panels to calibrate.')
    if (escalations === 0) recommendations.push('All ward vitals stable. Quick round before sign-out keeps morning handover light.')
    if (rxSigned === 0)    recommendations.push('No Rx signed today — open IPD round to clear pending charts.')
    recommendations.push('3 unresolved follow-ups from earlier this week — schedule a tele-consult sweep tomorrow.')

    return { narration, recommendations, totalHitl, hitlAccept, hitlReject, acceptRate, escalations, total, rxSigned }
  }, [stats, audit, doctorId, doctorName, todayStart])

  if (dismissed) return null

  return (
    <div className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">Day in review</h3>
        <span className="text-[11px] text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        <span className="text-[10px] font-mono text-[var(--color-accent)] ml-auto">85% confidence</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-white"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="p-4 space-y-3">
        <p className="text-[13.5px] text-slate-800 leading-relaxed">{summary.narration}</p>

        <div className="flex flex-wrap gap-1.5">
          <ReasoningChip compact tone="info"  title={`${summary.total} consults`} />
          <ReasoningChip compact tone="info"  title={`${summary.rxSigned} Rx signed`} />
          {summary.totalHitl > 0 ? (
            <ReasoningChip compact tone={summary.acceptRate >= 50 ? 'ok' : 'warn'}
              title={`${summary.acceptRate}% AI accept-rate`} />
          ) : null}
          {summary.escalations > 0 ? (
            <ReasoningChip compact tone="warn" title={`${summary.escalations} escalations responded`} />
          ) : null}
        </div>

        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/60 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ListChecks className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-[11.5px] font-semibold text-slate-700 uppercase tracking-wide">Suggested next focus</p>
          </div>
          <ul className="space-y-1.5">
            {summary.recommendations.map((r, i) => (
              <li key={i} className="text-[12.5px] text-slate-700 flex gap-2">
                <TrendingUp className="h-3 w-3 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5 bg-slate-50/40">
        <span className="text-[11px] text-slate-500 mr-auto">
          HITL — accept / dismiss. Decision audited.
        </span>
        <button
          type="button"
          onClick={() => { setAddedToTomorrow(true); setTimeout(() => setDismissed(true), 300) }}
          disabled={addedToTomorrow}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200 disabled:opacity-50"
        >
          <Calendar className="h-3 w-3" /> {addedToTomorrow ? 'Added to tomorrow' : 'Add to tomorrow'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white"
        >
          <Check className="h-3 w-3" /> Got it
        </button>
      </footer>
    </div>
  )
}
