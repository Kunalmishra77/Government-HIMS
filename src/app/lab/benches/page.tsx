"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import {
  Microscope, FlaskConical, Bed, Stethoscope, ChevronDown, ChevronRight,
  Hand, Send, ShieldCheck, CheckCircle, X, Clock, ShieldX, Unlock,
} from "lucide-react"
import {
  useLabOrdersStore,
  type LabOrder, type TestRun, type TestStatus, type AnalyteFlag,
  type LabTech, type RejectReason,
} from "@/store/useLabOrdersStore"
import { LAB_CATALOG, type Bench, type Priority } from "@/lib/labCatalog"
import { useLabQCStore, isBlocked, type AnalyzerId } from "@/store/useLabQCStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const BENCH_TABS: { code: Bench; label: string }[] = [
  { code: "HEMA",    label: "Hematology" },
  { code: "BIOCHEM", label: "Biochemistry" },
  { code: "IMMUNO",  label: "Immunology" },
  { code: "URINE",   label: "Urinalysis" },
]

const STATUS_STYLE: Record<TestStatus, string> = {
  awaiting_collection: "bg-slate-100 text-slate-500",
  collected:           "bg-amber-100 text-amber-700",
  on_bench:            "bg-amber-100 text-amber-700",
  in_progress:         "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]",
  entered:             "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]",
  verified:            "bg-emerald-100 text-emerald-700",
  released:            "bg-slate-100 text-slate-500",
  rejected:            "bg-red-100 text-red-700",
  recollect_requested: "bg-red-100 text-red-700",
}
const STATUS_LABEL: Record<TestStatus, string> = {
  awaiting_collection: "Awaiting", collected: "Collected", on_bench: "On bench",
  in_progress: "In progress", entered: "Pending verify", verified: "Pending release",
  released: "Released", rejected: "Rejected", recollect_requested: "Recollect",
}
const FLAG_STYLE: Record<AnalyteFlag, string> = {
  N:  "bg-slate-100 text-slate-500",
  H:  "bg-amber-100 text-amber-700",
  L:  "bg-amber-100 text-amber-700",
  CH: "bg-red-100 text-red-700",
  CL: "bg-red-100 text-red-700",
}
const FLAG_LABEL: Record<AnalyteFlag, string> = { N: "Normal", H: "High", L: "Low", CH: "Critical high", CL: "Critical low" }
const PRIORITY_STYLE: Record<Priority, string> = {
  STAT: "bg-red-100 text-red-700", Urgent: "bg-amber-100 text-amber-700", Routine: "bg-slate-100 text-slate-600",
}
const REJECT_REASONS: { value: RejectReason; label: string }[] = [
  { value: "hemolyzed", label: "Hemolyzed" },
  { value: "clotted", label: "Clotted" },
  { value: "insufficient", label: "Insufficient volume" },
  { value: "contaminated", label: "Contaminated" },
]

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

const STATUS_SORT: Record<TestStatus, number> = {
  in_progress: 0, entered: 1, verified: 2, on_bench: 3, collected: 4,
  released: 5, awaiting_collection: 6, rejected: 7, recollect_requested: 8,
}

export default function LabBenches() {
  const orders = useLabOrdersStore(s => s.orders)
  const claim = useLabOrdersStore(s => s.claim)
  const unclaim = useLabOrdersStore(s => s.unclaim)
  const enterAnalyte = useLabOrdersStore(s => s.enterAnalyte)
  const finishEntry = useLabOrdersStore(s => s.finishEntry)
  const verifyTest = useLabOrdersStore(s => s.verifyTest)
  const releaseTest = useLabOrdersStore(s => s.releaseTest)
  const rejectTest = useLabOrdersStore(s => s.rejectTest)
  const qcViolations = useLabQCStore(s => s.violations)
  const qcOverride = useLabQCStore(s => s.override)

  const currentUser = useAuthStore(s => s.currentUser)
  const me: LabTech = { id: currentUser?.id ?? "LT-101", name: currentUser?.name ?? "Lab Tech" }

  const [bench, setBench] = useState<Bench>("HEMA")
  const [scope, setScope] = useState<"all" | "mine">("all")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<RejectReason>("contaminated")
  const [overridingId, setOverridingId] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState("")

  // Walk orders → test rows for the active bench, with parent order info.
  const rows = useMemo(() => {
    const all: { order: LabOrder; test: TestRun }[] = []
    for (const o of orders) {
      for (const t of o.tests) {
        if (t.bench !== bench) continue
        if (t.status === "awaiting_collection" || t.status === "rejected" || t.status === "recollect_requested") continue
        if (scope === "mine" && t.assignedTo?.id !== me.id) continue
        const overdue = t.status !== "released" && Math.round((Date.now() - new Date(t.orderedAt).getTime()) / 60000) > t.expectedTATmin
        if (overdueOnly && !overdue) continue
        all.push({ order: o, test: t })
      }
    }
    return all.sort((a, b) => STATUS_SORT[a.test.status] - STATUS_SORT[b.test.status])
  }, [orders, bench, scope, overdueOnly, me.id])

  const benchCounts = useMemo(() => {
    const counts: Record<Bench, number> = { HEMA: 0, BIOCHEM: 0, IMMUNO: 0, URINE: 0, MICRO: 0, HISTO: 0 }
    for (const o of orders) for (const t of o.tests) {
      if (t.status === "awaiting_collection" || t.status === "released" || t.status === "rejected" || t.status === "recollect_requested") continue
      counts[t.bench]++
    }
    return counts
  }, [orders])

  // Queue = collected/on-bench specimens no technician has started yet; they wait here
  // until someone accepts them. Processing = tests a technician has claimed and is working.
  const isQueued = (t: TestRun) => (t.status === "on_bench" || t.status === "collected") && !t.assignedTo
  const queueRows = rows.filter(r => isQueued(r.test))
  const processingRows = rows.filter(r => !isQueued(r.test))

  const renderBenchRow = ({ order, test }: { order: LabOrder; test: TestRun }) => {
    const analyzer = LAB_CATALOG[test.code]?.analyzer as AnalyzerId | undefined
    const qcBlocked = isBlocked(analyzer, qcViolations)
    return (
      <BenchRow key={test.id} order={order} test={test} me={me}
        expanded={expandedId === test.id}
        rejecting={rejecting === test.id} rejectReason={rejectReason}
        qcBlocked={qcBlocked}
        qcAnalyzer={analyzer}
        overriding={overridingId === test.id}
        overrideReason={overrideReason}
        setOverrideReason={setOverrideReason}
        onStartOverride={() => { setOverridingId(test.id); setOverrideReason("") }}
        onCancelOverride={() => { setOverridingId(null); setOverrideReason("") }}
        onConfirmOverride={() => {
          if (!analyzer) return
          if (!overrideReason.trim()) { toast.error("Override reason required"); return }
          qcOverride(analyzer, me.name, overrideReason.trim())
          setOverridingId(null); setOverrideReason("")
          toast.success(`${analyzer} override recorded · release unblocked`)
        }}
        onToggle={() => setExpandedId(id => id === test.id ? null : test.id)}
        onClaim={() => { claim(test.id, me); setExpandedId(test.id); toast.success(`${test.name} accepted onto your counter`) }}
        onUnclaim={() => { unclaim(test.id); toast(`${test.name} released to the bench`) }}
        onEnter={(analyte, value) => enterAnalyte(test.id, analyte, value)}
        onFinish={() => {
          if (test.analytes.some(a => a.value === "" || a.value === undefined)) {
            toast.error("All analyte values are required before sending for verification."); return
          }
          finishEntry(test.id, me); toast.success(`${test.name} sent for verification`)
        }}
        onVerify={() => { verifyTest(test.id, me); toast.success(`${test.name} verified`) }}
        onRelease={() => { releaseTest(test.id); toast.success(`${test.name} released · doctor notified`) }}
        onStartReject={() => { setRejecting(test.id); setRejectReason("contaminated") }}
        onCancelReject={() => setRejecting(null)}
        setRejectReason={setRejectReason}
        onConfirmReject={() => { rejectTest(test.id, rejectReason); setRejecting(null); toast(`${test.name} rejected (${rejectReason})`) }} />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <Microscope className="h-6 w-6 text-[var(--color-accent)]" /> Benches
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Claim → enter results → send for verification → verify → release · live H/L/Critical flagging against reference ranges</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {BENCH_TABS.map(b => (
            <button key={b.code} onClick={() => setBench(b.code)}
              className={cn("px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition", bench === b.code ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {b.label} <span className="ml-1 text-[10px] font-bold text-slate-400">{benchCounts[b.code]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["all", "All"], ["mine", "My counter"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setScope(k)}
              className={cn("px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition", scope === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{label}</button>
          ))}
        </div>
        <button onClick={() => setOverdueOnly(v => !v)}
          className={cn("px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer transition", overdueOnly ? "bg-red-100 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-500 hover:text-slate-700")}>
          Overdue only
        </button>
      </div>

      {rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FlaskConical className="h-9 w-9 mb-2 opacity-40" />
          <p className="text-sm font-semibold">No tests on this bench right now</p>
        </div>
      )}

      {/* Queue — collected specimens waiting for a technician to start */}
      {queueRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-bold text-slate-700">Queue — awaiting technician</h2>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">{queueRows.length}</span>
            <span className="text-[11px] text-slate-400">Accept a specimen to start processing</span>
          </div>
          {queueRows.map(renderBenchRow)}
        </div>
      )}

      {/* Processing — tests a technician has claimed and is actively working */}
      {processingRows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Microscope className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-bold text-slate-700">On bench — processing</h2>
            <span className="text-[11px] font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.12)] rounded-full px-2 py-0.5">{processingRows.length}</span>
          </div>
          {processingRows.map(renderBenchRow)}
        </div>
      )}
    </div>
  )
}

function BenchRow(props: {
  order: LabOrder; test: TestRun; me: LabTech
  expanded: boolean; rejecting: boolean; rejectReason: RejectReason
  qcBlocked: boolean; qcAnalyzer?: AnalyzerId
  overriding: boolean; overrideReason: string
  setOverrideReason: (r: string) => void
  onStartOverride: () => void; onCancelOverride: () => void; onConfirmOverride: () => void
  onToggle: () => void
  onClaim: () => void; onUnclaim: () => void
  onEnter: (analyte: string, value: number | string) => void
  onFinish: () => void; onVerify: () => void; onRelease: () => void
  onStartReject: () => void; onCancelReject: () => void
  setRejectReason: (r: RejectReason) => void; onConfirmReject: () => void
}) {
  const { order, test, me, expanded, rejecting, rejectReason, qcBlocked, qcAnalyzer, overriding, overrideReason } = props
  const mine = test.assignedTo?.id === me.id
  const cat = LAB_CATALOG[test.code]
  const minsElapsed = Math.round((Date.now() - new Date(test.orderedAt).getTime()) / 60000)
  const overdue = minsElapsed > test.expectedTATmin && test.status !== "released"

  return (
    <div className={cn("rounded-xl bg-white ring-1 overflow-hidden", overdue && test.status !== "released" ? "ring-red-200" : "ring-slate-200/70")}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn("flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg", PRIORITY_STYLE[test.priority])}>{test.priority}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{order.patientName}</span>
            <span className="text-[11px] font-bold text-slate-400">{order.patientId}</span>
            {order.wardBed && <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-0.5"><Bed className="h-3 w-3" />{order.wardBed}</span>}
            <span className="text-[11px] font-semibold text-slate-500">·</span>
            <span className="text-[12px] font-bold text-[var(--color-accent)]">{test.name}</span>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STATUS_STYLE[test.status])}>{STATUS_LABEL[test.status]}</span>
            {test.assignedTo && <span className="text-[11px] font-semibold text-slate-400">· {mine ? "your counter" : `on ${test.assignedTo.name}`}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{order.doctorName}
            <span className="text-slate-400 mx-1">·</span>
            <Clock className="h-3 w-3" />{minsElapsed}m elapsed / {test.expectedTATmin}m TAT
            {overdue && <span className="text-red-600 font-bold ml-1">overdue</span>}
          </p>
        </button>

        <div className="flex-shrink-0 flex items-center gap-2">
          {test.status === "on_bench" && !test.assignedTo && (
            <ActionBtn onClick={props.onClaim} icon={Hand}>Accept</ActionBtn>
          )}
          {test.status === "on_bench" && test.assignedTo && !mine && (
            <ActionBtn onClick={props.onClaim} icon={Hand} tone="ghost">Take over</ActionBtn>
          )}
          {test.status === "in_progress" && mine && (
            <ActionBtn onClick={props.onFinish} icon={Send}>Send for verification</ActionBtn>
          )}
          {test.status === "entered" && (
            <ActionBtn onClick={props.onVerify} icon={ShieldCheck}>Verify</ActionBtn>
          )}
          {test.status === "verified" && !qcBlocked && (
            <ActionBtn onClick={props.onRelease} icon={CheckCircle}>Release</ActionBtn>
          )}
          {test.status === "verified" && qcBlocked && !overriding && (
            <>
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-red-100 text-red-700 flex items-center gap-1 whitespace-nowrap"><ShieldX className="h-3 w-3" />Release blocked — QC fail ({qcAnalyzer})</span>
              <button onClick={props.onStartOverride} className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg cursor-pointer flex items-center gap-1"><Unlock className="h-3 w-3" />Override</button>
            </>
          )}
          {test.status === "verified" && qcBlocked && overriding && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <input value={overrideReason} onChange={e => props.setOverrideReason(e.target.value)}
                placeholder="Override reason"
                className="w-44 h-7 px-2 text-[11px] rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/25" />
              <button onClick={props.onConfirmOverride} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">Confirm override</button>
              <button onClick={props.onCancelOverride} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
            </div>
          )}
          {test.status === "released" && (
            <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">Released · {timeAgo(test.releasedAt)}</span>
          )}
          <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {cat && cat.analytes.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                {test.status === "in_progress" && mine ? "Enter results" : "Results"}
              </p>
              <div className="space-y-1.5">
                {cat.analytes.map(spec => {
                  const result = test.analytes.find(a => a.analyte === spec.analyte)
                  const isEditable = test.status === "in_progress" && mine
                  return (
                    <div key={spec.analyte} className="bg-white rounded-lg ring-1 ring-slate-200/70 p-2.5 grid grid-cols-12 items-center gap-2">
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{spec.analyte}</p>
                        <p className="text-[11px] text-slate-400">{spec.refLow !== undefined && spec.refHigh !== undefined ? `Ref ${spec.refLow}–${spec.refHigh} ${spec.unit}` : (spec.isText ? "Qualitative" : `Unit: ${spec.unit}`)}</p>
                      </div>
                      <div className="col-span-4 flex items-center gap-2">
                        {isEditable ? (
                          <input
                            type={spec.isText ? "text" : "number"}
                            step="any"
                            data-test={test.id}
                            data-analyte={spec.analyte}
                            defaultValue={result?.value === "" || result?.value === undefined ? "" : String(result.value)}
                            onBlur={(e) => {
                              const raw = e.target.value
                              const v = spec.isText ? raw : (raw === "" ? "" : Number(raw))
                              props.onEnter(spec.analyte, v)
                            }}
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 text-sm" />
                        ) : (
                          <span className="text-sm font-bold text-slate-800">{result?.value ?? "—"} <span className="text-[11px] font-normal text-slate-400">{spec.unit}</span></span>
                        )}
                      </div>
                      <div className="col-span-3 flex items-center justify-end">
                        {result && result.value !== "" && result.value !== undefined && (
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase", FLAG_STYLE[result.flag])}>{FLAG_LABEL[result.flag]}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {test.status === "in_progress" && mine && (
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              {!rejecting && (
                <button onClick={props.onStartReject} className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer flex items-center gap-1"><X className="h-3 w-3" />Reject sample</button>
              )}
              {rejecting && (
                <div className="flex items-center gap-2">
                  <Select value={rejectReason} onChange={e => props.setRejectReason(e.target.value as RejectReason)}
                    className="text-xs font-semibold rounded-lg border border-slate-200 bg-white px-2 py-1 cursor-pointer">
                    {REJECT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                  <button onClick={props.onConfirmReject} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">Confirm reject</button>
                  <button onClick={props.onCancelReject} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                </div>
              )}
              <button onClick={props.onUnclaim} className="ml-auto text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Return to bench</button>
            </div>
          )}

          {test.status === "entered" && (
            <p className="text-xs text-slate-500">Entered by <b>{test.enteredBy?.name ?? "—"}</b> · awaiting senior verification.</p>
          )}
          {test.status === "verified" && (
            <p className="text-xs text-slate-500">Verified by <b>{test.verifiedBy?.name ?? "—"}</b> · ready to release to the ordering doctor.</p>
          )}
          {test.status === "released" && (
            <p className="text-xs text-emerald-600 font-semibold">Released · doctor and patient notified.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, children, icon: Icon, tone = "brand" }: { onClick: () => void; children: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone?: "brand" | "ghost" }) {
  return (
    <button onClick={onClick}
      className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap",
        tone === "ghost" && "text-slate-600 bg-slate-100 hover:bg-slate-200")}
      style={tone === "brand" ? { background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))", color: "#fff", boxShadow: "0 2px 8px rgba(238,107,38,0.25)" } : undefined}>
      <Icon className="h-3.5 w-3.5" />{children}
    </button>
  )
}
