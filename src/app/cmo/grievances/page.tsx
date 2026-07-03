"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const GRIEVANCES = [
  { id: 'g1', type: 'rti', title: 'RTI/2026/0347 — Drug stock information', raisedBy: 'Ramesh Gupta', ageHours: 72, status: 'open', slaBreached: true },
  { id: 'g2', type: 'citizen', title: 'Poor sanitation at PHC Kolar OPD', raisedBy: 'Meena Sharma', ageHours: 48, status: 'in-progress', slaBreached: false },
  { id: 'g3', type: 'citizen', title: 'Doctor absent — PHC Phanda', raisedBy: 'Sunita Devi', ageHours: 24, status: 'open', slaBreached: false },
  { id: 'g4', type: 'rti', title: 'RTI/2026/0312 — Staff posting records', raisedBy: 'Advocate R. Joshi', ageHours: 240, status: 'open', slaBreached: true },
  { id: 'g5', type: 'internal', title: 'Harassment complaint — PHC staff', raisedBy: 'Anonymous', ageHours: 12, status: 'open', slaBreached: false },
]

const TAB_KEYS = ['grievances.tabRti', 'grievances.tabCitizen', 'grievances.tabInternal']
const TAB_TYPES = ['rti', 'citizen', 'internal']

export default function CmoGrievancesPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)
  const [grievances, setGrievances] = useState(GRIEVANCES)

  const filtered = grievances.filter(g => g.type === TAB_TYPES[tab])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('grievances.title')} />
      <div className="grid grid-cols-3 gap-3">
        <MetricTile label={t('grievances.rtiPending')} value={grievances.filter(g => g.type === 'rti' && g.status !== 'resolved').length} variant="warning" />
        <MetricTile label={t('grievances.grievancesOpen')} value={grievances.filter(g => g.type !== 'rti' && g.status !== 'resolved').length} />
        <MetricTile label={t('grievances.slaBreached')} value={grievances.filter(g => g.slaBreached).length} variant="critical" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TAB_KEYS.map((tabKey, i) => (
          <button key={tabKey} onClick={() => setTab(i)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors',
              tab === i ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t('grievances.tabWithCount', { tab: t(tabKey), count: grievances.filter(g => g.type === TAB_TYPES[i]).length })}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(g => (
          <div key={g.id} className={cn('bg-white border rounded-xl p-4', g.slaBreached ? 'border-red-300' : 'border-slate-200')}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {g.slaBreached && <span className="text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded mr-2">{t('grievances.slaBreach')}</span>}
                <span className="text-[13px] font-semibold text-slate-900">{g.title}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('grievances.raisedAgo', { raisedBy: g.raisedBy, hours: g.ageHours, status: g.status })}</p>
              </div>
              <button
                onClick={() => {
                  setGrievances(gs => gs.map(x => x.id === g.id ? {...x, status: 'resolved'} : x))
                  toast.success(t('grievances.responseDrafted'))
                }}
                className="text-[11px] font-semibold px-3 py-1.5 bg-secondary text-white rounded-lg hover:bg-secondary-light">
                {t('grievances.respond')}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-10 text-slate-400 text-[13px]">{t('grievances.noItems', { tab: t(TAB_KEYS[tab]) })}</p>}
      </div>
    </div>
  )
}
