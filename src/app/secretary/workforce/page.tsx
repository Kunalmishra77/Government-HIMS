'use client'

import { useTranslations } from 'next-intl'
import { Users, TrendingDown, AlertTriangle } from 'lucide-react'

const CADRES = [
  { name: 'Specialist Doctors', sanctioned: 4200, inPosition: 3024, vacancy: 1176, vacancyPct: 28 },
  { name: 'MBBS Doctors', sanctioned: 12800, inPosition: 10240, vacancy: 2560, vacancyPct: 20 },
  { name: 'Nursing staff', sanctioned: 28000, inPosition: 22400, vacancy: 5600, vacancyPct: 20 },
  { name: 'Paramedical', sanctioned: 18500, inPosition: 15540, vacancy: 2960, vacancyPct: 16 },
  { name: 'ASHA workers', sanctioned: 72000, inPosition: 68400, vacancy: 3600, vacancyPct: 5 },
  { name: 'ANM', sanctioned: 21000, inPosition: 18900, vacancy: 2100, vacancyPct: 10 },
]

const DME_FACULTY = [
  { specialty: 'Anaesthesia', sanctioned: 220, inPosition: 148, vacancyPct: 33 },
  { specialty: 'Pathology', sanctioned: 180, inPosition: 124, vacancyPct: 31 },
  { specialty: 'Radiology', sanctioned: 140, inPosition: 98, vacancyPct: 30 },
  { specialty: 'Paediatrics', sanctioned: 200, inPosition: 145, vacancyPct: 28 },
  { specialty: 'Obstetrics', sanctioned: 220, inPosition: 162, vacancyPct: 26 },
  { specialty: 'Surgery', sanctioned: 240, inPosition: 186, vacancyPct: 23 },
  { specialty: 'Medicine', sanctioned: 260, inPosition: 210, vacancyPct: 19 },
]

function VacancyBar({ pct, warn }: { pct: number; warn: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full ${warn ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${pct * 2}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${warn ? 'text-rose-600' : 'text-amber-600'}`}>{pct}%</span>
    </div>
  )
}

export default function WorkforcePage() {
  const t = useTranslations('secretary')
  const totalVacancy = CADRES.reduce((s, c) => s + c.vacancy, 0)
  const avgVacancyPct = Math.round(CADRES.reduce((s, c) => s + c.vacancyPct, 0) / CADRES.length)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('workforce.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('workforce.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('workforce.kpiTotalVacancies'), value: totalVacancy.toLocaleString(), warn: true },
          { label: t('workforce.kpiAvgVacancy'), value: `${avgVacancyPct}%`, warn: avgVacancyPct > 15 },
          { label: t('workforce.kpiSpecialistShortage'), value: '1,176', sub: t('workforce.kpiSpecialistShortageSub'), warn: true },
          { label: t('workforce.kpiRecruitments'), value: '2,400', warn: false },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Health workforce */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('workforce.healthVacancies')}</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {CADRES.map(c => (
              <div key={c.name} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{c.name}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)]">{c.inPosition.toLocaleString()} / {c.sanctioned.toLocaleString()}</p>
                </div>
                <VacancyBar pct={c.vacancyPct} warn={c.vacancyPct > 25} />
              </div>
            ))}
          </div>
        </div>

        {/* DME faculty */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('workforce.dmeVacancies')}</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {DME_FACULTY.map(f => (
              <div key={f.specialty} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{f.specialty}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)]">{f.inPosition} / {f.sanctioned}</p>
                </div>
                <VacancyBar pct={f.vacancyPct} warn={f.vacancyPct > 30} />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-[var(--color-border)] bg-amber-50">
            <p className="text-xs text-amber-700 font-medium">{t('workforce.dmeWarning')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
