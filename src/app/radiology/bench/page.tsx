"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ScanLine, Bed, Stethoscope, ChevronDown, ChevronRight, Hand, Camera, Upload,
  Image as ImageIcon, CheckCircle, X, Clock, ShieldCheck, Sparkles, Gauge, AlertTriangle,
} from "lucide-react"
import {
  useRadiologyStudiesStore,
  type RadiologyStudy, type StudyStatus, type RadTech, type DoseRecord,
} from "@/store/useRadiologyStudiesStore"
import { type Modality, type Priority, RADIOLOGY_CATALOG } from "@/lib/radiologyCatalog"
import { assessImageQuality } from "@/lib/radiologyAI"
import { useAuthStore } from "@/store/useAuthStore"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { studyStatusToken } from "@/lib/statusColors"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type TFn = ReturnType<typeof useTranslations<"radiology">>
const MODALITY_TABS: Modality[] = ["XR", "CT", "MRI", "US", "MAMMO"]

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"

const statusLabel = (t: TFn, s: StudyStatus) => t(`studyStatus.${s}`)
const STATUS_SORT: Record<StudyStatus, number> = {
  acquiring: 0, arrived: 1, acquired: 2,
  reading: 3, reported: 4, scheduled: 5, ordered: 6,
  verified: 7, released: 8, cancelled: 9,
}

export default function ModalityBench() {
  const t = useTranslations("radiology")
  const studies = useRadiologyStudiesStore(s => s.studies)
  const claimAcquisition = useRadiologyStudiesStore(s => s.claimAcquisition)
  const markAcquired = useRadiologyStudiesStore(s => s.markAcquired)
  const attachImage = useRadiologyStudiesStore(s => s.attachImage)
  const recordDose = useRadiologyStudiesStore(s => s.recordDose)
  const flagQuality = useRadiologyStudiesStore(s => s.flagQuality)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: RadTech = { id: currentUser?.id ?? "RT-101", name: currentUser?.name ?? "Radiographer" }

  const [modality, setModality] = useState<Modality>("XR")
  const [scope, setScope] = useState<"all" | "mine">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filename, setFilename] = useState<Record<string, string>>({})

  const rows = useMemo(() => {
    return studies
      .filter(s => s.modality === modality)
      .filter(s => ["arrived", "acquiring", "acquired", "reading", "reported"].includes(s.status))
      .filter(s => scope === "all" || s.acquiringBy?.id === me.id)
      .sort((a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status])
  }, [studies, modality, scope, me.id])

  const counts = useMemo(() => {
    const c: Record<Modality, number> = { XR: 0, CT: 0, MRI: 0, US: 0, MAMMO: 0, NM: 0 }
    for (const s of studies) {
      if (["arrived", "acquiring", "acquired"].includes(s.status)) c[s.modality]++
    }
    return c
  }, [studies])

  const onAttach = (s: RadiologyStudy) => {
    const name = (filename[s.id] ?? `${s.modality}-${s.id.slice(-4)}-${s.attachments.length + 1}.jpg`).trim()
    if (!name) { toast.error("Filename required"); return }
    attachImage(s.id, { filename: name, caption: `${s.bodyPart} view`, uploadedBy: me.name })
    setFilename(prev => ({ ...prev, [s.id]: "" }))
    toast.success(`${name} attached`)
  }

  // Queue = patients who have arrived but no radiographer has started acquisition;
  // processing = exams already being acquired / read.
  const queueRows = rows.filter(s => s.status === "arrived")
  const processingRows = rows.filter(s => s.status !== "arrived")

  const renderBenchRow = (s: RadiologyStudy) => (
    <BenchRow key={s.id} s={s} me={me}
      expanded={expandedId === s.id}
      filename={filename[s.id] ?? ""}
      onFilenameChange={(v) => setFilename(prev => ({ ...prev, [s.id]: v }))}
      onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
      onClaim={() => { claimAcquisition(s.id, me); setExpandedId(s.id); toast.success(`${s.patientName} on your counter`) }}
      onAcquire={() => {
        if (s.attachments.length === 0) {
          toast.error("Attach at least one image before marking acquired.")
          return
        }
        markAcquired(s.id)
        toast.success(`${s.name} acquired · sent to Reading Room`)
      }}
      onAttach={() => onAttach(s)}
      onDose={(d) => { recordDose(s.id, { ...d, recordedBy: me.name }); toast.success("Dose recorded") }}
      onFlagQuality={() => { const a = assessImageQuality(s).data; flagQuality(s.id, { motion: a.motion, incompleteCoverage: a.incompleteCoverage, note: a.note }); toast.warning("Quality issue flagged") }} />
  )

  return (
    <div className="space-y-5">
      <p className="t-body text-foreground-lighter">
        Radiographer surface · accept patient → acquire → attach images → send for reading
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-sunken">
          {MODALITY_TABS.map(m => (
            <button key={m} onClick={() => setModality(m)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors",
                modality === m ? "bg-surface text-foreground shadow-xs" : "text-foreground-lighter hover:text-foreground")}>
              {t.has(`modality.${m}`) ? t(`modality.${m}`) : m} <span className="ml-1 text-[10px] font-bold text-foreground-placeholder">{counts[m]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-surface-sunken">
          {([["all", "All"], ["mine", "My counter"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors",
                scope === k ? "bg-surface text-foreground shadow-xs" : "text-foreground-lighter hover:text-foreground")}>{label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <EmptyState icon={Camera} title="No patients on this modality right now" size="sm" />
      )}

      {/* Queue — arrived patients waiting for a radiographer to begin acquisition */}
      {queueRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-bold text-foreground">Queue — awaiting radiographer</h2>
            <span className="text-[11px] font-bold text-warning bg-warning-soft rounded-full px-2 py-0.5">{queueRows.length}</span>
            <span className="text-[11px] text-foreground-lighter">Accept a patient to begin the exam</span>
          </div>
          {queueRows.map(renderBenchRow)}
        </div>
      )}

      {/* Processing — exams a radiographer has started acquiring */}
      {processingRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold text-foreground">In exam — acquiring / reading</h2>
            <span className="text-[11px] font-bold text-accent bg-accent-soft rounded-full px-2 py-0.5">{processingRows.length}</span>
          </div>
          {processingRows.map(renderBenchRow)}
        </div>
      )}
    </div>
  )
}

function BenchRow(props: {
  s: RadiologyStudy; me: RadTech
  expanded: boolean
  filename: string
  onFilenameChange: (v: string) => void
  onToggle: () => void
  onClaim: () => void
  onAcquire: () => void
  onAttach: () => void
  onDose: (d: DoseRecord) => void
  onFlagQuality: () => void
}) {
  const { s, me, expanded, filename } = props
  const t = useTranslations("radiology")
  const cat = RADIOLOGY_CATALOG[s.code]
  const mine = s.acquiringBy?.id === me.id
  const minsElapsed = Math.round((Date.now() - new Date(s.orderedAt).getTime()) / 60000)
  const overdue = minsElapsed > s.expectedTATmin && s.status !== "released" && s.status !== "verified"
  const needsContrast = !!cat?.contrast
  const contrastReady = !!s.contrastConsented
  const [dlp, setDlp] = useState("")
  const [mas, setMas] = useState("")
  const showDose = !!cat?.radiationDose && (s.status === "acquiring" || s.status === "acquired")
  const quality = assessImageQuality(s).data

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
            <StatusPill status={studyStatusToken(s.status).status} label={statusLabel(t, s.status)} dense />
            {s.acquiringBy && <span className="text-[11px] font-semibold text-foreground-placeholder">· {mine ? "your counter" : `on ${s.acquiringBy.name}`}</span>}
            {needsContrast && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5",
                contrastReady ? "bg-success-bg text-success-strong" : "bg-warning-bg text-brand-amber-strong")}>
                <ShieldCheck className="h-3 w-3" />{contrastReady ? "consent OK" : "consent needed"}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-lighter mt-0.5 truncate flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{s.doctorName}
            <span className="text-foreground-placeholder mx-1">·</span>
            <Clock className="h-3 w-3" />{minsElapsed}m elapsed / {s.expectedTATmin}m TAT
            {overdue && <span className="text-danger font-bold ml-1">overdue</span>}
            {s.attachments.length > 0 && (
              <>
                <span className="text-foreground-placeholder mx-1">·</span>
                <ImageIcon className="h-3 w-3" />{s.attachments.length} image{s.attachments.length > 1 ? "s" : ""}
              </>
            )}
          </p>
        </button>

        <div className="flex-shrink-0 flex items-center gap-2">
          {s.status === "arrived" && !s.acquiringBy && (
            <button onClick={props.onClaim}
              className="u-press flex items-center gap-1.5 text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark px-3 py-2 rounded-xl shadow-xs cursor-pointer transition-colors">
              <Hand className="h-3.5 w-3.5" />Accept
            </button>
          )}
          {s.status === "acquiring" && mine && (
            <button onClick={props.onAcquire}
              className="u-press flex items-center gap-1.5 text-xs font-bold text-white bg-success hover:bg-success-strong px-3 py-2 rounded-xl shadow-xs cursor-pointer transition-colors">
              <CheckCircle className="h-3.5 w-3.5" />Mark acquired
            </button>
          )}
          {(s.status === "acquired" || s.status === "reading" || s.status === "reported") && (
            <span className="text-xs font-bold text-success-strong whitespace-nowrap">{statusLabel(t, s.status)}</span>
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

          {/* Image attachments */}
          <div>
            <p className="t-overline text-foreground-lighter mb-2">Image attachments</p>
            {s.attachments.length === 0 ? (
              <p className="text-xs text-foreground-placeholder italic">No images attached yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                {s.attachments.map(a => (
                  <div key={a.id} className="rounded-lg bg-surface border border-border p-2 flex flex-col">
                    <div className="h-16 rounded bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-white/40" />
                    </div>
                    <p className="text-[11px] font-semibold text-foreground-muted mt-1.5 truncate" title={a.filename}>{a.filename}</p>
                    {a.caption && <p className="text-[10px] text-foreground-lighter truncate">{a.caption}</p>}
                  </div>
                ))}
              </div>
            )}
            {(s.status === "acquiring" && mine) && (
              <div className="flex items-center gap-2 mt-1">
                <input value={filename} onChange={e => props.onFilenameChange(e.target.value)}
                  placeholder={`${s.modality}-${s.id.slice(-4)}-N.jpg`}
                  className="flex-1 h-8 px-2 text-xs rounded-md border border-border bg-surface focus:outline-none focus:border-primary transition-colors" />
                <button onClick={props.onAttach}
                  className="u-press flex items-center gap-1 text-xs font-bold text-accent bg-accent-soft hover:bg-accent-soft/70 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
                  <Upload className="h-3 w-3" />Attach
                </button>
              </div>
            )}
          </div>

          {s.aiPrelim && (
            <p className="text-[11px] text-accent italic bg-accent-soft rounded-md px-2 py-1.5">{s.aiPrelim}</p>
          )}

          {/* AI image-quality assessment */}
          {(s.status === "acquiring" || s.status === "acquired") && s.attachments.length > 0 && (
            <div className={cn("rounded-lg border p-2.5 flex items-start gap-2", quality.passed ? "bg-success-bg border-success/25" : "bg-warning-bg border-warning/30")}>
              {quality.passed ? <Sparkles className="h-4 w-4 text-success flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className={cn("text-[11px] font-bold", quality.passed ? "text-success-strong" : "text-brand-amber-strong")}>AI quality check{quality.passed ? " — diagnostic" : " — review"}</p>
                <p className={cn("text-[11px]", quality.passed ? "text-success-strong" : "text-brand-amber-strong")}>{quality.note}</p>
              </div>
              {!quality.passed && mine && (
                <button onClick={props.onFlagQuality} className="u-press text-[10.5px] font-bold text-brand-amber-strong bg-surface border border-warning/30 px-2 py-1 rounded-lg cursor-pointer flex-shrink-0 transition-colors">Flag</button>
              )}
            </div>
          )}

          {/* Radiation dose tracking */}
          {showDose && (
            <div className="rounded-lg border border-border bg-surface p-2.5">
              <p className="text-[11px] font-bold text-foreground-muted flex items-center gap-1 mb-1.5"><Gauge className="h-3.5 w-3.5 text-primary-dark" />Radiation dose ({cat?.radiationDose} dose exam)</p>
              {s.doseRecord ? (
                <p className="text-[11.5px] text-foreground-lighter">Recorded: {s.doseRecord.dlp ? `DLP ${s.doseRecord.dlp} mGy·cm` : ""} {s.doseRecord.mas ? `· ${s.doseRecord.mas} mAs` : ""} {s.doseRecord.recordedBy ? `· by ${s.doseRecord.recordedBy}` : ""}</p>
              ) : mine ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={dlp} onChange={e => setDlp(e.target.value)} placeholder="DLP (mGy·cm)" inputMode="decimal" className="h-8 w-32 px-2 text-xs rounded-md border border-border bg-surface focus:outline-none focus:border-primary transition-colors" />
                  <input value={mas} onChange={e => setMas(e.target.value)} placeholder="mAs" inputMode="decimal" className="h-8 w-20 px-2 text-xs rounded-md border border-border bg-surface focus:outline-none focus:border-primary transition-colors" />
                  <button onClick={() => { props.onDose({ dlp: dlp ? Number(dlp) : undefined, mas: mas ? Number(mas) : undefined }); setDlp(""); setMas("") }}
                    className="u-press h-8 px-3 text-xs font-bold text-[#0D2032] bg-primary-dark hover:bg-primary rounded-lg cursor-pointer transition-colors">Record</button>
                </div>
              ) : <p className="text-[11px] text-foreground-placeholder italic">Dose not yet recorded.</p>}
            </div>
          )}

          {s.status === "acquiring" && mine && (
            <button onClick={() => { props.onToggle() }} className="text-[11px] font-semibold text-foreground-placeholder hover:text-foreground-muted flex items-center gap-1 cursor-pointer">
              <X className="h-3 w-3" />Close
            </button>
          )}
        </div>
      )}
    </div>
  )
}
