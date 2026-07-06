"use client"
import { cn } from '@/lib/utils'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import type { FacilityStatus } from '@/types/cmo'

interface Props {
  name: string
  type: string
  block: string
  status: FacilityStatus
  summary: string
  alertCount: number
  onClick?: () => void
}

const statusConfig: Record<FacilityStatus, { dot: string; badge: string; leftBorder: string }> = {
  ok:       { dot: 'bg-[var(--color-success)]',  badge: 'bg-[var(--color-success-bg)] text-green-700 border-green-200',    leftBorder: '' },
  watch:    { dot: 'bg-[var(--color-info)]',      badge: 'bg-[var(--color-info-bg)] text-accent border-border',         leftBorder: '' },
  warning:  { dot: 'bg-[var(--color-warning)]',  badge: 'bg-[var(--color-warning-bg)] text-amber-700 border-amber-200',    leftBorder: 'border-l-2 border-l-amber-400' },
  critical: { dot: 'bg-[var(--color-danger)]',   badge: 'bg-[var(--color-danger-bg)] text-red-700 border-red-200',         leftBorder: 'border-l-2 border-l-[var(--color-danger)]' },
}

export function FacilityRow({ name, type, block, status, summary, alertCount, onClick }: Props) {
  const c = statusConfig[status]
  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3.5 px-4 py-3 bg-white rounded-xl cursor-pointer transition-all duration-150',
        'hover:shadow-[var(--shadow-card-hover)]',
        c.leftBorder,
      )}
      style={{ border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5', c.dot)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-semibold text-[var(--color-foreground)] truncate">{name}</p>
          <span className={cn('text-[9.5px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide', c.badge)}>
            {type}
          </span>
        </div>
        <p className="text-[11px] text-[var(--color-foreground-lighter)] mt-0.5 truncate">{block} · {summary}</p>
      </div>

      {alertCount > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0 text-[10.5px] font-semibold text-red-600 bg-[var(--color-danger-bg)] border border-red-200 px-2 py-0.5 rounded-full">
          <AlertTriangle size={10} />
          {alertCount}
        </div>
      )}

      <ChevronRight size={13} className="text-[var(--color-foreground-lighter)] flex-shrink-0 group-hover:text-[var(--color-accent)] transition-colors" />
    </div>
  )
}
