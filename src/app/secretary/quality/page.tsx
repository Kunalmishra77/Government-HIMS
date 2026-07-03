'use client'

import { useTranslations } from 'next-intl'
import { Star, CheckCircle, AlertTriangle } from 'lucide-react'

const NABH_STATUS = [
  { name: 'DH Bhopal', type: 'DH', status: 'NABH Full' },
  { name: 'DH Indore', type: 'DH', status: 'NABH Full' },
  { name: 'CHC Sehore', type: 'CHC', status: 'NABH Entry' },
  { name: 'DH Gwalior', type: 'DH', status: 'NQAS' },
  { name: 'DH Jabalpur', type: 'DH', status: 'NABH Full' },
  { name: 'CHC Mandla', type: 'CHC', status: 'In progress' },
  { name: 'PHC Umaria', type: 'PHC', status: 'In progress' },
  { name: 'DH Dindori', type: 'DH', status: 'Not started' },
]

const INCIDENTS = [
  { id: 'inc001', type: 'Maternal death', facility: 'DH Sehore', date: '2024-06-21', status: 'Under review', severity: 'critical' },
  { id: 'inc002', type: 'Medication error', facility: 'CHC Raisen', date: '2024-06-20', status: 'RCA in progress', severity: 'warning' },
  { id: 'inc003', type: 'Equipment failure', facility: 'DH Datia', date: '2024-06-19', status: 'Resolved', severity: 'warning' },
  { id: 'inc004', type: 'Neonatal death', facility: 'DH Shivpuri', date: '2024-06-18', status: 'Closed', severity: 'critical' },
]

const SEV_STYLES = {
  critical: { badge: 'bg-rose-100 text-rose-700', border: 'border-l-rose-500' },
  warning:  { badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500' },
  info:     { badge: 'bg-surface-sunken text-accent', border: 'border-l-slate-400' },
}

const STATUS_BADGE = {
  'NABH Full': 'bg-emerald-100 text-emerald-700',
  'NABH Entry': 'bg-accent-soft text-accent',
  'NQAS': 'bg-surface-sunken text-accent',
  'In progress': 'bg-amber-100 text-amber-700',
  'Not started': 'bg-slate-100 text-slate-500',
}

export default function QualityPage() {
  const t = useTranslations('secretary')
  const nabh = NABH_STATUS.filter(n => n.status.startsWith('NABH')).length
  const nqas = NABH_STATUS.filter(n => n.status === 'NQAS').length

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('quality.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('quality.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('quality.kpiNabh'), value: t('quality.kpiNabhValue', { count: nabh }), sub: t('quality.kpiNabhSub'), warn: false },
          { label: t('quality.kpiNqas'), value: t('quality.kpiNqasValue', { count: nqas }), sub: t('quality.kpiNqasSub'), warn: false },
          { label: t('quality.kpiOpenIncidents'), value: String(INCIDENTS.filter(i => i.status !== 'Closed' && i.status !== 'Resolved').length), warn: true },
          { label: t('quality.kpiSatisfaction'), value: '72%', sub: t('quality.kpiSatisfactionSub'), warn: false },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* NABH/NQAS status */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('quality.certificationStatus')}</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {NABH_STATUS.map(n => (
              <div key={n.name} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{n.name}</p>
                  <span className="text-[10px] text-[var(--color-foreground-lighter)]">{n.type}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[n.status as keyof typeof STATUS_BADGE] || 'bg-slate-100 text-slate-500'}`}>{n.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Incident feed */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('quality.recentIncidents')}</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {INCIDENTS.map(inc => {
              const st = SEV_STYLES[inc.severity as keyof typeof SEV_STYLES]
              return (
                <div key={inc.id} className={`px-5 py-3 border-l-4 ${st.border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mr-2 ${st.badge}`}>{inc.severity}</span>
                      <span className="text-xs text-[var(--color-foreground-lighter)]">{inc.date}</span>
                      <p className="text-sm font-medium text-[var(--color-foreground)] mt-0.5">{inc.type}</p>
                      <p className="text-xs text-[var(--color-foreground-muted)]">{inc.facility}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${inc.status === 'Closed' || inc.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{inc.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
