"use client"
import { cn } from '@/lib/utils'
import type { AlertSeverity } from '@/types/cmo'

interface Props {
  severity: AlertSeverity
  title: string
  detail: string
  ageLabel: string
  facility: string
  source?: string
  isNew?: boolean
  acknowledged?: boolean
  onAcknowledge?: () => void
  onClick?: () => void
}

const severityConfig: Record<AlertSeverity, { border: string; bg: string; titleColor: string }> = {
  critical: {
    border:     'border-l-[var(--color-danger)]',
    bg:         'bg-[var(--color-danger-bg)] hover:brightness-95',
    titleColor: 'text-red-900',
  },
  warning: {
    border:     'border-l-[var(--color-warning)]',
    bg:         'bg-[var(--color-warning-bg)] hover:brightness-95',
    titleColor: 'text-amber-900',
  },
  info: {
    border:     'border-l-[var(--color-info)]',
    bg:         'bg-[var(--color-info-bg)] hover:brightness-95',
    titleColor: 'text-accent',
  },
}

export function AlertRow({ severity, title, detail, ageLabel, facility, source, isNew, acknowledged, onAcknowledge, onClick }: Props) {
  const c = severityConfig[severity]
  return (
    <div
      onClick={onClick}
      className={cn(
        'border-l-[3px] rounded-r-xl px-4 py-3 cursor-pointer transition-all duration-150 flex items-start gap-3',
        c.border, c.bg,
        isNew && 'cmo-new-alert',
        acknowledged && 'opacity-50',
      )}
    >
      <div className="flex-shrink-0 mt-1">
        <span className={cn('inline-flex h-2 w-2 rounded-full',
          severity === 'critical' ? 'bg-[var(--color-danger)]' : severity === 'warning' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-info)]'
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-[13px] font-semibold leading-snug truncate', c.titleColor)}>{title}</p>
          <span className="flex-shrink-0 text-[10.5px] text-[var(--color-foreground-lighter)] font-medium tabular-nums whitespace-nowrap">{ageLabel}</span>
        </div>
        <p className="text-[11.5px] text-[var(--color-foreground-muted)] mt-0.5 line-clamp-2 leading-relaxed">{detail}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-medium text-[var(--color-foreground-lighter)]">{facility}</span>
          {source && (
            <>
              <span className="text-[var(--color-border-hover)]">·</span>
              <span className="text-[10px] capitalize text-[var(--color-foreground-lighter)]">{source}</span>
            </>
          )}
        </div>
      </div>

      {onAcknowledge && !acknowledged && (
        <button
          onClick={e => { e.stopPropagation(); onAcknowledge() }}
          className="flex-shrink-0 self-center text-[10.5px] font-semibold px-2.5 py-1 rounded-md border border-[var(--color-border)] bg-white text-[var(--color-foreground-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-primary-soft)] transition-all duration-150"
        >
          Ack
        </button>
      )}
    </div>
  )
}
