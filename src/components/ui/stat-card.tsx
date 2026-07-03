"use client"

import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

type StatColor = "blue" | "green" | "amber" | "red" | "purple" | "slate" | "teal"

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: { value: string; up: boolean }
  icon: React.ElementType
  color?: StatColor
  delay?: number
  onClick?: () => void
}

// Values render in neutral ink (enterprise-minimal); the icon chip carries a SOFT
// tinted accent (reference language — light bg + colored glyph, not a solid fill).
// Brand tones (blue/purple/teal/slate) collapse to the deep-blue system; status
// tones stay semantic; `green` uses the disciplined clinical brand-green token.
const COLOR_MAP: Record<StatColor, { icon: string; value: string }> = {
  blue:   { icon: "bg-accent-soft text-accent",            value: "text-foreground" },
  green:  { icon: "bg-brand-green-soft text-brand-green",   value: "text-foreground" },
  amber:  { icon: "bg-warning-bg text-warning",             value: "text-foreground" },
  red:    { icon: "bg-danger-bg text-danger",               value: "text-foreground" },
  purple: { icon: "bg-accent-soft text-accent",            value: "text-foreground" },
  slate:  { icon: "bg-surface-sunken text-foreground-muted",value: "text-foreground" },
  teal:   { icon: "bg-accent-soft text-accent",             value: "text-foreground" },
}

export function StatCard({ label, value, sub, trend, icon: Icon, color = "blue", delay = 0, onClick }: StatCardProps) {
  const c = COLOR_MAP[color]
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "bg-surface rounded-2xl border border-border p-5 shadow-card transition-all duration-200 hover:border-border-hover",
        onClick && "cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="t-label text-foreground-lighter mb-2">{label}</p>
          <p className={cn("text-[1.75rem] font-bold leading-none tracking-tight", c.value)}>{value}</p>
          {sub && <p className="t-caption text-foreground-lighter mt-2">{sub}</p>}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold mt-2 px-1.5 py-0.5 rounded-md",
              trend.up ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
            )}>
              {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}
            </div>
          )}
        </div>
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0", c.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  )
}
