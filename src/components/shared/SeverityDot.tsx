import { cn } from '@/lib/utils'
import type { AlertSeverity } from '@/types/cmo'

const config: Record<AlertSeverity, { dot: string; label: string; badge: string }> = {
  critical: { dot: 'bg-[var(--color-danger)]',    label: 'Critical', badge: 'bg-[var(--color-danger-bg)] text-red-700 border-red-200' },
  warning:  { dot: 'bg-[var(--color-warning)]',   label: 'Warning',  badge: 'bg-[var(--color-warning-bg)] text-amber-700 border-amber-200' },
  info:     { dot: 'bg-[var(--color-info)]',       label: 'Info',     badge: 'bg-[var(--color-info-bg)] text-accent border-border' },
}

interface Props { severity: AlertSeverity; showLabel?: boolean }

export function SeverityDot({ severity, showLabel }: Props) {
  const c = config[severity]
  if (showLabel) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', c.badge)}>
        <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', c.dot)} />
        {c.label}
      </span>
    )
  }
  return <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', c.dot)} />
}
