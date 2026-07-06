"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Clock, Activity, ShieldCheck, IndianRupee, RefreshCw, TimerReset, Gauge,
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
} from "recharts"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"
import { type Modality } from "@/lib/radiologyCatalog"
import { minsElapsed, effectiveTAT, isTatBreached, ACTIVE_STATUSES } from "@/lib/radiologyAI"
import { StatCard } from "@/components/ui/stat-card"
import { ClientOnly } from "@/components/ClientOnly"
import { cn } from "@/lib/utils"

const MODS: Modality[] = ["XR", "CT", "MRI", "US", "MAMMO"]
const REVENUE_PER: Record<Modality, number> = { XR: 600, CT: 4500, MRI: 7500, US: 1200, MAMMO: 2000, NM: 6000 }
const PERIODS = ["Today", "This week", "This month"] as const

const PERIOD_KEY: Record<typeof PERIODS[number], string> = {
  Today: "analytics.periodToday",
  "This week": "analytics.periodWeek",
  "This month": "analytics.periodMonth",
}

export default function RadiologyAnalytics() {
  const t = useTranslations("radiology")
  const studies = useRadiologyStudiesStore(s => s.studies)
  const [period, setPeriod] = useState<typeof PERIODS[number]>("Today")

  const m = useMemo(() => {
    const released = studies.filter(s => s.status === "released" || s.status === "verified")
    const cancelled = studies.filter(s => s.status === "cancelled")
    const active = studies.filter(s => ACTIVE_STATUSES.has(s.status))
    const breaches = studies.filter(isTatBreached)

    // Avg TAT (released): ordered → released minutes
    const tats = released.filter(s => s.releasedAt).map(s => minsElapsed(s.orderedAt) - 0).filter(n => n > 0)
    const avgTAT = tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : 0

    // Critical response time (callback logged): proxy via studies with callback
    const withCallback = studies.filter(s => s.callback)
    const critResp = withCallback.length ? 14 : 0 // simulated mean minutes

    const byModality = MODS.map(mod => {
      const all = studies.filter(s => s.modality === mod)
      const util = Math.min(100, Math.round((all.filter(s => ACTIVE_STATUSES.has(s.status)).length / Math.max(1, all.length)) * 100) + 40)
      const revenue = all.length * REVENUE_PER[mod]
      return { modality: mod, count: all.length, util, revenue }
    })

    // Radiologist productivity (reports read)
    const prodMap: Record<string, number> = {}
    studies.forEach(s => { if (s.readingBy) prodMap[s.readingBy.name] = (prodMap[s.readingBy.name] ?? 0) + 1 })
    const productivity = Object.entries(prodMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

    const repeatRate = studies.length ? Math.round((studies.filter(s => s.comparisonPriorId).length / studies.length) * 100) : 0
    const rejectionRate = studies.length ? Math.round((cancelled.length / studies.length) * 100) : 0
    const revenueTotal = byModality.reduce((n, x) => n + x.revenue, 0)
    const revenuePerStudy = studies.length ? Math.round(revenueTotal / studies.length) : 0
    const avgWait = active.length ? Math.round(active.reduce((n, s) => n + (s.arrivedAt ? minsElapsed(s.arrivedAt) : 0), 0) / active.length) : 0

    // Synthetic 7-point TAT trend
    const tatTrend = Array.from({ length: 7 }, (_, i) => ({
      day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
      tat: Math.max(20, avgTAT + Math.round(Math.sin(i) * 12) + (i % 2 ? 6 : -4)),
      target: 60,
    }))

    return {
      avgTAT, critResp, byModality, productivity, repeatRate, rejectionRate,
      revenueTotal, revenuePerStudy, avgWait, breaches: breaches.length, released: released.length, tatTrend,
      accuracy: 96, // simulated report-accuracy (AI vs final concordance)
    }
  }, [studies])

  const fmtINR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}k`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="t-body text-foreground-lighter">
          {t("analytics.subtitle")}
        </p>
        <div className="inline-flex gap-1 p-1 rounded-full bg-surface-sunken border border-border">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors cursor-pointer", period === p ? "bg-surface text-foreground shadow-xs" : "text-foreground-lighter hover:text-foreground")}>
              {t(PERIOD_KEY[p])}
            </button>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("analytics.kpiAvgTat")} value={`${m.avgTAT}m`} sub={t("analytics.kpiAvgTatSub", { count: m.released })} icon={Clock} color="blue" />
        <StatCard label={t("analytics.kpiCriticalResponse")} value={`${m.critResp}m`} sub={t("analytics.kpiCriticalResponseSub")} icon={TimerReset} color="red" />
        <StatCard label={t("analytics.kpiReportAccuracy")} value={`${m.accuracy}%`} sub={t("analytics.kpiReportAccuracySub")} icon={ShieldCheck} color="green" />
        <StatCard label={t("analytics.kpiTatBreaches")} value={m.breaches} sub={t("analytics.kpiTatBreachesSub")} icon={Gauge} color="amber" />
        <StatCard label={t("analytics.kpiRevenuePerStudy")} value={fmtINR(m.revenuePerStudy)} sub={t("analytics.kpiRevenuePerStudySub", { total: fmtINR(m.revenueTotal) })} icon={IndianRupee} color="green" />
        <StatCard label={t("analytics.kpiRepeatScan")} value={`${m.repeatRate}%`} sub={t("analytics.kpiRepeatScanSub")} icon={RefreshCw} color="blue" />
        <StatCard label={t("analytics.kpiRejection")} value={`${m.rejectionRate}%`} sub={t("analytics.kpiRejectionSub")} icon={Activity} color="amber" />
        <StatCard label={t("analytics.kpiPatientWait")} value={`${m.avgWait}m`} sub={t("analytics.kpiPatientWaitSub")} icon={Clock} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* TAT trend */}
        <div className="lg:col-span-2 hms-card p-5">
          <h3 className="t-title text-foreground mb-3">{t("analytics.tatTrendTitle")}</h3>
          <ClientOnly fallback={<div className="h-[240px]" />}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={m.tatTrend} margin={{ top: 6, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="tat" name={t("analytics.seriesActualTat")} stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="target" name={t("analytics.seriesTarget")} stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>

        {/* Radiologist productivity */}
        <div className="hms-card p-5">
          <h3 className="t-title text-foreground mb-3">{t("analytics.productivityTitle")}</h3>
          {m.productivity.length === 0 ? <p className="text-sm text-foreground-placeholder">{t("analytics.noReads")}</p> : (
            <div className="space-y-3">
              {m.productivity.map(r => {
                const max = m.productivity[0].count || 1
                return (
                  <div key={r.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="font-semibold text-foreground-muted truncate">{r.name}</span>
                      <span className="tabular-nums text-foreground-lighter">{r.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modality utilization */}
        <div className="hms-card p-5">
          <h3 className="t-title text-foreground mb-3">{t("analytics.modalityUtilTitle")}</h3>
          <ClientOnly fallback={<div className="h-[200px]" />}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={m.byModality} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="modality" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="util" radius={[4, 4, 0, 0]}>
                  {m.byModality.map((x, i) => <Cell key={i} fill={x.util > 85 ? "var(--color-primary-dark)" : "var(--color-primary)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>

        {/* Revenue by modality */}
        <div className="lg:col-span-2 hms-card p-5">
          <h3 className="t-title text-foreground mb-3">{t("analytics.revenueByModalityTitle")}</h3>
          <ClientOnly fallback={<div className="h-[200px]" />}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={m.byModality} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="modality" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtINR(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} fill="#16A34A" />
              </BarChart>
            </ResponsiveContainer>
          </ClientOnly>
        </div>
      </div>
    </div>
  )
}
