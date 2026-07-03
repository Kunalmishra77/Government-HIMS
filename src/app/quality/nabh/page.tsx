"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { RadialBarChart, RadialBar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { ShieldCheck, AlertTriangle, TrendingDown, TrendingUp, Sparkles, RefreshCw, CheckCircle, FileText, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { useQualityStore } from "@/store/useQualityStore"
import { useAuditStore, moduleOf, severityOf } from "@/store/useAuditStore"
import { buildNabhEvidence, NABH_CHAPTERS } from "@/lib/nabhEvidence"
import { suggestCAPA, type CapaReport } from "@/ai-services/suggest-capa"
import type { AiEnvelope } from "@/types/ai"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const NABH_BENCHMARKS = {
  handHygieneCompliancePct: { target: 90, labelKey: 'handHygiene', unit: '%', higherIsBetter: true },
  cauti1000cathdays: { target: 1.0, labelKey: 'cauti', unit: '/1000 cath-days', higherIsBetter: false },
  clabsi1000linedays: { target: 0.5, labelKey: 'clabsi', unit: '/1000 line-days', higherIsBetter: false },
  fallRatePer1000patientdays: { target: 1.5, labelKey: 'fallRate', unit: '/1000 pt-days', higherIsBetter: false },
  medicationErrorRate: { target: 0.2, labelKey: 'medicationErrors', unit: '%', higherIsBetter: false },
  re30dayReadmissionPct: { target: 3.0, labelKey: 'readmission', unit: '%', higherIsBetter: false },
  patientSatisfactionNPS: { target: 75, labelKey: 'patientNps', unit: '', higherIsBetter: true },
}

const TREND_DATA = [
  { week: 'W1', handHygiene: 72, nps: 62, falls: 2.8, readmission: 5.1 },
  { week: 'W2', handHygiene: 74, nps: 64, falls: 2.5, readmission: 4.8 },
  { week: 'W3', handHygiene: 76, nps: 65, falls: 2.3, readmission: 4.5 },
  { week: 'W4', handHygiene: 78, nps: 67, falls: 2.1, readmission: 4.2 },
  { week: 'W5', handHygiene: 79, nps: 68, falls: 1.9, readmission: 4.0 },
  { week: 'W6', handHygiene: 81, nps: 70, falls: 1.8, readmission: 3.8 },
]

export default function NabhCockpitPage() {
  const t = useTranslations('quality')
  const { nabh, incidents } = useQualityStore()
  const auditEntries = useAuditStore(s => s.entries)
  const [capaEnvelope, setCapaEnvelope] = useState<AiEnvelope<CapaReport> | null>(null)
  const [capaLoading, setCapaLoading] = useState(false)

  const auditEvidence = useMemo(() => buildNabhEvidence(auditEntries), [auditEntries])
  const readyChapters = auditEvidence.filter(c => c.ready).length

  const runCapaAnalysis = async () => {
    setCapaLoading(true)
    try {
      const result = await suggestCAPA({ incidents })
      setCapaEnvelope(result)
    } finally {
      setCapaLoading(false)
    }
  }

  const radialData = Object.entries(NABH_BENCHMARKS).map(([key, bench]) => {
    const value = nabh[key as keyof typeof nabh]
    const pct = bench.higherIsBetter
      ? Math.min(100, (Number(value) / bench.target) * 100)
      : Math.min(100, (bench.target / Math.max(Number(value), 0.01)) * 100)
    const onTarget = bench.higherIsBetter ? Number(value) >= bench.target : Number(value) <= bench.target
    return { name: t(`nabh.bench.${bench.labelKey}`), value: Math.round(pct), fill: onTarget ? '#22c55e' : '#ef4444', key, actual: value, target: bench.target, unit: bench.unit, onTarget }
  })

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <NeonBadge variant="teal" className="mb-2"><ShieldCheck className="h-3 w-3" /> {t('nabh.badge')}</NeonBadge>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('nabh.heading')}</h2>
        </div>
        <button
          onClick={runCapaAnalysis}
          disabled={capaLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Sparkles className={`h-4 w-4 ${capaLoading ? 'animate-spin' : ''}`} />
          {capaLoading ? t('nabh.analysing') : t('nabh.runCapa')}
        </button>
      </motion.div>

      {/* NABH Gauge Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {radialData.map((item, i) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={cn("p-4 text-center border-t-4", item.onTarget ? "border-t-green-400" : "border-t-red-400")}>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="60%" outerRadius="100%" data={[item]} startAngle={90} endAngle={-270}>
                    <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#f1f5f9' }} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {item.actual}{item.unit.startsWith('%') || item.unit === '' ? item.unit : ''}
              </p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{item.name}</p>
              <p className={cn("text-[10px] font-semibold mt-0.5", item.onTarget ? "text-green-600" : "text-red-600")}>
                {item.onTarget ? t('nabh.onTarget') : t('nabh.targetValue', { target: item.target })}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Live NABH audit-trail evidence — sourced from useAuditStore */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="font-bold text-slate-900 text-sm">{t('nabh.liveEvidence')}</h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              {t('nabh.chaptersCount', { ready: readyChapters, total: NABH_CHAPTERS.length })}
            </span>
          </div>
          <Link href="/audit/reports" className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">
            {t('nabh.fullEvidenceReport')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {auditEvidence.map(c => (
            <div key={c.chapter} className={cn(
              "rounded-lg p-3 border",
              c.ready ? "bg-emerald-50/40 border-emerald-200" : "bg-slate-50 border-slate-200",
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                  c.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>
                  {c.chapter}
                </span>
                <span className={cn("text-[11px] font-bold", c.ready ? "text-emerald-700" : "text-slate-400")}>
                  {c.count}
                </span>
              </div>
              <p className="text-[11px] text-slate-700 leading-tight">{c.title}</p>
            </div>
          ))}
        </div>
        {auditEntries.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{t('nabh.recentEvents')}</p>
            <div className="space-y-1">
              {auditEntries.slice(0, 3).map(e => {
                const s = severityOf(e.action)
                return (
                  <div key={e.id} className="flex items-center gap-2 text-[11px]">
                    {s === 'critical' && <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                    {s === 'warning' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                    {s === 'info' && <span className="h-1.5 w-1.5 rounded-full bg-slate-300 flex-shrink-0" />}
                    <span className="font-semibold text-slate-700">{moduleOf(e.action)}</span>
                    <span className="text-slate-500 truncate flex-1">{e.detail ?? e.resource}</span>
                    <span className="text-slate-400 flex-shrink-0">{e.userName}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" /> {t('nabh.handHygieneNpsTrend')}
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={TREND_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[50, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="handHygiene" stroke="#22c55e" strokeWidth={2} dot={false} name={t('nabh.series.handHygiene')} />
              <Line type="monotone" dataKey="nps" stroke="var(--color-primary)" strokeWidth={2} dot={false} name={t('nabh.series.nps')} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-[var(--color-accent)]" /> {t('nabh.fallsReadmissionTrend')}
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={TREND_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="falls" stroke="#f59e0b" strokeWidth={2} dot={false} name={t('nabh.series.fallRate')} />
              <Line type="monotone" dataKey="readmission" stroke="#ef4444" strokeWidth={2} dot={false} name={t('nabh.series.readmission')} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* CAPA Recommendations */}
      {capaEnvelope && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 text-lg">{t('nabh.capaRecommendations')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {capaEnvelope.data.suggestions.map(capa => (
              <Card key={capa.id} className={cn("p-5 border-l-4",
                capa.priority === 'critical' ? 'border-l-red-500' :
                capa.priority === 'high' ? 'border-l-orange-400' :
                capa.priority === 'medium' ? 'border-l-amber-400' : 'border-l-slate-400'
              )}>
                <div className="flex items-start justify-between mb-2">
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                    capa.priority === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                    capa.priority === 'high' ? 'bg-primary-soft border-primary/20 text-accent' :
                    capa.priority === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]'
                  )}>{capa.priority}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-medium">{capa.category}</span>
                </div>
                <p className="font-bold text-slate-900 text-sm mb-2">{capa.title}</p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p><span className="font-semibold">{t('nabh.rootCause')}</span> {capa.rootCause}</p>
                  <p><span className="font-semibold">{t('nabh.immediate')}</span> {capa.immediateAction}</p>
                  <p><span className="font-semibold">{t('nabh.preventive')}</span> {capa.preventiveAction}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <span>{capa.responsible}</span>
                  <span>{t('nabh.by', { date: capa.targetDate })}</span>
                </div>
              </Card>
            ))}
          </div>

          <HitlReviewCard
            title={t('nabh.capaTitle')}
            envelope={capaEnvelope}
            featureId="capa_analysis"
            renderContent={() => null}
            onAccept={() => {}}
            onReject={() => {}}
          />
        </div>
      )}

      {!capaEnvelope && !capaLoading && (
        <Card className="p-8 text-center">
          <CheckCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('nabh.emptyState')}</p>
        </Card>
      )}
    </div>
  )
}
