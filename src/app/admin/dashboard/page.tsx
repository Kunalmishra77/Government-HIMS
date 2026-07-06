"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Users, Clock, TrendingUp, Activity, Calendar,
  Pill, AlertTriangle, Sparkles, ArrowUpRight,
  ShieldCheck, Wifi, MoreHorizontal, BedDouble,
  CreditCard, FlaskConical, CheckCircle, Workflow, RefreshCw,
} from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { ProgressRing } from "@/components/ui/progress-ring"
import { Card } from "@/components/ui/card"
import { usePatientStore } from "@/store/usePatientStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useLabStore } from "@/store/useLabStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useDischargeStore } from "@/store/useDischargeStore"
import { useQualityStore } from "@/store/useQualityStore"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useJourneyStore } from "@/store/useJourneyStore"
import { useWhatsAppStore } from "@/store/useWhatsAppStore"
import { detectFlowBottlenecks, type BottleneckReport } from "@/ai-services/detect-flow-bottlenecks"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { FLAGS } from "@/config/feature-flags"
import { cn } from "@/lib/utils"
import { MessageCircle } from "lucide-react"
import { useHRStore } from "@/store/useHRStore"
import { CoverageStrip } from "@/components/admin/CoverageGauge"
import { SickCallModal } from "@/components/admin/SickCallModal"
import { SwapRequestModal } from "@/components/admin/SwapRequestModal"
import { DemoSeedControl } from "@/components/admin/DemoSeedControl"
import { CompactHeader } from "@/components/ui/CompactHeader"
import { AlertCircle, ArrowLeftRight, Wallet, ChevronRight } from "lucide-react"
import { useVendorStore } from "@/store/useVendorStore"
import { useStatutoryStore } from "@/store/useStatutoryStore"
import { useBMWStore } from "@/store/useBMWStore"
import { useAuditStore } from "@/store/useAuditStore"
import { buildNabhEvidence } from "@/lib/nabhEvidence"
import { Lock, Calendar as CalendarIcon, Trash2, ShieldAlert } from "lucide-react"

const WEEKLY = [
  { day: 'Mon', count: 48 }, { day: 'Tue', count: 62 }, { day: 'Wed', count: 55 },
  { day: 'Thu', count: 71 }, { day: 'Fri', count: 83 }, { day: 'Sat', count: 44 }, { day: 'Sun', count: 28 },
]
const maxCount = Math.max(...WEEKLY.map(w => w.count))

const DEPT_DATA = [
  { dept: 'General Medicine', count: 245, color: 'var(--color-primary)', pct: 40 },
  { dept: 'Cardiology',       count: 128, color: 'var(--color-primary)', pct: 21 },
  { dept: 'Orthopedics',      count: 96,  color: 'var(--color-primary)', pct: 16 },
  { dept: 'Paediatrics',      count: 87,  color: '#22C55E', pct: 14 },
  { dept: 'ENT',              count: 64,  color: '#F59E0B', pct: 11 },
]

const KPI = [
  {
    labelKey: 'kpiPatientsToday', value: '83', subKey: 'kpiPatientsTodaySub',
    trend: '+12%', up: true, icon: Users, color: 'text-[var(--color-accent)]',
    cardBg: 'bg-[rgba(238,107,38,0.07)]/70', iconBg: 'bg-white', labelColor: 'text-[var(--color-primary-dark)]/60', ringColor: 'var(--color-primary)', ring: 68,
  },
  {
    labelKey: 'kpiAvgWaitTime', value: '18m', subKey: 'kpiAvgWaitTimeSub',
    trend: '−44%', up: true, icon: Clock, color: 'text-accent',
    cardBg: 'bg-surface-sunken', iconBg: 'bg-white', labelColor: 'text-accent/60', ringColor: 'var(--color-primary)', ring: 72,
  },
  {
    labelKey: 'kpiRevenueToday', value: '₹1.24L', subKey: 'kpiRevenueTodaySub',
    trend: '+8%', up: true, icon: TrendingUp, color: 'text-green-600',
    cardBg: 'bg-green-50/70', iconBg: 'bg-white', labelColor: 'text-green-800/60', ringColor: '#16A34A', ring: 80,
  },
  {
    labelKey: 'kpiAiAssistRate', value: '91%', subKey: 'kpiAiAssistRateSub',
    trend: '+5%', up: true, icon: Sparkles, color: 'text-[var(--color-accent)]',
    cardBg: 'bg-[rgba(238,107,38,0.07)]/70', iconBg: 'bg-white', labelColor: 'text-[var(--color-primary-dark)]/60', ringColor: 'var(--color-primary)', ring: 91,
  },
]

const OPS = [
  { label: 'Doctors on Duty',       value: '8 / 12',   icon: Users,     ok: true },
  { label: 'OPD Beds Occupied',     value: '18 / 24',  icon: Activity,  ok: true },
  { label: 'Avg Consultation Time', value: '11 min',   icon: Clock,     ok: true },
  { label: 'Appointments Booked',   value: '47',       icon: Calendar,  ok: true },
  { label: 'Pharmacy Queue',        value: '6 pending',icon: Pill,      ok: false },
  { label: 'AI Triage Active',      value: 'Online',   icon: Sparkles,  ok: true },
]

const COO_TABS = ['Patient Access', 'IPD Operations', 'Clinical Reliability', 'Finance & Claims', 'Quality & Compliance', 'Journey Flow', 'WhatsApp'] as const
type COOTab = typeof COO_TABS[number]

const URGENCY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 border-red-300 text-red-800',
  high: 'bg-accent-soft border-primary/20 text-accent',
  medium: 'bg-amber-100 border-amber-300 text-amber-800',
  low: 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]',
}

export default function AdminDashboard() {
  const t = useTranslations('admin')
  const stateLabel = (s: string) => t.has(`dashboard.state.${s}`) ? t(`dashboard.state.${s}`) : s
  const { patients } = usePatientStore()
  const { prescriptions } = usePharmacyStore()
  const { samples } = useLabStore()
  const { bills } = useBillingStore()
  const { dischargeQueue } = useDischargeStore()
  const { incidents, auditTasks, qualityMetrics } = useQualityStore()
  const { beds, admissionRequests } = useAdmissionStore()
  const { entries: journeyEntries, getSlaBreaches } = useJourneyStore()
  const { threads, escalateToHuman, resolveThread } = useWhatsAppStore()
  const pendingAdmissions = admissionRequests.filter(r => r.status === 'Pending')
  const router = useRouter()
  const [cooTab, setCooTab] = useState<COOTab>('Patient Access')
  const [bottleneckReport, setBottleneckReport] = useState<import('@/ai-services/detect-flow-bottlenecks').BottleneckReport | null>(null)
  const [bottleneckLoading, setBottleneckLoading] = useState(false)
  const [bottleneckEnvelope, setBottleneckEnvelope] = useState<import('@/types/ai').AiEnvelope<BottleneckReport> | null>(null)

  // Phase 3 — Coverage strip + Sick-call + Swap modal triggers
  const deptMinimums = useHRStore(s => s.deptMinimums)
  const getCoverage = useHRStore(s => s.getCoverage)
  const [showSickCall, setShowSickCall] = useState(false)
  const [showSwap, setShowSwap] = useState(false)
  const today = new Date().toISOString().split('T')[0]!
  const currentShiftLabel = ((): 'Morning' | 'Evening' | 'Night' => {
    const h = new Date().getHours()
    if (h >= 6 && h < 14) return 'Morning'
    if (h >= 14 && h < 22) return 'Evening'
    return 'Night'
  })()
  const criticalCoverageDepts = deptMinimums
    .filter(d => d.perShift)
    .map(d => ({ dept: d, coverage: getCoverage(d.department, today, currentShiftLabel) }))
    .filter(x => x.coverage.severity === 'critical')

  // Phase 5 / M5.6 — Cash Position widget. Subscribe to raw state and compute
  // derived values via useMemo so we don't return a fresh array each render
  // (which trips Zustand's infinite-loop guard).
  const vendorInvoices = useVendorStore(s => s.invoices)
  const hrStaff = useHRStore(s => s.staff)
  const cashWidget = useMemo(() => {
    const t = today
    const vendorPayable = vendorInvoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + i.amount + i.gstAmount, 0)
    const overdueCount = vendorInvoices.filter(i =>
      i.status === 'overdue' ||
      ((i.status === 'open' || i.status === 'approved') && i.dueDate < t),
    ).length
    const billsCollected = bills.reduce((sum, b) => sum + b.paidAmount, 0)
    const totalSalaryDue = hrStaff
      .filter(s => s.status === 'active' || s.status === 'on_leave')
      .reduce((sum, s) => sum + (s.monthlyRate ?? 0), 0)
    const activeStaffCount = hrStaff.filter(s => s.status === 'active' || s.status === 'on_leave').length
    const cashOnHand = billsCollected
    const dailyBurn = (totalSalaryDue + vendorPayable) / 30
    const cashRunwayDays = dailyBurn > 0 ? Math.round(cashOnHand / dailyBurn) : 999
    return { vendorPayable, overdueCount, cashOnHand, totalSalaryDue, activeStaffCount, cashRunwayDays }
  }, [vendorInvoices, bills, hrStaff, today])
  const fmtINRkLocal = (n: number) => {
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}K`
    return `₹${Math.round(n)}`
  }

  // Phase 6 — Compliance Status widget. Aggregate NABH + DISHA + BMW + Statutory + MoUs.
  const auditEntriesAll = useAuditStore(s => s.entries)
  const statutoryEntries = useStatutoryStore(s => s.entries)
  const vendors = useVendorStore(s => s.vendors)
  const bmwLogs = useBMWStore(s => s.wasteLogs)
  const compliance = useMemo(() => {
    // NABH
    const nabh = buildNabhEvidence(auditEntriesAll)
    const nabhReady = nabh.filter(c => c.ready).length
    // DISHA
    const dishaAll = auditEntriesAll.filter(e => e.action.startsWith('disha_'))
    const rtbfRequested = dishaAll.filter(e => e.action === 'disha_rtbf_requested')
    const rtbfFulfilled = new Set(dishaAll.filter(e => e.action === 'disha_rtbf_fulfilled').map(e => e.resourceId))
    const rtbfOpen = rtbfRequested.filter(r => !rtbfFulfilled.has(r.resourceId)).length
    const breaches = dishaAll.filter(e => e.action === 'disha_breach_logged').length
    // Statutory
    const todayStr = today
    const overdue = statutoryEntries.filter(e => {
      if (e.status === 'filed' || e.status === 'exempted') return false
      return e.dueDate < todayStr
    }).length
    const dueSoon = statutoryEntries.filter(e => {
      if (e.status === 'filed' || e.status === 'exempted') return false
      const d = Math.round((new Date(e.dueDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
      return d >= 0 && d <= 7
    }).length
    // MoU expired
    const mouExpired = vendors.filter(v => v.mouExpiry < todayStr).length
    // BMW score
    const thisMonth = todayStr.slice(0, 7)
    const monthLogs = bmwLogs.filter(l => l.date.startsWith(thisMonth))
    const disposed = monthLogs.filter(l => l.status === 'disposed').length
    const bmwScore = monthLogs.length ? Math.round((disposed / monthLogs.length) * 100) : 100

    let score = 100
    if (overdue > 0) score -= overdue * 8
    if (breaches > 0) score -= breaches * 15
    if (rtbfOpen > 0) score -= rtbfOpen * 3
    if (mouExpired > 0) score -= mouExpired * 5
    if (nabhReady < nabh.length) score -= (nabh.length - nabhReady) * 2
    score = Math.max(0, Math.min(100, score))

    return { nabhReady, nabhTotal: nabh.length, rtbfOpen, breaches, overdue, dueSoon, mouExpired, bmwScore, score }
  }, [auditEntriesAll, statutoryEntries, vendors, bmwLogs, today])

  const refreshBottlenecks = async () => {
    setBottleneckLoading(true)
    try {
      const result = await detectFlowBottlenecks(journeyEntries)
      setBottleneckEnvelope(result)
      setBottleneckReport(result.data)
    } finally {
      setBottleneckLoading(false)
    }
  }

  const pendingRx = prescriptions.filter(p => p.status !== 'collected').length
  const criticalUnack = samples.filter(s => s.criticalValue && !s.criticalAcknowledgedBy).length
  const billsOutstanding = bills.filter(b => b.status !== 'settled').reduce((a, b) => a + (b.patientDue - b.paidAmount), 0)
  const billsPendingFreeze = bills.filter(b => b.status === 'draft').length
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length
  const totalBeds = beds.length
  const dueDischargeToday = dischargeQueue.filter(p => !p.exitClearanceIssued).length
  const openIncidents = incidents.filter(i => i.status !== 'Resolved').length
  const auditCompletion = Math.round((auditTasks.filter(t => t.status === 'Completed').length / auditTasks.length) * 100)

  return (
    <div className="space-y-3">

      {/* ── M2 — Compact page header (denser, one-row, primary action emphasised) ── */}
      <CompactHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        badge={
          criticalCoverageDepts.length > 0 ? (
            <NeonBadge variant="danger" dot pulse>
              <AlertCircle className="h-3 w-3" /> {t('dashboard.coverageAlerts', { count: criticalCoverageDepts.length })}
            </NeonBadge>
          ) : (
            <NeonBadge variant="success" dot>{t('dashboard.systemsNormal')}</NeonBadge>
          )
        }
        side={
          <>
            <NeonBadge variant="blue" dot pulse><Wifi className="h-3 w-3" /> {t('dashboard.live')}</NeonBadge>
            <DemoSeedControl />
            <button onClick={() => setShowSickCall(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 ring-1 ring-amber-200/70 cursor-pointer">
              <AlertCircle className="h-3 w-3" />{t('dashboard.sickCall')}
            </button>
            <button onClick={() => setShowSwap(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 ring-1 ring-slate-200/70 cursor-pointer">
              <ArrowLeftRight className="h-3 w-3" />{t('dashboard.swapShift')}
            </button>
          </>
        }
      />

      {/* Coverage strip — current-shift gauge per critical dept */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-slate-800">{t('dashboard.coverageNow', { shift: currentShiftLabel })}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('dashboard.deptsWatched', { count: deptMinimums.filter(d => d.perShift).length })}</span>
          </div>
          <button onClick={() => router.push('/admin/coverage')}
            className="text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer">
            {t('dashboard.editRules')}
          </button>
        </div>
        <CoverageStrip
          depts={deptMinimums.filter(d => d.perShift).map(d => d.department)}
          date={today}
          shift={currentShiftLabel}
          onClickDept={() => router.push('/admin/coverage')}
        />
      </div>

      {/* M5.6 — Cash Position widget */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#16A34A]" />
            <h3 className="text-sm font-bold text-slate-800">{t('dashboard.cashPosition')}</h3>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded',
              cashWidget.cashRunwayDays < 30 ? 'bg-red-100 text-red-700' :
              cashWidget.cashRunwayDays < 60 ? 'bg-amber-100 text-amber-700' :
              'bg-emerald-100 text-emerald-700')}>
              {t('dashboard.runway', { days: cashWidget.cashRunwayDays })}
            </span>
          </div>
          <button onClick={() => router.push('/admin/finance')}
            className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer">
            {t('dashboard.openPL')} <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {/* Calm, single-language KPI strip — neutral hairline tiles, ink values
            (no rainbow). Risk stays in the runway badge + the red overdue note. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#FBFCFE] border border-[#EAECF2] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.cashOnHand')}</p>
            <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{fmtINRkLocal(cashWidget.cashOnHand)}</p>
          </div>
          <div className="rounded-xl bg-[#FBFCFE] border border-[#EAECF2] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.arOutstanding')}</p>
            <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{fmtINRkLocal(billsOutstanding)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t('dashboard.billsCount', { count: bills.filter(b => b.status !== 'settled').length })}</p>
          </div>
          <div className="rounded-xl bg-[#FBFCFE] border border-[#EAECF2] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.apPayable')}</p>
            <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{fmtINRkLocal(cashWidget.vendorPayable)}</p>
            {cashWidget.overdueCount > 0 && (
              <p className="text-[10px] text-red-600 mt-0.5 font-semibold">{t('dashboard.overdueCount', { count: cashWidget.overdueCount })}</p>
            )}
          </div>
          <div className="rounded-xl bg-[#FBFCFE] border border-[#EAECF2] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('dashboard.payrollDue')}</p>
            <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{fmtINRkLocal(cashWidget.totalSalaryDue)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{t('dashboard.staffCount', { count: cashWidget.activeStaffCount })}</p>
          </div>
        </div>
      </div>

      {/* Phase 6 — Compliance Status widget */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-slate-800">{t('dashboard.complianceStatus')}</h3>
            <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded',
              compliance.score >= 90 ? 'bg-emerald-100 text-emerald-700' :
              compliance.score >= 75 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700')}>
              {compliance.score}/100
            </span>
          </div>
          <button onClick={() => router.push('/admin/compliance')}
            className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer">
            {t('dashboard.openCockpit')} <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button onClick={() => router.push('/quality/nabh')}
            className={cn('rounded-lg p-3 text-left cursor-pointer hover:shadow-md transition border',
              compliance.nabhReady === compliance.nabhTotal ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">NABH</p>
            </div>
            <p className="text-base font-black tabular-nums">{compliance.nabhReady}/{compliance.nabhTotal}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{t('dashboard.chaptersReady')}</p>
          </button>
          <button onClick={() => router.push('/admin/disha')}
            className={cn('rounded-lg p-3 text-left cursor-pointer hover:shadow-md transition border',
              compliance.breaches > 0 ? 'bg-red-50 border-red-200' :
              compliance.rtbfOpen > 0 ? 'bg-amber-50 border-amber-200' :
              'bg-emerald-50 border-emerald-200')}>
            <div className="flex items-center gap-1.5 mb-1">
              <Lock className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">DISHA</p>
            </div>
            <p className="text-base font-black tabular-nums">{compliance.breaches > 0 ? t('dashboard.dishaBreach') : t('dashboard.dishaOk')}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{t('dashboard.rtbfOpen', { count: compliance.rtbfOpen })}</p>
          </button>
          <button onClick={() => router.push('/admin/statutory')}
            className={cn('rounded-lg p-3 text-left cursor-pointer hover:shadow-md transition border',
              compliance.overdue > 0 ? 'bg-red-50 border-red-200' :
              compliance.dueSoon > 0 ? 'bg-amber-50 border-amber-200' :
              'bg-emerald-50 border-emerald-200')}>
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{t('dashboard.statutoryLabel')}</p>
            </div>
            <p className="text-base font-black tabular-nums">{compliance.overdue > 0 ? t('dashboard.statutoryOverdue', { count: compliance.overdue }) : `${compliance.dueSoon}`}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{compliance.overdue === 0 ? t('dashboard.dueWithin7') : t('dashboard.pastDue')}</p>
          </button>
          <button onClick={() => router.push('/admin/vendors')}
            className={cn('rounded-lg p-3 text-left cursor-pointer hover:shadow-md transition border',
              compliance.mouExpired > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200')}>
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{t('dashboard.mousLabel')}</p>
            </div>
            <p className="text-base font-black tabular-nums">{compliance.mouExpired}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{t('dashboard.expired')}</p>
          </button>
          <button onClick={() => router.push('/bmw/reports')}
            className={cn('rounded-lg p-3 text-left cursor-pointer hover:shadow-md transition border',
              compliance.bmwScore >= 90 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
            <div className="flex items-center gap-1.5 mb-1">
              <Trash2 className="h-3.5 w-3.5" />
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">BMW</p>
            </div>
            <p className="text-base font-black tabular-nums">{compliance.bmwScore}%</p>
            <p className="text-[10px] opacity-70 mt-0.5">{t('dashboard.cpcbCompliant')}</p>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {KPI.map(({ labelKey, value, subKey, trend, up, icon: Icon, color, cardBg, labelColor, ringColor, ring }, i) => (
          <motion.div
            key={labelKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={`rounded-xl ${cardBg} p-5 flex flex-col justify-between`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-white shadow-sm">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <ProgressRing
                value={ring}
                size={44}
                strokeWidth={4}
                color={ringColor}
                label={<span className="text-[10px] font-bold" style={{ color: ringColor }}>{ring}%</span>}
              />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight mb-1">{value}</p>
              <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{t(`dashboard.${labelKey}`)}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/60">
              <span className={`flex items-center text-xs font-bold ${up ? 'text-green-700 bg-green-100' : 'text-red-600 bg-red-50'} px-1.5 py-0.5 rounded-md`}>
                <ArrowUpRight className={`h-3 w-3 mr-0.5 ${up ? '' : 'rotate-90'}`} />
                {trend}
              </span>
              <span className="text-xs text-slate-500 font-medium">{t(`dashboard.${subKey}`)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── COO Command Center (5 tabs) ── */}
      <div>
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 mb-5 overflow-x-auto">
          {COO_TABS.map(tab => (
            <button key={tab} onClick={() => setCooTab(tab)}
              className={cn("flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap",
                cooTab === tab ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}>
              {t(`dashboard.cooTab.${tab}`)}
            </button>
          ))}
        </div>

        {cooTab === 'Patient Access' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('dashboard.kpiPatientsToday'), value: patients.length, sub: t('dashboard.paActiveRegistrations'), icon: Users, color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]' },
              { label: t('dashboard.kpiAvgWaitTime'), value: '18m', sub: t('dashboard.paAvgWaitSub'), icon: Clock, color: 'text-accent', bg: 'bg-surface-sunken border-border' },
              { label: t('dashboard.paWalkinRate'), value: '62%', sub: t('dashboard.paWalkinSub'), icon: Activity, color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]' },
              { label: t('dashboard.paPendingAdmissions'), value: pendingAdmissions.length, sub: t('dashboard.paAwaitingBedAssignment'), icon: BedDouble, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 mb-2"><Icon className={cn("h-5 w-5", color)} /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span></div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </Card>
            ))}
            <Card className="col-span-2 lg:col-span-4 p-5">
              <h3 className="font-bold text-slate-900 mb-4">{t('dashboard.opdWaitDistribution')}</h3>
              <div className="flex items-end gap-3 h-24">
                {['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h'].map((h, i) => {
                  const heights = [20, 55, 90, 85, 60, 40, 70, 65, 45, 25]
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-[rgba(238,107,38,0.12)] rounded-t-sm" style={{ height: `${heights[i]}%` }} />
                      <span className="text-[10px] text-slate-400">{h}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {cooTab === 'IPD Operations' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('dashboard.bedOccupancy'), value: `${Math.round((occupiedBeds / totalBeds) * 100)}%`, sub: t('dashboard.bedsFraction', { occupied: occupiedBeds, total: totalBeds }), icon: BedDouble, color: occupiedBeds / totalBeds > 0.85 ? 'text-red-600' : 'text-green-600', bg: occupiedBeds / totalBeds > 0.85 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
              { label: t('dashboard.dischargeQueue'), value: dueDischargeToday, sub: t('dashboard.expectedToday'), icon: CheckCircle, color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]' },
              { label: t('dashboard.avgLos'), value: `${qualityMetrics.avgLOS}d`, sub: t('dashboard.losTarget'), icon: Clock, color: qualityMetrics.avgLOS > 5 ? 'text-amber-600' : 'text-green-600', bg: qualityMetrics.avgLOS > 5 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200' },
              { label: t('dashboard.paPendingAdmissions'), value: pendingAdmissions.length, sub: t('dashboard.awaitingBed'), icon: Users, color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]' },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label} className="p-4">
                <div className="flex items-center gap-2 mb-2"><Icon className={cn("h-5 w-5", color)} /><span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span></div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </Card>
            ))}
            <Card className="col-span-2 p-5">
              <h3 className="font-bold text-slate-900 mb-3">{t('dashboard.wardOccupancy')}</h3>
              <div className="space-y-2">
                {[
                  { ward: 'General Ward', occupied: 18, total: 24 },
                  { ward: 'ICU', occupied: 5, total: 6 },
                  { ward: 'Semi-Private', occupied: 8, total: 10 },
                  { ward: 'Private', occupied: 3, total: 6 },
                ].map(({ ward, occupied, total }) => (
                  <div key={ward}>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                      <span>{t(`dashboard.ward.${ward}`)}</span><span>{occupied}/{total}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", occupied / total > 0.9 ? "bg-red-500" : occupied / total > 0.7 ? "bg-amber-500" : "bg-green-500")}
                        style={{ width: `${(occupied / total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="col-span-2 p-5">
              <h3 className="font-bold text-slate-900 mb-3">{t('dashboard.dischargePipeline')}</h3>
              <div className="space-y-2">
                {dischargeQueue.slice(0, 4).map(p => {
                  const cleared = Object.values(p.clearances).filter(v => v === 'cleared').length
                  const total = Object.keys(p.clearances).length
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.patientName}</p>
                        <p className="text-xs text-slate-500">{p.wardBed}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-slate-700">{t('dashboard.clearances', { cleared, total })}</p>
                        <div className="h-1.5 w-20 bg-slate-200 rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-[rgba(238,107,38,0.07)]0 rounded-full" style={{ width: `${(cleared / total) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {cooTab === 'Clinical Reliability' && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: t('dashboard.criticalLabUnack'), value: criticalUnack, urgent: criticalUnack > 0, icon: FlaskConical },
              { label: t('dashboard.openIncidents'), value: openIncidents, urgent: openIncidents > 2, icon: AlertTriangle },
              { label: t('dashboard.pharmacyQueue'), value: pendingRx, urgent: pendingRx > 5, icon: Pill },
            ].map(({ label, value, urgent, icon: Icon }) => (
              <Card key={label} className={cn("p-4 border-t-4", urgent ? "border-t-red-500" : "border-t-green-500")}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-5 w-5", urgent ? "text-red-500" : "text-green-500")} />
                  {urgent ? <NeonBadge variant="danger">{t('dashboard.actionRequired')}</NeonBadge> : <NeonBadge variant="success">{t('dashboard.normal')}</NeonBadge>}
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </Card>
            ))}
            <Card className="col-span-2 lg:col-span-3 p-5">
              <h3 className="font-bold text-slate-900 mb-3">{t('dashboard.recentIncidents')}</h3>
              <div className="space-y-2">
                {incidents.filter(i => i.status !== 'Resolved').slice(0, 4).map(i => (
                  <div key={i.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0",
                      i.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                      i.severity === 'High' ? 'bg-accent-soft text-accent' : 'bg-amber-100 text-amber-700'
                    )}>{i.severity}</span>
                    <p className="text-sm text-slate-700 flex-1 truncate">{i.description}</p>
                    <p className="text-xs text-slate-400 flex-shrink-0">{i.ward}</p>
                  </div>
                ))}
                {incidents.filter(i => i.status !== 'Resolved').length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">{t('dashboard.noOpenIncidents')}</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {cooTab === 'Finance & Claims' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('dashboard.outstandingBalance'), value: `₹${(billsOutstanding / 1000).toFixed(0)}K`, sub: t('dashboard.acrossAllBills'), color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
              { label: t('dashboard.billsPendingFreeze'), value: billsPendingFreeze, sub: t('dashboard.draftFreezeNeeded'), color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
              { label: t('dashboard.cashlessPreAuth'), value: t('dashboard.cashlessValue'), sub: t('dashboard.cashlessSub'), color: 'text-accent', bg: 'bg-primary-soft border-primary/20' },
              { label: t('dashboard.billsSettledToday'), value: bills.filter(b => b.status === 'settled').length, sub: t('dashboard.fullyCollected'), color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
            ].map(({ label, value, sub, color }) => (
              <Card key={label} className="p-4">
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
                <p className="text-xs font-bold text-slate-600 mt-1">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
              </Card>
            ))}
            <Card className="col-span-2 lg:col-span-4 p-5">
              <h3 className="font-bold text-slate-900 mb-3">{t('dashboard.billStatusOverview')}</h3>
              <div className="space-y-2">
                {bills.map(bill => {
                  const outstanding = bill.patientDue - bill.paidAmount
                  return (
                    <div key={bill.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{bill.patientName}</p>
                        <p className="text-xs text-slate-500">{bill.visitType} · {bill.payerType}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900">₹{bill.subtotal.toLocaleString('en-IN')}</p>
                        {outstanding > 0 && <p className="text-xs text-red-600 font-bold">{t('dashboard.due', { amount: `₹${outstanding.toLocaleString('en-IN')}` })}</p>}
                        {outstanding <= 0 && <p className="text-xs text-green-600 font-bold">{t('dashboard.settled')}</p>}
                      </div>
                      <span className={cn("text-xs font-bold px-2 py-1 rounded-lg border flex-shrink-0",
                        bill.status === 'settled' ? 'bg-green-50 text-green-700 border-green-200' :
                        bill.status === 'frozen' ? 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      )}>{bill.status}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {cooTab === 'Quality & Compliance' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('dashboard.fallsThisMonth'), value: qualityMetrics.fallsThisMonth, target: 5, urgent: qualityMetrics.fallsThisMonth > 5 },
              { label: t('dashboard.haiCount'), value: qualityMetrics.haiCount, target: 3, urgent: qualityMetrics.haiCount >= 3 },
              { label: t('dashboard.auditCompletion'), value: `${auditCompletion}%`, target: '90%', urgent: auditCompletion < 70 },
              { label: t('dashboard.patientSatisfaction'), value: `${qualityMetrics.patientSatisfaction}%`, target: '85%', urgent: qualityMetrics.patientSatisfaction < 85 },
            ].map(({ label, value, target, urgent }) => (
              <Card key={label} className={cn("p-4 border-t-4", urgent ? "border-t-red-500" : "border-t-green-500")}>
                {urgent ? <NeonBadge variant="danger" className="mb-2">{t('dashboard.belowTarget')}</NeonBadge> : <NeonBadge variant="success" className="mb-2">{t('dashboard.onTrack')}</NeonBadge>}
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('dashboard.target', { target })}</p>
              </Card>
            ))}
            <Card className="col-span-2 lg:col-span-4 p-5">
              <h3 className="font-bold text-slate-900 mb-3">{t('dashboard.auditTaskStatus')}</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${auditCompletion}%` }} />
                </div>
                <span className="text-sm font-bold text-slate-700">{t('dashboard.percentComplete', { pct: auditCompletion })}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Completed', 'Pending', 'Overdue'].map(status => {
                  const count = auditTasks.filter(t => t.status === status).length
                  return (
                    <div key={status} className={cn("p-3 rounded-xl border text-center",
                      status === 'Completed' ? 'bg-green-50 border-green-200' :
                      status === 'Overdue' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                    )}>
                      <p className="text-xl font-bold text-slate-900">{count}</p>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">{t(`dashboard.auditStatus.${status}`)}</p>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        )}

        {cooTab === 'Journey Flow' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{t('dashboard.patientFlowTitle')}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.activeAcrossStates', { patients: journeyEntries.length, states: Object.keys(journeyEntries.reduce((acc, e) => ({ ...acc, [e.currentState]: true }), {})).length })}</p>
              </div>
              <button
                onClick={refreshBottlenecks}
                disabled={bottleneckLoading}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${bottleneckLoading ? 'animate-spin' : ''}`} />
                {bottleneckLoading ? t('dashboard.analysing') : t('dashboard.runAiAnalysis')}
              </button>
            </div>

            {/* State lane grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(
                journeyEntries.reduce<Record<string, typeof journeyEntries>>(
                  (acc, e) => ({ ...acc, [e.currentState]: [...(acc[e.currentState] ?? []), e] }),
                  {}
                )
              ).map(([state, stateEntries]) => {
                const breaches = stateEntries.filter(e => e.slaBreachRisk).length
                return (
                  <Card key={state} className={`p-4 border-t-4 ${breaches > 0 ? 'border-t-red-400' : 'border-t-slate-200'}`}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                      {stateLabel(state)}
                    </p>
                    <p className="text-2xl font-bold text-slate-900">{stateEntries.length}</p>
                    {breaches > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                        <AlertTriangle className="h-3 w-3" /> {t('dashboard.slaBreachBadge', { count: breaches })}
                      </span>
                    )}
                  </Card>
                )
              })}
            </div>

            {/* SLA breach list */}
            {getSlaBreaches().length > 0 && (
              <Card className="p-5">
                <h4 className="font-bold text-red-700 flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" /> {t('dashboard.slaBreachesTitle', { count: getSlaBreaches().length })}
                </h4>
                <div className="space-y-2">
                  {getSlaBreaches().map(entry => {
                    const minsStuck = Math.round((Date.now() - new Date(entry.enteredStateAt).getTime()) / 60000)
                    return (
                      <div key={entry.patientId} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                        <div>
                          <span className="font-semibold text-slate-800 text-sm">{entry.patientId}</span>
                          <span className="text-slate-500 text-sm ml-2">— {stateLabel(entry.currentState)}</span>
                        </div>
                        <span className="text-sm font-bold text-red-700">{t('dashboard.minutes', { count: minsStuck })}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* AI bottleneck report */}
            {bottleneckEnvelope && bottleneckReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className={`p-5 border-t-4 ${bottleneckReport.systemPressureScore > 80 ? 'border-t-red-500' : bottleneckReport.systemPressureScore > 60 ? 'border-t-amber-400' : 'border-t-green-400'}`}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{t('dashboard.systemPressure')}</p>
                    <p className="text-3xl font-bold text-slate-900">{bottleneckReport.systemPressureScore}<span className="text-lg text-slate-400">/100</span></p>
                    {bottleneckReport.predictedPeakIn && (
                      <p className="text-xs text-amber-700 font-semibold mt-1.5">{t('dashboard.peakIn', { time: bottleneckReport.predictedPeakIn })}</p>
                    )}
                  </Card>
                  <Card className="p-5 md:col-span-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{t('dashboard.suggestedActions')}</p>
                    <ul className="space-y-1.5">
                      {bottleneckReport.suggestedActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>

                {bottleneckReport.bottlenecks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900">{t('dashboard.bottleneckDetails')}</h4>
                    {bottleneckReport.bottlenecks.map(b => (
                      <div key={b.state} className={`flex items-start justify-between rounded-xl border px-4 py-3 ${URGENCY_COLOR[b.urgency]}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{stateLabel(b.state)}</span>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${URGENCY_COLOR[b.urgency]}`}>{b.urgency}</span>
                          </div>
                          <p className="text-xs mt-1 opacity-80">{b.recommendation}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm font-bold">{t('dashboard.patientsStuck', { count: b.patientsStuck })}</p>
                          <p className="text-xs opacity-70">{t('dashboard.avgMinInState', { count: b.avgMinutesInState })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <HitlReviewCard
                  title={t('dashboard.aiFlowAnalysis')}
                  envelope={bottleneckEnvelope}
                  featureId="bottleneck_analysis"
                  renderContent={() => null}
                  shadowMode={FLAGS.shadowMode}
                  onAccept={() => {}}
                  onReject={() => {}}
                />
              </div>
            )}

            {!bottleneckEnvelope && !bottleneckLoading && (
              <Card className="p-10 text-center">
                <Workflow className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{t('dashboard.runToDetect')}</p>
              </Card>
            )}
          </div>
        )}

        {cooTab === 'WhatsApp' && FLAGS.whatsappAssistantEnabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" /> {t('dashboard.whatsappTitle')}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.conversationsEscalated', { conversations: threads.length, escalated: threads.filter(th => th.status === 'escalated').length })}</p>
              </div>
              <div className="flex gap-2">
                <NeonBadge variant="success" dot>{t('dashboard.activeCount', { count: threads.filter(th => th.status === 'active').length })}</NeonBadge>
                {threads.filter(th => th.status === 'escalated').length > 0 && (
                  <NeonBadge variant="danger">{t('dashboard.escalatedCount', { count: threads.filter(th => th.status === 'escalated').length })}</NeonBadge>
                )}
              </div>
            </div>

            {threads.map(thread => (
              <Card key={thread.id} className={`p-5 border-l-4 ${thread.status === 'escalated' ? 'border-l-red-400' : thread.status === 'resolved' ? 'border-l-green-400' : 'border-l-slate-400'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{thread.patientName ?? thread.patientPhone}</span>
                      {thread.identityVerified
                        ? <NeonBadge variant="success">{t('dashboard.verified')}</NeonBadge>
                        : <NeonBadge variant="warning">{t('dashboard.unverified')}</NeonBadge>
                      }
                      {thread.status === 'escalated' && <NeonBadge variant="danger">{t('dashboard.escalated')}</NeonBadge>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{thread.patientPhone} · {new Date(thread.lastActivity).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex gap-2">
                    {thread.status === 'active' && !thread.escalatedToHuman && (
                      <button
                        onClick={() => escalateToHuman(thread.id)}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-700 font-semibold rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        {t('dashboard.escalate')}
                      </button>
                    )}
                    {thread.status !== 'resolved' && (
                      <button
                        onClick={() => resolveThread(thread.id)}
                        className="text-xs px-3 py-1.5 bg-green-50 text-green-700 font-semibold rounded-lg border border-green-200 hover:bg-green-100 transition-colors"
                      >
                        {t('dashboard.resolve')}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {thread.messages.slice(-3).map(msg => (
                    <div key={msg.id} className={`flex ${msg.from === 'patient' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                        msg.from === 'patient'
                          ? 'bg-slate-100 text-slate-800'
                          : msg.from === 'human_agent'
                          ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]'
                          : 'bg-green-100 text-green-900'
                      }`}>
                        {msg.from !== 'patient' && (
                          <p className="text-[10px] font-bold uppercase opacity-60 mb-0.5">
                            {msg.from === 'ai' ? t('dashboard.senderAi') : t('dashboard.senderAgent')}
                          </p>
                        )}
                        <p>{msg.text}</p>
                        {msg.intent && (
                          <p className="text-[10px] opacity-50 mt-0.5">{msg.intent}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {cooTab === 'WhatsApp' && !FLAGS.whatsappAssistantEnabled && (
          <Card className="p-10 text-center">
            <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">{t('dashboard.whatsappDisabled')}</p>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        <Card className="lg:col-span-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-8 p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('dashboard.patientVolumeTrends')}</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">{t('dashboard.weeklyWalkins')}</p>
            </div>
            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-between flex-1 gap-2 pt-4">
            {WEEKLY.map(({ day, count }, i) => {
              const pct = (count / maxCount) * 100
              const isPeak = i === 4
              return (
                <div key={day} className="flex-1 flex flex-col items-center justify-end gap-2 group">
                  <div className="text-[11px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">{count}</div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className={`w-full max-w-[48px] rounded-t-lg transition-all ${isPeak ? 'bg-gradient-to-t from-[var(--color-primary)] to-[var(--color-primary-light)]' : 'bg-slate-100 hover:bg-[rgba(238,107,38,0.14)]'}`}
                    style={{ minHeight: 4 }}
                  />
                  <span className={`text-xs font-semibold mt-2 ${isPeak ? 'text-[var(--color-accent)]' : 'text-slate-500'}`}>
                    {day}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
        </Card>

        <Card className="lg:col-span-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">{t('dashboard.departments')}</h3>
            <NeonBadge variant="muted">{t('dashboard.monthly')}</NeonBadge>
          </div>

          <div className="space-y-5">
            {DEPT_DATA.map(({ dept, count, color, pct }, i) => (
              <div key={dept} className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">{t.has(`dashboard.dept.${dept}`) ? t(`dashboard.dept.${dept}`) : dept}</span>
                  <span className="text-sm font-bold text-slate-900">{count}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button onClick={() => router.push('/admin/patients')} className="w-full py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer">
              {t('dashboard.viewDetailedReport')}
            </button>
          </div>
        </motion.div>
        </Card>

        <Card className="lg:col-span-7 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="p-0 overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
            <h3 className="text-lg font-bold text-slate-900">{t('dashboard.livePatientQueue')}</h3>
            <NeonBadge variant="blue">{t('dashboard.activeCountShort', { count: patients.length })}</NeonBadge>
          </div>
          <div className="divide-y divide-slate-100 bg-slate-50/50">
            {patients.slice(0, 5).map((p, i) => {
              const triage = p.triageLevel ?? 'Low'
              const triageStyles: Record<string, string> = {
                Critical: 'bg-red-50 text-red-600 border-red-200',
                High: 'bg-primary-soft text-accent border-primary/20',
                Medium: 'bg-yellow-50 text-yellow-600 border-yellow-200',
                Low: 'bg-green-50 text-green-600 border-green-200'
              }
              const ts = triageStyles[triage] || triageStyles.Low

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="p-4 flex items-center gap-4 hover:bg-white transition-colors cursor-pointer"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-bold border ${ts}`}>
                    #{p.token}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{p.department} • {p.age}y</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 capitalize tracking-wide">
                      {p.queueStatus}
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">{t('dashboard.waitMinutes', { count: p.estimatedWait })}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
          <div className="p-3 bg-white border-t border-slate-100 text-center">
            <button onClick={() => router.push('/admin/patients')} className="text-sm font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer">{t('dashboard.viewAllPatients')}</button>
          </div>
        </motion.div>
        </Card>

        <Card className="lg:col-span-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">{t('dashboard.systemHealth')}</h3>
            <NeonBadge variant="success" dot>{t('dashboard.allSystemsGo')}</NeonBadge>
          </div>

          <div className="space-y-3 flex-1">
            {OPS.map(({ label, value, icon: Icon, ok }) => (
              <div
                key={label}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${ok ? 'bg-green-50' : 'bg-primary-soft'}`}>
                    <Icon className={`h-4 w-4 ${ok ? 'text-green-600' : 'text-accent'}`} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{t(`dashboard.ops.${label}`)}</span>
                </div>
                <span className={`text-sm font-bold ${ok ? 'text-slate-900' : 'text-accent'}`}>
                  {label === 'Pharmacy Queue' ? t('dashboard.pharmacyQueuePending', { count: pendingRx }) : value}
                </span>
              </div>
            ))}
          </div>

          {/* AI engine status */}
          <div className="mt-5 p-4 rounded-xl border border-[rgba(238,107,38,0.15)] bg-[rgba(238,107,38,0.07)] flex items-start gap-3 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-[rgba(238,107,38,0.15)] flex-shrink-0">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-primary-dark)] mb-0.5">{t('dashboard.aiEngineActive')}</p>
              <p className="text-xs font-medium text-[var(--color-accent)]/70">
                {t('dashboard.aiEngineBody')}
              </p>
            </div>
          </div>

          {/* Anomaly alert */}
          {pendingRx > 3 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-4 rounded-xl border border-primary/20 bg-primary-soft flex items-start gap-3 shadow-sm"
            >
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm border border-primary/20 flex-shrink-0">
                <AlertTriangle className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-accent mb-0.5">{t('dashboard.pharmacyQueueAlert')}</p>
                <p className="text-xs font-medium text-accent/70">
                  {t('dashboard.pharmacyQueueAlertBody', { count: pendingRx })}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
        </Card>
      </div>

      {/* Phase 3 modals */}
      <SickCallModal open={showSickCall} onClose={() => setShowSickCall(false)} />
      <SwapRequestModal open={showSwap} onClose={() => setShowSwap(false)} />
    </div>
  )
}
