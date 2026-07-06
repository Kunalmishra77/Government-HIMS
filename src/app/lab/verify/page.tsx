"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldCheck, AlertTriangle, CheckCircle2, X, ChevronRight, FlaskConical,
  Stethoscope, RotateCcw, Filter,
} from "lucide-react"
import {
  useLabOrdersStore,
  type LabOrder, type TestRun, type AnalyteFlag, type LabSource,
  DR_PATHO,
} from "@/store/useLabOrdersStore"
import { LAB_CATALOG, type Priority, type Bench } from "@/lib/labCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { LabAnomalyPanel } from "@/components/lab/LabAnomalyPanel"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const FLAG_STYLE: Record<AnalyteFlag, string> = {
  N:  'bg-slate-100 text-slate-500',
  H:  'bg-amber-100 text-amber-700',
  L:  'bg-amber-100 text-amber-700',
  CH: 'bg-red-100 text-red-700',
  CL: 'bg-red-100 text-red-700',
}
const FLAG_LABEL: Record<AnalyteFlag, string> = {
  N: 'Normal', H: 'High', L: 'Low', CH: 'Critical high', CL: 'Critical low',
}
const PRIORITY_TINT: Record<Priority, string> = {
  STAT: 'bg-red-100 text-red-700', Urgent: 'bg-amber-100 text-amber-700', Routine: 'bg-slate-100 text-slate-600',
}
const SOURCE_TINT: Record<LabSource, string> = {
  OPD: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', IPD: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  ICU: 'bg-red-50 text-red-700', OT: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', ER: 'bg-primary-soft text-accent',
}
const BENCH_LABEL: Record<Bench, string> = {
  HEMA: 'Hematology', BIOCHEM: 'Biochemistry', IMMUNO: 'Immunology',
  URINE: 'Urinalysis', MICRO: 'Microbiology', HISTO: 'Histopathology',
}

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
const fmt = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function VerifyQueue() {
  const t = useTranslations('lab')
  const orders = useLabOrdersStore(s => s.orders)
  const verifyTest = useLabOrdersStore(s => s.verifyTest)
  const releaseTest = useLabOrdersStore(s => s.releaseTest)
  const rejectTest = useLabOrdersStore(s => s.rejectTest)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? DR_PATHO.name

  const [benchFilter, setBenchFilter] = useState<'all' | Bench>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('hemolyzed')

  // Pending verify = entered (entry done, awaiting pathologist).
  // Also surface "verified-awaiting-release" so the pathologist can confirm the final push.
  const pending = useMemo(() => {
    const rows: { order: LabOrder; test: TestRun }[] = []
    for (const o of orders) {
      for (const t of o.tests) {
        if (t.status === 'entered' || t.status === 'verified') {
          if (benchFilter !== 'all' && t.bench !== benchFilter) continue
          rows.push({ order: o, test: t })
        }
      }
    }
    return rows.sort((a, b) => {
      const ar = a.test.status === 'entered' ? 0 : 1
      const br = b.test.status === 'entered' ? 0 : 1
      if (ar !== br) return ar - br
      // STAT first
      const apr = { STAT: 0, Urgent: 1, Routine: 2 }[a.test.priority]
      const bpr = { STAT: 0, Urgent: 1, Routine: 2 }[b.test.priority]
      if (apr !== bpr) return apr - bpr
      return new Date(a.test.orderedAt).getTime() - new Date(b.test.orderedAt).getTime()
    })
  }, [orders, benchFilter])

  const enteredCount = orders.flatMap(o => o.tests).filter(t => t.status === 'entered').length
  const verifiedCount = orders.flatMap(o => o.tests).filter(t => t.status === 'verified').length
  const criticalCount = pending.filter(r => r.test.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')).length

  const onApprove = (order: LabOrder, test: TestRun) => {
    const verifier = { id: currentUser?.id ?? DR_PATHO.id, name: meName }
    if (test.status === 'entered') {
      verifyTest(test.id, verifier)
      // Verified → immediately release for the demo (one-click sign-off + release).
      // In a real lab, these are sometimes separate steps, but the journey is the same.
      setTimeout(() => releaseTest(test.id), 50)
    } else {
      releaseTest(test.id)
    }
    notifyAndAudit({
      to: 'doctor', type: 'lab_result',
      priority: test.analytes.some(a => a.flag === 'CH' || a.flag === 'CL') ? 'critical' : 'medium',
      title: t('verify.verifiedToastTitle', { test: test.name, name: order.patientName }),
      body: t('verify.verifiedToastBody', { verifier: meName, count: test.analytes.filter(a => a.flag !== 'N').length }),
      patientName: order.patientName,
      audit: { action: 'lab_result_released', resource: 'lab_test', resourceId: test.id, detail: `Verified ${test.name} for ${order.patientName}`, userName: meName },
    })
    toast.success(t('verify.verifiedToast', { test: test.name, name: order.patientName }))
  }

  const onReject = (test: TestRun) => {
    if (rejectReason === 'hemolyzed' || rejectReason === 'clotted' || rejectReason === 'insufficient'
        || rejectReason === 'wrong_tube' || rejectReason === 'unlabeled' || rejectReason === 'contaminated') {
      rejectTest(test.id, rejectReason)
      toast(t('verify.rejectedToast', { test: test.name }))
      setRejectingId(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />{t('verify.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('verify.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <Select value={benchFilter} onChange={e => setBenchFilter(e.target.value as 'all' | Bench)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200">
            <option value="all">All sections</option>
            {(['HEMA', 'BIOCHEM', 'IMMUNO', 'URINE', 'MICRO', 'HISTO'] as Bench[]).map(b => (
              <option key={b} value={b}>{BENCH_LABEL[b]}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] p-3">
          <p className="text-2xl font-bold text-[var(--color-accent)]">{enteredCount}</p>
          <p className="text-xs font-semibold text-[var(--color-accent)] mt-1">Pending verification</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">{verifiedCount}</p>
          <p className="text-xs font-semibold text-emerald-700 mt-1">Pending release</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
          <p className="text-xs font-semibold text-red-700 mt-1">Critical values in queue</p>
        </div>
      </div>

      {/* AI anomaly scan (Track B) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-slate-700 mb-1">AI second-read</h2>
        <p className="text-xs text-slate-500 mb-3">Scan the released panel for out-of-range values; accept to escalate criticals to the ordering doctor.</p>
        <LabAnomalyPanel />
      </div>

      {/* Queue */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2">Awaiting sign-off</h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Queue clear</p>
            <p className="text-xs text-slate-400 mt-1">All entered results have been verified and released.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map(({ order, test }) => {
              const cat = LAB_CATALOG[test.code]
              const flagged = test.analytes.filter(a => a.flag !== 'N')
              const critical = test.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')
              const expanded = expandedId === test.id
              const rejecting = rejectingId === test.id
              const mins = minsAgo(test.orderedAt)
              return (
                <li key={test.id}>
                  <motion.div layout
                    className={cn("rounded-xl bg-white border p-4",
                      critical ? 'border-red-200 ring-2 ring-red-100'
                      : test.status === 'verified' ? 'border-emerald-200'
                      : 'border-slate-200')}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-bold text-slate-900">{order.patientName}</p>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">{order.uhid}</span>
                          <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", SOURCE_TINT[order.source])}>{order.source}</span>
                          {order.wardBed && <span className="text-[11px] text-slate-500">· {order.wardBed}</span>}
                          <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded", PRIORITY_TINT[test.priority])}>{test.priority}</span>
                          {critical && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" />CRITICAL
                            </span>
                          )}
                          {test.status === 'verified' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">Pending release</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mt-1">{test.name}{cat ? ` · ${BENCH_LABEL[cat.bench]}` : ''}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <Stethoscope className="h-3 w-3" />{order.doctorName}
                          <span>·</span>
                          <span>Entered by {test.enteredBy?.name ?? '—'}</span>
                          <span>·</span>
                          <span>Ordered {mins}m ago</span>
                        </p>
                        {flagged.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            {flagged.slice(0, 4).map(a => (
                              <span key={a.analyte} className={cn("text-[11px] font-bold px-2 py-0.5 rounded", FLAG_STYLE[a.flag])}>
                                {a.analyte} {a.value} {a.unit} ({FLAG_LABEL[a.flag]})
                              </span>
                            ))}
                            {flagged.length > 4 && <span className="text-[11px] text-slate-400">+{flagged.length - 4} more</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <div className="flex gap-1.5">
                          <button onClick={() => setExpandedId(expanded ? null : test.id)}
                            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">
                            {expanded ? 'Hide values' : 'Review values'}
                          </button>
                          <button onClick={() => onApprove(order, test)}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">
                            <CheckCircle2 className="h-3.5 w-3.5" />{test.status === 'entered' ? 'Approve & release' : 'Release'}
                          </button>
                          <button onClick={() => { setRejectingId(test.id); setRejectReason('hemolyzed') }}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold cursor-pointer border border-red-200">
                            <RotateCcw className="h-3.5 w-3.5" />Reject
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Values table */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-3 border-t border-slate-100 pt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-400">
                                <th className="font-bold pb-1.5">Analyte</th>
                                <th className="font-bold pb-1.5">Value</th>
                                <th className="font-bold pb-1.5">Unit</th>
                                <th className="font-bold pb-1.5">Reference</th>
                                <th className="font-bold pb-1.5">Flag</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {test.analytes.map(a => (
                                <tr key={a.analyte} className={a.flag !== 'N' ? 'bg-slate-50/50' : ''}>
                                  <td className="py-1.5 font-semibold text-slate-700">{a.analyte}</td>
                                  <td className={cn("py-1.5 font-bold", a.flag === 'CH' || a.flag === 'CL' ? 'text-red-700' : a.flag !== 'N' ? 'text-amber-700' : 'text-slate-900')}>{a.value}</td>
                                  <td className="py-1.5 text-slate-500">{a.unit}</td>
                                  <td className="py-1.5 text-slate-500">
                                    {a.refLow != null && a.refHigh != null ? `${a.refLow}–${a.refHigh}` : '—'}
                                  </td>
                                  <td className="py-1.5">
                                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", FLAG_STYLE[a.flag])}>{FLAG_LABEL[a.flag]}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Reject panel */}
                    <AnimatePresence>
                      {rejecting && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-3 border-t border-slate-100 pt-3">
                          <p className="text-[11px] font-bold text-red-700 mb-2">Reject reason</p>
                          <div className="flex gap-2 items-end">
                            <Select value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                              className="h-9 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-semibold text-slate-700 focus:outline-none">
                              <option value="hemolyzed">Hemolyzed</option>
                              <option value="clotted">Clotted</option>
                              <option value="insufficient">Insufficient volume</option>
                              <option value="contaminated">Contaminated</option>
                              <option value="wrong_tube">Wrong tube</option>
                              <option value="unlabeled">Unlabeled</option>
                            </Select>
                            <button onClick={() => onReject(test)}
                              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer">
                              Confirm reject
                            </button>
                            <button onClick={() => setRejectingId(null)}
                              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl p-4">
        <p className="text-xs font-bold text-[var(--color-primary-dark)] flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />After release
        </p>
        <p className="text-[11px] text-[var(--color-accent)] mt-1">
          On release, the doctor gets a notification (critical-priority if any CH/CL flag), the patient portal updates,
          billing logs the test, and the audit row is written.
        </p>
      </div>
    </div>
  )
}
