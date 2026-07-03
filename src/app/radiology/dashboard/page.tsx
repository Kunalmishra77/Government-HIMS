"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ScanLine, Users, AlertTriangle, Phone, CheckCircle, Clock, Hourglass,
  Sparkles, ArrowRight, ShieldCheck, FileText, ClipboardList, PackageCheck,
  Calendar, UserCheck, Send, Activity, ChevronRight, type LucideIcon,
} from "lucide-react"
import {
  useRadiologyStudiesStore, type RadiologyStudy, type StudyStatus,
} from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { type Modality } from "@/lib/radiologyCatalog"
import { CompactKPI, CompactKPIStrip } from "@/components/ui/CompactKPI"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { modalityLabel } from "@/lib/statusColors"
import { motionPresets } from "@/lib/design-tokens"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

const ACTIVE_STATUSES: StudyStatus[] = ["ordered", "scheduled", "arrived", "acquiring", "acquired", "reading", "reported"]
const CALLBACK_WINDOW_MS = 24 * 3600_000
const CRITICAL_RE = /\b(haemorrhage|hemorrhage|bleed|pneumothorax|tamponade|stroke|infarct|free air|pe\b|pulmonary embolism|bi-?rads (4|5|6)|lung-?rads (4|4a|4b|4x)|pi-?rads (4|5))\b/i

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}
const minsElapsed = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
const hasCritical = (s: RadiologyStudy) =>
  CRITICAL_RE.test(s.reportSections.impression ?? "") ||
  CRITICAL_RE.test(s.reportSections.findings ?? "")

// Shortcut cards across the top — navigation, not status, so chips stay indigo
// except Critical Results which is genuinely a danger surface.
const SHORTCUTS: { href: string; label: string; sub: string; icon: LucideIcon; tone: "brand" | "danger" | "success" }[] = [
  { href: "/radiology/ai-command", label: "AI Command Center", sub: "Queue · forecast · assistant", icon: Sparkles, tone: "brand" },
  { href: "/radiology/critical", label: "Critical Results", sub: "Closed-loop · SLA", icon: AlertTriangle, tone: "danger" },
  { href: "/radiology/analytics", label: "Analytics", sub: "TAT · utilization · revenue", icon: Activity, tone: "success" },
  { href: "/radiology/distribution", label: "Distribution", sub: "Deliver · patient summary", icon: Send, tone: "brand" },
]
const SHORTCUT_CHIP: Record<"brand" | "danger" | "success", string> = {
  brand: "bg-accent-soft text-accent",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success-strong",
}

// Order-to-release journey stages. Inline token classes (not a named colour map):
// amber = needs action, indigo = in-flight, success = released, danger = critical.
const STAGE_TONE = {
  warn:   "border-warning/30 bg-warning-bg text-brand-amber-strong",
  brand:  "border-primary/20 bg-accent-soft text-accent",
  ok:     "border-success/25 bg-success-bg text-success-strong",
  danger: "border-danger/30 bg-danger-bg text-danger-strong ring-1 ring-danger/15",
  idle:   "border-border bg-surface text-foreground-lighter",
} as const

export default function RadiologyOverview() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const logCallback = useRadiologyStudiesStore(s => s.logCallback)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "RIS"

  const [callbackId, setCallbackId] = useState<string | null>(null)
  const [callbackTo, setCallbackTo] = useState("")

  const m = useMemo(() => {
    const orderedOnly = studies.filter(s => s.status === "ordered")
    const scheduledOnly = studies.filter(s => s.status === "scheduled")
    const arrivedOnly = studies.filter(s => s.status === "arrived")
    const ordered = studies.filter(s => s.status === "ordered" || s.status === "scheduled")
    // "On bench" = exams actively being acquired. Arrived-but-not-started patients are the
    // queue (surfaced separately as the Arrived stage), not bench work.
    const onBench = studies.filter(s => s.status === "acquiring")
    const acquired = studies.filter(s => s.status === "acquired")
    const reading = studies.filter(s => s.status === "reading")
    const reported = studies.filter(s => s.status === "reported")
    const released = studies.filter(s => s.status === "released")
    const releasedToday = released.filter(s => s.releasedAt && new Date(s.releasedAt).toDateString() === new Date().toDateString())
    const callbackCutoff = Date.now() - CALLBACK_WINDOW_MS
    const criticalPendingCallback = released.filter(s =>
      !s.callback && hasCritical(s) && s.releasedAt && new Date(s.releasedAt).getTime() >= callbackCutoff
    )
    const tatBreaches = studies.filter(s =>
      ACTIVE_STATUSES.includes(s.status) && minsElapsed(s.orderedAt) > s.expectedTATmin
    )
    const overOverdue = studies.filter(s =>
      ACTIVE_STATUSES.includes(s.status) && minsElapsed(s.orderedAt) > 2 * s.expectedTATmin
    )
    const pipeline: Record<Modality, Record<StudyStatus, number>> = {} as Record<Modality, Record<StudyStatus, number>>
    for (const mm of ["XR", "CT", "MRI", "US", "MAMMO", "NM"] as Modality[]) {
      pipeline[mm] = {
        ordered: 0, scheduled: 0, arrived: 0, acquiring: 0, acquired: 0,
        reading: 0, reported: 0, verified: 0, released: 0, cancelled: 0,
      }
    }
    for (const s of studies) {
      if (ACTIVE_STATUSES.includes(s.status)) pipeline[s.modality][s.status]++
    }
    const wlMap: Record<string, number> = {}
    for (const s of studies) {
      if (s.status === "acquiring" && s.acquiringBy) wlMap[s.acquiringBy.name] = (wlMap[s.acquiringBy.name] ?? 0) + 1
      if (s.status === "reading" && s.readingBy) wlMap[s.readingBy.name] = (wlMap[s.readingBy.name] ?? 0) + 1
    }
    const techLoad = Object.entries(wlMap).sort((a, b) => b[1] - a[1])
    return {
      kpis: {
        ordered: ordered.length,
        orderedOnly: orderedOnly.length,
        scheduledOnly: scheduledOnly.length,
        arrivedOnly: arrivedOnly.length,
        onBench: onBench.length,
        pendingRead: acquired.length + reading.length,
        pendingVerify: reported.length,
        releasedToday: releasedToday.length,
        critPending: criticalPendingCallback.length,
        tatBreaches: tatBreaches.length,
      },
      pipeline, criticalPendingCallback, reported, techLoad, overOverdue,
    }
  }, [studies])

  const onLogCallback = (id: string, patient: string) => {
    const recipient = callbackTo.trim() || "ordering doctor"
    logCallback(id, meName, recipient)
    setCallbackId(null); setCallbackTo("")
    notifyAndAudit({
      to: 'doctor', type: 'critical_value', priority: 'critical',
      title: `Critical imaging callback · ${patient}`,
      body: `Radiology notified ${recipient} of critical finding for ${patient}.`,
      patientName: patient,
      audit: { action: 'radiology_critical_callback', resource: 'radiology_study', resourceId: id, detail: `Callback to ${recipient}`, userName: meName },
    })
    toast.success(`Callback logged for ${patient} to ${recipient} · SLA closed`)
  }

  // M9-C — TAT escalation: surface stuck studies in a single page.
  function escalateRadiologyTat() {
    const overdue = m.kpis.tatBreaches ?? 0
    if (overdue === 0) { toast(`No TAT breaches right now`); return }
    notifyAndAuditMany(['doctor', 'admin'], {
      type: 'system', priority: 'high',
      title: `${overdue} radiology TAT breach${overdue === 1 ? '' : 'es'}`,
      body: `${overdue} stud${overdue === 1 ? 'y is' : 'ies are'} past TAT. Pulling on-call radiologist.`,
      audit: { action: 'radiology_critical_callback', resource: 'radiology_tat', detail: `${overdue} TAT breaches escalated`, userName: meName },
    })
    toast.success(`Escalated ${overdue} TAT breach${overdue === 1 ? '' : 'es'} · admin + doctor notified`)
  }

  const stages = [
    { label: 'Ordered',     sub: 'Needs slot',        count: m.kpis.orderedOnly,   tone: STAGE_TONE.warn,  icon: ClipboardList, href: '/radiology/schedule',     cta: 'Book slot' },
    { label: 'Scheduled',   sub: 'Awaiting arrival',  count: m.kpis.scheduledOnly, tone: STAGE_TONE.brand, icon: Calendar,      href: '/radiology/arrival',      cta: 'Check in' },
    { label: 'Arrived',     sub: 'Ready for scan',    count: m.kpis.arrivedOnly,   tone: STAGE_TONE.brand, icon: UserCheck,     href: '/radiology/bench',        cta: 'Acquire' },
    { label: 'Acquired',    sub: 'Pending read',      count: m.kpis.pendingRead,   tone: STAGE_TONE.brand, icon: ScanLine,      href: '/radiology/reading',      cta: 'Read' },
    { label: 'Reported',    sub: 'Pending verify',    count: m.kpis.pendingVerify, tone: STAGE_TONE.brand, icon: ShieldCheck,   href: '/radiology/verification', cta: 'Verify' },
    { label: 'Released',    sub: 'Today',             count: m.kpis.releasedToday, tone: STAGE_TONE.ok,    icon: Send,          href: '/radiology/inbox',        cta: 'View inbox' },
    { label: 'Critical CB', sub: 'Awaiting callback', count: m.kpis.critPending,   tone: m.kpis.critPending > 0 ? STAGE_TONE.danger : STAGE_TONE.idle, icon: Phone, href: '#critical-callback', cta: 'Log callback' },
  ]

  return (
    <div className="space-y-6">
      {/* Slim meta + action row — the shell already renders the page title. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="t-body text-foreground-lighter max-w-2xl">
          Pipeline by modality · critical-finding SLA · AI exception triage
        </p>
        <div className="flex gap-2 flex-wrap">
          <Link href="/radiology/inbox" className="u-press inline-flex items-center gap-1.5 text-xs font-bold text-accent bg-accent-soft hover:bg-accent-soft/70 px-3 py-2 rounded-xl transition-colors"><ClipboardList className="h-3.5 w-3.5" />Open Inbox</Link>
          <Link href="/radiology/bench" className="u-press inline-flex items-center gap-1.5 text-xs font-bold text-accent bg-accent-soft hover:bg-accent-soft/70 px-3 py-2 rounded-xl transition-colors"><ScanLine className="h-3.5 w-3.5" />Open Bench</Link>
          <Link href="/radiology/reading" className="u-press inline-flex items-center gap-1.5 text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark px-3 py-2 rounded-xl shadow-xs transition-colors">
            <FileText className="h-3.5 w-3.5" />Reading Room
          </Link>
        </div>
      </div>

      {/* Enterprise command surfaces */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SHORTCUTS.map(({ href, label, sub, icon: Icon, tone }) => (
          <Link key={href} href={href} className="u-lift group flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5">
            <span className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", SHORTCUT_CHIP[tone])}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground truncate">{label}</p>
              <p className="text-[11px] text-foreground-lighter truncate">{sub}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-foreground-placeholder ml-auto group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* M13.2 — Order-to-release pipeline: seven chevron-linked stages. */}
      <div className="hms-card p-4">
        <SectionHeader
          icon={Activity}
          title="Order-to-release journey"
          action={<p className="text-[11px] text-foreground-lighter hidden sm:block">Order → schedule → arrival → bench → read → verify → release</p>}
        />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-stretch">
          {stages.map((s, i, arr) => (
            <Link key={s.label} href={s.href}
              className={cn("u-lift relative rounded-xl border p-3 flex flex-col gap-1 cursor-pointer group", s.tone)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <s.icon className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-bold truncate">{s.label}</p>
                </div>
                {i < arr.length - 1 && <ChevronRight className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-border-strong hidden lg:block" />}
              </div>
              <p className="t-kpi text-[22px]">{s.count}</p>
              <p className="text-[10px] text-foreground-lighter mt-0.5">{s.sub}</p>
              <p className="text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 group-hover:underline">
                {s.cta} <ArrowRight className="h-2.5 w-2.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <CompactKPIStrip className="gap-3">
        <CompactKPI label="Ordered / scheduled" value={m.kpis.ordered} tone="warn" icon={<ClipboardList className="h-4 w-4 text-brand-amber-strong" />} />
        <CompactKPI label="On bench" value={m.kpis.onBench} tone="info" icon={<ScanLine className="h-4 w-4 text-accent" />} />
        <CompactKPI label="Pending read" value={m.kpis.pendingRead} tone="info" icon={<Hourglass className="h-4 w-4 text-accent" />} />
        <CompactKPI label="Pending verify" value={m.kpis.pendingVerify} tone="info" icon={<ShieldCheck className="h-4 w-4 text-accent" />} />
        <CompactKPI label="Released today" value={m.kpis.releasedToday} tone="ok" icon={<PackageCheck className="h-4 w-4 text-success-strong" />} />
        <CompactKPI label="TAT breaches" value={m.kpis.tatBreaches} tone="danger" icon={<AlertTriangle className="h-4 w-4 text-danger-strong" />}
          onClick={m.kpis.tatBreaches > 0 ? escalateRadiologyTat : undefined} hint={m.kpis.tatBreaches > 0 ? "Click to escalate to admin + doctor" : undefined} />
      </CompactKPIStrip>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="hms-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <SectionHeader icon={ScanLine} title="Pipeline by modality" />
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {(["XR", "CT", "MRI", "US", "MAMMO"] as Modality[]).map(mm => {
                const counts = m.pipeline[mm]
                const total = ACTIVE_STATUSES.reduce((s, st) => s + counts[st], 0)
                return (
                  <div key={mm} className="rounded-lg border border-border bg-surface-raised p-2.5">
                    <p className="text-[11px] font-bold text-foreground-muted">{modalityLabel(mm)}</p>
                    <p className="t-kpi text-[18px] mt-0.5">{total}</p>
                    <div className="mt-2 space-y-0.5">
                      {counts.scheduled + counts.ordered > 0 && <p className="text-[10px] text-foreground-lighter"><b>{counts.scheduled + counts.ordered}</b> awaiting</p>}
                      {counts.arrived + counts.acquiring > 0 && <p className="text-[10px] text-brand-amber-strong"><b>{counts.arrived + counts.acquiring}</b> on bench</p>}
                      {counts.acquired > 0 && <p className="text-[10px] text-accent"><b>{counts.acquired}</b> awaiting read</p>}
                      {counts.reading > 0 && <p className="text-[10px] text-accent"><b>{counts.reading}</b> being read</p>}
                      {counts.reported > 0 && <p className="text-[10px] text-accent"><b>{counts.reported}</b> pending verify</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div id="critical-callback" className="rounded-2xl border border-danger/25 bg-surface overflow-hidden shadow-card">
            <div className="px-4 py-3 border-b border-danger/20 bg-danger-bg/50 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-danger text-white"><Phone className="h-4 w-4" /></span>
              <h2 className="t-title text-danger-strong">Critical pending callback</h2>
              <span className="text-xs font-bold text-danger-strong tabular-nums">{m.criticalPendingCallback.length}</span>
            </div>
            {m.criticalPendingCallback.length === 0 ? (
              <p className="px-4 py-6 text-sm text-foreground-lighter text-center">No critical findings awaiting callback. ✓</p>
            ) : (
              <div className="divide-y divide-border-light">
                {m.criticalPendingCallback.map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{s.patientName}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-danger-bg text-danger-strong">{s.name}</span>
                      </p>
                      <p className="text-[11px] text-foreground-lighter mt-0.5 truncate">impression: {s.reportSections.impression?.slice(0, 80)}…</p>
                      <p className="text-[11px] text-foreground-lighter mt-0.5">ordering: {s.doctorName} · released {timeAgo(s.releasedAt)}</p>
                    </div>
                    {callbackId === s.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input value={callbackTo} onChange={e => setCallbackTo(e.target.value)} placeholder={`Call ${s.doctorName}…`}
                          className="w-40 h-8 px-2.5 text-[11px] rounded-lg border border-border bg-surface text-foreground focus:border-primary transition-colors" />
                        <button onClick={() => onLogCallback(s.id, s.patientName)}
                          className="u-press text-[11px] font-bold text-white bg-danger hover:bg-danger-strong px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">Confirm log</button>
                        <button onClick={() => { setCallbackId(null); setCallbackTo("") }}
                          className="text-[11px] font-semibold text-foreground-lighter hover:text-foreground cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setCallbackId(s.id); setCallbackTo(s.doctorName) }}
                        className="u-press inline-flex items-center gap-1 text-[11px] font-bold text-white bg-danger hover:bg-danger-strong px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
                        <Phone className="h-3 w-3" />Log callback
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {m.reported.length > 0 && (
            <div className="hms-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <SectionHeader
                  icon={Hourglass}
                  title="Pending verification"
                  count={m.reported.length}
                  action={<Link href="/radiology/verification" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">Open Verification <ArrowRight className="h-3 w-3" /></Link>}
                />
              </div>
              <div className="divide-y divide-border-light">
                {m.reported.slice(0, 5).map(s => (
                  <div key={s.id} className="px-4 py-2.5 text-sm">
                    <span className="font-bold text-foreground">{s.patientName}</span>
                    <span className="text-foreground-placeholder mx-2">·</span>
                    <span className="text-accent">{s.name}</span>
                    <span className="text-foreground-placeholder mx-2">·</span>
                    <span className="text-[11px] text-foreground-lighter">read by {s.readingBy?.name ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="hms-card p-4">
            <SectionHeader icon={Users} title="Workload" />
            <div className="mt-3">
            {m.techLoad.length === 0 ? (
              <p className="text-xs text-foreground-lighter">No active in-progress studies.</p>
            ) : (() => {
              const maxLoad = Math.max(...m.techLoad.map(([, n]) => n), 1)
              return (
                <div className="space-y-2.5">
                  {m.techLoad.map(([name, n]) => (
                    <div key={name}>
                      <p className="text-xs text-foreground-muted flex items-center justify-between"><span>{name}</span><b className="tabular-nums">{n}</b></p>
                      <div className="h-1.5 mt-1 bg-surface-sunken rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(n / maxLoad) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            </div>
          </div>

          <motion.div {...motionPresets.cardIn} className="rounded-2xl border border-primary/20 bg-accent-soft p-4">
            <h2 className="t-title text-accent flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4" />AI exception triage</h2>
            {m.overOverdue.length === 0 ? (
              <p className="text-xs text-foreground-lighter">No exceptions. Pipeline is healthy.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {m.overOverdue.map(s => (
                  <p key={s.id} className="text-foreground-muted">
                    <Clock className="h-3 w-3 inline -mt-0.5 mr-1 text-accent" />
                    <b className="text-foreground">{s.patientName}</b> · {s.name} · <b className="tabular-nums">{minsElapsed(s.orderedAt)}m</b> elapsed (TAT {s.expectedTATmin}m) — likely stuck
                  </p>
                ))}
              </div>
            )}
          </motion.div>

          <div className="hms-card p-4 space-y-1.5">
            <p className="text-xs text-foreground-lighter flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-success" />Verification queue: <Link href="/radiology/verification" className="font-bold text-accent hover:underline">open</Link></p>
            <p className="text-xs text-foreground-lighter flex items-center gap-1.5"><FileText className="h-3 w-3 text-accent" />Templates: <Link href="/radiology/templates" className="font-bold text-accent hover:underline">open</Link></p>
            <p className="text-xs text-foreground-lighter flex items-center gap-1.5"><ScanLine className="h-3 w-3 text-accent" />DICOM viewer: <Link href="/radiology/viewer" className="font-bold text-accent hover:underline">open</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
