"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Package, Clock, CheckCircle, PackageCheck, PackageX, ShoppingCart, AlertTriangle, ArrowRight, IndianRupee, Hand } from "lucide-react"
import { usePharmacyStore, UNIT_PRICES, type PharmacyPrescription, type RxSource } from "@/store/usePharmacyStore"
import { usePharmacyInventoryStore } from "@/store/usePharmacyInventoryStore"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const SOURCES: RxSource[] = ["OPD", "IPD", "ICU", "OT", "Home Rx", "Discharge"]
const SOURCE_STYLE: Record<RxSource, string> = {
  OPD: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]", IPD: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]", ICU: "bg-red-50 text-red-700",
  OT: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]", "Home Rx": "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]", Discharge: "bg-amber-50 text-amber-700",
}
const STATUS_STYLE: Record<string, string> = {
  queued: "bg-amber-100 text-amber-700", preparing: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]", ready: "bg-green-100 text-green-700",
}
const billOf = (rx: PharmacyPrescription) =>
  rx.adjustedBillTotal ?? rx.medicines.reduce((s, m) => s + m.quantity * (UNIT_PRICES[m.name] ?? 0), 0)
const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString()

export default function PharmacyOverview() {
  const t = useTranslations("pharmacy")
  const prescriptions = usePharmacyStore(s => s.prescriptions)
  const purchaseOrders = usePharmacyInventoryStore(s => s.purchaseOrders)
  const items = usePharmacyInventoryStore(s => s.items)

  const m = useMemo(() => {
    const active = prescriptions.filter(p => p.status !== "collected")
    const collectedToday = prescriptions.filter(p => p.status === "collected" && isToday(p.collectedAt))
    return {
      active,
      unclaimed: active.filter(p => p.status === "queued" && !p.assignedTo).length,
      onCounters: active.filter(p => p.status === "preparing").length,
      ready: active.filter(p => p.status === "ready").length,
      outOfStock: active.reduce((n, p) => n + p.medicines.filter(x => x.inStock === false && (x.supply ?? "pharmacy") === "pharmacy").length, 0),
      collectedTodayCount: collectedToday.length,
      revenueToday: collectedToday.reduce((s, p) => s + billOf(p), 0),
      bySource: SOURCES.map(src => ({ src, count: active.filter(p => (p.source ?? "OPD") === src).length })).filter(x => x.count > 0),
    }
  }, [prescriptions])

  const openPOs = purchaseOrders.filter(p => p.status !== "received").length
  const lowStock = items.filter(i => i.qty <= i.reorderAt).length

  const KPIS = [
    { label: t("overview.kpi.unclaimed"), value: m.unclaimed, icon: Hand, fg: "text-amber-600", bg: "bg-amber-50" },
    { label: t("overview.kpi.onCounters"), value: m.onCounters, icon: Clock, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
    { label: t("overview.kpi.ready"), value: m.ready, icon: CheckCircle, fg: "text-green-600", bg: "bg-green-50" },
    { label: t("overview.kpi.outOfStock"), value: m.outOfStock, icon: PackageX, fg: "text-red-600", bg: "bg-red-50" },
    { label: t("overview.kpi.collectedToday"), value: m.collectedTodayCount, icon: PackageCheck, fg: "text-slate-600", bg: "bg-slate-100" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t("overview.title")}</h1>
          <p className="text-sm text-[#64748B] mt-1">{t("overview.subtitle")}</p>
        </div>
        <Link href="/pharmacy/queue" className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl"
          style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))", boxShadow: "0 2px 8px rgba(238,107,38,0.25)" }}>
          {t("overview.openQueue")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {KPIS.map(s => (
          <div key={s.label} className={cn("rounded-xl p-4 flex items-center gap-3", s.bg)}>
            <div className="p-2.5 rounded-xl bg-white shadow-sm"><s.icon className={cn("h-5 w-5", s.fg)} /></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p><h3 className="text-2xl font-bold text-slate-900">{s.value}</h3></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue by source + next-in-queue preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3">{t("overview.queueBySource")}</h2>
            <div className="flex flex-wrap gap-2">
              {m.bySource.length === 0 && <p className="text-sm text-slate-400">{t("overview.queueClear")}</p>}
              {m.bySource.map(s => (
                <span key={s.src} className={cn("text-xs font-bold px-3 py-1.5 rounded-lg", SOURCE_STYLE[s.src])}>{s.src} · {s.count}</span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{t("overview.nextInQueue")}</h2>
              <Link href="/pharmacy/queue" className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">{t("overview.openQueue")} <ArrowRight className="h-3 w-3" /></Link>
            </div>
            <div className="divide-y divide-slate-100">
              {m.active.slice(0, 6).map(rx => (
                <div key={rx.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0", SOURCE_STYLE[rx.source ?? "OPD"])}>{rx.source ?? "OPD"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{rx.patientName} <span className="text-xs font-normal text-slate-400">· {rx.doctorName}</span></p>
                  </div>
                  {rx.medicines.some(x => x.inStock === false && (x.supply ?? "pharmacy") === "pharmacy") && <PackageX className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0", STATUS_STYLE[rx.status] ?? "bg-slate-100 text-slate-500")}>{rx.status}</span>
                </div>
              ))}
              {m.active.length === 0 && <p className="px-4 py-6 text-sm text-slate-400 text-center">{t("overview.noActive")}</p>}
            </div>
          </div>
        </div>

        {/* Stock & procurement + revenue */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">{t("overview.collectedToday")}</p>
            <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-1 mt-1"><IndianRupee className="h-5 w-5" />{m.revenueToday}</h3>
            <p className="text-xs text-[var(--color-accent)] mt-0.5">{t("overview.dispensedCount", { count: m.collectedTodayCount })}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">{t("overview.stockProcurement")}</h2>
            <Link href="/pharmacy/inventory" className="flex items-center justify-between hover:bg-slate-50 -mx-1 px-1 py-1.5 rounded-lg">
              <span className="text-sm text-slate-600 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-[var(--color-accent)]" /> {t("overview.openPurchaseOrders")}</span>
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1">{openPOs} <ArrowRight className="h-3 w-3 text-slate-400" /></span>
            </Link>
            <Link href="/pharmacy/inventory" className="flex items-center justify-between hover:bg-slate-50 -mx-1 px-1 py-1.5 rounded-lg">
              <span className="text-sm text-slate-600 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> {t("overview.reorderAlerts")}</span>
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1">{lowStock} <ArrowRight className="h-3 w-3 text-slate-400" /></span>
            </Link>
            <Link href="/pharmacy/inventory" className="flex items-center justify-between hover:bg-slate-50 -mx-1 px-1 py-1.5 rounded-lg">
              <span className="text-sm text-slate-600 flex items-center gap-2"><Package className="h-4 w-4 text-[var(--color-accent)]" /> {t("overview.stockLines")}</span>
              <span className="text-sm font-bold text-slate-900 flex items-center gap-1">{items.length} <ArrowRight className="h-3 w-3 text-slate-400" /></span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
