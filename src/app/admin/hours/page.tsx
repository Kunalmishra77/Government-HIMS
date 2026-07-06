"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Clock, AlertTriangle, Plus, ChevronLeft, ChevronRight, Search, Filter,
  IndianRupee, Download, Sparkles,
} from "lucide-react"
import { useHRStore, type StaffMember } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { hoursWorked } from "@/lib/shiftConflicts"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

type Period = 'week' | 'fortnight' | 'month'

const PERIOD_LABEL: Record<Period, string> = {
  week:      'Week',
  fortnight: '2 weeks',
  month:     'Month',
}

const PERIOD_DAYS: Record<Period, number> = {
  week:      7,
  fortnight: 14,
  month:     30,
}

function isoDay(d: Date): string { return d.toISOString().split('T')[0]! }
function fmtDate(s: string): string { return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

export default function HoursPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const overtimeEntries = useHRStore(s => s.overtimeEntries)
  const logOvertime = useHRStore(s => s.logOvertime)

  const canLogOT = canDo(currentUser?.role, 'hr.overtime.log')
  const actorName = currentUser?.name ?? 'Administrator'

  const [period, setPeriod] = useState<Period>('week')
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [showOTModal, setShowOTModal] = useState(false)
  const [otForm, setOtForm] = useState<{ staffId: string; date: string; hours: number; reason: string }>({
    staffId: '', date: isoDay(new Date()), hours: 2, reason: '',
  })

  const periodDays = PERIOD_DAYS[period]
  const today = new Date()
  const periodEnd = new Date(today); periodEnd.setDate(periodEnd.getDate() + offset * periodDays)
  const periodStart = new Date(periodEnd); periodStart.setDate(periodStart.getDate() - (periodDays - 1))
  const fromDate = isoDay(periodStart)
  const toDate = isoDay(periodEnd)

  // Compute per-staff hours for the period
  const hoursPerStaff = useMemo(() => hoursWorked(shifts, fromDate, toDate, overtimeEntries),
    [shifts, fromDate, toDate, overtimeEntries])

  const departments = useMemo(() => ['All', ...Array.from(new Set(staff.map(s => s.department))).sort()], [staff])

  const rows = useMemo(() => {
    return staff
      .filter(s => s.status === 'active')
      .filter(s => deptFilter === 'All' || s.department === deptFilter)
      .filter(s => {
        if (!search) return true
        const f = search.toLowerCase()
        return s.name.toLowerCase().includes(f) || s.department.toLowerCase().includes(f)
      })
      .map(s => {
        const h = hoursPerStaff.get(s.id) ?? { scheduled: 0, overtime: 0, total: 0 }
        const otPay = h.overtime * (s.hourlyOTRate ?? 0)
        const otRisk = period === 'week' ? h.total > 48 : period === 'fortnight' ? h.total > 96 : h.total > 192
        return { staff: s, ...h, otPay, otRisk }
      })
      .sort((a, b) => b.total - a.total)
  }, [staff, deptFilter, search, hoursPerStaff, period])

  const totals = useMemo(() => {
    const scheduled = rows.reduce((t, r) => t + r.scheduled, 0)
    const overtime = rows.reduce((t, r) => t + r.overtime, 0)
    const otPay = rows.reduce((t, r) => t + r.otPay, 0)
    const atRisk = rows.filter(r => r.otRisk).length
    return { scheduled, overtime, total: scheduled + overtime, otPay, atRisk }
  }, [rows])

  const handleLogOT = () => {
    if (!canLogOT) { toast.error(t('hours.noPermission')); return }
    if (!otForm.staffId) { toast.error(t('hours.pickStaff')); return }
    if (otForm.hours <= 0) { toast.error(t('hours.hoursPositive')); return }
    if (!otForm.reason.trim()) { toast.error(t('hours.reasonRequired')); return }
    logOvertime({
      staffId: otForm.staffId,
      date: otForm.date,
      hours: otForm.hours,
      reason: otForm.reason.trim(),
      approved: true,
    }, actorName)
    const member = staff.find(s => s.id === otForm.staffId)
    toast.success(t('hours.otLogged', { hours: otForm.hours, name: member?.name ?? otForm.staffId }))
    setOtForm({ staffId: '', date: isoDay(new Date()), hours: 2, reason: '' })
    setShowOTModal(false)
  }

  const exportCSV = () => {
    const header = ['Staff', 'Staff ID', 'Department', 'Scheduled hours', 'OT hours', 'Total hours', 'OT pay (₹)', 'Risk']
    const csv = [
      header.join(','),
      ...rows.map(r => [
        `"${r.staff.name}"`, r.staff.id, `"${r.staff.department}"`,
        r.scheduled, r.overtime, r.total, r.otPay, r.otRisk ? 'OT risk' : 'OK',
      ].join(',')),
    ].join('\n')
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hours-${fromDate}-${toDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('hours.exported', { count: rows.length }))
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-6 w-6 text-[var(--color-accent)]" />{t('hours.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('hours.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            <Download className="h-3.5 w-3.5" />{t('hours.export')}
          </button>
          {canLogOT && (
            <button onClick={() => setShowOTModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
              <Plus className="h-3.5 w-3.5" />{t('hours.logOvertime')}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label={t('hours.kpiScheduled')} value={`${totals.scheduled}h`} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" />
        <KPI label={t('hours.kpiOvertime')} value={`${totals.overtime}h`} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" />
        <KPI label={t('hours.kpiOtPay')} value={`₹${totals.otPay.toLocaleString('en-IN')}`} tint="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <KPI label={t('hours.kpiOtRisk')} value={totals.atRisk} tint={totals.atRisk > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-600"} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5">
          <button onClick={() => setOffset(o => o - 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[170px] text-center">
            {fmtDate(fromDate)} → {fmtDate(toDate)}
          </span>
          <button onClick={() => setOffset(o => o + 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          {(['week', 'fortnight', 'month'] as Period[]).map(p => (
            <button key={p} onClick={() => { setPeriod(p); setOffset(0) }}
              data-testid={`hours-period-${p}`}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer',
                period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t.has(`hours.period.${p}`) ? t(`hours.period.${p}`) : PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('hours.searchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-1.5 bg-white">
            {departments.map(d => <option key={d} value={d}>{d === 'All' ? t('hours.allDepts') : d}</option>)}
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['colStaff', 'colDept', 'colScheduled', 'colOt', 'colTotal', 'colOtPay', 'colStatus'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t(`hours.${h}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400 italic">{t('hours.noRecords')}</td></tr>
            ) : rows.map((r, i) => (
              <motion.tr key={r.staff.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">{r.staff.name}</p>
                  <p className="text-[11px] text-slate-400">{r.staff.id} · {t.has(`coverage.role.${r.staff.role}`) ? t(`coverage.role.${r.staff.role}`) : r.staff.role.replace('_', ' ')}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{r.staff.department}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-800 tabular-nums">{r.scheduled}h</td>
                <td className={cn('px-4 py-3 text-xs font-bold tabular-nums', r.overtime > 0 ? 'text-[var(--color-accent)]' : 'text-slate-400')}>{r.overtime}h</td>
                <td className={cn('px-4 py-3 text-xs font-black tabular-nums', r.otRisk ? 'text-red-700' : 'text-slate-800')}>{r.total}h</td>
                <td className="px-4 py-3 text-xs font-bold tabular-nums text-slate-700">
                  {r.otPay > 0 ? `₹${r.otPay.toLocaleString('en-IN')}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {r.otRisk ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                      <AlertTriangle className="h-2.5 w-2.5" />{t('hours.otRisk')}
                    </span>
                  ) : r.total > 0 ? (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{t('hours.ok')}</span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">{t('hours.noHours')}</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        {t('hours.thresholdLabel')}: {period === 'week' ? t('hours.threshWeek') : period === 'fortnight' ? t('hours.threshFortnight') : t('hours.threshMonth')}
        {' '}{t('hours.wtdBaseline')}
      </p>

      {/* Log OT modal */}
      {showOTModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowOTModal(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[var(--color-accent)]" />{t('hours.logOvertime')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{t('hours.modalNote')}</p>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('hours.staffMember')}</p>
                <Select value={otForm.staffId} onChange={(e) => setOtForm({ ...otForm, staffId: e.target.value })}
                  className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25">
                  <option value="">{t('hours.pickOption')}</option>
                  {staff.filter(s => s.status === 'active').map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('hours.date')}</p>
                  <input type="date" value={otForm.date}
                    onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                    className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('hours.hoursLabel')}</p>
                  <input type="number" min={0.5} step={0.5} value={otForm.hours}
                    onChange={(e) => setOtForm({ ...otForm, hours: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('hours.reason')}</p>
                <input value={otForm.reason} onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                  placeholder={t('hours.reasonPlaceholder')}
                  className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowOTModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">{t('hours.cancel')}</button>
              <button onClick={handleLogOT}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                <Sparkles className="h-3.5 w-3.5" />{t('hours.logOvertime')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function KPI({ label, value, tint }: { label: string; value: string | number; tint: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tint)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  )
}
