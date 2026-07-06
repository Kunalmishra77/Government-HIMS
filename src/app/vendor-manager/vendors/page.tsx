"use client"

import { useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useVendorManagerStore, type VMVendor } from "@/store/useVendorManagerStore"
import { assessVendorRisk } from "@/ai-services/vendor-risk-assessor"
import {
  Search, Plus, X, Truck, AlertTriangle, CheckCircle,
  Sparkles, Loader2, Phone, Mail, MapPin, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

// ─── Styles ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  active:       'bg-emerald-100 text-emerald-700',
  inactive:     'bg-slate-100 text-slate-500',
  suspended:    'bg-red-100 text-red-700',
  on_probation: 'bg-amber-100 text-amber-700',
}

const RISK_STYLE: Record<string, string> = {
  low:    'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high:   'bg-red-100 text-red-700',
}

// ─── Add Vendor schema ────────────────────────────────────────────────────────

const makeAddVendorSchema = (t: (k: string) => string) => z.object({
  name:         z.string().min(2, t('vendors.errNameRequired')),
  category:     z.enum(['Equipment', 'Consumables', 'Pharma', 'Services', 'Facility']),
  status:       z.enum(['active', 'inactive', 'on_probation']),
  gstNumber:    z.string().min(15, t('vendors.errGstLength')).max(15),
  email:        z.string().email(t('vendors.errEmailInvalid')),
  phone:        z.string().min(10, t('vendors.errPhoneRequired')),
  address:      z.string().min(5, t('vendors.errAddressRequired')),
  paymentTerms: z.enum(['prepaid', 'net_7', 'net_30', 'net_60']),
  riskLevel:    z.enum(['low', 'medium', 'high']),
  qualityScore: z.coerce.number().min(0).max(100),
  deliveryScore:z.coerce.number().min(0).max(100),
  aiRiskScore:  z.coerce.number().min(0).max(100),
})
type AddVendorForm = z.infer<ReturnType<typeof makeAddVendorSchema>>

// ─── Detail panel ─────────────────────────────────────────────────────────────

function VendorDetailPanel({ vendor, onClose }: { vendor: VMVendor; onClose: () => void }) {
  const t = useTranslations('vendorManager')
  const contracts   = useVendorManagerStore(s => s.contracts)
  const suspendVendor = useVendorManagerStore(s => s.suspendVendor)
  const updateVendor  = useVendorManagerStore(s => s.updateVendor)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiReport, setAiReport] = useState<Awaited<ReturnType<typeof assessVendorRisk>>['data'] | null>(null)

  const vendorContracts = contracts.filter(c => c.vendorId === vendor.id)

  const runAiAssessment = async () => {
    setAiLoading(true)
    try {
      const result = await assessVendorRisk(vendor)
      setAiReport(result.data)
    } finally {
      setAiLoading(false)
    }
  }

  const handleStatusChange = (newStatus: VMVendor['status']) => {
    if (newStatus === 'suspended') {
      suspendVendor(vendor.id)
    } else {
      updateVendor(vendor.id, { status: newStatus })
    }
    toast.success(t('vendors.statusUpdated', { status: t.has(`vendorStatus.${newStatus}`) ? t(`vendorStatus.${newStatus}`) : newStatus }))
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30 backdrop-blur-sm" />
      <div
        className="w-[420px] max-w-full bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{vendor.name}</h2>
            <p className="text-xs text-slate-400 font-mono">{vendor.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Status + Category */}
          <div className="flex flex-wrap gap-2">
            <span className={cn("text-[11px] font-bold uppercase px-2.5 py-1 rounded-full", STATUS_STYLE[vendor.status])}>
              {t.has(`vendorStatus.${vendor.status}`) ? t(`vendorStatus.${vendor.status}`) : vendor.status.replace('_', ' ')}
            </span>
            <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">
              {t.has(`category.${vendor.category}`) ? t(`category.${vendor.category}`) : vendor.category}
            </span>
            <span className={cn("text-[11px] font-bold uppercase px-2.5 py-1 rounded-full", RISK_STYLE[vendor.riskLevel])}>
              {t('vendors.detailRiskSuffix', { risk: t.has(`risk.${vendor.riskLevel}`) ? t(`risk.${vendor.riskLevel}`) : vendor.riskLevel })}
            </span>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('vendors.scoreQuality'), value: vendor.qualityScore, color: vendor.qualityScore >= 80 ? 'text-emerald-600' : vendor.qualityScore >= 60 ? 'text-amber-600' : 'text-red-600' },
              { label: t('vendors.scoreDelivery'), value: vendor.deliveryScore, color: vendor.deliveryScore >= 80 ? 'text-emerald-600' : vendor.deliveryScore >= 60 ? 'text-amber-600' : 'text-red-600' },
              { label: t('vendors.scoreAiRisk'), value: vendor.aiRiskScore, color: vendor.aiRiskScore <= 25 ? 'text-emerald-600' : vendor.aiRiskScore <= 55 ? 'text-amber-600' : 'text-red-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}<span className="text-xs text-slate-400">/100</span></p>
              </div>
            ))}
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('vendors.contact')}</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{vendor.email}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                {vendor.phone}
              </div>
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{vendor.address}</span>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('vendors.gstNumber')}</p>
              <p className="font-mono text-slate-800 text-xs mt-1">{vendor.gstNumber}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('vendors.paymentTermsLabel')}</p>
              <p className="font-semibold text-slate-800 mt-1">{t.has(`paymentTerms.${vendor.paymentTerms}`) ? t(`paymentTerms.${vendor.paymentTerms}`) : vendor.paymentTerms.replace('_', ' ')}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('vendors.totalSpend')}</p>
              <p className="font-bold text-slate-800 mt-1">₹{(vendor.totalSpend / 100000).toFixed(1)}L</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('vendors.activeContracts')}</p>
              <p className="font-bold text-slate-800 mt-1">{vendor.activeContracts}</p>
            </div>
          </div>

          {/* Contracts */}
          {vendorContracts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{t('vendors.contracts')}</p>
              <div className="space-y-2">
                {vendorContracts.map(c => (
                  <div key={c.id} className="rounded-xl border border-slate-100 p-3 text-xs">
                    <p className="font-semibold text-slate-800">{c.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-500">{c.startDate} → {c.endDate}</span>
                      <span className={cn("font-bold uppercase px-1.5 py-0.5 rounded",
                        c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'expiring_soon' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      )}>{t.has(`contractStatus.${c.status}`) ? t(`contractStatus.${c.status}`) : c.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-slate-600 font-semibold mt-1">₹{(c.value / 100000).toFixed(1)}L</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Risk Assessment */}
          <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[var(--color-primary-dark)] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> {t('vendors.aiRiskAssessment')}
              </p>
              <button
                onClick={runAiAssessment}
                disabled={aiLoading}
                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {aiLoading ? t('vendors.analysing') : t('vendors.runAnalysis')}
              </button>
            </div>
            {aiReport ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">{t('vendors.riskScoreLabel')}</span>
                  <span className={cn("font-bold", aiReport.tier === 'high' ? 'text-red-600' : aiReport.tier === 'medium' ? 'text-amber-600' : 'text-emerald-600')}>
                    {t('vendors.riskScoreValue', { score: aiReport.overallScore, tier: t.has(`risk.${aiReport.tier}`) ? t(`risk.${aiReport.tier}`) : aiReport.tier })}
                  </span>
                </div>
                {aiReport.flags.length > 0 && (
                  <ul className="space-y-1">
                    {aiReport.flags.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-slate-600">
                        <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-slate-700 font-medium leading-relaxed">{aiReport.recommendation}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-accent)]">{t('vendors.runAiHint')}</p>
            )}
          </div>

          {/* Status change */}
          {vendor.status !== 'suspended' && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{t('vendors.changeStatus')}</p>
              <div className="flex flex-wrap gap-2">
                {(['active', 'inactive', 'on_probation', 'suspended'] as VMVendor['status'][])
                  .filter(s => s !== vendor.status)
                  .map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer capitalize transition-colors"
                    >
                      {t.has(`vendorStatus.${s}`) ? t(`vendorStatus.${s}`) : s.replace('_', ' ')}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Vendor modal ─────────────────────────────────────────────────────────

function AddVendorModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('vendorManager')
  const addVendor = useVendorManagerStore(s => s.addVendor)
  const { register, handleSubmit, formState: { errors } } = useForm<AddVendorForm>({
    resolver: zodResolver(makeAddVendorSchema(t)) as Resolver<AddVendorForm>,
    defaultValues: { category: 'Equipment', status: 'active', paymentTerms: 'net_30', riskLevel: 'low', qualityScore: 80, deliveryScore: 80, aiRiskScore: 20 },
  })

  const onSubmit = (data: AddVendorForm) => {
    addVendor(data)
    toast.success(t('vendors.addSuccess', { name: data.name }))
    onClose()
  }

  const inputCls = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
  const selectCls = "w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
  const errCls = "text-[10px] text-red-500 mt-0.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--color-accent)]" /> {t('vendors.addModalTitle')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.vendorNameLabel')}</label>
              <input {...register('name')} className={inputCls} placeholder={t('vendors.vendorNamePlaceholder')} />
              {errors.name && <p className={errCls}>{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.categoryLabel')}</label>
              <select {...register('category')} className={selectCls}>
                {['Equipment', 'Consumables', 'Pharma', 'Services', 'Facility'].map(c => <option key={c} value={c}>{t.has(`category.${c}`) ? t(`category.${c}`) : c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.statusLabel')}</label>
              <select {...register('status')} className={selectCls}>
                <option value="active">{t('vendorStatus.active')}</option>
                <option value="inactive">{t('vendorStatus.inactive')}</option>
                <option value="on_probation">{t('vendorStatus.on_probation')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.paymentTermsFieldLabel')}</label>
              <select {...register('paymentTerms')} className={selectCls}>
                <option value="prepaid">{t('paymentTerms.prepaid')}</option>
                <option value="net_7">{t('paymentTerms.net_7')}</option>
                <option value="net_30">{t('paymentTerms.net_30')}</option>
                <option value="net_60">{t('paymentTerms.net_60')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.riskLevelLabel')}</label>
              <select {...register('riskLevel')} className={selectCls}>
                <option value="low">{t('risk.low')}</option>
                <option value="medium">{t('risk.medium')}</option>
                <option value="high">{t('risk.high')}</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.gstNumberLabel')}</label>
              <input {...register('gstNumber')} className={inputCls} placeholder={t('vendors.gstPlaceholder')} maxLength={15} />
              {errors.gstNumber && <p className={errCls}>{errors.gstNumber.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.emailLabel')}</label>
              <input {...register('email')} type="email" className={inputCls} placeholder={t('vendors.emailPlaceholder')} />
              {errors.email && <p className={errCls}>{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.phoneLabel')}</label>
              <input {...register('phone')} className={inputCls} placeholder={t('vendors.phonePlaceholder')} />
              {errors.phone && <p className={errCls}>{errors.phone.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.addressLabel')}</label>
              <input {...register('address')} className={inputCls} placeholder={t('vendors.addressPlaceholder')} />
              {errors.address && <p className={errCls}>{errors.address.message}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.qualityScoreLabel')}</label>
              <input {...register('qualityScore')} type="number" min={0} max={100} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">{t('vendors.deliveryScoreLabel')}</label>
              <input {...register('deliveryScore')} type="number" min={0} max={100} className={inputCls} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">{t('vendors.cancel')}</button>
            <button type="submit" className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
              <CheckCircle className="h-4 w-4" /> {t('vendors.addVendor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Equipment', 'Consumables', 'Pharma', 'Services', 'Facility']
const STATUSES   = ['All', 'active', 'inactive', 'suspended', 'on_probation']
const RISKS      = ['All', 'low', 'medium', 'high']

export default function VendorsPage() {
  const t = useTranslations('vendorManager')
  const vendors = useVendorManagerStore(s => s.vendors)

  const [q, setQ]               = useState('')
  const [category, setCategory] = useState('All')
  const [status, setStatus]     = useState('All')
  const [risk, setRisk]         = useState('All')
  const [selected, setSelected] = useState<VMVendor | null>(null)
  const [showAdd, setShowAdd]   = useState(false)

  const filtered = useMemo(() => vendors.filter(v => {
    const matchQ   = !q || `${v.name} ${v.gstNumber} ${v.email}`.toLowerCase().includes(q.toLowerCase())
    const matchCat = category === 'All' || v.category === category
    const matchSt  = status === 'All'   || v.status === status
    const matchR   = risk === 'All'     || v.riskLevel === risk
    return matchQ && matchCat && matchSt && matchR
  }), [vendors, q, category, status, risk])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-6 w-6 text-[var(--color-accent)]" /> {t('vendors.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('vendors.count', { filtered: filtered.length, total: vendors.length })}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> {t('vendors.addVendor')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('vendors.searchPlaceholder')}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
          />
        </div>
        {[
          { value: category, onChange: setCategory, opts: CATEGORIES, label: t('vendors.filterCategory'), ns: 'category' },
          { value: status,   onChange: setStatus,   opts: STATUSES,   label: t('vendors.filterStatus'),   ns: 'vendorStatus' },
          { value: risk,     onChange: setRisk,     opts: RISKS,      label: t('vendors.filterRisk'),     ns: 'risk' },
        ].map(({ value, onChange, opts, label, ns }) => (
          <div key={label} className="relative">
            <select
              value={value} onChange={e => onChange(e.target.value)}
              className="h-9 pl-3 pr-8 rounded-lg border border-slate-200 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
            >
              {opts.map(o => <option key={o} value={o}>{o === 'All' ? t('vendors.filterAll', { label }) : (t.has(`${ns}.${o}`) ? t(`${ns}.${o}`) : o.replace('_', ' '))}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3">{t('vendors.colVendor')}</th>
                <th className="px-5 py-3">{t('vendors.colCategory')}</th>
                <th className="px-5 py-3">{t('vendors.colStatus')}</th>
                <th className="px-5 py-3">{t('vendors.colQuality')}</th>
                <th className="px-5 py-3">{t('vendors.colDelivery')}</th>
                <th className="px-5 py-3">{t('vendors.colAiRisk')}</th>
                <th className="px-5 py-3">{t('vendors.colContracts')}</th>
                <th className="px-5 py-3">{t('vendors.colTotalSpend')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(v => (
                <tr
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className="hover:bg-[rgba(238,107,38,0.10)]/30 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-800">{v.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{v.id}</p>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{t.has(`category.${v.category}`) ? t(`category.${v.category}`) : v.category}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", STATUS_STYLE[v.status])}>
                      {t.has(`vendorStatus.${v.status}`) ? t(`vendorStatus.${v.status}`) : v.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("font-semibold text-xs", v.qualityScore >= 80 ? 'text-emerald-600' : v.qualityScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                      {v.qualityScore}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("font-semibold text-xs", v.deliveryScore >= 80 ? 'text-emerald-600' : v.deliveryScore >= 60 ? 'text-amber-600' : 'text-red-600')}>
                      {v.deliveryScore}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", RISK_STYLE[v.riskLevel])}>
                      {t.has(`risk.${v.riskLevel}`) ? t(`risk.${v.riskLevel}`) : v.riskLevel}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{v.activeContracts}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-800">
                    ₹{(v.totalSpend / 100000).toFixed(1)}L
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">
                    {t('vendors.noMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <VendorDetailPanel vendor={selected} onClose={() => setSelected(null)} />}
      {showAdd   && <AddVendorModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
