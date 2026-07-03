"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ClipboardCheck, Sparkles, CheckCircle2, AlertTriangle, Copy, FlaskConical, ArrowRight, Plus,
} from "lucide-react"
import { useRadiologyStudiesStore, type RadSource, type PaymentMode } from "@/store/useRadiologyStudiesStore"
import { RADIOLOGY_CATALOG, RADIOLOGY_CODES, PRIORITY_META, PRIORITIES, type Priority } from "@/lib/radiologyCatalog"
import { checkAppropriateness, detectDuplicate, recommendProtocol, classifyPriority } from "@/lib/radiologyAI"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { StatCard } from "@/components/ui/stat-card"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCES: RadSource[] = ["OPD", "IPD", "ICU", "OT", "ER"]
const PAYMENTS: PaymentMode[] = ["Cash", "UPI", "Card", "Insurance", "Credit"]

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"
const priorityChip = (p: Priority): string =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "bg-danger-bg text-danger-strong border-danger/25"
    : p === "Urgent" ? "bg-warning-bg text-brand-amber-strong border-warning/30" : "bg-surface-sunken text-foreground-muted border-border"
const VERDICT_STYLE = {
  appropriate: { chip: "bg-success-bg text-success-strong border-success/25", border: "border-success/25", icon: CheckCircle2, label: "Appropriate" },
  review: { chip: "bg-warning-bg text-brand-amber-strong border-warning/30", border: "border-warning/30", icon: AlertTriangle, label: "Review" },
  "consider-alternative": { chip: "bg-warning-bg text-brand-amber-strong border-warning/30", border: "border-warning/30", icon: AlertTriangle, label: "Consider alternative" },
} as const

export default function OrderDesk() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const addOrder = useRadiologyStudiesStore(s => s.addOrder)

  const [form, setForm] = useState({
    patientId: "", patientName: "", source: "OPD" as RadSource, doctorName: "",
    paymentMode: "Cash" as PaymentMode, code: "CT_ABDOMEN", clinicalQuestion: "", priority: "Routine" as Priority,
  })
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))
  const cat = RADIOLOGY_CATALOG[form.code]

  const appropriateness = useMemo(() => checkAppropriateness(form.code, form.clinicalQuestion, form.priority), [form.code, form.clinicalQuestion, form.priority])
  const protocol = useMemo(() => recommendProtocol(form.code, form.clinicalQuestion), [form.code, form.clinicalQuestion])
  const suggestedPriority = useMemo(() => classifyPriority(form.clinicalQuestion, cat?.defaultPriority ?? "Routine"), [form.clinicalQuestion, cat])
  const duplicate = useMemo(() => {
    if (!form.patientId || !cat) return null
    const probe = { id: "__new__", patientId: form.patientId, bodyPart: cat.bodyPart, modality: cat.modality } as Parameters<typeof detectDuplicate>[0]
    return detectDuplicate(probe, studies).data
  }, [form.patientId, form.code, studies, cat])

  const ordered = useMemo(() => studies.filter(s => s.status === "ordered").sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime()), [studies])

  const submit = () => {
    if (!form.patientName.trim() || !form.patientId.trim()) { toast.error("Patient name and ID required"); return }
    const id = addOrder({
      patientId: form.patientId.trim(), patientName: form.patientName.trim(), source: form.source,
      doctorName: form.doctorName.trim() || "Dr. (referrer)", paymentMode: form.paymentMode,
      code: form.code, clinicalQuestion: form.clinicalQuestion.trim() || undefined, priority: form.priority,
    })
    if (id) { toast.success(`Order created · ${cat?.name}`); setForm(f => ({ ...f, patientId: "", patientName: "", clinicalQuestion: "" })) }
  }

  const V = VERDICT_STYLE[appropriateness.data.verdict]

  return (
    <div className="space-y-6">
      <p className="t-body text-foreground-lighter">
        AI appropriateness · duplicate detection · protocol recommendation · priority classification
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Awaiting workup" value={ordered.length} sub="newly ordered" icon={ClipboardCheck} color="blue" />
        <StatCard label="STAT+" value={ordered.filter(s => PRIORITY_META[s.priority].rank >= 2).length} sub="urgent orders" icon={AlertTriangle} color="red" />
        <StatCard label="Today's orders" value={studies.length} sub="all studies" icon={Plus} color="green" />
        <StatCard label="Catalog" value={RADIOLOGY_CODES.length} sub="orderable exams" icon={FlaskConical} color="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* New order form */}
        <div className="hms-card p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">New radiology order</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Patient name"><input value={form.patientName} onChange={e => set("patientName", e.target.value)} className={inputCls} placeholder="Full name" /></Field>
            <Field label="Patient ID"><input value={form.patientId} onChange={e => set("patientId", e.target.value)} className={inputCls} placeholder="PT-xxxxx" /></Field>
            <Field label="Source"><Select value={form.source} onChange={e => set("source", e.target.value)} className={inputCls}>{SOURCES.map(s => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Referring doctor"><input value={form.doctorName} onChange={e => set("doctorName", e.target.value)} className={inputCls} placeholder="Dr. …" /></Field>
            <Field label="Exam">
              <Select value={form.code} onChange={e => set("code", e.target.value)} className={inputCls}>
                {RADIOLOGY_CODES.map(c => <option key={c} value={c}>{RADIOLOGY_CATALOG[c].name}</option>)}
              </Select>
            </Field>
            <Field label="Payment"><Select value={form.paymentMode} onChange={e => set("paymentMode", e.target.value)} className={inputCls}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</Select></Field>
            <div className="col-span-2"><Field label="Clinical indication"><textarea value={form.clinicalQuestion} onChange={e => set("clinicalQuestion", e.target.value)} rows={2} className={cn(inputCls, "resize-none")} placeholder="e.g. RUQ pain, R/O cholelithiasis" /></Field></div>
            <Field label="Priority">
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map(p => (
                  <button key={p} onClick={() => set("priority", p)}
                    className={cn("u-press text-[10.5px] font-bold uppercase px-2 py-1 rounded border cursor-pointer transition-colors", form.priority === p ? priorityChip(p) : "bg-surface text-foreground-lighter border-border hover:text-foreground")}>{p}</button>
                ))}
              </div>
            </Field>
          </div>
          <button onClick={submit} className="u-press mt-4 w-full h-10 rounded-xl bg-primary-dark text-[#0D2032] font-semibold text-sm hover:bg-primary transition-colors cursor-pointer inline-flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> Create order
          </button>
        </div>

        {/* AI panel */}
        <div className="space-y-3">
          <AiDisclaimer />
          {/* Appropriateness */}
          <div className={cn("rounded-2xl border p-4 bg-surface", V.border)}>
            <div className="flex items-center gap-2 mb-1">
              <V.icon className="h-4 w-4 text-primary-dark" />
              <h4 className="text-[13px] font-bold text-foreground">Appropriateness</h4>
              <span className={cn("ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", V.chip)}>{V.label}</span>
            </div>
            <p className="text-[12.5px] text-foreground-lighter">{appropriateness.data.rationale}</p>
            {appropriateness.data.alternative && <p className="text-[11.5px] text-brand-amber-strong mt-1">Alternative: {appropriateness.data.alternative}</p>}
            <p className="text-[10px] text-foreground-placeholder mt-1">Confidence {Math.round(appropriateness.confidence * 100)}%</p>
          </div>

          {/* Duplicate */}
          {duplicate && (
            <div className="rounded-2xl border border-warning/30 bg-warning-bg/60 p-4">
              <div className="flex items-center gap-2 mb-1"><Copy className="h-4 w-4 text-brand-amber-strong" /><h4 className="text-[13px] font-bold text-brand-amber-strong">Possible duplicate</h4></div>
              <p className="text-[12.5px] text-brand-amber-strong">{duplicate.note}</p>
            </div>
          )}

          {/* Protocol */}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 mb-1"><Sparkles className="h-4 w-4 text-success-strong" /><h4 className="text-[13px] font-bold text-foreground">Protocol recommendation</h4></div>
            <p className="text-[12.5px] text-foreground-muted font-medium">{protocol.data.protocol}</p>
            <p className="text-[11.5px] text-foreground-lighter mt-0.5">{protocol.data.note}</p>
          </div>

          {/* Priority suggestion */}
          {suggestedPriority !== form.priority && (
            <div className="rounded-2xl border border-primary/20 bg-accent-soft p-4 flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary-dark flex-shrink-0" />
              <p className="text-[12.5px] text-foreground-muted flex-1">AI suggests priority <b>{suggestedPriority}</b> from the indication.</p>
              <button onClick={() => set("priority", suggestedPriority)} className="text-[12px] font-semibold text-primary-dark hover:underline cursor-pointer flex-shrink-0">Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Newly ordered list */}
      <div className="hms-card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary-dark" />
          <h3 className="text-sm font-bold text-foreground">Awaiting scheduling</h3>
          <Link href="/radiology/schedule" className="ml-auto text-[12px] font-semibold text-accent hover:underline">Open scheduling →</Link>
        </div>
        {ordered.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No orders awaiting workup" size="sm" />
        ) : (
          <div className="divide-y divide-border-light">
            {ordered.map(s => (
              <Link key={s.id} href="/radiology/schedule" className="u-row flex items-center gap-3 px-5 py-3 hover:bg-surface-sunken group">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-bold text-foreground truncate">{s.patientName}</p>
                    <StatusPill status={priorityStatus(s.priority)} label={s.priority} dense />
                  </div>
                  <p className="text-[11.5px] text-foreground-lighter truncate">{s.name} · {s.clinicalQuestion ?? "—"}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-foreground-placeholder group-hover:text-primary-dark flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const inputCls = "w-full h-9 px-3 rounded-lg text-[13px] bg-surface-sunken border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[11px] font-semibold text-foreground-lighter mb-1">{label}</span>{children}</label>
}
