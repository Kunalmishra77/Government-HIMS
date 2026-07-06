"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FlaskConical, User, Clock, Droplet, BadgeCheck, Stethoscope,
  Building2, RefreshCw, ChevronRight, ClipboardList, Search,
} from "lucide-react"
import { useLabOrdersStore, type LabOrder, type LabSource } from "@/store/useLabOrdersStore"
import { useAuthStore } from "@/store/useAuthStore"
import { type Priority } from "@/lib/labCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_TINT: Record<LabSource, string> = {
  OPD: 'bg-surface-sunken text-accent border-border',
  IPD: 'bg-primary-soft text-accent border-primary/20',
  ICU: 'bg-red-50 text-red-700 border-red-200',
  OT:  'bg-primary-soft text-accent border-primary/20',
  ER:  'bg-red-50 text-red-700 border-red-200',
}
const PRIORITY_RANK: Record<Priority, number> = { STAT: 0, Urgent: 1, Routine: 2 }
const PRIORITY_TINT: Record<Priority, string> = {
  STAT:    'bg-red-100 text-red-700 border-red-200',
  Urgent:  'bg-amber-100 text-amber-700 border-amber-200',
  Routine: 'bg-slate-100 text-slate-600 border-slate-200',
}

const FILTERS = ['All', 'STAT', 'Urgent', 'Routine'] as const
type Filter = typeof FILTERS[number]

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const relTime = (m: number) => m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`

// Highest-urgency priority among a lab order's still-uncollected tests.
function orderPriority(o: LabOrder): Priority {
  const pending = o.tests.filter(t => t.status === 'awaiting_collection')
  const rank = pending.length ? Math.min(...pending.map(t => PRIORITY_RANK[t.priority])) : 2
  return (Object.keys(PRIORITY_RANK) as Priority[]).find(p => PRIORITY_RANK[p] === rank) ?? 'Routine'
}

export default function LabInQueuePage() {
  const router = useRouter()
  const orders = useLabOrdersStore(s => s.orders)
  const collectOrder = useLabOrdersStore(s => s.collectOrder)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? 'Phlebo Saira'

  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    useLabOrdersStore.persist.rehydrate()
    setLastSync(new Date())
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agentix-labordersstore' && e.newValue) {
        useLabOrdersStore.persist.rehydrate()
        setLastSync(new Date())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Every newly ordered test lands here first: orders with ≥1 test awaiting collection.
  const queue = useMemo(() => {
    return orders
      .filter(o => o.tests.some(t => t.status === 'awaiting_collection'))
      .sort((a, b) => {
        const pa = PRIORITY_RANK[orderPriority(a)], pb = PRIORITY_RANK[orderPriority(b)]
        if (pa !== pb) return pa - pb
        return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
      })
  }, [orders])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return queue.filter(o => {
      if (filter !== 'All' && orderPriority(o) !== filter) return false
      if (!q) return true
      return o.patientName.toLowerCase().includes(q)
        || o.uhid.toLowerCase().includes(q)
        || o.doctorName.toLowerCase().includes(q)
        || o.department.toLowerCase().includes(q)
    })
  }, [queue, filter, query])

  const statCount   = queue.filter(o => orderPriority(o) === 'STAT').length
  const urgentCount = queue.filter(o => orderPriority(o) === 'Urgent').length
  const testCount   = queue.reduce((n, o) => n + o.tests.filter(t => t.status === 'awaiting_collection').length, 0)

  const refresh = () => {
    useLabOrdersStore.persist.rehydrate()
    setLastSync(new Date())
    toast.success('Queue refreshed')
  }

  const beginCollection = (o: LabOrder) => {
    collectOrder(o.id, meName)
    toast.success(`Collection started for ${o.patientName}`)
    router.push('/lab/phlebotomy')
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="h-8 w-8 rounded-xl bg-primary-soft text-accent flex items-center justify-center">
              <FlaskConical className="h-4 w-4" />
            </span>
            In Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Newly ordered lab tests awaiting sample collection
            {lastSync && <span className="text-slate-400"> · synced {clock(lastSync.toISOString())}</span>}
          </p>
        </div>
        <button
          onClick={refresh}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold flex items-center gap-1.5 hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Patients in queue', value: queue.length, tint: 'text-slate-900' },
          { label: 'Tests to collect', value: testCount, tint: 'text-slate-900' },
          { label: 'STAT', value: statCount, tint: 'text-red-600' },
          { label: 'Urgent', value: urgentCount, tint: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className={cn("text-2xl font-bold tabular-nums", k.tint)}>{k.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {FILTERS.map(f => {
            const count = f === 'All' ? queue.length : queue.filter(o => orderPriority(o) === f).length
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-sm font-bold cursor-pointer transition flex items-center gap-1.5",
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {f}
                <span className={cn("text-[11px] rounded-full px-1.5 py-0.5",
                  filter === f ? "bg-slate-100 text-slate-600" : "bg-slate-200/70 text-slate-500")}>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, UHID, doctor…"
            className="h-9 w-64 max-w-full pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      {/* Queue cards */}
      <div className="space-y-3">
        {shown.map((o, idx) => {
          const priority = orderPriority(o)
          const pendingTests = o.tests.filter(t => t.status === 'awaiting_collection')
          const collectedCount = o.tests.length - pendingTests.length
          const collectionStatus = collectedCount > 0
            ? `Partially collected · ${collectedCount}/${o.tests.length}`
            : 'Awaiting collection'
          const m = minsAgo(o.orderedAt)
          return (
            <div
              key={o.id}
              className={cn(
                "rounded-xl bg-white border p-4 flex items-start gap-3 flex-wrap transition-shadow",
                priority === 'STAT' ? "border-red-200 ring-1 ring-red-100"
                  : idx === 0 ? "border-amber-300 ring-2 ring-amber-100"
                  : "border-slate-200 hover:shadow-sm"
              )}
            >
              {/* Position badge */}
              <div className={cn(
                "h-12 w-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0",
                priority === 'STAT' ? "bg-gradient-to-br from-red-500 to-red-600"
                  : priority === 'Urgent' ? "bg-gradient-to-br from-amber-500 to-amber-600"
                  : "bg-gradient-to-br from-slate-400 to-slate-500"
              )}>
                {idx + 1}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-slate-900">{o.patientName}</p>
                  {/* UHID — primary patient identifier */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                    <BadgeCheck className="h-3.5 w-3.5" /> {o.uhid}
                  </span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md border", SOURCE_TINT[o.source])}>{o.source}</span>
                  {o.wardBed && <span className="text-[11px] text-slate-400">{o.wardBed}</span>}
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", PRIORITY_TINT[priority])}>{priority}</span>
                </div>

                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-slate-500 mt-1.5">
                  <span className="flex items-center gap-1"><span className="text-slate-400">UHID</span><span className="font-semibold text-slate-600">{o.uhid}</span></span>
                  <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-slate-400" />{o.doctorName}</span>
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-slate-400" />{o.department}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" />{relTime(m)} · {clock(o.orderedAt)}</span>
                </div>

                {/* Ordered tests */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {o.tests.map(t => (
                    <span
                      key={t.id}
                      className={cn(
                        "text-[11px] font-semibold px-2 py-1 rounded-lg border inline-flex items-center gap-1",
                        t.status === 'awaiting_collection'
                          ? "bg-slate-100 text-slate-700 border-slate-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 line-through decoration-emerald-400/60"
                      )}
                    >
                      <FlaskConical className="h-3 w-3" /> {t.name}
                    </span>
                  ))}
                </div>

                {/* Collection status */}
                <div className="flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-slate-500">
                  <Droplet className="h-3.5 w-3.5 text-slate-400" />
                  {collectionStatus}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button
                  onClick={() => beginCollection(o)}
                  className={cn(
                    "h-9 px-4 rounded-lg font-bold text-[13px] text-white flex items-center gap-1.5 active:scale-[0.98] transition cursor-pointer",
                    idx === 0 ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-primary to-primary-dark"
                  )}
                >
                  Begin collection <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-slate-400 font-medium">Order {o.id}</span>
              </div>
            </div>
          )
        })}

        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 flex flex-col items-center justify-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-slate-300" />
            </span>
            <p className="text-sm font-semibold text-slate-400">
              {query || filter !== 'All' ? 'No matching requests in queue' : 'Queue is clear — no tests awaiting collection'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
