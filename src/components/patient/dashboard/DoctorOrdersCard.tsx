"use client"

import Link from "next/link"
import { ClipboardList, ArrowRight, CheckCircle2, FlaskConical, Pill } from "lucide-react"
import { usePatientOrdersStore, acceptedItems, orderTotal } from "@/store/usePatientOrdersStore"

// Surfaces the doctor's orders on the dashboard the moment they arrive
// (after the consultation). Action-needed until the patient reviews & pays.
export function DoctorOrdersCard() {
  const { items, doctor, received, paid } = usePatientOrdersStore()
  if (!received) return null

  const tests = items.filter(i => i.kind === 'test').length
  const meds = items.filter(i => i.kind === 'medicine').length

  if (paid) {
    const kept = acceptedItems(items).length
    return (
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-4 flex items-center gap-3">
        <span className="h-10 w-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="h-5 w-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900">Doctor&apos;s orders paid · {kept} item{kept !== 1 ? 's' : ''}</p>
          <p className="text-[12.5px] text-slate-500">Tests booked & medicines sent to pharmacy.</p>
        </div>
        <Link href="/patient/orders" className="text-[13px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1 flex-shrink-0">View <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
    )
  }

  const total = orderTotal(items)
  return (
    <div className="rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-5 shadow-[0_10px_30px_rgba(238,107,38,0.25)] relative overflow-hidden">
      <span className="absolute top-4 right-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 animate-pulse">New</span>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0"><ClipboardList className="h-5 w-5" /></span>
        <div>
          <p className="text-[16px] font-bold leading-tight">Doctor&apos;s orders — action needed</p>
          <p className="text-[12.5px] text-white/80">{doctor} sent your prescription just now</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-4 text-[13px] text-white/90">
        <span className="flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> {tests} test{tests !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1.5"><Pill className="h-4 w-4" /> {meds} medicine{meds !== 1 ? 's' : ''}</span>
        <span className="ml-auto text-[15px] font-bold">est. ₹{total}</span>
      </div>
      <Link href="/patient/orders" className="w-full bg-white text-[var(--color-accent)] font-bold text-[14px] rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition">
        Review, edit & pay <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
