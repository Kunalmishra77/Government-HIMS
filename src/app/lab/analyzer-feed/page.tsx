"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Cpu, Play, Pause, AlertTriangle, CheckCircle2, ChevronRight,
  Activity, Zap, ArrowRight, Microscope, Hand,
} from "lucide-react"
import {
  useLabOrdersStore,
  type LabOrder, type TestRun, type LabSource,
} from "@/store/useLabOrdersStore"
import { LAB_CATALOG, type Bench, type Priority } from "@/lib/labCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Real-world hospital labs have multiple analyzers per section. We seed a
// small fleet here matching the catalog's `analyzer` field. Each test is
// auto-routed by its bench.
const ANALYZERS: { name: string; bench: Bench; vendor: string }[] = [
  { name: 'Sysmex XN-1000',     bench: 'HEMA',    vendor: 'Sysmex' },
  { name: 'Roche cobas c311',   bench: 'BIOCHEM', vendor: 'Roche Diagnostics' },
  { name: 'Abbott Architect i1000SR', bench: 'IMMUNO', vendor: 'Abbott' },
  { name: 'Iris iQ200',         bench: 'URINE',   vendor: 'Beckman Coulter' },
]

const SOURCE_TINT: Record<LabSource, string> = {
  OPD: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', IPD: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  ICU: 'bg-red-50 text-red-700', OT: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', ER: 'bg-primary-soft text-accent',
}
const PRIORITY_TINT: Record<Priority, string> = {
  STAT: 'bg-red-100 text-red-700', Urgent: 'bg-amber-100 text-amber-700', Routine: 'bg-slate-100 text-slate-600',
}

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

// A bench is "manual-only" if its tests are micro / histo / smear (everything
// the catalog flags `micro: true` or `bench === 'HISTO'`). The analyzer feed
// page silently ignores those — they go to /lab/benches for manual entry.
function isAutoFeedable(t: TestRun): boolean {
  const cat = LAB_CATALOG[t.code]
  if (!cat) return false
  if (cat.micro) return false
  if (cat.bench === 'HISTO') return false
  return t.status === 'on_bench' || t.status === 'collected'
}

export default function AnalyzerFeedPage() {
  const orders = useLabOrdersStore(s => s.orders)
  const analyzerAutoFeed = useLabOrdersStore(s => s.analyzerAutoFeed)
  const [autoMode, setAutoMode] = useState(false)
  const tickRef = useRef<number | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])

  // Flatten + filter to auto-feedable on-bench tests, grouped by analyzer.
  const queue = useMemo(() => {
    const all: { order: LabOrder; test: TestRun }[] = []
    for (const o of orders) for (const t of o.tests) {
      if (isAutoFeedable(t)) all.push({ order: o, test: t })
    }
    return all.sort((a, b) => {
      const pr = { STAT: 0, Urgent: 1, Routine: 2 }
      if (pr[a.test.priority] !== pr[b.test.priority]) return pr[a.test.priority] - pr[b.test.priority]
      return new Date(a.test.orderedAt).getTime() - new Date(b.test.orderedAt).getTime()
    })
  }, [orders])

  const byAnalyzer = useMemo(() => {
    const map = new Map<string, typeof queue>()
    for (const item of queue) {
      const cat = LAB_CATALOG[item.test.code]
      const a = ANALYZERS.find(x => x.bench === cat?.bench) ?? ANALYZERS[0]
      const cur = map.get(a.name) ?? []
      cur.push(item)
      map.set(a.name, cur)
    }
    return map
  }, [queue])

  // Recently auto-fed — tests that moved off the queue in the last ~5 min.
  const recentlyFed = useMemo(() => {
    const all: { order: LabOrder; test: TestRun }[] = []
    for (const o of orders) for (const t of o.tests) {
      if (t.status === 'entered' && t.enteredBy?.id === 'ANLZ') all.push({ order: o, test: t })
    }
    return all.slice(0, 10)
  }, [orders])

  // ── Auto-mode tick.
  // Every 8s the analyzer "pushes" 1 result per queue (analyzers process in
  // parallel). Stops when the queue empties.
  useEffect(() => {
    if (!autoMode) {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      return
    }
    tickRef.current = window.setInterval(() => {
      // Grab the next test per analyzer (one each tick).
      let processed = 0
      for (const [, items] of byAnalyzer) {
        const next = items[0]
        if (next) {
          analyzerAutoFeed(next.test.id)
          setRecentIds(ids => [next.test.id, ...ids].slice(0, 12))
          processed++
        }
      }
      if (processed === 0) {
        toast('Queue cleared — auto-mode paused')
        setAutoMode(false)
      }
    }, 8000)
    return () => {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
    }
  }, [autoMode, byAnalyzer, analyzerAutoFeed])

  const runOne = (testId: string) => {
    analyzerAutoFeed(testId)
    setRecentIds(ids => [testId, ...ids].slice(0, 12))
    toast.success('Result pushed by analyzer · awaiting pathologist')
  }

  const runBatchFor = (analyzerName: string) => {
    const items = byAnalyzer.get(analyzerName) ?? []
    if (items.length === 0) return
    for (const i of items) {
      analyzerAutoFeed(i.test.id)
    }
    setRecentIds(ids => [...items.map(i => i.test.id), ...ids].slice(0, 12))
    toast.success(`${analyzerName}: ${items.length} result${items.length !== 1 ? 's' : ''} pushed`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="h-6 w-6 text-[var(--color-accent)]" />Analyzer feed
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Modern lab default — collected samples auto-loaded onto analyzers ·
            results push to LIMS over HL7 · no human types numbers for routine assays.{' '}
            <Link href="/lab/benches" className="font-bold text-[var(--color-accent)] hover:underline">Manual entries</Link>{' '}available as fallback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoMode(m => !m)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer",
              autoMode
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50')}>
            {autoMode ? <><Pause className="h-3.5 w-3.5" />Auto-mode ON</> : <><Play className="h-3.5 w-3.5" />Start auto-mode</>}
          </button>
        </div>
      </div>

      {/* Help banner */}
      <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] p-3 flex items-start gap-2">
        <Zap className="h-4 w-4 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
        <div className="text-[12px] text-[var(--color-primary-dark)]">
          <p className="font-bold mb-0.5">How this works</p>
          <p>
            Each collected sample sits on its analyzer's queue. Click <b>Process queue</b> on an analyzer to push every pending result at once,
            or hit <b>Run</b> on a single row to push just that one. Turn on <b>Auto-mode</b> to simulate analyzers ticking through the queue
            on their own. Results land in the <Link href="/lab/verify" className="font-bold underline">Verification</Link> queue
            for pathologist sign-off — same as a real lab.
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-accent)]">
            <b>Fallback:</b> Need to override a result (dilution, reagent error) or run a manual assay (micro, smear, ESR)?
            Use <Link href="/lab/benches" className="font-bold underline">Manual entries</Link> — section tech can claim,
            type values, and finish entry just like before.
          </p>
        </div>
      </div>

      {/* Analyzer queues */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ANALYZERS.map(a => {
          const items = byAnalyzer.get(a.name) ?? []
          return (
            <div key={a.name} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap"
                style={{ background: items.length > 0 ? 'linear-gradient(135deg,rgba(238,107,38,0.07),rgba(238,107,38,0.06))' : '#F8FAFC' }}>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                    {a.name}
                  </p>
                  <p className="text-[10.5px] text-slate-500">{a.vendor} · {a.bench} bench</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded border",
                    items.length === 0 ? 'border-slate-200 bg-slate-50 text-slate-500'
                      : 'border-primary/20 bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]')}>
                    {items.length} pending
                  </span>
                  <button onClick={() => runBatchFor(a.name)} disabled={items.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer disabled:opacity-50">
                    <Zap className="h-3 w-3" />Process queue
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {items.length === 0 && (
                  <li className="px-4 py-8 text-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-[12px] font-bold text-slate-500">Queue clear</p>
                    <p className="text-[10.5px] text-slate-400">Waiting for collected samples.</p>
                  </li>
                )}
                {items.slice(0, 6).map(({ order, test }) => (
                  <li key={test.id} className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-900 truncate">
                        {order.patientName} <span className="text-[10px] font-bold text-slate-400">{order.patientId}</span>
                      </p>
                      <p className="text-[11px] text-slate-600 truncate flex items-center gap-1 flex-wrap">
                        <span className="font-semibold">{test.name}</span>
                        <span className={cn("text-[9px] font-bold uppercase px-1 py-0.5 rounded", SOURCE_TINT[order.source])}>{order.source}</span>
                        <span className={cn("text-[9px] font-bold uppercase px-1 py-0.5 rounded", PRIORITY_TINT[test.priority])}>{test.priority}</span>
                        <span className="text-slate-400">· {minsAgo(test.orderedAt)}m ago</span>
                      </p>
                    </div>
                    <button onClick={() => runOne(test.id)}
                      className="text-[10.5px] font-bold px-2 py-1 rounded bg-slate-100 hover:bg-[rgba(238,107,38,0.12)] text-slate-700 hover:text-[var(--color-accent)] cursor-pointer">
                      Run
                    </button>
                  </li>
                ))}
                {items.length > 6 && (
                  <li className="px-4 py-2 text-[10.5px] text-slate-400 italic text-center">
                    +{items.length - 6} more queued · use "Process queue" to clear
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Recently auto-fed feed */}
      {recentlyFed.length > 0 && (
        <div className="rounded-xl bg-white border border-emerald-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-emerald-100 bg-emerald-50 flex items-center justify-between flex-wrap">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-emerald-700" />
              <p className="text-[12.5px] font-bold text-emerald-900">Recently auto-fed · awaiting pathologist</p>
              <span className="text-[10.5px] font-bold text-emerald-700">{recentlyFed.length}</span>
            </div>
            <Link href="/lab/verify" className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5">
              Open Verification <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            <AnimatePresence>
              {recentlyFed.map(({ order, test }) => {
                const flagged = test.analytes.filter(a => a.flag !== 'N')
                const critical = test.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')
                const justFed = recentIds.includes(test.id)
                return (
                  <motion.li key={test.id} layout
                    initial={justFed ? { backgroundColor: '#DCFCE7' } : false}
                    animate={{ backgroundColor: '#FFFFFF' }}
                    transition={{ duration: 1.2 }}
                    className="px-4 py-2 flex items-center gap-2 flex-wrap">
                    <Cpu className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    <p className="text-[11.5px] font-bold text-slate-900 truncate min-w-0 flex-1">
                      {order.patientName} <span className="text-[10px] font-bold text-slate-400">{order.patientId}</span>
                      <span className="text-slate-500 font-medium"> · {test.name}</span>
                    </p>
                    <span className="text-[10px] text-slate-500">{test.enteredBy?.name}</span>
                    {flagged.length > 0 && (
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                        critical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                        {critical ? 'CRITICAL' : `${flagged.length} flag${flagged.length !== 1 ? 's' : ''}`}
                      </span>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {/* Pointer to manual fallback */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
        <Hand className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Manual entry — fallback path</p>
          <p className="text-[12px] text-slate-600 mt-0.5">
            For micro (cultures, AST), urine micro, peripheral smear, ESR, or any time you need to override an auto-fed value
            (dilution, reagent error, instrument flag), use Manual entries. The section tech claims the test → types each
            analyte → finishes entry. Pathologist verifies the same way.
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Link href="/lab/benches" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
              <Microscope className="h-3.5 w-3.5" />Manual entries
            </Link>
            <Link href="/lab/microbiology" className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
              <Microscope className="h-3.5 w-3.5" />Microbiology workflow
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
