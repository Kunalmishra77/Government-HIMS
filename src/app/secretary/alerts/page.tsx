'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AlertTriangle, Bell, Filter, CheckCircle, X, ChevronRight, RefreshCw,
} from 'lucide-react'
import { useSecretaryAlertsStore } from '@/store/useSecretaryAlertsStore'
import type { StateAlert } from '@/types/secretary'

const SEV_STYLES = {
  critical: { dot: 'bg-rose-500', border: 'border-l-rose-500', badge: 'bg-rose-100 text-rose-700' },
  warning:  { dot: 'bg-amber-500', border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700' },
  info:     { dot: 'bg-surface-sunken',  border: 'border-l-slate-400',  badge: 'bg-surface-sunken text-accent' },
}

function AlertCard({ alert }: { alert: StateAlert }) {
  const t = useTranslations('secretary')
  const { acknowledge, dismiss } = useSecretaryAlertsStore()
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)
  const st = SEV_STYLES[alert.severity]

  async function ack() { setActing(true); await acknowledge(alert.id); setActing(false) }
  async function dis() { setActing(true); await dismiss(alert.id); setActing(false) }

  return (
    <div className={`bg-white border border-[var(--color-border)] border-l-4 ${st.border} rounded-xl overflow-hidden transition-all`} style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${st.dot}`} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>{alert.severity.toUpperCase()}</span>
                {alert.district && <span className="text-[10px] text-[var(--color-foreground-muted)] bg-slate-100 px-2 py-0.5 rounded-full">{alert.district}</span>}
                <span className="text-[10px] text-[var(--color-foreground-lighter)]">{t('alerts.minAgo', { count: Math.round(alert.ageMinutes) })}</span>
              </div>
              <p className="text-sm font-semibold text-[var(--color-foreground)] mt-1">{alert.title}</p>
              <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{alert.detail}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {alert.owner && (
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{alert.owner.name}</span>
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-[var(--color-surface-raised)] rounded-lg">
              <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>
        {expanded && (
          <div className="mt-3 space-y-2 pl-5">
            <div>
              <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">{t('common.recommendedActions')}</p>
              {alert.recommendedActions.map((a, i) => (
                <p key={i} className="text-xs text-[var(--color-foreground)] flex items-start gap-1.5">
                  <span className="text-[var(--color-accent)] mt-0.5">•</span>{a}
                </p>
              ))}
            </div>
            {alert.timeline.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">{t('common.timeline')}</p>
                {alert.timeline.slice(-3).map((t, i) => (
                  <div key={i} className="text-xs text-[var(--color-foreground-muted)] flex gap-2">
                    <span className="text-[var(--color-foreground-lighter)] whitespace-nowrap">{new Date(t.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span><strong>{t.actor}</strong> — {t.action}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!alert.acknowledged && (
          <div className="flex gap-2 mt-3">
            <button onClick={ack} disabled={acting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50">
              {acting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} {t('common.acknowledge')}
            </button>
            <button onClick={dis} disabled={acting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] text-xs font-medium rounded-lg hover:bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)]">
              <X className="h-3 w-3" /> {t('common.dismiss')}
            </button>
          </div>
        )}
        {alert.acknowledged && (
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle className="h-3 w-3" /> {t('common.acknowledged')}
          </span>
        )}
      </div>
    </div>
  )
}

export default function SecretaryAlertsPage() {
  const t = useTranslations('secretary')
  const { alerts } = useSecretaryAlertsStore()
  const [sevFilter, setSevFilter] = useState<'all' | StateAlert['severity']>('all')
  const filterLabels: Record<string, string> = {
    all: t('alerts.filterAll'), critical: t('alerts.filterCritical'), warning: t('alerts.filterWarning'), info: t('alerts.filterInfo'),
  }

  const filtered = sevFilter === 'all' ? alerts : alerts.filter(a => a.severity === sevFilter)
  const counts = { critical: alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length, warning: alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length, info: alerts.filter(a => a.severity === 'info' && !a.acknowledged).length }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('alerts.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('alerts.subtitle', { unack: alerts.filter(a => !a.acknowledged).length, total: alerts.length })}</p>
      </div>
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['all', 'critical', 'warning', 'info'] as const).map(s => (
            <button key={s} onClick={() => setSevFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-xs transition-all ${sevFilter === s ? 'bg-white shadow font-semibold text-[var(--color-accent)]' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
              {filterLabels[s]}{s !== 'all' && counts[s] > 0 && <span className="ml-1 text-[10px] bg-rose-500 text-white px-1.5 rounded-full">{counts[s]}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map(a => <AlertCard key={a.id} alert={a} />)}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--color-foreground-muted)]">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>{t('alerts.empty')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
