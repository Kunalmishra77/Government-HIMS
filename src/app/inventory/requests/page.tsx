"use client"

import { useMemo, useState } from "react"
import { usePharmacyInventoryStore, type POStatus, type PurchaseOrder } from "@/store/usePharmacyInventoryStore"
import { ShoppingCart, Truck, PackageCheck, Clock, Filter, User, Pill, Hourglass } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const PO_STYLE: Record<POStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  ordered: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]",
  received: "bg-green-100 text-green-700",
}
const STATUS_LABEL_KEY: Record<POStatus, string> = {
  pending: "statusPending",
  ordered: "statusOrdered",
  received: "statusReceived",
}
const STATUS_ORDER: Record<POStatus, number> = { pending: 0, ordered: 1, received: 2 }

type TFn = ReturnType<typeof useTranslations>
const timeAgo = (iso: string, t: TFn) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return t("timeMinsAgo", { mins: Math.max(1, mins) })
  const h = Math.round(mins / 60)
  return h < 24 ? t("timeHoursAgo", { hours: h }) : t("timeDaysAgo", { days: Math.round(h / 24) })
}

type KindFilter = "all" | "restock" | "patient"

export default function InventoryManagerRequests() {
  const t = useTranslations("inventory.requests")
  const purchaseOrders = usePharmacyInventoryStore(s => s.purchaseOrders)
  const setPOStatus = usePharmacyInventoryStore(s => s.setPOStatus)
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [showReceived, setShowReceived] = useState(false)

  const { pending, ordered, received, openCount, restockCount, patientCount } = useMemo(() => {
    const filtered = purchaseOrders.filter(p => kindFilter === "all" || p.kind === kindFilter)
    const sorted = [...filtered].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.raisedAt.localeCompare(a.raisedAt)))
    return {
      pending: sorted.filter(p => p.status === "pending"),
      ordered: sorted.filter(p => p.status === "ordered"),
      received: sorted.filter(p => p.status === "received"),
      openCount: purchaseOrders.filter(p => p.status !== "received").length,
      restockCount: purchaseOrders.filter(p => p.kind === "restock" && p.status !== "received").length,
      patientCount: purchaseOrders.filter(p => p.kind === "patient" && p.status !== "received").length,
    }
  }, [purchaseOrders, kindFilter])

  const markOrdered = (po: PurchaseOrder) => { setPOStatus(po.id, "ordered"); toast.success(t("orderPlaced", { drug: po.drug })) }
  const markReceived = (po: PurchaseOrder) => { setPOStatus(po.id, "received"); toast.success(t("receivedToast", { drug: po.drug, qty: po.qty })) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("title")}</h1>
        <p className="text-sm text-[#64748B] mt-1">{t("subtitle")}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t("kpiOpenRequests"), value: openCount, icon: ShoppingCart, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: t("kpiRestockAsks"), value: restockCount, icon: Pill, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: t("kpiPatientProcurement"), value: patientCount, icon: User, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: t("kpiPendingAction"), value: pending.length, icon: Hourglass, fg: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-4 flex items-center gap-3", s.bg)}>
            <div className="p-2.5 rounded-xl bg-white shadow-sm"><s.icon className={cn("h-5 w-5", s.fg)} /></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p><h3 className="text-2xl font-bold text-slate-900">{s.value}</h3></div>
          </div>
        ))}
      </div>

      {/* Kind filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-slate-400" />
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {([["all", "filterAll"], ["restock", "filterRestock"], ["patient", "filterPatient"]] as const).map(([k, labelKey]) => (
            <button key={k} onClick={() => setKindFilter(k)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition", kindFilter === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{t(labelKey)}</button>
          ))}
        </div>
      </div>

      {/* Pending — needs to be placed with supplier */}
      <Section title={t("pendingAction")} count={pending.length} emptyText={t("pendingEmpty")}>
        {pending.map(po => (
          <RequestRow key={po.id} po={po} t={t} action={
            <button onClick={() => markOrdered(po)} className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] px-3 py-1.5 rounded-lg cursor-pointer"><Truck className="h-3.5 w-3.5" />{t("markOrdered")}</button>
          } />
        ))}
      </Section>

      {/* Ordered — awaiting receipt */}
      <Section title={t("awaitingReceipt")} count={ordered.length} emptyText={t("awaitingEmpty")}>
        {ordered.map(po => (
          <RequestRow key={po.id} po={po} t={t} action={
            <button onClick={() => markReceived(po)} className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg cursor-pointer"><PackageCheck className="h-3.5 w-3.5" />{t("markReceived")}</button>
          } />
        ))}
      </Section>

      {/* Received — history (collapsed by default) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button onClick={() => setShowReceived(s => !s)} className="w-full px-4 py-3 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50">
          <div className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-green-600" /><h2 className="text-sm font-bold text-slate-800">{t("recentlyReceived")}</h2><span className="text-xs text-slate-400">{received.length}</span></div>
          <span className="text-xs font-semibold text-slate-400">{showReceived ? t("hide") : t("show")}</span>
        </button>
        {showReceived && (
          <div className="divide-y divide-slate-100">
            {received.length === 0 && <p className="px-4 py-6 text-sm text-slate-400 text-center">{t("noHistory")}</p>}
            {received.map(po => <RequestRow key={po.id} po={po} t={t} action={<span className="flex items-center gap-1.5 text-xs font-bold text-green-600"><PackageCheck className="h-3.5 w-3.5" />{t("received")}</span>} flat />)}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, count, emptyText, children }: { title: string; count: number; emptyText: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {count === 0 ? <p className="px-4 py-6 text-sm text-slate-400 text-center">{emptyText}</p> : <div className="divide-y divide-slate-100">{children}</div>}
    </div>
  )
}

function RequestRow({ po, action, flat, t }: { po: PurchaseOrder; action: React.ReactNode; flat?: boolean; t: TFn }) {
  return (
    <div className={cn("px-4 py-3 flex items-center justify-between gap-3 flex-wrap", !flat && "hover:bg-slate-50")}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
          {po.drug} <span className="text-slate-400 font-normal">× {po.qty}</span>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", PO_STYLE[po.status])}>{t(STATUS_LABEL_KEY[po.status])}</span>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", po.kind === "patient" ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]")}>{po.kind === "patient" ? t("badgePatient") : t("badgeRestock")}</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
          {po.forPatient && t("forPatient", { name: po.forPatient })}
          {t("raisedBy", { name: po.raisedBy })}<Clock className="h-3 w-3" /> {timeAgo(po.raisedAt, t)}
        </p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}
