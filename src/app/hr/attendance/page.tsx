"use client"

import { useTranslations } from "next-intl"
import { Clock, LogIn, LogOut } from "lucide-react"
import { useHRStore } from "@/store/useHRStore"
import { useHrmsStore, type AttendanceStatus } from "@/store/useHrmsStore"
import { cn } from "@/lib/utils"

const todayISO = () => new Date().toISOString().slice(0, 10)

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  leave: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  half_day: 'bg-primary-soft text-accent border-primary/20',
}

export default function HrAttendance() {
  const t = useTranslations('hr')
  const staff = useHRStore(s => s.staff)
  const { attendance, clockIn, clockOut, setAttendance } = useHrmsStore()
  const active = staff.filter(s => s.status === 'active')
  const recOf = (id: string) => attendance.find(a => a.staffId === id && a.date === todayISO())

  const counts = active.reduce((acc, s) => {
    const st = recOf(s.id)?.status ?? 'absent'
    acc[st] = (acc[st] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const present = (counts.present ?? 0) + (counts.late ?? 0)
  const pct = active.length ? Math.round((present / active.length) * 100) : 0

  const tiles = [
    { label: t('attendance.tilePresent'), value: counts.present ?? 0, fg: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-600' },
    { label: t('attendance.tileLate'), value: counts.late ?? 0, fg: 'text-amber-700', chip: 'bg-amber-100 text-amber-600' },
    { label: t('attendance.tileOnLeave'), value: counts.leave ?? 0, fg: 'text-[var(--color-accent)]', chip: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]' },
    { label: t('attendance.tileAbsent'), value: counts.absent ?? 0, fg: 'text-red-700', chip: 'bg-red-100 text-red-600' },
    { label: t('attendance.tileAttendance'), value: `${pct}%`, fg: 'text-slate-800', chip: 'bg-slate-100 text-slate-600' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Clock className="h-6 w-6 text-emerald-600" /> {t('attendance.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('attendance.subtitle', { date: new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) })}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tiles.map(t => (
          <div key={t.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className={cn("text-2xl font-bold tabular-nums", t.fg)}>{t.value}</p>
            <p className="text-[11px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">{t('common.employee')}</th>
                <th className="px-4 py-3">{t('attendance.colDept')}</th>
                <th className="px-4 py-3">{t('attendance.colIn')}</th>
                <th className="px-4 py-3">{t('attendance.colOut')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
                <th className="px-4 py-3 text-right">{t('attendance.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {active.map(s => {
                const rec = recOf(s.id)
                const status = rec?.status ?? 'absent'
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-800">{s.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{s.employeeId}</p>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{s.department}</td>
                    <td className="px-4 py-2.5 text-slate-700 tabular-nums">{rec?.clockIn ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700 tabular-nums">{rec?.clockOut ?? '—'}</td>
                    <td className="px-4 py-2.5"><span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[status])}>{t(`attendanceStatus.${status}`)}</span></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => clockIn(s.id)} disabled={!!rec?.clockIn} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"><LogIn className="h-3 w-3" /> {t('common.in')}</button>
                        <button onClick={() => clockOut(s.id)} disabled={!rec?.clockIn || !!rec?.clockOut} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-default"><LogOut className="h-3 w-3" /> {t('common.out')}</button>
                        <select value={status} onChange={e => setAttendance(s.id, e.target.value as AttendanceStatus)} className="text-[11px] rounded-lg border border-slate-200 px-1.5 py-1 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                          {(['present', 'late', 'absent', 'leave', 'half_day'] as AttendanceStatus[]).map(o => <option key={o} value={o}>{t(`attendanceStatus.${o}`)}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
