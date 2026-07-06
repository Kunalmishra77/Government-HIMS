'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type TabId = 'tb' | 'malaria' | 'sickle' | 'ncd'

const TAB_META: { id: TabId; labelKey: string }[] = [
  { id: 'tb', labelKey: 'diseasePrograms.tabTb' },
  { id: 'malaria', labelKey: 'diseasePrograms.tabMalaria' },
  { id: 'sickle', labelKey: 'diseasePrograms.tabSickle' },
  { id: 'ncd', labelKey: 'diseasePrograms.tabNcd' },
]

function ProgressBar({ label, value, total, pct }: { label: string; value: string; total?: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-foreground-muted)]">{label}</span>
        <span className="font-bold text-[var(--color-foreground)]">{value}{total && <span className="font-normal text-[var(--color-foreground-lighter)]"> / {total}</span>}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TbTab() {
  const t = useTranslations('secretary')
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('diseasePrograms.tbNotified'), value: '78,412', sub: t('diseasePrograms.tbNotifiedSub') },
          { label: t('diseasePrograms.tbSuccess'), value: '88%', sub: t('diseasePrograms.tbSuccessSub') },
          { label: t('diseasePrograms.tbLtfu'), value: '5.2%', sub: t('diseasePrograms.tbLtfuSub') },
          { label: t('diseasePrograms.tbNikshay'), value: '91%', sub: t('diseasePrograms.tbNikshaySub') },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className="text-xl font-bold mt-0.5 text-[var(--color-foreground)]">{k.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[var(--color-border)] rounded-xl p-4 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('diseasePrograms.tbBottom5')}</p>
        {[
          { label: 'Singrauli', value: '76%', total: '90%', pct: 76 },
          { label: 'Shahdol', value: '78%', total: '90%', pct: 78 },
          { label: 'Anuppur', value: '79%', total: '90%', pct: 79 },
          { label: 'Dindori', value: '80%', total: '90%', pct: 80 },
          { label: 'Mandla', value: '81%', total: '90%', pct: 81 },
        ].map(d => <ProgressBar key={d.label} label={d.label} value={d.value} total={d.total} pct={d.pct} />)}
      </div>
    </div>
  )
}

function MalariaTab() {
  const t = useTranslations('secretary')
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('diseasePrograms.malariaApi'), value: '2.8', sub: t('diseasePrograms.malariaApiSub') },
          { label: t('diseasePrograms.malariaPf'), value: '38%', sub: t('diseasePrograms.malariaPfSub') },
          { label: t('diseasePrograms.malariaHighBurden'), value: '8', sub: t('diseasePrograms.malariaHighBurdenSub') },
          { label: t('diseasePrograms.malariaIrs'), value: '74%', sub: t('diseasePrograms.malariaIrsSub') },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className="text-xl font-bold mt-0.5 text-[var(--color-foreground)]">{k.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800">{t('diseasePrograms.malariaAlert')}</p>
        <p className="text-xs text-amber-700 mt-1">{t('diseasePrograms.malariaAlertSub')}</p>
      </div>
    </div>
  )
}

function SickleCellTab() {
  const t = useTranslations('secretary')
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('diseasePrograms.sickleScreened'), value: '3.1L', sub: t('diseasePrograms.sickleScreenedSub') },
          { label: t('diseasePrograms.sicklePositive'), value: '21,800', sub: t('diseasePrograms.sicklePositiveSub') },
          { label: t('diseasePrograms.sickleHydroxyurea'), value: '980', sub: t('diseasePrograms.sickleHydroxyureaSub') },
          { label: t('diseasePrograms.sickleTribal'), value: '21/21', sub: t('diseasePrograms.sickleTribalSub') },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className="text-xl font-bold mt-0.5 text-[var(--color-foreground)]">{k.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="bg-primary-soft border border-primary/20 rounded-xl p-4">
        <p className="text-sm font-semibold text-accent">{t('diseasePrograms.sickleTarget')}</p>
        <p className="text-xs text-accent mt-1">{t('diseasePrograms.sickleTargetSub')}</p>
      </div>
    </div>
  )
}

function NcdTab() {
  const t = useTranslations('secretary')
  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('diseasePrograms.ncdHtScreened'), value: '68L', sub: t('diseasePrograms.ncdHtScreenedSub') },
          { label: t('diseasePrograms.ncdHtTreatment'), value: '42%', sub: t('diseasePrograms.ncdHtTreatmentSub') },
          { label: t('diseasePrograms.ncdDiabetes'), value: '55L', sub: t('diseasePrograms.ncdDiabetesSub') },
          { label: t('diseasePrograms.ncdCancer'), value: '3.2L', sub: t('diseasePrograms.ncdCancerSub') },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className="text-xl font-bold mt-0.5 text-[var(--color-foreground)]">{k.value}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DiseaseProgramsPage() {
  const t = useTranslations('secretary')
  const [tab, setTab] = useState<TabId>('tb')
  return (
    <div className="p-6 space-y-4 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('diseasePrograms.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('diseasePrograms.subtitle')}</p>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TAB_META.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${tab === tb.id ? 'bg-white text-[var(--color-accent)] font-semibold shadow' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {tab === 'tb' && <TbTab />}
        {tab === 'malaria' && <MalariaTab />}
        {tab === 'sickle' && <SickleCellTab />}
        {tab === 'ncd' && <NcdTab />}
      </div>
    </div>
  )
}
