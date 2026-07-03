"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ShieldCheck, Eye, FileText, Trash2, AlertTriangle, Search, Filter,
  Download, Lock, Sparkles, Users, ScanSearch,
} from "lucide-react"
import { useAuditStore, severityOf } from "@/store/useAuditStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { DpdpSelfAuditPanel } from "@/components/admin/DpdpSelfAuditPanel"
import { useTranslations } from "next-intl"

// All DISHA / DPDP action codes we surface here
const DISHA_ACTIONS = [
  'disha_record_accessed',
  'disha_consent_captured',
  'disha_consent_revoked',
  'disha_data_export',
  'disha_rtbf_requested',
  'disha_rtbf_fulfilled',
  'disha_breach_logged',
] as const

type DishaAction = typeof DISHA_ACTIONS[number]

const ACTION_LABEL: Record<DishaAction, string> = {
  disha_record_accessed:  'Patient record accessed',
  disha_consent_captured: 'Consent captured',
  disha_consent_revoked:  'Consent revoked',
  disha_data_export:      'Data export',
  disha_rtbf_requested:   'Right-to-Erasure requested',
  disha_rtbf_fulfilled:   'Right-to-Erasure fulfilled',
  disha_breach_logged:    'Breach logged',
}

const ACTION_ICON: Record<DishaAction, React.ElementType> = {
  disha_record_accessed:  Eye,
  disha_consent_captured: ShieldCheck,
  disha_consent_revoked:  AlertTriangle,
  disha_data_export:      Download,
  disha_rtbf_requested:   Trash2,
  disha_rtbf_fulfilled:   Trash2,
  disha_breach_logged:    AlertTriangle,
}

const ACTION_TINT: Record<DishaAction, string> = {
  disha_record_accessed:  'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  disha_consent_captured: 'bg-emerald-50 text-emerald-700',
  disha_consent_revoked:  'bg-amber-50 text-amber-700',
  disha_data_export:      'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  disha_rtbf_requested:   'bg-primary-soft text-accent',
  disha_rtbf_fulfilled:   'bg-emerald-50 text-emerald-700',
  disha_breach_logged:    'bg-red-50 text-red-700',
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function DishaPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const entries = useAuditStore(s => s.entries)
  const log = useAuditStore(s => s.log)
  const actionLabel = (a: DishaAction) => t.has(`disha.action.${a}`) ? t(`disha.action.${a}`) : ACTION_LABEL[a]

  const canAttest = canDo(currentUser?.role, 'compliance.attest')
  const actorName = currentUser?.name ?? 'Administrator'
  const { prompt, view: dialogView } = useDialogs()

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<DishaAction | 'all'>('all')

  // All DISHA entries
  const dishaEntries = useMemo(() => entries.filter(e => DISHA_ACTIONS.includes(e.action as DishaAction)),
    [entries])

  // KPI counts
  const kpis = useMemo(() => {
    const counts: Partial<Record<DishaAction, number>> = {}
    for (const e of dishaEntries) counts[e.action as DishaAction] = (counts[e.action as DishaAction] ?? 0) + 1
    return {
      access: counts.disha_record_accessed ?? 0,
      consentCaptured: counts.disha_consent_captured ?? 0,
      consentRevoked: counts.disha_consent_revoked ?? 0,
      rtbfOpen: (counts.disha_rtbf_requested ?? 0) - (counts.disha_rtbf_fulfilled ?? 0),
      breaches: counts.disha_breach_logged ?? 0,
    }
  }, [dishaEntries])

  const filtered = useMemo(() => {
    return dishaEntries.filter(e => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return e.userName.toLowerCase().includes(s) ||
          (e.resourceId ?? '').toLowerCase().includes(s) ||
          (e.detail ?? '').toLowerCase().includes(s)
      }
      return true
    })
  }, [dishaEntries, actionFilter, search])

  const logBreach = async () => {
    if (!canAttest) { toast.error(t('disha.noPermission')); return }
    const values = await prompt({
      title: t('disha.logBreachTitle'),
      body: t('disha.logBreachBody'),
      tone: 'danger',
      confirmLabel: t('disha.logBreach'),
      fields: [
        { id: 'summary', label: t('disha.breachSummary'), type: 'textarea',
          placeholder: t('disha.breachPlaceholder'),
          required: true },
      ],
    })
    if (!values) return
    log({
      userId: 'ADM-01', userName: actorName,
      action: 'disha_breach_logged',
      resource: 'breach', resourceId: `BRC-${Date.now()}`,
      detail: values.summary,
    })
    toast.error(t('disha.breachLogged'))
  }

  const exportRegister = () => {
    const header = ['Time', 'Actor', 'Action', 'Patient', 'Detail']
    const csv = [
      header.join(','),
      ...filtered.map(e => [
        fmt(e.timestamp), `"${e.userName}"`, e.action, e.resourceId ?? '', `"${(e.detail ?? '').replace(/"/g, "'")}"`,
      ].join(',')),
    ].join('\n')
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `disha-access-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('disha.exportedEvents', { count: filtered.length }))
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-6 w-6 text-rose-600" />{t('disha.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('disha.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportRegister}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            <Download className="h-3.5 w-3.5" />{t('disha.exportRegister')}
          </button>
          {canAttest && (
            <button onClick={logBreach}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer">
              <AlertTriangle className="h-3.5 w-3.5" />{t('disha.logBreach')}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {/* M4-W4 — S10: DPDP / DISHA Self-Audit Panel. Five-dimension live
          scorecard with HITL action per principle. */}
      <DpdpSelfAuditPanel />

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPI label={t('disha.kpiAccesses')} value={kpis.access} icon={Eye} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" />
        <KPI label={t('disha.kpiConsentsCaptured')} value={kpis.consentCaptured} icon={ShieldCheck} tint="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <KPI label={t('disha.kpiConsentsRevoked')} value={kpis.consentRevoked} icon={AlertTriangle} tint={kpis.consentRevoked > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('disha.kpiRtbfOpen')} value={kpis.rtbfOpen} icon={Trash2} tint={kpis.rtbfOpen > 0 ? "bg-primary-soft border-primary/20 text-accent" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('disha.kpiBreaches')} value={kpis.breaches} icon={ShieldCheck} tint={kpis.breaches > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"} />
      </div>

      {/* Breach notice if any */}
      {kpis.breaches > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            {t.rich('disha.breachNotice', { b: (chunks) => <b>{chunks}</b> })}
          </p>
        </div>
      )}

      {/* RTBF queue (open requests) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-accent" />{t('disha.rtbfRequestsOpen')}
        </h3>
        {(() => {
          // Open RTBFs = requested but not fulfilled
          const requested = dishaEntries.filter(e => e.action === 'disha_rtbf_requested')
          const fulfilled = new Set(dishaEntries.filter(e => e.action === 'disha_rtbf_fulfilled').map(e => e.resourceId))
          const open = requested.filter(r => !fulfilled.has(r.resourceId))
          if (open.length === 0) {
            return <p className="text-xs text-slate-400 italic py-3 text-center">{t('disha.noOpenRtbf')}</p>
          }
          return (
            <div className="space-y-1.5">
              {open.map(e => {
                const ageHours = Math.round((Date.now() - new Date(e.timestamp).getTime()) / 3600000)
                const ageDays = Math.round(ageHours / 24)
                const overdue = ageHours > 720  // 30-day SLA
                return (
                  <div key={e.id} className={cn('flex items-center justify-between gap-2 p-2 rounded-lg',
                    overdue ? 'bg-red-50 border border-red-200' : 'bg-primary-soft border border-primary/20')}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">{e.resourceId}</p>
                      <p className="text-[11px] text-slate-600 truncate">{e.detail}</p>
                      <p className={cn('text-[10px]', overdue ? 'text-red-700 font-bold' : 'text-accent')}>
                        {t('disha.daysOpen', { days: ageDays })} · {overdue ? t('disha.overdue30') : t('disha.daysToSla', { days: 30 - ageDays })}
                      </p>
                    </div>
                    {canAttest && (
                      <button onClick={() => {
                        log({
                          userId: 'ADM-01', userName: actorName,
                          action: 'disha_rtbf_fulfilled',
                          resource: 'patient_record', resourceId: e.resourceId,
                          detail: `Right-to-Erasure fulfilled · all PII purged from operational stores · ${e.resourceId}`,
                        })
                        toast.success(t('disha.rtbfFulfilledFor', { id: e.resourceId ?? "" }))
                      }}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                        {t('disha.fulfil')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('disha.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300" />
        </div>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as DishaAction | 'all')}
          className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-2 bg-white">
          <option value="all">{t('disha.allActions')}</option>
          {DISHA_ACTIONS.map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
        </Select>
      </div>

      {/* Access log */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['colTime', 'colAction', 'colActor', 'colPatient', 'colDetail'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t(`disha.${h}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                {t('disha.noMatch')}
              </td></tr>
            ) : filtered.map((e, i) => {
              const action = e.action as DishaAction
              const Icon = ACTION_ICON[action] ?? Eye
              const sev = severityOf(e.action)
              return (
                <motion.tr key={e.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                  className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">{fmt(e.timestamp)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', ACTION_TINT[action])}>
                      <Icon className="h-3 w-3" />{actionLabel(action)}
                    </span>
                    {sev !== 'info' && (
                      <span className={cn('ml-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                        sev === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{t.has(`disha.severity.${sev}`) ? t(`disha.severity.${sev}`) : sev}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-bold text-slate-800">{e.userName}</p>
                    <p className="text-[10px] text-slate-400">{e.userId}</p>
                  </td>
                  <td className="px-4 py-3 text-[11px] font-mono text-slate-600">{e.resourceId ?? '—'}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-700">{e.detail ?? '—'}</td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ScanSearch className="h-3 w-3" />{t('disha.footer', { shown: filtered.length, total: dishaEntries.length })}
      </p>
      {dialogView}
    </div>
  )
}

function KPI({ label, value, icon: Icon, tint }: { label: string; value: number; icon: React.ElementType; tint: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tint)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 opacity-80" />
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
    </div>
  )
}
