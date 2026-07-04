"use client"

/* Appointment Guidance — a concierge-style card that turns the booked slot into
 * a single, legible journey: when to arrive, why, who's ahead, how long the wait
 * is, and when the consultation starts. Every value is derived live from the
 * journey engine (usePatientLiveStore), so it re-computes automatically whenever
 * the queue advances. Adapts between in-person (travel + arrival) and video. */

import {
  CalendarDays, Clock, Stethoscope, LogIn, Users, CheckCircle2, Video, ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { usePatientLiveStore, stagesFor } from "@/store/usePatientLiveStore"
import { formatApptDate } from "@/lib/intake/data"
import { cn } from "@/lib/utils"

// Arrive this many minutes early; each patient ahead adds this much wait.
const ARRIVE_LEAD_MIN = 30
const AVG_CONSULT_MIN = 15

// Shift a display time ("2:00 PM") by ±minutes, wrapping within a day.
function shiftTime(t: string, deltaMin: number): string | null {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const ap = (m[3] || "").toUpperCase()
  if (ap === "PM" && h < 12) h += 12
  if (ap === "AM" && h === 12) h = 0
  const total = (((h * 60 + parseInt(m[2], 10) + deltaMin) % 1440) + 1440) % 1440
  const hh = Math.floor(total / 60)
  const suffix = hh >= 12 ? "PM" : "AM"
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(total % 60).padStart(2, "0")} ${suffix}`
}

// "Tomorrow, 25 July 2026" (relative prefix only when it adds meaning).
function fullDate(iso: string): string {
  const rel = formatApptDate(iso, "en")
  const abs = new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  return rel === abs ? abs : `${rel}, ${abs}`
}

type Step = { icon: LucideIcon; tint: string; label: string; value: string; sub?: string; emphasis?: boolean }

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-surface-sunken p-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0">
        <p className="t-overline text-foreground-lighter">{label}</p>
        <p className="t-body mt-0.5 font-semibold text-foreground break-words">{value}</p>
      </div>
    </div>
  )
}

export function ArrivalWaitCard() {
  const mode = usePatientLiveStore((s) => s.mode)
  const stage = usePatientLiveStore((s) => s.stage)
  const apptDate = usePatientLiveStore((s) => s.apptDate)
  const apptTime = usePatientLiveStore((s) => s.apptTime)
  const doctor = usePatientLiveStore((s) => s.doctor)
  const aheadOfYou = usePatientLiveStore((s) => s.aheadOfYou)
  const etaMinutes = usePatientLiveStore((s) => s.etaMinutes)

  if (stage === "done") return null

  const isVideo = mode === "video"
  const dateLabel = apptDate ? fullDate(apptDate) : "To be scheduled"
  const arrival = apptTime ? shiftTime(apptTime, -ARRIVE_LEAD_MIN) : null
  const stageLabel = stagesFor(mode).find((m) => m.key === stage)?.label ?? ""

  // Wait is driven by the queue × average consultation length, so it moves with
  // the queue in real time; falls back to the engine estimate when no one's ahead.
  const waitMin = aheadOfYou > 0 ? aheadOfYou * AVG_CONSULT_MIN : Math.max(0, etaMinutes)
  const queueValue = aheadOfYou > 0 ? `${aheadOfYou} patient${aheadOfYou > 1 ? "s" : ""} ahead` : "You're next in line"
  const waitValue = waitMin > 0 ? `~${waitMin} min` : "Any moment now"

  // Build the vertical journey. In-person opens with the arrival guidance (the
  // hero); video skips travel and opens with "be ready to join".
  const steps: Step[] = []
  if (!isVideo && arrival) {
    steps.push({
      icon: LogIn, tint: "bg-primary text-[#0D2032]", emphasis: true,
      label: "Recommended arrival", value: arrival,
      sub: `Please arrive about ${ARRIVE_LEAD_MIN} minutes before your ${apptTime} appointment, so there's time to finish any formalities.`,
    })
  }
  if (apptTime) {
    steps.push({
      icon: isVideo ? Video : Clock, tint: "bg-accent-soft text-accent",
      label: isVideo ? "Be ready to join" : "Appointment time", value: apptTime,
      sub: isVideo ? "Keep this screen open near your appointment time." : `Your scheduled slot with ${doctor}.`,
      emphasis: isVideo,
    })
  }
  steps.push({
    icon: Users, tint: "bg-surface-sunken text-foreground-muted",
    label: "Current queue", value: queueValue,
    sub: aheadOfYou > 0
      ? `The doctor is expected to see them before your consultation — an estimated ${waitValue.replace("~", "")} wait.`
      : "You'll be called in shortly.",
  })
  steps.push({
    icon: Stethoscope, tint: "bg-success-bg text-success",
    label: "Doctor consultation", value: doctor,
    sub: apptTime ? "Expected around your scheduled appointment time." : "Expected shortly.",
  })

  const reminders = isVideo
    ? ["Previous medical reports (if available)", "A quiet, well-lit space", "Test your camera & microphone", "Any medicines you're currently taking"]
    : ["Aadhaar Card", "Aadhaar-linked mobile number", "Previous medical reports (if available)", "Any medicines you're currently taking"]

  return (
    <section className="hms-card p-5 sm:p-6" aria-label="Appointment guidance">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="t-h3 text-foreground">Your appointment</h3>
        {stageLabel && (
          <span className="inline-flex items-center gap-1.5 chip chip-success">
            <span className="status-dot online pulse" aria-hidden="true" /> Live
          </span>
        )}
      </header>

      {/* Reference facts — the "at a glance" summary. */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Fact icon={CalendarDays} label="Date" value={dateLabel} />
        <Fact icon={Stethoscope} label="Doctor" value={doctor} />
        <Fact icon={Clock} label={isVideo ? "Consult time" : "Appointment time"} value={apptTime || "—"} />
      </div>

      {/* The journey — one connected timeline instead of isolated metrics. */}
      <ol className="relative">
        {steps.map((s, i) => {
          const Icon = s.icon
          const last = i === steps.length - 1
          return (
            <li key={s.label} className="flex gap-3.5">
              <div className="flex flex-col items-center self-stretch">
                <span className={cn("grid h-9 w-9 flex-shrink-0 place-items-center rounded-full", s.tint)}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                {!last && <span className="my-1 w-px flex-1 bg-border" aria-hidden="true" />}
              </div>
              <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
                <div className={cn(s.emphasis && "rounded-2xl bg-accent-soft px-4 py-3")}>
                  <p className="t-overline text-foreground-lighter">{s.label}</p>
                  <p className={cn("font-bold text-foreground", s.emphasis ? "text-[22px] leading-tight" : "t-body-lg")}>{s.value}</p>
                  {s.sub && <p className="t-body mt-1 text-foreground-muted">{s.sub}</p>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Concierge reminder — what to bring, so nothing slows the visit down. */}
      <div className="mt-5 rounded-2xl bg-surface-sunken p-4">
        <p className="flex items-center gap-1.5 t-overline text-foreground-lighter">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Helpful reminder — please carry
        </p>
        <ul className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {reminders.map((r) => (
            <li key={r} className="flex items-start gap-2 t-body text-foreground-muted">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" /> {r}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
