"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { usePatientFeedbackStore } from "@/store/usePatientFeedbackStore"
import type { FeedbackRecord, FeedbackSentiment, FeedbackVisitType } from "@/types/feedback"
import { Star, ChevronDown, ChevronUp, ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
      ))}
    </div>
  )
}

function SentimentBadge({ sentiment, t }: { sentiment: FeedbackSentiment; t: ReturnType<typeof useTranslations> }) {
  if (sentiment === 'positive') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t('sentimentPositive')}</span>
  if (sentiment === 'negative') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('sentimentNegative')}</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('sentimentNeutral')}</span>
}

interface Filters {
  visitType: FeedbackVisitType | 'all'
  minRating: number
  sentiment: FeedbackSentiment | 'all'
  doctor: string
}

export default function FeedbackResponsesPage() {
  const t = useTranslations('feedback')
  const records      = usePatientFeedbackStore(s => s.records)
  const expireStale  = usePatientFeedbackStore(s => s.expireStale)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({
    visitType: 'all', minRating: 1, sentiment: 'all', doctor: '',
  })
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    usePatientFeedbackStore.persist.rehydrate()
    const t = setTimeout(() => expireStale(), 200)
    return () => clearTimeout(t)
  }, [expireStale])

  const allDoctors = [...new Set(records.map(r => r.attendingDoctor))].sort()

  const filtered = records
    .filter(r => filters.visitType === 'all' || r.visitType === filters.visitType)
    .filter(r => r.overallRating >= filters.minRating)
    .filter(r => filters.sentiment === 'all' || r.sentiment === filters.sentiment)
    .filter(r => !filters.doctor || r.attendingDoctor === filters.doctor)
    .sort((a, b) => {
      const diff = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      return sortDir === 'desc' ? -diff : diff
    })

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ListFilter className="h-6 w-6 text-[var(--color-accent)]" /> {t('allResponsesTitle')}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('responsesShown', { shown: filtered.length, total: records.length })}</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('filterVisitType')}</label>
          <select
            value={filters.visitType}
            onChange={e => setFilter('visitType', e.target.value as Filters['visitType'])}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[var(--color-primary-light)]"
          >
            <option value="all">{t('filterAll')}</option>
            <option value="ipd">IPD</option>
            <option value="opd">OPD</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('filterMinRating')}</label>
          <select
            value={filters.minRating}
            onChange={e => setFilter('minRating', Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[var(--color-primary-light)]"
          >
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{t('minRatingOption', { n })}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('filterSentiment')}</label>
          <select
            value={filters.sentiment}
            onChange={e => setFilter('sentiment', e.target.value as Filters['sentiment'])}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[var(--color-primary-light)]"
          >
            <option value="all">{t('filterAll')}</option>
            <option value="positive">{t('sentimentPositive')}</option>
            <option value="neutral">{t('sentimentNeutral')}</option>
            <option value="negative">{t('sentimentNegative')}</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('filterDoctor')}</label>
          <select
            value={filters.doctor}
            onChange={e => setFilter('doctor', e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[var(--color-primary-light)]"
          >
            <option value="">{t('allDoctors')}</option>
            {allDoctors.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-3 px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
          <span>{t('colPatient')}</span>
          <span>{t('colDoctorDept')}</span>
          <span>{t('colType')}</span>
          <button className="flex items-center gap-1 cursor-pointer" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
            {t('colDate')} {sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
          <span>{t('colRating')}</span>
          <span>{t('colSentiment')}</span>
          <span></span>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm font-semibold">{t('noResponsesMatch')}</p>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filtered.map((rec: FeedbackRecord) => (
            <div key={rec.id}>
              <button
                onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-slate-50/60 transition-colors cursor-pointer"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto_auto_auto] gap-2 sm:gap-3 items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{rec.patientName}</p>
                    <p className="text-xs text-slate-400">{rec.visitId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-700">{rec.attendingDoctor}</p>
                    <p className="text-xs text-slate-400">{rec.department}</p>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase self-start sm:self-center">
                    {rec.visitType}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(rec.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                  <div className="flex items-center gap-1">
                    <StarRow rating={rec.overallRating} />
                    <span className="text-xs font-bold text-slate-700 ml-1">{rec.overallRating}</span>
                  </div>
                  <SentimentBadge sentiment={rec.sentiment} t={t} />
                  {expanded === rec.id
                    ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  }
                </div>
              </button>

              {expanded === rec.id && (
                <div className="px-5 pb-4 bg-slate-50/40 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
                    {(Object.entries(rec.categories) as [string, number][]).map(([key, val]) => (
                      <div key={key} className="bg-white rounded-xl px-3 py-2 border border-slate-100">
                        <p className="text-slate-400 text-[10px] capitalize">{t.has(`cat_${key}`) ? t(`cat_${key}`) : key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        <p className={cn("font-bold text-sm mt-0.5", val >= 4 ? 'text-emerald-600' : val >= 3 ? 'text-amber-600' : 'text-red-600')}>{val}/5</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>{t('npsLabel', { value: rec.nps })}</span>
                    <span>{t('recommend')} <span className={cn("font-bold", rec.wouldRecommend ? 'text-emerald-600' : 'text-red-600')}>{rec.wouldRecommend ? t('yes') : t('no')}</span></span>
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-slate-600 italic bg-white border border-slate-100 rounded-xl px-3 py-2 leading-relaxed">
                      &ldquo;{rec.comment}&rdquo;
                    </p>
                  )}
                  {rec.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rec.themes.map(t => (
                        <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
