"use client"

/* ReasoningChip — explainability primitive for M4-Wave-1.
 *
 * Used by every clinical-safety surface (S1 drug-safety, S2 early warning,
 * S3 critical-value, S15 day-in-review). Renders one of:
 *
 *   - A compact pill chip with title + confidence (default).
 *   - An expanded card with title + reasoning bullets + dismiss.
 *
 * Tone palette matches CompactKPI so the whole stack reads as one system.
 *
 *   <ReasoningChip tone="warn" title="NEWS2 = 5" reasons={["RR 22 (2pts)", "SpO2 92 (2pts)", "Temp 38.4 (1pt)"]} />
 */
import { useState, type ReactNode } from "react"
import { Info, AlertTriangle, ShieldAlert, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "ok" | "warn" | "danger"

const TONE: Record<Tone, { bg: string; ring: string; icon: typeof Info; iconCol: string; titleFg: string; bodyFg: string }> = {
  neutral: { bg: "bg-slate-50",     ring: "ring-slate-200/70",   icon: Info,         iconCol: "text-slate-500",  titleFg: "text-slate-900",  bodyFg: "text-slate-600"  },
  info:    { bg: "bg-[rgba(238,107,38,0.07)]/70",    ring: "ring-primary/25",   icon: Sparkles,     iconCol: "text-[var(--color-accent)]",   titleFg: "text-[var(--color-primary-dark)]",   bodyFg: "text-[var(--color-primary-dark)]"   },
  ok:      { bg: "bg-emerald-50/70", ring: "ring-emerald-200/70",icon: Info,         iconCol: "text-emerald-600",titleFg: "text-emerald-900",bodyFg: "text-emerald-800"},
  warn:    { bg: "bg-amber-50/70",   ring: "ring-amber-200/70",  icon: AlertTriangle,iconCol: "text-amber-600",  titleFg: "text-amber-900",  bodyFg: "text-amber-800"  },
  danger:  { bg: "bg-rose-50/70",    ring: "ring-rose-200/70",   icon: ShieldAlert,  iconCol: "text-rose-600",   titleFg: "text-rose-900",   bodyFg: "text-rose-800"   },
}

interface ReasoningChipProps {
  /** Headline of the explanation (e.g. "NEWS2 = 5" or "Allergy check"). */
  title: string
  /** Bulleted reasons that justify the title. */
  reasons?: string[]
  /** 0-1 confidence (rendered as %). */
  confidence?: number
  /** Tone — drives the colour palette + icon. */
  tone?: Tone
  /** When `compact`, renders a single-line chip; otherwise a card with reasons visible. */
  compact?: boolean
  /** Optional right-rail content (action button, etc.) */
  actions?: ReactNode
  className?: string
}

export function ReasoningChip({ title, reasons, confidence, tone = "info", compact, actions, className }: ReasoningChipProps) {
  const t = TONE[tone]
  const Icon = t.icon
  const [open, setOpen] = useState(!compact)

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1.5 rounded-md ring-1 px-2 py-1 text-[11px] font-semibold transition",
                       t.bg, t.ring, t.titleFg, className)}
      >
        <Icon className={cn("h-3 w-3", t.iconCol)} />
        <span>{title}</span>
        {typeof confidence === "number" ? (
          <span className={cn("font-mono text-[10px] opacity-70", t.bodyFg)}>· {Math.round(confidence * 100)}%</span>
        ) : null}
        {reasons && reasons.length ? (open ? <ChevronUp className="h-3 w-3 opacity-70" /> : <ChevronDown className="h-3 w-3 opacity-70" />) : null}
      </button>
    )
  }

  return (
    <div className={cn("rounded-[10px] ring-1 px-3 py-2.5 text-[12.5px]", t.bg, t.ring, className)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", t.iconCol)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn("font-semibold", t.titleFg)}>{title}</p>
            {typeof confidence === "number" ? (
              <span className={cn("text-[10px] font-mono opacity-80", t.bodyFg)}>{Math.round(confidence * 100)}% confidence</span>
            ) : null}
          </div>
          {reasons && reasons.length ? (
            <ul className={cn("mt-1.5 space-y-0.5", t.bodyFg)}>
              {reasons.map((r, i) => (
                <li key={i} className="text-[12px] flex gap-1.5">
                  <span className="opacity-50">·</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {actions ? <div className="flex-shrink-0 ml-2">{actions}</div> : null}
      </div>
    </div>
  )
}
