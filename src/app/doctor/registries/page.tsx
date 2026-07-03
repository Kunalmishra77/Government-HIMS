"use client"

import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts"
import { Users, Sparkles, RefreshCw, Send, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { suggestRecallCohorts, type RecallCohortReport } from "@/ai-services/suggest-recall-cohorts"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import type { AiEnvelope } from "@/types/ai"
import { toast } from "sonner"

type Band = { range: string; color: string }
const HBA1C_BANDS: Band[] = [{ range: '<7%', color: '#22c55e' }, { range: '7–8%', color: '#f59e0b' }, { range: '8–9%', color: '#EE6B26' }, { range: '>9%', color: '#ef4444' }]
const BP_BANDS: Band[] = [{ range: '<130/80', color: '#22c55e' }, { range: '130–140', color: '#f59e0b' }, { range: '140–160', color: '#EE6B26' }, { range: '>160', color: '#ef4444' }]
const RISK_COLOR = { low: 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]', medium: 'bg-amber-50 border-amber-200 text-amber-700', high: 'bg-red-50 border-red-200 text-red-700' }

export default function RegistriesPage() {
  const t = useTranslations('doctor')
  const [recallEnvelope, setRecallEnvelope] = useState<AiEnvelope<RecallCohortReport> | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentCampaigns, setSentCampaigns] = useState<Set<string>>(new Set())
  const patients = usePatientStore(s => s.patients)
  const inpatients = useInpatientStore(s => s.inpatients)

  // Registries bucketed by REAL latest HbA1c / BP from patient & inpatient records.
  const { hba1c, bp, diaCount, hypCount } = useMemo(() => {
    const dia = new Map<string, number>()   // id → HbA1c
    const hyp = new Map<string, number>()   // id → systolic BP
    const addBP = (id: string, bpStr?: string) => { if (bpStr) { const s = parseInt(bpStr.split('/')[0]); if (!isNaN(s)) hyp.set(id, s) } }
    patients.forEach(p => { if (p.latestHbA1c != null) dia.set(p.id, p.latestHbA1c); addBP(p.id, p.latestBP) })
    inpatients.forEach(i => { if (i.latestHbA1c != null && !dia.has(i.patientId)) dia.set(i.patientId, i.latestHbA1c); if (!hyp.has(i.patientId)) addBP(i.patientId, i.latestBP) })

    const hb = HBA1C_BANDS.map(b => ({ ...b, count: 0 }))
    for (const v of dia.values()) hb[v < 7 ? 0 : v < 8 ? 1 : v < 9 ? 2 : 3].count++
    const bpb = BP_BANDS.map(b => ({ ...b, count: 0 }))
    for (const s of hyp.values()) bpb[s < 130 ? 0 : s < 140 ? 1 : s < 160 ? 2 : 3].count++

    return { hba1c: hb, bp: bpb, diaCount: dia.size, hypCount: hyp.size }
  }, [patients, inpatients])

  const runRecallAnalysis = async () => {
    setLoading(true)
    try {
      const result = await suggestRecallCohorts({})
      setRecallEnvelope(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <NeonBadge variant="blue" className="mb-2"><Users className="h-3 w-3" /> {t('registries.badge')}</NeonBadge>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{t('registries.title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('registries.subtitle')}</p>
        </div>
        <button
          onClick={runRecallAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Sparkles className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t('registries.analysing') : t('registries.runRecall')}
        </button>
      </motion.div>

      {/* Registry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-1">{t('registries.hba1cTitle', { count: diaCount })}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('registries.hba1cTarget')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hba1c} barCategoryGap="30%">
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {hba1c.map((entry) => <Cell key={entry.range} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-green-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-green-700">{hba1c[0].count}</p>
              <p className="text-xs text-green-600">{t('registries.controlledLt7')}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-red-700">{hba1c[2].count + hba1c[3].count}</p>
              <p className="text-xs text-red-600">{t('registries.aboveTargetGte8')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-slate-900 mb-1">{t('registries.bpTitle', { count: hypCount })}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('registries.bpTarget')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={bp} barCategoryGap="30%">
              <XAxis dataKey="range" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {bp.map((entry) => <Cell key={entry.range} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-green-50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-green-700">{bp[0].count}</p>
              <p className="text-xs text-green-600">{t('registries.controlled')}</p>
            </div>
            <div className="bg-primary-soft rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-accent">{bp[2].count + bp[3].count}</p>
              <p className="text-xs text-accent">{t('registries.aboveTarget')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recall cohorts */}
      {recallEnvelope && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-lg">{t('registries.recallCohorts', { count: recallEnvelope.data.totalPatientsAtRisk })}</h3>
          </div>

          {recallEnvelope.data.cohorts.map(cohort => (
            <Card key={cohort.cohortId} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-900">{cohort.condition}</h4>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${RISK_COLOR[cohort.riskLevel]}`}>
                      {t('registries.riskSuffix', { risk: cohort.riskLevel })}
                    </span>
                    {recallEnvelope.data.priorityCohort === cohort.cohortId && (
                      <NeonBadge variant="danger" dot>{t('registries.priority')}</NeonBadge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{t.rich('registries.cohortSummary', { total: cohort.patientCount, overdue: cohort.overdueForFollowup, days: cohort.avgDaysSinceLastVisit, red: (c) => <span className="text-red-600 font-semibold">{c}</span> })}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('registries.suggestedMessage')}</p>
                <p className="text-sm text-slate-700 italic">&ldquo;{cohort.suggestedMessage}&rdquo;</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{cohort.recommendedAction}</p>
                <button
                  onClick={() => { setSentCampaigns(s => new Set([...s, cohort.cohortId])); toast.success(t('registries.campaignSent', { condition: cohort.condition }), { description: t('registries.campaignSentDesc', { count: cohort.overdueForFollowup }) }) }}
                  disabled={sentCampaigns.has(cohort.cohortId)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    sentCampaigns.has(cohort.cohortId)
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]'
                  }`}
                >
                  {sentCampaigns.has(cohort.cohortId)
                    ? <><RefreshCw className="h-3.5 w-3.5" /> {t('common.sent')}</>
                    : <><Send className="h-3.5 w-3.5" /> {t('registries.sendCampaign')}</>
                  }
                </button>
              </div>
            </Card>
          ))}

          <HitlReviewCard
            title={t('registries.reviewTitle')}
            envelope={recallEnvelope}
            featureId="recall_cohorts"
            renderContent={() => null}
            onAccept={() => toast.success(t('registries.planAccepted'), { description: t('registries.planAcceptedDesc') })}
            onReject={(reason: string) => { toast(t('registries.analysisDismissed'), reason ? { description: reason } : undefined); setRecallEnvelope(null) }}
          />
        </div>
      )}

      {!recallEnvelope && !loading && (
        <Card className="p-10 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">{t('registries.emptyBody')}</p>
          <button
            onClick={runRecallAnalysis}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg mx-auto hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            <Sparkles className="h-4 w-4" /> {t('registries.analyseCohorts')} <ChevronRight className="h-4 w-4" />
          </button>
        </Card>
      )}
    </div>
  )
}
