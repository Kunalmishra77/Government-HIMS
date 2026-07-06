"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useVendorManagerStore } from "@/store/useVendorManagerStore"
import { invokeVendorCopilot, type VendorCopilotResponse } from "@/ai-services/vendor-copilot"
import {
  Sparkles, RefreshCw, ChevronRight, AlertTriangle,
  CheckCircle, Info, TrendingUp, Shield,
} from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  urgent: {
    card:  'border-red-200 bg-red-50/50',
    badge: 'bg-red-100 text-red-700',
    dot:   'bg-red-500',
    icon:  AlertTriangle,
    iconCls: 'text-red-500',
  },
  warning: {
    card:  'border-amber-200 bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-700',
    dot:   'bg-amber-500',
    icon:  AlertTriangle,
    iconCls: 'text-amber-500',
  },
  info: {
    card:  'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/30',
    badge: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
    dot:   'bg-[rgba(238,107,38,0.07)]0',
    icon:  Info,
    iconCls: 'text-[var(--color-accent)]',
  },
  positive: {
    card:  'border-emerald-200 bg-emerald-50/30',
    badge: 'bg-emerald-100 text-emerald-700',
    dot:   'bg-emerald-500',
    icon:  CheckCircle,
    iconCls: 'text-emerald-500',
  },
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100)
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

// ─── Risk distribution chart ──────────────────────────────────────────────────

function RiskDistributionChart({ vendors, t }: { vendors: { riskLevel: string }[]; t: ReturnType<typeof useTranslations> }) {
  const counts = { low: 0, medium: 0, high: 0 }
  vendors.forEach(v => { counts[v.riskLevel as keyof typeof counts]++ })
  const data = [
    { name: t('aiInsights.lowRisk'),    value: counts.low,    color: '#16a34a' },
    { name: t('aiInsights.mediumRisk'), value: counts.medium, color: '#d97706' },
    { name: t('aiInsights.highRisk'),   value: counts.high,   color: '#dc2626' },
  ].filter(d => d.value > 0)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Shield className="h-4 w-4 text-[var(--color-accent)]" /> {t('aiInsights.riskDistribution')}
      </h2>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
            {data.map(entry => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v) => [Number(v), t('aiInsights.vendorsTooltip')]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1.5">
        {data.map(d => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-slate-600">{d.name}</span>
            </div>
            <span className="font-bold text-slate-800">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIInsightsPage() {
  const t = useTranslations('vendorManager')
  const vendors        = useVendorManagerStore(s => s.vendors)
  const contracts      = useVendorManagerStore(s => s.contracts)
  const payments       = useVendorManagerStore(s => s.payments)
  const purchaseOrders = useVendorManagerStore(s => s.purchaseOrders)

  const [copilotData, setCopilotData] = useState<VendorCopilotResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<string>('')

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const data = await invokeVendorCopilot(vendors, contracts, payments, purchaseOrders)
      setCopilotData(data)
      setLastRefreshed(new Date().toLocaleTimeString())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInsights() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const urgentCount  = copilotData?.insights.filter(i => i.data.priority === 'urgent').length  ?? 0
  const warningCount = copilotData?.insights.filter(i => i.data.priority === 'warning').length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[var(--color-accent)]" /> {t('aiInsights.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('aiInsights.subtitle')}
            {lastRefreshed && <span className="ml-2 text-slate-400">{t('aiInsights.updated', { time: lastRefreshed })}</span>}
          </p>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t('aiInsights.refreshInsights')}
        </button>
      </div>

      {/* Chips / session context */}
      {copilotData && (
        <div className="flex flex-wrap gap-2">
          {copilotData.chips.map(chip => (
            <span key={chip} className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
              {chip}
            </span>
          ))}
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">
            {t('aiInsights.session', { id: copilotData.sessionId })}
          </span>
        </div>
      )}

      {/* Alert summary bar */}
      {!loading && (urgentCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-900 text-white">
          <Sparkles className="h-5 w-5 text-[var(--color-primary-light)] flex-shrink-0" />
          <p className="text-sm font-semibold flex-1">
            {t('aiInsights.copilotDetected')}{' '}
            {urgentCount > 0 && <span className="text-red-400">{urgentCount > 1 ? t('aiInsights.urgentIssuesOther', { count: urgentCount }) : t('aiInsights.urgentIssuesOne', { count: urgentCount })}</span>}
            {urgentCount > 0 && warningCount > 0 && t('aiInsights.andConnector')}
            {warningCount > 0 && <span className="text-amber-400">{warningCount > 1 ? t('aiInsights.warningsOther', { count: warningCount }) : t('aiInsights.warningsOne', { count: warningCount })}</span>}
            {t('aiInsights.requiringAttention')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Insights list */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
            ))
          ) : copilotData && copilotData.insights.length > 0 ? (
            copilotData.insights.map(insight => {
              const p   = insight.data.priority
              const cfg = PRIORITY_CONFIG[p] ?? PRIORITY_CONFIG.info
              const Icon = cfg.icon
              return (
                <div key={insight.data.id} className={cn("rounded-2xl border p-5 transition-all hover:shadow-md", cfg.card)}>
                  <div className="flex items-start gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-white shadow-sm flex-shrink-0", cfg.iconCls)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", cfg.badge)}>
                          {t.has(`priority.${p}`) ? t(`priority.${p}`) : p}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">{insight.data.title}</h3>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{insight.data.body}</p>

                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase text-slate-400">{t('aiInsights.confidence')}</span>
                          <ConfidenceMeter value={insight.confidence} />
                        </div>
                        <span className="text-[10px] text-slate-400">{t('aiInsights.viaSource', { source: insight.data.sourceService })}</span>
                        {insight.data.actions && insight.data.actions[0] && (
                          <Link href={(insight.data.actions[0].payload as { path: string }).path} className="ml-auto">
                            <button className="text-xs font-bold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1 cursor-pointer">
                              {insight.data.actions[0].label} <ChevronRight className="h-3 w-3" />
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Sparkles className="h-10 w-10 mb-3 text-slate-300" />
              <p className="text-sm font-semibold">{t('aiInsights.noInsightsYet')}</p>
              <p className="text-xs mt-1">{t('aiInsights.noInsightsHint')}</p>
            </div>
          )}
        </div>

        {/* Right column: risk distribution + legend */}
        <div className="space-y-5">
          <RiskDistributionChart vendors={vendors} t={t} />

          {/* Confidence legend */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" /> {t('aiInsights.confidenceTiers')}
            </h2>
            <div className="space-y-2 text-xs">
              {[
                { range: t('aiInsights.tierHighRange'),   label: t('aiInsights.tierHigh'),   color: '#16a34a', desc: t('aiInsights.tierHighDesc') },
                { range: t('aiInsights.tierMediumRange'), label: t('aiInsights.tierMedium'), color: '#d97706', desc: t('aiInsights.tierMediumDesc') },
                { range: t('aiInsights.tierLowRange'),    label: t('aiInsights.tierLow'),    color: '#dc2626', desc: t('aiInsights.tierLowDesc') },
              ].map(tier => (
                <div key={tier.label} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50">
                  <div className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: tier.color }} />
                  <div>
                    <span className="font-bold text-slate-700">{tier.label} ({tier.range})</span>
                    <p className="text-slate-500 mt-0.5">{tier.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-2xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40 p-4 text-xs text-[var(--color-primary-dark)]">
            <p className="font-bold mb-1">{t('aiInsights.aiDisclaimer')}</p>
            <p className="leading-relaxed">{t('aiInsights.aiDisclaimerBody')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
