"use client"

import { useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import {
  ShieldCheck, Activity, FileText, ThumbsUp, ClipboardList, ArrowRight,
  ShieldAlert, AlertTriangle, Sparkles, Users,
} from "lucide-react"
import { useAuditStore, moduleOf, severityOf } from "@/store/useAuditStore"
import { NABH_CHAPTERS, buildNabhEvidence } from "@/lib/nabhEvidence"
import { cn } from "@/lib/utils"

export default function AuditDashboard() {
  const t = useTranslations('audit')
  const entries = useAuditStore(s => s.entries)

  const m = useMemo(() => {
    const total = entries.length
    const moduleCounts = new Map<string, number>()
    const sev = { info: 0, warning: 0, critical: 0 }
    const recent = entries.slice(0, 8)
    const usersSet = new Set<string>()
    for (const e of entries) {
      moduleCounts.set(moduleOf(e.action), (moduleCounts.get(moduleOf(e.action)) ?? 0) + 1)
      sev[severityOf(e.action)]++
      usersSet.add(e.userId)
    }
    const hitlTotal = entries.filter(e => e.action.startsWith('hitl_')).length
    const hitlAccept = entries.filter(e => e.action === 'hitl_accept').length
    const aiAcceptRate = hitlTotal ? Math.round((hitlAccept / hitlTotal) * 100) : 0
    const nabhEvidence = buildNabhEvidence(entries)
    const nabhReady = nabhEvidence.filter(c => c.ready).length
    return { total, moduleCounts, sev, recent, users: usersSet.size, aiAcceptRate, nabhEvidence, nabhReady, hitlTotal }
  }, [entries])

  const sortedModules = useMemo(() => Array.from(m.moduleCounts.entries()).sort((a, b) => b[1] - a[1]), [m])
  const maxModule = sortedModules[0]?.[1] ?? 1

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[var(--color-accent)]" />{t('dashboard.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/audit/log" className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.12)] px-3 py-2 rounded-xl"><FileText className="h-3.5 w-3.5" />{t('dashboard.openTrail')}</Link>
          <Link href="/audit/reports" className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] px-3 py-2 rounded-xl"><ClipboardList className="h-3.5 w-3.5" />{t('dashboard.reports')}</Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('dashboard.kpi.totalEvents'), value: m.total, icon: Activity, fg: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]' },
          { label: t('dashboard.kpi.criticalEvents'), value: m.sev.critical, icon: ShieldAlert, fg: 'text-red-600', bg: 'bg-red-50' },
          { label: t('dashboard.kpi.warningEvents'), value: m.sev.warning, icon: AlertTriangle, fg: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t('dashboard.kpi.aiAcceptRate'), value: `${m.aiAcceptRate}%`, icon: ThumbsUp, fg: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]' },
          { label: t('dashboard.kpi.activeActors'), value: m.users, icon: Users, fg: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('dashboard.kpi.nabhChaptersCovered'), value: `${m.nabhReady}/${NABH_CHAPTERS.length}`, icon: ShieldCheck, fg: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl p-3 flex items-center gap-3', s.bg)}>
            <div className="p-2 rounded-lg bg-white shadow-sm"><s.icon className={cn('h-4 w-4', s.fg)} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{s.label}</p>
              <h3 className="text-xl font-bold text-slate-900">{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--color-accent)]" />{t('dashboard.eventsByModule')}</h2>
            <div className="space-y-2">
              {sortedModules.map(([mod, count]) => (
                <div key={mod}>
                  <p className="text-xs text-slate-600 flex items-center justify-between"><span className="font-semibold">{mod}</span><b>{count}</b></p>
                  <div className="h-1.5 mt-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${(count / maxModule) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
                <h2 className="text-sm font-bold text-slate-800">{t('dashboard.nabhEvidenceLive')}</h2>
              </div>
              <Link href="/quality/nabh" className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">{t('dashboard.nabhCockpit')} <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="divide-y divide-slate-100">
              {m.nabhEvidence.map(c => (
                <div key={c.chapter} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded ring-1 flex-shrink-0',
                    c.ready ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-500 ring-slate-200')}>
                    {c.chapter}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                    <p className="text-[11px] text-slate-500">{t('dashboard.qualifyingActionTypes', { count: c.actions.length })}</p>
                  </div>
                  <span className={cn('text-[11px] font-bold flex-shrink-0',
                    c.ready ? 'text-emerald-700' : 'text-slate-400')}>
                    {c.count} {c.count === 1 ? t('event') : t('events')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{t('dashboard.latestEvents')}</h2>
              <Link href="/audit/log" className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">{t('dashboard.all')} <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="divide-y divide-slate-100">
              {m.recent.map(e => {
                const sev = severityOf(e.action)
                return (
                  <div key={e.id} className="px-4 py-2.5">
                    <p className="text-[12.5px] font-bold text-slate-800 flex items-center gap-1">
                      {sev !== 'info' && <span className={cn('h-1.5 w-1.5 rounded-full',
                        sev === 'critical' ? 'bg-red-500' : 'bg-amber-500')} />}
                      {e.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{e.detail ?? e.resource}</p>
                    <p className="text-[10px] text-slate-400">{e.userName} · {new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(238,107,38,0.20)] p-4" style={{ background: 'linear-gradient(135deg,rgba(238,107,38,0.25),rgba(238,107,38,0.25))' }}>
            <h2 className="text-sm font-bold flex items-center gap-2 mb-1 text-[var(--color-primary-dark)]"><Sparkles className="h-4 w-4 text-[var(--color-accent)]" />{t('dashboard.aiHitlSummary')}</h2>
            <p className="text-[12px] text-[var(--color-accent)]">{t('dashboard.hitlSummaryLine', { total: m.hitlTotal, rate: m.aiAcceptRate })}</p>
            <p className="text-[10px] text-slate-500 mt-1">{t('dashboard.hitlSummaryNote')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
