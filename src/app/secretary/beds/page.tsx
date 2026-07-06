'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BedDouble } from 'lucide-react'

const WARD_KEYS = ['wardIcu', 'wardHdu', 'wardGeneral', 'wardPaediatric', 'wardMaternity', 'wardBurns', 'wardIsolation']
const DISTRICTS = [
  { name: 'Bhopal', icu: { total: 120, used: 98 }, hdu: { total: 80, used: 72 }, general: { total: 800, used: 620 }, paediatric: { total: 80, used: 55 }, maternity: { total: 120, used: 88 }, burns: { total: 20, used: 8 }, isolation: { total: 40, used: 12 } },
  { name: 'Indore', icu: { total: 140, used: 135 }, hdu: { total: 90, used: 85 }, general: { total: 900, used: 780 }, paediatric: { total: 90, used: 75 }, maternity: { total: 140, used: 115 }, burns: { total: 25, used: 20 }, isolation: { total: 50, used: 18 } },
  { name: 'Gwalior', icu: { total: 100, used: 82 }, hdu: { total: 60, used: 44 }, general: { total: 700, used: 510 }, paediatric: { total: 70, used: 45 }, maternity: { total: 100, used: 72 }, burns: { total: 15, used: 10 }, isolation: { total: 30, used: 8 } },
  { name: 'Jabalpur', icu: { total: 110, used: 95 }, hdu: { total: 70, used: 58 }, general: { total: 750, used: 600 }, paediatric: { total: 75, used: 60 }, maternity: { total: 110, used: 90 }, burns: { total: 18, used: 12 }, isolation: { total: 35, used: 15 } },
  { name: 'Rewa', icu: { total: 60, used: 55 }, hdu: { total: 40, used: 36 }, general: { total: 400, used: 340 }, paediatric: { total: 40, used: 30 }, maternity: { total: 60, used: 50 }, burns: { total: 10, used: 8 }, isolation: { total: 20, used: 10 } },
  { name: 'Sagar', icu: { total: 55, used: 42 }, hdu: { total: 35, used: 28 }, general: { total: 380, used: 290 }, paediatric: { total: 38, used: 22 }, maternity: { total: 55, used: 38 }, burns: { total: 8, used: 5 }, isolation: { total: 18, used: 6 } },
]

function OccupancyCell({ used, total }: { used: number; total: number }) {
  const pct = Math.round((used / total) * 100)
  const color = pct >= 95 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <td className="px-3 py-2.5 text-center">
      <div className="text-xs font-bold text-[var(--color-foreground)]">{pct}%</div>
      <div className="text-[10px] text-[var(--color-foreground-lighter)]">{used}/{total}</div>
      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </td>
  )
}

export default function BedsPage() {
  const t = useTranslations('secretary')
  const [search, setSearch] = useState('')
  const filtered = DISTRICTS.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const totalICU = DISTRICTS.reduce((s, d) => s + d.icu.total, 0)
  const usedICU = DISTRICTS.reduce((s, d) => s + d.icu.used, 0)
  const totalGen = DISTRICTS.reduce((s, d) => s + d.general.total, 0)
  const usedGen = DISTRICTS.reduce((s, d) => s + d.general.used, 0)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('beds.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('beds.subtitle', { count: DISTRICTS.length })}</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('beds.kpiIcuOccupancy'), value: `${Math.round((usedICU/totalICU)*100)}%`, sub: t('beds.kpiIcuOccupancySub', { used: usedICU, total: totalICU }), warn: usedICU/totalICU > 0.9 },
          { label: t('beds.kpiGeneralOccupancy'), value: `${Math.round((usedGen/totalGen)*100)}%`, sub: t('beds.kpiGeneralOccupancySub', { used: usedGen, total: totalGen }), warn: false },
          { label: t('beds.kpiAtCapacity'), value: '3', sub: t('beds.kpiAtCapacitySub'), warn: true },
          { label: t('beds.kpiAvailableIcu'), value: String(totalICU - usedICU), sub: t('beds.kpiAvailableIcuSub'), warn: false },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
          </div>
        ))}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('beds.searchPlaceholder')} className="border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-auto" style={{ boxShadow: 'var(--shadow-card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('common.district')}</th>
              {WARD_KEYS.map(w => <th key={w} className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-foreground-muted)]">{t(`beds.${w}`)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {filtered.map(d => (
              <tr key={d.name} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-foreground)]">{d.name}</td>
                <OccupancyCell used={d.icu.used} total={d.icu.total} />
                <OccupancyCell used={d.hdu.used} total={d.hdu.total} />
                <OccupancyCell used={d.general.used} total={d.general.total} />
                <OccupancyCell used={d.paediatric.used} total={d.paediatric.total} />
                <OccupancyCell used={d.maternity.used} total={d.maternity.total} />
                <OccupancyCell used={d.burns.used} total={d.burns.total} />
                <OccupancyCell used={d.isolation.used} total={d.isolation.total} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
