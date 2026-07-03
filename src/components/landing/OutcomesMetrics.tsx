"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { TrendingDown, TrendingUp, Gauge, Clock } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCountUp } from "./useCountUp"
import { Reveal } from "./Reveal"

const KPIS = [
  { icon: TrendingDown, value: 38, suffix: "%", prefix: "↓ ", label: "Radiology turnaround time", note: "AI triage + closed-loop SLA" },
  { icon: TrendingUp, value: 24, suffix: "%", prefix: "↑ ", label: "Bed turnover efficiency", note: "predictive discharge & census" },
  { icon: Gauge, value: 96, suffix: "%", prefix: "", label: "AI decision-support concordance", note: "human-confirmed findings" },
  { icon: Clock, value: 30, suffix: " min", prefix: "", label: "Critical-result SLA", note: "tracked to acknowledgment" },
]

function Kpi({ kpi, active }: { kpi: typeof KPIS[number]; active: boolean }) {
  const v = useCountUp(kpi.value, active)
  return (
    <div className="text-center px-4">
      <span className="inline-flex h-11 w-11 rounded-2xl items-center justify-center bg-white/10 text-white mb-3"><kpi.icon className="h-5 w-5" /></span>
      <p className="text-[40px] lg:text-[46px] font-bold text-white leading-none tabular-nums tracking-tight">{kpi.prefix}{Math.round(v)}{kpi.suffix}</p>
      <p className="text-[13.5px] font-semibold text-white/85 mt-2">{kpi.label}</p>
      <p className="text-[11.5px] text-white/45 mt-0.5">{kpi.note}</p>
    </div>
  )
}

export function OutcomesMetrics() {
  const t = useTranslations("landing.outcomes")
  const [active, setActive] = useState(false)
  return (
    <section id="outcomes" className="scroll-mt-20 py-20 lg:py-24" style={{ background: "linear-gradient(150deg,#002A66 0%,#003B8E 55%,#052A33 100%)" }}>
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#F58C4E]">{t("eyebrow")}</p>
          <h2 className="text-[30px] lg:text-[38px] font-bold tracking-tight mt-2" style={{ color: "#FFFFFF" }}>{t("title")}</h2>
          <p className="text-[14.5px] text-white/55 mt-3">{t("subtitle")}</p>
        </Reveal>
        <motion.div
          onViewportEnter={() => setActive(true)}
          viewport={{ once: true, margin: "-60px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-4 mt-12 divide-x divide-white/10">
          {KPIS.map(kpi => <Kpi key={kpi.label} kpi={kpi} active={active} />)}
        </motion.div>
      </div>
    </section>
  )
}
