"use client"

import { useState } from "react"
import { Stethoscope, Users, Building2, Video, FlaskConical, Pill, BedDouble } from "lucide-react"
import { useDoctorStatsStore, STAT_DOCTORS, PERIODS, type PeriodKey } from "@/store/useDoctorStatsStore"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const CARD = "rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)]"
const COLS = [
  { key: 'consults', labelKey: 'docActivity.colConsults', icon: Users },
  { key: 'opd', labelKey: 'docActivity.colInPerson', icon: Building2 },
  { key: 'online', labelKey: 'docActivity.colOnline', icon: Video },
  { key: 'tests', labelKey: 'docActivity.colTests', icon: FlaskConical },
  { key: 'prescriptions', labelKey: 'docActivity.colRx', icon: Pill },
  { key: 'admissions', labelKey: 'docActivity.colAdmits', icon: BedDouble },
] as const

export default function AdminDoctorActivity() {
  const t = useTranslations('admin')
  const totalsFor = useDoctorStatsStore(s => s.totalsFor)
  const [period, setPeriod] = useState<PeriodKey>('month')

  const rows = STAT_DOCTORS.map(doc => ({ doc, t: totalsFor(doc.id, period) }))
  const grand = totalsFor('all', period)
  const initials = (n: string) => n.replace('Dr. ', '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="max-w-5xl mx-auto pb-8">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight flex items-center gap-2"><Stethoscope className="h-6 w-6 text-[var(--color-accent)]" /> {t('docActivity.title')}</h1>
        <p className="text-[13px] text-slate-500 mt-1">{t('docActivity.subtitle')}</p>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-5">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={cn("px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition", period === p.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.has(`docActivity.period.${p.key}`) ? t(`docActivity.period.${p.key}`) : p.label}
          </button>
        ))}
      </div>

      {/* Hospital totals */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        {COLS.map(c => (
          <div key={c.key} className={cn(CARD, "p-4")}>
            <span className="h-8 w-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><c.icon className="h-4 w-4" /></span>
            <p className="text-[20px] font-bold text-slate-900 mt-2 leading-none tabular-nums">{grand[c.key].toLocaleString('en-IN')}</p>
            <p className="text-[11.5px] font-semibold text-slate-500 mt-1">{t(c.labelKey)}</p>
          </div>
        ))}
      </div>

      {/* Per-doctor table */}
      <div className={cn(CARD, "p-5 overflow-x-auto")}>
        <h3 className="text-[15px] font-bold text-slate-900 mb-3">{t('docActivity.byDoctor')}</h3>
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2.5 pr-3">{t('docActivity.doctor')}</th>
              {COLS.map(c => <th key={c.key} className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2.5 px-2">{t(c.labelKey)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ doc, t }) => (
              <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0">{initials(doc.name)}</span>
                    <div><p className="text-[13.5px] font-bold text-slate-900 leading-tight">{doc.name}</p><p className="text-[11px] text-slate-500">{doc.department}</p></div>
                  </div>
                </td>
                {COLS.map(c => (
                  <td key={c.key} className="py-3 px-2 text-center">
                    <span className={cn("text-[14px] font-bold tabular-nums", c.key === 'consults' ? "text-[var(--color-accent)]" : "text-slate-800")}>{t[c.key].toLocaleString('en-IN')}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
