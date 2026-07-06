"use client"

import { useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useVendorManagerStore, type VMContract } from "@/store/useVendorManagerStore"
import {
  FileText, Plus, X, CheckCircle, AlertTriangle,
  Calendar, ChevronDown, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

// ─── Styles ───────────────────────────────────────────────────────────────────

const CONTRACT_STATUS_STYLE: Record<string, string> = {
  draft:          'bg-slate-100 text-slate-600',
  active:         'bg-emerald-100 text-emerald-700',
  expiring_soon:  'bg-amber-100 text-amber-800',
  expired:        'bg-red-100 text-red-700',
  terminated:     'bg-rose-100 text-rose-700',
}

const REF_DATE = '2026-06-08'

function daysRemaining(endDate: string): number {
  const ref = new Date(REF_DATE)
  const end = new Date(endDate)
  return Math.round((end.getTime() - ref.getTime()) / 86400000)
}

// ─── Add Contract schema ──────────────────────────────────────────────────────

const makeAddContractSchema = (t: (k: string) => string) => z.object({
  vendorId:   z.string().min(1, t('contracts.errSelectVendor')),
  title:      z.string().min(3, t('contracts.errTitleRequired')),
  value:      z.coerce.number().min(1, t('contracts.errValuePositive')),
  startDate:  z.string().min(1, t('contracts.errStartRequired')),
  endDate:    z.string().min(1, t('contracts.errEndRequired')),
  status:     z.enum(['draft', 'active', 'expiring_soon', 'expired', 'terminated']),
  autoRenew:  z.boolean(),
})
type AddContractForm = z.infer<ReturnType<typeof makeAddContractSchema>>

function AddContractModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('vendorManager')
  const vendors     = useVendorManagerStore(s => s.vendors)
  const addContract = useVendorManagerStore(s => s.addContract)
  const { register, handleSubmit, watch, formState: { errors } } = useForm<AddContractForm>({
    resolver: zodResolver(makeAddContractSchema(t)) as Resolver<AddContractForm>,
    defaultValues: { status: 'active', autoRenew: false },
  })

  const selectedVendorId = watch('vendorId')
  const selectedVendor   = vendors.find(v => v.id === selectedVendorId)

  const onSubmit = (data: AddContractForm) => {
    addContract({
      vendorId:   data.vendorId,
      vendorName: selectedVendor?.name ?? data.vendorId,
      title:      data.title,
      value:      data.value,
      startDate:  data.startDate,
      endDate:    data.endDate,
      status:     data.status,
      autoRenew:  data.autoRenew,
    })
    toast.success(t('contracts.createdToast'))
    onClose()
  }

  const inputCls  = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
  const selectCls = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
  const errCls    = "text-[10px] text-red-500 mt-0.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--color-accent)]" /> {t('contracts.modalTitle')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('contracts.vendorLabel')}</label>
            <select {...register('vendorId')} className={selectCls}>
              <option value="">{t('contracts.selectVendor')}</option>
              {vendors.filter(v => v.status === 'active').map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            {errors.vendorId && <p className={errCls}>{errors.vendorId.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('contracts.contractTitleLabel')}</label>
            <input {...register('title')} className={inputCls} placeholder={t('contracts.contractTitlePlaceholder')} />
            {errors.title && <p className={errCls}>{errors.title.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('contracts.contractValueLabel')}</label>
            <input {...register('value')} type="number" className={inputCls} placeholder={t('contracts.contractValuePlaceholder')} />
            {errors.value && <p className={errCls}>{errors.value.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('contracts.startDateLabel')}</label>
              <input {...register('startDate')} type="date" className={inputCls} />
              {errors.startDate && <p className={errCls}>{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('contracts.endDateLabel')}</label>
              <input {...register('endDate')} type="date" className={inputCls} />
              {errors.endDate && <p className={errCls}>{errors.endDate.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('contracts.statusLabel')}</label>
              <select {...register('status')} className={selectCls}>
                <option value="draft">{t('contracts.statusDraft')}</option>
                <option value="active">{t('contracts.statusActive')}</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input {...register('autoRenew')} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[var(--color-accent)] cursor-pointer" />
                <span className="text-sm font-semibold text-slate-600">{t('contracts.autoRenewLabel')}</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">{t('contracts.cancel')}</button>
            <button type="submit" className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
              <CheckCircle className="h-4 w-4" /> {t('contracts.createContract')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'active' | 'expiring' | 'expired'

export default function ContractsPage() {
  const t = useTranslations('vendorManager')
  const contracts        = useVendorManagerStore(s => s.contracts)
  const terminateContract = useVendorManagerStore(s => s.terminateContract)

  const [tab, setTab]         = useState<TabKey>('all')
  const [q, setQ]             = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return contracts.filter(c => {
      const matchQ = !q || `${c.vendorName} ${c.title} ${c.id}`.toLowerCase().includes(q.toLowerCase())
      const days   = daysRemaining(c.endDate)
      const matchTab =
        tab === 'all'      ? true :
        tab === 'active'   ? c.status === 'active' :
        tab === 'expiring' ? (c.status === 'active' || c.status === 'expiring_soon') && days <= 30 :
        tab === 'expired'  ? (c.status === 'expired' || c.status === 'terminated') : true
      return matchQ && matchTab
    })
  }, [contracts, q, tab])

  const expiringCount = useMemo(() =>
    contracts.filter(c => (c.status === 'active' || c.status === 'expiring_soon') && daysRemaining(c.endDate) <= 30).length
  , [contracts])

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all',      label: t('contracts.tabAll'),      count: contracts.length },
    { key: 'active',   label: t('contracts.tabActive'),   count: contracts.filter(c => c.status === 'active').length },
    { key: 'expiring', label: t('contracts.tabExpiring'), count: expiringCount },
    { key: 'expired',  label: t('contracts.tabExpired') },
  ]

  const handleTerminate = (id: string) => {
    terminateContract(id)
    toast.success(t('contracts.terminatedToast'))
    setConfirm(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-[var(--color-accent)]" /> {t('contracts.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length !== 1 ? t('contracts.countOther', { count: filtered.length }) : t('contracts.countOne', { count: filtered.length })}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> {t('contracts.newContract')}
        </button>
      </div>

      {/* Expiring alert banner */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {expiringCount > 1 ? t('contracts.expiringBannerOther', { count: expiringCount }) : t('contracts.expiringBannerOne', { count: expiringCount })}
          </p>
          <button onClick={() => setTab('expiring')} className="ml-auto text-xs font-bold text-amber-700 hover:text-amber-900 cursor-pointer underline">
            {t('contracts.view')}
          </button>
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  tab === t.key ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-slate-200 text-slate-500"
                )}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('contracts.searchPlaceholder')}
            className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3">{t('contracts.colVendorTitle')}</th>
                <th className="px-5 py-3">{t('contracts.colValue')}</th>
                <th className="px-5 py-3">{t('contracts.colStart')}</th>
                <th className="px-5 py-3">{t('contracts.colEnd')}</th>
                <th className="px-5 py-3">{t('contracts.colDaysLeft')}</th>
                <th className="px-5 py-3">{t('contracts.colStatus')}</th>
                <th className="px-5 py-3">{t('contracts.colAutoRenew')}</th>
                <th className="px-5 py-3">{t('contracts.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => {
                const days = daysRemaining(c.endDate)
                const isTerminable = c.status === 'active' || c.status === 'expiring_soon' || c.status === 'draft'
                return (
                  <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{c.title}</p>
                      <p className="text-xs text-slate-400">{c.vendorName} · <span className="font-mono">{c.id}</span></p>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800">₹{(c.value / 100000).toFixed(1)}L</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{c.startDate}</td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{c.endDate}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "font-bold text-xs flex items-center gap-1",
                        days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-600'
                      )}>
                        {days < 0 ? t('contracts.daysAgo', { days: Math.abs(days) }) : t('contracts.daysLeft', { days })}
                        {days >= 0 && days <= 30 && <Calendar className="h-3 w-3" />}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", CONTRACT_STATUS_STYLE[c.status])}>
                        {t.has(`contractStatus.${c.status}`) ? t(`contractStatus.${c.status}`) : c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">
                      {c.autoRenew ? <span className="text-emerald-600 font-semibold">{t('contracts.yes')}</span> : <span className="text-slate-400">{t('contracts.no')}</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {isTerminable && (
                        confirm === c.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleTerminate(c.id)} className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded cursor-pointer">{t('contracts.confirm')}</button>
                            <button onClick={() => setConfirm(null)} className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 cursor-pointer">{t('contracts.cancel')}</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirm(c.id)}
                            className="text-[10px] font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded cursor-pointer transition-colors"
                          >
                            {t('contracts.terminate')}
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">{t('contracts.noMatch')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddContractModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
