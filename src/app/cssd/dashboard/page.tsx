"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useCSSDStore } from "@/store/useCSSDStore"
import { Activity, Package, CheckCircle2, XCircle, Clock } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/PageHeader"

const STATUS_BADGE: Record<string, { variant: "success" | "danger" | "warning"; labelKey: string }> = {
  passed:    { variant: "success", labelKey: "statusPassed" },
  failed:    { variant: "danger",  labelKey: "statusFailed" },
  running:   { variant: "warning", labelKey: "statusRunning" },
}

const INST_BADGE: Record<string, { variant: "success" | "primary" | "warning" | "danger" }> = {
  ready:       { variant: "success" },
  in_use:      { variant: "primary" },
  sterilizing: { variant: "warning" },
  quarantine:  { variant: "danger" },
}

export default function CSSDDashboard() {
  const t = useTranslations("cssd.dashboard")
  const { cycles, instruments } = useCSSDStore()
  const activeCycles      = cycles.filter((c) => c.status === 'running')
  const passedToday       = cycles.filter((c) => c.status === 'passed')
  const failedToday       = cycles.filter((c) => c.status === 'failed')
  const readyInstruments  = instruments.filter((i) => i.status === 'ready')

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("activeCycles")}     value={activeCycles.length}     icon={Clock}         color="amber"  delay={0} />
        <StatCard label={t("passedToday")}      value={passedToday.length}      icon={CheckCircle2}  color="green"  delay={0.05} />
        <StatCard label={t("failedToday")}      value={failedToday.length}      icon={XCircle}       color="red"    delay={0.1} />
        <StatCard label={t("readyInstruments")} value={readyInstruments.length} icon={Package}       color="slate"  delay={0.15} />
      </div>

      {/* Sterilization Cycles */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-accent)]" /> {t("sterilizationCycles")}
        </h3>
        <div className="space-y-2">
          {cycles.map((c, i) => {
            const sbDef = STATUS_BADGE[c.status]
            const sb = sbDef
              ? { variant: sbDef.variant, label: t(sbDef.labelKey) }
              : { variant: "muted" as const, label: c.status.toUpperCase() }
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {c.status === 'running' && <Activity className="h-4 w-4 text-amber-500 animate-pulse flex-shrink-0" />}
                  {c.status === 'passed'  && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                  {c.status === 'failed'  && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{c.batchNumber}</p>
                    <p className="text-xs text-slate-500">{t("cycleMeta", { method: c.method, time: new Date(c.startedAt).toLocaleTimeString() })}</p>
                  </div>
                </div>
                <Badge variant={sb.variant}>{sb.label}</Badge>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Instrument Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" /> {t("instrumentStatus")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {instruments.map((ins, i) => {
            const ib = INST_BADGE[ins.status] ?? { variant: "muted" as const }
            return (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white hover:border-slate-300 transition-colors"
              >
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{ins.name}</p>
                  <p className="text-xs text-slate-500">{t("instrumentMeta", { category: ins.category, quantity: ins.quantity })}</p>
                </div>
                <Badge variant={ib.variant}>{t.has(`instStatus.${ins.status}`) ? t(`instStatus.${ins.status}`) : ins.status.replace('_', ' ').toUpperCase()}</Badge>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
