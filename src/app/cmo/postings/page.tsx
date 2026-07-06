"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const ESCALATIONS = [
  { id: 'e1', from: { name: 'BMO Berasia', facility: 'CHC Berasia', role: 'BMO' }, issue: 'Chronic shortage of specialists — no gynaecologist for 3 months', severity: 'high', ageHours: 72, slaBreached: true, status: 'open' },
  { id: 'e2', from: { name: 'BMO Phanda', facility: 'PHC Phanda', role: 'BMO' }, issue: 'Broken cold chain equipment — vaccines at risk', severity: 'high', ageHours: 48, slaBreached: true, status: 'open' },
  { id: 'e3', from: { name: 'BMO Bairagarh', facility: 'CH Bairagarh', role: 'BMO' }, issue: 'Renovation work blocking ambulance bay', severity: 'medium', ageHours: 24, slaBreached: false, status: 'in-progress' },
  { id: 'e4', from: { name: 'BMO Kolar', facility: 'CHC Kolar', role: 'BMO' }, issue: 'Staff quarters dilapidated — retention risk', severity: 'low', ageHours: 120, slaBreached: false, status: 'open' },
]

const TAB_KEYS: Record<string, string> = {
  vacancies: 'postings.tabVacancies',
  transfers: 'postings.tabTransfers',
  escalations: 'postings.tabEscalations',
  grievances: 'postings.tabGrievances',
}

export default function CmoPostingsPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState('vacancies')
  const [escalations, setEscalations] = useState(ESCALATIONS)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('postings.title')} />
      <div className="grid grid-cols-3 gap-3">
        <MetricTile label={t('postings.vacancies')} value="207" variant="warning" />
        <MetricTile label={t('postings.pendingTransfers')} value="8" />
        <MetricTile label={t('postings.bmoEscalations')} value="4" hint={t('postings.bmoEscalationsHint')} variant="critical" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {['vacancies', 'transfers', 'escalations', 'grievances'].map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors',
              tab === tb ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t(TAB_KEYS[tb])}
          </button>
        ))}
      </div>

      {tab === 'escalations' && (
        <div className="space-y-3">
          {escalations.map(e => (
            <div key={e.id} className={cn('bg-white border rounded-xl p-4', e.slaBreached ? 'border-red-300' : 'border-slate-200')}>
              <div className="flex items-start gap-3">
                {e.slaBreached && <span className="text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{t('postings.slaBreach')}</span>}
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">{e.issue}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t('postings.escalationMeta', { name: e.from.name, facility: e.from.facility, hours: e.ageHours })}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEscalations(es => es.map(x => x.id === e.id ? {...x, status: 'resolved'} : x)); toast.success(t('postings.escalationResolved')) }}
                    className="text-[11px] font-semibold px-2 py-1 bg-green-600 text-white rounded-lg">
                    {t('postings.resolve')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab !== 'escalations' && (
        <div className="text-center py-12 text-slate-400 text-[13px]">
          {tab === 'vacancies' && t('postings.vacanciesEmpty')}
          {tab === 'transfers' && t('postings.transfersEmpty')}
          {tab === 'grievances' && t('postings.grievancesEmpty')}
        </div>
      )}
    </div>
  )
}
