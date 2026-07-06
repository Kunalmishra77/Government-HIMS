"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const TAB_KEYS = ['schemes.tabPmjay', 'schemes.tabSambal', 'schemes.tabJsy', 'schemes.tabRbsk', 'schemes.tabFreeDrug', 'schemes.tabFraud']

const FRAUD_FLAGS = [
  { hospital: 'Shri Ram Hospital', cases: 14, pattern: 'Same ICD codes for different patients', risk: 'High', status: 'active' },
  { hospital: 'New Life Clinic', cases: 6, pattern: 'Duplicate claim submissions detected', risk: 'Medium', status: 'active' },
]

export default function CmoSchemesPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)
  const [fraud, setFraud] = useState(FRAUD_FLAGS)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('schemes.title')} />
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('schemes.claimsToday')} value="47" />
        <MetricTile label={t('schemes.approvedAmount')} value="₹4.2Cr" variant="success" />
        <MetricTile label={t('schemes.preAuthPending')} value="12" variant="warning" />
        <MetricTile label={t('schemes.fraudFlagged')} value={fraud.filter(f => f.status === 'active').length} variant="critical" />
      </div>
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TAB_KEYS.map((tabKey, i) => (
          <button key={tabKey} onClick={() => setTab(i)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px whitespace-nowrap transition-colors',
              tab === i ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t(tabKey)}
          </button>
        ))}
      </div>
      {tab === 5 ? (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-600">{t('schemes.aiFlagged')}</p>
          {fraud.map((f, i) => (
            <div key={i} className={cn('bg-white border rounded-xl p-4', f.status === 'active' ? 'border-red-200' : 'border-slate-200')}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">{f.hospital}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t('schemes.suspiciousClaims', { count: f.cases, pattern: f.pattern })}</p>
                </div>
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', f.risk === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{t('schemes.riskLevel', { risk: f.risk })}</span>
                {f.status === 'active' && (
                  <button onClick={() => { setFraud(fl => fl.map((x, j) => j === i ? {...x, status: 'suspended'} : x)); toast.success(t('schemes.suspended', { hospital: f.hospital })) }}
                    className="text-[10px] font-semibold px-2 py-1 bg-red-600 text-white rounded-lg">
                    {t('schemes.suspendEmpanelment')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-[13px]">
          {t('schemes.schemeLoading', { tab: t(TAB_KEYS[tab]) })}
        </div>
      )}
    </div>
  )
}
