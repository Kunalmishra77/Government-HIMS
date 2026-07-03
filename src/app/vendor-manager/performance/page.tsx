"use client"

import { useMemo } from "react"
import { useVendorManagerStore } from "@/store/useVendorManagerStore"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts"
import { BarChart2, TrendingUp, Award, AlertTriangle, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

// ─── Performance tier ─────────────────────────────────────────────────────────

function vendorTier(composite: number): { labelKey: string; style: string; icon: string } {
  if (composite >= 85) return { labelKey: 'tierGold',   style: 'bg-yellow-100 text-yellow-800 border border-yellow-300', icon: '🥇' }
  if (composite >= 70) return { labelKey: 'tierSilver', style: 'bg-slate-100 text-slate-700 border border-slate-300',    icon: '🥈' }
  return                       { labelKey: 'tierBronze', style: 'bg-primary-soft text-accent border border-primary/20',  icon: '🥉' }
}

// ─── Simulated monthly spend trend ────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const SPEND_TREND = [
  { month: 'Jan', Equipment: 1200000, Pharma: 800000, Consumables: 350000, Services: 120000, Facility: 90000 },
  { month: 'Feb', Equipment: 980000,  Pharma: 920000, Consumables: 290000, Services: 140000, Facility: 95000 },
  { month: 'Mar', Equipment: 1350000, Pharma: 840000, Consumables: 410000, Services: 110000, Facility: 100000 },
  { month: 'Apr', Equipment: 1100000, Pharma: 1100000,Consumables: 380000, Services: 130000, Facility: 110000 },
  { month: 'May', Equipment: 1450000, Pharma: 960000, Consumables: 420000, Services: 145000, Facility: 105000 },
  { month: 'Jun', Equipment: 1200000, Pharma: 1050000,Consumables: 360000, Services: 135000, Facility: 115000 },
]

const CATEGORY_COLORS: Record<string, string> = {
  Equipment:   'var(--color-primary)',
  Pharma:      '#C2481A',
  Consumables: '#EE6B26',
  Services:    '#D97706',
  Facility:    '#059669',
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function SpendTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  const t = useTranslations('vendorManager')
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{t.has(`category.${p.name}`) ? t(`category.${p.name}`) : p.name}</span>
          <span className="font-semibold text-slate-800">₹{(p.value / 100000).toFixed(1)}L</span>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-2 pt-1 flex justify-between font-bold text-slate-700">
        <span>{t('performance.tooltipTotal')}</span><span>₹{(total / 100000).toFixed(1)}L</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const t = useTranslations('vendorManager')
  const vendors = useVendorManagerStore(s => s.vendors)

  const scorecards = useMemo(() =>
    [...vendors]
      .filter(v => v.status !== 'inactive')
      .map(v => ({
        ...v,
        composite: Math.round((v.qualityScore * 0.4 + v.deliveryScore * 0.4 + (100 - v.aiRiskScore) * 0.2)),
      }))
      .sort((a, b) => b.composite - a.composite)
  , [vendors])

  const topBySpend = useMemo(() =>
    [...vendors]
      .filter(v => v.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5)
      .map(v => ({ name: v.name.length > 20 ? v.name.slice(0, 18) + '…' : v.name, spend: v.totalSpend }))
  , [vendors])

  const avgQuality  = useMemo(() => Math.round(vendors.reduce((s, v) => s + v.qualityScore, 0) / (vendors.length || 1)), [vendors])
  const avgDelivery = useMemo(() => Math.round(vendors.reduce((s, v) => s + v.deliveryScore, 0) / (vendors.length || 1)), [vendors])
  const goldVendors = useMemo(() => scorecards.filter(v => v.composite >= 85).length, [scorecards])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-[var(--color-accent)]" /> {t('performance.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{t('performance.subtitle')}</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('performance.kpiAvgQuality'),  value: `${avgQuality}/100`,  icon: Award,         bg: 'bg-[rgba(238,107,38,0.07)]',    ic: 'text-[var(--color-accent)]'    },
          { label: t('performance.kpiAvgDelivery'), value: `${avgDelivery}/100`, icon: TrendingUp,     bg: 'bg-emerald-50', ic: 'text-emerald-600' },
          { label: t('performance.kpiGoldTier'),  value: goldVendors,          icon: Sparkles,       bg: 'bg-yellow-50',  ic: 'text-yellow-600'  },
          { label: t('performance.kpiHighRisk'),  value: vendors.filter(v => v.riskLevel === 'high').length, icon: AlertTriangle, bg: 'bg-red-50', ic: 'text-red-600' },
        ].map(({ label, value, icon: Icon, bg, ic }) => (
          <div key={label} className={`rounded-2xl ${bg} p-4 flex items-center gap-4`}>
            <div className="p-3 rounded-xl bg-white shadow-sm flex-shrink-0">
              <Icon className={`h-5 w-5 ${ic}`} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top vendors by spend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" /> {t('performance.topBySpend')}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topBySpend} layout="vertical" margin={{ left: 8, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
              <XAxis type="number" tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={100} />
              <Tooltip formatter={(v) => [`₹${(Number(v) / 100000).toFixed(1)}L`, t('performance.spendTooltip')]} cursor={{ fill: 'rgba(238,107,38,0.25)' }} />
              <Bar dataKey="spend" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly spend trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[var(--color-accent)]" /> {t('performance.monthlyTrend')}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={SPEND_TREND} margin={{ left: 8, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<SpendTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} formatter={(value) => (typeof value === 'string' && t.has(`category.${value}`) ? t(`category.${value}`) : value)} />
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <Line key={cat} type="monotone" dataKey={cat} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vendor scorecard table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Award className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="font-bold text-slate-900">{t('performance.scorecard')}</h2>
          <span className="ml-auto text-xs text-slate-400">{t('performance.sortedByComposite')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3">{t('performance.colRank')}</th>
                <th className="px-5 py-3">{t('performance.colVendor')}</th>
                <th className="px-5 py-3">{t('performance.colCategory')}</th>
                <th className="px-5 py-3">{t('performance.colQuality')}</th>
                <th className="px-5 py-3">{t('performance.colDelivery')}</th>
                <th className="px-5 py-3">{t('performance.colAiRisk')}</th>
                <th className="px-5 py-3">{t('performance.colComposite')}</th>
                <th className="px-5 py-3">{t('performance.colTier')}</th>
                <th className="px-5 py-3">{t('performance.colTotalSpend')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {scorecards.map((v, i) => {
                const tier = vendorTier(v.composite)
                return (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-400 text-sm">#{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{v.name}</p>
                      <p className="text-[11px] text-slate-400">{t.has(`vendorStatus.${v.status}`) ? t(`vendorStatus.${v.status}`) : v.status.replace('_', ' ')}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{t.has(`category.${v.category}`) ? t(`category.${v.category}`) : v.category}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[60px]">
                          <div className="h-1.5 rounded-full bg-[rgba(238,107,38,0.07)]0" style={{ width: `${v.qualityScore}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold", v.qualityScore >= 80 ? 'text-emerald-600' : v.qualityScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                          {v.qualityScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[60px]">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${v.deliveryScore}%` }} />
                        </div>
                        <span className={cn("text-xs font-bold", v.deliveryScore >= 80 ? 'text-emerald-600' : v.deliveryScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                          {v.deliveryScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("text-xs font-bold", v.aiRiskScore <= 25 ? 'text-emerald-600' : v.aiRiskScore <= 55 ? 'text-amber-600' : 'text-red-600')}>
                        {v.aiRiskScore}/100
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-slate-100 rounded-full h-2">
                          <div
                            className={cn("h-2 rounded-full", v.composite >= 85 ? 'bg-yellow-400' : v.composite >= 70 ? 'bg-slate-400' : 'bg-primary')}
                            style={{ width: `${v.composite}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800 text-sm">{v.composite}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", tier.style)}>
                        {tier.icon} {t(`performance.${tier.labelKey}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      ₹{(v.totalSpend / 100000).toFixed(1)}L
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
