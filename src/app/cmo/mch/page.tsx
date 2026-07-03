"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const TAB_KEYS = ['mch.tabAnc', 'mch.tabPnc', 'mch.tabHighRisk', 'mch.tabDeliveries', 'mch.tabImmunization', 'mch.tabJsy']

const JSY_ROWS = Array.from({length: 12}, (_, i) => ({
  name: ['Savita Devi', 'Meena Kumari', 'Asha Rani', 'Kavita Bai', 'Poonam Sharma', 'Rekha Devi', 'Sushila', 'Champa', 'Geeta Bai', 'Lalita', 'Anita', 'Sunita'][i],
  facility: ['CHC Berasia', 'PHC Phanda', 'Hamidia DH', 'CHC Bairagarh', 'PHC Kolar', 'CHC Phanda'][i % 6],
  deliveryDate: `2026-06-${String(i + 1).padStart(2, '0')}`,
  amount: 1400,
  status: i < 4 ? 'paid' : 'pending',
}))

export default function CmoMchPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)
  const [jsyRows, setJsyRows] = useState(JSY_ROWS)

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('mch.title')} />
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('mch.mmr')} value="152" variant="warning" />
        <MetricTile label={t('mch.imr')} value="41" variant="warning" />
        <MetricTile label={t('mch.institutionalDelivery')} value="91%" variant="success" />
        <MetricTile label={t('mch.jsyPending')} value={jsyRows.filter(r => r.status === 'pending').length} variant="warning" />
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th className="px-4 py-2.5 text-left">{t('mch.colMother')}</th>
              <th className="px-3 py-2.5 text-left">{t('mch.colFacility')}</th>
              <th className="px-3 py-2.5 text-left">{t('mch.colDeliveryDate')}</th>
              <th className="px-3 py-2.5 text-right">{t('mch.colAmount')}</th>
              <th className="px-3 py-2.5 text-center">{t('mch.colStatus')}</th>
              <th className="px-3 py-2.5"></th>
            </tr></thead>
            <tbody>
              {jsyRows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{r.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.facility}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.deliveryDate}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">₹{r.amount}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      r.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.status === 'pending' && (
                      <button onClick={() => { setJsyRows(rows => rows.map((row, j) => j === i ? {...row, status: 'paid'} : row)); toast.success(t('mch.jsyPaymentProcessed')) }}
                        className="text-[10px] font-semibold px-2 py-1 bg-green-600 text-white rounded">
                        {t('mch.pay')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-[13px]">
          {t('mch.tabData', { tab: t(TAB_KEYS[tab]), count: [248, 187, 34, 312, 1240][tab] ?? 150 })}
          <p className="text-[11px] mt-1">{t('mch.selectJsyTab')}</p>
        </div>
      )}
    </div>
  )
}
