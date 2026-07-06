"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Gauge, TrendingUp, TrendingDown, Crown, RefreshCw } from "lucide-react"
import { CompactHeader } from "@/components/ui/CompactHeader"
import { cn } from "@/lib/utils"
import {
  CHAIRMAN_SCORECARDS, EXECUTIVE_KPIS, KPI_GROUPS,
  type Kpi, type KpiTone,
} from "@/data/cooKpis"

const TONE: Record<KpiTone, { ring: string; bar: string; dot: string; label: string }> = {
  neutral: { ring: "ring-border",       bar: "bg-foreground-placeholder", dot: "bg-foreground-placeholder", label: "text-foreground-lighter" },
  info:    { ring: "ring-primary/15",   bar: "bg-primary",                dot: "bg-primary",                label: "text-accent" },
  ok:      { ring: "ring-success/20",   bar: "bg-success",                dot: "bg-success",                label: "text-success-strong" },
  warn:    { ring: "ring-warning/25",   bar: "bg-warning",                dot: "bg-warning",                label: "text-brand-amber-strong" },
  danger:  { ring: "ring-danger/25",    bar: "bg-danger",                 dot: "bg-danger",                 label: "text-danger-strong" },
}

function TrendPill({ trend }: { trend: NonNullable<Kpi["trend"]> }) {
  const Icon = trend.up ? TrendingUp : TrendingDown
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10.5px] font-semibold tabular-nums px-1 py-0.5 rounded-md",
      trend.up ? "bg-success-bg text-success" : "bg-danger-bg text-danger",
    )}>
      <Icon className="h-2.5 w-2.5" />{trend.value}
    </span>
  )
}

function KpiTile({ kpi, index }: { kpi: Kpi; index: number }) {
  const t = TONE[kpi.tone ?? "neutral"]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.012, 0.2), duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative overflow-hidden rounded-xl bg-surface ring-1 shadow-card px-3.5 py-3 transition-shadow hover:shadow-card-hover",
        t.ring,
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full", t.bar)} />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className={cn("text-[10.5px] font-semibold uppercase tracking-wider truncate", t.label)}>{kpi.label}</p>
        <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", t.dot)} />
      </div>
      <div className="flex items-end gap-2 flex-wrap">
        <span className="t-kpi text-[22px] text-foreground leading-none">{kpi.value}</span>
        {kpi.trend ? <TrendPill trend={kpi.trend} /> : null}
      </div>
      {kpi.sub ? <p className="text-[11px] text-foreground-lighter mt-1.5 font-medium">{kpi.sub}</p> : null}
    </motion.div>
  )
}

function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
      {kpis.map((k, i) => <KpiTile key={k.label} kpi={k} index={i} />)}
    </div>
  )
}

const TABS = [
  { id: "overview", title: "Executive Overview" },
  ...KPI_GROUPS.map(g => ({ id: g.id, title: g.title })),
] as const

export default function CooDashboard() {
  const [tab, setTab] = useState<string>("overview")
  const active = KPI_GROUPS.find(g => g.id === tab)

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <CompactHeader
        title="COO Executive Dashboard"
        subtitle="Chairman scorecards, financials, and department KPIs across the hospital"
        badge={
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent">
            <Gauge className="h-3 w-3" /> Live · Today
          </span>
        }
        primary={
          <button className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:opacity-90 transition-opacity">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      {/* Chairman scorecards — pinned */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Crown className="h-4 w-4 text-warning" />
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-foreground-muted">Chairman Scorecards</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {CHAIRMAN_SCORECARDS.map((k, i) => <KpiTile key={k.label} kpi={k} index={i} />)}
        </div>
      </section>

      {/* Category tabs */}
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 bg-background/90 backdrop-blur border-b border-border">
        <div className="flex gap-1.5 overflow-x-auto">
          {TABS.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={cn(
                "flex-shrink-0 text-[12px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors",
                tab === tb.id
                  ? "bg-primary text-on-primary"
                  : "text-foreground-lighter hover:text-foreground hover:bg-surface-sunken",
              )}
            >
              {tb.title}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <KpiGrid kpis={EXECUTIVE_KPIS} />
      ) : active ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <active.icon className="h-4 w-4 text-accent" />
            <h2 className="text-[14px] font-bold text-foreground">{active.title} KPIs</h2>
            <span className="text-[11px] text-foreground-lighter">· {active.kpis.length} metrics</span>
          </div>
          <KpiGrid kpis={active.kpis} />
        </div>
      ) : null}
    </div>
  )
}
