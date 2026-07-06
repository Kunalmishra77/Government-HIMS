"use client"

import { useMemo, useState } from "react"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useVendorManagerStore, type VMPurchaseOrder, type VMPOStatus } from "@/store/useVendorManagerStore"
import {
  ShoppingCart, Plus, X, CheckCircle, Trash2,
  Clock, Package, ChevronRight, AlertTriangle, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

// ─── Styles ───────────────────────────────────────────────────────────────────

const PO_STATUS_STYLE: Record<string, { card: string; badge: string }> = {
  draft:        { card: 'border-slate-200 bg-slate-50',      badge: 'bg-slate-100 text-slate-600'    },
  sent:         { card: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40',     badge: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]'      },
  acknowledged: { card: 'border-primary/20 bg-primary-soft', badge: 'bg-accent-soft text-accent'  },
  delivered:    { card: 'border-emerald-200 bg-emerald-50/30',badge: 'bg-emerald-100 text-emerald-700'},
  cancelled:    { card: 'border-red-100 bg-red-50/20',       badge: 'bg-red-100 text-red-600'        },
}

// ─── Create PO schema ─────────────────────────────────────────────────────────

const makeCreatePOSchema = (t: (k: string) => string) => z.object({
  vendorId:         z.string().min(1, t('purchaseOrders.errSelectVendor')),
  items:            z.array(z.object({
    name:      z.string().min(1, t('purchaseOrders.errItemName')),
    qty:       z.coerce.number().min(1, t('purchaseOrders.errQty')),
    unitPrice: z.coerce.number().min(1, t('purchaseOrders.errPrice')),
  })).min(1, t('purchaseOrders.errAtLeastOne')),
  expectedDelivery: z.string().min(1, t('purchaseOrders.errExpectedDelivery')),
})
type CreatePOForm = z.infer<ReturnType<typeof makeCreatePOSchema>>

function CreatePOModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('vendorManager')
  const vendors  = useVendorManagerStore(s => s.vendors)
  const createPO = useVendorManagerStore(s => s.createPO)

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<CreatePOForm>({
    resolver: zodResolver(makeCreatePOSchema(t)) as Resolver<CreatePOForm>,
    defaultValues: { items: [{ name: '', qty: 1, unitPrice: 0 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const watchItems          = watch('items')
  const selectedVendorId    = watch('vendorId')
  const selectedVendor      = vendors.find(v => v.id === selectedVendorId)
  const totalAmount         = watchItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0)

  const vendorDeliveryScore = selectedVendor?.deliveryScore ?? 100
  const showDeliveryWarning = vendorDeliveryScore < 70

  const onSubmit = (data: CreatePOForm) => {
    const vendor = vendors.find(v => v.id === data.vendorId)
    createPO({
      vendorId:         data.vendorId,
      vendorName:       vendor?.name ?? data.vendorId,
      items:            data.items.map(i => ({ name: i.name, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })),
      totalAmount,
      status:           'draft',
      expectedDelivery: data.expectedDelivery,
    })
    toast.success(t('purchaseOrders.createdToast'))
    onClose()
  }

  const inputCls  = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
  const selectCls = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--color-accent)]" /> {t('purchaseOrders.modalTitle')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Vendor */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('purchaseOrders.vendorLabel')}</label>
            <select {...register('vendorId')} className={selectCls}>
              <option value="">{t('purchaseOrders.selectVendor')}</option>
              {vendors.filter(v => v.status === 'active').map(v => (
                <option key={v.id} value={v.id}>{v.name} ({t.has(`category.${v.category}`) ? t(`category.${v.category}`) : v.category})</option>
              ))}
            </select>
            {errors.vendorId && <p className="text-[10px] text-red-500 mt-0.5">{errors.vendorId.message}</p>}
          </div>

          {/* Delivery warning */}
          {showDeliveryWarning && selectedVendor && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{t('purchaseOrders.deliveryWarning', { vendor: selectedVendor.name, score: vendorDeliveryScore })}</span>
            </div>
          )}

          {/* Expected delivery */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('purchaseOrders.expectedDeliveryLabel')}</label>
            <input {...register('expectedDelivery')} type="date" className={inputCls} />
            {errors.expectedDelivery && <p className="text-[10px] text-red-500 mt-0.5">{errors.expectedDelivery.message}</p>}
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">{t('purchaseOrders.lineItemsLabel')}</label>
              <button
                type="button"
                onClick={() => append({ name: '', qty: 1, unitPrice: 0 })}
                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> {t('purchaseOrders.addItem')}
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-6">
                    <input {...register(`items.${idx}.name`)} className={inputCls} placeholder={t('purchaseOrders.itemNamePlaceholder')} />
                  </div>
                  <div className="col-span-2">
                    <input {...register(`items.${idx}.qty`)} type="number" min={1} className={inputCls} placeholder={t('purchaseOrders.qtyPlaceholder')} />
                  </div>
                  <div className="col-span-3">
                    <input {...register(`items.${idx}.unitPrice`)} type="number" min={0} className={inputCls} placeholder={t('purchaseOrders.unitPricePlaceholder')} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center pt-1">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-slate-400 hover:text-red-500 cursor-pointer transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {errors.items && <p className="text-[10px] text-red-500 mt-1">{t('purchaseOrders.invalidLineItems')}</p>}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">{t('purchaseOrders.totalAmount')}</span>
            <span className="text-lg font-bold text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">{t('purchaseOrders.cancel')}</button>
            <button type="submit" className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
              <CheckCircle className="h-4 w-4" /> {t('purchaseOrders.createPoConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PO detail drawer ─────────────────────────────────────────────────────────

function PODetailDrawer({ po, onClose }: { po: VMPurchaseOrder; onClose: () => void }) {
  const t = useTranslations('vendorManager')
  const updatePOStatus = useVendorManagerStore(s => s.updatePOStatus)
  const vendors        = useVendorManagerStore(s => s.vendors)
  const vendor         = vendors.find(v => v.id === po.vendorId)

  const NEXT_STATUS: Record<VMPOStatus, VMPOStatus | null> = {
    draft: 'sent', sent: 'acknowledged', acknowledged: 'delivered', delivered: null, cancelled: null,
  }
  const next = NEXT_STATUS[po.status]
  const statusLabel = (s: VMPOStatus) => t.has(`poStatus.${s}`) ? t(`poStatus.${s}`) : s

  const advance = () => {
    if (!next) return
    updatePOStatus(po.id, next, next === 'delivered' ? new Date().toISOString().slice(0, 10) : undefined)
    toast.success(t('purchaseOrders.statusUpdatedToast', { status: statusLabel(next) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30 backdrop-blur-sm" />
      <div className="w-[400px] max-w-full bg-white shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 font-mono">{po.id}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{po.vendorName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 p-5 space-y-5">
          {/* Status pipeline */}
          <div className="flex items-center gap-1 text-xs font-semibold">
            {(['draft', 'sent', 'acknowledged', 'delivered'] as VMPOStatus[]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-1">
                <span className={cn(
                  "px-2 py-1 rounded-lg",
                  po.status === s ? 'bg-[var(--color-primary)] text-white' :
                  (['draft','sent','acknowledged','delivered'].indexOf(po.status) > i) ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-400'
                )}>
                  {statusLabel(s)}
                </span>
                {i < arr.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              </div>
            ))}
          </div>

          {/* Vendor delivery warning */}
          {vendor && vendor.deliveryScore < 70 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{t('purchaseOrders.detailDeliveryWarning', { vendor: vendor.name, score: vendor.deliveryScore })}</span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">{t('purchaseOrders.expectedDeliveryDetail')}</p>
              <p className="font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-slate-400" />{po.expectedDelivery}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] uppercase font-bold text-slate-400">{t('purchaseOrders.actualDelivery')}</p>
              <p className="font-semibold text-slate-800 mt-1">{po.actualDelivery ?? '—'}</p>
            </div>
          </div>

          {/* Line items */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{t('purchaseOrders.lineItems')}</p>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                    <th className="px-3 py-2 text-left">{t('purchaseOrders.colItem')}</th>
                    <th className="px-3 py-2 text-right">{t('purchaseOrders.colQty')}</th>
                    <th className="px-3 py-2 text-right">{t('purchaseOrders.colUnit')}</th>
                    <th className="px-3 py-2 text-right">{t('purchaseOrders.colTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {po.items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-700">{it.name}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{it.qty}</td>
                      <td className="px-3 py-2 text-right text-slate-600">₹{it.unitPrice.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">₹{(it.qty * it.unitPrice).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="px-3 py-2 text-slate-600">{t('purchaseOrders.total')}</td>
                    <td className="px-3 py-2 text-right text-slate-900">₹{po.totalAmount.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Advance / cancel */}
          {po.status !== 'delivered' && po.status !== 'cancelled' && (
            <div className="flex gap-2 pt-1">
              {next && (
                <button
                  onClick={advance}
                  className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {t('purchaseOrders.markAs', { status: statusLabel(next) })}
                </button>
              )}
              <button
                onClick={() => { updatePOStatus(po.id, 'cancelled'); toast.success(t('purchaseOrders.poCancelledToast')); onClose() }}
                className="h-10 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold cursor-pointer transition-colors"
              >
                {t('purchaseOrders.cancelPo')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const STATUSES: (VMPOStatus | 'All')[] = ['All', 'draft', 'sent', 'acknowledged', 'delivered', 'cancelled']

export default function PurchaseOrdersPage() {
  const t = useTranslations('vendorManager')
  const purchaseOrders = useVendorManagerStore(s => s.purchaseOrders)

  const [statusFilter, setStatusFilter] = useState<VMPOStatus | 'All'>('All')
  const [q, setQ]                       = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [selectedPO, setSelectedPO]     = useState<VMPurchaseOrder | null>(null)

  const filtered = useMemo(() => purchaseOrders.filter(po => {
    const matchQ  = !q || `${po.id} ${po.vendorName}`.toLowerCase().includes(q.toLowerCase())
    const matchSt = statusFilter === 'All' || po.status === statusFilter
    return matchQ && matchSt
  }), [purchaseOrders, q, statusFilter])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-[var(--color-accent)]" /> {t('purchaseOrders.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('purchaseOrders.count', { filtered: filtered.length, total: purchaseOrders.length })}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> {t('purchaseOrders.createPo')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('purchaseOrders.searchPlaceholder')}
            className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white w-52"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer capitalize",
                statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {s === 'All' ? t('purchaseOrders.tabAll') : (t.has(`poStatus.${s}`) ? t(`poStatus.${s}`) : s.replace('_', ' '))}
              {s !== 'All' && (
                <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  statusFilter === s ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-slate-200 text-slate-500"
                )}>{purchaseOrders.filter(p => p.status === s).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* PO cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(po => {
          const s = PO_STATUS_STYLE[po.status]
          return (
            <div
              key={po.id}
              onClick={() => setSelectedPO(po)}
              className={cn("rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all", s.card)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-mono text-xs text-slate-500">{po.id}</p>
                  <p className="font-bold text-slate-800 text-sm mt-0.5 leading-tight">{po.vendorName}</p>
                </div>
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", s.badge)}>
                  {t.has(`poStatus.${po.status}`) ? t(`poStatus.${po.status}`) : po.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                {po.items.length !== 1 ? t('purchaseOrders.itemsOther', { count: po.items.length }) : t('purchaseOrders.itemsOne', { count: po.items.length })}
                <span className="ml-auto font-bold text-slate-800">₹{po.totalAmount.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                <span>{t('purchaseOrders.expectedPrefix', { date: po.expectedDelivery })}</span>
                {po.actualDelivery && (
                  <span className="ml-auto text-emerald-600 font-semibold">✓ {po.actualDelivery}</span>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-slate-400 text-sm">{t('purchaseOrders.noneFound')}</div>
        )}
      </div>

      {showCreate  && <CreatePOModal onClose={() => setShowCreate(false)} />}
      {selectedPO  && <PODetailDrawer po={selectedPO} onClose={() => setSelectedPO(null)} />}
    </div>
  )
}
