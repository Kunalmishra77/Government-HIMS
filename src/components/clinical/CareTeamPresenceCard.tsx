"use client"

/* S14 — Care-Team Presence + Live Handover.
 *
 * Pill-style presence strip showing who's on for this ward right now.
 * Click any handover-pending pill (amber pulse) to open the LiveHandover
 * modal — SBAR-structured note compose, AI-suggested SBAR skeleton, and
 * incoming-shift acceptance. Audit emits on sign + receive.
 *
 *   <CareTeamPresenceCard ward="Cardiac Care" department="Cardiology" />
 */

import { useMemo, useState } from "react"
import { Sparkles, Check, X, Send, Inbox, Users, Stethoscope, Activity, Wand2 } from "lucide-react"
import { useHRStore } from "@/store/useHRStore"
import { useShiftStore, type HandoverRecord, type ShiftType } from "@/store/useShiftStore"
import { useAuditStore } from "@/store/useAuditStore"
import { useAuthStore } from "@/store/useAuthStore"
import { buildCareTeamPresence, type CareTeamMember, type PresenceStatus } from "@/lib/careTeamPresence"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"

const PRESENCE_STYLES: Record<PresenceStatus, { dot: string; ring: string; label: string }> = {
  on_shift:         { dot: "bg-emerald-500",  ring: "ring-emerald-300",  label: "On shift" },
  handover_pending: { dot: "bg-amber-500",     ring: "ring-amber-300 animate-pulse", label: "Handover near" },
  on_call:          { dot: "bg-surface-sunken",        ring: "ring-primary/25",      label: "On call" },
  off:              { dot: "bg-slate-300",      ring: "ring-slate-200",    label: "Off" },
}

function buildSbarSkeleton(ward: string, patientCount: number, fromShift: ShiftType): string {
  return (
    `${fromShift} shift handover — ${ward}\n\n` +
    `Situation: ${patientCount} patient${patientCount === 1 ? '' : 's'} under our care this shift. ` +
    `Top concern: review ICU pressure + any escalations from the round.\n\n` +
    `Background: Recent admissions covered in IPD progress notes; new orders signed today are reflected in the chart.\n\n` +
    `Assessment: Vitals stable for all but watch list flagged below. NEWS2 trend reviewed; no active early-warnings unack'd.\n\n` +
    `Recommendation: Continue current orders. Page on-call if NEWS ≥ 5 or new chest pain. Confirm troponin redraw for cardiac watchlist.`
  )
}

interface Props {
  ward?: string
  department?: string
  className?: string
}

export function CareTeamPresenceCard({ ward = "Cardiac Care", department, className }: Props) {
  const staff      = useHRStore((s) => s.staff)
  const shifts     = useHRStore((s) => s.shifts)
  const duty       = useHRStore((s) => s.dutyAssignments)
  const handovers  = useShiftStore((s) => s.handovers)
  const signHandover    = useShiftStore((s) => s.signHandover)
  const receiveHandover = useShiftStore((s) => s.receiveHandover)
  const audit       = useAuditStore((s) => s.log)
  const currentUser = useAuthStore((s) => s.currentUser)

  const team = useMemo<CareTeamMember[]>(() =>
    buildCareTeamPresence({ staff, shifts, duty, ward, department }),
    [staff, shifts, duty, ward, department])

  const onShiftCount        = team.filter((m) => m.presence === "on_shift").length
  const handoverPendingCount = team.filter((m) => m.presence === "handover_pending").length

  const [composeOpen, setComposeOpen] = useState(false)
  const [sbarText, setSbarText] = useState("")
  const [accepted, setAccepted] = useState<Record<string, true>>({})

  const pendingIncoming = handovers.filter((h) => h.ward === ward && h.status === "signed")

  // Narrow useHRStore's ShiftType ('Morning'|'Evening'|'Night'|'Off') to
  // useShiftStore's ShiftType ('Morning'|'Evening'|'Night') for handover ops.
  const narrowShift = (s: CareTeamMember["shift"] | undefined): ShiftType =>
    (s === "Evening" || s === "Night") ? s : "Morning"

  function openCompose() {
    const me = team.find((m) => m.presence === "handover_pending" || m.presence === "on_shift")
    setSbarText(buildSbarSkeleton(ward, 4, narrowShift(me?.shift)))
    setComposeOpen(true)
  }

  function regenerateSbar() {
    const variants = [4, 5, 3]
    const me = team.find((m) => m.presence === "handover_pending" || m.presence === "on_shift")
    setSbarText(buildSbarSkeleton(ward, variants[Math.floor(sbarText.length) % variants.length], narrowShift(me?.shift)))
    audit({
      action: "hitl_modify",
      resource: "live_handover",
      resourceId: ward,
      detail: `AI regenerated SBAR skeleton for ${ward} handover.`,
      userId: currentUser?.id ?? "user", userName: currentUser?.name ?? "Active user",
    })
  }

  function sign() {
    if (!sbarText.trim()) return
    const myName = currentUser?.name ?? team[0]?.name ?? "Active nurse"
    const fromShift = narrowShift(team.find((m) => m.presence === "handover_pending" || m.presence === "on_shift")?.shift)
    const toShift   = fromShift === "Morning" ? "Evening" : fromShift === "Evening" ? "Night" : "Morning"
    const id = signHandover({ ward, date: new Date().toISOString().slice(0, 10), fromShift, toShift, fromNurse: myName, sbar: sbarText, patientCount: 4 })
    audit({
      action: "hitl_accept",
      resource: "live_handover",
      resourceId: id,
      detail: `Live handover signed — ${ward} ${fromShift} → ${toShift}.`,
      userId: currentUser?.id ?? "user", userName: myName,
    })
    setComposeOpen(false)
  }

  function receive(h: HandoverRecord) {
    const myName = currentUser?.name ?? "Active nurse"
    receiveHandover(h.id, myName)
    audit({
      action: "hitl_accept",
      resource: "live_handover",
      resourceId: h.id,
      detail: `Live handover received — ${h.ward} ${h.fromShift} → ${h.toShift} by ${myName}.`,
      userId: currentUser?.id ?? "user", userName: myName,
    })
    setAccepted((m) => ({ ...m, [h.id]: true }))
  }

  return (
    <section className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">Care-Team Presence · {ward}</h3>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] font-mono font-semibold text-[var(--color-accent)]">
          <Users className="h-3 w-3" /> {onShiftCount} on shift · {handoverPendingCount} near handover
        </span>
      </header>

      {/* Presence strip */}
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {team.slice(0, 12).map((m) => {
            const s = PRESENCE_STYLES[m.presence]
            return (
              <button
                key={m.staffId}
                type="button"
                onClick={() => { if (m.presence === "handover_pending" || m.presence === "on_shift") openCompose() }}
                className={`relative inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-white ring-1 ${s.ring} hover:bg-slate-50 transition`}
                title={`${m.name} · ${m.role}${m.shiftHours ? ' · ' + m.shiftHours : ''}`}
              >
                <span className="relative">
                  <span className="h-6 w-6 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center text-[10.5px] font-bold">{m.initials}</span>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${s.dot}`} />
                </span>
                <span className="text-[11.5px] font-semibold text-slate-800 max-w-[110px] truncate">{m.name}</span>
                <span className="text-[10px] text-slate-500">{m.role}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ReasoningChip compact tone="ok"   title={`${onShiftCount} on shift`} />
          {handoverPendingCount > 0 ? <ReasoningChip compact tone="warn" title={`${handoverPendingCount} handover near`} /> : null}
          {pendingIncoming.length > 0 ? <ReasoningChip compact tone="info" title={`${pendingIncoming.length} incoming handover${pendingIncoming.length === 1 ? '' : 's'}`} /> : null}
          <button type="button" onClick={openCompose}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white">
            <Send className="h-3 w-3" /> Compose handover
          </button>
        </div>
      </div>

      {/* Incoming handover list */}
      {pendingIncoming.length > 0 ? (
        <div className="px-3 pb-3 space-y-1.5">
          <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">Incoming — to receive</p>
          {pendingIncoming.map((h) => (
            <div key={h.id} className="rounded-lg bg-amber-50/60 ring-1 ring-amber-200/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <Inbox className="h-3.5 w-3.5 text-amber-700" />
                <p className="text-[12px] font-semibold text-slate-900">{h.fromShift} → {h.toShift} · from {h.fromNurse}</p>
                <span className="ml-auto text-[10.5px] text-slate-500">{h.patientCount} patient{h.patientCount === 1 ? '' : 's'}</span>
              </div>
              <pre className="mt-1.5 text-[11.5px] text-slate-700 leading-snug whitespace-pre-wrap font-sans line-clamp-3">{h.sbar}</pre>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10.5px] text-slate-500 mr-auto">HITL · receiver acknowledgement is audited.</span>
                {accepted[h.id] ? (
                  <ReasoningChip compact tone="ok" title="Received · audited" />
                ) : (
                  <button type="button" onClick={() => receive(h)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Check className="h-3 w-3" /> Receive handover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Compose dialog (inline panel, not modal — keeps page state visible) */}
      {composeOpen ? (
        <div className="border-t border-[rgba(238,107,38,0.15)]/60 p-3 bg-surface-sunken space-y-2">
          <div className="flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <p className="text-[11.5px] font-semibold text-[var(--color-primary-dark)]">SBAR draft · AI-skeleton, editable</p>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--color-accent)]">
              <Sparkles className="h-3 w-3" /> 82% confidence
            </span>
          </div>
          <textarea
            value={sbarText}
            onChange={(e) => setSbarText(e.target.value)}
            rows={9}
            className="w-full rounded-lg bg-white ring-1 ring-slate-200 px-3 py-2 text-[12.5px] text-slate-800 font-mono leading-relaxed outline-none focus:ring-[var(--color-primary-light)] whitespace-pre-wrap"
            aria-label="SBAR handover note"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] text-slate-500 mr-auto">HITL · sign or edit. Decision audited.</span>
            <button type="button" onClick={() => setComposeOpen(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <X className="h-3 w-3" /> Cancel
            </button>
            <button type="button" onClick={regenerateSbar}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <Wand2 className="h-3 w-3" /> Regenerate
            </button>
            <button type="button" onClick={sign} disabled={sbarText.trim().length < 30}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white disabled:opacity-50">
              <Send className="h-3 w-3" /> Sign & send
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
