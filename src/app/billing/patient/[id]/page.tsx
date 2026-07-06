"use client"
import { useState } from "react"
import { use } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Receipt, CreditCard, CheckCircle2, AlertCircle, Smartphone, Banknote, ShieldCheck, Sparkles, XCircle, Loader2 } from "lucide-react"
import { useBillingStore, type ChargeType } from "@/store/useBillingStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { deriveUhid } from "@/lib/uhid"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { generateIPDCharges, type IPDChargeSuggestion } from "@/ai-services/billing-suggest"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { useAuthStore } from "@/store/useAuthStore"

const TYPE_CONFIG: Record<ChargeType, { label: string; color: string }> = {
  consultation: { label: 'Consultation',  color: 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]' },
  lab:          { label: 'Laboratory',    color: 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]' },
  radiology:    { label: 'Radiology',     color: 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]' },
  pharmacy:     { label: 'Pharmacy',      color: 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]' },
  ward:         { label: 'Ward / Room',   color: 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]' },
  procedure:    { label: 'Procedure',     color: 'text-accent bg-primary-soft' },
  consumable:   { label: 'Consumables',   color: 'text-slate-600 bg-slate-50' },
  nursing:      { label: 'Nursing',       color: 'text-green-600 bg-green-50' },
  ot:           { label: 'OT Charges',    color: 'text-red-600 bg-red-50' },
}

const CHARGE_TYPES: ChargeType[] = ['consultation', 'lab', 'radiology', 'pharmacy', 'ward', 'procedure', 'consumable', 'nursing', 'ot']

export default function PatientBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { getBillForPatient, getItemsForPatient, freezeBill, applyInsuranceCoverage, recordPayment, addCharge } = useBillingStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const actor = currentUser?.name ?? 'Billing Officer'

  const bill = getBillForPatient(id)
  const items = getItemsForPatient(id)

  const [payAmount, setPayAmount] = useState("")
  const [payMode, setPayMode] = useState<'Cash' | 'UPI' | 'Card' | 'Insurance'>('Cash')
  const [showPayment, setShowPayment] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<IPDChargeSuggestion[] | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [rejectedIndexes, setRejectedIndexes] = useState<Set<number>>(new Set())
  const [showAiPanel, setShowAiPanel] = useState(false)

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-slate-400" />
        <p className="text-lg font-bold text-slate-600">No bill found for this patient</p>
      </div>
    )
  }

  const outstanding = bill.patientDue - bill.paidAmount
  const hasOTProcedure = items.some(i => i.type === 'ot' || i.source === 'OT')

  const handleGenerateAISuggestions = async () => {
    setLoadingAI(true)
    setAiSuggestions(null)
    setRejectedIndexes(new Set())
    setShowAiPanel(true)
    const result = await generateIPDCharges(
      bill.visitType,
      bill.admissionDate,
      hasOTProcedure,
      items.map(i => i.description),
    )
    setAiSuggestions(result.data)
    setLoadingAI(false)
  }

  const toggleReject = (idx: number) => {
    setRejectedIndexes(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const handleAcceptSelected = () => {
    if (!aiSuggestions || !bill) return
    let count = 0
    let total = 0
    aiSuggestions.forEach((s, i) => {
      if (rejectedIndexes.has(i)) return
      addCharge({ patientId: id, type: s.type as ChargeType, description: s.description, amount: s.amount, quantity: s.quantity, date: new Date().toISOString(), source: s.source, isNonPayable: s.isNonPayable })
      count++
      total += s.amount * s.quantity
    })
    notifyAndAudit({
      to: 'audit_officer', type: 'system', priority: 'low',
      title: `Charges added · ${bill.patientName}`,
      body: `${count} AI-suggested charge${count !== 1 ? 's' : ''} (₹${total.toLocaleString('en-IN')}) added to bill ${bill.id} by ${actor}.`,
      patientName: bill.patientName,
      audit: { action: 'billing_charge', resource: 'bill', resourceId: bill.id, detail: `${count} AI charges added · ₹${total.toLocaleString('en-IN')}`, userName: actor },
    })
    toast.success(`${count} AI-suggested charge${count !== 1 ? 's' : ''} added to bill`)
    setAiSuggestions(null)
    setShowAiPanel(false)
  }

  const grouped = CHARGE_TYPES.reduce((acc, type) => {
    const typeItems = items.filter(i => i.type === type)
    if (typeItems.length > 0) acc[type] = typeItems
    return acc
  }, {} as Record<ChargeType, typeof items>)

  const handlePayment = () => {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return }
    if (amt > outstanding) { toast.error(`Amount exceeds outstanding balance of ₹${outstanding.toLocaleString('en-IN')}`); return }
    recordPayment(bill.id, amt, payMode)
    notifyAndAuditMany(['patient', 'audit_officer'], {
      type: 'system', priority: 'medium',
      title: `Payment received · ₹${amt.toLocaleString('en-IN')} · ${bill.patientName}`,
      body: `${payMode} payment of ₹${amt.toLocaleString('en-IN')} collected for bill ${bill.id} by ${actor}. Receipt generated.`,
      patientName: bill.patientName,
      audit: { action: 'billing_charge', resource: 'bill', resourceId: bill.id, detail: `Payment ₹${amt.toLocaleString('en-IN')} via ${payMode}`, userName: actor },
    })
    toast.success(`₹${amt.toLocaleString('en-IN')} collected via ${payMode}. Receipt generated.`)
    setPayAmount("")
    setShowPayment(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Bill Header */}
      <div className="bg-white border shadow-sm rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900">{bill.patientName}</h2>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">{deriveUhid(bill.patientId)}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{bill.id} • {bill.visitType} • {bill.payerType}</p>
            {bill.admissionDate && <p className="text-xs text-slate-400 mt-0.5">Admitted: {new Date(bill.admissionDate).toLocaleDateString('en-IN')}</p>}
          </div>
          <div className="text-right">
            <NeonBadge variant={bill.status === 'settled' ? 'success' : bill.status === 'frozen' ? 'blue' : 'warning'} className="text-sm px-3 py-1">
              {bill.status.toUpperCase()}
            </NeonBadge>
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Gross Total", value: bill.subtotal, color: "text-slate-900" },
            { label: "Discounts", value: -bill.discounts, color: "text-green-600" },
            { label: "Non-Payables", value: -bill.nonPayables, color: "text-accent" },
            { label: "Insurance", value: -bill.insuranceCovered, color: "text-[var(--color-accent)]" },
            { label: "Patient Due", value: bill.patientDue, color: "text-red-600 text-xl" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className={cn("font-bold", color)}>
                {value < 0 ? `- ₹${Math.abs(value).toLocaleString('en-IN')}` : `₹${value.toLocaleString('en-IN')}`}
              </p>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {bill.paidAmount > 0 && (
          <div className="mt-3 flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-200">
            <span className="text-sm font-semibold text-green-800">Amount Paid: ₹{bill.paidAmount.toLocaleString('en-IN')}</span>
            <span className={cn("text-sm font-bold", outstanding > 0 ? "text-red-700" : "text-green-700")}>
              {outstanding > 0 ? `Balance Due: ₹${outstanding.toLocaleString('en-IN')}` : "Fully Settled ✓"}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100 flex-wrap">
          {bill.status === 'draft' && bill.visitType === 'IPD' && (
            <button
              onClick={handleGenerateAISuggestions}
              disabled={loadingAI}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 2px 8px rgba(238,107,38,0.25)' }}
            >
              {loadingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Suggest Charges
            </button>
          )}
          {bill.status === 'draft' && (
            <Button variant="secondary" onClick={() => {
              freezeBill(bill.id)
              notifyAndAuditMany(['audit_officer', 'admin'], {
                type: 'system', priority: 'medium',
                title: `Bill frozen · ${bill.patientName}`,
                body: `Bill ${bill.id} frozen by ${actor}. No further edits permitted; ready for settlement.`,
                patientName: bill.patientName,
                audit: { action: 'billing_charge', resource: 'bill', resourceId: bill.id, detail: `Bill frozen for ${bill.patientName}`, userName: actor },
              })
              toast.success("Bill frozen — ready for final settlement")
            }}>
              Freeze Bill
            </Button>
          )}
          {bill.insuranceCovered === 0 && bill.payerType.toLowerCase().includes('cashless') && (
            <Button variant="secondary" onClick={() => {
              const cov = Math.floor(bill.subtotal * 0.8)
              applyInsuranceCoverage(bill.id, cov)
              notifyAndAudit({
                to: 'insurance', type: 'system', priority: 'medium',
                title: `Insurance coverage applied · ${bill.patientName}`,
                body: `₹${cov.toLocaleString('en-IN')} (80% of ₹${bill.subtotal.toLocaleString('en-IN')}) applied to bill ${bill.id} by ${actor}.`,
                patientName: bill.patientName,
                audit: { action: 'insurance_doc_upload', resource: 'bill', resourceId: bill.id, detail: `Insurance coverage ₹${cov.toLocaleString('en-IN')} applied`, userName: actor },
              })
              toast.success("Insurance coverage applied")
            }}>
              <ShieldCheck className="h-4 w-4 mr-1.5" /> Apply Insurance Coverage
            </Button>
          )}
          {outstanding > 0 && (
            <Button onClick={() => setShowPayment(!showPayment)}>
              <CreditCard className="h-4 w-4 mr-1.5" /> Collect Payment
            </Button>
          )}
          {bill.status === 'settled' && bill.receiptNumber && (
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Receipt: {bill.receiptNumber}
            </div>
          )}
        </div>

        {/* Payment panel */}
        {showPayment && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <p className="text-sm font-bold text-slate-700">Collect Payment — Outstanding: ₹{outstanding.toLocaleString('en-IN')}</p>
            <div className="flex gap-2">
              {(['Cash', 'UPI', 'Card', 'Insurance'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPayMode(mode)}
                  className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-all cursor-pointer",
                    payMode === mode ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {mode === 'Cash' && <Banknote className="h-3.5 w-3.5" />}
                  {mode === 'UPI' && <Smartphone className="h-3.5 w-3.5" />}
                  {mode === 'Card' && <CreditCard className="h-3.5 w-3.5" />}
                  {mode === 'Insurance' && <ShieldCheck className="h-3.5 w-3.5" />}
                  {mode}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <input
                type="number"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder={`Amount (max ₹${outstanding.toLocaleString('en-IN')})`}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <Button onClick={handlePayment}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Confirm
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Suggestions Panel */}
      <AnimatePresence>
        {showAiPanel && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-[rgba(238,107,38,0.20)] shadow-sm rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ background: 'linear-gradient(135deg,var(--color-primary-dark)12,var(--color-primary)0A)' }}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
                <span className="font-bold text-slate-900">AI Suggested Charges</span>
                {aiSuggestions && (
                  <span className="text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.12)] px-2 py-0.5 rounded-full">
                    {aiSuggestions.length - rejectedIndexes.size} of {aiSuggestions.length} selected
                  </span>
                )}
              </div>
              <button onClick={() => setShowAiPanel(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {loadingAI && (
              <div className="flex items-center justify-center gap-3 py-10">
                <Loader2 className="h-5 w-5 text-[var(--color-accent)] animate-spin" />
                <span className="text-sm font-semibold text-slate-500">Analysing ward records and generating charges…</span>
              </div>
            )}

            {aiSuggestions && aiSuggestions.length === 0 && (
              <div className="py-10 text-center text-sm font-semibold text-slate-500">
                <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                All standard charges appear to already be recorded.
              </div>
            )}

            {aiSuggestions && aiSuggestions.length > 0 && (
              <>
                <div className="divide-y divide-slate-100">
                  {aiSuggestions.map((s, i) => {
                    const rejected = rejectedIndexes.has(i)
                    const cfg = TYPE_CONFIG[s.type as ChargeType]
                    return (
                      <div
                        key={i}
                        className={cn("flex items-start gap-3 px-5 py-3 transition-colors", rejected ? "bg-slate-50 opacity-50" : "hover:bg-[rgba(238,107,38,0.10)]/30")}
                      >
                        <button
                          onClick={() => toggleReject(i)}
                          className="mt-0.5 flex-shrink-0 cursor-pointer"
                          title={rejected ? "Include this charge" : "Exclude this charge"}
                        >
                          {rejected
                            ? <XCircle className="h-5 w-5 text-slate-300" />
                            : <CheckCircle2 className="h-5 w-5 text-[var(--color-accent)]" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", cfg.color)}>{cfg.label}</span>
                            <p className={cn("text-sm font-semibold", rejected ? "text-slate-400 line-through" : "text-slate-900")}>{s.description}</p>
                          </div>
                          <p className="text-xs text-slate-400">{s.justification}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn("text-sm font-bold", rejected ? "text-slate-300" : "text-slate-900")}>
                            ₹{(s.amount * s.quantity).toLocaleString('en-IN')}
                          </p>
                          {s.quantity > 1 && <p className="text-xs text-slate-400">₹{s.amount} × {s.quantity} days</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-t border-slate-100">
                  <p className="text-sm text-slate-500">
                    Total to add: <span className="font-bold text-slate-900">
                      ₹{aiSuggestions.filter((_, i) => !rejectedIndexes.has(i)).reduce((a, s) => a + s.amount * s.quantity, 0).toLocaleString('en-IN')}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setAiSuggestions(null); setShowAiPanel(false) }}>
                      Dismiss
                    </Button>
                    <button
                      onClick={handleAcceptSelected}
                      disabled={rejectedIndexes.size === aiSuggestions.length}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer disabled:opacity-50 transition-all"
                      style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 2px 8px rgba(238,107,38,0.25)' }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Add Selected to Bill
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Itemized charges */}
      <div className="bg-white border shadow-sm rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">Itemized Charges</h3>
        </div>

        {Object.entries(grouped).map(([type, typeItems]) => {
          const cfg = TYPE_CONFIG[type as ChargeType]
          const subtotal = typeItems.reduce((a, i) => a + i.amount * i.quantity, 0)
          return (
            <div key={type} className="border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50">
                <span className={cn("text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full", cfg.color)}>{cfg.label}</span>
                <span className="text-sm font-bold text-slate-700">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              {typeItems.map(item => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", item.isNonPayable ? "text-slate-400 line-through" : "text-slate-900")}>{item.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(item.date).toLocaleDateString('en-IN')} • {item.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">₹{(item.amount * item.quantity).toLocaleString('en-IN')}</p>
                    {item.quantity > 1 && <p className="text-xs text-slate-400">₹{item.amount} × {item.quantity}</p>}
                    {item.isNonPayable && <p className="text-[10px] text-accent font-semibold">Non-payable</p>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">No charges recorded yet</div>
        )}
      </div>
    </div>
  )
}
