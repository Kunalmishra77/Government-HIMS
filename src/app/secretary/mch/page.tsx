'use client'

import { useTranslations } from 'next-intl'
import { HeartPulse, Baby, TrendingDown } from 'lucide-react'

const DISTRICTS_MCH = [
  { name: 'Mandla', mmr: 310, imr: 52, immunization: 72, anc: 68, institutional: 81 },
  { name: 'Dindori', mmr: 295, imr: 55, immunization: 69, anc: 65, institutional: 78 },
  { name: 'Umaria', mmr: 285, imr: 50, immunization: 73, anc: 66, institutional: 80 },
  { name: 'Singrauli', mmr: 260, imr: 47, immunization: 76, anc: 70, institutional: 82 },
  { name: 'Alirajpur', mmr: 340, imr: 58, immunization: 65, anc: 62, institutional: 74 },
  { name: 'Bhopal', mmr: 98, imr: 22, immunization: 94, anc: 89, institutional: 98 },
  { name: 'Indore', mmr: 88, imr: 19, immunization: 96, anc: 91, institutional: 99 },
]

function Bar({ pct, warn }: { pct: number; warn: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${warn ? 'bg-rose-500' : 'bg-[var(--color-primary)]'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{pct}%</span>
    </div>
  )
}

export default function MchPage() {
  const t = useTranslations('secretary')
  const stateMmr = 163
  const stateImr = 38
  const stateImmunization = 87

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('mch.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('mch.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: t('mch.kpiMmr'), value: String(stateMmr), sub: t('mch.kpiMmrSub'), warn: stateMmr > 100 },
          { label: t('mch.kpiImr'), value: String(stateImr), sub: t('mch.kpiImrSub'), warn: stateImr > 30 },
          { label: t('mch.kpiImmunization'), value: `${stateImmunization}%`, sub: t('mch.kpiImmunizationSub'), warn: false },
          { label: t('mch.kpiAnc'), value: '76%', sub: t('mch.kpiAncSub'), warn: true },
          { label: t('mch.kpiInstitutional'), value: '89%', sub: t('mch.kpiInstitutionalSub'), warn: false },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* District comparison table */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-auto" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('mch.tableTitle')}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('common.district')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('mch.colMmr')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('mch.colImr')}</th>
              <th className="px-5 py-3 text-left w-40 text-xs font-semibold text-[var(--color-foreground-muted)]">{t('mch.colImmunization')}</th>
              <th className="px-5 py-3 text-left w-40 text-xs font-semibold text-[var(--color-foreground-muted)]">{t('mch.colAnc')}</th>
              <th className="px-5 py-3 text-left w-40 text-xs font-semibold text-[var(--color-foreground-muted)]">{t('mch.colInstDelivery')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {DISTRICTS_MCH.map(d => (
              <tr key={d.name} className="hover:bg-[var(--color-surface-raised)]">
                <td className="px-5 py-3 font-medium text-[var(--color-foreground)]">{d.name}</td>
                <td className={`px-5 py-3 font-bold ${d.mmr > 200 ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{d.mmr}</td>
                <td className={`px-5 py-3 font-bold ${d.imr > 45 ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{d.imr}</td>
                <td className="px-5 py-3 w-40"><Bar pct={d.immunization} warn={d.immunization < 75} /></td>
                <td className="px-5 py-3 w-40"><Bar pct={d.anc} warn={d.anc < 70} /></td>
                <td className="px-5 py-3 w-40"><Bar pct={d.institutional} warn={d.institutional < 80} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
