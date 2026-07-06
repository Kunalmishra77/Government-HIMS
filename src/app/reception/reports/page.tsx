"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { useTranslations } from "next-intl"
import { usePatientStore, type TriageLevel } from "@/store/usePatientStore"
import { useBillingStore } from "@/store/useBillingStore"
import { Users, UserPlus, Wallet, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

const TRIAGE_COLOR: Record<TriageLevel, string> = { Critical: '#ef4444', High: '#EE6B26', Medium: '#f59e0b', Low: '#22c55e' }
const CARD = "rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)]"

export default function ReceptionReports() {
  const t = useTranslations('reception')
  const patients = usePatientStore(s => s.patients)
  const appointments = usePatientStore(s => s.appointments)
  const bills = useBillingStore(s => s.bills)

  const collected = bills.reduce((s, b) => s + b.paidAmount, 0)
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayPatients = patients.filter(p => (p.registeredDate ?? todayISO) === todayISO)
  const apptsToday = appointments.filter(a => a.date === todayISO && a.status !== 'cancelled').length
  // "In queue" = doctor-facing queue only (matches the store's own queue slice).
  const inQueue = patients.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)).length

  // Registrations by department (today)
  const byDept = Object.entries(todayPatients.reduce<Record<string, number>>((acc, p) => {
    acc[p.department] = (acc[p.department] ?? 0) + 1; return acc
  }, {})).map(([name, value]) => ({ name: name.replace('General ', 'Gen. '), value }))

  // Triage distribution (today)
  const triageOrder: TriageLevel[] = ['Critical', 'High', 'Medium', 'Low']
  const byTriage = triageOrder.map(t => ({ level: t, count: todayPatients.filter(p => (p.triageLevel ?? 'Low') === t).length }))
  const maxTriage = Math.max(1, ...byTriage.map(t => t.count))

  const tiles = [
    { label: t('reports.tileRegistrationsToday'), value: todayPatients.length, icon: Users, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('reports.tileAppointmentsToday'), value: apptsToday, icon: UserPlus, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('reports.tileInQueueNow'), value: inQueue, icon: Activity, tint: 'bg-amber-50 text-amber-600' },
    { label: t('reports.tileCollectedToday'), value: `₹${collected.toLocaleString('en-IN')}`, icon: Wallet, tint: 'bg-green-50 text-green-600' },
  ]

  return (
    <div className="pb-6">
      <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('reports.title')}</h1>
      <p className="text-[13px] text-slate-500 mt-0.5 mb-4">{t('reports.subtitle')}</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {tiles.map(t => (
          <div key={t.label} className={cn(CARD, "p-4")}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.tint)}><t.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[20px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{t.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Registrations by department */}
        <div className={cn(CARD, "p-5")}>
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">{t('reports.registrationsByDept')}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(238,107,38,0.25)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#16324A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Triage distribution */}
        <div className={cn(CARD, "p-5")}>
          <h3 className="text-[15px] font-bold text-slate-900 mb-4">{t('reports.triageDistribution')}</h3>
          <div className="space-y-3">
            {byTriage.map(t => (
              <div key={t.level}>
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span className="font-semibold text-slate-700">{t.level}</span>
                  <span className="font-bold text-slate-900 tabular-nums">{t.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(t.count / maxTriage) * 100}%`, background: TRIAGE_COLOR[t.level] }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-slate-400 mt-4">{t('reports.triageSnapshot')}</p>
        </div>
      </div>
    </div>
  )
}
