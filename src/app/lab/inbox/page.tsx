"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ClipboardList, Bed, Stethoscope, IndianRupee, FlaskConical, FileCheck2,
  X, AlertTriangle, ChevronDown, ChevronRight, Send, RotateCcw,
} from "lucide-react"
import {
  useLabOrdersStore,
  type LabOrder, type LabSource, type RejectReason, type Specimen,
} from "@/store/useLabOrdersStore"
import { type Priority } from "@/lib/labCatalog"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const SOURCE_STYLE: Record<LabSource, string> = {
  OPD: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25",
  IPD: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25",
  ICU: "bg-red-50 text-red-700 ring-red-200",
  OT:  "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25",
  ER:  "bg-primary-soft text-accent ring-primary/25",
}
const PRIORITY_STYLE: Record<Priority, string> = {
  STAT:    "bg-red-100 text-red-700",
  Urgent:  "bg-amber-100 text-amber-700",
  Routine: "bg-slate-100 text-slate-600",
}
const REJECT_REASONS: RejectReason[] = [
  "hemolyzed", "clotted", "insufficient", "wrong_tube", "unlabeled", "contaminated",
]
const SOURCES: LabSource[] = ["OPD", "IPD", "ICU", "OT", "ER"]
const PRIORITIES: Priority[] = ["STAT", "Urgent", "Routine"]

type LabT = ReturnType<typeof useTranslations>
const makeTimeAgo = (t: LabT) => (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('time.justNow')
  if (mins < 60) return t('time.minsAgo', { mins })
  return t('time.hoursAgo', { hours: Math.round(mins / 60) })
}

const orderHasAwaiting = (o: LabOrder) => o.tests.some(t => t.status === "awaiting_collection")
const orderJustCollected = (o: LabOrder) =>
  o.tests.some(t => t.status === "on_bench" || t.status === "collected") &&
  !orderHasAwaiting(o)
const hasRejected = (o: LabOrder) => o.specimens.some(s => s.rejectReason)

export default function LabInbox() {
  const t = useTranslations('lab')
  const orders = useLabOrdersStore(s => s.orders)
  const collectOrder = useLabOrdersStore(s => s.collectOrder)
  const rejectSpecimen = useLabOrdersStore(s => s.rejectSpecimen)
  const recollectOrder = useLabOrdersStore(s => s.recollectOrder)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "Lab User"

  const [tab, setTab] = useState<"awaiting" | "collected">("awaiting")
  const [sourceFilter, setSourceFilter] = useState<"all" | LabSource>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectingAcc, setRejectingAcc] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<RejectReason>("hemolyzed")

  const filtered = useMemo(() => {
    const inTab = tab === "awaiting" ? orderHasAwaiting : orderJustCollected
    return orders.filter(o => inTab(o)
      && (sourceFilter === "all" || o.source === sourceFilter)
      && (priorityFilter === "all" || o.tests.some(t => t.priority === priorityFilter)))
  }, [orders, tab, sourceFilter, priorityFilter])

  const awaitingCount = orders.filter(orderHasAwaiting).length
  const collectedCount = orders.filter(orderJustCollected).length

  const onCollect = (o: LabOrder) => {
    collectOrder(o.id, meName)
    const tubeCount = new Set(o.tests.map(x => o.specimens.find(s => s.accession === x.specimenId)?.type).filter(Boolean)).size
    toast.success(t('inbox.collectedToast', { tubes: tubeCount, tests: o.tests.length }))
    setTab("collected")
  }

  const onRejectConfirm = (o: LabOrder, accession: string) => {
    rejectSpecimen(o.id, accession, rejectReason)
    // M9-D — auto-create the recollect AND notify the ordering doctor +
    // phlebotomy that a fresh draw is required.
    recollectOrder(o.id)
    const reasonText = t(`rejectReason.${rejectReason}`)
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'high',
      title: t('inbox.specimenRejectedTitle', { name: o.patientName }),
      body: t('inbox.specimenRejectedBody', { accession, reason: reasonText }),
      patientName: o.patientName,
      audit: { action: 'lab_order', resource: 'lab_specimen', resourceId: accession, detail: `Specimen rejected (${rejectReason}); recollect created`, userName: 'Lab' },
    })
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'medium',
      title: t('inbox.recollectTitle', { name: o.patientName }),
      body: t('inbox.recollectBodyRedraw', { name: o.patientName, accession, reason: reasonText }),
      patientName: o.patientName,
      audit: { action: 'lab_order', resource: 'lab_specimen', resourceId: accession, detail: `Recollect requested`, userName: 'Lab' },
    })
    setRejectingAcc(null)
    toast.success(t('inbox.specimenRejectedToast', { accession }))
  }

  const onRecollect = (o: LabOrder) => {
    recollectOrder(o.id)
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'medium',
      title: t('inbox.recollectTitle', { name: o.patientName }),
      body: t('inbox.recollectBodyFresh', { name: o.patientName }),
      patientName: o.patientName,
      audit: { action: 'lab_order', resource: 'lab_order', resourceId: o.id, detail: `Recollect requested manually`, userName: 'Lab' },
    })
    toast.success(t('inbox.recollectRequestedToast', { name: o.patientName }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-[var(--color-accent)]" /> {t('inbox.title')}
        </h1>
        <p className="text-sm text-[#64748B] mt-1">{t('inbox.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["awaiting", t('inbox.tabAwaiting', { count: awaitingCount })], ["collected", t('inbox.tabCollected', { count: collectedCount })]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition", tab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          <button onClick={() => setSourceFilter("all")}
            className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer", sourceFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{t('inbox.filterAll')}</button>
          {SOURCES.map(s => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition", sourceFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{s}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          <button onClick={() => setPriorityFilter("all")}
            className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer", priorityFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{t('inbox.filterAnyPriority')}</button>
          {PRIORITIES.map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition", priorityFilter === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{t(`priority.${p}`)}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileCheck2 className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">{tab === "awaiting" ? t('inbox.emptyAwaiting') : t('inbox.emptyCollected')}</p>
          </div>
        )}
        {filtered.map(o => (
          <OrderRow key={o.id} o={o}
            expanded={expandedId === o.id}
            rejectingAcc={rejectingAcc}
            rejectReason={rejectReason}
            onToggle={() => setExpandedId(id => id === o.id ? null : o.id)}
            onCollect={() => onCollect(o)}
            onStartReject={(acc) => { setRejectingAcc(acc); setRejectReason("hemolyzed") }}
            onCancelReject={() => setRejectingAcc(null)}
            setRejectReason={setRejectReason}
            onRejectConfirm={(acc) => onRejectConfirm(o, acc)}
            onRecollect={() => onRecollect(o)} />
        ))}
      </div>
    </div>
  )
}

function OrderRow(props: {
  o: LabOrder; expanded: boolean
  rejectingAcc: string | null; rejectReason: RejectReason
  onToggle: () => void
  onCollect: () => void
  onStartReject: (acc: string) => void
  onCancelReject: () => void
  setRejectReason: (r: RejectReason) => void
  onRejectConfirm: (acc: string) => void
  onRecollect: () => void
}) {
  const t = useTranslations('lab')
  const timeAgo = makeTimeAgo(t)
  const { o, expanded, rejectingAcc, rejectReason } = props
  const awaiting = orderHasAwaiting(o)
  const collected = orderJustCollected(o)
  const rejected = hasRejected(o)
  const stat = o.tests.some(t => t.priority === "STAT")
  const collectedAt = o.specimens.find(s => s.collectedAt)?.collectedAt
  const collectedBy = o.specimens.find(s => s.collectedBy)?.collectedBy

  return (
    <div className={cn("rounded-xl bg-white ring-1 overflow-hidden", rejected ? "ring-red-200" : "ring-slate-200/70")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn("flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg ring-1", SOURCE_STYLE[o.source])}>{o.source}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{o.patientName}</span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">{o.uhid}</span>
            {o.wardBed && <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-0.5"><Bed className="h-3 w-3" />{o.wardBed}</span>}
            {stat && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">STAT</span>}
            {rejected && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />{t('inbox.recollectRequired')}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{o.doctorName}
            <span className="text-slate-400 mx-1">·</span>
            {timeAgo(o.orderedAt)}
            {collected && collectedAt && <>
              <span className="text-slate-400 mx-1">·</span>
              <FlaskConical className="h-3 w-3" /> {t('inbox.collectedByLine', { time: timeAgo(collectedAt), name: collectedBy ?? '' })}
            </>}
          </p>
        </button>

        <div className="hidden md:flex flex-wrap items-center gap-1 max-w-[260px]">
          {o.tests.map(t => (
            <span key={t.id} className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PRIORITY_STYLE[t.priority])} title={t.name}>{t.code}</span>
          ))}
        </div>

        <div className="hidden md:flex flex-col items-end flex-shrink-0 w-20">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5"><IndianRupee className="h-3 w-3" />{o.paymentMode}</span>
          <span className="text-[10px] text-slate-400">{o.tests.length} test{o.tests.length > 1 ? "s" : ""}</span>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {awaiting && (
            <button onClick={props.onCollect}
              className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
              style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))", boxShadow: "0 2px 8px rgba(238,107,38,0.25)" }}>
              <Send className="h-3.5 w-3.5" /> {t('inbox.collect')}
            </button>
          )}
          {!awaiting && rejected && (
            <button onClick={props.onRecollect}
              className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl cursor-pointer">
              <RotateCcw className="h-3.5 w-3.5" /> {t('inbox.orderRecollect')}
            </button>
          )}
          {!awaiting && !rejected && collected && (
            <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">{t('inbox.onBenches')}</span>
          )}
          <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {/* Tests list */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">{t('inbox.testsInOrder')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {o.tests.map(tr => (
                <div key={tr.id} className="bg-white rounded-lg ring-1 ring-slate-200/70 p-2.5 text-sm flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-[var(--color-accent)] flex-shrink-0" />
                  <span className="font-semibold text-slate-800 flex-1 min-w-0 truncate">{tr.name}</span>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", PRIORITY_STYLE[tr.priority])}>{t(`priority.${tr.priority}`)}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">{tr.bench}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Specimens list (after collection) */}
          {o.specimens.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">{t('inbox.specimens')}</p>
              <div className="space-y-2">
                {o.specimens.map(sp => (
                  <SpecimenRow key={sp.accession} sp={sp}
                    rejecting={rejectingAcc === sp.accession}
                    rejectReason={rejectReason}
                    onStartReject={() => props.onStartReject(sp.accession)}
                    onCancelReject={props.onCancelReject}
                    setRejectReason={props.setRejectReason}
                    onRejectConfirm={() => props.onRejectConfirm(sp.accession)} />
                ))}
              </div>
            </div>
          )}

          {o.clinicalNotes && (
            <p className="text-xs text-slate-500 italic">{t('inbox.note', { note: o.clinicalNotes })}</p>
          )}
        </div>
      )}
    </div>
  )
}

function SpecimenRow(props: {
  sp: Specimen; rejecting: boolean; rejectReason: RejectReason
  onStartReject: () => void; onCancelReject: () => void
  setRejectReason: (r: RejectReason) => void
  onRejectConfirm: () => void
}) {
  const t = useTranslations('lab')
  const timeAgo = makeTimeAgo(t)
  const { sp, rejecting, rejectReason } = props
  const isRejected = !!sp.rejectReason
  const isCollected = !!sp.collectedAt
  return (
    <div className={cn("rounded-lg p-2.5 ring-1", isRejected ? "ring-red-200 bg-red-50/50" : "ring-slate-200/70 bg-white")}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-slate-500">{sp.accession}</span>
            <span>{sp.container}</span>
            {isRejected && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase">{sp.rejectReason ? t(`rejectReason.${sp.rejectReason}`) : ''}</span>}
            {isCollected && !isRejected && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{t('inbox.statusCollected')}</span>}
            {!isCollected && !isRejected && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t('inbox.statusPending')}</span>}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{isCollected ? t('inbox.specimenTypeBy', { type: sp.type, name: sp.collectedBy ?? '', time: timeAgo(sp.collectedAt) }) : t('inbox.specimenType', { type: sp.type })}</p>
        </div>
        {!rejecting && isCollected && !isRejected && (
          <button onClick={props.onStartReject}
            className="text-[11px] font-bold text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1">
            <X className="h-3 w-3" /> {t('inbox.reject')}
          </button>
        )}
        {rejecting && (
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={rejectReason} onChange={e => props.setRejectReason(e.target.value as RejectReason)}
              className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2 py-1 cursor-pointer">
              {REJECT_REASONS.map(r => <option key={r} value={r}>{t(`rejectReason.${r}`)}</option>)}
            </Select>
            <button onClick={props.onRejectConfirm}
              className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">{t('common.confirmReject')}</button>
            <button onClick={props.onCancelReject} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1 cursor-pointer">{t('common.cancel')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
