"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ShieldAlert, AlertTriangle, Search, ChevronRight,
  Receipt, Truck, Sparkles, CheckCircle2, X,
} from "lucide-react"
import { useBillingStore } from "@/store/useBillingStore"
import { useVendorStore } from "@/store/useVendorStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useAuditStore } from "@/store/useAuditStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const fmtINR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const fmtDate = (s: string) => new Date(s + (s.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

type Tab = 'patient' | 'vendor' | 'ai_flags'

export default function DisputesPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const bills = useBillingStore(s => s.bills)
  const detectDuplicates = useBillingStore(s => s.detectDuplicates)
  const freezeBill = useBillingStore(s => s.freezeBill)
  const invoices = useVendorStore(s => s.invoices)
  const markPaid = useVendorStore(s => s.markPaid)
  const disputeInvoice = useVendorStore(s => s.disputeInvoice)

  const canResolve = canDo(currentUser?.role, 'finance.write')
  const actorName = currentUser?.name ?? 'Administrator'

  const [tab, setTab] = useState<Tab>('patient')
  const [search, setSearch] = useState('')

  // ── Patient billing disputes ─────────────────────────────────────────
  const patientDisputes = useMemo(() => bills.filter(b => b.status === 'dispute'), [bills])

  // ── Vendor invoice disputes ──────────────────────────────────────────
  const vendorDisputes = useMemo(() => invoices.filter(i => i.status === 'disputed'), [invoices])

  // ── AI duplicate flags across all bills ──────────────────────────────
  const aiDuplicateFlags = useMemo(() => {
    const out: { bill: typeof bills[number]; alerts: ReturnType<typeof detectDuplicates> }[] = []
    for (const b of bills) {
      const alerts = detectDuplicates(b.patientId)
      if (alerts.length > 0) out.push({ bill: b, alerts })
    }
    return out
  }, [bills, detectDuplicates])

  const tabCounts = {
    patient: patientDisputes.length,
    vendor: vendorDisputes.length,
    ai_flags: aiDuplicateFlags.reduce((sum, x) => sum + x.alerts.length, 0),
  }

  const filteredPatient = useMemo(() => {
    if (!search) return patientDisputes
    const s = search.toLowerCase()
    return patientDisputes.filter(b =>
      b.patientName.toLowerCase().includes(s) ||
      b.id.toLowerCase().includes(s) ||
      b.payerType.toLowerCase().includes(s),
    )
  }, [patientDisputes, search])

  const filteredVendor = useMemo(() => {
    if (!search) return vendorDisputes
    const s = search.toLowerCase()
    return vendorDisputes.filter(i =>
      i.vendorName.toLowerCase().includes(s) ||
      i.invoiceNumber.toLowerCase().includes(s),
    )
  }, [vendorDisputes, search])

  const handleResolvePatient = (billId: string) => {
    if (!canResolve) { toast.error(t('disputes.noPermission')); return }
    const bill = bills.find(b => b.id === billId)
    if (!bill) return
    freezeBill(billId, actorName)
    useAuditStore.getState().log({
      userId: 'ADM-01', userName: actorName,
      action: 'finance_dispute_resolved',
      resource: 'bill', resourceId: billId,
      detail: `Patient bill dispute resolved · ${bill.patientName} · ${fmtINR(bill.subtotal)}`,
    })
    toast.success(t('disputes.resolvedPatient', { name: bill.patientName }))
  }

  const handleResolveVendor = (invId: string) => {
    if (!canResolve) { toast.error(t('disputes.noPermission')); return }
    const inv = invoices.find(i => i.id === invId)
    if (!inv) return
    const ref = `NEFT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`
    markPaid(invId, ref, actorName)
    useAuditStore.getState().log({
      userId: 'ADM-01', userName: actorName,
      action: 'finance_dispute_resolved',
      resource: 'vendor_invoice', resourceId: invId,
      detail: `Vendor invoice dispute resolved + paid · ${inv.vendorName} · ${ref}`,
    })
    toast.success(t('disputes.resolvedVendor', { name: inv.vendorName }))
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />{t('disputes.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('disputes.subtitle')}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label={t('disputes.kpiPatient')} value={tabCounts.patient} tint={tabCounts.patient > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('disputes.kpiVendor')} value={tabCounts.vendor} tint={tabCounts.vendor > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('disputes.kpiAiFlags')} value={tabCounts.ai_flags} tint={tabCounts.ai_flags > 0 ? "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]" : "bg-slate-50 border-slate-200 text-slate-600"} />
        <KPI label={t('disputes.kpiTotalOpen')} value={tabCounts.patient + tabCounts.vendor + tabCounts.ai_flags}
          tint="bg-[rgba(238,107,38,0.07)] border-primary/20 text-[var(--color-accent)]" />
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          {(['patient', 'vendor', 'ai_flags'] as Tab[]).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              data-testid={`dispute-tab-${tabKey}`}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer capitalize',
                tab === tabKey ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t(`disputes.tab.${tabKey}`)}
              <span className="ml-1 text-slate-400">{tabCounts[tabKey]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('disputes.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300" />
        </div>
      </div>

      {/* Patient billing disputes */}
      {tab === 'patient' && (
        <div className="space-y-2">
          {filteredPatient.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">{t('disputes.noPatientDisputes')}</p>
            </div>
          ) : filteredPatient.map((b, i) => (
            <motion.div key={b.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="rounded-xl border border-red-200 bg-red-50/30 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5 text-red-600" />
                    {b.patientName} <span className="text-[11px] text-slate-400">· {b.id}</span>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">{b.payerType} · {b.visitType}</p>
                  <p className="text-xs text-slate-700 mt-1">
                    {t('disputes.total')}: <b>{fmtINR(b.subtotal)}</b> · {t('disputes.paid')}: <b className="text-emerald-700">{fmtINR(b.paidAmount)}</b> · {t('disputes.due')}: <b className="text-red-700">{fmtINR(b.patientDue - b.paidAmount)}</b>
                  </p>
                </div>
                {canResolve && (
                  <button onClick={() => handleResolvePatient(b.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                    <CheckCircle2 className="h-3 w-3" />{t('disputes.resolve')}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Vendor invoice disputes */}
      {tab === 'vendor' && (
        <div className="space-y-2">
          {filteredVendor.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">{t('disputes.noVendorDisputes')}</p>
            </div>
          ) : filteredVendor.map((inv, i) => (
            <motion.div key={inv.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-amber-600" />
                    {inv.vendorName} <span className="text-[11px] text-slate-400">· {inv.invoiceNumber}</span>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">{inv.description}</p>
                  <p className="text-xs text-slate-700 mt-1">
                    {t('disputes.amount')}: <b>{fmtINR(inv.amount + inv.gstAmount)}</b> · {t('disputes.due')}: {fmtDate(inv.dueDate)}
                  </p>
                  {inv.notes && (
                    <p className="text-[11px] text-amber-700 mt-1 italic">{inv.notes}</p>
                  )}
                </div>
                {canResolve && (
                  <button onClick={() => handleResolveVendor(inv.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                    <CheckCircle2 className="h-3 w-3" />{t('disputes.resolvePay')}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* AI flags */}
      {tab === 'ai_flags' && (
        <div className="space-y-2">
          {aiDuplicateFlags.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Sparkles className="h-10 w-10 text-[#F58C4E] mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">{t('disputes.noAiFlags')}</p>
            </div>
          ) : aiDuplicateFlags.map(({ bill, alerts }) => (
            <motion.div key={bill.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-surface-sunken p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <p className="text-sm font-bold text-slate-800">{bill.patientName}</p>
                <span className="text-[10px] text-[var(--color-primary-light)]">· {bill.id}</span>
              </div>
              <div className="space-y-1">
                {alerts.map(a => (
                  <p key={a.groupKey} className="text-[11px] text-[var(--color-accent)] flex items-start gap-1.5">
                    <ShieldAlert className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span><b>{a.description}</b> — {a.reason} · {fmtINR(a.totalAmount)}</span>
                  </p>
                ))}
              </div>
              <Link href={`/billing/patient/${bill.patientId}`}
                className="text-[11px] font-bold text-[var(--color-accent)] hover:underline mt-2 inline-flex items-center gap-1">
                {t('disputes.viewBill')} <ChevronRight className="h-3 w-3" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, tint }: { label: string; value: string | number; tint: string }) {
  return (
    <div className={cn('rounded-xl border p-4', tint)}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
    </div>
  )
}
