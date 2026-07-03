"use client"

/* S13 — Proactive Patient Nudges feed.
 *
 * Vertical feed of AI-surfaced nudges. Each nudge has a primary CTA →
 * routes to the right surface. Dismiss audit-logged so the feed
 * remembers what the patient already ignored. Capped at 5 visible.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Bell, X, ArrowRight, FlaskConical, Pill, ShieldCheck, Calendar, HeartPulse, MessageCircle, FileText } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { useAuditStore } from "@/store/useAuditStore"
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { usePatientLiveStore } from "@/store/usePatientLiveStore"
import { usePatientOrdersStore } from "@/store/usePatientOrdersStore"
import { buildPatientNudges, type PatientNudge } from "@/lib/patientNudges"

const ICONS: Record<PatientNudge["kind"], React.ElementType> = {
  followup:    Calendar,
  medication:  Pill,
  result:      FlaskConical,
  preauth:     ShieldCheck,
  lifestyle:   HeartPulse,
  consent:     FileText,
  appointment: MessageCircle,
}
const TONE_STYLES = {
  ok:   { ring: "ring-emerald-200/70", bg: "bg-emerald-50/50",  iconWrap: "bg-emerald-100 text-emerald-700", chipBg: "bg-emerald-100 text-emerald-700" },
  info: { ring: "ring-primary/25",  bg: "bg-[rgba(238,107,38,0.07)]/50",    iconWrap: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]",   chipBg: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" },
  warn: { ring: "ring-amber-200/70",   bg: "bg-amber-50/50",     iconWrap: "bg-amber-100 text-amber-700",      chipBg: "bg-amber-100 text-amber-800" },
} as const

const LS_DISMISS_KEY = "agentix.patient.nudgeDismiss"
function loadDismissed(): Record<string, true> {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(LS_DISMISS_KEY) ?? "{}") } catch { return {} }
}
function saveDismissed(m: Record<string, true>) {
  try { localStorage.setItem(LS_DISMISS_KEY, JSON.stringify(m)) } catch { /* ignore */ }
}

export function ProactiveNudgesFeed({ className }: { className?: string }) {
  const router = useRouter()
  const currentUser = useAuthStore((s) => s.currentUser)
  const profile     = usePatientProfileStore((s) => (currentUser?.id ? s.getProfile(currentUser.id) : undefined))
  const audit        = useAuditStore((s) => s.log)
  const entries      = useAuditStore((s) => s.entries)
  const stage         = usePatientLiveStore((s) => s.stage)
  const orderItems    = usePatientOrdersStore((s) => s.items)
  const ordersPaid    = usePatientOrdersStore((s) => s.paid)
  const pendingOrders = useMemo(() => (orderItems ?? []).map((o) => ({ kind: o.kind, paid: ordersPaid })), [orderItems, ordersPaid])

  const [dismissed, setDismissed] = useState<Record<string, true>>({})
  useEffect(() => { setDismissed(loadDismissed()) }, [])

  const all = useMemo<PatientNudge[]>(() => buildPatientNudges({
    patientId: currentUser?.id ?? "anon",
    profile,
    entries,
    stage,
    pendingOrders,
  }), [currentUser, profile, entries, stage, pendingOrders])

  const visible = all.filter((n) => !dismissed[n.id]).slice(0, 5)

  function dismiss(n: PatientNudge) {
    const next = { ...dismissed, [n.id]: true } as Record<string, true>
    setDismissed(next); saveDismissed(next)
    audit({
      action: "hitl_reject",
      resource: "patient_nudge",
      resourceId: n.id,
      detail: `Patient dismissed nudge — ${n.title}.`,
      userId: currentUser?.id ?? "patient", userName: currentUser?.name ?? "Patient",
    })
  }
  function act(n: PatientNudge) {
    audit({
      action: "hitl_accept",
      resource: "patient_nudge",
      resourceId: n.id,
      detail: `Patient followed nudge — ${n.title} → ${n.cta}.`,
      userId: currentUser?.id ?? "patient", userName: currentUser?.name ?? "Patient",
    })
    router.push(n.href)
  }

  return (
    <section className={`rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-surface-sunken">
        <span className="h-8 w-8 rounded-xl bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center"><Sparkles className="h-4 w-4" /></span>
        <div>
          <h3 className="text-[14px] font-bold text-slate-900 leading-tight">For you — proactive nudges</h3>
          <p className="text-[11px] text-slate-500">AI watches your record · acts before you have to ask</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-mono font-semibold text-[var(--color-accent)]">
          <Bell className="h-3 w-3" /> {visible.length} live
        </span>
      </header>

      <div className="divide-y divide-slate-100">
        {visible.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-[12.5px] font-semibold text-slate-500">You're all caught up.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Nudges will appear here as your record updates.</p>
          </div>
        ) : null}

        {visible.map((n) => {
          const Icon = ICONS[n.kind] ?? Bell
          const t = TONE_STYLES[n.tone]
          return (
            <article key={n.id} className={`px-5 py-3 flex items-start gap-3 ${t.bg}`}>
              <span className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.iconWrap}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <h4 className="text-[12.5px] font-bold text-slate-900 truncate">{n.title}</h4>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wide ${t.chipBg}`}>{n.kind}</span>
                </div>
                <p className="text-[12px] text-slate-600 leading-snug">{n.body}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button type="button" onClick={() => act(n)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white">
                    {n.cta} <ArrowRight className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => dismiss(n)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-600 ring-1 ring-slate-200">
                    <X className="h-3 w-3" /> Dismiss
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
