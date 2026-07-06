"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { usePatientFeedbackStore } from "@/store/usePatientFeedbackStore"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Star, TrendingUp, Users, BarChart2, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FeedbackRecord } from "@/types/feedback"

const SENTIMENT_COLORS = { positive: '#16a34a', neutral: '#d97706', negative: '#dc2626' }
const RATING_COLORS = ['#dc2626', '#EE6B26', '#eab308', '#22c55e', '#16a34a']

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={cn("p-3 rounded-xl flex-shrink-0", color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
      ))}
    </div>
  )
}

function SentimentBadge({ sentiment, t }: { sentiment: string; t: ReturnType<typeof useTranslations> }) {
  if (sentiment === 'positive') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t('sentimentPositive')}</span>
  if (sentiment === 'negative') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('sentimentNegative')}</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{t('sentimentNeutral')}</span>
}

export default function FeedbackDashboardPage() {
  const t = useTranslations('feedback')
  const getAnalytics = usePatientFeedbackStore(s => s.getAnalytics)
  const expireStale  = usePatientFeedbackStore(s => s.expireStale)
  const records      = usePatientFeedbackStore(s => s.records)

  useEffect(() => {
    usePatientFeedbackStore.persist.rehydrate()
    const t = setTimeout(() => expireStale(), 200)
    return () => clearTimeout(t)
  }, [expireStale])

  const analytics = getAnalytics()
  const recentRecords: FeedbackRecord[] = [...records]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5)

  const sentimentData = [
    { name: t('sentimentPositive'), value: analytics.sentimentBreakdown.positive, color: SENTIMENT_COLORS.positive },
    { name: t('sentimentNeutral'),  value: analytics.sentimentBreakdown.neutral,  color: SENTIMENT_COLORS.neutral },
    { name: t('sentimentNegative'), value: analytics.sentimentBreakdown.negative, color: SENTIMENT_COLORS.negative },
  ].filter(d => d.value > 0)

  const npsLabel = analytics.npsScore >= 50 ? t('npsExcellent') : analytics.npsScore >= 0 ? t('npsGood') : t('npsNeedsImprovement')
  const npsColor = analytics.npsScore >= 50 ? 'text-emerald-600' : analytics.npsScore >= 0 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-[var(--color-accent)]" /> {t('dashboardTitle')}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('dashboardSubtitle')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t('kpiTotalResponses')} value={analytics.totalFeedback} sub={t('kpiTotalResponsesSub')} icon={Users} color="bg-[var(--color-primary)]" />
        <KpiCard label={t('kpiAvgRating')} value={t('kpiAvgRatingValue', { value: analytics.avgRating })} sub={t('kpiAvgRatingSub')} icon={Star} color="bg-amber-500" />
        <KpiCard label={t('kpiNpsScore')} value={analytics.npsScore}
          sub={<span className={npsColor}>{npsLabel}</span> as unknown as string} icon={TrendingUp} color="bg-emerald-600" />
        <KpiCard label={t('kpiResponseRate')} value={t('kpiResponseRateValue', { value: analytics.responseRate })} sub={t('kpiResponseRateSub')} icon={Heart} color="bg-primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rating distribution bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-4">{t('ratingDistribution')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.ratingDistribution} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="rating" tickLine={false} axisLine={false} tick={{ fontSize: 12 }}
                tickFormatter={v => `${v}★`} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} allowDecimals={false} />
              <Tooltip formatter={(v) => [Number(v), t('responses')]} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" radius={[6,6,0,0]}>
                {analytics.ratingDistribution.map((_, i) => <Cell key={i} fill={RATING_COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment pie */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-4">{t('sentimentBreakdown')}</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value" paddingAngle={3}>
                {sentimentData.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [Number(v), t('responses')]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {sentimentData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-bold text-slate-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend line chart */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-4">{t('monthlyAvgRating')}</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={analytics.monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 5]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} />
            <Tooltip formatter={(v) => [Number(v), t('avgRating')]} />
            <Line type="monotone" dataKey="avg" stroke="#16324A" strokeWidth={2.5} dot={{ r: 4, fill: '#16324A' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top themes + category averages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-3">{t('topThemes')}</h2>
          <div className="flex flex-wrap gap-2">
            {analytics.topThemes.map((theme, i) => (
              <span key={theme} className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full",
                i === 0 ? 'bg-[var(--color-primary)] text-white' : i === 1 ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]' : 'bg-slate-100 text-slate-600'
              )}>
                #{i+1} {theme}
              </span>
            ))}
            {analytics.topThemes.length === 0 && <p className="text-sm text-slate-400">{t('noThemes')}</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-3">{t('categoryAverages')}</h2>
          <div className="space-y-1.5">
            {(Object.entries(analytics.categoryAverages) as [string, number][])
              .sort((a, b) => b[1] - a[1])
              .map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-36 flex-shrink-0 capitalize">
                    {t.has(`cat_${key}`) ? t(`cat_${key}`) : key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{
                      width: `${(val / 5) * 100}%`,
                      background: val >= 4 ? '#16a34a' : val >= 3 ? '#d97706' : '#dc2626',
                    }} />
                  </div>
                  <span className={cn("text-xs font-bold w-6 text-right", val >= 4 ? 'text-emerald-600' : val >= 3 ? 'text-amber-600' : 'text-red-600')}>
                    {val}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Recent feedback */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">{t('recentFeedback')}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {recentRecords.map(rec => (
            <div key={rec.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{rec.patientName}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{rec.visitType}</span>
                  <SentimentBadge sentiment={rec.sentiment} t={t} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{rec.attendingDoctor} · {rec.department}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <StarRow rating={rec.overallRating} />
                <p className="text-[10px] text-slate-400 mt-1">{new Date(rec.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
