"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Sparkles, Siren, Activity, TrendingUp, Send, Bot, ArrowRight,
  AlertTriangle, Brain, Gauge, Clock, ListOrdered, ScanLine,
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts"
import { useRadiologyStudiesStore, type RadiologyStudy, type AiFinding } from "@/store/useRadiologyStudiesStore"
import { type Priority, priorityRank } from "@/lib/radiologyCatalog"
import {
  detectFindings, forecastWorkload, opsAssistantAnswer, type OpsAnswer,
} from "@/lib/radiologyAI"
import { getConfidenceTier } from "@/lib/ai-helpers"
import { StatCard } from "@/components/ui/stat-card"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { studyStatusToken } from "@/lib/statusColors"
import { ClientOnly } from "@/components/ClientOnly"
import { cn } from "@/lib/utils"

// Studies that have been acquired have images → eligible for AI detection.
const POST_ACQUISITION = new Set(["acquired", "reading", "reported", "released"])
// Studies waiting to be scanned — these appear in the "In Queue" worklist.
const PRE_ACQUISITION = new Set(["ordered", "scheduled", "arrived", "acquiring"])

type QueueItem = { study: RadiologyStudy; findings: AiFinding[]; top: AiFinding; score: number }

// Finding category → triple-encoded clinical status (inline, not a colour map).
const catStatus = (c: AiFinding["category"]): Status =>
  c === "critical" ? "critical" : c === "actionable" ? "caution" : "stable"

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

export default function AiCommandCenter() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const [query, setQuery] = useState("")
  const [answer, setAnswer] = useState<OpsAnswer | null>(null)

  // Pending worklist — studies ordered but not yet acquired (no images to read yet).
  const pendingQueue = useMemo(() => {
    return studies
      .filter(s => PRE_ACQUISITION.has(s.status))
      .sort((a, b) => {
        const rA = priorityRank(a.priority), rB = priorityRank(b.priority)
        if (rA !== rB) return rB - rA  // higher rank = more urgent
        return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
      })
  }, [studies])

  // AI Queue — derive findings deterministically for post-acquisition studies.
  const queue = useMemo<QueueItem[]>(() => {
    return studies
      .filter(s => POST_ACQUISITION.has(s.status))
      .map(study => {
        const findings = detectFindings(study).data
        const top = findings.find(f => f.category === "critical")
          ?? findings.find(f => f.category === "actionable")
          ?? findings[0]
        const critWeight = top?.category === "critical" ? 2 : top?.category === "actionable" ? 1 : 0
        const score = critWeight * 100 + (top?.confidence ?? 0) * 50 + priorityRank(study.priority) * 10
        return { study, findings, top, score }
      })
      .filter(q => q.top && q.top.category !== "normal")
      .sort((a, b) => b.score - a.score)
  }, [studies])

  const forecast = useMemo(() => forecastWorkload(studies), [studies])

  const criticalCount = queue.filter(q => q.top.category === "critical").length
  const avgConf = queue.length ? Math.round((queue.reduce((n, q) => n + q.top.confidence, 0) / queue.length) * 100) : 0

  const suggestions = [
    "Show CT studies delayed over 2 hours",
    "Which modality is causing most TAT breaches?",
    "List high no-show risk patients",
    "How many studies today?",
  ]
  const ask = (q: string) => { setQuery(q); setAnswer(opsAssistantAnswer(q, studies)) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="t-body text-foreground-lighter max-w-2xl">
          High-risk AI queue · workload forecast · natural-language operations assistant
        </p>
        <Link href="/radiology/critical" className="u-press inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold text-[#0D2032] bg-primary-dark hover:bg-primary transition-colors">
          <Siren className="h-4 w-4" /> Critical Results
        </Link>
      </div>

      <AiDisclaimer />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="In queue" value={pendingQueue.length} sub="awaiting scan / scheduling" icon={ListOrdered} color="blue" />
        <StatCard label="Critical detections" value={criticalCount} sub="urgent AI findings" icon={Siren} color="red" />
        <StatCard label="Mean confidence" value={`${avgConf}%`} sub="across flagged studies" icon={Gauge} color="green" />
        <StatCard label="24h TAT risk" value={`${forecast.tatRiskPct}%`} sub="predicted breach pressure" icon={Clock} color="amber" />
      </div>

      {/* Pending worklist — newly ordered studies awaiting scheduling / acquisition */}
      {pendingQueue.length > 0 && (
        <div className="hms-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <ScanLine className="h-4 w-4 text-accent" />
            <h3 className="t-title text-foreground">In Queue — awaiting scan</h3>
            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-accent-soft text-primary-dark text-[11px] font-bold">{pendingQueue.length}</span>
            <span className="ml-auto text-[11px] font-semibold text-foreground-placeholder">sorted by priority</span>
          </div>
          <div className="divide-y divide-border-light">
            {pendingQueue.map((study, idx) => {
              const st = studyStatusToken(study.status)
              return (
                <div key={study.id} className="u-row flex items-center gap-3 px-5 py-3.5">
                  <span className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent-soft text-accent text-xs font-bold border border-primary/15">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13.5px] font-bold text-foreground truncate">{study.patientName}</p>
                      <span className="text-[11px] text-foreground-placeholder">{study.patientId}</span>
                      <StatusPill status={priorityStatus(study.priority)} label={study.priority} dense />
                      <StatusPill status={st.status} label={st.label} dense />
                    </div>
                    <p className="text-[11.5px] text-foreground-lighter mt-0.5 truncate">
                      {study.name} · {study.source} · Ordered by {study.doctorName} · {minsAgo(study.orderedAt)}m ago
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* AI Queue */}
        <div className="lg:col-span-2 hms-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Brain className="h-4 w-4 text-primary-dark" />
            <h3 className="t-title text-foreground">AI Queue — high-risk studies</h3>
            <span className="ml-auto text-[11px] font-semibold text-foreground-placeholder">sorted by urgency</span>
          </div>
          {queue.length === 0 ? (
            <EmptyState icon={Brain} title="No high-risk studies in the pipeline" size="sm" />
          ) : (
            <div className="divide-y divide-border-light">
              {queue.map(({ study, top, findings }) => (
                <Link key={study.id} href="/radiology/reading"
                  className="u-row flex items-center gap-3 px-5 py-3.5 group">
                  <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    top.category === "critical" ? "bg-danger-bg text-danger" : top.category === "actionable" ? "bg-warning-bg text-brand-amber-strong" : "bg-success-bg text-success-strong")}>
                    {top.category === "critical" ? <AlertTriangle className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13.5px] font-bold text-foreground truncate">{top.label}</p>
                      <StatusPill status={catStatus(top.category)} label={top.category} dense className="capitalize" />
                      <StatusPill status={priorityStatus(study.priority)} label={study.priority} dense />
                      {findings.length > 1 && <span className="text-[10px] text-foreground-placeholder">+{findings.length - 1} more</span>}
                    </div>
                    <p className="text-[11.5px] text-foreground-lighter truncate">{study.patientName} · {study.name} · {study.status}</p>
                  </div>
                  <AiConfidenceBadge confidence={top.confidence} tier={getConfidenceTier(top.confidence)} />
                  <ArrowRight className="h-4 w-4 text-foreground-placeholder group-hover:text-primary-dark group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right rail: forecast + assistant */}
        <div className="space-y-5">
          {/* Workload forecast */}
          <div className="hms-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-success-strong" />
              <h3 className="t-title text-foreground">AI Workload Forecast</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl bg-surface-raised border border-border p-3">
                <p className="t-overline text-foreground-lighter">Next 24h volume</p>
                <p className="t-kpi text-xl mt-0.5">{forecast.next24hVolume}</p>
              </div>
              <div className="rounded-xl bg-surface-raised border border-border p-3">
                <p className="t-overline text-foreground-lighter">Staffing need</p>
                <p className="t-kpi text-xl mt-0.5">{forecast.staffingNeed} <span className="text-xs font-medium text-foreground-placeholder">radiologists</span></p>
              </div>
            </div>
            <ClientOnly fallback={<div className="h-[120px]" />}>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={forecast.series} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={26} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 11 }} />
                  <Bar dataKey="volume" radius={[3, 3, 0, 0]}>
                    {forecast.series.map((_, i) => <Cell key={i} fill={i >= 3 && i <= 5 ? "var(--color-primary-dark)" : "#93B4FF"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ClientOnly>
            <div className="mt-2 space-y-1">
              {forecast.byModality.map(m => (
                <div key={m.modality} className="flex items-center justify-between text-[11.5px]">
                  <span className="font-semibold text-foreground-lighter">{m.modality}</span>
                  <span className="tabular-nums text-foreground-lighter">{m.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ops assistant */}
          <div className="hms-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-primary-dark" />
              <h3 className="t-title text-foreground">AI Operations Assistant</h3>
            </div>
            <form onSubmit={e => { e.preventDefault(); if (query.trim()) ask(query) }} className="relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ask about TAT, modalities, no-shows…"
                aria-label="Ask the operations assistant"
                className="w-full h-10 pl-3.5 pr-10 rounded-xl text-[13px] bg-surface-sunken border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button type="submit" aria-label="Ask" className="u-press absolute right-1.5 top-1.5 h-7 w-7 rounded-lg bg-primary-dark text-[#0D2032] flex items-center justify-center hover:bg-primary cursor-pointer transition-colors">
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {suggestions.map(s => (
                <button key={s} onClick={() => ask(s)}
                  className="text-[10.5px] font-medium text-foreground-muted bg-surface border border-border rounded-full px-2.5 py-1 hover:border-primary hover:text-primary-dark transition-colors cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
            {answer && (
              <div className="mt-3 rounded-xl bg-accent-soft border border-primary/15 p-3">
                <p className="text-[12.5px] font-semibold text-foreground">{answer.text}</p>
                {answer.rows && answer.rows.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {answer.rows.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-[11.5px] border-t border-primary/15 pt-1 first:border-0 first:pt-0">
                        <span className="text-foreground-lighter truncate pr-2">{r.label}</span>
                        <span className="font-bold text-primary-dark tabular-nums flex-shrink-0">{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-foreground-placeholder flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> Simulated analytics over live study data · verify before acting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
