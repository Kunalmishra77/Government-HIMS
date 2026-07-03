"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const DRUGS = ['Oxytocin', 'Paracetamol', 'Amoxicillin', 'ORS', 'Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole', 'Cetirizine', 'Iron tablets']
const FACILITIES_SHORT = ['Hamidia DH', 'CH Kolar', 'CHC Berasia', 'CHC Phanda', 'PHC Phanda', 'PHC Kolar', 'PHC Karond']

function stockColor(days: number) {
  if (days === 0) return 'bg-red-600 text-white'
  if (days < 14) return 'bg-red-100 text-red-800'
  if (days < 30) return 'bg-amber-100 text-amber-800'
  return 'bg-green-50 text-green-800'
}

function stockDays(drug: number, fac: number): number {
  const val = ((drug * 7 + fac * 13) % 90)
  if (drug === 0 && fac >= 4) return 0
  if (drug === 1 && fac >= 4) return 0
  return val === 0 ? 1 : val
}

const TAB_KEYS = ['supply.tabStockStatus', 'supply.tabIndents', 'supply.tabTransfers', 'supply.tabExpiry']

export default function CmoSupplyPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)
  const [suggestions, setSuggestions] = useState([
    { id: 's1', from: 'PHC Phanda', to: 'CHC Berasia', drug: 'Oxytocin', qty: 200, unit: 'vials', dismissed: false },
    { id: 's2', from: 'Hamidia DH', to: 'PHC Kolar', drug: 'Paracetamol', qty: 5000, unit: 'tabs', dismissed: false },
  ])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('supply.title')} />
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('supply.criticalAtRisk')} value={t('supply.criticalAtRiskValue')} variant="critical" />
        <MetricTile label={t('supply.stockoutNow')} value={t('supply.stockoutNowValue')} variant="critical" />
        <MetricTile label={t('supply.pendingIndents')} value="8" variant="warning" />
        <MetricTile label={t('supply.expiring30d')} value="₹47L" variant="warning" />
      </div>

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
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="text-[10px] min-w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-3 py-2.5 text-left font-semibold text-slate-600 min-w-[120px]">{t('supply.colDrug')}</th>
              {FACILITIES_SHORT.map(f => <th key={f} className="px-2 py-2.5 text-center font-semibold text-slate-600 min-w-[80px]">{f.split(' ')[0]}<br/>{f.split(' ').slice(1).join(' ')}</th>)}
            </tr></thead>
            <tbody>
              {DRUGS.map((drug, di) => (
                <tr key={drug} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-800">{drug}</td>
                  {FACILITIES_SHORT.map((_, fi) => {
                    const days = stockDays(di, fi)
                    return <td key={fi} className="px-2 py-2 text-center">
                      <span className={cn('inline-block rounded px-1.5 py-0.5 font-semibold', stockColor(days))}>
                        {days === 0 ? t('supply.out') : `${days}d`}
                      </span>
                    </td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 2 && (
        <div className="space-y-3">
          <p className="text-[12px] text-slate-600">{t('supply.aiSuggestedTransfers')}</p>
          {suggestions.filter(s => !s.dismissed).map(s => (
            <div key={s.id} className="bg-surface-sunken border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-accent">{t('supply.moveQty', { qty: s.qty, unit: s.unit, drug: s.drug })}</p>
                <p className="text-[11px] text-accent">{s.from} → {s.to}</p>
              </div>
              <button onClick={() => { toast.success(t('supply.transferApproved', { drug: s.drug, to: s.to })); setSuggestions(ss => ss.map(x => x.id === s.id ? {...x, dismissed: true} : x)) }}
                className="text-[11px] font-semibold px-3 py-1.5 bg-secondary text-white rounded-lg">{t('supply.approve')}</button>
              <button onClick={() => setSuggestions(ss => ss.map(x => x.id === s.id ? {...x, dismissed: true} : x))}
                className="text-[11px] font-semibold px-3 py-1.5 border border-border text-accent rounded-lg">{t('supply.dismiss')}</button>
            </div>
          ))}
          {suggestions.every(s => s.dismissed) && <p className="text-center text-slate-400 py-8 text-[13px]">{t('supply.noPendingTransfers')}</p>}
        </div>
      )}

      {(tab === 1 || tab === 3) && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-[13px]">
          {tab === 1 ? t('supply.indentsEmpty') : t('supply.expiryEmpty')}
        </div>
      )}
    </div>
  )
}
