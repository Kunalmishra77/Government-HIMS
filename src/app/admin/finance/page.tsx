"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  TrendingUp, TrendingDown, IndianRupee, AlertTriangle, ArrowRight,
  Wallet, CreditCard, Receipt, Building2, Sparkles, BarChart3,
} from "lucide-react"
import { useBillingStore } from "@/store/useBillingStore"
import { useHRStore } from "@/store/useHRStore"
import { useVendorStore } from "@/store/useVendorStore"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { hoursWorked } from "@/lib/shiftConflicts"
import { cn } from "@/lib/utils"
import { RevenueCycleGrowthCockpit } from "@/components/admin/RevenueCycleGrowthCockpit"
import { useTranslations } from "next-intl"

const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const fmtINRk = (n: number) => {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${Math.round(n)}`
}
const isoDay = (d: Date) => d.toISOString().split('T')[0]!
const today = () => isoDay(new Date())

function periodRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const to = isoDay(new Date(y!, m!, 0))
  return { from, to }
}

type AgingBucket = '0-30' | '31-60' | '61-90' | '90+'

function ageBucket(days: number): AgingBucket {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export default function FinanceDashboard() {
  const t = useTranslations('admin')
  const bills = useBillingStore(s => s.bills)
  const lineItems = useBillingStore(s => s.lineItems)
  const claims = useInsuranceStore(s => s.claims)
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const overtimeEntries = useHRStore(s => s.overtimeEntries)
  const invoices = useVendorStore(s => s.invoices)
  const getOverdueInvoices = useVendorStore(s => s.getOverdueInvoices)

  const currentMonth = today().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)
  const { from, to } = periodRange(month)

  // ── Revenue: paid + outstanding ──────────────────────────────────────
  const revenueMetrics = useMemo(() => {
    const totalRevenue = bills.reduce((sum, b) => sum + b.subtotal, 0)
    const collected = bills.reduce((sum, b) => sum + b.paidAmount, 0)
    const outstanding = bills.filter(b => b.status !== 'settled').reduce((sum, b) => sum + (b.patientDue - b.paidAmount), 0)
    const insuranceCovered = bills.reduce((sum, b) => sum + b.insuranceCovered, 0)

    // Per-dept revenue from line items (proxy by source)
    const byDept = new Map<string, number>()
    for (const li of lineItems) {
      const amt = li.amount * li.quantity
      const dept = li.source || 'Other'
      byDept.set(dept, (byDept.get(dept) ?? 0) + amt)
    }

    // Payer mix
    const payerMix = new Map<string, number>()
    for (const b of bills) {
      const payer = b.payerType.includes('Cashless') ? 'Cashless Insurance'
        : b.payerType.includes('General') ? 'Cash / Self-Pay'
        : b.payerType.includes('Insurance') ? 'Insurance (reimbursement)'
        : b.payerType
      payerMix.set(payer, (payerMix.get(payer) ?? 0) + b.subtotal)
    }

    return { totalRevenue, collected, outstanding, insuranceCovered, byDept, payerMix }
  }, [bills, lineItems])

  // ── Expenses: salary + OT + vendor payments ──────────────────────────
  const expenseMetrics = useMemo(() => {
    // Staff salary (simulated for current month)
    const salaryByDept = new Map<string, number>()
    let totalSalary = 0
    let totalOT = 0
    const monthHours = hoursWorked(shifts, from, to, overtimeEntries)
    for (const s of staff) {
      if (s.status !== 'active' && s.status !== 'on_leave') continue
      const base = s.monthlyRate ?? 0
      const otHours = monthHours.get(s.id)?.overtime ?? 0
      const otPay = otHours * (s.hourlyOTRate ?? 0)
      totalSalary += base
      totalOT += otPay
      salaryByDept.set(s.department, (salaryByDept.get(s.department) ?? 0) + base + otPay)
    }

    // Vendor payments (paid this month)
    const vendorSpend = invoices
      .filter(i => i.paidDate?.startsWith(month))
      .reduce((sum, i) => sum + i.amount + i.gstAmount, 0)

    // Payable (unpaid)
    const vendorPayable = invoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + i.amount + i.gstAmount, 0)

    const totalExpenses = totalSalary + totalOT + vendorSpend

    return { totalSalary, totalOT, vendorSpend, vendorPayable, totalExpenses, salaryByDept }
  }, [staff, shifts, overtimeEntries, invoices, from, to, month])

  // ── Insurance claim aging ────────────────────────────────────────────
  const aging = useMemo(() => {
    const buckets: Record<AgingBucket, { count: number; amount: number }> = {
      '0-30':  { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+':   { count: 0, amount: 0 },
    }
    const todayStr = today()
    for (const c of claims) {
      if (c.status === 'Approved' || c.status === 'Rejected') continue
      const submittedAt = c.submittedAt ?? c.timeline?.[0]?.at
      if (!submittedAt) continue
      const days = Math.round((new Date(todayStr).getTime() - new Date(submittedAt).getTime()) / 86400000)
      const bucket = ageBucket(days)
      buckets[bucket].count++
      buckets[bucket].amount += c.amount
    }
    return buckets
  }, [claims])

  // ── Net P&L ──────────────────────────────────────────────────────────
  const netPL = revenueMetrics.collected - expenseMetrics.totalExpenses

  // ── Daily revenue (last 7 days) for sparkline ────────────────────────
  const dailyTrend = useMemo(() => {
    const out: { date: string; collected: number; outstanding: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = isoDay(d)
      const dayBills = bills.filter(b => b.admissionDate?.startsWith(dateStr) || b.dischargeDate?.startsWith(dateStr))
      const collected = dayBills.reduce((sum, b) => sum + b.paidAmount, 0)
      const outstanding = dayBills.reduce((sum, b) => sum + (b.patientDue - b.paidAmount), 0)
      out.push({ date: dateStr, collected, outstanding })
    }
    return out
  }, [bills])

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <IndianRupee className="h-6 w-6 text-emerald-600" />{t('finance.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('finance.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-sm font-bold border border-slate-300 rounded-xl px-3 py-2 bg-white" />
          <Link href="/admin/payroll" className="flex items-center gap-1 text-xs font-bold text-[var(--color-accent)] hover:underline">
            {t('finance.payrollLink')}
          </Link>
          <Link href="/admin/vendors" className="flex items-center gap-1 text-xs font-bold text-[var(--color-accent)] hover:underline">
            {t('finance.vendorsLink')}
          </Link>
          <Link href="/admin/disputes" className="flex items-center gap-1 text-xs font-bold text-[var(--color-accent)] hover:underline">
            {t('finance.disputesLink')}
          </Link>
        </div>
      </div>

      {/* M4-W3 — S8: Revenue-Cycle Growth Cockpit. Reads claims + bills live;
          surfaces four levers with reasoning + HITL action. */}
      <RevenueCycleGrowthCockpit />

      {/* Top-line KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPI label={t('finance.kpiRevenue')} value={fmtINRk(revenueMetrics.totalRevenue)} sub={t('finance.billsCount', { count: bills.length })} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" />
        <KPI label={t('finance.kpiCollected')} value={fmtINRk(revenueMetrics.collected)} sub={t('finance.pctOfRevenue', { pct: Math.round((revenueMetrics.collected / Math.max(1, revenueMetrics.totalRevenue)) * 100) })} tint="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <KPI label={t('finance.kpiOutstanding')} value={fmtINRk(revenueMetrics.outstanding)} sub={t('finance.ar')} tint="bg-amber-50 border-amber-200 text-amber-700" />
        <KPI label={t('finance.kpiExpenses')} value={fmtINRk(expenseMetrics.totalExpenses)} sub={t('finance.salaryOtVendor')} tint="bg-red-50 border-red-200 text-red-700" />
        <KPI label={t('finance.kpiNetPL')} value={fmtINRk(netPL)} sub={netPL >= 0 ? t('finance.profit') : t('finance.loss')} tint={netPL >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Per-dept revenue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--color-accent)]" />{t('finance.revenueBySource', { month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long' }) })}
          </h3>
          {(() => {
            const sorted = Array.from(revenueMetrics.byDept.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
            const max = sorted[0]?.[1] ?? 1
            if (sorted.length === 0) return <p className="text-xs text-slate-400 italic py-3 text-center">{t('finance.noLineItems')}</p>
            return (
              <div className="space-y-2">
                {sorted.map(([dept, amt]) => (
                  <div key={dept}>
                    <p className="text-xs text-slate-600 flex items-center justify-between">
                      <span className="font-semibold">{dept}</span>
                      <b className="tabular-nums">{fmtINR(amt)}</b>
                    </p>
                    <div className="h-1.5 mt-0.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${(amt / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Payer mix */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-[var(--color-accent)]" />{t('finance.payerMix')}
          </h3>
          {(() => {
            const sorted = Array.from(revenueMetrics.payerMix.entries()).sort((a, b) => b[1] - a[1])
            const total = sorted.reduce((s, [, v]) => s + v, 0)
            if (sorted.length === 0) return <p className="text-xs text-slate-400 italic py-3 text-center">{t('finance.noBills')}</p>
            return (
              <div className="space-y-2">
                {sorted.map(([payer, amt]) => {
                  const pct = total > 0 ? (amt / total) * 100 : 0
                  return (
                    <div key={payer}>
                      <p className="text-xs text-slate-600 flex items-center justify-between">
                        <span className="font-semibold">{payer}</span>
                        <b className="tabular-nums">{fmtINR(amt)} <span className="text-slate-400 text-[10px] ml-1">{pct.toFixed(0)}%</span></b>
                      </p>
                      <div className="h-1.5 mt-0.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Insurance aging */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-600" />{t('finance.claimAging')}
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {(['0-30', '31-60', '61-90', '90+'] as AgingBucket[]).map(b => {
              const data = aging[b]
              const tint = b === '90+' ? 'bg-red-50 text-red-700 border-red-200'
                : b === '61-90' ? 'bg-amber-50 text-amber-700 border-amber-200'
                : b === '31-60' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              return (
                <div key={b} className={cn('rounded-lg border p-2', tint)}>
                  <p className="text-[10px] font-bold uppercase tracking-wide">{b} d</p>
                  <p className="text-base font-black tabular-nums mt-1">{data.count}</p>
                  <p className="text-[10px] tabular-nums">{fmtINRk(data.amount)}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-600" />{t('finance.expensesMonth', { month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long' }) })}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">{t('finance.salaryBase')}</span>
              <b className="tabular-nums">{fmtINR(expenseMetrics.totalSalary)}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700">{t('finance.overtimePay')}</span>
              <b className="tabular-nums text-[var(--color-accent)]">{fmtINR(expenseMetrics.totalOT)}</b>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700">{t('finance.vendorPaidMonth')}</span>
              <b className="tabular-nums">{fmtINR(expenseMetrics.vendorSpend)}</b>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-slate-800 font-bold">{t('finance.totalExpenses')}</span>
              <b className="tabular-nums text-red-700">{fmtINR(expenseMetrics.totalExpenses)}</b>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-700">{t('finance.vendorPayable')}</span>
              <b className="tabular-nums text-amber-700">{fmtINR(expenseMetrics.vendorPayable)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation strip */}
      <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-surface-sunken p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-primary-dark)]">{t('finance.dailyReconciliation')}</h3>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {dailyTrend.map(d => {
            const max = Math.max(...dailyTrend.map(x => x.collected + x.outstanding), 1)
            const total = d.collected + d.outstanding
            const pct = (total / max) * 100
            return (
              <div key={d.date} className="rounded-lg bg-white border border-slate-200 p-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                </p>
                <p className="text-[10px] text-slate-400">{new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric' })}</p>
                <div className="h-12 mt-1 bg-slate-100 rounded relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 bg-emerald-500"
                    style={{ height: `${total > 0 ? (d.collected / total) * pct : 0}%` }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-amber-400"
                    style={{ height: `${pct}%`, opacity: 0.3 }} />
                </div>
                <p className="text-[10px] font-bold text-emerald-700 mt-1 tabular-nums">{fmtINRk(d.collected)}</p>
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px]">
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-emerald-500 rounded" />{t('finance.collected')}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 bg-amber-400/40 rounded" />{t('finance.outstanding')}</span>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3" />
        {t('finance.demoNote')}
      </p>
    </div>
  )
}

function KPI({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tint)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-xl font-black mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  )
}
