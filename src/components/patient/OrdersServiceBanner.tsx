"use client"

import Link from "next/link"
import { ClipboardList, CheckCircle2, ArrowRight, Clock } from "lucide-react"
import { usePatientOrdersStore, type OrderItem } from "@/store/usePatientOrdersStore"
import { cn } from "@/lib/utils"

/**
 * Shows the items a doctor just ordered that belong to this service page
 * (meds → Pharmacy, Pathology/Radiology tests → their pages). Reflects the
 * patient's accept/reduce/skip choices and whether they've paid yet.
 */
export function OrdersServiceBanner({
  filter,
  paidLabel,
}: {
  filter: (i: OrderItem) => boolean
  paidLabel: string // e.g. "Sent to pharmacy" / "Booked — sample/scan pending"
}) {
  const { items, doctor, received, paid } = usePatientOrdersStore()
  if (!received) return null

  const kept = items.filter(i => i.status === 'accepted' && filter(i))
  if (kept.length === 0) return null

  return (
    <div className={cn(
      "rounded-3xl p-5 border",
      paid ? "bg-green-50/60 border-green-100" : "bg-[rgba(238,107,38,0.07)]/70 border-[rgba(238,107,38,0.15)]",
    )}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-9 w-9 rounded-2xl flex items-center justify-center flex-shrink-0", paid ? "bg-green-100 text-green-600" : "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]")}>
            <ClipboardList className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-slate-900">From {doctor}&apos;s orders</p>
            <p className="text-[12px] text-slate-500">Prescribed at your consultation today</p>
          </div>
        </div>
        {paid ? (
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1 flex-shrink-0"><CheckCircle2 className="h-3.5 w-3.5" /> Paid</span>
        ) : (
          <Link href="/patient/orders" className="text-[12.5px] font-bold px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-white flex items-center gap-1 flex-shrink-0 active:scale-95 transition">Review & pay <ArrowRight className="h-3.5 w-3.5" /></Link>
        )}
      </div>
      <div className="space-y-1.5">
        {kept.map(i => (
          <div key={i.id} className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
            <span className="text-[13px] font-semibold text-slate-800">{i.name}</span>
            <span className={cn("text-[12px] font-semibold flex items-center gap-1.5", paid ? "text-green-700" : "text-amber-600")}>
              {paid ? <><CheckCircle2 className="h-3.5 w-3.5" /> {paidLabel}</> : <><Clock className="h-3.5 w-3.5" /> Awaiting payment</>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
