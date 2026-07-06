"use client"

import { useMemo, useState } from "react"
import {
  Activity, Microscope, FlaskConical, CheckCircle, Bed, Stethoscope, Clock,
  Beaker, Bug, FileText,
} from "lucide-react"
import {
  useLabOrdersStore,
  type LabOrder, type TestRun, type MicrobioResult, type MicroPhase,
  type LabTech,
} from "@/store/useLabOrdersStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const PHASES: { code: MicroPhase; label: string; icon: typeof Activity; emptyHint: string }[] = [
  { code: "inoculated",   label: "Inoculated",   icon: Beaker,        emptyHint: "Fresh cultures land here when their specimen is collected." },
  { code: "growth_check", label: "Growth check", icon: Activity,      emptyHint: "Day 1 — check plates for growth or finalise as no-growth." },
  { code: "identified",   label: "Identified",   icon: Bug,           emptyHint: "Day 2 — organism identified; run an antibiotic sensitivity panel next." },
  { code: "ast",          label: "AST",          icon: FlaskConical,  emptyHint: "Day 3 — review sensitivities, then write the final report." },
  { code: "final",        label: "Final",        icon: CheckCircle,   emptyHint: "Finalised reports stay here until the next session." },
]

const DEFAULT_AST_DRUGS = ["Ceftriaxone", "Ciprofloxacin", "Amoxicillin", "Gentamicin", "Vancomycin", "Meropenem"]

const SOURCE_STYLE: Record<string, string> = {
  OPD: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  IPD: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  ICU: "bg-red-50 text-red-700",
  OT:  "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  ER:  "bg-primary-soft text-accent",
}

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function LabMicrobiology() {
  const orders = useLabOrdersStore(s => s.orders)
  const microAdvance = useLabOrdersStore(s => s.microAdvance)
  const microRelease = useLabOrdersStore(s => s.microRelease)
  const currentUser = useAuthStore(s => s.currentUser)
  const me: LabTech = { id: currentUser?.id ?? "LT-103", name: currentUser?.name ?? "Lab Tech" }

  // Cards to render: in-progress MICRO tests + recently released micro (so the
  // 'Final' column has something while you're working).
  const cards = useMemo(() => {
    const out: { order: LabOrder; test: TestRun }[] = []
    for (const o of orders) {
      for (const t of o.tests) {
        if (t.bench !== "MICRO") continue
        if (t.status !== "in_progress" && t.status !== "released") continue
        if (t.status === "released" && t.micro?.phase !== "final") continue
        out.push({ order: o, test: t })
      }
    }
    return out
  }, [orders])

  const grouped = useMemo(() => {
    const g: Record<MicroPhase, { order: LabOrder; test: TestRun }[]> = {
      inoculated: [], growth_check: [], identified: [], ast: [], final: [],
    }
    for (const c of cards) {
      const ph = c.test.micro?.phase ?? "inoculated"
      g[ph].push(c)
    }
    return g
  }, [cards])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <Activity className="h-6 w-6 text-[var(--color-accent)]" /> Microbiology
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Multi-day culture · Inoculated → Growth check → Identified → AST → Final · final report releases the test</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {PHASES.map(p => (
          <div key={p.code} className="rounded-xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/60">
              <p.icon className="h-4 w-4 text-[var(--color-accent)]" />
              <h2 className="text-sm font-bold text-slate-800">{p.label}</h2>
              <span className="text-xs text-slate-400">{grouped[p.code].length}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[120px]">
              {grouped[p.code].length === 0 && (
                <p className="text-[11px] text-slate-400 leading-snug px-2 py-4 text-center italic">{p.emptyHint}</p>
              )}
              {grouped[p.code].map(({ order, test }) => (
                <MicroCard key={test.id} order={order} test={test} me={me}
                  onAdvance={(patch) => microAdvance(test.id, patch)}
                  onFinalize={(report) => {
                    microAdvance(test.id, { phase: "final", day: (test.micro?.day ?? 0) + 1, finalReport: report })
                    microRelease(test.id, me)
                    toast.success(`${test.name} report finalised & released for ${order.patientName}`)
                  }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MicroCard(props: {
  order: LabOrder; test: TestRun; me: LabTech
  onAdvance: (patch: Partial<MicrobioResult>) => void
  onFinalize: (report: string) => void
}) {
  const { order, test } = props
  const micro: MicrobioResult = test.micro ?? { phase: "inoculated", day: 0 }
  const released = test.status === "released"

  return (
    <div className={cn("rounded-lg ring-1 p-3", released ? "ring-emerald-200 bg-emerald-50/40" : "ring-slate-200/70 bg-white")}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", SOURCE_STYLE[order.source] ?? "bg-slate-100 text-slate-600")}>{order.source}</span>
        <span className="font-bold text-sm text-slate-900 truncate">{order.patientName}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
        <Stethoscope className="h-3 w-3" />{order.doctorName}
        {order.wardBed && <><span className="text-slate-300">·</span><Bed className="h-3 w-3" />{order.wardBed}</>}
      </p>
      <p className="text-[12px] font-semibold text-[var(--color-accent)] mt-1">{test.name}</p>
      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
        <Clock className="h-3 w-3" />Day {micro.day} · {timeAgo(test.orderedAt)}
      </p>

      <div className="mt-2">
        {released && <ReleasedView micro={micro} />}
        {!released && micro.phase === "inoculated" && <InoculatedActions onAdvance={props.onAdvance} onFinalize={props.onFinalize} day={micro.day} />}
        {!released && micro.phase === "growth_check" && micro.growth !== "no_growth" && <GrowthCheckActions onAdvance={props.onAdvance} onFinalize={props.onFinalize} day={micro.day} />}
        {!released && micro.phase === "identified" && <IdentifiedActions micro={micro} onAdvance={props.onAdvance} />}
        {!released && micro.phase === "ast" && <ASTActions micro={micro} onAdvance={props.onAdvance} onFinalize={props.onFinalize} />}
      </div>
    </div>
  )
}

function InoculatedActions({ onAdvance, onFinalize, day }: { onAdvance: (p: Partial<MicrobioResult>) => void; onFinalize: (r: string) => void; day: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => onAdvance({ phase: "growth_check", day: day + 1, growth: "growth" })}
        className="text-[11px] font-bold text-white px-2.5 py-1 rounded-lg cursor-pointer"
        style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))" }}>Growth detected</button>
      <button onClick={() => onFinalize(`No growth after ${(day + 1) * 24} hours of incubation`)}
        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg cursor-pointer">No growth — finalise</button>
    </div>
  )
}

function GrowthCheckActions({ onAdvance, onFinalize, day }: { onAdvance: (p: Partial<MicrobioResult>) => void; onFinalize: (r: string) => void; day: number }) {
  const [organism, setOrganism] = useState("")
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-[var(--color-accent)]">Growth detected — identify organism</p>
      <input value={organism} onChange={e => setOrganism(e.target.value)} placeholder="e.g. E. coli"
        className="w-full h-7 px-2 text-[11px] rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/25" />
      <div className="flex gap-1.5">
        <button onClick={() => {
            if (!organism.trim()) return
            const orgs = [{ name: organism.trim(), ast: [] as MicrobioResult["organisms"] extends Array<infer O> ? (O extends { ast: infer A } ? A : never) : never[] }] as MicrobioResult["organisms"]
            onAdvance({ phase: "identified", day: day + 1, organisms: orgs })
          }}
          disabled={!organism.trim()}
          className="text-[11px] font-bold text-white px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))" }}>Identify</button>
        <button onClick={() => onFinalize(`No significant growth identified — contaminant flora only`)}
          className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg cursor-pointer">No growth — finalise</button>
      </div>
    </div>
  )
}

function IdentifiedActions({ micro, onAdvance }: { micro: MicrobioResult; onAdvance: (p: Partial<MicrobioResult>) => void }) {
  const org = micro.organisms?.[0]
  if (!org) return null

  const setResult = (drug: string, result: "S" | "I" | "R") => {
    const existing = org.ast.filter(a => a.drug !== drug)
    onAdvance({ organisms: [{ ...org, ast: [...existing, { drug, result }] }] })
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-700">{org.name}</p>
      <div className="space-y-1">
        {DEFAULT_AST_DRUGS.map(drug => {
          const current = org.ast.find(a => a.drug === drug)?.result
          return (
            <div key={drug} className="flex items-center gap-1.5 text-[11px]">
              <span className="flex-1 text-slate-600">{drug}</span>
              {(["S", "I", "R"] as const).map(r => (
                <button key={r} onClick={() => setResult(drug, r)}
                  className={cn("w-5 h-5 rounded font-bold text-[10px]", current === r
                    ? r === "S" ? "bg-green-600 text-white" : r === "I" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>{r}</button>
              ))}
            </div>
          )
        })}
      </div>
      <button onClick={() => onAdvance({ phase: "ast", day: micro.day + 1 })}
        disabled={org.ast.length === 0}
        className="w-full text-[11px] font-bold text-white px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
        style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))" }}>Save AST → review</button>
    </div>
  )
}

function ASTActions({ micro, onAdvance, onFinalize }: { micro: MicrobioResult; onAdvance: (p: Partial<MicrobioResult>) => void; onFinalize: (r: string) => void }) {
  const org = micro.organisms?.[0]
  const [report, setReport] = useState(
    org ? `Final report — ${org.name} isolated.\nAST: ${org.ast.map(a => `${a.drug}-${a.result}`).join(", ")}.\nClinical correlation advised.` : ""
  )
  if (!org) return null

  // Allow further AST edits at this phase
  const setResult = (drug: string, result: "S" | "I" | "R") => {
    const existing = org.ast.filter(a => a.drug !== drug)
    onAdvance({ organisms: [{ ...org, ast: [...existing, { drug, result }] }] })
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-700">{org.name}</p>
      <div className="space-y-1">
        {DEFAULT_AST_DRUGS.map(drug => {
          const current = org.ast.find(a => a.drug === drug)?.result
          return (
            <div key={drug} className="flex items-center gap-1.5 text-[11px]">
              <span className="flex-1 text-slate-600">{drug}</span>
              {(["S", "I", "R"] as const).map(r => (
                <button key={r} onClick={() => setResult(drug, r)}
                  className={cn("w-5 h-5 rounded font-bold text-[10px]", current === r
                    ? r === "S" ? "bg-green-600 text-white" : r === "I" ? "bg-amber-500 text-white" : "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200")}>{r}</button>
              ))}
            </div>
          )
        })}
      </div>
      <textarea value={report} onChange={e => setReport(e.target.value)} rows={3}
        className="w-full text-[11px] rounded-md border border-slate-200 p-1.5 focus:outline-none focus:ring-2 focus:ring-primary/25"
        placeholder="Final report" />
      <button onClick={() => onFinalize(report || `${org.name} isolated, AST as documented`)}
        className="w-full text-[11px] font-bold text-white px-2.5 py-1 rounded-lg cursor-pointer flex items-center justify-center gap-1"
        style={{ background: "linear-gradient(135deg,#16A34A,var(--color-primary-dark))" }}>
        <FileText className="h-3 w-3" /> Save final report
      </button>
    </div>
  )
}

function ReleasedView({ micro }: { micro: MicrobioResult }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">RELEASED</span>
      {micro.organisms?.map(org => (
        <div key={org.name}>
          <p className="text-[11px] font-semibold text-slate-700">{org.name}</p>
          <p className="text-[11px] text-slate-500">{org.ast.map(a => `${a.drug}-${a.result}`).join(" · ")}</p>
        </div>
      ))}
      {micro.finalReport && <p className="text-[11px] text-slate-600 italic line-clamp-3">{micro.finalReport}</p>}
    </div>
  )
}
