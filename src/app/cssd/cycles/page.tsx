"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import {
  Beaker, Play, CheckCircle2, XCircle, ShieldAlert, Clock, ChevronDown, ChevronRight,
  AlertTriangle, ScanLine,
} from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { useCSSDStore, type SterilizationMethod } from "@/store/useCSSDStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

const METHOD_TINT: Record<SterilizationMethod, string> = {
  Autoclave: 'bg-rose-50 text-rose-700 ring-rose-200',
  ETO:       'bg-amber-50 text-amber-700 ring-amber-200',
  Plasma:    'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25',
  Chemical:  'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25',
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const minsSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))

export default function CSSDCyclesPage() {
  const t             = useTranslations("cssd.cycles")
  const currentUser   = useAuthStore(s => s.currentUser)
  const cycles        = useCSSDStore(s => s.cycles)
  const instruments   = useCSSDStore(s => s.instruments)
  const startCycle    = useCSSDStore(s => s.startCycle)
  const completeCycle = useCSSDStore(s => s.completeCycle)
  const updateBI      = useCSSDStore(s => s.updateBiologicalIndicator)

  const [tab, setTab]       = useState<'queue' | 'running' | 'completed'>('queue')
  const [open, setOpen]     = useState<string | null>(null)
  const [method, setMethod] = useState<SterilizationMethod>('Autoclave')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const dirty = useMemo(() => instruments.filter(i => i.status === 'dirty' || i.status === 'clean'), [instruments])
  const running = useMemo(() => cycles.filter(c => c.status === 'running'), [cycles])
  const completed = useMemo(() =>
    cycles.filter(c => c.status === 'passed' || c.status === 'failed')
      .sort((a, b) => new Date(b.completedAt ?? b.startedAt).getTime() - new Date(a.completedAt ?? a.startedAt).getTime()),
    [cycles],
  )

  const togglePick = (id: string) => {
    setPicked(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const onStart = () => {
    if (picked.size === 0) {
      toast.error(t('toastPickInstrument'))
      return
    }
    const id = startCycle({
      method,
      instrumentIds: Array.from(picked),
      operatorId: currentUser?.id ?? 'CS-1301',
      operatorName: currentUser?.name ?? 'CSSD Tech',
    })
    setPicked(new Set())
    setTab('running')
    setOpen(id)
    toast.success(t('toastStarted', { method, count: picked.size }))
  }

  const onPass = (cycleId: string) => {
    const cyc = cycles.find(c => c.id === cycleId)
    completeCycle(cycleId, { biPass: true, chemPass: true })
    if (cyc) {
      notifyAndAudit({
        to: 'ot', type: 'system', priority: 'medium',
        title: t('notifyPassedTitle', { batch: cyc.batchNumber }),
        body: t('notifyPassedBody', { method: cyc.method, batch: cyc.batchNumber, count: cyc.instrumentIds.length }),
        audit: { action: 'cssd_cycle_passed', resource: 'sterilization_cycle', resourceId: cyc.batchNumber, detail: t('notifyPassedDetail'), userName: 'CSSD' },
      })
    }
    toast.success(t('toastPassed'))
  }
  const onFail = (cycleId: string, reason: 'BI' | 'CHEM') => {
    const cyc = cycles.find(c => c.id === cycleId)
    if (reason === 'BI') {
      completeCycle(cycleId, { biPass: false, chemPass: true, note: t('biNegativeNote') })
      if (cyc) {
        notifyAndAuditMany(['admin', 'quality', 'ot'], {
          type: 'system', priority: 'critical',
          title: t('notifyFailedTitle', { batch: cyc.batchNumber }),
          body: t('notifyFailedBiBody', { method: cyc.method, count: cyc.instrumentIds.length }),
          audit: { action: 'cssd_cycle_failed', resource: 'sterilization_cycle', resourceId: cyc.batchNumber, detail: t('notifyFailedBiDetail'), userName: 'CSSD' },
        })
      }
      toast.error(t('toastFailedBi'))
    } else {
      completeCycle(cycleId, { biPass: true, chemPass: false, note: t('chemFailureNote') })
      if (cyc) {
        notifyAndAuditMany(['admin', 'ot'], {
          type: 'system', priority: 'high',
          title: t('notifyFailedTitle', { batch: cyc.batchNumber }),
          body: t('notifyFailedChemBody', { method: cyc.method }),
          audit: { action: 'cssd_cycle_failed', resource: 'sterilization_cycle', resourceId: cyc.batchNumber, detail: t('notifyFailedChemDetail'), userName: 'CSSD' },
        })
      }
      toast.error(t('toastFailedChem'))
    }
  }
  const onDelayedBI = (cycleId: string, pass: boolean) => {
    updateBI(cycleId, pass)
    if (pass) toast.success(t('toastDelayedBiPass'))
    else toast.error(t('toastDelayedBiFail'))
  }

  return (
    <div className="space-y-5 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Beaker className="h-6 w-6 text-[var(--color-accent)]" />{t('title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 w-fit">
        {(['queue', 'running', 'completed'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer',
              tab === tabKey ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {tabKey === 'queue' ? t('tabQueue') : tabKey === 'running' ? t('tabRunning') : t('tabCompleted')} <span className="text-slate-400">
              {tabKey === 'queue' ? dirty.length : tabKey === 'running' ? running.length : completed.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-bold text-slate-800">{t('pickAndStart')}</p>
            <div className="flex items-center gap-2">
              <Select value={method} onChange={(e) => setMethod(e.target.value as SterilizationMethod)}
                className="text-xs font-bold border border-slate-300 rounded-lg px-2 py-1.5">
                {(['Autoclave', 'ETO', 'Plasma', 'Chemical'] as const).map(m => <option key={m}>{m}</option>)}
              </Select>
              <button onClick={onStart}
                disabled={picked.size === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Play className="h-3.5 w-3.5" />{t('startCycle', { count: picked.size })}
              </button>
            </div>
          </div>
          {dirty.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">{t('emptyQueue')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dirty.map(i => {
                const isPicked = picked.has(i.id)
                return (
                  <button key={i.id} onClick={() => togglePick(i.id)}
                    className={cn("flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer text-left",
                      isPicked ? "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]" : "bg-white border-slate-200 hover:border-slate-300")}>
                    <span className={cn("h-3.5 w-3.5 rounded border flex-shrink-0",
                      isPicked ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "bg-white border-slate-300")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{i.name}</p>
                      <p className="text-[11px] text-slate-500">{t('instrumentMeta', { category: i.category, quantity: i.quantity, status: t.has(`instStatus.${i.status}`) ? t(`instStatus.${i.status}`) : i.status })}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'running' && (
        <div className="space-y-3">
          {running.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">{t('noCyclesRunning')}</p>
            </div>
          ) : running.map(c => {
            const isOpen = open === c.id
            const items = c.instrumentIds.map(id => instruments.find(i => i.id === id)).filter(Boolean) as typeof instruments
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : c.id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded ring-1", METHOD_TINT[c.method])}>{c.method}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {c.batchNumber}
                      <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{t('runningBadge')}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {c.operatorName
                        ? t('runningMetaOperator', { count: items.length, time: fmt(c.startedAt), mins: minsSince(c.startedAt), operator: c.operatorName })
                        : t('runningMeta', { count: items.length, time: fmt(c.startedAt), mins: minsSince(c.startedAt) })}
                    </p>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{t('loadedInstruments')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {items.map(i => (
                          <div key={i.id} className="rounded-lg bg-white border border-slate-200 p-2 text-xs">
                            <p className="font-bold text-slate-800">{i.name}</p>
                            <p className="text-[10px] text-slate-500">{t('loadedItemMeta', { category: i.category, quantity: i.quantity })}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => onPass(c.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                        <CheckCircle2 className="h-3.5 w-3.5" />{t('markPassed')}
                      </button>
                      <button onClick={() => onFail(c.id, 'CHEM')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer">
                        <XCircle className="h-3.5 w-3.5" />{t('failChemical')}
                      </button>
                      <button onClick={() => onFail(c.id, 'BI')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer">
                        <ShieldAlert className="h-3.5 w-3.5" />{t('failBi')}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {tab === 'completed' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[t('colBatch'), t('colMethod'), t('colStarted'), t('colCompleted'), t('colBi'), t('colChem'), t('colStatus'), t('colAction')].map(h =>
                  <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completed.map(c => (
                <tr key={c.id} className={cn("hover:bg-slate-50", c.status === 'failed' && 'bg-red-50/30')}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{c.batchNumber}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded ring-1", METHOD_TINT[c.method])}>{c.method}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmt(c.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.completedAt ? fmt(c.completedAt) : t('dash')}</td>
                  <td className="px-4 py-3 text-xs font-bold">
                    {c.biologicalIndicator === true ? <span className="text-emerald-700">{t('pass')}</span>
                      : c.biologicalIndicator === false ? <span className="text-red-700">{t('fail')}</span>
                      : <span className="text-amber-600">{t('pending')}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold">
                    {c.chemicalIndicatorPass === true ? <span className="text-emerald-700">{t('pass')}</span>
                      : c.chemicalIndicatorPass === false ? <span className="text-red-700">{t('fail')}</span>
                      : t('dash')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                      c.status === 'passed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                      {t.has(`cycleStatus.${c.status}`) ? t(`cycleStatus.${c.status}`) : c.status}
                    </span>
                    {c.failureNote && (
                      <p className="text-[10px] text-red-700 mt-0.5 flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />{c.failureNote}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.biologicalIndicator === null && c.status === 'passed' && (
                      <div className="flex gap-1">
                        <button onClick={() => onDelayedBI(c.id, true)}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer">
                          {t('biPass')}
                        </button>
                        <button onClick={() => onDelayedBI(c.id, false)}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer">
                          {t('biFail')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ScanLine className="h-3 w-3" />{t('auditFooter')}
      </p>
    </div>
  )
}
