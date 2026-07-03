"use client"

import { useMemo, useState } from "react"
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Clock, Lock, Unlock } from "lucide-react"
import {
  useLabQCStore, ANALYZERS, type AnalyzerId, type QCRun, type Violation,
} from "@/store/useLabQCStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const timeAgo = (iso?: string) => {
  if (!iso) return ""
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function LabQC() {
  const runs = useLabQCStore(s => s.runs)
  const violations = useLabQCStore(s => s.violations)
  const overrides = useLabQCStore(s => s.overrides)
  const overrideFn = useLabQCStore(s => s.override)
  const clearFn = useLabQCStore(s => s.clear)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "Lab Supervisor"

  const [overriding, setOverriding] = useState<AnalyzerId | null>(null)
  const [reason, setReason] = useState("")

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const activeViolations = ANALYZERS.flatMap(a => (violations[a] ?? []))
    const overridesToday = overrides.filter(o => new Date(o.at).toDateString() === today).length
    return {
      analyzers: ANALYZERS.length,
      activeViolations: activeViolations.length,
      overridesToday,
      analyzerStatus: ANALYZERS.map(a => ({
        id: a,
        active: (violations[a] ?? []).length > 0,
        lastRun: runs.filter(r => r.analyzer === a).slice(-1)[0],
        recentRuns: runs.filter(r => r.analyzer === a).slice(-10),
        analyteOfInterest: runs.filter(r => r.analyzer === a).slice(-1)[0]?.analyte,
      })),
    }
  }, [runs, violations, overrides])

  const onOverride = (a: AnalyzerId) => {
    if (!reason.trim()) { toast.error("Reason is required for override"); return }
    overrideFn(a, meName, reason.trim())
    setOverriding(null); setReason("")
    toast.success(`${a} override recorded · release unblocked`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[var(--color-accent)]" /> Quality Control
        </h1>
        <p className="text-sm text-[#64748B] mt-1">Levey-Jennings runs &middot; Westgard rules &middot; active violations block release on the affected analyzer</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Analyzers", value: stats.analyzers, icon: ShieldCheck, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: "Active violations", value: stats.activeViolations, icon: XCircle, fg: "text-red-600", bg: "bg-red-50" },
          { label: "Overrides today", value: stats.overridesToday, icon: Unlock, fg: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-4 flex items-center gap-4", s.bg)}>
            <div className="p-3 rounded-xl bg-white shadow-sm"><s.icon className={cn("h-5 w-5", s.fg)} /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p><h3 className="text-2xl font-bold text-slate-900">{s.value}</h3></div>
          </div>
        ))}
      </div>

      {/* Per-analyzer cards with Levey-Jennings sparkline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.analyzerStatus.map(s => {
          const activeViolations = violations[s.id] ?? []
          return (
            <div key={s.id} className={cn("rounded-xl bg-white ring-1 p-4 space-y-3", s.active ? "ring-red-300" : "ring-slate-200/70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{s.id}</p>
                  <p className="text-[11px] text-slate-500">{s.recentRuns.length} runs · last {timeAgo(s.lastRun?.at)}</p>
                </div>
                {s.active
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><XCircle className="h-3 w-3" />VIOLATION</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" />OK</span>}
              </div>

              {/* Levey-Jennings sparkline */}
              {s.lastRun && <LJChart runs={s.recentRuns} />}

              {/* Active violations */}
              {activeViolations.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 space-y-2">
                  {activeViolations.map((v, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-bold text-red-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{v.rule.toUpperCase()} · {v.severity.toUpperCase()}</p>
                      <p className="text-red-600 mt-0.5">{v.note}</p>
                      <p className="text-[10px] text-red-400 mt-0.5">{timeAgo(v.at)}</p>
                    </div>
                  ))}
                  {overriding === s.id ? (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <input value={reason} onChange={e => setReason(e.target.value)}
                        placeholder="Override reason (required)"
                        className="flex-1 min-w-0 h-7 px-2 text-[11px] rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/25" />
                      <button onClick={() => onOverride(s.id)}
                        className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1 rounded-lg cursor-pointer">Confirm override</button>
                      <button onClick={() => { setOverriding(null); setReason("") }}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setOverriding(s.id)}
                        className="text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1"><Unlock className="h-3 w-3" />Override (supervisor)</button>
                      <button onClick={() => { clearFn(s.id); toast.success(`${s.id} QC cleared`) }}
                        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1"><CheckCircle className="h-3 w-3" />Clear (resolved)</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Override audit */}
      {overrides.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1"><Lock className="h-4 w-4" />Override audit</h2>
          <div className="space-y-1.5">
            {overrides.slice(-10).reverse().map((o, i) => (
              <div key={i} className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                <Clock className="h-3 w-3 text-slate-400" />{timeAgo(o.at)}
                <span className="font-semibold">{o.analyzer}</span>
                <span>by <b>{o.by}</b></span>
                <span className="text-slate-400">·</span>
                <span className="italic">{o.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LJChart({ runs }: { runs: QCRun[] }) {
  if (runs.length === 0) return null
  const w = 240, h = 50, pad = 4
  const ref = runs[runs.length - 1]
  // z range -4..+4
  const yFor = (val: number) => {
    const zScore = (val - ref.mean) / ref.sd
    const clamped = Math.max(-4, Math.min(4, zScore))
    return h / 2 - (clamped / 4) * (h / 2 - pad)
  }
  const xFor = (i: number) => pad + (i / Math.max(1, runs.length - 1)) * (w - 2 * pad)
  const linePath = runs.map((r, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(r.value).toFixed(1)}`).join(" ")

  return (
    <svg width={w} height={h} className="w-full">
      {/* zones */}
      <rect x={0} y={yFor(ref.mean + 3 * ref.sd)} width={w} height={yFor(ref.mean - 3 * ref.sd) - yFor(ref.mean + 3 * ref.sd)} fill="#FEE2E2" opacity={0.3} />
      <rect x={0} y={yFor(ref.mean + 2 * ref.sd)} width={w} height={yFor(ref.mean - 2 * ref.sd) - yFor(ref.mean + 2 * ref.sd)} fill="#FEF3C7" opacity={0.3} />
      {/* mean line */}
      <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="#94A3B8" strokeDasharray="2 2" />
      {/* path */}
      <path d={linePath} fill="none" stroke="var(--color-primary-dark)" strokeWidth={1.5} />
      {/* points */}
      {runs.map((r, i) => {
        const z = (r.value - ref.mean) / ref.sd
        const color = Math.abs(z) > 3 ? "#DC2626" : Math.abs(z) > 2 ? "#D97706" : "#16A34A"
        return <circle key={r.id} cx={xFor(i)} cy={yFor(r.value)} r={2.5} fill={color} />
      })}
    </svg>
  )
}
