"use client"

/* Live Activity Timeline — the complete chronological view of the patient's
 * hospital journey: token updates, consultation, lab sample collection, report
 * availability, e-prescription, pharmacy, billing. Reads the live event stream
 * (usePatientLiveStore) and weaves in a contextual follow-up reminder once the
 * visit is complete. */

import { useMemo } from "react"
import {
  CheckCircle2, BellRing, FileText, Sparkles, MessageSquare, Info,
  type LucideIcon,
} from "lucide-react"
import { usePatientLiveStore, type LiveEvent, type LiveEventType } from "@/store/usePatientLiveStore"
import { cn } from "@/lib/utils"

const TONE: Record<LiveEventType, { icon: LucideIcon; tint: string }> = {
  progress: { icon: CheckCircle2,  tint: "bg-success-bg text-success" },
  call:     { icon: BellRing,      tint: "bg-urgent-bg text-urgent" },
  result:   { icon: FileText,      tint: "bg-info-bg text-info" },
  ai:       { icon: Sparkles,      tint: "bg-accent-soft text-accent" },
  message:  { icon: MessageSquare, tint: "bg-info-bg text-info" },
  info:     { icon: Info,          tint: "bg-surface-sunken text-foreground-muted" },
}

function relativeTime(at: number): string {
  const diff = Date.now() - at
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
}

type Row = LiveEvent & { woven?: boolean }

export function LiveActivityTimeline() {
  const events = usePatientLiveStore((s) => s.events)
  const stage = usePatientLiveStore((s) => s.stage)

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [...events]
    // Woven AI: a follow-up reminder surfaces here the moment the visit closes.
    if (stage === "done") {
      list.unshift({
        id: "woven-followup",
        at: events[0]?.at ?? 0,
        type: "ai",
        title: "Follow-up reminder set",
        detail: "We'll remind you to book a review in 7 days. Tap Follow-up Care anytime to schedule sooner.",
        woven: true,
      })
    }
    return list
  }, [events, stage])

  return (
    <section className="hms-card p-5 sm:p-6" aria-label="Live activity timeline">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="t-h3 text-foreground">Live activity timeline</h3>
        <span className="t-caption text-foreground-lighter">{rows.length} updates</span>
      </header>

      <ol className="relative">
        {rows.map((e, i) => {
          const tone = TONE[e.type]
          const Icon = tone.icon
          const last = i === rows.length - 1
          return (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-border" aria-hidden="true" />}
              <span className={cn("relative z-[1] grid h-8 w-8 flex-shrink-0 place-items-center rounded-full ring-4 ring-surface", tone.tint)}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className={cn("min-w-0 flex-1 rounded-2xl px-3 py-2", e.woven ? "bg-accent-soft" : "bg-surface-sunken")}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="t-body font-semibold text-foreground">{e.title}</p>
                  <span className="t-caption flex-shrink-0 text-foreground-lighter">{relativeTime(e.at)}</span>
                </div>
                {e.detail && <p className="t-caption mt-0.5 text-foreground-muted">{e.detail}</p>}
                {e.room && <p className="t-caption mt-1 font-semibold text-accent">{e.room}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
