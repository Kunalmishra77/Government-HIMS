"use client"

/* Live Visit Status — the patient's real-time journey through the hospital,
 * shown as a 9-stage track (Checked In → Waiting → Vitals → Consultation →
 * Laboratory → Radiology → Pharmacy → Billing → Completed). Position is derived
 * from the live journey engine (usePatientLiveStore); the Laboratory & Radiology
 * steps are enriched from the diagnostics store so they reflect real report
 * progress rather than being skipped over. */

import { useRouter } from "next/navigation"
import {
  DoorOpen, Clock, Activity, Stethoscope, FlaskConical, ScanLine, Pill, Receipt,
  CheckCircle2, ArrowRight, Video, type LucideIcon,
} from "lucide-react"
import { usePatientLiveStore, stagesFor, type OpdStage } from "@/store/usePatientLiveStore"
import { usePatientDiagnosticsStore, byKind } from "@/store/usePatientDiagnosticsStore"
import { cn } from "@/lib/utils"

type StepState = "done" | "current" | "upcoming"

const CANON: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "checked_in", label: "Checked In", icon: DoorOpen },
  { key: "waiting", label: "Waiting", icon: Clock },
  { key: "vitals", label: "Vitals", icon: Activity },
  { key: "consultation", label: "Consultation", icon: Stethoscope },
  { key: "laboratory", label: "Laboratory", icon: FlaskConical },
  { key: "radiology", label: "Radiology", icon: ScanLine },
  { key: "pharmacy", label: "Pharmacy", icon: Pill },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
]

const STAGE_TO_CANON: Record<OpdStage, number> = {
  waiting: 1, vitals: 2, consulting: 3, pharmacy: 6, billing: 7, done: 8,
  booked: 0, waiting_room: 1, in_call: 3, prescription: 6,
}

export function LiveVisitStatusCard() {
  const router = useRouter()
  const mode = usePatientLiveStore((s) => s.mode)
  const stage = usePatientLiveStore((s) => s.stage)
  const token = usePatientLiveStore((s) => s.token)
  const aheadOfYou = usePatientLiveStore((s) => s.aheadOfYou)
  const etaMinutes = usePatientLiveStore((s) => s.etaMinutes)
  const items = usePatientDiagnosticsStore((s) => s.items)

  const currentIndex = STAGE_TO_CANON[stage] ?? 0
  const isDone = stage === "done"
  const meta = stagesFor(mode).find((m) => m.key === stage)

  function stateFor(i: number): StepState {
    let state: StepState = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"
    // Lab (4) & Radiology (5) reflect real diagnostics progress once consultation is past.
    if ((i === 4 || i === 5) && currentIndex >= 3) {
      const group = byKind(items, i === 4 ? "lab" : "radiology")
      if (group.length) state = group.every((g) => g.status === "completed") ? "done" : "current"
    }
    return state
  }

  return (
    <section className="hms-card p-5 sm:p-6" aria-label="Live visit status">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="t-h3 text-foreground">Live visit status</h3>
          {!isDone && (
            <span className="inline-flex items-center gap-1.5 chip chip-success">
              <span className="status-dot online pulse" aria-hidden="true" /> Live
            </span>
          )}
        </div>
        <p className="t-caption text-foreground-lighter">
          {isDone ? "Visit complete" : `Token #${token} · ${aheadOfYou} ahead · ~${etaMinutes} min`}
        </p>
      </header>

      {/* Stage track — horizontal, scrolls on small screens. */}
      <div className="overflow-x-auto pb-1">
        <ol className="flex min-w-[600px]">
          {CANON.map((s, i) => {
            const state = stateFor(i)
            const Icon = state === "done" ? CheckCircle2 : s.icon
            return (
              <li key={s.key} className="relative flex flex-1 flex-col items-center gap-2">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-[-50%] right-1/2 top-[18px] h-0.5",
                      i - 1 < currentIndex ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-[1] grid h-9 w-9 place-items-center rounded-full transition-colors",
                    state === "done" && "bg-primary text-[#0D2032]",
                    state === "current" && "bg-surface text-accent ring-2 ring-primary",
                    state === "upcoming" && "bg-surface-sunken text-foreground-lighter ring-1 ring-border",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "text-center text-[11px] leading-tight",
                    state === "current" ? "font-semibold text-accent" : state === "done" ? "font-medium text-foreground" : "text-foreground-lighter",
                  )}
                >
                  {s.label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Current step guidance + CTA. */}
      {meta && (
        <div className={cn(
          "mt-5 flex items-center gap-3 rounded-2xl px-4 py-3",
          isDone ? "bg-success-bg" : meta.isCall ? "bg-accent-soft" : "bg-surface-sunken",
        )}>
          {isDone
            ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
            : <ArrowRight className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />}
          <p className="t-body flex-1 font-medium text-foreground">{meta.action}</p>
          {meta.joinVideo && !isDone && (
            <button
              type="button"
              onClick={() => router.push("/patient/teleconsult")}
              className="u-press inline-flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3 py-2 t-label text-[#0D2032] transition-colors hover:bg-primary-dark"
            >
              <Video className="h-4 w-4" /> Join call
            </button>
          )}
        </div>
      )}
    </section>
  )
}
