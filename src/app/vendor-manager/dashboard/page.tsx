"use client"

import { useEffect, useMemo, useState } from "react"
import { useVendorManagerStore } from "@/store/useVendorManagerStore"
import { invokeVendorCopilot, type VendorCopilotResponse } from "@/ai-services/vendor-copilot"
import {
  Truck, FileText, CreditCard, AlertTriangle, Sparkles,
  TrendingUp, RefreshCw, ChevronRight, Package, Clock,
} from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"

const PRIORITY_STYLE = {
  urgent:   { ring: 'border-red-200 bg-red-50/60',   badge: 'bg-red-100 text-red-700',   dot: 'bg-red-500' },
  warning:  { ring: 'border-amber-200 bg-amber-50/60', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  info:     { ring: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40',  badge: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',  dot: 'bg-[rgba(238,107,38,0.07)]0' },
  positive: { ring: 'border-emerald-200 bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Equipment: 'var(--color-primary)',
  Pharma: '#C2481A',
  Consumables: '#EE6B26',
  Services: '#D97706',
  Facility: '#059669',
}

const PO_STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  acknowledged: 'bg-accent-soft text-accent',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

export default function VendorDashboardPage() {
  const t = useTranslations('vendorManager')
  const vendors = useVendorManagerStore(s => s.vendors)
  const contracts = useVendorManagerStore(s => s.contracts)
  const purchaseOrders = useVendorManagerStore(s => s.purchaseOrders)
  const payments = useVendorManagerStore(s => s.payments)

  const [copilotData, setCopilotData] = useState<VendorCopilotResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const activeVendors      = useMemo(() => vendors.filter(v => v.status === 'active').length, [vendors])
  const highRiskVendors    = useMemo(() => vendors.filter(v => v.riskLevel === 'high').length, [vendors])
  const overduePayments    = useMemo(() => payments.filter(p => p.status === 'overdue').length, [payments])
  const expiringContracts  = useMemo(() => {
    const cutoff = new Date('2026-06-08')
    cutoff.setDate(cutoff.getDate() + 30)
    const limit = cutoff.toISOString().slice(0, 10)
    return contracts.filter(c => (c.status === 'active' || c.status === 'expiring_soon') && c.endDate <= limit).length
  }, [contracts])

  const recentPOs = useMemo(() => [...purchaseOrders].slice(0, 6), [purchaseOrders])

  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    vendors.forEach(v => { map[v.category] = (map[v.category] ?? 0) + v.totalSpend })
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(e => e.value > 0)
  }, [vendors])

  const fetchCopilot = async () => {
    setLoading(true)
    try {
      const data = await invokeVendorCopilot(vendors, contracts, payments, purchaseOrders)
      setCopilotData(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCopilot() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const kpis = [
    { label: t('dashboard.kpiActiveVendors'),      value: activeVendors,     icon: Truck,         bg: 'bg-[rgba(238,107,38,0.07)]',    ic: 'text-[var(--color-accent)]'   },
    { label: t('dashboard.kpiExpiringContracts'),  value: expiringContracts, icon: FileText,      bg: 'bg-amber-50',   ic: 'text-amber-600'  },
    { label: t('dashboard.kpiOverduePayments'),    value: overduePayments,   icon: CreditCard,    bg: 'bg-red-50',     ic: 'text-red-600'    },
    { label: t('dashboard.kpiHighRiskVendors'),   value: highRiskVendors,   icon: AlertTriangle, bg: 'bg-primary-soft',  ic: 'text-accent' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <button
          onClick={fetchCopilot}
          disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t('dashboard.refreshAi')}
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, bg, ic }) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Copilot panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
            <h2 className="font-bold text-slate-900">{t('dashboard.copilotTitle')}</h2>
            {copilotData && (
              <div className="ml-auto flex gap-1.5">
                {copilotData.chips.map(c => (
                  <span key={c} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c}</span>
                ))}
              </div>
            )}
          </div>
          <div className="p-5 space-y-3 min-h-[220px]">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              ))
            ) : copilotData && copilotData.insights.length > 0 ? (
              copilotData.insights.slice(0, 4).map(insight => {
                const p = insight.data.priority
                const s = PRIORITY_STYLE[p] ?? PRIORITY_STYLE.info
                return (
                  <div key={insight.data.id} className={`rounded-xl border p-4 ${s.ring}`}>
                    <div className="flex items-start gap-3">
                      <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-sm text-slate-800">{insight.data.title}</p>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${s.badge}`}>{t.has(`priority.${p}`) ? t(`priority.${p}`) : p}</span>
                          <span className="text-[10px] text-slate-400 ml-auto">{t('dashboard.confidence', { pct: Math.round(insight.confidence * 100) })}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{insight.data.body}</p>
                        {insight.data.actions && insight.data.actions[0] && (
                          <Link href={(insight.data.actions[0].payload as { path: string }).path}>
                            <button className="mt-2 text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1 cursor-pointer">
                              {insight.data.actions[0].label} <ChevronRight className="h-3 w-3" />
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">{t('dashboard.noInsights')}</div>
            )}
            {copilotData && copilotData.insights.length > 4 && (
              <Link href="/vendor-manager/ai-insights">
                <button className="w-full text-center text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] py-2 cursor-pointer">
                  {t('dashboard.viewAllInsights', { count: copilotData.insights.length })}
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Spend by category donut */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--color-accent)]" />
            {t('dashboard.spendByCategory')}
          </h2>
          {spendByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={spendByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {spendByCategory.map(entry => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`₹${(Number(v) / 100000).toFixed(1)}L`, t('dashboard.spendTooltip')]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {spendByCategory.map(e => (
                  <div key={e.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[e.name] ?? '#94A3B8' }} />
                      <span className="text-slate-600">{t.has(`category.${e.name}`) ? t(`category.${e.name}`) : e.name}</span>
                    </div>
                    <span className="font-semibold text-slate-800">₹{(e.value / 100000).toFixed(1)}L</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">{t('dashboard.noSpendData')}</div>
          )}
        </div>
      </div>

      {/* Recent POs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--color-accent)]" />
            {t('dashboard.recentPurchaseOrders')}
          </h2>
          <Link href="/vendor-manager/purchase-orders">
            <button className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] cursor-pointer">{t('dashboard.viewAll')}</button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-5 py-3">{t('dashboard.colPoId')}</th>
                <th className="px-5 py-3">{t('dashboard.colVendor')}</th>
                <th className="px-5 py-3">{t('dashboard.colAmount')}</th>
                <th className="px-5 py-3">{t('dashboard.colExpectedDelivery')}</th>
                <th className="px-5 py-3">{t('dashboard.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentPOs.map(po => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{po.id}</td>
                  <td className="px-5 py-3 font-semibold text-slate-800 max-w-[200px] truncate">{po.vendorName}</td>
                  <td className="px-5 py-3 font-semibold text-slate-800">₹{po.totalAmount.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {po.expectedDelivery}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", PO_STATUS_STYLE[po.status])}>
                      {t.has(`poStatus.${po.status}`) ? t(`poStatus.${po.status}`) : po.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
