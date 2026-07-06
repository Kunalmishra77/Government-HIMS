"use client"

import { useMemo, useState } from "react"
import {
  FlaskConical, Sparkles, Clock, CheckCircle, Beaker, CheckCircle2, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { OrdersServiceBanner } from "@/components/patient/OrdersServiceBanner"
import { useLabOrdersStore, type TestRun, type TestStatus } from "@/store/useLabOrdersStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"

type Test = { name: string; turnaround: string; price: number }
const TESTS: Test[] = [
  { name: 'Complete Blood Count (CBC)', turnaround: 'Same day', price: 350 },
  { name: 'Lipid Profile',              turnaround: 'Same day', price: 600 },
  { name: 'HbA1c (3-month sugar)',      turnaround: 'Next day', price: 450 },
  { name: 'Thyroid Profile (T3 T4 TSH)',turnaround: 'Next day', price: 700 },
  { name: 'Vitamin D (25-OH)',          turnaround: '2 days',   price: 1200 },
]

const STATUS_LABEL: Record<TestStatus, string> = {
  awaiting_collection: 'Awaiting sample collection',
  collected:           'Sample received at the lab',
  on_bench:            'Sample at the lab',
  in_progress:         'Being analyzed',
  entered:             'Pending pathologist verification',
  verified:            'Verified, ready soon',
  released:            'Result ready',
  rejected:            'Sample needs to be re-taken',
  recollect_requested: 'Recollect requested',
}
const STATUS_TINT: Record<TestStatus, string> = {
  awaiting_collection: 'bg-slate-100 text-slate-600',
  collected:           'bg-amber-50 text-amber-700',
  on_bench:            'bg-amber-50 text-amber-700',
  in_progress:         'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  entered:             'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  verified:            'bg-emerald-50 text-emerald-700',
  released:            'bg-emerald-50 text-emerald-700',
  rejected:            'bg-red-50 text-red-700',
  recollect_requested: 'bg-red-50 text-red-700',
}

function plainSummary(t: TestRun): string {
  if (t.micro) {
    if (t.micro.finalReport) return t.micro.finalReport
    return 'Microbiology report ready — your doctor will discuss the findings.'
  }
  const abn = t.analytes.filter(a => a.flag !== 'N')
  if (!abn.length) return 'All values are within the normal range. ✅ No action required.'
  const crit = abn.find(a => a.flag === 'CH' || a.flag === 'CL')
  if (crit) {
    return `${crit.analyte} is critically ${crit.flag === 'CH' ? 'high' : 'low'} (${crit.value} ${crit.unit}). Your doctor will discuss next steps urgently.`
  }
  const w = abn[0]
  return `${w.analyte} is slightly ${w.flag === 'H' ? 'high' : 'low'} (${w.value} ${w.unit}${w.refLow !== undefined && w.refHigh !== undefined ? `, reference ${w.refLow}–${w.refHigh}` : ''}). Discuss this with your doctor.`
}

const dateOf = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export default function PathologyPage() {
  const orders = useLabOrdersStore(s => s.orders)
  const currentUser = useAuthStore(s => s.currentUser)
  const isPatient = currentUser?.role === 'patient'
  const id = isPatient ? currentUser.id : ''
  const name = isPatient ? currentUser.name : ''

  if (!isPatient) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Pathology</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your lab tests and results, explained in plain language</p>
        </div>
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-6 text-center">
          <FlaskConical className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-bold text-amber-900">Patient view only</p>
          <p className="text-xs text-amber-700 mt-1">Pathology results are personal to each patient. Switch to your patient portal to see your records.</p>
        </div>
      </div>
    )
  }

  const myOrders = useMemo(
    () => orders.filter(o => o.patientId === id || o.patientName === name),
    [orders, id, name]
  )
  const allTests = useMemo(() => myOrders.flatMap(o => o.tests.map(t => ({ order: o, test: t }))), [myOrders])
  const released = allTests.filter(x => x.test.status === 'released')
  const inProgress = allTests.filter(x => x.test.status !== 'released' && x.test.status !== 'rejected')
  const rejected = allTests.filter(x => x.test.status === 'rejected')

  const [booked, setBooked] = useState<Record<string, boolean>>({})

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Pathology</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your lab tests and results, explained in plain language</p>
      </div>

      <OrdersServiceBanner filter={i => i.kind === 'test' && i.dept === 'Pathology'} paidLabel="Booked — awaiting sample" />

      {/* Results ready (live) */}
      {released.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-slate-900 px-1">Results ready</h3>
          {released.map(({ order, test }) => {
            const summary = plainSummary(test)
            const hasCritical = test.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')
            return (
              <div key={test.id} className={cn(
                "rounded-3xl bg-white p-5 space-y-3",
                hasCritical ? "ring-2 ring-red-200" : "shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)]"
              )}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", hasCritical ? "bg-red-50" : "bg-rose-50")}>
                      <FlaskConical className={cn("h-5 w-5", hasCritical ? "text-red-600" : "text-rose-600")} />
                    </span>
                    <div>
                      <p className="text-[16px] font-bold text-slate-900">{test.name}</p>
                      <p className="text-[12px] text-slate-500">Ordered by {order.doctorName} · {dateOf(test.releasedAt ?? test.orderedAt)}</p>
                    </div>
                  </div>
                  {hasCritical
                    ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1 flex-shrink-0"><AlertTriangle className="h-3 w-3" />Doctor will call you</span>
                    : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">Released</span>}
                </div>

                {/* Analyte rows */}
                {test.analytes.length > 0 && (
                  <div className="rounded-2xl bg-slate-50 p-3 space-y-1.5">
                    {test.analytes.map(a => {
                      const colorClass = a.flag === 'N' ? 'text-emerald-700' : a.flag === 'CH' || a.flag === 'CL' ? 'text-red-700' : 'text-amber-700'
                      const label = a.flag === 'CH' ? 'Critical high' : a.flag === 'CL' ? 'Critical low' : a.flag === 'H' ? 'High' : a.flag === 'L' ? 'Low' : 'Normal'
                      return (
                        <div key={a.analyte} className="flex items-center justify-between text-[13px]">
                          <span className="text-slate-700 flex-1 min-w-0 truncate">{a.analyte}</span>
                          <span className="font-semibold text-slate-800 text-right w-32">{a.value} <span className="text-[11px] text-slate-400">{a.unit}</span></span>
                          <span className="text-[11px] text-slate-400 text-right w-28 hidden sm:block">{a.refLow !== undefined && a.refHigh !== undefined ? `Ref ${a.refLow}–${a.refHigh}` : ''}</span>
                          <span className={cn("text-[10px] font-bold text-right w-24", colorClass)}>{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Plain-language AI summary */}
                <div className={cn("rounded-2xl p-3 flex items-start gap-2.5", hasCritical ? "bg-red-50 border border-red-100" : "bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)]")}>
                  <Sparkles className={cn("h-4 w-4 flex-shrink-0 mt-0.5", hasCritical ? "text-red-600" : "text-[var(--color-accent)]")} />
                  <div className="min-w-0">
                    <p className={cn("text-[11px] font-bold", hasCritical ? "text-red-900" : "text-[var(--color-primary-dark)]")}>What this means · AI explanation (not a diagnosis)</p>
                    <p className={cn("text-[13px] mt-0.5", hasCritical ? "text-red-800" : "text-[var(--color-primary-dark)]")}>{summary}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* In progress (live) */}
      {inProgress.length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">In progress</h3>
          <div className="space-y-2">
            {inProgress.map(({ test }) => (
              <div key={test.id} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="h-9 w-9 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0"><Beaker className="h-4.5 w-4.5 text-amber-600" /></span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-slate-900">{test.name}</p>
                    <p className="text-[12px] text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />ordered {dateOf(test.orderedAt)}</p>
                  </div>
                </div>
                <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", STATUS_TINT[test.status])}>{STATUS_LABEL[test.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected (live) */}
      {rejected.length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Needs re-collection</h3>
          <div className="space-y-2">
            {rejected.map(({ test }) => (
              <div key={test.id} className="rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13.5px] font-bold text-red-800">{test.name} — sample {test.rejectReason ?? 'not usable'}</p>
                  <p className="text-[11.5px] text-red-700 mt-0.5">Please visit the lab again — a fresh sample is required.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No pathology orders yet */}
      {myOrders.length === 0 && (
        <div className="rounded-2xl bg-slate-50 p-6 text-center">
          <FlaskConical className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No lab tests on file yet</p>
          <p className="text-xs text-slate-500 mt-1">Tests your doctor orders will appear here automatically.</p>
        </div>
      )}

      {/* Book a test */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Book a test</h3>
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 space-y-2">
          {TESTS.map(t => {
            const isBooked = booked[t.name]
            return (
              <div key={t.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                <div>
                  <p className="text-[14px] font-semibold text-slate-800">{t.name}</p>
                  <p className="text-[12px] text-slate-500">{t.turnaround} · <span className="font-semibold text-slate-700">₹{t.price}</span></p>
                </div>
                <button
                  onClick={() => { setBooked(b => ({ ...b, [t.name]: true })); toast.success(`${t.name} booked`) }}
                  disabled={isBooked}
                  className={cn(
                    "text-[13px] font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform flex-shrink-0",
                    isBooked ? "bg-green-50 text-green-700 cursor-default" : "bg-[var(--color-primary)] text-white",
                  )}
                >
                  {isBooked ? <><CheckCircle2 className="h-4 w-4" /> Booked</> : 'Book'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-[12.5px] text-slate-500 flex items-center gap-1.5 mt-3 px-1">
          <CheckCircle className="h-4 w-4 text-slate-400" /> Free home sample collection available for orders above ₹500.
        </p>
      </div>
    </div>
  )
}
