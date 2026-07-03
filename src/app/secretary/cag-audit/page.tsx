'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

const CAG_ITEMS = [
  { id: 'cag001', report: 'CAG Report on NRHM Fund Utilization 2022-23', para: 'Para 4.2 — PMUs show ₹32.4 Cr unspent balance returned', dueDate: '2024-07-15', status: 'pending', daysLeft: 22, amount: '₹32.4 Cr' },
  { id: 'cag002', report: 'State Finance Audit 2023', para: 'Para 8.1 — Drug procurement tender irregularity', dueDate: '2024-07-08', status: 'draft', daysLeft: 15, amount: '₹8.8 Cr' },
  { id: 'cag003', report: 'CAG Performance Audit — NHM MP 2024', para: 'Para 2.3 — HMIS data quality findings', dueDate: '2024-06-30', status: 'overdue', daysLeft: -7, amount: '' },
  { id: 'cag004', report: 'Special Audit: PM-JAY empanelment', para: 'Para 5.1 — 14 hospitals with documentation gaps', dueDate: '2024-08-01', status: 'pending', daysLeft: 39, amount: '₹12.6 Cr' },
]

const RTI_ITEMS = [
  { id: 'rti001', subject: 'Doctor vacancies in Dindori district', applicant: 'Jansandesh Trust', dueDate: '2024-06-28', daysLeft: 5, status: 'pending' },
  { id: 'rti002', subject: 'PM-JAY claim data 2023-24', applicant: 'Unknown (RTI Portal)', dueDate: '2024-07-05', daysLeft: 12, status: 'draft' },
  { id: 'rti003', subject: 'NQAS certification process', applicant: 'Media RTI', dueDate: '2024-07-10', daysLeft: 17, status: 'pending' },
]

const STATUS_STYLES = {
  pending: { badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-400' },
  draft: { badge: 'bg-surface-sunken text-accent', border: 'border-l-slate-400' },
  overdue: { badge: 'bg-rose-100 text-rose-700', border: 'border-l-rose-500' },
  submitted: { badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-400' },
}

export default function CagAuditPage() {
  const t = useTranslations('secretary')
  const [tab, setTab] = useState<'cag' | 'rti'>('cag')
  const overdue = [...CAG_ITEMS, ...RTI_ITEMS].filter(i => i.status === 'overdue' || i.daysLeft < 7).length

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('cagAudit.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('cagAudit.subtitle')}</p>
      </div>
      {overdue > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm text-rose-700 font-medium">{t('cagAudit.overdueAlert', { count: overdue })}</p>
        </div>
      )}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['cag', 'rti'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-5 py-2 rounded-lg text-sm transition-all ${tab === tb ? 'bg-white text-[var(--color-accent)] font-semibold shadow' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
            {tb === 'cag' ? t('cagAudit.tabCag') : t('cagAudit.tabRti')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tab === 'cag' && CAG_ITEMS.map(item => {
          const st = STATUS_STYLES[item.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending
          return (
            <div key={item.id} className={`bg-white border border-[var(--color-border)] border-l-4 ${st.border} rounded-xl p-5`} style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>{item.status}</span>
                    {item.daysLeft < 0 ? (
                      <span className="text-[10px] text-rose-600 font-bold">{t('cagAudit.daysOverdue', { count: Math.abs(item.daysLeft) })}</span>
                    ) : (
                      <span className={`text-[10px] font-medium ${item.daysLeft < 15 ? 'text-amber-600' : 'text-[var(--color-foreground-lighter)]'}`}>{t('cagAudit.daysLeft', { count: item.daysLeft })}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">{item.report}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{item.para}</p>
                  {item.amount && <p className="text-xs text-rose-600 font-medium mt-1">{t('cagAudit.financialImplication', { amount: item.amount })}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg">{t('cagAudit.draftReply')}</button>
                  <button className="px-3 py-1.5 border border-[var(--color-border)] text-xs font-medium rounded-lg">{t('cagAudit.assign')}</button>
                </div>
              </div>
            </div>
          )
        })}

        {tab === 'rti' && RTI_ITEMS.map(item => {
          const st = STATUS_STYLES[item.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending
          return (
            <div key={item.id} className={`bg-white border border-[var(--color-border)] border-l-4 ${st.border} rounded-xl p-5`} style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>{item.status}</span>
                    <span className={`text-[10px] font-medium ${item.daysLeft < 7 ? 'text-rose-600' : 'text-[var(--color-foreground-lighter)]'}`}>{t('cagAudit.daysLeftDue', { count: item.daysLeft, date: item.dueDate })}</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">{item.subject}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{t('cagAudit.applicant', { applicant: item.applicant })}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg">{t('cagAudit.draftReply')}</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
