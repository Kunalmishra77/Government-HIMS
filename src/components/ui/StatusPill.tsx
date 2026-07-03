"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  AlertOctagon, AlertTriangle, CheckCircle2, Clock, Info, Activity, MinusCircle, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Unified clinical status system.
 *
 * A senior healthtech rule: status is NEVER encoded by colour alone — that
 * fails colour-blind users and is a patient-safety defect. Every pill carries
 * colour + icon + text, so meaning survives in greyscale, on glare-y ward
 * tablets, and for screen readers. One vocabulary, used everywhere, so a red
 * octagon means "critical" on the doctor worklist, the lab bench and the
 * patient app alike (learnability = fewer errors).
 */
export type Status =
  | "critical"   // life-threatening / immediate action (red)
  | "urgent"     // high priority, act soon (orange)
  | "caution"    // needs attention / abnormal (amber)
  | "stable"     // normal / healthy / on-track (green)
  | "info"       // informational / brand (blue)
  | "pending"    // waiting / in queue / scheduled (slate)
  | "done"       // completed / resolved (green, quieter)
  | "neutral"    // default

interface StatusMeta { label: string; icon: LucideIcon; cls: string; dot: string }

const STATUS: Record<Status, StatusMeta> = {
  critical: { label: "Critical", icon: AlertOctagon,  cls: "bg-danger-bg text-danger",            dot: "bg-danger" },
  urgent:   { label: "Urgent",   icon: AlertTriangle, cls: "bg-urgent-bg text-urgent",            dot: "bg-urgent" },
  caution:  { label: "Caution",  icon: AlertTriangle, cls: "bg-warning-bg text-warning",          dot: "bg-warning" },
  stable:   { label: "Stable",   icon: Activity,      cls: "bg-success-bg text-success",          dot: "bg-success" },
  info:     { label: "Info",     icon: Info,          cls: "bg-accent-soft text-accent",         dot: "bg-accent" },
  pending:  { label: "Pending",  icon: Clock,         cls: "bg-surface-sunken text-foreground-muted", dot: "bg-foreground-placeholder" },
  done:     { label: "Done",     icon: CheckCircle2,  cls: "bg-success-bg text-success",          dot: "bg-success" },
  neutral:  { label: "—",        icon: MinusCircle,   cls: "bg-surface-sunken text-foreground-muted", dot: "bg-foreground-placeholder" },
}

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status
  /** Override the default word for this status (e.g. "In queue" instead of "Pending"). */
  label?: string
  size?: "sm" | "md"
  /** Compact dot+label form for dense worklists; the icon is dropped but the word stays. */
  dense?: boolean
}

export function StatusPill({ status, label, size = "sm", dense, className, ...props }: StatusPillProps) {
  const t = useTranslations("ui")
  const meta = STATUS[status]
  const defaultLabel = t.has(`status.${status}`) ? t(`status.${status}`) : meta.label
  const text = label ?? defaultLabel
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.cls,
        className
      )}
      {...props}
    >
      {dense
        ? <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", meta.dot)} aria-hidden="true" />
        : <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
      {text}
    </span>
  )
}

/** The semantic vocabulary, exported for callers that need to map domain states. */
export { STATUS as STATUS_META }
