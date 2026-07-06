"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ShieldCheck, ChevronDown, ChevronRight, CheckCircle, Stethoscope, Clock, ShieldAlert,
  Ban, UserCheck,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type RadTech,
} from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, TEMPLATE_SECTIONS, type Priority } from "@/lib/radiologyCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { checkReportConsistency, isCriticalText } from "@/lib/radiologyAI"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"

type TFn = ReturnType<typeof useTranslations<"radiology">>
const timeAgo = (t: TFn, iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t("common.justNow")
  if (mins < 60) return t("common.minsAgo", { mins })
  return t("common.hoursAgo", { hours: Math.round(mins / 60) })
}
const isCriticalStudy = (s: RadiologyStudy) => isCriticalText(s.reportSections.impression) || isCriticalText(s.reportSections.findings)

export default function Verification() {
  const t = useTranslations("radiology")
  const studies = useRadiologyStudiesStore(s => s.studies)
  const consultantVerify = useRadiologyStudiesStore(s => s.consultantVerify)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: RadTech = { id: currentUser?.id ?? "RD-202", name: currentUser?.name ?? t("verification.defaultMeName") }

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pending = useMemo(
    () => studies.filter(s => s.status === "reported")
      .sort((a, b) => {
        const pri = { Critical: -3, Stroke: -2, Trauma: -1, STAT: 0, Urgent: 1, Routine: 2 } as const
        return pri[a.priority] - pri[b.priority]
      }),
    [studies]
  )

  return (
    <div className="space-y-5">
      <p className="t-body text-foreground-lighter">
        {t("verification.subtitle")}
      </p>

      <div className="space-y-2">
        {pending.length === 0 && (
          <EmptyState icon={ShieldCheck} title={t("verification.nonePending")} size="sm" />
        )}
        {pending.map(s => {
          const isCritical = isCriticalStudy(s)
          return (
            <VerificationRow key={s.id} s={s} t={t}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
              onVerify={() => {
                // AI consistency gate — block release on inconsistent/missing impression.
                const consistency = checkReportConsistency(s)
                if (!consistency.data.ok) {
                  toast.error(t("verification.toastReleaseBlocked", { issue: consistency.data.issues[0] }))
                  setExpandedId(s.id)
                  return
                }
                consultantVerify(s.id, me)
                const action = isCritical ? 'radiology_critical_callback' : 'radiology_report_verified'
                notifyAndAuditMany(['doctor', 'patient'], {
                  type: isCritical ? 'critical_value' : 'system',
                  priority: isCritical ? 'critical' : 'medium',
                  title: isCritical
                    ? t("verification.notifyVerifiedTitleCritical", { name: s.name, patient: s.patientName })
                    : t("verification.notifyVerifiedTitle", { name: s.name, patient: s.patientName }),
                  body: isCritical
                    ? t("verification.notifyVerifiedBodyCritical", { modality: s.modality, name: s.name, patient: s.patientName, patientId: s.patientId, verifier: me.name, doctor: s.doctorName })
                    : t("verification.notifyVerifiedBody", { modality: s.modality, name: s.name, patient: s.patientName, patientId: s.patientId, verifier: me.name, doctor: s.doctorName }),
                  patientName: s.patientName,
                  audit: { action, resource: 'radiology_study', resourceId: s.id, detail: isCritical
                    ? t("verification.notifyVerifiedDetailCritical", { modality: s.modality, name: s.name, patientId: s.patientId })
                    : t("verification.notifyVerifiedDetail", { modality: s.modality, name: s.name, patientId: s.patientId }), userName: me.name },
                })
                toast.success(t("verification.toastVerified", { name: s.name, doctor: s.doctorName }))
              }} />
          )
        })}
      </div>
    </div>
  )
}

function VerificationRow(props: {
  s: RadiologyStudy
  t: TFn
  expanded: boolean
  onToggle: () => void
  onVerify: () => void
}) {
  const { s, t, expanded } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
  const minsElapsed = Math.round((Date.now() - new Date(s.orderedAt).getTime()) / 60000)
  const isCritical = isCriticalStudy(s)
  const consistency = checkReportConsistency(s)
  const blocked = !consistency.data.ok

  return (
    <div className={cn("rounded-xl bg-surface border overflow-hidden u-row", isCritical ? "border-danger/25" : "border-border")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <StatusPill status={priorityStatus(s.priority)} label={s.priority} dense className="flex-shrink-0" />

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground truncate">{s.patientName}</span>
            <span className="text-[11px] font-bold text-foreground-placeholder">{s.patientId}</span>
            <span className="text-[12px] font-bold text-accent">{s.name}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-accent">{s.modality}</span>
            {s.residentReadBy && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-primary-dark flex items-center gap-0.5">
                <UserCheck className="h-3 w-3" />{t("verification.residentRead")}
              </span>
            )}
            {isCritical && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-danger-bg text-danger-strong flex items-center gap-0.5">
                <ShieldAlert className="h-3 w-3" />{t("verification.critical")}
              </span>
            )}
            {blocked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-warning-bg text-brand-amber-strong flex items-center gap-0.5">
                <Ban className="h-3 w-3" />{t("verification.consistency")}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-lighter mt-0.5 truncate flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{t("verification.readByLine", { name: s.readingBy?.name ?? t("common.dash") })}
            <span className="text-foreground-placeholder mx-1">·</span>
            <Clock className="h-3 w-3" />{t("verification.elapsedReported", { mins: minsElapsed, ago: timeAgo(t, s.reportedAt) })}
          </p>
        </button>

        <button onClick={props.onVerify}
          className={cn("u-press flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap transition-colors", blocked ? "bg-warning-bg text-brand-amber-strong ring-1 ring-warning/30" : "text-white bg-success hover:bg-success-strong shadow-xs")}>
          {blocked ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}{blocked ? t("verification.resolveToRelease") : t("verification.consultantVerifyRelease")}
        </button>
        <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-foreground-placeholder">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border bg-surface-sunken/60 p-4 space-y-2">
          {/* AI consistency gate */}
          <div className={cn("rounded-lg border p-2.5 flex items-start gap-2", blocked ? "bg-warning-bg border-warning/30" : "bg-success-bg border-success/25")}>
            {blocked ? <ShieldAlert className="h-4 w-4 text-brand-amber-strong flex-shrink-0 mt-0.5" /> : <CheckCircle className="h-4 w-4 text-success-strong flex-shrink-0 mt-0.5" />}
            <div>
              <p className={cn("text-[12px] font-bold", blocked ? "text-brand-amber-strong" : "text-success-strong")}>
                {blocked ? t("verification.aiConsistencyBlocked") : t("verification.aiConsistencyPassed")}
              </p>
              {blocked
                ? <ul className="text-[11.5px] text-brand-amber-strong list-disc ml-4 mt-0.5">{consistency.data.issues.map((i, k) => <li key={k}>{i}</li>)}</ul>
                : <p className="text-[11.5px] text-success-strong">{t("verification.consistencyPassedText")}</p>}
            </div>
          </div>
          {tmpl.map(sec => {
            const value = s.reportSections[sec.key] ?? ""
            if (!value) return null
            return (
              <div key={sec.key} className="bg-surface rounded-lg border border-border p-2.5">
                <p className="t-overline text-foreground-lighter mb-1">{sec.label}</p>
                <p className="text-[12px] text-foreground-muted whitespace-pre-wrap">{value}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
