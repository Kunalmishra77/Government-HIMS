"use client"

import { Pill, ShieldCheck, Clock, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

function requestReorder(name: string, daysLeft: number) {
  notifyAndAudit({
    to: 'pharmacy', type: 'medicines_ready', priority: 'medium',
    title: `Refill request · ${name}`,
    body: `Patient (Kiran Patil) requested a refill for ${name}. ~${daysLeft} days remaining. Prep for collection.`,
    patientName: 'Kiran Patil',
    audit: { action: 'prescription_create', resource: 'patient_refill', detail: `Patient requested refill for ${name}`, userName: 'Kiran Patil' },
  })
  toast.success(`Refill requested for ${name} · pharmacy notified`)
}

type Med = {
  name: string; purpose: string; dose: string; times: string[]; withFood?: boolean
  daysLeft: number; refillSoon?: boolean
}

const MEDS: Med[] = [
  { name: 'Metformin 500mg', purpose: 'Controls blood sugar', dose: '1 tablet, twice daily', times: ['08:00', '20:00'], withFood: true, daysLeft: 4, refillSoon: true },
  { name: 'Cetirizine 10mg', purpose: 'For your current symptoms', dose: '1 tablet at night', times: ['21:00'], daysLeft: 3 },
]

export default function MedicationsPage() {
  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Medications</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your current medicines, reminders & refills</p>
      </div>

      {/* AI interaction check banner */}
      <div className="rounded-2xl bg-green-50 border border-green-100 p-4 flex items-center gap-3">
        <span className="h-10 w-10 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0"><ShieldCheck className="h-5 w-5 text-green-600" /></span>
        <div>
          <p className="text-[14px] font-bold text-green-900">No harmful interactions detected</p>
          <p className="text-[12.5px] text-green-700">AI checked your 2 medicines against each other and your allergy profile.</p>
        </div>
      </div>

      <div className="space-y-3">
        {MEDS.map(m => (
          <div key={m.name} className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="h-11 w-11 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0"><Pill className="h-5.5 w-5.5 text-[var(--color-accent)]" /></span>
                <div>
                  <p className="text-[16px] font-bold text-slate-900">{m.name}</p>
                  <p className="text-[13px] text-slate-500">{m.purpose}</p>
                  <p className="text-[13px] text-slate-700 mt-1">{m.dose}{m.withFood ? ' · with food' : ''}</p>
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
              {m.refillSoon && (
                <button
                  onClick={() => requestReorder(m.name, m.daysLeft)}
                  className="text-[13px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer">
                  <RefreshCw className="h-4 w-4" /> Reorder
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-2 text-[12.5px] text-slate-500">
        <CheckCircle className="h-4 w-4 text-slate-400" /> Reminders are sent to your phone & WhatsApp. Manage channels in Profile &amp; Privacy.
      </div>
    </div>
  )
}
