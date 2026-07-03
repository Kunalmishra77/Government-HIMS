"use client"

import { useMemo, useState } from "react"
import {
  FileText, Bed, Stethoscope, ChevronDown, ChevronRight, Hand, Send, Sparkles,
  Image as ImageIcon, Clock, ShieldAlert, Mic, MicOff, Wand2, GitCompare,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type RadTech, type AiFinding,
} from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, TEMPLATE_SECTIONS, type Priority } from "@/lib/radiologyCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { detectFindings, draftImpression, isCriticalText } from "@/lib/radiologyAI"
import { getConfidenceTier } from "@/lib/ai-helpers"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function ReadingRoom() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const claimReading = useRadiologyStudiesStore(s => s.claimReading)
  const setAIPrelim = useRadiologyStudiesStore(s => s.setAIPrelim)
  const setAIFindings = useRadiologyStudiesStore(s => s.setAIFindings)
  const updateReportSection = useRadiologyStudiesStore(s => s.updateReportSection)
  const submitReport = useRadiologyStudiesStore(s => s.submitReport)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: RadTech = { id: currentUser?.id ?? "RAD-304", name: currentUser?.name ?? "Radiologist" }

  const [scope, setScope] = useState<"all" | "mine">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    return studies
      .filter(s => s.status === "acquired" || s.status === "reading")
      .filter(s => scope === "all" || s.readingBy?.id === me.id)
      .sort((a, b) => {
        const pri = { Critical: -3, Stroke: -2, Trauma: -1, STAT: 0, Urgent: 1, Routine: 2 } as const
        return pri[a.priority] - pri[b.priority]
      })
  }, [studies, scope, me.id])

  return (
    <div className="space-y-5">
      <p className="t-body text-foreground-lighter">
        Radiologist queue · AI prelim · structured report · submit for verification
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-sunken">
          {([["all", "All"], ["mine", "My queue"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors",
                scope === k ? "bg-surface text-foreground shadow-xs" : "text-foreground-lighter hover:text-foreground")}>{label}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <EmptyState icon={FileText} title="No studies waiting to be read" size="sm" />
        )}
        {rows.map(s => (
          <ReadingRow key={s.id} s={s} me={me}
            expanded={expandedId === s.id}
            onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
            onClaim={() => { claimReading(s.id, me); setExpandedId(s.id); toast.success(`${s.name} on your queue`) }}
            onAI={() => { setAIPrelim(s.id); toast.success("AI prelim generated") }}
            onSaveFindings={(f) => setAIFindings(s.id, f)}
            onUpdate={(key, value) => updateReportSection(s.id, key, value)}
            onSubmit={() => {
              const cat = RADIOLOGY_CATALOG[s.code]
              const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
              const missing = tmpl.filter(sec => sec.required && !((s.reportSections[sec.key] ?? "").trim()))
              if (missing.length > 0) {
                toast.error(`Required: ${missing.map(m => m.label).join(", ")}`)
                return
              }
              submitReport(s.id, me)
              notifyAndAudit({
                to: 'radiology', type: 'system', priority: s.priority === 'STAT' ? 'high' : 'medium',
                title: `Verification queue · ${s.name}`,
                body: `${s.modality} ${s.name} for ${s.patientName} (${s.patientId}) awaiting second-read sign-off. Read by ${me.name}.`,
                patientName: s.patientName,
                audit: { action: 'radiology_report_verified', resource: 'radiology_study', resourceId: s.id, detail: `Report submitted for verification`, userName: me.name },
              })
              toast.success(`${s.name} submitted for verification`)
            }} />
        ))}
      </div>
    </div>
  )
}

function ReadingRow(props: {
  s: RadiologyStudy; me: RadTech
  expanded: boolean
  onToggle: () => void
  onClaim: () => void
  onAI: () => void
  onSaveFindings: (f: AiFinding[]) => void
  onUpdate: (key: string, value: string) => void
  onSubmit: () => void
}) {
  const { s, me, expanded } = props
  const cat = RADIOLOGY_CATALOG[s.code]
  const tmpl = cat ? TEMPLATE_SECTIONS[cat.template] : []
  const mine = s.readingBy?.id === me.id
  const minsElapsed = Math.round((Date.now() - new Date(s.orderedAt).getTime()) / 60000)
  const overdue = minsElapsed > s.expectedTATmin
  // Deterministic AI detection for this study (structured findings + heatmap).
  const ai = useMemo(() => detectFindings(s), [s.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const aiFindings = s.aiFindings && s.aiFindings.length ? s.aiFindings : ai.data
  const [listening, setListening] = useState(false)

  // Voice dictation → appends transcript into the (uncontrolled) impression textarea.
  const dictateImpression = () => {
    const SR = (typeof window !== "undefined" && ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) as (new () => { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void; stop: () => void }) | undefined
    if (!SR) { toast.error("Voice dictation not supported in this browser"); return }
    const rec = new SR()
    rec.lang = "en-IN"; rec.interimResults = false
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(" ")
      const ta = document.querySelector<HTMLTextAreaElement>(`textarea[data-section="impression"][data-study="${s.id}"]`)
      const next = ta ? `${ta.value} ${transcript}`.trim() : transcript
      if (ta) ta.value = next
      props.onUpdate("impression", next)
      toast.success("Dictated into impression")
    }
    rec.onend = () => setListening(false)
    setListening(true); rec.start()
  }

  const acceptAiDraft = () => {
    const draft = draftImpression(aiFindings)
    const ta = document.querySelector<HTMLTextAreaElement>(`textarea[data-section="impression"][data-study="${s.id}"]`)
    if (ta) ta.value = draft
    props.onUpdate("impression", draft)
    props.onSaveFindings(aiFindings)
    toast.success("AI draft inserted — review & edit before submitting")
  }

  return (
    <div className={cn("rounded-xl bg-surface border overflow-hidden u-row", overdue ? "border-danger/25" : "border-border")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <StatusPill status={priorityStatus(s.priority)} label={s.priority} dense className="flex-shrink-0" />

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground truncate">{s.patientName}</span>
            <span className="text-[11px] font-bold text-foreground-placeholder">{s.patientId}</span>
            {s.wardBed && <span className="text-[11px] font-semibold text-foreground-lighter flex items-center gap-0.5"><Bed className="h-3 w-3" />{s.wardBed}</span>}
            <span className="text-[12px] font-bold text-accent">{s.name}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-accent">{s.modality}</span>
            <span className="chip chip-neutral">{cat?.template ?? "general"}</span>
            {s.readingBy && <span className="text-[11px] font-semibold text-foreground-placeholder">· {mine ? "your queue" : `on ${s.readingBy.name}`}</span>}
          </div>
          <p className="text-xs text-foreground-lighter mt-0.5 truncate flex items-center gap-1 flex-wrap">
            <Stethoscope className="h-3 w-3" />ordered by {s.doctorName}
            <span className="text-foreground-placeholder mx-1">·</span>
            <Clock className="h-3 w-3" />{minsElapsed}m elapsed / {s.expectedTATmin}m TAT
            {overdue && <span className="text-danger font-bold ml-1">overdue</span>}
            {s.attachments.length > 0 && (
              <>
                <span className="text-foreground-placeholder mx-1">·</span>
                <ImageIcon className="h-3 w-3" />{s.attachments.length}
              </>
            )}
          </p>
        </button>

        <div className="flex-shrink-0 flex items-center gap-2">
          {s.status === "acquired" && (
            <button onClick={props.onClaim}
              className="u-press flex items-center gap-1.5 text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark px-3 py-2 rounded-xl shadow-xs cursor-pointer transition-colors">
              <Hand className="h-3.5 w-3.5" />Read
            </button>
          )}
          {s.status === "reading" && mine && (
            <button onClick={props.onSubmit}
              className="u-press flex items-center gap-1.5 text-xs font-bold text-white bg-success hover:bg-success-strong px-3 py-2 rounded-xl shadow-xs cursor-pointer whitespace-nowrap transition-colors">
              <Send className="h-3.5 w-3.5" />Submit for verification
            </button>
          )}
          <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-foreground-placeholder">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-surface-sunken/60 p-4 space-y-3">
          {s.clinicalQuestion && (
            <p className="text-xs text-foreground-lighter"><b className="text-foreground-muted">Clinical question:</b> {s.clinicalQuestion}</p>
          )}

          {/* Attached images thumbnail */}
          {s.attachments.length > 0 && (
            <div>
              <p className="t-overline text-foreground-lighter mb-2">Images</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {s.attachments.map(a => (
                  <div key={a.id} className="rounded-lg bg-surface border border-border p-1.5">
                    <div className="h-14 rounded bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-white/40" />
                    </div>
                    <p className="text-[10px] font-semibold text-foreground-muted mt-1 truncate" title={a.filename}>{a.filename}</p>
                    {a.caption && <p className="text-[10px] text-foreground-lighter truncate">{a.caption}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI prelim */}
          <div className="rounded-lg border border-primary/20 bg-accent-soft p-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-bold text-accent flex items-center gap-1"><Sparkles className="h-3 w-3" />AI prelim</p>
              {s.status === "reading" && mine && (
                <button onClick={props.onAI}
                  className="u-press text-[10px] font-bold text-accent bg-surface hover:bg-accent-soft border border-primary/20 px-2 py-0.5 rounded cursor-pointer transition-colors">
                  {s.aiPrelim ? "Regenerate" : "Generate"}
                </button>
              )}
            </div>
            <p className="text-[12px] text-primary-dark mt-1 italic">{s.aiPrelim ?? "AI prelim not yet generated."}</p>
          </div>

          {/* AI structured detection + heatmap overlay (assistive only) */}
          <div className="rounded-lg border border-primary/20 bg-accent-soft p-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-[11px] font-bold text-primary-dark flex items-center gap-1"><Wand2 className="h-3 w-3" />AI structured findings</p>
              <span className="text-[10px] text-foreground-placeholder">{s.modality} · {s.bodyPart}</span>
              {mine && s.status === "reading" && (
                <button onClick={acceptAiDraft} className="u-press ml-auto text-[10.5px] font-bold text-[#0D2032] bg-primary-dark hover:bg-primary px-2.5 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1 transition-colors">
                  <Sparkles className="h-3 w-3" />Insert draft impression
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
              {/* Heatmap preview */}
              <div className="relative h-[110px] rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden flex-shrink-0">
                <ImageIcon className="absolute inset-0 m-auto h-7 w-7 text-white/15" />
                {aiFindings.filter(f => f.heatmap).map(f => (
                  <div key={f.id} className="absolute rounded border-2 border-danger/90"
                    style={{ left: `${f.heatmap!.x * 100}%`, top: `${f.heatmap!.y * 100}%`, width: `${f.heatmap!.w * 100}%`, height: `${f.heatmap!.h * 100}%`, boxShadow: "0 0 0 9999px rgba(239,68,68,0.08) inset, 0 0 12px rgba(239,68,68,0.5)" }}>
                    <span className="absolute -top-4 left-0 text-[8px] font-bold text-danger whitespace-nowrap">{Math.round(f.confidence * 100)}%</span>
                  </div>
                ))}
                <span className="absolute bottom-1 left-1.5 text-[8px] font-semibold text-white/50">AI heatmap · demo</span>
              </div>
              {/* Findings list */}
              <div className="space-y-1.5">
                {aiFindings.map(f => (
                  <div key={f.id} className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full flex-shrink-0", f.category === "critical" ? "bg-danger" : f.category === "actionable" ? "bg-warning" : "bg-success")} />
                    <span className="text-[12px] font-semibold text-foreground flex-1 truncate">{f.label}{f.birads ? ` · BI-RADS ${f.birads}` : ""}{f.lungrads ? ` · Lung-RADS ${f.lungrads}` : ""}{f.pirads ? ` · PI-RADS ${f.pirads}` : ""}</span>
                    <AiConfidenceBadge confidence={f.confidence} tier={getConfidenceTier(f.confidence)} />
                  </div>
                ))}
                {s.comparisonPriorId && <p className="text-[10.5px] text-foreground-lighter flex items-center gap-1 pt-0.5"><GitCompare className="h-3 w-3" />Prior study linked for comparison</p>}
              </div>
            </div>
          </div>

          {/* Structured report editor */}
          {tmpl.length > 0 && (
            <div>
              <p className="t-overline text-foreground-lighter mb-2">Structured report</p>
              <div className="space-y-2">
                {tmpl.map(sec => {
                  const value = s.reportSections[sec.key] ?? ""
                  const editable = s.status === "reading" && mine
                  return (
                    <div key={sec.key} className="bg-surface rounded-lg border border-border p-2.5">
                      <label className="text-[11px] font-bold text-foreground-muted flex items-center gap-1 mb-1">
                        {sec.label}
                        {sec.required && <span className="text-[10px] text-danger">required</span>}
                        {sec.key === "impression" && editable && (
                          <button type="button" onClick={dictateImpression}
                            className={cn("u-press ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors", listening ? "bg-danger-bg text-danger" : "bg-accent-soft text-primary-dark hover:bg-accent-soft/70")}>
                            {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}{listening ? "Listening…" : "Dictate"}
                          </button>
                        )}
                      </label>
                      {editable ? (
                        <textarea
                          data-section={sec.key} data-study={s.id}
                          defaultValue={value}
                          onBlur={(e) => props.onUpdate(sec.key, e.target.value)}
                          placeholder={sec.placeholder ?? ""}
                          rows={sec.key === "findings" || sec.key === "impression" ? 3 : 2}
                          className="w-full text-[12px] rounded-md border border-border p-1.5 focus:outline-none focus:border-primary transition-colors" />
                      ) : (
                        <p className="text-[12px] text-foreground-muted whitespace-pre-wrap">{value || <span className="italic text-foreground-placeholder">—</span>}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Critical-finding warning if flagged keywords appear in impression */}
          {checkCriticalImpression(s) && (
            <div className="rounded-lg bg-danger-bg border border-danger/25 p-2.5 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-danger-strong">Impression contains a critical finding. On release, the ordering doctor will receive a HIGH-priority notification and the case will appear on the incharge's <b>critical-pending callback</b> list.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function checkCriticalImpression(s: RadiologyStudy): boolean {
  return isCriticalText(s.reportSections.impression) || isCriticalText(s.reportSections.findings)
    || isCriticalText(s.reportSections.lungrads) || isCriticalText(s.reportSections.birads) || isCriticalText(s.reportSections.pirads)
}
