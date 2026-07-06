"use client"

/* Refund queue — two-step approver gate per BRD FR-507.
 *
 *   Pending → Approved-by-Billing → Approved-by-Finance-Head (Admin) → Processed
 *
 * No single role can move a refund through end-to-end. The approver1 (Billing
 * Lead) approves; the approver2 (Finance Head / Admin) signs off; only then
 * can the cashier mark it Processed. Each transition emits an audit event. */

import { useMemo, useState } from "react"
import { CheckCircle, Clock, XCircle, Shield, IndianRupee, Send } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/store/useAuthStore"
import { useAuditStore } from "@/store/useAuditStore"
import { useDialogs } from "@/components/ui/ConfirmDialog"

type RefundStatus =
  | 'pending'              // raised, awaiting Billing Lead approval
  | 'approved_lead'        // first signature in
  | 'approved_finance'     // second signature in — ready for payout
  | 'rejected'             // rejected at any step
  | 'processed'            // payment captured / refunded to patient

type Refund = {
  id: string
  billId: string
  patient: string
  amount: number
  reason: string
  requestedAt: string
  requestedBy: string
  status: RefundStatus
  approvedLeadAt?: string
  approvedLeadBy?: string
  approvedFinanceAt?: string
  approvedFinanceBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  processedAt?: string
  processedBy?: string
}

// Stable demo timestamps — frozen so SSR + client see identical strings.
// (Earlier this seed used `new Date(Date.now() - X).toISOString()` which
// drifted by ~1s between Node and the browser, firing hydration warnings.)
const T_NOW       = '2026-06-02T20:44:00.000Z'
const T_2H_AGO    = '2026-06-02T18:44:00.000Z'
const T_5H_AGO    = '2026-06-02T15:44:00.000Z'
const T_1D_AGO    = '2026-06-01T20:44:00.000Z'
const T_2D_AGO    = '2026-05-31T20:44:00.000Z'
void T_NOW
const SEED: Refund[] = [
  { id: 'REF-001', billId: 'BIL-2026-0041', patient: 'Kiran Patil',  amount: 4500, reason: 'Service not rendered — cancelled procedure',  requestedAt: T_2H_AGO,  requestedBy: 'Naveen Patel · Billing', status: 'pending' },
  { id: 'REF-002', billId: 'BIL-2026-0038', patient: 'Priya Sharma', amount: 1200, reason: 'Duplicate charge on lab tests',                requestedAt: T_1D_AGO, requestedBy: 'Naveen Patel · Billing', status: 'approved_lead', approvedLeadAt: T_2H_AGO, approvedLeadBy: 'Suman Pillai (Billing Lead)' },
  { id: 'REF-003', billId: 'BIL-2026-0031', patient: 'Rahul Mehta',  amount:  800, reason: 'Insurance covered — excess payment',           requestedAt: T_2D_AGO, requestedBy: 'Naveen Patel · Billing', status: 'approved_finance', approvedLeadAt: T_1D_AGO, approvedLeadBy: 'Suman Pillai (Billing Lead)', approvedFinanceAt: T_5H_AGO, approvedFinanceBy: 'Rajesh Kulkarni (Finance Head)' },
]

const STATUS_CONFIG: Record<RefundStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:           { label: 'Pending approval',    color: 'bg-amber-100 text-amber-700',  icon: Clock },
  approved_lead:     { label: 'Awaiting Finance',     color: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',    icon: Shield },
  approved_finance:  { label: 'Ready for payout',     color: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]', icon: CheckCircle },
  rejected:          { label: 'Rejected',             color: 'bg-red-100 text-red-700',      icon: XCircle },
  processed:         { label: 'Processed',            color: 'bg-green-100 text-green-700',  icon: CheckCircle },
}

export default function BillingRefunds() {
  const [requests, setRequests] = useState<Refund[]>(SEED)
  const currentUser = useAuthStore(s => s.currentUser)
  const log = useAuditStore(s => s.log)
  const { confirm, prompt, view: dialogView } = useDialogs()

  const role = currentUser?.role
  const actor = currentUser?.name ?? 'Unknown'

  // Two-step gate: Billing Lead first, Finance Head (admin) second.
  const canLeadApprove    = role === 'billing'
  const canFinanceApprove = role === 'admin'
  const canProcess        = role === 'billing'

  const totals = useMemo(() => ({
    pending:    requests.filter(r => r.status === 'pending').length,
    awaitingFh: requests.filter(r => r.status === 'approved_lead').length,
    ready:      requests.filter(r => r.status === 'approved_finance').length,
    processed:  requests.filter(r => r.status === 'processed').length,
  }), [requests])

  function patch(id: string, partial: Partial<Refund>) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, ...partial } : r))
  }

  async function leadApprove(r: Refund) {
    if (!canLeadApprove) { toast.error('Only Billing Lead can give the first approval.'); return }
    const ok = await confirm({
      title: `Approve refund of ₹${r.amount.toLocaleString('en-IN')}?`,
      body: `${r.patient} · ${r.billId}. Forwarded to Finance Head for second approval before payout.`,
      confirmLabel: 'Approve (1/2)',
    })
    if (!ok) return
    patch(r.id, { status: 'approved_lead', approvedLeadAt: new Date().toISOString(), approvedLeadBy: actor })
    log({ userId: currentUser?.id ?? 'BL', userName: actor, action: 'billing_charge',
          resource: 'refund', resourceId: r.id,
          detail: `Refund 1/2 approved (Billing Lead) · ₹${r.amount} for ${r.patient}` })
    toast.success(`Approved (1/2) · forwarded to Finance Head`)
  }

  async function financeApprove(r: Refund) {
    if (!canFinanceApprove) { toast.error('Only Finance Head (Admin) can give the second approval.'); return }
    const ok = await confirm({
      title: `Authorise refund of ₹${r.amount.toLocaleString('en-IN')}?`,
      body: `${r.patient} · ${r.billId}. Two-step gate complete. Once approved the cashier can mark it processed.`,
      tone: 'warn',
      confirmLabel: 'Authorise (2/2)',
    })
    if (!ok) return
    patch(r.id, { status: 'approved_finance', approvedFinanceAt: new Date().toISOString(), approvedFinanceBy: actor })
    log({ userId: currentUser?.id ?? 'FH', userName: actor, action: 'finance_invoice_approved',
          resource: 'refund', resourceId: r.id,
          detail: `Refund 2/2 approved (Finance Head) · ₹${r.amount} for ${r.patient}` })
    toast.success('Authorised — ready for payout')
  }

  async function reject(r: Refund) {
    if (!canLeadApprove && !canFinanceApprove) { toast.error("You can't reject refunds in your role."); return }
    const values = await prompt({
      title: `Reject refund · ${r.patient}`,
      body: 'Captures the reason in the audit trail. Patient + cashier will be notified.',
      tone: 'danger',
      confirmLabel: 'Reject',
      fields: [
        { id: 'reason', label: 'Reason', type: 'textarea',
          placeholder: 'e.g. Out of policy / duplicate of REF-NNN / not refundable', required: true },
      ],
    })
    if (!values) return
    patch(r.id, { status: 'rejected', rejectedAt: new Date().toISOString(), rejectedBy: actor, rejectReason: values.reason })
    log({ userId: currentUser?.id ?? 'X', userName: actor, action: 'finance_dispute_opened',
          resource: 'refund', resourceId: r.id,
          detail: `Refund rejected · ${values.reason}` })
    toast.success('Refund rejected · audit logged')
  }

  async function process(r: Refund) {
    if (!canProcess) { toast.error('Cashier role required to process.'); return }
    const ok = await confirm({
      title: `Mark refund processed?`,
      body: `Records the payout for ${r.patient} · ₹${r.amount.toLocaleString('en-IN')}. Captured as evidence (NABH IMS).`,
      confirmLabel: 'Mark processed',
    })
    if (!ok) return
    patch(r.id, { status: 'processed', processedAt: new Date().toISOString(), processedBy: actor })
    log({ userId: currentUser?.id ?? 'BL', userName: actor, action: 'finance_vendor_paid',
          resource: 'refund', resourceId: r.id,
          detail: `Refund processed · ₹${r.amount} to ${r.patient}` })
    toast.success('Refund processed')
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Refund Requests</h2>
          <p className="text-slate-500 text-sm mt-1">
            Two-step approval · Billing Lead → Finance Head → Cashier processes payout
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-semibold">
          <Pill label="Pending" value={totals.pending} tint="bg-amber-50 text-amber-700" />
          <Pill label="Awaiting Finance" value={totals.awaitingFh} tint="bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" />
          <Pill label="Ready for payout" value={totals.ready} tint="bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" />
          <Pill label="Processed" value={totals.processed} tint="bg-emerald-50 text-emerald-700" />
        </div>
      </div>

      <div className="space-y-3">
        {requests.map((r) => {
          const cfg = STATUS_CONFIG[r.status]
          const Icon = cfg.icon
          return (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900">{r.patient}</p>
                    <span className="text-xs text-slate-400">{r.billId}</span>
                    <span className="inline-flex items-center gap-1 text-[var(--color-accent)] text-xs font-semibold">
                      <IndianRupee className="h-3 w-3" />{r.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{r.reason}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Requested by {r.requestedBy} · {new Date(r.requestedAt).toLocaleString('en-IN')}
                  </p>

                  {/* Trail */}
                  <ol className="mt-3 grid gap-1 text-[11px] text-slate-500">
                    {r.approvedLeadAt ? (
                      <li>✓ Step 1 — Billing Lead: <span className="text-slate-700 font-medium">{r.approvedLeadBy}</span> · {new Date(r.approvedLeadAt).toLocaleString('en-IN')}</li>
                    ) : <li>○ Step 1 — Billing Lead approval</li>}
                    {r.approvedFinanceAt ? (
                      <li>✓ Step 2 — Finance Head: <span className="text-slate-700 font-medium">{r.approvedFinanceBy}</span> · {new Date(r.approvedFinanceAt).toLocaleString('en-IN')}</li>
                    ) : <li>○ Step 2 — Finance Head approval</li>}
                    {r.processedAt ? (
                      <li>✓ Step 3 — Payout: <span className="text-slate-700 font-medium">{r.processedBy}</span> · {new Date(r.processedAt).toLocaleString('en-IN')}</li>
                    ) : <li>○ Step 3 — Cashier processes payout</li>}
                    {r.rejectedAt ? (
                      <li className="text-red-700">✗ Rejected by {r.rejectedBy} · {r.rejectReason}</li>
                    ) : null}
                  </ol>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${cfg.color}`}>
                    <Icon className="h-3.5 w-3.5" /> {cfg.label}
                  </span>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {r.status === 'pending' && canLeadApprove && (
                      <button onClick={() => leadApprove(r)} className="px-3 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)]">Approve 1/2</button>
                    )}
                    {r.status === 'approved_lead' && canFinanceApprove && (
                      <button onClick={() => financeApprove(r)} className="px-3 py-1.5 text-xs font-bold bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)]">Authorise 2/2</button>
                    )}
                    {(r.status === 'pending' || r.status === 'approved_lead') && (canLeadApprove || canFinanceApprove) && (
                      <button onClick={() => reject(r)} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 rounded-lg hover:bg-red-100">Reject</button>
                    )}
                    {r.status === 'approved_finance' && canProcess && (
                      <button onClick={() => process(r)} className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center gap-1">
                        <Send className="h-3 w-3" /> Mark Processed
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-slate-400 px-1">
        Two-step gate prevents single-role refund issue (segregation of duties). Every transition emits to the audit trail (NABH IMS / Finance).
      </p>
      {dialogView}
    </div>
  )
}

function Pill({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${tint}`}>
      <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  )
}
