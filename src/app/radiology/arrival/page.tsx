"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import {
  UserCheck, ScanLine, AlertTriangle, ShieldCheck, Clock, CheckCircle2,
  ChevronRight, Activity, ArrowRight,
} from "lucide-react"
import {
  useRadiologyStudiesStore, type RadiologyStudy,
} from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { RADIOLOGY_CATALOG, type Priority } from "@/lib/radiologyCatalog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { checkPrepReadiness } from "@/lib/radiologyAI"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { NeonBadge } from "@/components/ui/neon-badge"
import { CompactKPI, CompactKPIStrip } from "@/components/ui/CompactKPI"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"

const fmtSlot = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'

const minsTo = (iso?: string) => iso ? Math.round((new Date(iso).getTime() - Date.now()) / 60000) : 0

export default function RadiologyArrivalPage() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const markArrived = useRadiologyStudiesStore(s => s.markArrived)
  const setContrastConsented = useRadiologyStudiesStore(s => s.setContrastConsented)
  const t = useTranslations("radiology")
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? t("arrival.defaultMeName")

  const [filter, setFilter] = useState<'all' | 'late' | 'soon'>('all')

  const scheduled = useMemo(() => {
    const sList = studies.filter(s => s.status === 'scheduled')
    const filtered = sList.filter(s => {
      if (filter === 'all') return true
      const m = minsTo(s.scheduledFor)
      if (filter === 'late') return m < 0
      if (filter === 'soon') return m >= 0 && m <= 30
      return true
    })
    return filtered.sort((a, b) =>
      new Date(a.scheduledFor ?? a.orderedAt).getTime() - new Date(b.scheduledFor ?? b.orderedAt).getTime()
    )
  }, [studies, filter])

  const arrived = useMemo(() => {
    return studies.filter(s => s.status === 'arrived')
      .sort((a, b) => new Date(b.arrivedAt ?? '').getTime() - new Date(a.arrivedAt ?? '').getTime())
  }, [studies])

  const onArrive = (study: RadiologyStudy, consentNow?: boolean) => {
    markArrived(study.id)
    if (consentNow) setContrastConsented(study.id, true)
    notifyAndAudit({
      to: 'radiology', type: 'system', priority: study.priority === 'STAT' ? 'high' : 'medium',
      title: t("arrival.notifyArrivedTitle", { patient: study.patientName }),
      body: t("arrival.notifyArrivedBody", { patient: study.patientName, patientId: study.patientId, modality: study.modality, name: study.name }),
      patientName: study.patientName,
      audit: { action: 'radiology_order', resource: 'radiology_study', resourceId: study.id, detail: consentNow ? t("arrival.notifyArrivedDetailConsent") : t("arrival.notifyArrivedDetail"), userName: meName },
    })
    toast.success(t("arrival.toastCheckedIn", { patient: study.patientName }))
  }

  const lateCount = scheduled.filter(s => minsTo(s.scheduledFor) < 0).length
  const soonCount = scheduled.filter(s => { const m = minsTo(s.scheduledFor); return m >= 0 && m <= 30 }).length

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="t-body text-foreground-lighter max-w-2xl">
          {t("arrival.subtitle")}
        </p>
        <div className="flex gap-1 p-1 rounded-xl bg-surface-sunken">
          {([
            { k: 'all', label: t("arrival.filterAll"), n: scheduled.length },
            { k: 'soon', label: t("arrival.filterSoon"), n: soonCount },
            { k: 'late', label: t("arrival.filterLate"), n: lateCount },
          ] as const).map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                filter === f.k ? 'bg-surface text-foreground shadow-xs' : 'text-foreground-lighter hover:text-foreground')}>
              {f.label} <span className="text-foreground-placeholder">{f.n}</span>
            </button>
          ))}
        </div>
      </div>

      <CompactKPIStrip className="grid grid-cols-3 gap-3">
        <CompactKPI label={t("arrival.kpiSoon")} value={soonCount} tone={soonCount > 0 ? "warn" : "neutral"} />
        <CompactKPI label={t("arrival.kpiLate")} value={lateCount} tone={lateCount > 0 ? "danger" : "neutral"} />
        <CompactKPI label={t("arrival.kpiCheckedIn")} value={arrived.length} tone="info" />
      </CompactKPIStrip>

      {/* Scheduled queue */}
      <div>
        <h2 className="text-sm font-bold text-foreground-muted mb-2">{t("arrival.scheduledHeading", { count: scheduled.length })}</h2>
        {scheduled.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={t("arrival.noScheduled")} description={t("arrival.noScheduledDesc")} size="sm" />
        ) : (
          <ul className="space-y-2">
            {scheduled.map(s => {
              const c = RADIOLOGY_CATALOG[s.code]
              const eta = minsTo(s.scheduledFor)
              const late = eta < 0
              const soon = !late && eta <= 30
              const needsContrast = !!c?.contrast
              const consentMissing = needsContrast && !s.contrastConsented
              return (
                <motion.li key={s.id} layout
                  className={cn("u-row rounded-xl bg-surface border p-4",
                    late ? 'border-danger/25 ring-1 ring-danger/15'
                    : soon ? 'border-warning/40'
                    : 'border-border')}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-foreground">{s.patientName}</p>
                        <span className="text-[11px] font-bold text-foreground-placeholder">{s.patientId}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-accent-soft text-accent">{s.modality}</span>
                        <StatusPill status={priorityStatus(s.priority)} label={s.priority} dense />
                        {(() => { const issues = checkPrepReadiness(s).data; return issues.length
                          ? <NeonBadge variant="warning"><AlertTriangle className="h-2.5 w-2.5" />{issues.length > 1 ? t("arrival.prepIssuesPlural", { count: issues.length }) : t("arrival.prepIssues", { count: issues.length })}</NeonBadge>
                          : <NeonBadge variant="success">{t("arrival.prepReady")}</NeonBadge> })()}
                        {late && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-danger-bg text-danger-strong flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />{t("arrival.lateBadge")}
                          </span>
                        )}
                        {consentMissing && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-warning-bg text-brand-amber-strong">{t("arrival.consentPending")}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground-muted mt-1">{s.name}</p>
                      <p className="text-xs text-foreground-lighter mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />{t("arrival.slot")} <b>{fmtSlot(s.scheduledFor)}</b>
                        {' · '}{late ? t("arrival.minsLate", { mins: Math.abs(eta) }) : t("arrival.inMins", { mins: eta })}
                        {' · '}{t("arrival.orderedBy", { doctor: s.doctorName })}
                      </p>
                      {c?.preparation && (
                        <p className="text-[11px] text-accent mt-1">
                          {t("arrival.prep", { text: c.preparation })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {consentMissing ? (
                        <button onClick={() => onArrive(s, true)}
                          className="u-press flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-warning hover:bg-brand-amber-strong text-white cursor-pointer transition-colors">
                          <ShieldCheck className="h-3.5 w-3.5" />{t("arrival.checkInConsent")}
                        </button>
                      ) : (
                        <button onClick={() => onArrive(s)}
                          className="u-press flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-dark text-[#0D2032] hover:text-[#0D2032] cursor-pointer transition-colors">
                          <UserCheck className="h-3.5 w-3.5" />{t("arrival.checkIn")}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Recently arrived */}
      {arrived.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-foreground-muted mb-2">{t("arrival.checkedInHeading", { count: arrived.length })}</h2>
          <ul className="space-y-2">
            {arrived.slice(0, 6).map(s => (
              <li key={s.id} className="u-row rounded-xl bg-accent-soft/40 border border-primary/20 p-3 flex items-center gap-3">
                <UserCheck className="h-4 w-4 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{s.patientName} <span className="text-[11px] font-bold text-foreground-placeholder">{s.patientId}</span></p>
                  <p className="text-xs text-foreground-lighter">{s.modality} {s.name} · {t("arrival.arrivedAgo", { mins: Math.round((Date.now() - new Date(s.arrivedAt ?? '').getTime()) / 60000) })}</p>
                </div>
                <a href="/radiology/bench" className="text-[11px] font-bold text-accent hover:underline flex items-center gap-0.5">
                  {t("arrival.modalityBench")} <ArrowRight className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-accent-soft border border-primary/20 rounded-xl p-4">
        <p className="text-xs font-bold text-primary-dark flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />{t("arrival.pipelineDownstream")}
        </p>
        <p className="text-[11px] text-accent mt-1">
          {t("arrival.pipelineDownstreamText")}
        </p>
      </div>
    </div>
  )
}
