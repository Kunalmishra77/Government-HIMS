'use client'

import { useTranslations } from 'next-intl'
import { Package, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react'

const CATEGORIES = [
  { name: 'Essential medicines', stockoutDistricts: 4, adeqDistricts: 48, criticalItems: ['Oxytocin 10IU', 'Hydroxyurea 500mg', 'IV fluids NS/RL'], stockPct: 89 },
  { name: 'Vaccines', stockoutDistricts: 0, adeqDistricts: 52, criticalItems: [], stockPct: 98 },
  { name: 'Diagnostic consumables', stockoutDistricts: 7, adeqDistricts: 45, criticalItems: ['HbA1c strips', 'Dengue NS1 kits', 'Blood cultures'], stockPct: 78 },
  { name: 'Surgical supplies', stockoutDistricts: 3, adeqDistricts: 49, criticalItems: ['Catgut sutures', 'Sterile gloves size M'], stockPct: 85 },
  { name: 'Equipment parts & AMC', stockoutDistricts: 2, adeqDistricts: 50, criticalItems: ['X-ray tube (Gwalior)', 'CT scanner head (Rewa)'], stockPct: 92 },
]

const MPPHSCL = [
  { metric: 'Annual procurement (FY24)', value: '₹1,240 Cr', sub: 'Budget: ₹1,350 Cr' },
  { metric: 'Tender compliance', value: '94%', sub: 'L1 awarded on time' },
  { metric: 'Warehouse utilization', value: '78%', sub: '4 state + 12 zonal' },
  { metric: 'Cold chain compliance', value: '99.2%', sub: 'Temperature excursions: 2' },
]

export default function SupplyPage() {
  const t = useTranslations('secretary')
  const totalStockout = CATEGORIES.reduce((s, c) => s + c.stockoutDistricts, 0)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('supply.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('supply.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {MPPHSCL.map(m => (
          <div key={m.metric} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{m.metric}</p>
            <p className="text-xl font-bold mt-1 text-[var(--color-foreground)]">{m.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{m.sub}</p>
          </div>
        ))}
      </div>

      {totalStockout > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <p className="text-sm text-rose-700 font-medium">{t('supply.stockoutAlert', { count: totalStockout })}</p>
        </div>
      )}

      <div className="space-y-3">
        {CATEGORIES.map(c => (
          <div key={c.name} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <p className="text-sm font-bold text-[var(--color-foreground)]">{c.name}</p>
                <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">
                  {c.stockoutDistricts > 0 ? <span className="text-rose-600 font-medium">{t('supply.districtsStockout', { count: c.stockoutDistricts })}</span> : ''}
                  {t('supply.adequate', { count: c.adeqDistricts })}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${c.stockPct < 80 ? 'text-rose-600' : c.stockPct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{c.stockPct}%</p>
                <p className="text-[10px] text-[var(--color-foreground-lighter)]">{t('supply.adequacy')}</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
              <div className={`h-2 rounded-full ${c.stockPct < 80 ? 'bg-rose-500' : c.stockPct < 90 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${c.stockPct}%` }} />
            </div>
            {c.criticalItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[10px] text-[var(--color-foreground-lighter)]">{t('supply.critical')}</span>
                {c.criticalItems.map(item => (
                  <span key={item} className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">{item}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
