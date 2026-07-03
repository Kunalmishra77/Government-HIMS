"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { usePatientFeedbackStore } from "@/store/usePatientFeedbackStore"
import { analyzeHospitalFeedback, type FeedbackInsightReport } from "@/ai-services/feedback-analyzer"
import type { AiEnvelope } from "@/types/ai"
import {
  Sparkles, RefreshCw, AlertTriangle, CheckCircle, TrendingUp,
  TrendingDown, Lightbulb, Star,
} from "lucide-react"
import { cn } from "@/lib/utils"

function ConfidenceMeter({ value }: { value: number }) {
  const pct   = Math.round(value * 100)
  const color = pct >= 85 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{pct}%</span>
    </div>
  )
}

function SatisfactionGauge({ score, t }: { score: number; t: ReturnType<typeof useTranslations> }) {
  const color = score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
  const bgColor = score >= 70 ? 'bg-emerald-50 border-emerald-200' : score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border p-5", bgColor)}>
      <p className={cn("text-4xl font-bold", color)}>{score}</p>
      <p className="text-xs text-slate-500 mt-1">{t('satisfactionScore')}</p>
      <p className={cn("text-xs font-bold mt-0.5", color)}>{t('outOf100')}</p>
    </div>
  )
}

export default function FeedbackAIInsightsPage() {
  const t = useTranslations('feedback')
  const records     = usePatientFeedbackStore(s => s.records)
  const expireStale = usePatientFeedbackStore(s => s.expireStale)

  const [envelope, setEnvelope]     = useState<AiEnvelope<FeedbackInsightReport> | null>(null)
  const [loading, setLoading]       = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState('')

  useEffect(() => {
    usePatientFeedbackStore.persist.rehydrate()
    const t = setTimeout(() => expireStale(), 200)
    return () => clearTimeout(t)
  }, [expireStale])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const result = await analyzeHospitalFeedback(records)
      setEnvelope(result)
      setLastRefreshed(new Date().toLocaleTimeString())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInsights() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const report = envelope?.data

  const npcsBg = report?.npsCategory === 'promoter'
    ? 'bg-emerald-100 text-emerald-700'
    : report?.npsCategory === 'passive'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[var(--color-accent)]" /> {t('aiInsightsTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('aiInsightsSubtitle')}
            {lastRefreshed && <span className="ml-2 text-slate-400">{t('updatedAt', { time: lastRefreshed })}</span>}
          </p>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t('refreshInsights')}
        </button>
      </div>

      {/* Priority alert */}
      {!loading && report?.priorityAlert && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-600 text-white shadow-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">{t('priorityAlert')}</p>
            <p className="text-sm mt-0.5 opacity-90">{report.priorityAlert}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : report && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: summary cards */}
          <div className="space-y-4">
            <SatisfactionGauge score={report.satisfactionScore} t={t} />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">{t('overallSentiment')}</span>
                <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full capitalize",
                  report.overallSentiment === 'positive' ? 'bg-emerald-100 text-emerald-700'
                  : report.overallSentiment === 'negative' ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700',
                )}>
                  {t.has(`sentiment_${report.overallSentiment}`) ? t(`sentiment_${report.overallSentiment}`) : report.overallSentiment}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">{t('npsCategory')}</span>
                <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full capitalize", npcsBg)}>
                  {t.has(`nps_${report.npsCategory}`) ? t(`nps_${report.npsCategory}`) : report.npsCategory}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">{t('recordsAnalyzed')}</span>
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-slate-700">{report.processedCount}</span>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">{t('aiConfidence')}</p>
                <ConfidenceMeter value={envelope?.confidence ?? 0.84} />
              </div>
            </div>
          </div>

          {/* Middle + right: strengths, issues, recommendations */}
          <div className="lg:col-span-2 space-y-5">
            {/* Strengths vs improvement areas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> {t('keyStrengths')}
                </h2>
                {report.keyStrengths.length > 0 ? (
                  <ul className="space-y-2">
                    {report.keyStrengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                        <TrendingUp className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-600 italic">{t('noStrengths')}</p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-amber-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> {t('improvementAreas')}
                </h2>
                {report.improvementAreas.length > 0 ? (
                  <ul className="space-y-2">
                    {report.improvementAreas.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <TrendingDown className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-amber-600 italic">{t('noIssues')}</p>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[var(--color-accent)]" /> {t('aiRecommendations')}
              </h2>
              <ol className="space-y-3">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* AI reasoning */}
            {envelope?.reasoning && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 italic">
                <span className="font-bold not-italic text-slate-600">{t('reasoning')}</span>
                {envelope.reasoning}
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-2xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40 p-4 text-xs text-[var(--color-primary-dark)]">
              <p className="font-bold mb-1">{t('aiDisclaimer')}</p>
              <p className="leading-relaxed">{t('aiDisclaimerBody')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
