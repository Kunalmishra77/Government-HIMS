'use client'

import { useTranslations } from 'next-intl'
import { FileText, Download, CheckCircle, Clock } from 'lucide-react'

const REPORTS = [
  { name: 'National Health Mission — Annual PIP', hi: 'NHM वार्षिक कार्यक्रम', due: '2024-09-30', status: 'In preparation', progress: 45, type: 'Annual plan' },
  { name: 'HMIS Monthly Return (June 2024)', hi: 'HMIS मासिक रिपोर्ट', due: '2024-07-10', status: 'Data entry pending', progress: 82, type: 'Monthly' },
  { name: 'NHM FY24 Progress Report', hi: 'NHM वार्षिक प्रगति', due: '2024-07-15', status: 'Under review', progress: 92, type: 'Annual' },
  { name: 'District Health Action Plan (DHAP) — 52 districts', hi: 'DHAP', due: '2024-08-31', status: 'CMO uploads pending', progress: 38, type: 'Annual plan' },
  { name: 'IDSP Weekly Surveillance (W25)', hi: 'IDSP साप्ताहिक', due: '2024-06-28', status: 'Submitted', progress: 100, type: 'Weekly' },
  { name: 'RHS Annual Report FY23-24', hi: 'RHS वार्षिक', due: '2024-07-31', status: 'Draft ready', progress: 75, type: 'Annual' },
  { name: 'CAG Health Audit response (composite)', hi: 'CAG प्रतिक्रिया', due: '2024-07-08', status: 'Urgent — 15 days left', progress: 60, type: 'Compliance' },
]

const STATUS_BADGE = {
  'Submitted': 'bg-emerald-100 text-emerald-700',
  'Under review': 'bg-surface-sunken text-accent',
  'In preparation': 'bg-amber-100 text-amber-700',
  'Draft ready': 'bg-accent-soft text-accent',
  'Data entry pending': 'bg-accent-soft text-accent',
  'CMO uploads pending': 'bg-accent-soft text-accent',
  'Urgent — 15 days left': 'bg-rose-100 text-rose-700',
}

export default function ReportsPage() {
  const t = useTranslations('secretary')
  const submitted = REPORTS.filter(r => r.status === 'Submitted').length

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('reports.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('reports.subtitle')}</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('reports.tracked'), value: String(REPORTS.length) },
          { label: t('reports.submitted'), value: String(submitted) },
          { label: t('reports.pendingUrgent'), value: String(REPORTS.length - submitted), warn: true },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-amber-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {REPORTS.map(r => {
          const badge = STATUS_BADGE[r.status as keyof typeof STATUS_BADGE] || 'bg-slate-100 text-slate-500'
          return (
            <div key={r.name} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.type}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge}`}>{r.status}</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">{r.name}</p>
                  <p className="text-[10px] text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{r.hi}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{t('reports.due', { date: r.due })}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {r.progress === 100 && <button className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"><Download className="h-3 w-3" /> {t('reports.download')}</button>}
                  <button className="px-3 py-1.5 border border-[var(--color-border)] text-xs rounded-lg hover:bg-[var(--color-surface-raised)]">{t('reports.view')}</button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full ${r.progress >= 90 ? 'bg-emerald-500' : r.progress >= 60 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${r.progress}%` }} />
                </div>
                <span className="text-xs font-medium text-[var(--color-foreground-muted)] w-8 text-right">{r.progress}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
