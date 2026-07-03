"use client"
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const TAB_KEYS = ['diseasePrograms.tabTb', 'diseasePrograms.tabNcd', 'diseasePrograms.tabTribal', 'diseasePrograms.tabVector']

export default function CmoDiseaseProgramsPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <CmoPageHeader title={t('diseasePrograms.title')} />
      <div className="flex gap-1 border-b border-slate-200">
        {TAB_KEYS.map((tabKey, i) => (
          <button key={tabKey} onClick={() => setTab(i)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px whitespace-nowrap transition-colors',
              tab === i ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t(tabKey)}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <MetricTile label={t('diseasePrograms.newNotifications')} value="142" />
            <MetricTile label={t('diseasePrograms.treatmentSuccess')} value="87%" variant="success" />
            <MetricTile label={t('diseasePrograms.defaulters')} value="8" variant="warning" />
            <MetricTile label={t('diseasePrograms.nikshayMitra')} value="34" />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-[13px] text-slate-600">
            <p className="font-semibold text-slate-900 mb-2">{t('diseasePrograms.tbStatus')}</p>
            <p>{t('diseasePrograms.tbStatusDetail')}</p>
          </div>
        </div>
      )}
      {tab === 1 && (
        <div className="grid grid-cols-3 gap-3">
          <MetricTile label={t('diseasePrograms.screened30plus')} value="14,200" />
          <MetricTile label={t('diseasePrograms.htnPositive')} value="3,847" variant="warning" />
          <MetricTile label={t('diseasePrograms.dmPositive')} value="1,923" variant="warning" />
          <MetricTile label={t('diseasePrograms.followUpDue')} value="287" variant="critical" />
          <MetricTile label={t('diseasePrograms.enrolledInCare')} value="4,200" variant="success" />
          <MetricTile label={t('diseasePrograms.coverage')} value="74%" />
        </div>
      )}
      {tab === 2 && (
        <div className="bg-surface-sunken border border-border rounded-xl p-6 text-center">
          <p className="text-[15px] font-bold text-accent">{t('diseasePrograms.notApplicable')}</p>
          <p className="text-[12px] text-accent mt-1">{t('diseasePrograms.notApplicableDetail')}</p>
          <button className="mt-4 text-[11px] font-semibold px-3 py-1.5 bg-secondary text-white rounded-lg">
            {t('diseasePrograms.switchDemo')}
          </button>
        </div>
      )}
      {tab === 3 && (
        <div className="grid grid-cols-3 gap-3">
          <MetricTile label={t('diseasePrograms.feverClinicCases')} value="247" variant="warning" />
          <MetricTile label={t('diseasePrograms.rdtPositivity')} value="19%" variant="warning" />
          <MetricTile label={t('diseasePrograms.dengueConfirmed')} value="47" variant="critical" />
          <MetricTile label={t('diseasePrograms.malariaConfirmed')} value="12" />
          <MetricTile label={t('diseasePrograms.foggingRounds')} value="8" variant="success" />
          <MetricTile label={t('diseasePrograms.blocksCovered')} value="3 of 5" />
        </div>
      )}
    </div>
  )
}
