'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Activity, AlertTriangle, TrendingUp, MapPin } from 'lucide-react'

const OUTBREAKS = [
  { id: 'ob1', disease: 'Dengue', district: 'Indore', cases: 215, deaths: 2, status: 'active', trend: 'rising', lastReport: '2 hrs ago', riskLevel: 'high' },
  { id: 'ob2', disease: 'Dengue', district: 'Bhopal', cases: 148, deaths: 1, status: 'active', trend: 'stable', lastReport: '3 hrs ago', riskLevel: 'medium' },
  { id: 'ob3', disease: 'Leptospirosis', district: 'Sehore', cases: 38, deaths: 0, status: 'watch', trend: 'rising', lastReport: '1 hr ago', riskLevel: 'medium' },
  { id: 'ob4', disease: 'Scrub Typhus', district: 'Mandla', cases: 22, deaths: 0, status: 'watch', trend: 'stable', lastReport: '5 hrs ago', riskLevel: 'low' },
  { id: 'ob5', disease: 'Malaria (P.f.)', district: 'Balaghat', cases: 310, deaths: 3, status: 'active', trend: 'declining', lastReport: '1 hr ago', riskLevel: 'high' },
  { id: 'ob6', disease: 'Cholera', district: 'Seoni', cases: 14, deaths: 0, status: 'contained', trend: 'declining', lastReport: '6 hrs ago', riskLevel: 'low' },
]

const WEEKLY = [
  { week: 'W22', dengue: 180, malaria: 340, leptospira: 20 },
  { week: 'W23', dengue: 210, malaria: 310, leptospira: 28 },
  { week: 'W24', dengue: 245, malaria: 295, leptospira: 35 },
  { week: 'W25', dengue: 363, malaria: 313, leptospira: 38 },
]

const STATUS_STYLES = {
  active: 'bg-rose-100 text-rose-700',
  watch: 'bg-amber-100 text-amber-700',
  contained: 'bg-emerald-100 text-emerald-700',
}

const RISK_STYLES = {
  high: 'text-rose-600',
  medium: 'text-amber-600',
  low: 'text-emerald-600',
}

export default function SurveillancePage() {
  const t = useTranslations('secretary')
  const active = OUTBREAKS.filter(o => o.status === 'active').length
  const totalCases = OUTBREAKS.reduce((s, o) => s + o.cases, 0)
  const totalDeaths = OUTBREAKS.reduce((s, o) => s + o.deaths, 0)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('surveillance.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('surveillance.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('surveillance.kpiActive'), value: String(active), warn: true },
          { label: t('surveillance.kpiTotalCases'), value: totalCases.toLocaleString(), warn: false },
          { label: t('surveillance.kpiDeaths'), value: String(totalDeaths), warn: totalDeaths > 0 },
          { label: t('surveillance.kpiDistricts'), value: String(new Set(OUTBREAKS.filter(o => o.status === 'active').map(o => o.district)).size), warn: false },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Outbreak table */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('surveillance.clustersTitle')}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
              {['surveillance.colDisease', 'surveillance.colDistrict', 'surveillance.colCases', 'surveillance.colDeaths', 'surveillance.colTrend', 'surveillance.colStatus', 'surveillance.colRisk', 'surveillance.colLastReport', 'surveillance.colAction'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {OUTBREAKS.map(o => (
              <tr key={o.id} className="hover:bg-[var(--color-surface-raised)]">
                <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{o.disease}</td>
                <td className="px-4 py-3 text-[var(--color-foreground-muted)]"><MapPin className="h-3 w-3 inline mr-1" />{o.district}</td>
                <td className="px-4 py-3 font-bold text-[var(--color-foreground)]">{o.cases}</td>
                <td className={`px-4 py-3 font-bold ${o.deaths > 0 ? 'text-rose-600' : 'text-[var(--color-foreground-muted)]'}`}>{o.deaths}</td>
                <td className="px-4 py-3"><span className={`text-xs ${o.trend === 'rising' ? 'text-rose-600' : o.trend === 'declining' ? 'text-emerald-600' : 'text-amber-600'}`}>↑ {o.trend}</span></td>
                <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status as keyof typeof STATUS_STYLES]}`}>{o.status}</span></td>
                <td className={`px-4 py-3 text-xs font-bold ${RISK_STYLES[o.riskLevel as keyof typeof RISK_STYLES]}`}>{o.riskLevel}</td>
                <td className="px-4 py-3 text-xs text-[var(--color-foreground-lighter)]">{o.lastReport}</td>
                <td className="px-4 py-3"><button className="text-xs text-[var(--color-accent)] hover:underline font-medium">{t('surveillance.drill')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trend */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-semibold text-[var(--color-foreground)] mb-4">{t('surveillance.trendTitle')}</p>
        <div className="space-y-3">
          {(['dengue', 'malaria', 'leptospira'] as const).map(disease => {
            const max = Math.max(...WEEKLY.map(w => w[disease]))
            return (
              <div key={disease}>
                <p className="text-xs font-medium text-[var(--color-foreground-muted)] mb-1 capitalize">{disease}</p>
                <div className="flex gap-2 items-end h-8">
                  {WEEKLY.map(w => (
                    <div key={w.week} className="flex flex-col items-center gap-0.5 flex-1">
                      <div className="w-full rounded-t bg-[var(--color-primary)]" style={{ height: `${(w[disease] / max) * 100}%`, opacity: 0.6 }} />
                      <span className="text-[9px] text-[var(--color-foreground-lighter)]">{w.week}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
