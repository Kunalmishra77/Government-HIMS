"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { useInventoryStore, type Asset } from "@/store/useInventoryStore"
import { Package, AlertTriangle, Search, Settings, CheckCircle, X, Wrench } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { useTranslations } from "next-intl"

const STATUS_LABEL_KEY: Record<string, string> = {
  "Active": "statusActive",
  "Low Stock": "statusLowStock",
  "Maintenance Required": "statusMaintenanceRequired",
}

function ReorderModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const t = useTranslations("inventory.stock")
  const requestReorder = useInventoryStore((s) => s.requestReorder)
  const defaultQty = Math.max((asset.reorderPoint ?? 100) - (asset.quantity ?? 0), 50)
  const [qty, setQty] = useState(String(defaultQty))
  const [vendor, setVendor] = useState(asset.vendor ?? '')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    const n = parseInt(qty)
    if (!n || n < 1) return
    const reqId = requestReorder({ assetId: asset.id, qty: n, vendor: vendor.trim() || undefined, raisedBy: 'Inventory desk', notes: notes.trim() || undefined })
    const uom = asset.uom ?? t('unitsFallback')
    const vendorName = vendor || t('vendorFallback')
    notifyAndAuditMany(['admin', 'inventory'], {
      type: 'system', priority: 'medium',
      title: t('reorderRequestedTitle', { name: asset.name }),
      body: t('reorderRequestedBody', { qty: n, uom, name: asset.name, vendor: vendorName, id: reqId }),
      audit: { action: 'finance_invoice_received', resource: 'inventory_requisition', resourceId: reqId, detail: t('reorderDetail', { name: asset.name, qty: n, vendor: vendorName }), userName: 'Inventory desk' },
    })
    toast.success(t('reorderRaised', { id: reqId }))
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{t("reorderTitle", { name: asset.name })}</h2>
          <button onClick={onClose} aria-label={t("close")} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
          <p className="text-[12px] text-red-800">{t("currentStock", { qty: asset.quantity ?? 0, uom: asset.uom ?? '', point: asset.reorderPoint ?? '—' })}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("qtyToOrder")}</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("vendor")}</label>
            <input value={vendor} onChange={e => setVendor(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("notes")}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">{t("cancel")}</button>
          <button onClick={handleSubmit} disabled={!qty} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
            {t("raiseReorder")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ReceiveDeliveryModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("inventory.stock")
  const requisitions = useInventoryStore((s) => s.requisitions)
  const receiveDelivery = useInventoryStore((s) => s.receiveDelivery)
  const open = requisitions.filter((r) => r.status === 'submitted')
  const [pick, setPick] = useState(open[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')

  const selected = open.find((r) => r.id === pick)

  const handleSubmit = () => {
    const n = parseInt(qty)
    if (!selected || !n || n < 1) return
    receiveDelivery({ requisitionId: selected.id, receivedQty: n, receivedBy: 'Inventory desk', notes: notes.trim() || undefined })
    notifyAndAudit({
      to: 'admin', type: 'system', priority: 'low',
      title: t('deliveryReceivedTitle', { name: selected.assetName }),
      body: t('deliveryReceivedBody', { qty: n, name: selected.assetName, id: selected.id }),
      audit: { action: 'finance_invoice_approved', resource: 'inventory_requisition', resourceId: selected.id, detail: t('deliveryDetail', { qty: n, id: selected.id }), userName: 'Inventory desk' },
    })
    toast.success(t('receivedToast', { qty: n }))
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{t("receiveTitle")}</h2>
          <button onClick={onClose} aria-label={t("close")} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        {open.length === 0 ? (
          <p className="text-[13px] text-slate-500 bg-slate-50 p-4 rounded-xl">{t("noOpenReqs")}</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("requisition")}</label>
              <Select value={pick} onChange={e => setPick(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {open.map((r) => <option key={r.id} value={r.id}>{r.id} — {r.assetName} × {r.qty}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("qtyReceived")}</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={1}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t("notes")}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>
          </div>
        )}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">{t("cancel")}</button>
          <button onClick={handleSubmit} disabled={open.length === 0 || !qty} className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
            {t("confirmReceipt")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function RepairModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const t = useTranslations("inventory.stock")
  const scheduleRepair = useInventoryStore((s) => s.scheduleRepair)
  const [date, setDate] = useState('')
  const [tech, setTech] = useState('')
  const [desc, setDesc] = useState(asset.aiMaintenanceAlert ?? '')

  const handleSubmit = () => {
    if (!date) return
    scheduleRepair({
      assetId: asset.id,
      vendor: asset.vendor,
      description: desc || t('scheduledRepairFallback', { name: asset.name }),
      scheduledAt: date,
      assignedTo: tech.trim() || undefined,
    })
    notifyAndAuditMany(['admin', 'housekeeping'], {
      type: 'system', priority: 'medium',
      title: t('repairScheduledTitle', { name: asset.name }),
      body: t('repairScheduledBody', { name: asset.name, date, tech: tech ? t('repairScheduledBodyTech', { tech }) : '' }),
      audit: { action: 'finance_invoice_received', resource: 'inventory_repair', resourceId: asset.id, detail: t('repairDetail', { name: asset.name, date }), userName: 'Inventory' },
    })
    toast.success(t('repairScheduledToast', { name: asset.name, date }))
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="repair-title"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="repair-title" className="text-base font-bold text-slate-900">{t("repairTitle")}</h2>
          <button onClick={onClose} aria-label={t("close")} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 mb-4">
          <p className="text-sm font-bold text-amber-900">{asset.name}</p>
          {asset.aiMaintenanceAlert && <p className="text-xs text-amber-700 mt-0.5">{asset.aiMaintenanceAlert}</p>}
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="repair-date" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("repairDate")}</label>
            <input type="date" id="repair-date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label htmlFor="repair-tech" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("technician")}</label>
            <input id="repair-tech" value={tech} onChange={e => setTech(e.target.value)} placeholder={t("technicianPlaceholder")} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label htmlFor="repair-desc" className="block text-sm font-semibold text-slate-700 mb-1.5">{t("issueDescription")}</label>
            <textarea id="repair-desc" value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">{t("cancel")}</button>
          <button onClick={handleSubmit} disabled={!date} className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50">
            {t("schedule")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const FILTER_LABEL_KEY: Record<string, string> = {
  "All": "filterAll",
  "Active": "filterActive",
  "Low Stock": "filterLowStock",
  "Maintenance Required": "filterMaintenanceRequired",
}

export default function InventoryStockPage() {
  const t = useTranslations("inventory.stock")
  const { assets, lowStockItems, requisitions, repairs } = useInventoryStore()
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState<'All' | Asset['status']>('All')
  const [repairing, setRepairing] = useState<Asset | null>(null)
  const [reorderingAsset, setReorderingAsset] = useState<Asset | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)

  const openReqs   = requisitions.filter((r) => r.status === 'submitted').length
  const openRepairs = repairs.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'All' || a.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t("title")}</h1>
          <p className="text-sm text-[#64748B] mt-1">{t("subtitle", { reqs: t("openReqs", { count: openReqs }), repairs: t("activeRepairs", { count: openRepairs }) })}</p>
        </div>
        <button onClick={() => setReceiveOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer">
          <CheckCircle className="h-4 w-4" /> {t("receiveDelivery")}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60 mb-1">{t("totalAssets")}</p>
          <p className="text-xl font-black text-[#0F172A]">{assets.length}</p>
        </div>
        <div className="rounded-xl bg-red-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800/60 mb-1">{t("lowStockMaintenance")}</p>
          <p className="text-xl font-black text-[#0F172A]">{assets.filter(a => a.status !== 'Active').length}</p>
        </div>
        <div className="rounded-xl bg-green-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-800/60 mb-1">{t("active")}</p>
          <p className="text-xl font-black text-[#0F172A]">{assets.filter(a => a.status === 'Active').length}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t("searchAssets")}
            aria-label={t("searchAssets")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          {(['All', 'Active', 'Low Stock', 'Maintenance Required'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filter === f ? 'bg-amber-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t(FILTER_LABEL_KEY[f])}
            </button>
          ))}
        </div>
      </div>

      {/* Asset List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Package className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-semibold">{t("noMatch")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(asset => (
            <Card key={asset.id} className={`p-5 ${asset.status === 'Maintenance Required' ? 'border-amber-200 bg-amber-50/20' : asset.status === 'Low Stock' ? 'border-red-200 bg-red-50/20' : ''}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${asset.category === 'Equipment' ? 'bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)]' : 'bg-slate-50 border border-slate-200'}`}>
                    {asset.category === 'Equipment' ? <Settings className="h-5 w-5 text-[var(--color-accent)]" /> : <Package className="h-5 w-5 text-slate-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#0F172A] text-sm">{asset.name}</p>
                      <NeonBadge variant={asset.status === 'Active' ? 'success' : asset.status === 'Low Stock' ? 'danger' : 'warning'}>
                        {STATUS_LABEL_KEY[asset.status] ? t(STATUS_LABEL_KEY[asset.status]) : asset.status}
                      </NeonBadge>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{asset.id} · {asset.category}</p>
                    {asset.quantity !== undefined && (
                      <p className={`text-xs font-bold mt-0.5 ${asset.quantity === 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {t("qty", { value: asset.quantity === 0 ? t("outOfStock") : asset.quantity })}
                      </p>
                    )}
                    {asset.aiMaintenanceAlert && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs font-bold text-amber-700" role="alert">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        {asset.aiMaintenanceAlert}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {asset.status === 'Maintenance Required' && (
                    <button
                      onClick={() => setRepairing(asset)}
                      aria-label={t("scheduleRepairFor", { name: asset.name })}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors cursor-pointer border border-amber-200"
                    >
                      <Wrench className="h-3.5 w-3.5" /> {t("scheduleRepair")}
                    </button>
                  )}
                  {asset.status === 'Low Stock' && (
                    <button
                      onClick={() => setReorderingAsset(asset)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors cursor-pointer border border-red-200"
                    >
                      {t("reorder")}
                    </button>
                  )}
                  {asset.status === 'Active' && (
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                      <CheckCircle className="h-4 w-4" /> {t("statusActive")}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {repairing && <RepairModal asset={repairing} onClose={() => setRepairing(null)} />}
        {reorderingAsset && <ReorderModal asset={reorderingAsset} onClose={() => setReorderingAsset(null)} />}
        {receiveOpen && <ReceiveDeliveryModal onClose={() => setReceiveOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
