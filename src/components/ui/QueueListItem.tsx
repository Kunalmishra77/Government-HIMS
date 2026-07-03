"use client"

/**
 * Generalised worklist row — one dense, selectable line item for clinical
 * worklists (radiology inbox/reading/bench, nurse rounds/tasks, lab queues…).
 * Generalised from the doctor dashboard's `QueueEntry` so every module shares
 * the same Linear/Arc-grade row micro-interaction (hover lift, press, staggered
 * entrance) instead of hand-rolling its own.
 *
 *   <QueueListItem
 *     index={i}
 *     leading={<TokenSquare …/>}
 *     title={patient.name}
 *     subtitle={`${age}y · ${complaint}`}
 *     status={studyStatusToken(study.status)}
 *     meta={<span className="t-mono-num">{tat}</span>}
 *     selected={selectedId === id}
 *     onClick={() => select(id)}
 *   />
 *
 * Status is rendered via `StatusPill` (colour + icon + text) so meaning survives
 * greyscale — never colour alone.
 */
import { type ReactNode } from "react"
import { motion } from "framer-motion"
import { StatusPill } from "@/components/ui/StatusPill"
import type { StatusToken } from "@/lib/statusColors"
import { motionPresets } from "@/lib/design-tokens"
import { cn } from "@/lib/utils"

export interface QueueListItemProps {
  /** Leading visual — token square, avatar, modality glyph. */
  leading?: ReactNode
  title: string
  subtitle?: string
  /** Clinical state — rendered as a StatusPill (triple-encoded). */
  status?: StatusToken
  /** Render the status as a compact dot+label (dense worklists). */
  statusDense?: boolean
  /** Trailing metadata (TAT, time-ago…). Use `.t-mono-num` for figures. */
  meta?: ReactNode
  selected?: boolean
  onClick?: () => void
  /** Drives the staggered entrance (list index). */
  index?: number
  className?: string
}

export function QueueListItem({
  leading, title, subtitle, status, statusDense, meta, selected, onClick, index = 0, className,
}: QueueListItemProps) {
  const interactive = !!onClick
  return (
    <motion.button
      {...motionPresets.listItem(index)}
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left",
        "transition-all duration-200",
        interactive && "u-press cursor-pointer",
        selected
          ? "border-primary/30 bg-accent-soft ring-1 ring-primary/20"
          : "border-border bg-surface",
        interactive && !selected && "hover:-translate-y-0.5 hover:border-border-hover hover:shadow-card-hover",
        className,
      )}
    >
      {leading && <div className="flex-shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-bold", selected ? "text-accent" : "text-foreground")}>{title}</p>
        {subtitle && <p className="t-caption text-foreground-lighter truncate mt-0.5">{subtitle}</p>}
      </div>
      {meta && <div className="flex-shrink-0 text-foreground-lighter">{meta}</div>}
      {status && (
        <StatusPill status={status.status} label={status.label} dense={statusDense} className="flex-shrink-0" />
      )}
    </motion.button>
  )
}
