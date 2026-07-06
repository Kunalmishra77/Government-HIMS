"use client"

import { useState } from "react"
import { useBillingStore, type BillStatus } from "@/store/useBillingStore"
import { VisibilityHeader, STAT_CARD } from "@/components/reception/VisibilityHeader"
import { CreditCard, Wallet, CheckCircle2, AlertTriangle, Search, Receipt, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { printableHtml } from "@/lib/fileIO"

const STATUS_TINT: Record<BillStatus, string> = {
  draft: 'bg-slate-100 text-slate-600', frozen: 'bg-[rgba(238,107,38,0.07)] text-[#B84A16]', settled: 'bg-green-50 text-green-700', dispute: 'bg-red-50 text-red-600',
}
const STATUS_KEY: Record<BillStatus, string> = { draft: 'statusDraft', frozen: 'statusFrozen', settled: 'statusSettled', dispute: 'statusDispute' }
const FILTER_KEY: Record<string, string> = { all: 'filterAll', pending: 'filterPending', settled: 'filterSettled' }

export default function ReceptionBilling() {
  const t = useTranslations('reception')
  const bills = useBillingStore(s => s.bills)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all')

  const outstanding = (b: typeof bills[number]) => Math.max(0, b.patientDue - b.paidAmount)
  const totalOutstanding = bills.filter(b => b.status !== 'settled').reduce((s, b) => s + outstanding(b), 0)
  const pendingCount = bills.filter(b => b.status !== 'settled').length
  const settledCount = bills.filter(b => b.status === 'settled').length
  const totalBilled = bills.reduce((s, b) => s + b.subtotal, 0)

  const rows = bills.filter(b => {
    const q = search.trim().toLowerCase()
    const mq = !q || b.patientName.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)
    const mf = filter === 'all' || (filter === 'pending' ? b.status !== 'settled' : b.status === 'settled')
    return mq && mf
  })

  const tiles = [
    { label: t('billing.tileOutstanding'), value: `₹${totalOutstanding.toLocaleString('en-IN')}`, icon: Wallet, tint: 'bg-rose-50 text-rose-600' },
    { label: t('billing.tilePendingBills'), value: `${pendingCount}`, icon: AlertTriangle, tint: 'bg-amber-50 text-amber-600' },
    { label: t('billing.tileSettled'), value: `${settledCount}`, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
    { label: t('billing.tileTotalBilled'), value: `₹${totalBilled.toLocaleString('en-IN')}`, icon: CreditCard, tint: 'bg-[rgba(238,107,38,0.07)] text-[#B84A16]' },
  ]

  return (
    <div className="pb-6">
      <VisibilityHeader title={t('billing.title')} subtitle={t('billing.subtitle')} owner={t('billing.owner')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {tiles.map(t => (
          <div key={t.label} className={STAT_CARD}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.tint)}><t.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[20px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{t.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('billing.searchPlaceholder')}
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="flex gap-1">
          {(['all', 'pending', 'settled'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("text-[12px] font-bold px-3 py-1.5 rounded-lg capitalize transition", filter === f ? "bg-[#C2481A] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>{t(`billing.${FILTER_KEY[f]}`)}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(b => {
          const due = outstanding(b)
          return (
            <div key={b.id} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center flex-shrink-0"><Receipt className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[14.5px] font-bold text-slate-900">{b.patientName}</p>
                    <p className="text-[12px] text-slate-500">{b.id} · {b.visitType} · {b.payerType}</p>
                  </div>
                </div>
                <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", STATUS_TINT[b.status])}>{t(`billing.${STATUS_KEY[b.status]}`)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Amt label={t('billing.amtBillTotal')} value={b.subtotal} />
                <Amt label={t('billing.amtInsurance')} value={b.insuranceCovered} prefix="−" tint="text-[#B84A16]" icon />
                <Amt label={t('billing.amtPaid')} value={b.paidAmount} tint="text-green-600" />
                <Amt label={t('billing.amtOutstanding')} value={due} tint={due > 0 ? "text-rose-600" : "text-slate-900"} bold />
              </div>

              {b.status !== 'settled' && (
                <button onClick={() => {
                  printableHtml(t('billing.slipTitle', { id: b.id }), `
                    <div class="info-row">
                      <div class="info-item"><span class="info-label">${t('billing.slipPatient')}</span><span class="info-value">${b.patientName}</span></div>
                      <div class="info-item"><span class="info-label">${t('billing.slipBillNo')}</span><span class="info-value">${b.id}</span></div>
                      <div class="info-item"><span class="info-label">${t('billing.slipVisitType')}</span><span class="info-value">${b.visitType}</span></div>
                      <div class="info-item"><span class="info-label">${t('billing.slipPayer')}</span><span class="info-value">${b.payerType}</span></div>
                    </div>
                    <h3>${t('billing.slipPaymentBreakdown')}</h3>
                    <table><thead><tr><th>${t('billing.slipDescription')}</th><th style="text-align:right">${t('billing.slipAmount')}</th></tr></thead><tbody>
                      <tr><td>${t('billing.slipTotalBilled')}</td><td style="text-align:right">${b.subtotal.toLocaleString('en-IN')}</td></tr>
                      <tr><td>${t('billing.slipInsuranceCovered')}</td><td style="text-align:right">− ${b.insuranceCovered.toLocaleString('en-IN')}</td></tr>
                      <tr><td>${t('billing.slipPaidSoFar')}</td><td style="text-align:right">− ${b.paidAmount.toLocaleString('en-IN')}</td></tr>
                      <tr class="total"><td>${t('billing.slipOutstandingDue')}</td><td style="text-align:right">₹${due.toLocaleString('en-IN')}</td></tr>
                    </tbody></table>`)
                  toast.success(t('billing.printingSlipToast', { name: b.patientName }))
                }}
                  className="mt-3 text-[12.5px] font-semibold text-[#B84A16] hover:text-[#B84A16] cursor-pointer">{t('billing.printPaymentSlip')}</button>
              )}
              {b.status === 'settled' && b.receiptNumber && (
                <p className="mt-3 text-[12px] text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> {t('billing.settledReceipt', { receipt: b.receiptNumber })}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Amt({ label, value, prefix = '', tint = 'text-slate-900', bold, icon }: { label: string; value: number; prefix?: string; tint?: string; bold?: boolean; icon?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <p className="text-[10.5px] font-semibold text-slate-400 flex items-center gap-1">{icon && <ShieldCheck className="h-3 w-3" />}{label}</p>
      <p className={cn("text-[14px] mt-0.5 tabular-nums", bold ? "font-bold" : "font-semibold", tint)}>{prefix}₹{value.toLocaleString('en-IN')}</p>
    </div>
  )
}
