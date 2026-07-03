"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Volume2, FlaskConical, User, Clock, Droplet, AlertTriangle, CheckCircle2,
  Barcode, X, ChevronRight, Activity, Phone, RefreshCw,
} from "lucide-react"
import { useLabOrdersStore, type LabOrder, type LabSource } from "@/store/useLabOrdersStore"
import { useAuthStore } from "@/store/useAuthStore"
import { LAB_CATALOG, type Priority } from "@/lib/labCatalog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_TINT: Record<LabSource, string> = {
  OPD: 'bg-surface-sunken text-accent border-border',
  IPD: 'bg-primary-soft text-accent border-primary/20',
  ICU: 'bg-red-50 text-red-700 border-red-200',
  OT:  'bg-primary-soft text-accent border-primary/20',
  ER:  'bg-primary-soft text-accent border-primary/20',
}
const PRIORITY_RANK: Record<Priority, number> = { STAT: 0, Urgent: 1, Routine: 2 }
const PRIORITY_TINT: Record<Priority, string> = {
  STAT:    'bg-red-100 text-red-700 border-red-200',
  Urgent:  'bg-amber-100 text-amber-700 border-amber-200',
  Routine: 'bg-slate-100 text-slate-600 border-slate-200',
}

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

export default function PhlebotomyBench() {
  const t = useTranslations('lab')
  const orders = useLabOrdersStore(s => s.orders)
  const collectOrder = useLabOrdersStore(s => s.collectOrder)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? 'Phlebo Saira'

  const [calledOrderId, setCalledOrderId] = useState<string | null>(null)
  const [collectingOrder, setCollectingOrder] = useState<LabOrder | null>(null)
  const [tubeChecks, setTubeChecks] = useState<Record<string, boolean>>({})
  const [barcode, setBarcode] = useState('')
  const [lastSync, setLastSync] = useState<Date>(new Date())

  // Rehydrate on mount and listen for cross-tab changes (e.g. doctor ordering
  // in a different browser tab writes to localStorage; the storage event fires
  // in every OTHER tab so the phlebotomy queue updates without a manual refresh).
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

  // Queue: orders that still have at least one test awaiting_collection.
  const queue = useMemo(() => {
    const awaiting = orders.filter(o => o.tests.some(t => t.status === 'awaiting_collection'))
    return awaiting.sort((a, b) => {
      const aPendingTests = a.tests.filter(t => t.status === 'awaiting_collection')
      const bPendingTests = b.tests.filter(t => t.status === 'awaiting_collection')
      const ap = aPendingTests.length > 0
        ? Math.min(...aPendingTests.map(t => PRIORITY_RANK[t.priority]))
        : 2
      const bp = bPendingTests.length > 0
        ? Math.min(...bPendingTests.map(t => PRIORITY_RANK[t.priority]))
        : 2
      if (ap !== bp) return ap - bp
      return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
    })
  }, [orders])

  const statCount   = queue.filter(o => o.tests.some(t => t.status === 'awaiting_collection' && t.priority === 'STAT')).length
  const urgentCount = queue.filter(o => o.tests.some(t => t.status === 'awaiting_collection' && t.priority === 'Urgent')).length

  const manualRefresh = () => {
    useLabOrdersStore.persist.rehydrate()
    setLastSync(new Date())
    toast.success(t('phlebotomy.refreshed'))
  }

  const announceNext = () => {
    const next = queue[0]
    if (!next) {
      toast(t('phlebotomy.queueEmpty'))
      return
    }
    setCalledOrderId(next.id)
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(t('phlebotomy.announceSpeech', { name: next.patientName }))
        window.speechSynthesis.speak(u)
      }
    } catch { /* optional */ }
    toast.success(t('phlebotomy.callingName', { name: next.patientName }), {
      description: t('phlebotomy.callingDesc', { source: next.source, count: next.tests.length }),
    })
  }

  const openCollect = (o: LabOrder) => {
    setCollectingOrder(o)
    const initial: Record<string, boolean> = {}
    for (const sp of o.specimens) initial[sp.accession] = false
    setTubeChecks(initial)
    setBarcode(`BC-${Date.now().toString(36).toUpperCase().slice(-6)}`)
  }

  const allTubesCollected = Object.keys(tubeChecks).length > 0 && Object.values(tubeChecks).every(Boolean)

  const confirmCollect = () => {
    if (!collectingOrder) return
    if (!allTubesCollected) { toast.error(t('phlebotomy.tickEveryTube')); return }
    if (!barcode.trim())   { toast.error(t('phlebotomy.scanOrEnterBarcode')); return }
    collectOrder(collectingOrder.id, meName)
    notifyAndAudit({
      to: 'lab', type: 'system', priority: 'medium',
      title: t('phlebotomy.sampleCollectedTitle', { name: collectingOrder.patientName }),
      body: t('phlebotomy.sampleCollectedBody', { tubes: collectingOrder.specimens.length, barcode, tests: collectingOrder.tests.length }),
      patientName: collectingOrder.patientName,
      audit: { action: 'lab_order', resource: 'lab_specimen', resourceId: collectingOrder.id, detail: `Collected by ${meName} · barcode ${barcode}`, userName: meName },
    })
    toast.success(t('phlebotomy.samplesDrawnToast', { name: collectingOrder.patientName }))
    setCollectingOrder(null)
    setCalledOrderId(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-amber-600" />{t('phlebotomy.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('phlebotomy.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={manualRefresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
            {t('phlebotomy.refresh')}
          </button>
          <button onClick={announceNext} disabled={queue.length === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#DC2626)', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}>
            <Volume2 className="h-4 w-4" />{t('phlebotomy.nextPatient')}
            {statCount > 0 && (
              <span className="ml-1 bg-white/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                {t('phlebotomy.statBadge', { count: statCount })}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('phlebotomy.kpiInQueue'),          val: queue.length,  tint: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: t('phlebotomy.kpiStatPriority'),     val: statCount,     tint: 'bg-red-50 text-red-700 border-red-200' },
          { label: t('phlebotomy.kpiUrgentPriority'),   val: urgentCount,   tint: 'bg-primary-soft text-accent border-primary/20' },
          { label: t('phlebotomy.kpiMyCollections'),
            val: orders.flatMap(o => o.specimens).filter(s => s.collectedBy === meName).length,
            tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border p-3", s.tint)}>
            <p className="text-2xl font-bold">{s.val}</p>
            <p className="text-xs font-semibold mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Last sync notice */}
      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        {t('phlebotomy.lastSync', { time: lastSync.toLocaleTimeString() })}
      </p>

      {/* Queue list */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          {t('phlebotomy.awaitingCollection')}
          {queue.length > 0 && (
            <span className="text-[10.5px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              {queue.length}
            </span>
          )}
        </h2>

        {queue.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">{t('phlebotomy.queueClear')}</p>
            <p className="text-xs text-slate-400 mt-1">
              {t('phlebotomy.queueClearHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((o, idx) => {
              const isTop    = idx === 0
              const isCalled = o.id === calledOrderId
              const pendingTests = o.tests.filter(t => t.status === 'awaiting_collection')
              const priority: Priority = pendingTests.reduce<Priority>(
                (acc, t) => PRIORITY_RANK[t.priority] < PRIORITY_RANK[acc] ? t.priority : acc,
                'Routine',
              )
              const minsOld = minsAgo(o.orderedAt)
              const isUrgent = priority === 'STAT' || priority === 'Urgent'

              return (
                <div
                  key={o.id}
                  className={cn(
                    "rounded-xl bg-white border p-4 flex items-start gap-3 flex-wrap transition-shadow",
                    isCalled ? 'border-border ring-2 ring-primary/20 shadow-md'
                    : isTop  ? 'border-amber-300 ring-2 ring-amber-100 shadow-sm'
                    :          'border-slate-200 hover:shadow-sm',
                  )}
                >
                  {/* Position badge */}
                  <div className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 text-white",
                    priority === 'STAT'   ? 'bg-gradient-to-br from-red-500 to-red-700' :
                    priority === 'Urgent' ? 'bg-gradient-to-br from-amber-500 to-primary' :
                                            'bg-gradient-to-br from-slate-400 to-slate-600',
                  )}>
                    {idx + 1}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-bold text-slate-900">{o.patientName}</p>
                      <span className="text-[11px] font-semibold text-slate-400">{o.patientId}</span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border", SOURCE_TINT[o.source])}>
                        {o.source}
                      </span>
                      {o.wardBed && <span className="text-[11px] text-slate-500">· {o.wardBed}</span>}
                      <span className={cn("text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border", PRIORITY_TINT[priority])}>
                        {t(`priority.${priority}`)}
                      </span>
                      {isCalled && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-surface-sunken text-accent flex items-center gap-1">
                          <Volume2 className="h-2.5 w-2.5" />{t('phlebotomy.called')}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {o.doctorName}
                      <span className="text-slate-300">·</span>
                      <Clock className="h-3 w-3" />
                      {minsOld < 1 ? t('time.justNow') : t('time.minsAgo', { mins: minsOld })}
                      {isUrgent && minsOld > 20 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600">
                          <AlertTriangle className="h-3 w-3" />{t('phlebotomy.waitingMins', { mins: minsOld })}
                        </span>
                      )}
                    </p>

                    {/* Tests */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {pendingTests.map(t => (
                        <span key={t.id} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {t.name}
                        </span>
                      ))}
                    </div>

                    {/* Tubes */}
                    {o.specimens.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                        <Droplet className="h-3 w-3 text-red-400 shrink-0" />
                        {o.specimens.map(s => `${s.type} (${s.container})`).join(' · ')}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <button onClick={() => openCollect(o)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap",
                        isTop
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
                      )}>
                      <Activity className="h-3.5 w-3.5" />{t('phlebotomy.collect')}
                    </button>
                    {isTop && !isCalled && (
                      <button onClick={() => setCalledOrderId(o.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 cursor-pointer transition-colors whitespace-nowrap">
                        <Volume2 className="h-3 w-3" />{t('phlebotomy.callPatient')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pipeline tip */}
      <div className="bg-[rgba(238,107,38,0.06)] border border-[rgba(238,107,38,0.18)] rounded-xl p-4">
        <p className="text-xs font-bold text-[var(--color-primary-dark)] flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />{t('phlebotomy.pipelineDownstream')}
        </p>
        <p className="text-[11px] text-[var(--color-accent)] mt-1">
          {t('phlebotomy.pipelineDownstreamBody')}
        </p>
      </div>

      {/* Collect modal */}
      {collectingOrder && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setCollectingOrder(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t('phlebotomy.drawSamples', { name: collectingOrder.patientName })}</h2>
                <p className="text-xs text-slate-500">
                  {collectingOrder.patientId} · {collectingOrder.source}
                  {collectingOrder.wardBed ? ` · ${collectingOrder.wardBed}` : ''}
                </p>
              </div>
              <button onClick={() => setCollectingOrder(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tests ordered */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{t('phlebotomy.testsOrdered')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {collectingOrder.tests.filter(t => t.status === 'awaiting_collection').map(t => (
                    <span key={t.id} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tubes to draw */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{t('phlebotomy.tubesToDraw')}</p>
                {collectingOrder.specimens.length === 0 ? (
                  <p className="text-xs text-slate-400">{t('phlebotomy.noSpecimens')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {collectingOrder.specimens.map(s => (
                      <label key={s.accession} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tubeChecks[s.accession] ?? false}
                          onChange={e => setTubeChecks(prev => ({ ...prev, [s.accession]: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-slate-800 font-medium">{s.type}</span>
                        <span className="text-xs text-slate-500">· {s.container}</span>
                        <span className="text-[10px] font-mono text-slate-400">{s.accession}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Barcode */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Barcode className="h-3 w-3" />{t('phlebotomy.sampleBarcode')}
                </label>
                <input
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50"
                  placeholder={t('phlebotomy.scanBarcodePlaceholder')}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {t('phlebotomy.verifyIdentity')}
              </div>
            </div>

            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => setCollectingOrder(null)}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmCollect}
                disabled={!allTubesCollected || !barcode.trim()}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50 transition-colors"
              >
                {t('phlebotomy.saveAndRoute')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
