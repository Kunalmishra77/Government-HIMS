'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ClipboardList, Search } from 'lucide-react'
import { useSecretaryAuditStore } from '@/store/useSecretaryAuditStore'

export default function SecretaryAuditLogPage() {
  const t = useTranslations('secretary')
  const { log } = useSecretaryAuditStore()
  const [search, setSearch] = useState('')

  const filtered = log.filter(entry =>
    entry.action.toLowerCase().includes(search.toLowerCase()) ||
    entry.target.toLowerCase().includes(search.toLowerCase()) ||
    (entry.details || '').toLowerCase().includes(search.toLowerCase())
  )

  const ACTION_COLORS: Record<string, string> = {
    approve: 'bg-emerald-100 text-emerald-700',
    reject: 'bg-rose-100 text-rose-700',
    acknowledge: 'bg-surface-sunken text-accent',
    draft: 'bg-accent-soft text-accent',
    sign: 'bg-accent-soft text-accent',
    send: 'bg-accent-soft text-accent',
    fetch: 'bg-slate-100 text-slate-600',
  }

  function actionColor(action: string) {
    const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k))
    return key ? ACTION_COLORS[key] : 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('auditLog.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('auditLog.subtitle')}</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-foreground-lighter)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('auditLog.searchPlaceholder')} className="pl-9 pr-4 py-2 border border-[var(--color-border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-full" />
      </div>
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-foreground-muted)]">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? t('auditLog.noMatch') : t('auditLog.empty')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('auditLog.colTime')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('auditLog.colAction')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('auditLog.colTarget')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('auditLog.colDetails')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map((entry, i) => (
                <tr key={i} className="hover:bg-[var(--color-surface-raised)]">
                  <td className="px-5 py-3 text-xs text-[var(--color-foreground-lighter)] whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${actionColor(entry.action)}`}>{entry.action}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--color-foreground)]">{entry.target}</td>
                  <td className="px-5 py-3 text-xs text-[var(--color-foreground-muted)] max-w-xs truncate">{entry.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
