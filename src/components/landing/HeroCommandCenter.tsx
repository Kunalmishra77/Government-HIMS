"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Users, Activity, BedDouble, Ambulance, Brain, AlertTriangle, Sparkles,
  IndianRupee, ArrowUpRight, TrendingUp,
} from "lucide-react"
import { ProgressRing } from "@/components/ui/progress-ring"
import { useLiveHospitalStats } from "./useLiveHospitalStats"
import { useCountUp } from "./useCountUp"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.15 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

const TONE_BG: Record<string, string> = {
  stable: "bg-[var(--color-success)]",
  caution: "bg-[var(--color-warning)]",
  critical: "bg-[var(--color-danger)]",
}

function KpiTile({ icon: Icon, label, value, sub, accent, mounted }: {
  icon: React.ElementType; label: string; value: number; sub?: string; accent: string; mounted: boolean
}) {
  const v = useCountUp(value, mounted)
  return (
    <motion.div variants={item} className="rounded-2xl border border-[#EAECF2] bg-[#FBFCFE] p-3.5">
      <div className="flex items-center justify-between">
        <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
        {sub && <span className="text-[10px] font-bold text-[var(--color-success)] inline-flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{sub}</span>}
      </div>
      <p className="text-[24px] font-bold text-[#101828] mt-2 leading-none tabular-nums">{Math.round(v)}</p>
      <p className="text-[11px] font-medium text-[#667085] mt-1">{label}</p>
    </motion.div>
  )
}

export function HeroCommandCenter() {
  const s = useLiveHospitalStats()
  const reduce = useReducedMotion()
  const occ = useCountUp(s.bedOccupancy, s.mounted)
  const revenue = useCountUp(s.revenueToday / 1000, s.mounted)

  const feed = s.aiFeed.length ? s.aiFeed : [{ id: "ph", tone: "info" as const, label: "Connecting", detail: "Awaiting live clinical streams…", meta: undefined }]

  return (
    <motion.div
      variants={reduce ? undefined : container}
      initial={reduce ? undefined : "hidden"}
      animate={reduce ? undefined : "show"}
      className="relative rounded-3xl bg-white border border-[#EAECF2] shadow-[0_24px_60px_rgba(16,24,40,0.12)] overflow-hidden"
    >
      {/* window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAECF2] bg-[#F8FAFC]">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </span>
        <span className="ml-2 text-[11.5px] font-semibold text-[#667085]">agentix · admin command center</span>
        <span className="ml-auto inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[var(--color-primary)]/[0.08]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">Live</span>
        </span>
      </div>

      <div className="p-4 lg:p-5 space-y-3.5">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={Users} label="Live patients" value={s.livePatients} sub="+12%" accent="var(--color-primary)" mounted={s.mounted} />
          <KpiTile icon={Activity} label="OPD queue" value={s.opdQueue} accent="var(--color-info)" mounted={s.mounted} />
          <KpiTile icon={BedDouble} label="Active admissions" value={s.activeAdmissions} accent="var(--color-primary-light)" mounted={s.mounted} />
          <KpiTile icon={Ambulance} label="Emergency" value={s.emergencyCases} accent="var(--color-danger)" mounted={s.mounted} />
        </div>

        {/* Bed occupancy + revenue */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div variants={item} className="rounded-2xl border border-[#EAECF2] p-3.5 flex items-center gap-3">
            <ProgressRing value={s.bedOccupancy} size={62} strokeWidth={7} color="var(--color-primary)" trackColor="#EFF2F6"
              label={<span className="text-[15px] font-bold text-[#101828] tabular-nums">{Math.round(occ)}%</span>} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-[#101828]">Bed occupancy</p>
              <p className="text-[11px] text-[#667085] mt-0.5 tabular-nums">{s.bedsOccupied}/{s.bedsTotal} beds</p>
              <p className="text-[10.5px] text-[var(--color-success)] font-semibold mt-1">{s.dischargeReady} discharge-ready</p>
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-2xl border border-[#EAECF2] p-3.5">
            <span className="h-8 w-8 rounded-lg flex items-center justify-center bg-[var(--color-success)]/[0.10] text-[var(--color-success)]"><IndianRupee className="h-4 w-4" /></span>
            <p className="text-[22px] font-bold text-[#101828] mt-2 leading-none tabular-nums">₹{revenue.toFixed(2)}L</p>
            <p className="text-[11px] font-medium text-[#667085] mt-1">Revenue today</p>
            <p className="text-[10.5px] font-semibold text-[var(--color-success)] mt-1 inline-flex items-center gap-0.5"><TrendingUp className="h-3 w-3" /> +8% vs yesterday</p>
          </motion.div>
        </div>

        {/* Department status */}
        <motion.div variants={item} className="rounded-2xl border border-[#EAECF2] p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3] mb-2.5">Department status</p>
          <div className="space-y-2">
            {(s.departments.length ? s.departments : [{ name: "Emergency", load: 0, tone: "stable" as const }]).slice(0, 4).map((d, i) => (
              <div key={d.name} className="flex items-center gap-2.5">
                <span className="text-[11.5px] font-semibold text-[#344054] w-28 truncate">{d.name}</span>
                <span className="flex-1 h-1.5 rounded-full bg-[#EFF2F6] overflow-hidden">
                  <motion.span
                    className={cn("block h-full rounded-full", TONE_BG[d.tone])}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${d.load}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: EASE }}
                  />
                </span>
                <span className="text-[10.5px] font-bold text-[#667085] tabular-nums w-8 text-right">{d.load}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Live AI activity feed */}
        <motion.div variants={item} className="rounded-2xl border border-[#EAECF2] overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[#EAECF2] bg-[#F8FAFC]">
            <Brain className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <span className="text-[12px] font-bold text-[#101828]">AI clinical notifications</span>
            <span className="ml-auto text-[10.5px] font-semibold text-[#98A2B3] tabular-nums">{s.aiFindings} findings · {s.criticalAlerts} alerts</span>
          </div>
          <div className="divide-y divide-[#F2F4F8]">
            {feed.slice(0, 3).map(it => (
              <div key={it.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span className={cn("h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0",
                  it.tone === "critical" ? "bg-red-50 text-red-600" : it.tone === "ai" ? "bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)]" : "bg-amber-50 text-amber-600")}>
                  {it.tone === "critical" ? <AlertTriangle className="h-3.5 w-3.5" /> : it.tone === "ai" ? <Sparkles className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-[#101828] truncate">{it.detail}</p>
                  <p className="text-[10.5px] text-[#667085] truncate">{it.label}{it.meta ? ` · ${it.meta}` : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
