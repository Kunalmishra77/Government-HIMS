"use client"

import { usePharmacyInventoryStore, type POStatus } from "@/store/usePharmacyInventoryStore"
import { useAuthStore } from "@/store/useAuthStore"
import { Package, AlertTriangle, Sparkles, TrendingDown, ShieldAlert, ShoppingCart, Clock, Send, Lock } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const PO_STYLE: Record<POStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  ordered: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]",
  received: "bg-green-100 text-green-700",
}
const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const h = Math.round(mins / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export default function PharmacyInventory() {
  const t = useTranslations("pharmacy")
  const items = usePharmacyInventoryStore(s => s.items)
  const purchaseOrders = usePharmacyInventoryStore(s => s.purchaseOrders)
  const requestRestock = usePharmacyInventoryStore(s => s.requestRestock)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? "Ritu Sharma"

  const low = items.filter(i => i.qty <= i.reorderAt)
  const controlled = items.filter(i => i.schedule)
  const openPOs = purchaseOrders.filter(p => p.status !== "received")
  // Outgoing requests this pharmacy raised (read-only status; the Inventory
  // Manager acts on them in their own panel).
  const myRequests = purchaseOrders

  const requestRestockFor = (item: typeof items[number]) => {
    const ask = Math.max(item.maxStock - item.qty, item.reorderAt)
    requestRestock(item.name, ask, meName)
    toast.success(t("inventory.restockSent", { name: item.name, qty: ask, unit: item.unit }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">{t("inventory.title")}</h1>
        <p className="text-sm text-[#64748B] mt-1">{t("inventory.subtitle")}</p>
      </div>

      {/* Ownership banner — restock and procurement are done by the Inventory Manager */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex items-start gap-2.5">
        <Lock className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800"><span className="font-bold">{t("inventory.managedBanner")}</span> {t("inventory.managedBannerDetail")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: t("inventory.kpi.stockLines"), value: items.length, icon: Package, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: t("inventory.kpi.reorderAlerts"), value: low.length, icon: AlertTriangle, fg: "text-amber-600", bg: "bg-amber-50" },
          { label: t("inventory.kpi.openRequests"), value: openPOs.length, icon: ShoppingCart, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: t("inventory.kpi.controlled"), value: controlled.length, icon: ShieldAlert, fg: "text-red-600", bg: "bg-red-50" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 flex items-center gap-4 ${s.bg}`}>
            <div className="p-3 rounded-xl bg-white shadow-sm"><s.icon className={`h-5 w-5 ${s.fg}`} /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p><h3 className="text-2xl font-bold text-slate-900">{s.value}</h3></div>
          </div>
        ))}
      </div>

      {/* My requests (read-only status) */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="text-sm font-bold text-slate-800">{t("inventory.myRequests")}</h2>
          <span className="text-xs text-slate-400">{t("inventory.myRequestsHint")}</span>
        </div>
        {myRequests.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400 text-center">{t("inventory.noRequests")}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {myRequests.map(po => (
              <div key={po.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                    {po.drug} <span className="text-slate-400 font-normal">× {po.qty}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${PO_STYLE[po.status]}`}>{po.status}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${po.kind === "patient" ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]"}`}>{po.kind === "patient" ? t("inventory.patientTag") : t("inventory.restockTag")}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    {po.forPatient && <>{t("inventory.forPatient")} <b className="text-slate-600">{po.forPatient}</b> · </>}
                    {t("inventory.raisedBy", { name: po.raisedBy })} · <Clock className="h-3 w-3" /> {timeAgo(po.raisedAt)}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"><Lock className="h-3 w-3" />{t("inventory.managerActions")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {low.length > 0 && (
        <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--color-primary-dark)] mb-1"><Sparkles className="h-4 w-4" /> {t("inventory.aiSuggestion")}</p>
          <p className="text-xs text-[var(--color-accent)]">{low.map(i => `${i.name} (${i.qty}/${i.reorderAt})`).join(" · ")} — {t("inventory.belowReorder")}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{[t("inventory.columns.drug"), t("inventory.columns.category"), t("inventory.columns.onHand"), t("inventory.columns.level"), t("inventory.columns.action")].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(i => {
              const pct = Math.round((i.qty / i.maxStock) * 100)
              const lowStock = i.qty <= i.reorderAt
              const alreadyRequested = purchaseOrders.some(p => p.status !== "received" && p.kind === "restock" && (p.drug === i.name))
              return (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{i.name}{i.schedule && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{t("master.schedule", { schedule: i.schedule })}</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{i.category}</td>
                  <td className="px-4 py-3"><span className={`font-bold ${lowStock ? "text-red-600" : "text-slate-800"}`}>{i.qty}</span> <span className="text-slate-400">{i.unit}</span></td>
                  <td className="px-4 py-3 w-40">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${lowStock ? "bg-red-500" : pct < 40 ? "bg-amber-400" : "bg-green-500"}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    {lowStock && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-1"><TrendingDown className="h-3 w-3" /> {t("inventory.reorderAt", { level: i.reorderAt })}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lowStock ? (
                      alreadyRequested ? (
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />{t("inventory.requested")}</span>
                      ) : (
                        <button onClick={() => requestRestockFor(i)}
                          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] px-3 py-1.5 rounded-lg cursor-pointer"><Send className="h-3.5 w-3.5" />{t("inventory.requestRestock")}</button>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">{t("inventory.adequate")}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
