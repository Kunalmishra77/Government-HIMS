"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import {
  ClipboardList, Activity, Stethoscope, FlaskConical, Pill, Building2,
  Bed, LogOut, Receipt, AlertTriangle, AlertOctagon, CheckCircle2, Info,
  Sparkles, Clock, Download, FileText, ArrowRight, Flag,
} from "lucide-react"
import { aggregateJourney, type Department, type JourneyEvent, type EventSeverity } from "@/lib/journeyAggregator"
import { cn } from "@/lib/utils"

/* ── Stage model ───────────────────────────────────────────────────────────
   Department touchpoints roll up into the patient-facing journey stages the
   Agentix HIMS flow presents. The flow renders as a centred vertical
   flowchart: milestone banner pills, white content cards with category icon +
   tag chips, connector dots between nodes, and a CTA at the close of each stage
   — mirroring the Agentix HIMS journey design. */

type StageKey =
  | 'registration' | 'emergency' | 'triage' | 'consultation' | 'diagnostics'
  | 'pharmacy' | 'surgery' | 'admission' | 'billing' | 'discharge'

const STAGE_OF: Record<Department, StageKey> = {
  Reception: 'registration', Emergency: 'emergency', Nursing: 'triage', Doctor: 'consultation',
  Lab: 'diagnostics', Radiology: 'diagnostics', Pharmacy: 'pharmacy', OT: 'surgery',
  IPD: 'admission', Billing: 'billing', Insurance: 'billing', Discharge: 'discharge',
}

const DEPT_ICON: Record<Department, React.ElementType> = {
  Reception: ClipboardList, Emergency: AlertTriangle, Nursing: Activity, Doctor: Stethoscope,
  Lab: FlaskConical, Radiology: FlaskConical, Pharmacy: Pill, OT: Building2,
  IPD: Bed, Discharge: LogOut, Billing: Receipt, Insurance: Receipt,
}

const STAGE_META: Record<StageKey, { label: string; icon: React.ElementType; accent: string }> = {
  registration: { label: 'Registration Confirmed', icon: ClipboardList, accent: 'var(--color-primary)' },
  emergency:    { label: 'Emergency & Triage', icon: AlertTriangle, accent: '#DC2626' },
  triage:       { label: 'Triage & Vitals', icon: Activity, accent: '#16A34A' },
  consultation: { label: "It's Your Turn", icon: Stethoscope, accent: 'var(--color-primary)' },
  diagnostics:  { label: 'Tests Ordered', icon: FlaskConical, accent: '#F59E0B' },
  pharmacy:     { label: 'Medication', icon: Pill, accent: '#EC4899' },
  surgery:      { label: 'Surgery / OT', icon: Building2, accent: 'var(--color-primary)' },
  admission:    { label: 'Admission Required', icon: Bed, accent: '#EE6B26' },
  billing:      { label: 'Payment Confirmed', icon: Receipt, accent: '#EE6B26' },
  discharge:    { label: "You're Being Discharged", icon: LogOut, accent: '#16A34A' },
}

const STAGE_ORDER: StageKey[] = [
  'registration', 'emergency', 'triage', 'consultation', 'diagnostics',
  'pharmacy', 'surgery', 'admission', 'billing', 'discharge',
]

/** Contextual close-of-stage action, mirroring the CTA buttons in the design. */
const STAGE_CTA: Partial<Record<StageKey, { label: string; icon: React.ElementType }>> = {
  registration: { label: 'View registration receipt', icon: FileText },
  consultation: { label: 'Download consultation summary', icon: Download },
  diagnostics:  { label: 'Download test report', icon: Download },
  billing:      { label: 'View bill & payment receipt', icon: Receipt },
  admission:    { label: 'View admission details', icon: ArrowRight },
  discharge:    { label: 'Download discharge summary', icon: Download },
}

const SEV: Record<EventSeverity, { icon: React.ElementType; chip: string; label: string; color: string; cardTint: string; cardBorder: string }> = {
  info:     { icon: Info,          chip: 'chip-info',    label: 'Info',          color: 'var(--color-info)',    cardTint: 'bg-surface',                              cardBorder: 'border-border' },
  success:  { icon: CheckCircle2,  chip: 'chip-success', label: 'Completed',     color: 'var(--color-success)', cardTint: 'bg-[color:var(--color-success-bg)]/40',   cardBorder: 'border-[color:var(--color-brand-green-border)]' },
  warning:  { icon: AlertTriangle, chip: 'chip-warning', label: 'Action needed', color: 'var(--color-warning)', cardTint: 'bg-[color:var(--color-warning-bg)]/50',   cardBorder: 'border-[color:var(--color-warning)]/30' },
  critical: { icon: AlertOctagon,  chip: 'chip-danger',  label: 'Critical',      color: 'var(--color-danger)',  cardTint: 'bg-[color:var(--color-danger-bg)]/50',    cardBorder: 'border-[color:var(--color-danger)]/40' },
}

const fmtAbs = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const fmtRel = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 0) return 'scheduled'
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function insightFor(e: JourneyEvent): string | null {
  if (e.severity === 'critical')
    return 'Priority finding — the care team has been alerted and is acting on it now.'
  if (e.severity === 'warning')
    return "Flagged for the doctor's attention. You may be asked a few extra questions about this."
  return null
}

type StreamNode =
  | { kind: 'stage'; stage: StageKey; key: string }
  | { kind: 'event'; event: JourneyEvent; stage: StageKey; key: string }
  | { kind: 'cta'; stage: StageKey; key: string }

interface Props {
  patientId: string
  patientName: string
  className?: string
}

/**
 * Agentix HIMS patient journey flow — a centred vertical flowchart of a
 * patient's path through the hospital. Reads every department store via
 * aggregateJourney, groups the chronological stream into journey stages, and
 * renders milestone banners, content cards with category chips, connector dots,
 * and close-of-stage CTAs.
 */
export function PatientJourneyFlow({ patientId, patientName, className }: Props) {
  const events = useMemo(() => aggregateJourney(patientId, patientName), [patientId, patientName])

  const stream = useMemo<StreamNode[]>(() => {
    const out: StreamNode[] = []
    let current: StageKey | null = null
    events.forEach((e, idx) => {
      const stage = STAGE_OF[e.dept]
      if (stage !== current) {
        if (current && STAGE_CTA[current]) out.push({ kind: 'cta', stage: current, key: `cta-${current}-${idx}` })
        out.push({ kind: 'stage', stage, key: `stage-${stage}-${idx}` })
        current = stage
      }
      out.push({ kind: 'event', event: e, stage, key: `event-${idx}` })
    })
    if (current && STAGE_CTA[current]) out.push({ kind: 'cta', stage: current, key: `cta-${current}-end` })
    return out
  }, [events])

  if (events.length === 0) {
    return (
      <div className={cn("hms-card p-8 text-center", className)}>
        <Flag className="h-7 w-7 text-foreground-placeholder mx-auto mb-3" />
        <p className="t-title text-foreground">The journey hasn't started yet</p>
        <p className="t-body ink-muted mt-1">Every touchpoint across departments will appear here as care unfolds.</p>
      </div>
    )
  }

  const reachedCount = new Set(events.map(e => STAGE_OF[e.dept])).size

  return (
    <div className={cn("relative rounded-3xl bg-[color:var(--color-primary-soft)] px-3 py-6 sm:px-6 sm:py-8", className)}>
      <div className="mx-auto max-w-2xl">
        {/* ── Header + legend ─────────────────────────────────── */}
        <div className="text-center">
          <span className="chip chip-accent mx-auto"><Sparkles className="h-3.5 w-3.5" />Patient Journey Flow</span>
          <h2 className="t-h2 text-foreground mt-3">Care pathway</h2>
          <p className="t-body ink-muted mt-1">
            {reachedCount} of {STAGE_ORDER.length} stages reached · {events.length} touchpoints
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            {(Object.keys(SEV) as EventSeverity[]).map(s => (
              <span key={s} className="inline-flex items-center gap-1.5 t-caption ink-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEV[s].color }} />
                {SEV[s].label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Flow ────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-col items-center">
          <StartBadge />
          {stream.map((node) => (
            <div key={node.key} className="flex w-full flex-col items-center">
              <Connector />
              {node.kind === 'stage' ? (
                <MilestonePill stage={node.stage} />
              ) : node.kind === 'cta' ? (
                <CtaButton stage={node.stage} />
              ) : (
                <FlowCard event={node.event} stage={node.stage} />
              )}
            </div>
          ))}
          <Connector />
          <EndBadge />
        </div>
      </div>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex h-7 flex-col items-center justify-center" aria-hidden>
      <div className="h-2.5 w-px bg-border" />
      <div className="h-1.5 w-1.5 rounded-full bg-border" />
      <div className="h-2.5 w-px bg-border" />
    </div>
  )
}

function StartBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-white shadow-sm">
      <Flag className="h-3.5 w-3.5" />Start · Patient arrives
    </span>
  )
}

function EndBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold uppercase tracking-wide text-white shadow-sm" style={{ background: 'var(--color-success)' }}>
      <CheckCircle2 className="h-3.5 w-3.5" />Journey complete
    </span>
  )
}

function MilestonePill({ stage }: { stage: StageKey }) {
  const m = STAGE_META[stage]
  const Icon = m.icon
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-extrabold text-white shadow-md"
      style={{ background: `linear-gradient(135deg, ${m.accent} 0%, ${m.accent}cc 100%)` }}
    >
      <Icon className="h-4 w-4" />{m.label}
    </motion.span>
  )
}

function CtaButton({ stage }: { stage: StageKey }) {
  const cta = STAGE_CTA[stage]!
  const Icon = cta.icon
  return (
    <button
      onClick={() => toast.success(cta.label, { description: 'Prototype action — wired to the journey demo.' })}
      className="inline-flex items-center gap-2 rounded-full gradient-primary px-6 py-3 text-[14px] font-bold text-white shadow-[var(--shadow-md)] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
    >
      <Icon className="h-4 w-4" />{cta.label}
    </button>
  )
}

function FlowCard({ event, stage }: { event: JourneyEvent; stage: StageKey }) {
  const sev = SEV[event.severity]
  const SevIcon = sev.icon
  const DeptIcon = DEPT_ICON[event.dept]
  const accent = STAGE_META[stage].accent
  const insight = insightFor(event)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("w-full rounded-2xl border p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]", sev.cardTint, sev.cardBorder)}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
          <DeptIcon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="t-overline" style={{ color: accent }}>{event.dept}</span>
            <span className="t-caption ink-subtle inline-flex items-center gap-1" suppressHydrationWarning>
              <Clock className="h-3 w-3" />{fmtRel(event.at)}
            </span>
          </div>
          <p className="t-title text-foreground mt-0.5">{event.title}</p>
          {event.detail && <p className="t-body ink-muted mt-1 leading-relaxed">{event.detail}</p>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        <span className={cn("chip", sev.chip)}><SevIcon className="h-3 w-3" />{sev.label}</span>
        {event.actor && <span className="chip chip-neutral">{event.actor}</span>}
        <span className="chip chip-neutral" suppressHydrationWarning>{fmtAbs(event.at)}</span>
      </div>

      {insight && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[color:var(--color-primary-soft)] px-3 py-2">
          <Sparkles className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
          <p className="t-caption text-foreground-muted leading-relaxed">{insight}</p>
        </div>
      )}
    </motion.div>
  )
}
