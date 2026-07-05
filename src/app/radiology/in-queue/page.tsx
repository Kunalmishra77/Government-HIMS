"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ScanLine, Stethoscope, Building2, Clock, BadgeCheck, Search, RefreshCw,
  ChevronRight, ClipboardList, Bone, Brain, HeartPulse, Radio, Activity, Waves,
} from "lucide-react"
import { useRadiologyStudiesStore, type RadiologyStudy } from "@/store/useRadiologyStudiesStore"
import { PRIORITY_META, priorityRank, type Modality, type Priority } from "@/lib/radiologyCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const MODALITY_META: Record<Modality, { label: string; icon: typeof ScanLine; tint: string }> = {
  XR:    { label: 'X-Ray',        icon: Bone,       tint: 'bg-sky-50 text-sky-700 border-sky-200' },
  CT:    { label: 'CT',           icon: ScanLine,   tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  MRI:   { label: 'MRI',          icon: Brain,      tint: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  US:    { label: 'Ultrasound',   icon: Waves,      tint: 'bg-teal-50 text-teal-700 border-teal-200' },
  MAMMO: { label: 'Mammography',  icon: HeartPulse, tint: 'bg-pink-50 text-pink-700 border-pink-200' },
  NM:    { label: 'Nuclear',      icon: Radio,      tint: 'bg-amber-50 text-amber-700 border-amber-200' },
}

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const relTime = (m: number) => m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`

export default function RadiologyInQueuePage() {
  const router = useRouter()
  const studies = useRadiologyStudiesStore(s => s.studies)
  const schedule = useRadiologyStudiesStore(s => s.schedule)

  const [filter, setFilter] = useState<'All' | Modality>('All')
  const [query, setQuery] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    useRadiologyStudiesStore.persist.rehydrate()
    setLastSync(new Date())
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agentix-radiologystudiesstore' && e.newValue) {
        useRadiologyStudiesStore.persist.rehydrate()
        setLastSync(new Date())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // New requests land here first: studies still in 'ordered' (awaiting scheduling).
  const queue = useMemo(() => {
    return studies
      .filter(s => s.status === 'ordered')
      .sort((a, b) => {
        const pr = priorityRank(b.priority) - priorityRank(a.priority)
        if (pr !== 0) return pr
        return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
      })
  }, [studies])

  const modalitiesPresent = useMemo(
    () => Array.from(new Set(queue.map(s => s.modality))) as Modality[],
    [queue])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return queue.filter(s => {
      if (filter !== 'All' && s.modality !== filter) return false
      if (!q) return true
      return s.patientName.toLowerCase().includes(q)
        || s.uhid.toLowerCase().includes(q)
        || s.doctorName.toLowerCase().includes(q)
        || s.department.toLowerCase().includes(q)
        || s.name.toLowerCase().includes(q)
    })
  }, [queue, filter, query])

  const statCount = queue.filter(s => priorityRank(s.priority) >= priorityRank('STAT')).length
  const contrastCount = queue.filter(s => s.name.toLowerCase().includes('contrast') || s.code.includes('_C') || s.code.includes('ANGIO')).length

  const refresh = () => {
    useRadiologyStudiesStore.persist.rehydrate()
    setLastSync(new Date())
    toast.success('Queue refreshed')
  }

  const scheduleScan = (s: RadiologyStudy) => {
    schedule(s.id, new Date(Date.now() + 30 * 60000).toISOString())
    toast.success(`${s.name} scheduled for ${s.patientName}`)
    router.push('/radiology/schedule')
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="h-8 w-8 rounded-xl bg-primary-soft text-accent flex items-center justify-center">
              <ScanLine className="h-4 w-4" />
            </span>
            In Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Newly ordered imaging requests awaiting scheduling
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
          { label: 'Requests in queue', value: queue.length, tint: 'text-slate-900' },
          { label: 'Modalities', value: modalitiesPresent.length, tint: 'text-slate-900' },
          { label: 'STAT / Emergent', value: statCount, tint: 'text-red-600' },
          { label: 'Contrast studies', value: contrastCount, tint: 'text-violet-600' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className={cn("text-2xl font-bold tabular-nums", k.tint)}>{k.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 flex-wrap">
          {(['All', ...modalitiesPresent] as const).map(f => {
            const count = f === 'All' ? queue.length : queue.filter(s => s.modality === f).length
            const label = f === 'All' ? 'All' : MODALITY_META[f as Modality].label
            return (
              <button
                key={f}
                onClick={() => setFilter(f as 'All' | Modality)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-sm font-bold cursor-pointer transition flex items-center gap-1.5",
                  filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
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
            placeholder="Search name, UHID, scan…"
            className="h-9 w-64 max-w-full pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      {/* Queue cards */}
      <div className="space-y-3">
        {shown.map((s, idx) => {
          const mod = MODALITY_META[s.modality]
          const ModIcon = mod.icon
          const prio = PRIORITY_META[s.priority as Priority]
          const emergent = priorityRank(s.priority) >= priorityRank('STAT')
          const m = minsAgo(s.orderedAt)
          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl bg-white border p-4 flex items-start gap-3 flex-wrap transition-shadow",
                emergent ? "border-red-200 ring-1 ring-red-100"
                  : idx === 0 ? "border-amber-300 ring-2 ring-amber-100"
                  : "border-slate-200 hover:shadow-sm"
              )}
            >
              {/* Modality badge */}
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center border flex-shrink-0", mod.tint)}>
                <ModIcon className="h-5 w-5" />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-slate-900">{s.patientName}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                    <BadgeCheck className="h-3.5 w-3.5" /> {s.uhid}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-border bg-surface-sunken text-accent">{s.source}</span>
                  {s.wardBed && <span className="text-[11px] text-slate-400">{s.wardBed}</span>}
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1", prio?.badge)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", prio?.dot)} />{prio?.label ?? s.priority}
                  </span>
                </div>

                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-slate-500 mt-1.5">
                  <span className="flex items-center gap-1"><span className="text-slate-400">UHID</span><span className="font-semibold text-slate-600">{s.uhid}</span></span>
                  <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-slate-400" />{s.doctorName}</span>
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-slate-400" />{s.department}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" />{relTime(m)} · {clock(s.orderedAt)}</span>
                </div>

                {/* Scan type */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-lg border inline-flex items-center gap-1", mod.tint)}>
                    <ModIcon className="h-3 w-3" /> {s.name}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">{s.bodyPart}</span>
                </div>

                {/* Clinical indication + status */}
                {s.clinicalQuestion && (
                  <p className="text-[12px] text-slate-500 mt-2 italic">“{s.clinicalQuestion}”</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-slate-500">
                  <Activity className="h-3.5 w-3.5 text-slate-400" />
                  Awaiting scheduling
                  {s.contrastConsented && <span className="text-emerald-600">· contrast consented</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button
                  onClick={() => scheduleScan(s)}
                  className={cn(
                    "h-9 px-4 rounded-lg font-bold text-[13px] text-white flex items-center gap-1.5 active:scale-[0.98] transition cursor-pointer",
                    idx === 0 ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-primary to-primary-dark"
                  )}
                >
                  Schedule scan <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-slate-400 font-medium">Study {s.id}</span>
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
              {query || filter !== 'All' ? 'No matching requests in queue' : 'Queue is clear — no imaging requests awaiting scheduling'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
