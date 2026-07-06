import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ReactNode } from 'react'

interface Props {
  label: string
  value: number | string
  delta?: number
  hint?: string
  variant?: 'default' | 'critical' | 'warning' | 'info' | 'success'
  icon?: ReactNode
  className?: string
}

const variants = {
  default: {
    card:  'bg-white border-[var(--color-border)]',
    label: 'text-[var(--color-foreground-lighter)]',
    value: 'text-[var(--color-foreground)]',
    hint:  'text-[var(--color-foreground-lighter)]',
    bar:   'bg-[var(--color-primary)]',
  },
  critical: {
    card:  'bg-[var(--color-danger-bg)] border-red-200',
    label: 'text-red-500',
    value: 'text-red-900',
    hint:  'text-red-400',
    bar:   'bg-[var(--color-danger)]',
  },
  warning: {
    card:  'bg-[var(--color-warning-bg)] border-amber-200',
    label: 'text-amber-500',
    value: 'text-amber-900',
    hint:  'text-amber-400',
    bar:   'bg-[var(--color-warning)]',
  },
  info: {
    card:  'bg-[var(--color-info-bg)] border-border',
    label: 'text-accent',
    value: 'text-accent',
    hint:  'text-primary-light',
    bar:   'bg-[var(--color-info)]',
  },
  success: {
    card:  'bg-[var(--color-success-bg)] border-green-200',
    label: 'text-green-600',
    value: 'text-green-900',
    hint:  'text-green-500',
    bar:   'bg-[var(--color-success)]',
  },
}

export function MetricTile({ label, value, delta, hint, variant = 'default', icon, className }: Props) {
  const v = variants[variant]
  const DeltaIcon = delta === undefined ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const deltaColor = delta === undefined ? '' : delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'

  return (
    <div
      className={cn(
        'relative rounded-xl border overflow-hidden transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)] cursor-default',
        v.card, className,
      )}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Thin left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full', v.bar)} />

      <div className="pl-5 pr-4 py-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className={cn('text-[11px] font-semibold uppercase tracking-wider', v.label)}>{label}</p>
          {icon && <span className={cn('flex-shrink-0 opacity-60', v.label)}>{icon}</span>}
        </div>

        <div className="flex items-end gap-2">
          <span className={cn('text-[26px] font-bold leading-none cmo-kpi-in', v.value)}>
            {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
          </span>
          {DeltaIcon && delta !== undefined && (
            <span className={cn('flex items-center gap-0.5 text-[11px] font-semibold mb-0.5', deltaColor)}>
              <DeltaIcon size={12} />
              {Math.abs(delta)}
            </span>
          )}
        </div>

        {hint && <p className={cn('text-[11px] mt-1 font-medium', v.hint)}>{hint}</p>}
      </div>
    </div>
  )
}
