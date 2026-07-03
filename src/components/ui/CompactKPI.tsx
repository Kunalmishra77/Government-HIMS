"use client"

/* CompactKPI — small, dense KPI tile used in the M2 dashboard hero strip.
 *
 * Replaces the loose KPI cards (24px padding, 32px gaps) with a tighter row
 * of pill-stat tiles. Used additively — large KPI cards still exist where
 * the hero needs more density of information per tile.
 *
 *   <CompactKPI label="OPD waiting" value={12} tone="warn" trend="+3" />
 *
 * Tone is a soft tint, never a loud background.
 */
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "info" | "ok" | "warn" | "danger"

// Token-driven tints. The value reads in crisp ink across every tone (a wall of
// red numbers is noise); the tone shows through the soft tint + toned label +
// dot — restrained, Linear/Vercel-grade KPI tiles.
const TONE: Record<Tone, { bg: string; ring: string; labelFg: string; dot: string }> = {
  neutral: { bg: "bg-surface-sunken", ring: "ring-border",      labelFg: "text-foreground-lighter", dot: "bg-foreground-placeholder" },
  info:    { bg: "bg-accent-soft",    ring: "ring-primary/15",  labelFg: "text-accent",            dot: "bg-primary" },
  ok:      { bg: "bg-success-bg",     ring: "ring-success/20",  labelFg: "text-success-strong",     dot: "bg-success" },
  warn:    { bg: "bg-warning-bg",     ring: "ring-warning/25",  labelFg: "text-brand-amber-strong", dot: "bg-warning" },
  danger:  { bg: "bg-danger-bg",      ring: "ring-danger/25",   labelFg: "text-danger-strong",      dot: "bg-danger" },
}

interface CompactKPIProps {
  label: string
  value: string | number
  unit?: string
  trend?: string                       // e.g. "+3" / "-1.4%"
  /** Tones the trend semantically (up = success, down = danger). Omit to keep it muted. */
  trendDir?: "up" | "down"
  tone?: Tone
  hint?: string
  icon?: ReactNode
  onClick?: () => void
  className?: string
}

export function CompactKPI({ label, value, unit, trend, trendDir, tone = "neutral", hint, icon, onClick, className }: CompactKPIProps) {
  const t = TONE[tone]
  const Wrapper = onClick ? "button" : "div"
  const trendFg = trendDir === "up" ? "text-success-strong" : trendDir === "down" ? "text-danger-strong" : "text-foreground-lighter"
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={hint}
      className={cn(
        "rounded-[10px] ring-1 px-3 py-2.5 text-left flex items-center gap-2.5 min-w-[124px]",
        t.bg, t.ring,
        onClick ? "u-press cursor-pointer transition-shadow hover:shadow-card-hover" : "",
        className,
      )}
    >
      {icon ? <div className="flex-shrink-0 opacity-80">{icon}</div> : null}
      <div className="flex-1 min-w-0">
        <p className={cn("t-overline leading-none mb-1.5 truncate", t.labelFg)}>
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="t-kpi text-[20px] text-foreground">
            {value}
          </span>
          {unit ? <span className="text-[11px] font-medium text-foreground-lighter">{unit}</span> : null}
          {trend ? (
            <span className={cn("text-[11px] font-semibold tabular-nums ml-auto", trendFg)}>{trend}</span>
          ) : null}
        </div>
      </div>
    </Wrapper>
  )
}

/** Strip of CompactKPI tiles. */
export function CompactKPIStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  )
}
