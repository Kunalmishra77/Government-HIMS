"use client"
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { DrillCard } from '@/components/shared/DrillCard'
import { cn } from '@/lib/utils'

const INCIDENTS = [
  { id: 'i1', title: 'Wrong medication dispensed · PHC Kolar', severity: 'high', date: '2026-06-21', status: 'open', rca: 'Pharmacy staff confusion due to similar drug names. LASA drug policy not followed.' },
  { id: 'i2', title: 'Fall injury · Hamidia DH Ward 3', severity: 'medium', date: '2026-06-20', status: 'in-progress', rca: 'Under investigation. Bed rails not raised post-procedure.' },
  { id: 'i3', title: 'Delayed STAT lab result · ICU', severity: 'high', date: '2026-06-19', status: 'open', rca: 'Equipment malfunction. Backup process not activated.' },
]

const DEATHS = [
  { name: 'Savita Devi', age: 27, type: 'Maternal', facility: 'CHC Berasia', date: '2026-06-23', cause: 'PPH', auditStatus: 'open' },
  { name: 'Ramesh K.', age: 58, type: 'In-hospital', facility: 'Hamidia DH', date: '2026-06-22', cause: 'Acute MI', auditStatus: 'completed' },
]

const TAB_KEYS = ['quality.tabNqas', 'quality.tabIncidents', 'quality.tabDeathAudits', 'quality.tabPatientSatisfaction']

export default function CmoQualityPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)
  const [drillIncident, setDrillIncident] = useState<typeof INCIDENTS[0] | null>(null)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('quality.title')} />
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('quality.nqasCertified')} value="18 of 142" />
        <MetricTile label={t('quality.openIncidents')} value={INCIDENTS.length} variant="warning" />
        <MetricTile label={t('quality.pendingDeathAudits')} value="5" variant="critical" />
        <MetricTile label={t('quality.patientSatisfaction')} value="4.1/5" variant="success" />
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

      {tab === 1 && (
        <div className="space-y-3">
          {INCIDENTS.map(inc => (
            <div key={inc.id} onClick={() => setDrillIncident(inc)}
              className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5',
                  inc.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                  {inc.severity.toUpperCase()}
                </span>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">{inc.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{inc.date} · {inc.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th className="px-4 py-2.5 text-left font-medium">{t('quality.colPatient')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('quality.colType')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('quality.colFacility')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('quality.colCause')}</th>
              <th className="px-3 py-2.5 text-center font-medium">{t('quality.colAudit')}</th>
            </tr></thead>
            <tbody>
              {DEATHS.map((d, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{d.name}, {d.age}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.type}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.facility}</td>
                  <td className="px-3 py-2.5 text-slate-600">{d.cause}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      d.auditStatus === 'open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                      {d.auditStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 0 || tab === 3) && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-[13px]">
          {tab === 0 ? t('quality.nqasEmpty') : t('quality.satisfactionEmpty')}
        </div>
      )}

      <DrillCard open={!!drillIncident} onClose={() => setDrillIncident(null)} title={drillIncident?.title ?? ''} subtitle={drillIncident?.date}>
        {drillIncident && (
          <div className="space-y-3 text-[13px]">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-500 text-[11px]">{t('quality.severity')}</p>
              <p className="font-semibold capitalize text-slate-900">{drillIncident.severity}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">{t('quality.rca')}</p>
              <p className="text-slate-600 leading-relaxed">{drillIncident.rca}</p>
            </div>
          </div>
        )}
      </DrillCard>
    </div>
  )
}
