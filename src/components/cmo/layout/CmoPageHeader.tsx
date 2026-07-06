import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  titleHindi?: string
  subtitle?: string
  actions?: ReactNode
  badge?: { label: string; variant?: 'default' | 'critical' | 'warning' | 'info' | 'success' }
}

const badgeStyles = {
  default:  'bg-slate-100 text-slate-700 border-slate-200',
  critical: 'bg-[var(--color-danger-bg)] text-red-700 border-red-200',
  warning:  'bg-[var(--color-warning-bg)] text-amber-700 border-amber-200',
  info:     'bg-[var(--color-info-bg)] text-accent border-border',
  success:  'bg-[var(--color-success-bg)] text-green-700 border-green-200',
}

export function CmoPageHeader({ title, titleHindi, subtitle, actions, badge }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 cmo-fade-up">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-[20px] font-bold text-[var(--color-foreground)] leading-tight tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', badgeStyles[badge.variant ?? 'default'])}>
              {badge.label}
            </span>
          )}
        </div>
        {titleHindi && (
          <p
            className="text-[12px] text-[var(--color-foreground-lighter)] mt-0.5 leading-relaxed"
            style={{ fontFamily: "'Noto Sans Devanagari', 'Nirmala UI', system-ui" }}
          >
            {titleHindi}
          </p>
        )}
        {subtitle && (
          <p className="text-[12.5px] text-[var(--color-foreground-muted)] mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">{actions}</div>}
    </div>
  )
}
