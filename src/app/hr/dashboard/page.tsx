"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Users, CalendarDays, Clock, Workflow, Award, UserPlus, ArrowRight, AlertTriangle } from "lucide-react"
import { useHRStore } from "@/store/useHRStore"
import { useHrmsStore } from "@/store/useHrmsStore"
import { cn } from "@/lib/utils"

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function HrDashboard() {
  const t = useTranslations('hr')
  const staff = useHRStore(s => s.staff)
  const leaveRequests = useHRStore(s => s.leaveRequests)
  const { attendance, openings, applicants, onboarding, reviews } = useHrmsStore()

  const activeStaff = staff.filter(s => s.status === 'active')
  const pendingLeave = leaveRequests.filter(l => l.status === 'Pending')
  const todaysAtt = attendance.filter(a => a.date === todayISO())
  const onLeaveToday = todaysAtt.filter(a => a.status === 'leave').length
  const presentToday = todaysAtt.filter(a => a.status === 'present' || a.status === 'late').length
  const attendancePct = activeStaff.length ? Math.round((presentToday / activeStaff.length) * 100) : 0
  const openPositions = openings.filter(o => o.status === 'Open').reduce((n, o) => n + o.openings, 0)
  const inPipeline = applicants.filter(a => a.stage !== 'Hired' && a.stage !== 'Rejected').length
  const onboardingActive = onboarding.filter(o => o.tasks.some(t => !t.done)).length
  const reviewsPending = reviews.filter(r => r.status !== 'acknowledged').length

  const kpis = [
    { label: t('dashboard.kpiEmployees'), value: activeStaff.length, sub: t('dashboard.kpiEmployeesSub', { count: staff.length }), icon: Users, fg: 'text-[var(--color-accent)]', chip: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]', href: '/hr/employees' },
    { label: t('dashboard.kpiPendingLeave'), value: pendingLeave.length, sub: t('dashboard.kpiPendingLeaveSub'), icon: CalendarDays, fg: 'text-amber-700', chip: 'bg-amber-100 text-amber-600', href: '/hr/leave' },
    { label: t('dashboard.kpiAttendanceToday'), value: `${attendancePct}%`, sub: t('dashboard.kpiAttendanceTodaySub', { present: presentToday, total: activeStaff.length, onLeave: onLeaveToday }), icon: Clock, fg: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-600', href: '/hr/attendance' },
    { label: t('dashboard.kpiOpenPositions'), value: openPositions, sub: t('dashboard.kpiOpenPositionsSub', { count: inPipeline }), icon: Workflow, fg: 'text-[var(--color-accent)]', chip: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]', href: '/hr/recruitment' },
    { label: t('dashboard.kpiOnboarding'), value: onboardingActive, sub: t('dashboard.kpiOnboardingSub'), icon: UserPlus, fg: 'text-accent', chip: 'bg-accent-soft text-accent', href: '/hr/onboarding' },
    { label: t('dashboard.kpiAppraisals'), value: reviewsPending, sub: t('dashboard.kpiAppraisalsSub'), icon: Award, fg: 'text-rose-700', chip: 'bg-rose-100 text-rose-600', href: '/hr/appraisals' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('dashboard.subtitle', { depts: new Set(staff.map(s => s.department)).size, count: staff.length })}</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => (
          <Link key={k.label} href={k.href}
            className={cn("group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md cursor-pointer")}>
            <div className="flex items-center justify-between">
              <span className={cn("grid place-items-center h-10 w-10 rounded-xl", k.chip)}>
                <k.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className={cn("text-3xl font-bold tabular-nums leading-none", k.fg)}>{k.value}</span>
            </div>
            <p className="mt-3 text-sm font-bold text-slate-800 flex items-center gap-1">{k.label} <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" /></p>
            <p className="text-[11px] text-slate-500">{k.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending leave approvals */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-amber-600" /> {t('dashboard.pendingLeaveApprovals')}</h2>
            <Link href="/hr/leave" className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)]">{t('common.open')}</Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {pendingLeave.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t('dashboard.noPendingLeave')}</p>}
            {pendingLeave.slice(0, 6).map(l => (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{l.staffName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{l.department} · {l.fromDate} → {l.toDate} · {l.reason}</p>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700 whitespace-nowrap">{t('leaveStatus.Pending')}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recruitment pipeline */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Workflow className="h-4 w-4 text-[var(--color-accent)]" /> {t('dashboard.recruitmentPipeline')}</h2>
            <Link href="/hr/recruitment" className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)]">{t('common.open')}</Link>
          </div>
          <div className="p-5 grid grid-cols-3 gap-2">
            {(['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'] as const).map(stage => (
              <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-slate-800">{applicants.filter(a => a.stage === stage).length}</p>
                <p className="text-[10.5px] font-semibold text-slate-500 mt-0.5">{t(`stage.${stage}`)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Expiring credentials nudge (reuses HR store) */}
      <ExpiringCredentials />
    </div>
  )
}

function ExpiringCredentials() {
  const t = useTranslations('hr')
  const getExpiringCredentials = useHRStore(s => s.getExpiringCredentials)
  const expiring = getExpiringCredentials(60)
  if (expiring.length === 0) return null
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <h2 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4" /> {t('dashboard.credentialsExpiring', { count: expiring.length })}
      </h2>
      <div className="flex flex-wrap gap-2">
        {expiring.slice(0, 8).map(({ staff, credential, daysUntilExpiry }, i) => (
          <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-800">
            {staff.name} · {credential.type} · {daysUntilExpiry}d
          </span>
        ))}
      </div>
    </section>
  )
}
