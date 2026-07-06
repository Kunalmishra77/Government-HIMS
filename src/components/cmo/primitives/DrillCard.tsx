"use client"
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab { id: string; label: string }

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  tabs?: Tab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: 'default' | 'wide'
}

export function DrillCard({ open, onClose, title, subtitle, tabs, activeTab, onTabChange, children, footer, width = 'default' }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const panelW    = width === 'wide' ? '560px' : '480px'

  useEffect(() => {
    if (open) setTimeout(() => drawerRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
        style={{ animation: 'cmo-fade-up 150ms ease-out forwards' }}
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="fixed right-0 top-0 h-full z-50 flex flex-col bg-white outline-none"
        style={{
          width: panelW,
          maxWidth: '100vw',
          boxShadow: 'var(--shadow-modal)',
          borderLeft: '1px solid var(--color-border)',
          animation: 'cmo-slide-in-right 220ms cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-[var(--color-foreground)] leading-snug">{title}</h2>
            {subtitle && <p className="text-[11.5px] text-[var(--color-foreground-lighter)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg text-[var(--color-foreground-lighter)] hover:text-[var(--color-foreground)] hover:bg-slate-100 transition-all duration-150 -mt-0.5 -mr-1"
            aria-label="Close panel"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        {tabs && tabs.length > 0 && (
          <div className="flex flex-shrink-0 overflow-x-auto px-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px whitespace-nowrap transition-all duration-150',
                  activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-foreground-lighter)] hover:text-[var(--color-foreground-muted)]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center gap-2.5 px-5 py-4 flex-shrink-0 flex-wrap"
            style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-raised)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
