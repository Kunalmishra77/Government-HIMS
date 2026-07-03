"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Calendar, ShieldAlert, CheckCircle2, Clock, AlertTriangle, IndianRupee,
  Download, Search, Filter, FileText, Sparkles,
} from "lucide-react"
import {
  useStatutoryStore, STATUTORY_LABEL, STATUTORY_PERIODICITY, STATUTORY_AUTHORITY,
  type StatutoryType, type StatutoryStatus,
} from "@/store/useStatutoryStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { useTranslations } from "next-intl"

const STATUS_TINT: Record<StatutoryStatus, string> = {
  upcoming:  'bg-slate-50 border-slate-200 text-slate-600',
  due_soon:  'bg-amber-50 border-amber-200 text-amber-700',
  overdue:   'bg-red-50 border-red-200 text-red-700',
  filed:     'bg-emerald-50 border-emerald-200 text-emerald-700',
  exempted:  'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]',
}

const STATUS_LABEL: Record<StatutoryStatus, string> = {
  upcoming: 'Upcoming',
  due_soon: 'Due ≤7d',
  overdue:  'Overdue',
  filed:    'Filed',
  exempted: 'Exempted',
}

const TYPE_TINT: Record<StatutoryType, string> = {
  PF:            'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  ESI:           'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  GSTR1:         'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  GSTR3B:        'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  TDS:           'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  PT:            'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  TRADE_LICENCE: 'bg-emerald-100 text-emerald-800',
  POLLUTION:     'bg-green-100 text-green-800',
  DRUG_LICENCE:  'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)]',
  AERB:          'bg-accent-soft text-accent',
  BOILER:        'bg-amber-100 text-amber-800',
  LIFT:          'bg-yellow-100 text-yellow-800',
  IT_ADVANCE:    'bg-rose-100 text-rose-800',
  OTHER:         'bg-slate-100 text-slate-700',
}

const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const today = () => new Date().toISOString().split('T')[0]!
const daysUntil = (s: string) => Math.round((new Date(s + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000)

// Re-classify live (dates drift between sessions)
function liveStatus(entry: { status: StatutoryStatus; dueDate: string }): StatutoryStatus {
  if (entry.status === 'filed' || entry.status === 'exempted') return entry.status
  const d = daysUntil(entry.dueDate)
  if (d < 0) return 'overdue'
  if (d <= 7) return 'due_soon'
  return 'upcoming'
}

export default function StatutoryPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const entries = useStatutoryStore(s => s.entries)
  const statusLabel = (s: StatutoryStatus) => t.has(`statutory.status.${s}`) ? t(`statutory.status.${s}`) : STATUS_LABEL[s]
  const markFiled = useStatutoryStore(s => s.markFiled)
  const markExempted = useStatutoryStore(s => s.markExempted)

  const canWrite = canDo(currentUser?.role, 'compliance.attest')
  const actorName = currentUser?.name ?? 'Administrator'
  const { prompt, view: dialogView } = useDialogs()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<StatutoryType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatutoryStatus | 'all'>('all')

  // Re-classify status live
  const liveEntries = useMemo(() => entries.map(e => ({ ...e, status: liveStatus(e) })), [entries])

  const kpis = useMemo(() => {
    const counts: Record<StatutoryStatus, number> = { upcoming: 0, due_soon: 0, overdue: 0, filed: 0, exempted: 0 }
    for (const e of liveEntries) counts[e.status]++
    return counts
  }, [liveEntries])

  const types = useMemo(() => ['all', ...Array.from(new Set(entries.map(e => e.type)))], [entries])

  const filtered = useMemo(() => {
    return liveEntries.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (search) {
        const s = search.toLowerCase()
        return STATUTORY_LABEL[e.type].toLowerCase().includes(s) ||
          e.periodLabel.toLowerCase().includes(s) ||
          (e.ackNumber ?? '').toLowerCase().includes(s)
      }
      return true
    }).sort((a, b) => {
      // Overdue first, then due_soon, then upcoming, then filed/exempted by date
      const order: Record<StatutoryStatus, number> = { overdue: 0, due_soon: 1, upcoming: 2, exempted: 3, filed: 4 }
      const d = order[a.status] - order[b.status]
      if (d !== 0) return d
      return a.dueDate.localeCompare(b.dueDate)
    })
  }, [liveEntries, typeFilter, statusFilter, search])

  const upcoming14d = liveEntries.filter(e => e.status === 'upcoming' || e.status === 'due_soon')
    .filter(e => daysUntil(e.dueDate) <= 14).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8)
  const overdueEntries = liveEntries.filter(e => e.status === 'overdue')

  const totalAmountFiled = liveEntries.filter(e => e.status === 'filed' && e.amount).reduce((s, e) => s + (e.amount ?? 0), 0)

  const handleFile = async (id: string) => {
    if (!canWrite) { toast.error(t('statutory.noPermissionFile')); return }
    const values = await prompt({
      title: t('statutory.markFiledTitle'),
      body: t('statutory.markFiledBody'),
      confirmLabel: t('statutory.markFiled'),
      fields: [
        { id: 'ack',    label: t('statutory.ackNumber'), placeholder: 'GST-AB12345 / EPF-987...', required: true },
        { id: 'amount', label: t('statutory.filedAmount'),        placeholder: '0',  type: 'number', defaultValue: '0', required: true },
      ],
    })
    if (!values) return
    markFiled(id, values.ack, Number(values.amount ?? 0), actorName)
    toast.success(t('statutory.markedFiled', { ack: values.ack }))
  }

  const handleExempt = async (id: string) => {
    if (!canWrite) { toast.error(t('statutory.noPermission')); return }
    const values = await prompt({
      title: t('statutory.markExemptedTitle'),
      body: t('statutory.markExemptedBody'),
      tone: 'warn',
      confirmLabel: t('statutory.markExempted'),
      fields: [
        { id: 'reason', label: t('statutory.exemptReason'), type: 'textarea',
          placeholder: t('statutory.exemptPlaceholder'), required: true },
      ],
    })
    if (!values) return
    markExempted(id, values.reason, actorName)
    toast.success(t('statutory.markedExempted'))
  }

  const exportCSV = () => {
    const header = ['Type', 'Authority', 'Period', 'Due', 'Status', 'Filed Date', 'Ack #', 'Amount']
    const csv = [
      header.join(','),
      ...filtered.map(e => [
        STATUTORY_LABEL[e.type], STATUTORY_AUTHORITY[e.type],
        `"${e.periodLabel}"`, e.dueDate, e.status,
        e.filedDate ?? '', e.ackNumber ?? '', e.amount ?? '',
      ].join(',')),
    ].join('\n')
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `statutory-returns-${today()}.csv`; a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('statutory.exported', { count: filtered.length }))
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[var(--color-accent)]" />{t('statutory.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('statutory.subtitle')}
          </p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
          <Download className="h-3.5 w-3.5" />{t('statutory.exportCsv')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KPI label={t('statutory.kpiOverdue')} value={kpis.overdue} tint={kpis.overdue > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('statutory.kpiDueSoon')} value={kpis.due_soon} tint={kpis.due_soon > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('statutory.kpiUpcoming')} value={kpis.upcoming} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" />
        <KPI label={t('statutory.kpiFiledYtd')} value={kpis.filed} tint="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <KPI label={t('statutory.kpiFiledAmount')} value={`₹${(totalAmountFiled / 100000).toFixed(1)}L`} tint="bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" />
      </div>

      {/* Critical strip */}
      {overdueEntries.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 flex-1">
            {t.rich('statutory.overdueBanner', { count: overdueEntries.length, b: (chunks) => <b>{chunks}</b> })}{' '}
            {t('statutory.settleToday', { list: overdueEntries.slice(0, 3).map(e => STATUTORY_LABEL[e.type]).join(', ') })}
            {overdueEntries.length > 3 && t('statutory.andMore', { count: overdueEntries.length - 3 })}.
          </p>
        </div>
      )}

      {/* Upcoming next 14d */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-slate-800">{t('statutory.next14')}</h3>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('statutory.dueCount', { count: upcoming14d.length })}</span>
        </div>
        {upcoming14d.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-3 text-center">{t('statutory.noFilingsDue')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {upcoming14d.map(e => {
              const d = daysUntil(e.dueDate)
              return (
                <div key={e.id} className={cn('rounded-lg border p-3', STATUS_TINT[e.status])}>
                  <p className="text-[10px] font-bold uppercase tracking-wide">{STATUTORY_LABEL[e.type].split(' (')[0]}</p>
                  <p className="text-sm font-black tabular-nums mt-1">
                    {d === 0 ? t('statutory.today') : d > 0 ? `${d}d` : `−${Math.abs(d)}d`}
                  </p>
                  <p className="text-[10px] mt-0.5">{e.periodLabel}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('statutory.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as StatutoryType | 'all')}
          className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-2 bg-white">
          <option value="all">{t('statutory.allTypes')}</option>
          {Object.entries(STATUTORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatutoryStatus | 'all')}
          className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-2 bg-white">
          <option value="all">{t('statutory.allStatus')}</option>
          <option value="overdue">{t('statutory.status.overdue')}</option>
          <option value="due_soon">{t('statutory.filterDueSoon')}</option>
          <option value="upcoming">{t('statutory.status.upcoming')}</option>
          <option value="filed">{t('statutory.status.filed')}</option>
          <option value="exempted">{t('statutory.status.exempted')}</option>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['colType', 'colAuthority', 'colPeriod', 'colDue', 'colStatus', 'colFiledAck', 'colAction'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t(`statutory.${h}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400 italic">{t('statutory.noMatch')}</td></tr>
            ) : filtered.map((e, i) => {
              const d = daysUntil(e.dueDate)
              return (
                <motion.tr key={e.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.005 }}
                  className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded', TYPE_TINT[e.type])}>
                      {STATUTORY_LABEL[e.type]}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{STATUTORY_PERIODICITY[e.type]}</p>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-600">{STATUTORY_AUTHORITY[e.type]}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{e.periodLabel}</td>
                  <td className="px-4 py-3 text-xs">
                    <p className="text-slate-700">{fmtDate(e.dueDate)}</p>
                    {e.status !== 'filed' && e.status !== 'exempted' && (
                      <p className={cn('text-[10px]',
                        e.status === 'overdue' ? 'text-red-600 font-bold' :
                        e.status === 'due_soon' ? 'text-amber-600 font-bold' : 'text-slate-400')}>
                        {d >= 0 ? t('statutory.daysLeft', { days: d }) : t('statutory.daysOverdue', { days: Math.abs(d) })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ring-1', STATUS_TINT[e.status])}>
                      {statusLabel(e.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px]">
                    {e.filedDate ? (
                      <>
                        <p className="text-emerald-700">{fmtDate(e.filedDate)}</p>
                        {e.ackNumber && <p className="text-slate-500 font-mono text-[10px]">{e.ackNumber}</p>}
                        {e.amount ? <p className="text-slate-700 tabular-nums">₹{e.amount.toLocaleString('en-IN')}</p> : null}
                      </>
                    ) : (
                      <span className="text-slate-300 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && e.status !== 'filed' && e.status !== 'exempted' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleFile(e.id)}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                          {t('statutory.file')}
                        </button>
                        <button onClick={() => handleExempt(e.id)}
                          className="text-[10px] font-bold px-2 py-1 rounded text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] cursor-pointer">
                          {t('statutory.exempt')}
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        {t('statutory.footer', { shown: filtered.length, total: entries.length, filed: kpis.filed })}
      </p>
      {dialogView}
    </div>
  )
}

function KPI({ label, value, tint }: { label: string; value: string | number; tint: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tint)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
    </div>
  )
}
