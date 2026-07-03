"use client"

import { motion } from "framer-motion"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts"
import { Sparkles, TrendingUp, ThumbsUp, ThumbsDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { useFeedbackStore } from "@/store/useFeedbackStore"
import { useTranslations } from "next-intl"

// Demo seed data for visualization when no real feedback exists
const DEMO_FEATURE_DATA = [
  { featureId: 'clinical_note', totalVotes: 42, upVotes: 38, downVotes: 4, acceptanceRate: 90 },
  { featureId: 'diagnosis_suggest', totalVotes: 67, upVotes: 58, downVotes: 9, acceptanceRate: 87 },
  { featureId: 'billing_codes', totalVotes: 31, upVotes: 26, downVotes: 5, acceptanceRate: 84 },
  { featureId: 'sepsis_monitor', totalVotes: 24, upVotes: 22, downVotes: 2, acceptanceRate: 92 },
  { featureId: 'bed_forecast', totalVotes: 18, upVotes: 14, downVotes: 4, acceptanceRate: 78 },
  { featureId: 'lab_anomaly', totalVotes: 29, upVotes: 23, downVotes: 6, acceptanceRate: 79 },
  { featureId: 'copilot_doctor', totalVotes: 55, upVotes: 49, downVotes: 6, acceptanceRate: 89 },
  { featureId: 'pre_brief', totalVotes: 38, upVotes: 35, downVotes: 3, acceptanceRate: 92 },
]

const FEATURE_LABELS: Record<string, string> = {
  clinical_note: 'Clinical Scribe',
  diagnosis_suggest: 'Diagnosis AI',
  billing_codes: 'Billing Codes',
  sepsis_monitor: 'Sepsis Monitor',
  bed_forecast: 'Bed Forecast',
  lab_anomaly: 'Lab Anomaly',
  copilot_doctor: 'Doctor Copilot',
  pre_brief: 'Pre-Brief',
}

// Disciplined blue-dominant categorical palette (no rainbow): brand blues + a
// single clinical-green and amber accent, repeating across categories.
const BAR_COLORS = ['var(--color-primary)', '#16A34A', '#F59E0B', 'var(--color-primary-dark)', 'var(--color-primary)', 'var(--color-primary-light)', 'var(--color-primary-dark)', 'var(--color-primary)']

export default function AiPerformancePage() {
  const t = useTranslations('admin')
  const getPerformanceReport = useFeedbackStore(s => s.getPerformanceReport)
  const report = getPerformanceReport()

  const featureLabel = (id: string) => t.has(`aiPerf.feature.${id}`) ? t(`aiPerf.feature.${id}`) : (FEATURE_LABELS[id] ?? id)

  const displayData = report.byFeature.length > 0 ? report.byFeature : DEMO_FEATURE_DATA
  const overallRate = report.totalFeedbacks > 0 ? report.overallAcceptanceRate : 87

  const pieData = [
    { name: t('aiPerf.accepted'), value: displayData.reduce((s, f) => s + f.upVotes, 0), fill: '#22c55e' },
    { name: t('aiPerf.rejected'), value: displayData.reduce((s, f) => s + f.downVotes, 0), fill: '#ef4444' },
  ]

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <NeonBadge variant="purple" className="mb-2"><Sparkles className="h-3 w-3" /> {t('aiPerf.badge')}</NeonBadge>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('aiPerf.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('aiPerf.subtitle')}</p>
        </div>
      </motion.div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border-t-4 border-t-slate-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 bg-[rgba(238,107,38,0.07)] rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <p className="text-sm font-semibold text-slate-500">{t('aiPerf.overallAcceptance')}</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{overallRate}%</p>
          <p className="text-xs text-slate-400 mt-1">{t('aiPerf.totalFeedbackEvents', { count: report.totalFeedbacks || displayData.reduce((s, f) => s + f.totalVotes, 0) })}</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-green-400">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 bg-green-50 rounded-xl flex items-center justify-center">
              <ThumbsUp className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-slate-500">{t('aiPerf.actionsAccepted')}</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{pieData[0].value}</p>
          <p className="text-xs text-slate-400 mt-1">{t('aiPerf.acrossFeatures', { count: displayData.length })}</p>
        </Card>

        <Card className="p-5 border-t-4 border-t-red-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 bg-red-50 rounded-xl flex items-center justify-center">
              <ThumbsDown className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-sm font-semibold text-slate-500">{t('aiPerf.actionsRejected')}</p>
          </div>
          <p className="text-3xl font-bold text-slate-900">{pieData[1].value}</p>
          <p className="text-xs text-slate-400 mt-1">{t('aiPerf.reviewReasons')}</p>
        </Card>
      </div>

      {/* Acceptance Rate Bar Chart */}
      <Card className="p-5">
        <h3 className="font-bold text-slate-900 mb-4">{t('aiPerf.acceptanceByFeature')}</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={displayData} barCategoryGap="25%">
            <XAxis
              dataKey="featureId"
              tickFormatter={id => featureLabel(id)}
              tick={{ fontSize: 11 }}
            />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) => [`${value}%`, t('aiPerf.acceptanceRate')]}
              labelFormatter={id => featureLabel(id as string)}
            />
            <Bar dataKey="acceptanceRate" radius={[4, 4, 0, 0]}>
              {displayData.map((entry, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Feedback vote ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4">{t('aiPerf.feedbackRatio')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-4">{t('aiPerf.featureDetail')}</h3>
          <div className="space-y-3 max-h-[200px] overflow-y-auto">
            {displayData.map((feature, i) => (
              <div key={feature.featureId} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-slate-700 truncate">{featureLabel(feature.featureId)}</span>
                    <span className="text-sm font-bold text-slate-900 ml-2">{feature.acceptanceRate}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full">
                    <div className="h-full rounded-full bg-current" style={{ width: `${feature.acceptanceRate}%`, color: BAR_COLORS[i % BAR_COLORS.length], backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                  </div>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{t('aiPerf.votes', { count: feature.totalVotes })}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
