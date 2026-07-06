"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  IndianRupee, Lock, Download, Calendar, Search, Filter, Sparkles,
  TrendingUp, AlertTriangle, CheckCircle2,
} from "lucide-react"
import { useHRStore, type StaffMember } from "@/store/useHRStore"
import { hoursWorked } from "@/lib/shiftConflicts"
import { useAuthStore } from "@/store/useAuthStore"
import { useAuditStore } from "@/store/useAuditStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { printableHtml } from "@/lib/fileIO"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { useTranslations } from "next-intl"

const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const isoDay = (d: Date) => d.toISOString().split('T')[0]!

// Calculate the start/end dates for a given pay period
function periodRange(month: string): { from: string; to: string; label: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const to = isoDay(new Date(y!, m!, 0))  // last day of month
  const label = new Date(from + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  return { from, to, label }
}

const DEFAULT_DEDUCTION_RATE = 0.08  // 8% PF + ESI + Tax bucket
const SCHEDULED_WORKING_DAYS = 22    // assumed working days per month

interface PayrollRow {
  staff: StaffMember
  scheduledHours: number
  overtimeHours: number
  baseGross: number          // monthly rate (full)
  overtimePay: number
  totalGross: number
  deductions: number
  netPay: number
}

export default function PayrollPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const overtimeEntries = useHRStore(s => s.overtimeEntries)
  const payrollPeriods = useHRStore(s => s.payrollPeriods)

  const canClose = canDo(currentUser?.role, 'finance.payroll')
  const actorName = currentUser?.name ?? 'Administrator'
  const { confirm, view: dialogView } = useDialogs()

  const currentMonth = isoDay(new Date()).slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('All')

  const { from, to, label } = useMemo(() => periodRange(month), [month])
  const hours = useMemo(() => hoursWorked(shifts, from, to, overtimeEntries),
    [shifts, from, to, overtimeEntries])

  const isLocked = payrollPeriods.some(p => p.from === from && p.to === to)

  const departments = useMemo(() => ['All', ...Array.from(new Set(staff.map(s => s.department))).sort()], [staff])

  const rows = useMemo<PayrollRow[]>(() => {
    return staff
      .filter(s => s.status === 'active' || s.status === 'on_leave')
      .filter(s => deptFilter === 'All' || s.department === deptFilter)
      .filter(s => {
        if (!search) return true
        const f = search.toLowerCase()
        return s.name.toLowerCase().includes(f) || s.department.toLowerCase().includes(f) || s.id.toLowerCase().includes(f)
      })
      .map(s => {
        const h = hours.get(s.id) ?? { scheduled: 0, overtime: 0, total: 0 }
        const baseGross = s.monthlyRate ?? 0
        const overtimePay = h.overtime * (s.hourlyOTRate ?? 0)
        const totalGross = baseGross + overtimePay
        const deductions = totalGross * DEFAULT_DEDUCTION_RATE
        const netPay = totalGross - deductions
        return {
          staff: s,
          scheduledHours: h.scheduled,
          overtimeHours: h.overtime,
          baseGross, overtimePay, totalGross, deductions, netPay,
        }
      })
      .sort((a, b) => b.totalGross - a.totalGross)
  }, [staff, deptFilter, search, hours])

  const totals = useMemo(() => {
    return rows.reduce((t, r) => ({
      baseGross: t.baseGross + r.baseGross,
      overtimePay: t.overtimePay + r.overtimePay,
      totalGross: t.totalGross + r.totalGross,
      deductions: t.deductions + r.deductions,
      netPay: t.netPay + r.netPay,
    }), { baseGross: 0, overtimePay: 0, totalGross: 0, deductions: 0, netPay: 0 })
  }, [rows])

  // Department breakdown
  const deptBreakdown = useMemo(() => {
    const byDept = new Map<string, number>()
    for (const r of rows) byDept.set(r.staff.department, (byDept.get(r.staff.department) ?? 0) + r.totalGross)
    return Array.from(byDept.entries()).sort((a, b) => b[1] - a[1])
  }, [rows])

  const handleLockPeriod = async () => {
    if (!canClose) { toast.error(t('payroll.noPermission')); return }
    if (isLocked) { toast.error(t('payroll.alreadyLocked')); return }
    const ok = await confirm({
      title: t('payroll.lockTitle', { label }),
      body: t('payroll.lockBody', { net: Math.round(totals.netPay).toLocaleString('en-IN'), count: rows.length }),
      confirmLabel: t('payroll.lockPeriod'),
      tone: 'warn',
    })
    if (!ok) return

    // Push a PayrollPeriod entry into the HR store directly
    const period = {
      id: `PP-${from}`,
      from, to,
      closedBy: actorName,
      closedAt: new Date().toISOString(),
      totalGross: Math.round(totals.totalGross),
      totalNet: Math.round(totals.netPay),
      staffCount: rows.length,
    }
    useHRStore.setState(s => ({ payrollPeriods: [...s.payrollPeriods, period] }))
    useAuditStore.getState().log({
      userId: 'ADM-01', userName: actorName,
      action: 'finance_payroll_locked',
      resource: 'payroll_period', resourceId: period.id,
      detail: `Payroll locked · ${label} · ${rows.length} staff · gross ${fmtINR(totals.totalGross)} · net ${fmtINR(totals.netPay)}`,
    })
    // M11-B — notify Finance + HR that the period is locked.
    notifyAndAuditMany(['admin', 'audit_officer'], {
      type: 'system', priority: 'medium',
      title: t('payroll.notifyTitle', { label }),
      body: t('payroll.notifyBody', { count: rows.length, gross: fmtINR(totals.totalGross), net: fmtINR(totals.netPay) }),
      audit: { action: 'finance_period_closed', resource: 'payroll_period', resourceId: period.id, detail: `${label} payroll locked`, userName: actorName },
    })
    toast.success(t('payroll.lockedToast', { label }))
  }

  // M11-B — generate a per-row payslip PDF (printable HTML window).
  function downloadPayslip(r: typeof rows[number]) {
    printableHtml(`Payslip · ${r.staff.name} · ${label}`, `
      <div class="info-row">
        <div class="info-item"><span class="info-label">Employee</span><span class="info-value">${r.staff.name}</span></div>
        <div class="info-item"><span class="info-label">Staff ID</span><span class="info-value">${r.staff.id}</span></div>
        <div class="info-item"><span class="info-label">Designation</span><span class="info-value">${r.staff.designation}</span></div>
        <div class="info-item"><span class="info-label">Department</span><span class="info-value">${r.staff.department}</span></div>
        <div class="info-item"><span class="info-label">Pay Period</span><span class="info-value">${label}</span></div>
      </div>
      <h3>Attendance</h3>
      <table>
        <thead><tr><th>Component</th><th style="text-align:right">Hours</th></tr></thead>
        <tbody>
          <tr><td>Scheduled hours</td><td style="text-align:right">${r.scheduledHours.toFixed(2)} h</td></tr>
          <tr><td>Overtime hours</td><td style="text-align:right">${r.overtimeHours.toFixed(2)} h</td></tr>
        </tbody>
      </table>
      <h3>Salary Breakdown</h3>
      <table>
        <thead><tr><th>Component</th><th style="text-align:right">Amount (₹)</th></tr></thead>
        <tbody>
          <tr><td>Base pay</td><td style="text-align:right">${Math.round(r.baseGross).toLocaleString('en-IN')}</td></tr>
          <tr><td>Overtime pay</td><td style="text-align:right">${Math.round(r.overtimePay).toLocaleString('en-IN')}</td></tr>
          <tr><td>Gross pay</td><td style="text-align:right">${Math.round(r.totalGross).toLocaleString('en-IN')}</td></tr>
          <tr><td>Deductions (PF / PT / TDS)</td><td style="text-align:right">− ${Math.round(r.deductions).toLocaleString('en-IN')}</td></tr>
          <tr class="total"><td>Net payable</td><td style="text-align:right">₹${Math.round(r.netPay).toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>`)
  }

  const exportCSV = () => {
    const header = ['Staff', 'Staff ID', 'Department', 'Designation', 'Scheduled hrs', 'OT hrs', 'Base ₹', 'OT ₹', 'Gross ₹', 'Deductions ₹', 'Net ₹']
    const csv = [
      header.join(','),
      ...rows.map(r => [
        `"${r.staff.name}"`, r.staff.id, `"${r.staff.department}"`, `"${r.staff.designation}"`,
        r.scheduledHours, r.overtimeHours,
        Math.round(r.baseGross), Math.round(r.overtimePay),
        Math.round(r.totalGross), Math.round(r.deductions), Math.round(r.netPay),
      ].join(',')),
    ].join('\n')
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `payroll-${month}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('payroll.exported', { count: rows.length }))
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-emerald-600" />{t('payroll.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('payroll.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            <Download className="h-3.5 w-3.5" />{t('payroll.export')}
          </button>
          {canClose && !isLocked && (
            <button onClick={handleLockPeriod}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
              <Lock className="h-3.5 w-3.5" />{t('payroll.lockPeriod')}
            </button>
          )}
          {isLocked && (
            <span className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />{t('payroll.periodLocked')}
            </span>
          )}
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <input type="month" value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-sm font-bold text-slate-700 outline-none bg-transparent" />
          <span className="text-[11px] text-slate-400">({label})</span>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('payroll.searchPlaceholder')}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-1.5 bg-white">
            {departments.map(d => <option key={d} value={d}>{d === 'All' ? t('payroll.allDepts') : d}</option>)}
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPI label={t('payroll.kpiStaff')} value={rows.length.toString()} tint="bg-slate-50 border-slate-200 text-slate-700" />
        <KPI label={t('payroll.kpiBaseSalary')} value={fmtINR(totals.baseGross)} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[#B84A16]" />
        <KPI label={t('payroll.kpiOtPay')} value={fmtINR(totals.overtimePay)} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[#B84A16]" />
        <KPI label={t('payroll.kpiDeductions')} value={fmtINR(totals.deductions)} tint="bg-amber-50 border-amber-200 text-amber-700" />
        <KPI label={t('payroll.kpiNetPayable')} value={fmtINR(totals.netPay)} tint="bg-emerald-50 border-emerald-200 text-emerald-700" />
      </div>

      {/* Dept breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#B84A16]" />{t('payroll.costByDept', { label })}
        </h3>
        <div className="space-y-2">
          {deptBreakdown.map(([dept, amt]) => {
            const pct = totals.totalGross > 0 ? (amt / totals.totalGross) * 100 : 0
            return (
              <div key={dept}>
                <p className="text-xs text-slate-600 flex items-center justify-between">
                  <span className="font-semibold">{dept}</span>
                  <b className="tabular-nums">{fmtINR(amt)} <span className="text-slate-400 text-[10px] ml-1">{pct.toFixed(1)}%</span></b>
                </p>
                <div className="h-1.5 mt-0.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[['colStaff','Staff'],['colDept','Dept'],['colHours','Hours'],['colBase','Base'],['colOt','OT'],['colGross','Gross'],['colDeduction','Deduction'],['colNet','Net'],['colEmpty','']].map(([k]) => (
                <th key={k} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{k === 'colEmpty' ? '' : t(`payroll.${k}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400 italic">{t('payroll.noData')}</td></tr>
            ) : rows.map((r, i) => (
              <motion.tr key={r.staff.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.005 }}
                className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">{r.staff.name}</p>
                  <p className="text-[11px] text-slate-500">{r.staff.designation} · {r.staff.id}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{r.staff.department}</td>
                <td className="px-4 py-3 text-xs tabular-nums">
                  <span className="text-slate-800">{r.scheduledHours}h</span>
                  {r.overtimeHours > 0 && <span className="text-[#B84A16] font-bold"> {t('payroll.otSuffix', { hours: r.overtimeHours })}</span>}
                </td>
                <td className="px-4 py-3 text-xs font-bold text-slate-800 tabular-nums">{fmtINR(r.baseGross)}</td>
                <td className={cn('px-4 py-3 text-xs font-bold tabular-nums', r.overtimePay > 0 ? 'text-[#B84A16]' : 'text-slate-400')}>{fmtINR(r.overtimePay)}</td>
                <td className="px-4 py-3 text-xs font-bold text-slate-800 tabular-nums">{fmtINR(r.totalGross)}</td>
                <td className="px-4 py-3 text-xs text-amber-700 tabular-nums">−{fmtINR(r.deductions)}</td>
                <td className="px-4 py-3 text-xs font-black text-emerald-700 tabular-nums">{fmtINR(r.netPay)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => downloadPayslip(r)} className="text-[10.5px] font-bold text-[#B84A16] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] border border-[rgba(238,107,38,0.20)] px-2 py-1 rounded cursor-pointer">{t('payroll.payslip')}</button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />{t('payroll.deductionNote', { rate: Math.round(DEFAULT_DEDUCTION_RATE * 100) })}
      </p>

      {payrollPeriods.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">{t('payroll.lockedPeriods', { count: payrollPeriods.length })}</h3>
          <div className="space-y-1.5">
            {payrollPeriods.slice(-5).reverse().map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700">{fmtDate(p.from)} → {fmtDate(p.to)}</span>
                <span className="font-bold text-emerald-700 tabular-nums">{t('payroll.netStaff', { net: fmtINR(p.totalNet), count: p.staffCount })}</span>
                <span className="text-[10px] text-slate-400">{p.closedBy}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {dialogView}
    </div>
  )
}

function KPI({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tint)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-base font-black mt-1 tabular-nums">{value}</p>
    </div>
  )
}
