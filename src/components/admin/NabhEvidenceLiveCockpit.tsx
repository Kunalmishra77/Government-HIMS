"use client"

/* S9 — NABH Evidence Live Cockpit.
 *
 * Renders a card per NABH chapter showing live evidence coverage from the
 * audit trail (via buildNabhEvidence). Each card surfaces:
 *   - chapter title + blurb
 *   - count of evidence events recorded
 *   - the freshest evidence event (so the auditor sees what was logged)
 *   - an AI-suggested NEXT-action when count is low ("you need at least
 *     one X to satisfy this chapter")
 *   - HITL accept → opens the closest matching surface; dismiss → audited.
 *
 *   <NabhEvidenceLiveCockpit />
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Sparkles, Check, X, ShieldCheck, FileText, AlertTriangle, ChevronRight } from "lucide-react"
import { useAuditStore } from "@/store/useAuditStore"
import { buildNabhEvidence, type NabhChapterEvidence } from "@/lib/nabhEvidence"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"

// Per-chapter remediation surface — where to jump if the auditor accepts.
const REMEDIATION: Record<string, { route: string; label: string; nextAction: string }> = {
  AAC: { route: "/admission/dashboard",      label: "Admission desk",            nextAction: "Log a fresh triage / admission / transfer / discharge event." },
  COP: { route: "/doctor/ipd",                label: "Doctor IPD",                  nextAction: "Place a prescription / lab / radiology / OT-checklist event." },
  MOM: { route: "/pharmacy/queue",            label: "Pharmacy queue",              nextAction: "Dispense or substitute a drug — captures the audit row." },
  HIC: { route: "/bmw/dashboard",             label: "BMW dashboard",               nextAction: "Log waste pickup / CSSD cycle / housekeeping turnover." },
  PRE: { route: "/insurance/dashboard",       label: "Insurance + DPDP",            nextAction: "Capture consent / upload insurance docs / run denial-risk." },
  IMS: { route: "/doctor/dashboard",          label: "Doctor dashboard",            nextAction: "Accept or modify an AI suggestion — HITL events count here." },
  CQI: { route: "/quality/dashboard",         label: "Quality dashboard",           nextAction: "File an incident report and close it with CAPA." },
  ROM: { route: "/ot/dashboard",              label: "OT dashboard",                nextAction: "Resolve a count / declare an MCI / issue blood — these flow here." },
  HRM: { route: "/admin/roster",              label: "Admin roster",                nextAction: "Set a shift / approve a leave — HR events satisfy this chapter." },
}

function tone(count: number): "ok" | "warn" | "danger" {
  if (count >= 5) return "ok"
  if (count >= 1) return "warn"
  return "danger"
}
const TONE_STYLES = {
  ok:     { ring: "ring-emerald-200/70", bg: "bg-gradient-to-br from-emerald-50/70 to-white",  badge: "bg-emerald-100 text-emerald-700", iconWrap: "bg-emerald-100 text-emerald-700" },
  warn:   { ring: "ring-amber-200/70",   bg: "bg-gradient-to-br from-amber-50/70 to-white",     badge: "bg-amber-100 text-amber-800",     iconWrap: "bg-amber-100 text-amber-700" },
  danger: { ring: "ring-rose-200/70",    bg: "bg-gradient-to-br from-rose-50/70 to-white",      badge: "bg-rose-100 text-rose-700",       iconWrap: "bg-rose-100 text-rose-700" },
} as const

function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NabhEvidenceLiveCockpit({ className }: { className?: string }) {
  const entries = useAuditStore((s) => s.entries)
  const audit    = useAuditStore((s) => s.log)
  const router   = useRouter()
  const [dismissed, setDismissed] = useState<Record<string, true>>({})

  const evidence = useMemo<NabhChapterEvidence[]>(() => buildNabhEvidence(entries), [entries])
  const ready    = evidence.filter((e) => e.ready).length
  const total    = evidence.length
  const totalEvents = evidence.reduce((s, e) => s + e.count, 0)
  const overallScore = total > 0 ? Math.round((ready / total) * 100) : 0

  function accept(chap: NabhChapterEvidence) {
    const rem = REMEDIATION[chap.chapter]
    audit({
      action: "hitl_accept",
      resource: "nabh_evidence",
      resourceId: chap.chapter,
      detail: `NABH evidence chapter actioned — ${chap.chapter} (${chap.title}): ${rem?.nextAction ?? 'logged'}`,
      userId: "user", userName: "Compliance officer",
    })
    if (rem) router.push(rem.route)
  }
  function reject(chap: NabhChapterEvidence) {
    audit({
      action: "hitl_reject",
      resource: "nabh_evidence",
      resourceId: chap.chapter,
      detail: `NABH evidence suggestion dismissed for ${chap.chapter}.`,
      userId: "user", userName: "Compliance officer",
    })
    setDismissed((m) => ({ ...m, [chap.chapter]: true }))
  }

  return (
    <section className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">NABH Evidence — Live Cockpit</h3>
        <span className="text-[11px] text-slate-500">{totalEvents} audited events across {total} chapters</span>
        <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">
          <ShieldCheck className="h-3 w-3" /> {ready}/{total} ready · {overallScore}%
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        {evidence.map((c) => {
          if (dismissed[c.chapter]) return null
          const t = TONE_STYLES[tone(c.count)]
          const latest = c.events.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
          const needsAction = c.count < 5
          const rem = REMEDIATION[c.chapter]
          return (
            <article key={c.chapter} className={`rounded-xl ${t.bg} ring-1 ${t.ring} p-3 flex flex-col gap-2`}>
              <header className="flex items-start gap-2">
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${t.iconWrap}`}>
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-[12.5px] font-bold text-slate-900">{c.chapter} · {c.title}</h4>
                </div>
                <span className={`ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${t.badge} flex-shrink-0`}>
                  {c.count} evt
                </span>
              </header>

              <p className="text-[11.5px] text-slate-600 leading-snug">{c.blurb}</p>

              {latest ? (
                <div className="rounded-lg bg-white/80 ring-1 ring-slate-200/70 px-2 py-1.5 text-[11px] text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-500">{fmtAgo(latest.timestamp)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{latest.action}</span>
                  </div>
                  <p className="truncate">{latest.detail ?? `${latest.resource}${latest.resourceId ? ' · ' + latest.resourceId : ''}`}</p>
                </div>
              ) : (
                <div className="rounded-lg bg-rose-50/60 ring-1 ring-rose-200/50 px-2 py-1.5 text-[11px] text-rose-700 inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" /> No evidence captured yet
                </div>
              )}

              {needsAction && rem ? (
                <div className="rounded-lg bg-[rgba(238,107,38,0.07)]/70 ring-1 ring-primary/25 px-2 py-1.5 mt-auto">
                  <p className="text-[10px] font-semibold text-[var(--color-accent)] uppercase tracking-wide mb-0.5">AI suggested next-action</p>
                  <p className="text-[11.5px] text-slate-800 leading-snug">{rem.nextAction}</p>
                </div>
              ) : c.count >= 5 ? (
                <div className="mt-auto">
                  <ReasoningChip compact tone="ok" title="Evidence threshold met" />
                </div>
              ) : null}

              <footer className="flex items-center gap-2">
                <Link href={`/audit/log?chapter=${c.chapter}`} className="text-[10.5px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] inline-flex items-center gap-0.5">
                  Trail <ChevronRight className="h-3 w-3" />
                </Link>
                {needsAction ? (
                  <>
                    <button type="button" onClick={() => reject(c)}
                      className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                      <X className="h-3 w-3" /> Dismiss
                    </button>
                    <button type="button" onClick={() => accept(c)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white">
                      <Check className="h-3 w-3" /> Open desk
                    </button>
                  </>
                ) : null}
              </footer>
            </article>
          )
        })}
      </div>
    </section>
  )
}
