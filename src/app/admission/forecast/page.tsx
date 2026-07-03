"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { forecastBedDemand } from "@/ai-services/bed-forecast"
import type { BedForecastData } from "@/ai-services/bed-forecast"
import type { AiEnvelope } from "@/types/ai"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { AiFeedbackButtons } from "@/components/features/AiFeedbackButtons"
import { Loader2, TrendingUp } from "lucide-react"

export default function AdmissionForecast() {
  const t = useTranslations('admission')
  const [data, setData] = useState<AiEnvelope<BedForecastData> | null>(null)
  const [loading, setLoading] = useState(true)
  const seriesLabel = (k: string) =>
    k === 'Occupancy' ? t('forecast.seriesOccupancy')
    : k === 'Admissions' ? t('forecast.seriesAdmissions')
    : k === 'Discharges' ? t('forecast.seriesDischarges')
    : k

  useEffect(() => {
    forecastBedDemand(7).then((result) => {
      setData(result)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 pt-6">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
        <p className="text-slate-500">{t('forecast.generating')}</p>
      </div>
    )
  }

  if (!data) return null

  const chartData = data.data.forecasts.map((f) => ({
    date: f.date.slice(5),
    Occupancy: f.predictedOccupancy,
    Admissions: f.predictedAdmissions,
    Discharges: f.predictedDischarges,
  }))

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('forecast.heading')}</h2>
          <p className="text-slate-500 text-sm mt-1">{t('forecast.subheading')}</p>
        </div>
        <div className="flex items-center gap-3">
          <AiConfidenceBadge confidence={data.confidence} tier={data.confidenceTier} reasoning={data.reasoning} />
          <AiFeedbackButtons featureId="bed-forecast" />
        </div>
      </div>

      <AiDisclaimer />

      {data.data.peakDemandDate && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <TrendingUp className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">{t('forecast.peakDemand', { date: data.data.peakDemandDate })}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data.data.recommendedActions.map((a, i) => (
                <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{a}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4">{t('forecast.occupancyForecast')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
            <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }} formatter={(value, name) => [value, seriesLabel(String(name))]} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => seriesLabel(String(value))} />
            <Line type="monotone" dataKey="Occupancy" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Admissions" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="Discharges" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{[
              { k: 'date', label: t('forecast.colDate') },
              { k: 'occupancy', label: t('forecast.colPredictedOccupancy') },
              { k: 'admissions', label: t('forecast.colAdmissions') },
              { k: 'discharges', label: t('forecast.colDischarges') },
              { k: 'confidence', label: t('forecast.colConfidence') },
            ].map((h) => (
              <th key={h.k} scope="col" className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h.label}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.data.forecasts.map((f) => (
              <tr key={f.date} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{f.date}</td>
                <td className="px-4 py-3 font-bold text-[var(--color-accent)]">{f.predictedOccupancy}%</td>
                <td className="px-4 py-3 text-green-700">{f.predictedAdmissions}</td>
                <td className="px-4 py-3 text-amber-700">{f.predictedDischarges}</td>
                <td className="px-4 py-3 text-slate-500">{Math.round(f.confidence * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
