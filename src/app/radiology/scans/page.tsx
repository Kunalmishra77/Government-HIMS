"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { useRadiologyStore, type RadiologyScan } from "@/store/useRadiologyStore"
import { ScanLine, AlertCircle, ChevronDown, CheckCircle, Timer, X, ZoomIn, ZoomOut, RotateCw, Maximize2 } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

type TFn = ReturnType<typeof useTranslations<"radiology">>
const STATUS_KEY: Record<RadiologyScan['status'], string> = {
  Scheduled: 'scans.statusScheduled',
  'In Progress': 'scans.statusInProgress',
  'Ready for Review': 'scans.statusReadyForReview',
  Reported: 'scans.statusReported',
}
const statusLabel = (t: TFn, s: RadiologyScan['status']) => t(STATUS_KEY[s])

const STATUS_ORDER: RadiologyScan['status'][] = ['Scheduled', 'In Progress', 'Ready for Review', 'Reported']
const STATUS_NEXT: Partial<Record<RadiologyScan['status'], RadiologyScan['status']>> = {
  Scheduled: 'In Progress', 'In Progress': 'Ready for Review', 'Ready for Review': 'Reported',
}
// Scan status → triple-encoded clinical status (inline, not a colour map).
const scanStatus = (s: RadiologyScan['status']): Status =>
  s === 'Reported' ? 'done' : s === 'Ready for Review' ? 'caution' : s === 'In Progress' ? 'info' : 'pending'
// Pipeline tile accent rail per status.
const STATUS_RAIL: Record<RadiologyScan['status'], string> = {
  Scheduled:          'border-t-border-strong',
  'In Progress':      'border-t-primary',
  'Ready for Review': 'border-t-warning',
  Reported:           'border-t-success',
}

function TATTimer({ scheduledAt, expectedTAT, status, t }: { scheduledAt?: string; expectedTAT?: number; status: RadiologyScan['status']; t: TFn }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!scheduledAt || status === 'Reported') return
    const update = () => setElapsed(Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 60000))
    update()
    const iv = setInterval(update, 30000)
    return () => clearInterval(iv)
  }, [scheduledAt, status])

  if (!scheduledAt || !expectedTAT || status === 'Reported') return null

  const pct = Math.min((elapsed / expectedTAT) * 100, 100)
  const overdue = elapsed > expectedTAT
  const remaining = expectedTAT - elapsed

  return (
    <div className={cn("flex items-center gap-2 mt-2 text-xs font-semibold", overdue ? "text-danger" : "text-foreground-lighter")}>
      <Timer className="h-3.5 w-3.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span>{overdue ? t("scans.overdueBy", { mins: elapsed - expectedTAT }) : t("scans.remaining", { mins: remaining })}</span>
          <span>{t("scans.elapsedOf", { elapsed, expected: expectedTAT })}</span>
        </div>
        <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", overdue ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function RadiologyScansPage() {
  const t = useTranslations("radiology")
  const { scans, advanceStatus } = useRadiologyStore()
  const [filter, setFilter] = useState<'All' | 'Urgent' | 'Overdue' | RadiologyScan['status']>('All')
  const [now, setNow] = useState(Date.now())
  const [viewerFor, setViewerFor] = useState<RadiologyScan | null>(null)

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(iv)
  }, [])

  const getElapsed = (scheduledAt?: string) =>
    scheduledAt ? Math.floor((now - new Date(scheduledAt).getTime()) / 60000) : 0

  const isOverdue = (s: RadiologyScan) =>
    s.status !== 'Reported' && s.scheduledAt && s.expectedTAT
      ? getElapsed(s.scheduledAt) > s.expectedTAT
      : false

  const filtered = scans.filter(s => {
    if (filter === 'All') return true
    if (filter === 'Urgent') return s.priority === 'Urgent'
    if (filter === 'Overdue') return isOverdue(s)
    return s.status === filter
  })

  const overdueCount = scans.filter(isOverdue).length

  const handleAdvance = (scan: RadiologyScan) => {
    const next = STATUS_NEXT[scan.status]
    advanceStatus(scan.id)
    toast.success(t("scans.toastMoved", { id: scan.id, status: next ? statusLabel(t, next) : "" }))
  }

  const filterLabel = (f: 'All' | 'Urgent' | 'Overdue' | RadiologyScan['status']) =>
    f === 'All' ? t("scans.filterAll")
      : f === 'Urgent' ? t("scans.filterUrgent")
      : f === 'Overdue' ? t("scans.filterOverdue")
      : statusLabel(t, f)

  return (
    <div className="space-y-6">
      {/* Pipeline overview */}
      <div className="grid grid-cols-4 gap-3">
        {STATUS_ORDER.map(status => {
          const count = scans.filter(s => s.status === status).length
          const overdueCnt = scans.filter(s => s.status === status && isOverdue(s)).length
          return (
            <Card key={status} className={cn("p-4 text-center border-t-4", STATUS_RAIL[status])}>
              <h3 className="t-kpi text-2xl">{count}</h3>
              <p className="text-xs font-bold text-foreground-lighter mt-0.5">{statusLabel(t, status)}</p>
              {overdueCnt > 0 && <p className="text-[10px] font-bold text-danger mt-1">{t("scans.overdueCount", { count: overdueCnt })}</p>}
            </Card>
          )
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Urgent', 'Overdue', ...STATUS_ORDER] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("u-press text-sm font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer relative",
              filter === f ? 'bg-primary text-[#0D2032] shadow-xs' : 'bg-surface border border-border text-foreground-lighter hover:bg-surface-sunken'
            )}
          >
            {filterLabel(f)}
            {f === 'Overdue' && overdueCount > 0 && (
              <span className="ml-1.5 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Scan Cards */}
      {filtered.length === 0 ? (
        <EmptyState icon={ScanLine} title={t("scans.noScans")} size="sm" />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map(scan => {
              const overdue = isOverdue(scan)
              return (
                <motion.div key={scan.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className={cn("u-lift p-5",
                    overdue ? "border-urgent/30 bg-urgent-bg/40" :
                    scan.aiFinding ? "border-warning/30 bg-warning-bg/30" : ""
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="px-3 py-2 rounded-xl border border-primary/20 bg-accent-soft text-accent text-xs font-bold flex-shrink-0 mt-0.5">
                          {scan.scanType}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-foreground text-sm">{scan.id}</p>
                            {scan.priority && (
                              <NeonBadge variant={scan.priority === 'Urgent' ? 'danger' : 'muted'}>{scan.priority === 'Urgent' ? t("scans.urgent") : scan.priority}</NeonBadge>
                            )}
                            {overdue && <NeonBadge variant="danger" dot pulse>{t("scans.overdue")}</NeonBadge>}
                          </div>
                          <p className="text-sm text-foreground-lighter mt-0.5 font-medium">{scan.patientName}</p>
                          <div className="flex items-center gap-3 text-xs text-foreground-placeholder mt-0.5">
                            {scan.bodyPart && <span>{scan.bodyPart}</span>}
                            {scan.orderedBy && <span>{t("scans.orderedBy", { name: scan.orderedBy })}</span>}
                            <span>{t("scans.scheduledAt", { time: scan.time })}</span>
                          </div>
                          {scan.aiFinding && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-brand-amber-strong bg-warning-bg px-2 py-1 rounded-lg w-fit" role="alert">
                              <AlertCircle className="h-3 w-3 flex-shrink-0" />
                              {t("scans.aiFinding", { text: scan.aiFinding })}
                            </div>
                          )}
                          <TATTimer scheduledAt={scan.scheduledAt} expectedTAT={scan.expectedTAT} status={scan.status} t={t} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusPill status={scanStatus(scan.status)} label={statusLabel(t, scan.status)} />
                        {STATUS_NEXT[scan.status] && (
                          <button
                            onClick={() => handleAdvance(scan)}
                            className="u-press flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-soft hover:bg-accent-soft/70 text-accent text-xs font-bold transition-colors cursor-pointer border border-primary/20"
                          >
                            <ChevronDown className="h-3 w-3 -rotate-90" />
                            {t("scans.advance")}
                          </button>
                        )}
                        {scan.status === 'Ready for Review' && (
                          <button
                            onClick={() => setViewerFor(scan)}
                            className="u-press flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-soft hover:bg-accent-soft/70 text-accent text-xs font-bold transition-colors cursor-pointer border border-primary/20"
                          >
                            {t("scans.openReport")}
                          </button>
                        )}
                        {scan.status === 'Reported' && (
                          <div className="flex items-center gap-1 text-xs font-bold text-success-strong">
                            <CheckCircle className="h-4 w-4" /> {t("scans.reported")}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      {viewerFor ? <DicomViewerStub scan={viewerFor} onClose={() => setViewerFor(null)} t={t} /> : null}
    </div>
  )
}

/* Mock DICOM viewer — Phase-1 demo. Shows a stylised viewport with toolbar
 * and the scan's AI prelim text. Real vendor integration ships post-go-live. */
function DicomViewerStub({ scan, onClose, t }: { scan: RadiologyScan; onClose: () => void; t: TFn }) {
  const [zoom, setZoom] = useState(100)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"
         onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
         role="dialog" aria-modal="true" aria-label={t("scans.viewerAriaLabel")}>
      <div className="flex w-[min(1080px,100%)] max-h-[90vh] flex-col rounded-2xl bg-slate-900 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
          <ScanLine className="h-4 w-4 text-[var(--color-primary-light)]" />
          <h2 className="text-[14px] font-semibold text-white">
            {scan.scanType} · {scan.patientName}
          </h2>
          <span className="text-[11px] text-slate-400">{scan.bodyPart ?? ''}</span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800" aria-label={t("scans.zoomOut")}><ZoomOut className="h-4 w-4" /></button>
            <span className="px-2 text-[12px] tabular-nums text-slate-400">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(300, z + 10))} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800" aria-label={t("scans.zoomIn")}><ZoomIn className="h-4 w-4" /></button>
            <button onClick={() => setZoom(100)}                       className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800" aria-label={t("scans.reset")}><Maximize2 className="h-4 w-4" /></button>
            <button onClick={() => toast.info(t("scans.toastRotating"))}  className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800" aria-label={t("scans.rotate")}><RotateCw className="h-4 w-4" /></button>
            <button onClick={onClose}                                   className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800" aria-label={t("scans.close")}><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden p-4">
          <div className="col-span-2 grid place-items-center rounded-xl bg-slate-950 ring-1 ring-slate-800 overflow-hidden">
            <div className="relative h-full w-full grid place-items-center">
              <div
                className="relative aspect-square w-[min(560px,80%)] rounded-full bg-gradient-radial from-slate-700 via-slate-900 to-slate-950 ring-1 ring-slate-700"
                style={{ transform: `scale(${zoom / 100})`, transition: 'transform 200ms ease' }}
              >
                <div className="absolute inset-[15%] rounded-full bg-gradient-to-tr from-slate-600/40 via-slate-700/60 to-slate-800" />
                <div className="absolute left-[28%] top-[34%] h-[18%] w-[18%] rounded-full bg-slate-400/40 blur-sm" />
                <div className="absolute right-[24%] top-[40%] h-[12%] w-[12%] rounded-full bg-slate-300/40 blur-sm" />
                <p className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-400">{t("scans.demoLabel", { type: scan.scanType.toUpperCase() })}</p>
              </div>
              <p className="absolute bottom-3 right-3 text-[10px] font-mono text-slate-500">{scan.priority ?? t("scans.routine")}</p>
            </div>
          </div>
          <aside className="rounded-xl bg-slate-800/60 p-3 ring-1 ring-slate-700">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t("scans.aiPrelimFinding")}</h3>
            <p className="mt-1 text-[13px] leading-5 text-slate-100">{scan.aiFinding ?? t("scans.noAiPrelim")}</p>
            <h3 className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t("scans.study")}</h3>
            <ul className="mt-1 space-y-1 text-[12px] text-slate-300">
              <li>{t("scans.labelPatient")} <span className="text-slate-100">{scan.patientName}</span></li>
              <li>{t("scans.labelModality")} <span className="text-slate-100">{scan.scanType}</span></li>
              {scan.bodyPart ? <li>{t("scans.labelRegion")} <span className="text-slate-100">{scan.bodyPart}</span></li> : null}
              {scan.orderedBy ? <li>{t("scans.labelOrderedBy")} <span className="text-slate-100">{scan.orderedBy}</span></li> : null}
              <li>{t("scans.labelStatus")} <span className="text-slate-100">{statusLabel(t, scan.status)}</span></li>
            </ul>
            <p className="mt-4 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300 ring-1 ring-amber-500/30">
              {t("scans.demoViewerNote")}
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
