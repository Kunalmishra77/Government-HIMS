"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { FileText, Download, ShieldCheck, AlertTriangle } from "lucide-react"
import { useBMWStore, CATEGORY_INFO, type WasteCategory } from "@/store/useBMWStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const CATS: WasteCategory[] = ['Yellow', 'Red', 'Blue', 'Black', 'White', 'Cytotoxic']

export default function BMWReportsPage() {
  const t = useTranslations('bmw')
  const wasteLogs = useBMWStore(s => s.wasteLogs)
  const generateMonthlyReport = useBMWStore(s => s.generateMonthlyReport)
  const reports = useBMWStore(s => s.reports)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth] = useState(currentMonth)

  const liveSummary = useMemo(() => {
    const filtered = wasteLogs.filter(l => l.date.startsWith(month))
    const byCategory: Record<WasteCategory, number> = { Yellow: 0, Red: 0, Blue: 0, Black: 0, White: 0, Cytotoxic: 0 }
    let bags = 0
    for (const l of filtered) { byCategory[l.category] += l.weightKg; bags += l.bagCount }
    const totalKg = Object.values(byCategory).reduce((a, b) => a + b, 0)
    const nonCompliant = filtered.filter(l => l.status === 'non_compliant').length
    const disposed = filtered.filter(l => l.status === 'disposed').length
    const compliance = filtered.length ? Math.round((disposed / filtered.length) * 100) : 100
    return { totalKg: Math.round(totalKg * 10) / 10, bags, byCategory, nonCompliant, disposed, count: filtered.length, compliance }
  }, [wasteLogs, month])

  const existing = reports.find(r => r.month === month)

  const onGenerate = () => {
    generateMonthlyReport(month)
    toast.success(t('toast.reportGenerated', { month }))
  }

  const onExport = () => {
    const payload = {
      hospital: 'Agentix HIMS',
      month,
      generatedAt: new Date().toISOString(),
      ...liveSummary,
      logs: wasteLogs.filter(l => l.date.startsWith(month)),
    }
    if (typeof window !== 'undefined') {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bmw-cpcb-${month}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('toast.exported', { count: liveSummary.count, month }))
  }

  return (
    <div className="space-y-5 p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-700" />{t('reports.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('reports.subtitle')}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded-lg px-2 py-2" />
          <button onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer">
            <ShieldCheck className="h-3.5 w-3.5" />{t('reports.generateReport')}
          </button>
          <button onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] cursor-pointer">
            <Download className="h-3.5 w-3.5" />{t('reports.exportJson')}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reports.totalWaste')}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{liveSummary.totalKg}<span className="text-base font-bold text-slate-500"> {t('reports.kg')}</span></p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reports.bags')}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{liveSummary.bags}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reports.compliance')}</p>
          <p className={cn("text-2xl font-black mt-1", liveSummary.compliance >= 90 ? "text-emerald-700" : liveSummary.compliance >= 75 ? "text-amber-600" : "text-red-600")}>
            {liveSummary.compliance}%
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reports.nonCompliant')}</p>
          <p className={cn("text-2xl font-black mt-1", liveSummary.nonCompliant === 0 ? "text-slate-900" : "text-red-600")}>
            {liveSummary.nonCompliant}
          </p>
        </div>
      </div>

      {/* By category */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-bold text-slate-800 mb-3">{t('reports.breakdownByColourCode')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATS.map(c => {
            const kg = liveSummary.byCategory[c]
            const info = CATEGORY_INFO[c]
            const pct = liveSummary.totalKg ? Math.round((kg / liveSummary.totalKg) * 100) : 0
            return (
              <motion.div key={c} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded ring-1", info.tint)}>{c}</span>
                  <span className="text-xs font-bold text-slate-900">{kg} {t('reports.kg')} · {pct}%</span>
                </div>
                <p className="text-[10px] text-slate-500">{info.types}</p>
              </motion.div>
            )
          })}
        </div>
      </div>

      {existing && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 text-xs text-emerald-800">
            <b>{t('reports.reportSavedDraft')}</b> · {t('reports.reportSavedDetail', { id: existing.id, total: existing.totalWeightKg, compliance: existing.complianceScore })}
          </div>
        </div>
      )}

      {liveSummary.count === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{t('reports.noWasteLogged', { month })}
        </div>
      )}
    </div>
  )
}
