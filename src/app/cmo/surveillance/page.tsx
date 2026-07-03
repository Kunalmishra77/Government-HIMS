"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'

const DISEASES = [
  { name: 'Dengue', week: 47, prev: 14, trend: '↑', severity: 'critical' },
  { name: 'Malaria', week: 12, prev: 9, trend: '↑', severity: 'warning' },
  { name: 'Typhoid', week: 8, prev: 10, trend: '↓', severity: 'info' },
  { name: 'Cholera', week: 0, prev: 0, trend: '—', severity: 'ok' },
  { name: 'Chikungunya', week: 3, prev: 2, trend: '↑', severity: 'info' },
  { name: 'TB (new)', week: 18, prev: 20, trend: '↓', severity: 'info' },
  { name: 'ARI', week: 142, prev: 98, trend: '↑', severity: 'warning' },
]

const CONTAINMENT_KEYS = [
  { key: 'fogging', done: true },
  { key: 'rdt', done: true },
  { key: 'advisory', done: true },
  { key: 'larviciding', done: false },
  { key: 'idsp', done: false },
]

const RUNBOOK_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5']

export default function CmoSurveillancePage() {
  const t = useTranslations('cmo')
  const [actions, setActions] = useState(CONTAINMENT_KEYS)
  const [showRunbook, setShowRunbook] = useState(false)

  const toggle = (i: number) => setActions(a => a.map((act, idx) => idx === i ? { ...act, done: !act.done } : act))

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <CmoPageHeader title={t('surveillance.title')} />

      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('surveillance.notifiableDiseases')} value="247" />
        <MetricTile label={t('surveillance.activeOutbreaks')} value="1" variant="warning" />
        <MetricTile label={t('surveillance.weeklyReturns')} value="✓" variant="success" />
        <MetricTile label={t('surveillance.idspSync')} value="✓" variant="success" />
      </div>

      {/* Active outbreak */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">{t('surveillance.activeOutbreakBadge')}</span>
              <span className="text-[13px] font-bold text-amber-900">{t('surveillance.dengueOutbreak')}</span>
            </div>
            <p className="text-[12px] text-amber-800">{t('surveillance.dengueOutbreakDetail')}</p>
          </div>
          <button onClick={() => setShowRunbook(s => !s)}
            className="text-[11px] font-semibold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700">
            {showRunbook ? t('surveillance.hide') : t('surveillance.activateRunbook')}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-[12px] font-semibold text-amber-900">{t('surveillance.containmentChecklist')}</p>
          {actions.map((a, i) => (
            <label key={a.key} className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="checkbox" checked={a.done} onChange={() => toggle(i)} className="rounded" />
              <span className={a.done ? 'line-through text-slate-400' : 'text-amber-900'}>{t(`surveillance.containment.${a.key}`)}</span>
            </label>
          ))}
        </div>
        {showRunbook && (
          <div className="mt-4 bg-white rounded-lg p-4 border border-amber-200 text-[12px] space-y-2">
            <p className="font-bold text-slate-900">{t('surveillance.runbookStep')}</p>
            {RUNBOOK_KEYS.map((sk, i) => (
              <div key={sk} className="flex gap-2">
                <span className="text-amber-600 font-bold flex-shrink-0">{i + 1}.</span>
                <span className="text-slate-700">{t(`surveillance.runbook.${sk}`)}</span>
              </div>
            ))}
            <button onClick={() => toast.success(t('surveillance.runbookActivated'))}
              className="mt-2 text-[11px] font-semibold px-3 py-1.5 bg-secondary text-white rounded-lg">
              {t('surveillance.activateAllSteps')}
            </button>
          </div>
        )}
      </div>

      {/* Disease table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-[12px]">
          <thead><tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
            <th className="px-4 py-2.5 text-left font-medium">{t('surveillance.colDisease')}</th>
            <th className="px-3 py-2.5 text-right font-medium">{t('surveillance.colThisWeek')}</th>
            <th className="px-3 py-2.5 text-right font-medium">{t('surveillance.colLastWeek')}</th>
            <th className="px-3 py-2.5 text-center font-medium">{t('surveillance.colTrend')}</th>
          </tr></thead>
          <tbody>
            {DISEASES.map(d => (
              <tr key={d.name} className="border-b border-slate-50">
                <td className="px-4 py-2.5 font-semibold text-slate-900">{d.name}</td>
                <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{d.week}</td>
                <td className="px-3 py-2.5 text-right text-slate-500">{d.prev}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className={d.trend === '↑' ? 'text-red-600 font-bold' : d.trend === '↓' ? 'text-green-600 font-bold' : 'text-slate-400'}>{d.trend}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
