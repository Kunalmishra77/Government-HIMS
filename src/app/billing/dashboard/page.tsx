"use client"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { Receipt, AlertCircle, ShieldAlert, Sparkles, Lock } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { useBillingStore } from "@/store/useBillingStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { toast } from "sonner"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"

const DAILY_REVENUE = [
  { day: 'Mon', collected: 82000, outstanding: 34000 },
  { day: 'Tue', collected: 91000, outstanding: 28000 },
  { day: 'Wed', collected: 78000, outstanding: 42000 },
  { day: 'Thu', collected: 115000, outstanding: 19000 },
  { day: 'Fri', collected: 98000, outstanding: 31000 },
  { day: 'Sat', collected: 64000, outstanding: 22000 },
  { day: 'Sun', collected: 43000, outstanding: 15000 },
]

const STATUS_STYLE: Record<string, { bg: string; border: string; badge: "success" | "warning" | "blue" | "muted" | "danger" }> = {
  draft:    { bg: "bg-yellow-50", border: "border-yellow-200", badge: "warning" },
  frozen:   { bg: "bg-[rgba(238,107,38,0.07)]",   border: "border-[rgba(238,107,38,0.20)]",   badge: "blue" },
  settled:  { bg: "bg-green-50",  border: "border-green-200",  badge: "success" },
  dispute:  { bg: "bg-red-50",    border: "border-red-200",    badge: "danger" },
}

export default function BillingDashboard() {
  const currentUser = useAuthStore(s => s.currentUser)
  const bills = useBillingStore(s => s.bills)
  const freezeBill = useBillingStore(s => s.freezeBill)
  const detectDuplicates = useBillingStore(s => s.detectDuplicates)

  const totalOutstanding = bills.filter(b => b.status !== 'settled').reduce((a, b) => a + (b.patientDue - b.paidAmount), 0)
  const totalCollected = bills.reduce((a, b) => a + b.paidAmount, 0)
  const pendingFreeze = bills.filter(b => b.status === 'draft').length
  const settled = bills.filter(b => b.status === 'settled').length

  // Cross-bill AI duplicate-charge sweep
  const duplicates = useMemo(() => {
    const out: { bill: typeof bills[number]; alerts: ReturnType<typeof detectDuplicates> }[] = []
    for (const b of bills) {
      const a = detectDuplicates(b.patientId)
      if (a.length > 0) out.push({ bill: b, alerts: a })
    }
    return out
  }, [bills, detectDuplicates])

  const totalDuplicateValue = duplicates.reduce((s, d) => s + d.alerts.reduce((s2, a) => s2 + a.totalAmount, 0), 0)

  const onFreeze = (billId: string, name: string) => {
    const actor = currentUser?.name ?? 'Billing Officer'
    freezeBill(billId, actor)
    notifyAndAuditMany(['audit_officer', 'admin'], {
      type: 'system', priority: 'medium',
      title: `Bill frozen · ${name}`,
      body: `Bill ${billId} for ${name} frozen by ${actor}. No further edits permitted; ready for settlement.`,
      patientName: name,
      audit: { action: 'billing_charge', resource: 'bill', resourceId: billId, detail: `Bill frozen for ${name}`, userName: actor },
    })
    toast.success(`Bill frozen for ${name} · audit logged`)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Outstanding Balance", value: `₹${totalOutstanding.toLocaleString('en-IN')}`, color: "text-red-600", bg: "bg-red-50 border-red-200" },
          { label: "Collected", value: `₹${totalCollected.toLocaleString('en-IN')}`, color: "text-green-600", bg: "bg-green-50 border-green-200" },
          { label: "Bills Pending Freeze", value: pendingFreeze, color: "text-accent", bg: "bg-primary-soft border-primary/20" },
          { label: "Bills Settled", value: settled, color: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]" },
          { label: "AI Duplicate Flags", value: duplicates.reduce((s, d) => s + d.alerts.length, 0), color: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-xl border p-4", bg)}>
            <p className={cn("text-xl font-bold", color)}>{value}</p>
            <p className="text-xs font-semibold text-slate-600 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* AI duplicate-charge audit card */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-[rgba(238,107,38,0.20)] p-4 bg-surface-sunken">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-sm font-bold text-[var(--color-primary-dark)]">AI Duplicate-Charge Audit</h3>
              <span className="text-[10px] font-bold uppercase tracking-wide bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] px-2 py-0.5 rounded">
                ₹{totalDuplicateValue.toLocaleString('en-IN')} flagged
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-accent)]">Recurring items (ward/nursing/consultation) excluded</p>
          </div>
          <div className="space-y-2">
            {duplicates.map(({ bill, alerts }) => (
              <div key={bill.id} className="rounded-lg bg-white border border-[rgba(238,107,38,0.15)] p-3">
                <p className="text-xs font-bold text-slate-800">{bill.patientName} <span className="text-slate-400">· {bill.id}</span></p>
                {alerts.map((a) => (
                  <p key={a.groupKey} className="text-[11px] text-[var(--color-accent)] mt-1 flex items-start gap-1">
                    <ShieldAlert className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span><b>{a.description}</b> — {a.reason} · ₹{a.totalAmount.toLocaleString('en-IN')}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recharts Revenue Chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-bold text-slate-900 mb-4">Daily Revenue — This Week</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={DAILY_REVENUE} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748B' }} />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: '#64748B' }} />
            <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Bar dataKey="collected" name="Collected" fill="#10B981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outstanding" name="Outstanding" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bills list */}
      <div className="bg-white border shadow-sm rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">All Bills</h2>
          {pendingFreeze > 0 && (
            <div className="flex items-center gap-2 text-sm text-accent font-semibold">
              <AlertCircle className="h-4 w-4" />
              {pendingFreeze} bill(s) pending freeze
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {bills.map((bill, i) => {
            const style = STATUS_STYLE[bill.status]
            const outstanding = bill.patientDue - bill.paidAmount
            const hasDupes = duplicates.some(d => d.bill.id === bill.id)
            return (
              <motion.div
                key={bill.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn("p-4 hover:bg-slate-50 transition-colors")}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0", style.bg, style.border, "border")}>
                    <Receipt className="h-5 w-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <p className="font-bold text-slate-900">{bill.patientName}</p>
                      <NeonBadge variant={style.badge} className="text-[10px]">{bill.status}</NeonBadge>
                      <span className="text-xs text-slate-500">{bill.visitType}</span>
                      <span className="text-xs text-slate-500">{bill.payerType}</span>
                      {hasDupes && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center gap-1">
                          <ShieldAlert className="h-2.5 w-2.5" />Dupes
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-sm flex-wrap">
                      <span className="text-slate-500">Total: <span className="font-bold text-slate-900">₹{bill.subtotal.toLocaleString('en-IN')}</span></span>
                      {bill.insuranceCovered > 0 && <span className="text-[var(--color-accent)] font-medium">Insurance: ₹{bill.insuranceCovered.toLocaleString('en-IN')}</span>}
                      <span className="text-slate-500">Paid: <span className="font-bold text-green-700">₹{bill.paidAmount.toLocaleString('en-IN')}</span></span>
                      {outstanding > 0 && <span className="text-red-600 font-bold">Due: ₹{outstanding.toLocaleString('en-IN')}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {bill.status === 'draft' && (
                      <button
                        onClick={() => onFreeze(bill.id, bill.patientName)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] text-[var(--color-accent)] text-xs font-bold cursor-pointer"
                      >
                        <Lock className="h-3.5 w-3.5" />Freeze
                      </button>
                    )}
                    <Link href={`/billing/patient/${bill.patientId}`}>
                      <button className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer">
                        View Bill
                      </button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
