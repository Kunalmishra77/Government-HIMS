"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ClipboardList, FlaskConical, ScanLine, Pill, Sparkles, Minus, Plus,
  Check, X, ShieldCheck, CreditCard, CheckCircle2, Download, Undo2, Bell, ArrowRight,
} from "lucide-react"
import {
  usePatientOrdersStore, acceptedItems, skippedItems, orderTotal, lineTotal, wasReduced,
  SKIP_REASONS, SKIP_REASON_LABEL, type OrderItem,
} from "@/store/usePatientOrdersStore"
import { cn } from "@/lib/utils"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { PaymentModal } from "@/components/patient/PaymentModal"

function relativeFrom(ts: number | null) {
  if (!ts) return 'just now'
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} min ago`
  return 'earlier today'
}

function TestIcon({ item }: { item: OrderItem }) {
  const Icon = item.dept === 'Radiology' ? ScanLine : FlaskConical
  const tint = item.dept === 'Radiology' ? 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' : 'bg-rose-50 text-rose-600'
  return <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", tint)}><Icon className="h-5 w-5" /></span>
}

export default function DoctorOrdersPage() {
  const { items, doctor, received, receivedAt, paid, paidAt, receiveOrders, accept, setQty, skip, payNow } = usePatientOrdersStore()
  const [reasonFor, setReasonFor] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  // A patient reaching this page is post-consult — make sure the orders are present.
  useEffect(() => { receiveOrders() }, [receiveOrders])

  const tests = items.filter(i => i.kind === 'test')
  const meds = items.filter(i => i.kind === 'medicine')
  const total = orderTotal(items)
  const keptCount = acceptedItems(items).length
  const skipped = skippedItems(items)

  const openPay = () => {
    if (total <= 0) { toast.error('Nothing selected to pay for'); return }
    setPayOpen(true)
  }

  const handlePay = () => {
    payNow()
    const testCount   = acceptedItems(items).filter(i => i.kind === 'test').length
    const medCount    = acceptedItems(items).filter(i => i.kind === 'medicine').length
    // Lab + Pharmacy each get a queue-trigger notification.
    if (testCount > 0) {
      notifyAndAudit({
        to: 'lab', type: 'system', priority: 'medium',
        title: `New test order paid · Kiran Patil`,
        body: `${testCount} test${testCount === 1 ? '' : 's'} paid by patient. Specimen collection ready.`,
        patientName: 'Kiran Patil',
        audit: { action: 'lab_order', resource: 'patient_order', detail: `Patient paid for ${testCount} tests · prepared for sample collection`, userName: 'Patient' },
      })
    }
    if (medCount > 0) {
      notifyAndAudit({
        to: 'pharmacy', type: 'system', priority: 'medium',
        title: `New Rx paid · Kiran Patil`,
        body: `${medCount} medicine${medCount === 1 ? '' : 's'} paid by patient. Begin dispense workflow.`,
        patientName: 'Kiran Patil',
        audit: { action: 'prescription_create', resource: 'patient_order', detail: `Patient paid for ${medCount} medicines · pharmacy queue triggered`, userName: 'Patient' },
      })
    }
    toast.success(`Paid ₹${total} for ${keptCount} item${keptCount !== 1 ? 's' : ''}`, {
      description: 'Tests booked and medicines sent to the pharmacy.',
    })
  }

  const handleSkip = (item: OrderItem, reason: typeof SKIP_REASONS[number]['id']) => {
    skip(item.id, reason)
    setReasonFor(null)
    if (item.important) {
      notifyAndAudit({
        to: 'doctor', type: 'system', priority: 'high',
        title: `Patient skipped important item · ${item.name}`,
        body: `Patient (Kiran Patil) skipped ${item.name} (important). Reason: ${SKIP_REASONS.find(r => r.id === reason)?.label ?? reason}.`,
        patientName: 'Kiran Patil',
        audit: { action: 'hitl_reject', resource: 'patient_order', resourceId: item.id, detail: `Patient skipped ${item.name} — reason: ${reason}`, userName: 'Patient' },
      })
      toast.message(`${doctor} will be notified`, { description: `You skipped ${item.name} — flagged for doctor review.` })
    }
  }

  const ItemRow = ({ item }: { item: OrderItem }) => {
    const isSkipped = item.status === 'skipped'
    const choosing = reasonFor === item.id
    const days = item.perDay ? Math.round(item.qty / item.perDay) : null
    return (
      <div className={cn("rounded-2xl border p-4 transition-colors", isSkipped ? "border-slate-100 bg-slate-50/60" : "border-slate-100 bg-white")}>
        <div className="flex items-start gap-3">
          {item.kind === 'test'
            ? <TestIcon item={item} />
            : <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><Pill className="h-5 w-5" /></span>}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={cn("text-[14.5px] font-bold truncate", isSkipped ? "text-slate-400 line-through" : "text-slate-900")}>{item.name}</p>
                <p className="text-[12.5px] text-slate-500">{item.detail}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={cn("text-[15px] font-bold", isSkipped ? "text-slate-300" : "text-slate-900")}>₹{lineTotal(item)}</p>
                {wasReduced(item) && !isSkipped && <p className="text-[11px] text-slate-400 line-through">₹{item.unitPrice * item.defaultQty}</p>}
              </div>
            </div>

            {/* Why the doctor ordered it */}
            <p className="mt-1.5 text-[12.5px] text-[var(--color-accent)] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" /> {item.clinicalNote}
            </p>

            {/* Read-only once paid */}
            {paid && (
              <div className="mt-3">
                {isSkipped
                  ? <span className="text-[12px] font-semibold text-slate-400">Skipped{item.skipReason ? ` · ${SKIP_REASON_LABEL[item.skipReason]}` : ''}</span>
                  : <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-green-700"><Check className="h-4 w-4" /> Kept{item.kind === 'medicine' && days ? ` · ${item.qty} tablets · ${days} days` : ''}</span>}
              </div>
            )}

            {/* Controls */}
            {!paid && !isSkipped && !choosing && (
              <div className="mt-3 flex items-center justify-between gap-3">
                {item.kind === 'medicine' && item.perDay ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
                      <button aria-label="Reduce" onClick={() => setQty(item.id, item.qty - item.perDay!)} disabled={item.qty <= item.perDay}
                        className="h-8 w-8 flex items-center justify-center text-slate-600 disabled:text-slate-300 hover:bg-slate-50 active:scale-95 transition">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-2 text-[13px] font-bold text-slate-800 tabular-nums min-w-[58px] text-center">{item.qty} tab</span>
                      <button aria-label="Increase" onClick={() => setQty(item.id, item.qty + item.perDay!)} disabled={item.qty >= item.defaultQty}
                        className="h-8 w-8 flex items-center justify-center text-slate-600 disabled:text-slate-300 hover:bg-slate-50 active:scale-95 transition">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-[12px] text-slate-400">{days} day{days !== 1 ? 's' : ''}</span>
                  </div>
                ) : <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-green-700"><Check className="h-4 w-4" /> Keeping</span>}

                <button onClick={() => setReasonFor(item.id)} className="text-[12.5px] font-semibold text-slate-500 hover:text-red-600 inline-flex items-center gap-1 transition-colors">
                  <X className="h-3.5 w-3.5" /> Skip
                </button>
              </div>
            )}

            {/* Skip reason chooser */}
            {!paid && choosing && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-[12px] font-semibold text-slate-500 mb-2">Why are you skipping this?</p>
                <div className="flex flex-wrap gap-1.5">
                  {SKIP_REASONS.map(r => (
                    <button key={r.id} onClick={() => handleSkip(item, r.id)}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-600 active:scale-95 transition">
                      {r.label}
                    </button>
                  ))}
                  <button onClick={() => setReasonFor(null)} className="text-[12px] font-semibold px-3 py-1.5 rounded-full text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
                {item.important && (
                  <p className="mt-2 text-[11.5px] text-amber-700 flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Your doctor recommended this — they&apos;ll be notified if you skip it.</p>
                )}
              </div>
            )}

            {/* Skipped state */}
            {!paid && isSkipped && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[12px] font-semibold text-slate-500">Skipped · {item.skipReason ? SKIP_REASON_LABEL[item.skipReason] : 'no reason'}</span>
                <button onClick={() => accept(item.id)} className="text-[12.5px] font-semibold text-[var(--color-accent)] inline-flex items-center gap-1 hover:text-[var(--color-accent)]">
                  <Undo2 className="h-3.5 w-3.5" /> Add back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Doctor&apos;s orders</h1>
          <p className="text-[13px] text-slate-500 mt-1">From {doctor} · after your consultation today</p>
        </div>
        <span className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full bg-green-50 text-green-700 flex-shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Received {relativeFrom(receivedAt)}
        </span>
      </div>

      {/* Paid banner */}
      {paid ? (
        <div className="rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 text-white p-5 shadow-[0_10px_30px_rgba(16,185,129,0.3)]">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="h-6 w-6" /></span>
            <div className="flex-1">
              <p className="text-[16px] font-bold">Paid ₹{total} · {keptCount} item{keptCount !== 1 ? 's' : ''}</p>
              <p className="text-[13px] text-white/80">Tests booked & medicines sent to the pharmacy. Track them under Pathology, Radiology and Pharmacy.</p>
            </div>
          </div>
          <button onClick={() => toast.success('Receipt downloaded')} className="mt-4 w-full bg-white text-green-700 font-bold text-[14px] rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <Download className="h-4.5 w-4.5" /> Download receipt
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-[var(--color-primary-dark)] leading-relaxed">
            <b>You decide what to keep.</b> Accept what you need, reduce the quantity of anything you already have at home, or skip an item with a reason. You only pay for what you keep.
          </p>
        </div>
      )}

      {/* Tests */}
      <div>
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2 flex items-center gap-2">
          <FlaskConical className="h-4 w-4" /> Tests & investigations
          <span className="text-slate-300 font-semibold normal-case tracking-normal">· {tests.length}</span>
        </h3>
        <div className="space-y-2">{tests.map(t => <ItemRow key={t.id} item={t} />)}</div>
      </div>

      {/* Medicines */}
      <div>
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2 flex items-center gap-2">
          <Pill className="h-4 w-4" /> Medicines
          <span className="text-slate-300 font-semibold normal-case tracking-normal">· {meds.length}</span>
        </h3>
        <div className="space-y-2">{meds.map(m => <ItemRow key={m.id} item={m} />)}</div>
      </div>

      {/* Skipped summary */}
      {skipped.length > 0 && (
        <p className="text-[12.5px] text-slate-500 px-1">
          {skipped.length} item{skipped.length !== 1 ? 's' : ''} skipped · these won&apos;t be charged{skipped.some(i => i.important) ? ' · your doctor has been notified of the clinically-important ones' : ''}.
        </p>
      )}

      {/* Sticky pay bar */}
      {!paid && (
        <div className="sticky bottom-3 z-10">
          <div className="rounded-2xl bg-slate-900 text-white p-3.5 pl-5 flex items-center justify-between gap-3 shadow-[0_12px_32px_rgba(15,23,42,0.35)]">
            <div>
              <p className="text-[12px] text-slate-300">{keptCount} item{keptCount !== 1 ? 's' : ''} to pay{skipped.length ? ` · ${skipped.length} skipped` : ''}</p>
              <p className="text-[22px] font-bold leading-tight tabular-nums">₹{total}</p>
            </div>
            <button onClick={openPay} disabled={total <= 0}
              className="bg-[var(--color-primary)] disabled:bg-white/10 disabled:text-slate-400 text-white font-bold text-[14.5px] rounded-xl px-5 py-3 flex items-center gap-2 active:scale-[0.97] transition shadow-[0_8px_20px_rgba(238,107,38,0.25)]">
              <CreditCard className="h-4.5 w-4.5" /> Pay ₹{total} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <PaymentModal
        open={payOpen}
        amount={total}
        purpose="OPD investigation"
        description={`${keptCount} item${keptCount === 1 ? '' : 's'} from ${doctor}`}
        patientName="Kiran Patil"
        onClose={() => setPayOpen(false)}
        onSuccess={() => { handlePay(); setTimeout(() => setPayOpen(false), 1500) }}
      />
    </div>
  )
}
