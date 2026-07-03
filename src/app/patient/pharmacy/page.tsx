"use client"

import { useState } from "react"
import {
  Pill, ShieldCheck, Clock, RefreshCw, AlertTriangle, Truck,
  Package, CheckCircle, MapPin, Receipt, CheckCircle2, BellRing, IndianRupee,
} from "lucide-react"
import { OrdersServiceBanner } from "@/components/patient/OrdersServiceBanner"
import { usePharmacyStore, UNIT_PRICES, type PrepStatus } from "@/store/usePharmacyStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"

const RX_STATUS: Record<PrepStatus, { label: string; tint: string }> = {
  queued: { label: "Queued at pharmacy", tint: "bg-amber-50 text-amber-700" },
  preparing: { label: "Being prepared", tint: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" },
  ready: { label: "Ready for collection", tint: "bg-green-50 text-green-700" },
  collected: { label: "Collected", tint: "bg-slate-100 text-slate-500" },
}

type Med = {
  name: string; purpose: string; dose: string; times: string[]
  daysLeft: number; refillSoon?: boolean
}

const MEDS: Med[] = [
  { name: 'Metformin 500mg', purpose: 'Controls blood sugar', dose: '1-0-1 · with food', times: ['08:00', '20:00'], daysLeft: 4, refillSoon: true },
  { name: 'Cetirizine 10mg', purpose: 'For allergy symptoms', dose: '0-0-1 · at night', times: ['21:00'], daysLeft: 12 },
  { name: 'Amlodipine 5mg', purpose: 'Blood pressure control', dose: '1-0-0 · before breakfast', times: ['08:00'], daysLeft: 6, refillSoon: true },
]

const DELIVERY_STAGES = [
  { label: 'Packed', Icon: Package },
  { label: 'Dispatched', Icon: Truck },
  { label: 'Out for delivery', Icon: MapPin },
  { label: 'Delivered', Icon: CheckCircle },
]
const DELIVERY_CURRENT = 2 // Out for delivery

const BILL_ITEMS = [
  { desc: 'Metformin 500mg × 30', amount: 95 },
  { desc: 'Amlodipine 5mg × 30', amount: 180 },
]

export default function PharmacyPage() {
  const [ordered, setOrdered] = useState<Record<string, boolean>>({})
  const billTotal = BILL_ITEMS.reduce((s, it) => s + it.amount, 0)
  const currentUser = useAuthStore(s => s.currentUser)
  const id = currentUser?.role === "patient" ? currentUser.id : "PT-20394"
  const name = currentUser?.name ?? "Kiran Patil"
  const myRx = usePharmacyStore(s => s.prescriptions).filter(p => p.patientId === id || p.patientName === name)
  const readyRx = myRx.filter(p => p.status === "ready")

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Pharmacy</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your medicines, refills, home delivery &amp; bills</p>
      </div>

      <OrdersServiceBanner filter={i => i.kind === 'medicine'} paidLabel="Sent to pharmacy" />

      {/* Live pharmacy orders — driven by the hospital pharmacy queue */}
      {myRx.length > 0 && (
        <div className="space-y-3">
          {readyRx.length > 0 && (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
              <span className="h-10 w-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0"><BellRing className="h-5 w-5 text-green-600" /></span>
              <div>
                <p className="text-[14px] font-bold text-green-900">{readyRx.length} prescription{readyRx.length > 1 ? "s" : ""} ready for collection</p>
                <p className="text-[12.5px] text-green-700">Please collect from the hospital pharmacy counter.</p>
              </div>
            </div>
          )}
          <h3 className="text-[15px] font-bold text-slate-900 px-1">Your pharmacy orders</h3>
          {myRx.map(rx => {
            const total = rx.adjustedBillTotal ?? rx.medicines.reduce((s, m) => s + m.quantity * (UNIT_PRICES[m.name] ?? 0), 0)
            const st = RX_STATUS[rx.status]
            return (
              <div key={rx.id} className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{rx.doctorName} · {rx.department}</p>
                    <p className="text-[12.5px] text-slate-500">{rx.medicines.length} item(s){rx.tokenNumber > 0 ? ` · token ${rx.tokenNumber}` : ""}</p>
                  </div>
                  <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", st.tint)}>{st.label}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {rx.medicines.map((m, i) => {
                    const unavailable = m.inStock === false
                    const substituted = !!m.substitutedFrom
                    return (
                      <span key={i} className={cn("text-[12px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1", unavailable ? "bg-red-50 text-red-600" : substituted ? "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" : "text-slate-600 bg-slate-100")}>
                        {m.name} ×{m.quantity}
                        {m.supply === "advised_outside" && <span className="text-[10px] font-bold text-amber-700">· buy from outside</span>}
                        {m.supply === "order_raised" && <span className="text-[10px] font-bold text-[var(--color-accent)]">· being arranged</span>}
                        {unavailable && (m.supply ?? "pharmacy") === "pharmacy" && <span className="text-[10px] font-bold text-red-600">· not in stock</span>}
                        {substituted && <span className="text-[10px] font-bold text-[var(--color-accent)]">· substituted (was {m.substitutedFrom})</span>}
                      </span>
                    )
                  })}
                </div>
                {rx.medicines.some(m => m.inStock === false) && (
                  <p className="mt-2 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Some medicines aren’t stocked at the hospital pharmacy — your doctor may advise buying them outside.
                  </p>
                )}
                {total > 0 && <p className="mt-3 text-[12.5px] text-slate-500 flex items-center gap-1">Estimated <IndianRupee className="h-3 w-3" />{total}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* AI interaction check banner */}
      <div className="rounded-2xl bg-green-50 border border-green-100 p-4 flex items-center gap-3">
        <span className="h-10 w-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0"><ShieldCheck className="h-5 w-5 text-green-600" /></span>
        <div>
          <p className="text-[14px] font-bold text-green-900">No harmful interactions detected</p>
          <p className="text-[12.5px] text-green-700">AI checked your medicines against each other and your allergy profile.</p>
        </div>
      </div>

      {/* Current medicines */}
      <div className="space-y-3">
        <h3 className="text-[15px] font-bold text-slate-900 px-1">Current medicines</h3>
        {MEDS.map(m => {
          const isOrdered = ordered[m.name]
          return (
            <div key={m.name} className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0"><Pill className="h-5 w-5 text-[var(--color-accent)]" /></span>
                  <div>
                    <p className="text-[16px] font-bold text-slate-900">{m.name}</p>
                    <p className="text-[13px] text-slate-500">{m.purpose}</p>
                    <p className="text-[13px] text-slate-700 mt-1">{m.dose}</p>
                  </div>
                </div>
                {m.refillSoon
                  ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 flex items-center gap-1 flex-shrink-0"><AlertTriangle className="h-3 w-3" /> Refill soon</span>
                  : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 flex-shrink-0">{m.daysLeft} days left</span>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-slate-400 flex items-center gap-1 mr-1"><Clock className="h-3.5 w-3.5" /> Reminders</span>
                {m.times.map(t => <span key={t} className="text-[12.5px] font-semibold px-2.5 py-1 rounded-lg bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]">{t}</span>)}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[12.5px] text-slate-500 flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", m.refillSoon ? "bg-amber-500" : "bg-green-500")} />
                  {m.refillSoon ? `AI predicts you'll run out in ${m.daysLeft} days` : `${m.daysLeft} days of supply left`}
                </p>
                <button
                  onClick={() => setOrdered(o => ({ ...o, [m.name]: true }))}
                  disabled={isOrdered}
                  className={cn(
                    "text-[13px] font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform",
                    isOrdered ? "bg-green-50 text-green-700 cursor-default" : "bg-[var(--color-primary)] text-white",
                  )}
                >
                  {isOrdered ? <><CheckCircle2 className="h-4 w-4" /> Reordered</> : <><RefreshCw className="h-4 w-4" /> Reorder</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Home delivery */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
            <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0"><Truck className="h-5 w-5 text-[var(--color-accent)]" /></span>
            Home delivery
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]">ETA today, 6:30 PM</span>
        </div>
        <p className="text-[12.5px] text-slate-500 ml-12 -mt-1">Order #RX-2026-4471 · 3 items</p>

        {/* Stepper */}
        <div className="mt-5 flex items-center">
          {DELIVERY_STAGES.map((s, i) => (
            <div key={s.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", i <= DELIVERY_CURRENT ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-400")}>
                  {i < DELIVERY_CURRENT ? <CheckCircle className="h-4.5 w-4.5" /> : <s.Icon className="h-4 w-4" />}
                </div>
                <span className={cn("text-[11px] font-semibold text-center", i <= DELIVERY_CURRENT ? "text-[var(--color-accent)]" : "text-slate-400")}>{s.label}</span>
              </div>
              {i < DELIVERY_STAGES.length - 1 && <div className={cn("flex-1 h-0.5 mx-1 -mt-4 rounded", i < DELIVERY_CURRENT ? "bg-[var(--color-primary)]" : "bg-slate-200")} />}
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-3 flex items-start gap-2.5">
          <MapPin className="h-4.5 w-4.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-slate-800">Delivering to home</p>
            <p className="text-[12.5px] text-slate-500">12, Shanti Nagar, Pune, Maharashtra 411014</p>
          </div>
        </div>
      </div>

      {/* Pharmacy bills */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 mb-3">
          <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0"><Receipt className="h-5 w-5 text-[var(--color-accent)]" /></span>
          Pharmacy bills
        </h3>
        <div className="rounded-2xl bg-slate-50 p-4 space-y-2">
          {BILL_ITEMS.map(it => (
            <div key={it.desc} className="flex items-center justify-between text-[13.5px]">
              <span className="text-slate-500">{it.desc}</span>
              <span className="font-semibold text-slate-800">₹{it.amount}</span>
            </div>
          ))}
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between font-bold text-[14px]">
            <span className="text-slate-900">Total</span>
            <span className="text-[var(--color-accent)]">₹{billTotal}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
