"use client"

/* M8 — Reusable PaymentModal for the patient portal.
 *
 * Drops on any "Pay" CTA. Lets the patient pick a channel (UPI / Card /
 * Net banking / Insurance / Cash), shows the simulated 800 ms processing
 * state, then renders a success card with a transaction id. On success
 * the parent's onSuccess callback runs (typical: store mutation +
 * notifyAndAudit to billing/pharmacy/lab).
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, IndianRupee, CheckCircle2, AlertTriangle, Loader2, Smartphone, CreditCard, Wallet, Building, Banknote, ShieldCheck } from "lucide-react"
import { processPayment, CHANNEL_LABEL, type PaymentChannel, type PaymentPurpose, type PaymentResult } from "@/lib/mockPayment"

const CHANNELS: { key: PaymentChannel; label: string; icon: React.ElementType; sub: string }[] = [
  { key: 'upi',        label: 'UPI',                   icon: Smartphone, sub: 'PhonePe / GPay / Paytm' },
  { key: 'card',       label: 'Debit / Credit card',   icon: CreditCard, sub: 'Visa / Mastercard / RuPay' },
  { key: 'netbanking', label: 'Net banking',           icon: Building,    sub: 'All major banks' },
  { key: 'insurance',  label: 'Insurance · TPA',       icon: ShieldCheck, sub: 'Cashless · pending pre-auth' },
  { key: 'cash',       label: 'Cash at counter',        icon: Banknote,   sub: 'Pay billing desk in cash' },
]

interface Props {
  open: boolean
  amount: number
  purpose: PaymentPurpose
  description?: string
  patientId?: string
  patientName?: string
  invoiceId?: string
  onClose: () => void
  onSuccess: (result: PaymentResult) => void
}

export function PaymentModal({ open, amount, purpose, description, patientId, patientName, invoiceId, onClose, onSuccess }: Props) {
  const [channel, setChannel]   = useState<PaymentChannel>('upi')
  const [busy, setBusy]         = useState(false)
  const [done, setDone]         = useState<PaymentResult | null>(null)

  if (!open) return null

  async function pay() {
    setBusy(true)
    const result = await processPayment({ amount, channel, purpose, patientId, patientName, invoiceId, description })
    setBusy(false)
    setDone(result)
    if (result.status === 'succeeded' || result.status === 'pending') {
      onSuccess(result)
    }
  }

  function reset() {
    setBusy(false); setDone(null)
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
        onClick={onClose} role="dialog" aria-modal="true" aria-label="Pay">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 overflow-hidden"
          onClick={e => e.stopPropagation()}>
          <header className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900">Pay ₹{amount.toLocaleString('en-IN')}</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">{purpose}{description ? ' · ' + description : ''}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </header>

          {!done && !busy ? (
            <>
              <div className="space-y-1.5">
                {CHANNELS.map(({ key, label, icon: Icon, sub }) => (
                  <button key={key} onClick={() => setChannel(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 transition cursor-pointer text-left ${channel === key ? 'ring-primary/25 bg-[rgba(238,107,38,0.07)]/60' : 'ring-slate-200 hover:bg-slate-50'}`}>
                    <span className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${channel === key ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-semibold text-slate-900 truncate">{label}</span>
                      <span className="block text-[11.5px] text-slate-500 truncate">{sub}</span>
                    </span>
                    {channel === key ? <span className="h-3 w-3 rounded-full bg-[var(--color-primary)] flex-shrink-0" /> : null}
                  </button>
                ))}
              </div>
              <button onClick={pay}
                className="w-full mt-5 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[14px] font-bold cursor-pointer">
                <IndianRupee className="h-4 w-4" /> Pay ₹{amount.toLocaleString('en-IN')} via {CHANNEL_LABEL[channel]}
              </button>
              <p className="mt-3 text-[10.5px] text-slate-400 text-center">Secure payment gateway · processing</p>
            </>
          ) : busy ? (
            <div className="py-10 text-center">
              <Loader2 className="h-8 w-8 text-[var(--color-accent)] animate-spin mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-slate-700">Processing payment…</p>
              <p className="text-[11.5px] text-slate-500 mt-1">{CHANNEL_LABEL[channel]} · ₹{amount.toLocaleString('en-IN')}</p>
            </div>
          ) : done?.status === 'succeeded' ? (
            <div className="py-6 text-center">
              <span className="inline-flex h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="text-[15px] font-bold text-slate-900">Payment successful</p>
              <p className="text-[12px] text-slate-500 mt-1">Reference: <span className="font-mono">{done.transactionId}</span></p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                <Wallet className="h-3.5 w-3.5" /> ₹{done.amount.toLocaleString('en-IN')} · {CHANNEL_LABEL[done.channel]}
              </div>
              <button onClick={onClose} className="w-full mt-5 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13.5px] font-bold cursor-pointer">Done</button>
            </div>
          ) : done?.status === 'pending' ? (
            <div className="py-6 text-center">
              <span className="inline-flex h-12 w-12 rounded-full bg-amber-100 text-amber-700 items-center justify-center mb-3">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <p className="text-[15px] font-bold text-slate-900">Pre-auth pending</p>
              <p className="text-[12px] text-slate-500 mt-1">{done.failureReason ?? 'Insurance is reviewing the claim.'}</p>
              <p className="text-[11.5px] text-slate-400 mt-2">Reference: <span className="font-mono">{done.transactionId}</span></p>
              <button onClick={onClose} className="w-full mt-5 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13.5px] font-bold cursor-pointer">Got it</button>
            </div>
          ) : (
            <div className="py-6 text-center">
              <span className="inline-flex h-12 w-12 rounded-full bg-rose-100 text-rose-700 items-center justify-center mb-3">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <p className="text-[15px] font-bold text-slate-900">Payment failed</p>
              <p className="text-[12px] text-slate-500 mt-1">{done?.failureReason ?? 'Try a different channel.'}</p>
              <div className="flex gap-2 mt-5">
                <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-[13.5px] font-semibold cursor-pointer">Close</button>
                <button onClick={reset} className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-[13.5px] font-bold cursor-pointer">Try again</button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
