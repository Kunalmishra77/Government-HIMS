"use client"

import { useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown, BarChart3, PieChart, Sparkles, AlertTriangle, ShieldCheck, Activity, ArrowRight } from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { useAuditStore, moduleOf, severityOf } from "@/store/useAuditStore"
import { buildNabhEvidence, NABH_CHAPTERS } from "@/lib/nabhEvidence"
import { useTranslations } from "next-intl"

const OPD_VOLUME = [
  { date: 'May 4', General: 82, Cardiology: 34, Ortho: 21, Gynae: 18 },
  { date: 'May 5', General: 91, Cardiology: 41, Ortho: 28, Gynae: 22 },
  { date: 'May 6', General: 78, Cardiology: 38, Ortho: 19, Gynae: 17 },
  { date: 'May 7', General: 105, Cardiology: 45, Ortho: 32, Gynae: 25 },
  { date: 'May 8', General: 112, Cardiology: 52, Ortho: 29, Gynae: 30 },
  { date: 'May 9', General: 98, Cardiology: 48, Ortho: 26, Gynae: 28 },
  { date: 'May 10', General: 87, Cardiology: 39, Ortho: 23, Gynae: 21 },
]

const BED_OCCUPANCY = [
  { ward: 'General', occupied: 42, total: 50 },
  { ward: 'ICU', occupied: 14, total: 16 },
  { ward: 'Maternity', occupied: 18, total: 24 },
  { ward: 'Paediatric', occupied: 11, total: 20 },
  { ward: 'Ortho', occupied: 16, total: 20 },
  { ward: 'Cardiac', occupied: 9, total: 12 },
]

const PAYER_MIX = [
  { name: 'Cash / Self-Pay', value: 38, color: 'var(--color-primary-light)' },
  { name: 'Govt Scheme (AB-PMJAY)', value: 24, color: '#10B981' },
  { name: 'Corporate TPA', value: 20, color: 'var(--color-primary)' },
  { name: 'Star Health', value: 10, color: '#F59E0B' },
  { name: 'Other Insurers', value: 8, color: '#94A3B8' },
]

const REVENUE = [
  { month: 'Nov', opd: 820000, pharmacy: 340000 },
  { month: 'Dec', opd: 910000, pharmacy: 380000 },
  { month: 'Jan', opd: 780000, pharmacy: 290000 },
  { month: 'Feb', opd: 1050000, pharmacy: 420000 },
  { month: 'Mar', opd: 1120000, pharmacy: 460000 },
  { month: 'Apr', opd: 980000, pharmacy: 410000 },
  { month: 'May', opd: 124000, pharmacy: 56000 },
]
const maxRev = Math.max(...REVENUE.map(r => r.opd + r.pharmacy))

const DISEASE = [
  { disease: 'URTI / Respiratory', count: 312, pct: 38, color: 'bg-[var(--color-primary)]' },
  { disease: 'Gastro / GI Disorders', count: 178, pct: 22, color: 'bg-[rgba(238,107,38,0.07)]0' },
  { disease: 'Hypertension', count: 143, pct: 17, color: 'bg-[var(--color-primary)]' },
  { disease: 'Diabetes Follow-up', count: 112, pct: 14, color: 'bg-amber-500' },
  { disease: 'Orthopaedic', count: 73, pct: 9, color: 'bg-red-500' },
]

export default function AdminAnalytics() {
  const t = useTranslations('admin')
  const entries = useAuditStore(s => s.entries)

  // Cross-role operations snapshot built from the live audit trail.
  const ops = useMemo(() => {
    const sev = { info: 0, warning: 0, critical: 0 }
    const moduleCounts = new Map<string, number>()
    for (const e of entries) {
      sev[severityOf(e.action)]++
      const m = moduleOf(e.action)
      moduleCounts.set(m, (moduleCounts.get(m) ?? 0) + 1)
    }
    const sortedModules = Array.from(moduleCounts.entries()).sort((a, b) => b[1] - a[1])
    const nabh = buildNabhEvidence(entries)
    const ready = nabh.filter(c => c.ready).length
    const recentCritical = entries.filter(e => severityOf(e.action) === 'critical').slice(0, 3)
    return { sev, sortedModules, nabh, ready, recentCritical, total: entries.length }
  }, [entries])

  const maxModuleCount = ops.sortedModules[0]?.[1] ?? 1

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-lg font-bold">{t('analytics.title')}</h2>

      {/* Operations Snapshot — live from the audit trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-bold text-slate-900">{t('analytics.opsSnapshot')}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {t('analytics.liveFromAudit')}
              </span>
            </div>
            <Link href="/audit/dashboard" className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">
              {t('analytics.openAuditDashboard')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('analytics.events')}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{ops.total}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">{t('analytics.critical')}</p>
              <p className="text-xl font-black text-red-700 mt-0.5">{ops.sev.critical}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{t('analytics.warning')}</p>
              <p className="text-xl font-black text-amber-700 mt-0.5">{ops.sev.warning}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t('analytics.nabhChapters')}</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">{ops.ready}/{NABH_CHAPTERS.length}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('analytics.eventsByModule')}</p>
            {ops.sortedModules.slice(0, 8).map(([m, n]) => (
              <div key={m}>
                <p className="text-[11px] text-slate-600 flex items-center justify-between">
                  <span className="font-semibold">{m}</span><b>{n}</b>
                </p>
                <div className="h-1 mt-0.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${(n / maxModuleCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-slate-900">{t('analytics.criticalFollowups')}</h3>
          </div>
          {ops.recentCritical.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('analytics.noCriticalEvents')}</p>
          ) : (
            <div className="space-y-2">
              {ops.recentCritical.map(e => (
                <div key={e.id} className="rounded-lg border border-red-100 bg-red-50/40 p-2.5 text-[11px]">
                  <p className="font-bold text-red-700">{e.action.replace(/_/g, ' ')}</p>
                  <p className="text-slate-600 mt-0.5">{e.detail ?? e.resource}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{e.userName} · {moduleOf(e.action)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Weekly Narrative */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-surface-sunken p-5 border border-[rgba(238,107,38,0.15)]/60"
      >
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-sm font-bold text-slate-900">{t('analytics.weeklySummary')}</p>
              <span className="text-[10px] font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.12)] px-2 py-0.5 rounded-full uppercase tracking-wide">{t('analytics.weekOf')}</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {t.rich('analytics.weeklyNarrative', { b: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <div className="flex items-center gap-1.5 mt-3 p-2.5 bg-amber-50/80 rounded-lg border border-amber-100/60">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-800">{t('analytics.highAlert')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recharts: OPD Daily Volume — Line Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-1">{t('analytics.opdVolumeTitle')}</h3>
        <p className="text-xs text-slate-500 mb-4">{t('analytics.opdVolumeDates')}</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={OPD_VOLUME}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="General" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Cardiology" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Ortho" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Gynae" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recharts: Bed Occupancy — Bar Chart + Payer Mix — Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-1">{t('analytics.bedOccupancyTitle')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('analytics.currentSnapshot')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={BED_OCCUPANCY} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" domain={[0, 60]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis dataKey="ward" type="category" width={72} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="occupied" name={t('analytics.occupied')} fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="total" name={t('analytics.capacity')} fill="#E2E8F0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-bold text-slate-900 mb-1">{t('analytics.payerMix')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('analytics.payerMixSub')}</p>
          <ResponsiveContainer width="100%" height={220}>
            <RPieChart>
              <Pie data={PAYER_MIX} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false}>
                {PAYER_MIX.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, t('analytics.share')]} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RPieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-900">{t('analytics.revenueTrend')}</h3>
            <p className="text-xs text-slate-500">{t('analytics.revenueTrendSub')}</p>
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[var(--color-primary)] inline-block" />OPD</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[rgba(238,107,38,0.07)]0 inline-block" />{t('analytics.pharmacy')}</span>
          </div>
        </div>
        <div className="flex items-end gap-3 h-44">
          {REVENUE.map(({ month, opd, pharmacy }, i) => {
            const total = opd + pharmacy
            const opdH = (opd / maxRev) * 100
            const pharmH = (pharmacy / maxRev) * 100
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500">₹{(total/100000).toFixed(1)}L</span>
                <div className="w-full flex flex-col items-center" style={{ height: `${Math.max(opdH, 10)}%` }}>
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${pharmH}%` }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                    className="w-full bg-[rgba(238,107,38,0.07)]0 rounded-t-sm"
                    style={{ height: `${pharmH}%` }}
                  />
                  <motion.div
                    initial={{ height: 0 }} animate={{ height: `${opdH}%` }}
                    transition={{ delay: 0.15 + i * 0.05, duration: 0.5 }}
                    className="w-full bg-[var(--color-primary)] rounded-t-lg"
                    style={{ height: `${opdH}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{month}</span>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* Disease Pattern */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-1">{t('analytics.diseasePattern')}</h3>
        <p className="text-xs text-slate-500 mb-5">{t('analytics.diseasePatternSub')}</p>
        <div className="space-y-4">
          {DISEASE.map(({ disease, count, pct, color }, i) => (
            <div key={disease}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium text-slate-700">{disease}</span>
                <span className="text-slate-500 font-semibold">{t('analytics.cases', { count, pct })}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.2 + i * 0.07, duration: 0.6 }}
                  className={`h-full rounded-full ${color}`}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* KPI Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { labelKey: 'analytics.kpiMonthlyRevenue', value: '₹15.8L', trend: '+18%', up: true },
          { labelKey: 'analytics.kpiAvgWaitTime', value: '18 min', trend: '−44%', up: true },
          { labelKey: 'analytics.kpiSatisfaction', value: '4.7 / 5', trend: '+0.3', up: true },
          { labelKey: 'analytics.kpiRxViaSystem', value: '94%', trend: '+22%', up: true },
        ].map(({ labelKey, value, trend, up }, i) => (
          <motion.div
            key={labelKey}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">{t(labelKey)}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            <span className={`inline-flex items-center gap-1 text-xs font-semibold mt-1 ${up ? 'text-green-600' : 'text-red-600'}`}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {t('analytics.trendVsLastMonth', { trend })}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
