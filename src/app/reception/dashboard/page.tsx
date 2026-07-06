"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore, type TriageLevel } from "@/store/usePatientStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { useWhatsAppStore } from "@/store/useWhatsAppStore"
import {
  Users, Activity, Stethoscope, BedDouble, CreditCard, Calendar,
  UserPlus, ArrowRight, AlertTriangle, MessageSquare, Volume2, Clock, ChevronRight,
  Pill, CheckCircle2, Hourglass,
} from "lucide-react"
import { cn } from "@/lib/utils"

const TRIAGE_RANK: Record<TriageLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
const TRIAGE_TINT: Record<TriageLevel, string> = {
  Critical: 'bg-red-50 text-red-700',
  High: 'bg-primary-soft text-accent',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-green-50 text-green-700',
}
const CARD = "rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)]"
const ACTIVE_STATUSES = ['waiting', 'vitals', 'consulting', 'pharmacy', 'billing'] as const

export default function ReceptionDashboard() {
  const t = useTranslations('reception')
  const currentUser = useAuthStore(s => s.currentUser)
  const patients = usePatientStore(s => s.patients)
  const appointments = usePatientStore(s => s.appointments)
  const bills = useBillingStore(s => s.bills)
  const beds = useAdmissionStore(s => s.beds)
  const admissionRequests = useAdmissionStore(s => s.admissionRequests)
  const notifications = useNotificationStore(s => s.notifications)
  const threads = useWhatsAppStore(s => s.threads)

  // ── Derived metrics ────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const todayPatients = patients.filter(p => (p.registeredDate ?? today) === today)
  const inQueue = patients.filter(p => (ACTIVE_STATUSES as readonly string[]).includes(p.queueStatus))
  const waiting = patients.filter(p => p.queueStatus === 'waiting')
  const avgWait = waiting.length ? Math.round(waiting.reduce((s, p) => s + p.estimatedWait, 0) / waiting.length) : 0
  const nowServing = patients.find(p => p.queueStatus === 'consulting')

  // M13.4 — OPD pipeline counts (today only)
  const todayQueue = todayPatients
  const pipelineCounts = {
    waiting:    todayQueue.filter(p => p.queueStatus === 'waiting').length,
    vitals:     todayQueue.filter(p => p.queueStatus === 'vitals').length,
    consulting: todayQueue.filter(p => p.queueStatus === 'consulting').length,
    pharmacy:   todayQueue.filter(p => p.queueStatus === 'pharmacy').length,
    billing:    todayQueue.filter(p => p.queueStatus === 'billing').length,
    done:       todayQueue.filter(p => p.queueStatus === 'done').length,
  }

  const upNext = [...patients]
    .filter(p => p.queueStatus === 'waiting' || p.queueStatus === 'vitals')
    .sort((a, b) => (TRIAGE_RANK[a.triageLevel ?? 'Low'] - TRIAGE_RANK[b.triageLevel ?? 'Low']) || a.token - b.token)
    .slice(0, 5)

  const highPriorityWaiting = patients.filter(
    p => (p.triageLevel === 'Critical' || p.triageLevel === 'High') && (p.queueStatus === 'waiting' || p.queueStatus === 'vitals'),
  )

  const pendingBills = bills.filter(b => b.status !== 'settled')
  const totalDue = pendingBills.reduce((s, b) => s + Math.max(0, b.patientDue - b.paidAmount), 0)
  const freeBeds = beds.filter(b => b.status === 'Available').length
  const todayAppts = appointments.filter(a => a.date === today && a.status !== 'cancelled')
  const escalations = threads.filter(t => t.status === 'escalated' || t.escalatedToHuman)
  const criticalNotifs = notifications.filter(n => n.priority === 'critical' && !n.read)
  const pendingAdmissions = admissionRequests.filter(r => r.status === 'Pending')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening')
  const first = (currentUser?.name ?? 'there').split(' ')[0]
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const kpis = [
    { label: t('dashboard.kpiPatientsToday'), value: `${todayPatients.length}`, icon: Users, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', href: '/reception/patients' },
    { label: t('dashboard.kpiInQueue'), value: `${inQueue.length}`, sub: t('dashboard.kpiInQueueSub', { wait: avgWait }), icon: Activity, tint: 'bg-amber-50 text-amber-600', href: '/reception/opd' },
    { label: t('dashboard.kpiNowServing'), value: nowServing ? `#${nowServing.token}` : '—', sub: nowServing?.name, icon: Volume2, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', href: '/reception/queue' },
    { label: t('dashboard.kpiFreeBeds'), value: `${freeBeds}`, sub: t('dashboard.kpiFreeBedsSub', { total: beds.length }), icon: BedDouble, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', href: '/reception/beds' },
    { label: t('dashboard.kpiPendingBills'), value: `${pendingBills.length}`, sub: t('dashboard.kpiPendingBillsSub', { amount: totalDue.toLocaleString('en-IN') }), icon: CreditCard, tint: 'bg-rose-50 text-rose-600', href: '/reception/billing' },
    { label: t('dashboard.kpiAppointments'), value: `${todayAppts.length}`, sub: t('dashboard.kpiToday'), icon: Calendar, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', href: '/reception/appointments' },
  ]

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-amber-500">{greeting} · {dateLabel}</p>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('dashboard.headerTitle', { name: first })}</h1>
        </div>
        <Link href="/reception/opd" className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13.5px] font-bold shadow-sm active:scale-[0.98] transition">
          <UserPlus className="h-4 w-4" /> {t('dashboard.registerWalkIn')}
        </Link>
      </div>

      {/* M13.4 — OPD walk-in journey pipeline.
          Six chevron-linked stages mirroring how a walk-in patient moves through
          the hospital today: Waiting room → Vitals → Consulting → Pharmacy →
          Billing → Done. Each tile is a direct nav button to the right surface. */}
      <div className={cn(CARD, "p-4")}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />{t('dashboard.journeyTitle')}
          </h2>
          <p className="text-[11px] text-slate-500">
            {t('dashboard.journeySummary', { count: todayPatients.length, wait: avgWait })}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-stretch">
          {[
            { label: t('dashboard.stageWaiting'),    sub: t('dashboard.stageWaitingSub'),  count: pipelineCounts.waiting,    color: 'border-amber-200 bg-amber-50',     icon: Users,        fg: 'text-amber-700',    href: '/reception/opd',     cta: t('dashboard.ctaSendToVitals') },
            { label: t('dashboard.stageVitals'),     sub: t('dashboard.stageVitalsSub'),       count: pipelineCounts.vitals,     color: 'border-primary/20 bg-primary-soft',   icon: Activity,     fg: 'text-accent',   href: '/reception/opd',     cta: t('dashboard.ctaTrack') },
            { label: t('dashboard.stageConsulting'), sub: t('dashboard.stageConsultingSub'),      count: pipelineCounts.consulting, color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',   icon: Stethoscope,  fg: 'text-[var(--color-accent)]',   href: '/reception/queue',   cta: t('dashboard.ctaDisplayBoard') },
            { label: t('dashboard.stagePharmacy'),   sub: t('dashboard.stagePharmacySub'),    count: pipelineCounts.pharmacy,   color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',       icon: Pill,         fg: 'text-[var(--color-accent)]',     href: '/reception/opd',     cta: t('dashboard.ctaTrack') },
            { label: t('dashboard.stageBilling'),    sub: t('dashboard.stageBillingSub'),    count: pipelineCounts.billing,    color: 'border-rose-200 bg-rose-50',       icon: CreditCard,   fg: 'text-rose-700',     href: '/reception/billing', cta: t('dashboard.ctaCollect') },
            { label: t('dashboard.stageDone'),       sub: t('dashboard.stageDoneSub'),  count: pipelineCounts.done,       color: 'border-emerald-200 bg-emerald-50', icon: CheckCircle2, fg: 'text-emerald-700',  href: '/reception/patients',cta: t('dashboard.ctaReview') },
          ].map((s, i, arr) => (
            <Link key={s.label} href={s.href}
              className={cn("relative rounded-xl border p-3 hover:shadow-md transition flex flex-col gap-1 cursor-pointer group", s.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <s.icon className={cn("h-4 w-4 flex-shrink-0", s.fg)} />
                  <p className={cn("text-xs font-bold truncate", s.fg)}>{s.label}</p>
                </div>
                {i < arr.length - 1 && <ChevronRight className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 hidden lg:block" />}
              </div>
              <p className={cn("text-2xl font-bold leading-none", s.fg)}>{s.count}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
              <p className={cn("text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 group-hover:underline", s.fg)}>
                {s.cta} <ArrowRight className="h-2.5 w-2.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Link key={k.label} href={k.href} className={cn(CARD, "p-4 hover:shadow-md transition-shadow group")}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", k.tint)}><k.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[22px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{k.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{k.label}</p>
            {k.sub && <p className="text-[11px] text-slate-400 truncate">{k.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Left: needs attention + live queue */}
        <div className="lg:col-span-2 space-y-5">
          {/* Needs attention */}
          <div className={cn(CARD, "p-5")}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
              <h3 className="text-[15px] font-bold text-slate-900">{t('dashboard.needsAttention')}</h3>
            </div>
            <div className="space-y-2">
              {highPriorityWaiting.length === 0 && pendingBills.length === 0 && escalations.length === 0 && criticalNotifs.length === 0 && pendingAdmissions.length === 0 && (
                <p className="text-[13px] text-slate-400 bg-slate-50 rounded-xl p-3">{t('dashboard.allClear')}</p>
              )}
              {pendingAdmissions.map(r => (
                <AttnRow key={r.id} href="/reception/beds" tint="bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" icon={BedDouble}
                  title={t('dashboard.attnAdmissionTitle', { name: r.patientName })} sub={`${r.admissionType} · ${r.diagnosis}${r.triageLevel ? ` · ${r.triageLevel}` : ''}`} cta={t('dashboard.attnBeds')} />
              ))}
              {highPriorityWaiting.map(p => (
                <AttnRow key={p.id} href="/reception/opd" tint="bg-red-50 text-red-600" icon={AlertTriangle}
                  title={t('dashboard.attnHighPriorityTitle', { name: p.name, triage: p.triageLevel ?? '' })} sub={t('dashboard.attnTokenSymptom', { token: p.token, detail: p.symptoms[0] ?? p.department })} cta={t('dashboard.attnQueue')} />
              ))}
              {pendingBills.length > 0 && (
                <AttnRow href="/reception/billing" tint="bg-rose-50 text-rose-600" icon={CreditCard}
                  title={t('dashboard.attnBillsPending', { count: pendingBills.length })} sub={t('dashboard.attnBillsOutstanding', { amount: totalDue.toLocaleString('en-IN') })} cta={t('dashboard.attnBilling')} />
              )}
              {escalations.length > 0 && (
                <AttnRow href="/reception/messages" tint="bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" icon={MessageSquare}
                  title={t('dashboard.attnEscalatedChats', { count: escalations.length })} sub={escalations.map(e => e.patientName ?? e.patientPhone).join(', ')} cta={t('dashboard.attnMessages')} />
              )}
              {criticalNotifs.map(n => (
                <AttnRow key={n.id} href="/reception/messages" tint="bg-red-50 text-red-600" icon={AlertTriangle}
                  title={n.title} sub={n.body} cta={t('dashboard.attnView')} />
              ))}
            </div>
          </div>

          {/* Live queue snapshot */}
          <div className={cn(CARD, "p-5")}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-slate-900">{t('dashboard.liveQueue')}</h3>
              <Link href="/reception/opd" className="text-[12.5px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1">{t('dashboard.openBoard')} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>

            {/* Now serving */}
            <div className="rounded-2xl p-4 mb-3 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/70 mb-1"><Volume2 className="h-3.5 w-3.5" /> {t('dashboard.nowServing')}</div>
              {nowServing ? (
                <div className="flex items-center justify-between">
                  <div><p className="text-[18px] font-bold leading-tight">{nowServing.name}</p><p className="text-[12.5px] text-white/70">{nowServing.department} · {nowServing.doctor}</p></div>
                  <span className="text-[34px] font-black leading-none">#{nowServing.token}</span>
                </div>
              ) : <p className="text-[14px] font-semibold text-white/80">{t('dashboard.noConsultation')}</p>}
            </div>

            {/* Up next */}
            <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2">{t('dashboard.upNext')}</p>
            <div className="space-y-1.5">
              {upNext.length === 0 && <p className="text-[13px] text-slate-400">{t('dashboard.queueEmpty')}</p>}
              {upNext.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-700 flex-shrink-0">#{p.token}</span>
                  <div className="flex-1 min-w-0"><p className="text-[13.5px] font-semibold text-slate-900 truncate">{p.name}</p><p className="text-[11.5px] text-slate-500 truncate">{p.department} · {p.queueStatus === 'vitals' ? t('dashboard.inVitals') : t('dashboard.waiting')}</p></div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", TRIAGE_TINT[p.triageLevel ?? 'Low'])}>{p.triageLevel ?? 'Low'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: quick actions + appointments */}
        <div className="space-y-5">
          <div className={cn(CARD, "p-5")}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-3">{t('dashboard.quickActions')}</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: t('dashboard.qaRegisterWalkIn'), icon: UserPlus, href: '/reception/opd', tint: 'from-[var(--color-primary)] to-[var(--color-primary-dark)]' },
                { label: t('dashboard.qaNewAppointment'), icon: Calendar, href: '/reception/appointments', tint: 'from-[var(--color-primary)] to-[var(--color-primary-light)]' },
                { label: t('dashboard.qaOpdDisplay'), icon: Volume2, href: '/reception/queue', tint: 'from-amber-500 to-primary' },
                { label: t('dashboard.qaBedStatus'), icon: BedDouble, href: '/reception/beds', tint: 'from-[var(--color-primary)] to-[var(--color-primary-light)]' },
              ].map(a => (
                <Link key={a.label} href={a.href} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition active:scale-[0.97]">
                  <span className={cn("h-10 w-10 rounded-2xl bg-gradient-to-br flex items-center justify-center", a.tint)}><a.icon className="h-5 w-5 text-white" /></span>
                  <span className="text-[12px] font-semibold text-slate-700 text-center leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Today's appointments */}
          <div className={cn(CARD, "p-5")}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-bold text-slate-900">{t('dashboard.todaysAppointments')}</h3>
              <Link href="/reception/appointments" className="text-[12.5px] font-semibold text-[var(--color-accent)] flex items-center gap-1">{t('dashboard.allLink')} <ChevronRight className="h-3.5 w-3.5" /></Link>
            </div>
            {todayAppts.length === 0 ? (
              <p className="text-[13px] text-slate-400 bg-slate-50 rounded-xl p-3">{t('dashboard.noAppointmentsToday')}</p>
            ) : (
              <div className="space-y-2">
                {todayAppts.map(a => {
                  const pt = patients.find(p => p.id === a.patientId)
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                      <span className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><Clock className="h-4.5 w-4.5" /></span>
                      <div className="flex-1 min-w-0"><p className="text-[13.5px] font-semibold text-slate-900 truncate">{pt?.name ?? a.patientName ?? a.patientId}</p><p className="text-[11.5px] text-slate-500 truncate">{a.doctorName} · {a.specialty}</p></div>
                      <span className="text-[12px] font-bold text-slate-700 flex-shrink-0">{a.time}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AttnRow({ href, tint, icon: Icon, title, sub, cta }: {
  href: string; tint: string; icon: React.ElementType; title: string; sub?: string; cta: string
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition px-3 py-2.5">
      <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", tint)}><Icon className="h-4.5 w-4.5" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold text-slate-900 truncate">{title}</p>
        {sub && <p className="text-[11.5px] text-slate-500 truncate">{sub}</p>}
      </div>
      <span className="text-[12px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5 flex-shrink-0">{cta} <ArrowRight className="h-3.5 w-3.5" /></span>
    </Link>
  )
}
