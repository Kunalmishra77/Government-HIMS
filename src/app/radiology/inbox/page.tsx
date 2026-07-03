"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import {
  Bed, Stethoscope, IndianRupee, ScanLine, AlertTriangle, ChevronDown, ChevronRight,
  Send, Clock, ShieldCheck, Calendar,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type RadSource,
} from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, type Priority } from "@/lib/radiologyCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCES: RadSource[] = ["OPD", "IPD", "ICU", "OT", "ER"]
const PRIORITIES: Priority[] = ["STAT", "Urgent", "Routine"]

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < -1) return `in ${-mins}m`
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

const inOrdered = (s: RadiologyStudy) => s.status === "ordered"
const inScheduled = (s: RadiologyStudy) => s.status === "scheduled"
// "Arrived" is the queue handed to the radiographer — patients waiting to begin acquisition.
// Studies already being acquired/acquired live on the modality bench, not this inbox tab.
const inArrived = (s: RadiologyStudy) => s.status === "arrived"

// Token-driven segmented control button.
const seg = (active: boolean) =>
  cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors",
    active ? "bg-surface text-foreground shadow-xs" : "text-foreground-lighter hover:text-foreground")
const segSm = (active: boolean) =>
  cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors",
    active ? "bg-surface text-foreground shadow-xs" : "text-foreground-lighter hover:text-foreground")

export default function RadiologyInbox() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const schedule = useRadiologyStudiesStore(s => s.schedule)
  const markArrived = useRadiologyStudiesStore(s => s.markArrived)
  const setContrastConsented = useRadiologyStudiesStore(s => s.setContrastConsented)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "Reception"

  const [tab, setTab] = useState<"ordered" | "scheduled" | "arrived">("ordered")
  const [sourceFilter, setSourceFilter] = useState<"all" | RadSource>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scheduleOffset, setScheduleOffset] = useState<Record<string, number>>({})

  const counts = useMemo(() => ({
    ordered: studies.filter(inOrdered).length,
    scheduled: studies.filter(inScheduled).length,
    arrived: studies.filter(inArrived).length,
  }), [studies])

  const filtered = useMemo(() => {
    const inTab = tab === "ordered" ? inOrdered : tab === "scheduled" ? inScheduled : inArrived
    return studies.filter(s => inTab(s)
      && (sourceFilter === "all" || s.source === sourceFilter)
      && (priorityFilter === "all" || s.priority === priorityFilter))
  }, [studies, tab, sourceFilter, priorityFilter])

  const onSchedule = (s: RadiologyStudy) => {
    const offsetMin = scheduleOffset[s.id] ?? 15
    const when = new Date(Date.now() + offsetMin * 60_000).toISOString()
    schedule(s.id, when)
    toast.success(`${s.name} scheduled for ${new Date(when).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`)
    setTab("scheduled")
  }

  const onArrived = (s: RadiologyStudy) => {
    const cat = RADIOLOGY_CATALOG[s.code]
    if (cat?.contrast && !s.contrastConsented) {
      toast.error("Contrast consent required before patient can proceed.")
      return
    }
    markArrived(s.id)
    toast.success(`${s.patientName} checked in · routed to ${cat?.modality ?? s.modality} bench`)
    setTab("arrived")
  }

  return (
    <div className="space-y-5">
      <p className="t-body text-foreground-lighter">
        Schedule incoming orders · check in arriving patients · contrast / safety gates before routing
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-sunken">
          {([
            ["ordered", `Ordered (${counts.ordered})`],
            ["scheduled", `Scheduled (${counts.scheduled})`],
            ["arrived", `On bench (${counts.arrived})`],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={seg(tab === k)}>{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken">
          <button onClick={() => setSourceFilter("all")} className={segSm(sourceFilter === "all")}>All</button>
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSourceFilter(s)} className={segSm(sourceFilter === s)}>{s}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken">
          <button onClick={() => setPriorityFilter("all")} className={segSm(priorityFilter === "all")}>Any priority</button>
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)} className={segSm(priorityFilter === p)}>{p}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <EmptyState
            icon={ScanLine}
            title={tab === "ordered" ? "No new orders pending scheduling"
              : tab === "scheduled" ? "No patients scheduled"
              : "No patients on the bench right now"}
            size="sm"
          />
        )}
        {filtered.map(s => (
          <StudyRow key={s.id} s={s}
            expanded={expandedId === s.id}
            offset={scheduleOffset[s.id] ?? 15}
            setOffset={(v) => setScheduleOffset(prev => ({ ...prev, [s.id]: v }))}
            onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
            onSchedule={() => onSchedule(s)}
            onArrived={() => onArrived(s)}
            onContrast={(ok) => { setContrastConsented(s.id, ok); toast(`Contrast consent ${ok ? "recorded" : "withdrawn"}`); void meName }}
          />
        ))}
      </div>
    </div>
  )
}

function StudyRow(props: {
  s: RadiologyStudy
  expanded: boolean
  offset: number
  setOffset: (v: number) => void
  onToggle: () => void
  onSchedule: () => void
  onArrived: () => void
  onContrast: (ok: boolean) => void
}) {
  const { s, expanded, offset } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const needsContrast = !!cat?.contrast
  const contrastReady = !!s.contrastConsented

  return (
    <div className={cn("rounded-xl bg-surface border overflow-hidden u-row",
      needsContrast && !contrastReady ? "border-warning/40" : "border-border")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className="chip chip-neutral flex-shrink-0">{s.source}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground truncate">{s.patientName}</span>
            <span className="text-[11px] font-bold text-foreground-placeholder">{s.patientId}</span>
            {s.wardBed && <span className="text-[11px] font-semibold text-foreground-lighter flex items-center gap-0.5"><Bed className="h-3 w-3" />{s.wardBed}</span>}
            <StatusPill status={priorityStatus(s.priority)} label={s.priority} dense />
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-accent">{s.modality}</span>
            {needsContrast && (
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-0.5",
                contrastReady ? "bg-success-bg text-success-strong" : "bg-warning-bg text-brand-amber-strong")}>
                <ShieldCheck className="h-3 w-3" />{contrastReady ? "consent OK" : "consent needed"}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-lighter mt-0.5 truncate flex items-center gap-1 flex-wrap">
            <span className="font-bold text-foreground-muted">{s.name}</span>
            <span className="text-foreground-placeholder">·</span>
            <Stethoscope className="h-3 w-3" />{s.doctorName}
            <span className="text-foreground-placeholder">·</span>
            ordered {timeAgo(s.orderedAt)}
            {s.scheduledFor && (
              <>
                <span className="text-foreground-placeholder">·</span>
                <Calendar className="h-3 w-3" />scheduled {timeAgo(s.scheduledFor)}
              </>
            )}
          </p>
        </button>

        <div className="hidden md:flex flex-col items-end flex-shrink-0 w-20">
          <span className="text-[11px] font-bold text-foreground-muted flex items-center gap-0.5"><IndianRupee className="h-3 w-3" />{s.paymentMode}</span>
          <span className="text-[10px] text-foreground-placeholder">TAT {s.expectedTATmin}m</span>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {s.status === "ordered" && (
            <>
              <Select value={offset} onChange={e => props.setOffset(Number(e.target.value))}
                className="text-[11px] font-semibold rounded-lg border border-border bg-surface px-2 py-1.5 cursor-pointer">
                <option value={15}>+15m</option>
                <option value={30}>+30m</option>
                <option value={60}>+1h</option>
                <option value={120}>+2h</option>
              </Select>
              <button onClick={props.onSchedule}
                className="u-press inline-flex items-center gap-1.5 text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark px-3 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-colors">
                <Calendar className="h-3.5 w-3.5" /> Schedule
              </button>
            </>
          )}
          {s.status === "scheduled" && (
            <button onClick={props.onArrived}
              className="u-press inline-flex items-center gap-1.5 text-xs font-bold text-white bg-success hover:bg-success-strong px-3 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-colors">
              <Send className="h-3.5 w-3.5" /> Mark arrived
            </button>
          )}
          {(s.status === "arrived" || s.status === "acquiring" || s.status === "acquired") && (
            <span className="text-xs font-bold text-success-strong whitespace-nowrap">On bench</span>
          )}
          <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-foreground-placeholder">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-surface-sunken/60 p-4 space-y-3">
          <div>
            <p className="t-overline text-foreground-lighter mb-1">Clinical question</p>
            <p className="text-sm text-foreground-muted">{s.clinicalQuestion ?? "—"}</p>
          </div>
          {cat?.preparation && (
            <div className="flex items-start gap-2 text-xs text-foreground-muted rounded-lg bg-warning-bg border border-warning/30 p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-brand-amber-strong flex-shrink-0 mt-0.5" />
              <span><b>Preparation:</b> {cat.preparation}</span>
            </div>
          )}
          {needsContrast && !contrastReady && (
            <div className="rounded-lg border border-warning/30 bg-warning-bg p-2.5 space-y-1.5">
              <p className="text-xs font-bold text-brand-amber-strong flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Contrast safety</p>
              <p className="text-[11px] text-brand-amber-strong">Confirm allergies, renal function (eGFR ≥ 30) and metformin status before contrast administration.</p>
              <div className="flex gap-1.5">
                <button onClick={() => props.onContrast(true)}
                  className="u-press text-[11px] font-bold text-white bg-success hover:bg-success-strong px-2.5 py-1 rounded-lg cursor-pointer transition-colors">Record consent</button>
                <button onClick={() => props.onContrast(false)}
                  className="text-[11px] font-semibold text-foreground-lighter hover:text-foreground px-2.5 py-1 cursor-pointer">Withdraw</button>
              </div>
            </div>
          )}
          {s.aiPrelim && (
            <p className="text-[11px] text-accent italic">{s.aiPrelim}</p>
          )}
          <p className="text-[11px] text-foreground-placeholder flex items-center gap-1"><Clock className="h-3 w-3" />TAT target: {s.expectedTATmin} min</p>
        </div>
      )}
    </div>
  )
}
