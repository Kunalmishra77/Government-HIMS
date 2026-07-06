"use client"

import { useMemo } from "react"
import {
  CheckCircle, CalendarCheck, Pill, FileText, AlertTriangle, Sparkles,
  Phone, Hourglass, ShieldCheck, Download, MapPin,
} from "lucide-react"
import { useDischargeStore, type ClearancePillar } from "@/store/useDischargeStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const PILLAR_LABELS: Record<ClearancePillar, string> = {
  doctor: 'Doctor', nursing: 'Nursing', pharmacy: 'Pharmacy', billing: 'Billing', insurance: 'Insurance',
}
const PILLAR_DESC: Record<ClearancePillar, string> = {
  doctor: 'Discharge summary signed by your attending doctor',
  nursing: 'Post-procedure care + nursing handover completed',
  pharmacy: 'Take-home medicines (TTO) ready at the pharmacy counter',
  billing: 'Final bill preparation and payment',
  insurance: 'TPA cashless approval / claim submission',
}

const dateOf = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const dateTimeOf = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function PatientDischarge() {
  const queue = useDischargeStore(s => s.dischargeQueue)
  const currentUser = useAuthStore(s => s.currentUser)
  const isPatient = currentUser?.role === 'patient'
  const id = isPatient ? currentUser.id : ''
  const name = isPatient ? currentUser.name : ''

  const mine = useMemo(
    () => queue.find(p => p.patientId === id || p.patientName === name),
    [queue, id, name]
  )

  if (!isPatient) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">My Discharge</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your discharge summary, take-home medicines and follow-up plan</p>
        </div>
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-6 text-center">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-bold text-amber-900">Patient view only</p>
          <p className="text-xs text-amber-700 mt-1">Discharge records are personal to each patient. Switch to your patient portal to see your records.</p>
        </div>
      </div>
    )
  }

  if (!mine) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">My Discharge</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your discharge summary, take-home medicines and follow-up plan</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-6 text-center">
          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No active discharge in progress</p>
          <p className="text-xs text-slate-500 mt-1">Once your discharge is initiated by the care team, your summary, take-home medicines and follow-up plan will appear here.</p>
        </div>
      </div>
    )
  }

  const pillars: ClearancePillar[] = ['doctor', 'nursing', 'pharmacy', 'billing', 'insurance']
  const clearedCount = pillars.filter(p => mine.clearances[p] === 'cleared').length
  const progress = Math.round((clearedCount / pillars.length) * 100)
  const allCleared = clearedCount === pillars.length
  const openBlockers = mine.blockers.filter(b => !b.resolvedAt)

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">My Discharge</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your discharge summary, take-home medicines and follow-up plan</p>
      </div>

      {/* Status banner */}
      <div className={cn('rounded-2xl p-5 ring-1',
        mine.exitClearanceIssued ? 'bg-emerald-50 ring-emerald-200'
          : allCleared ? 'bg-[rgba(238,107,38,0.07)] ring-primary/25'
          : 'bg-amber-50 ring-amber-200')}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className={cn('text-[15px] font-bold',
              mine.exitClearanceIssued ? 'text-emerald-900'
                : allCleared ? 'text-[var(--color-primary-dark)]' : 'text-amber-900')}>
              {mine.exitClearanceIssued ? 'Exit clearance issued · ready to leave the hospital'
                : allCleared ? 'All clearances done · awaiting exit pass'
                : `Discharge in progress · ${clearedCount}/${pillars.length} steps cleared`}
            </p>
            <p className={cn('text-[12px] mt-0.5',
              mine.exitClearanceIssued ? 'text-emerald-700'
                : allCleared ? 'text-[var(--color-accent)]' : 'text-amber-700')}>
              {mine.attendingDoctor} · {mine.diagnosis} · Ward {mine.wardBed} · Expected: {dateTimeOf(mine.expectedDischarge)}
            </p>
          </div>
          {!mine.exitClearanceIssued && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Progress</p>
              <p className="text-xl font-bold text-slate-900">{progress}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Clearance pillars */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Clearance steps</h3>
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] divide-y divide-slate-100">
          {pillars.map(p => {
            const cleared = mine.clearances[p] === 'cleared'
            const blocker = openBlockers.find(b => b.type.toLowerCase() === p)
            return (
              <div key={p} className="p-4 flex items-start gap-3">
                <span className={cn('h-8 w-8 rounded-2xl flex items-center justify-center flex-shrink-0',
                  cleared ? 'bg-emerald-100' : 'bg-amber-100')}>
                  {cleared ? <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                    : <Hourglass className="h-4.5 w-4.5 text-amber-600" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-900">{PILLAR_LABELS[p]}</p>
                  <p className="text-[12px] text-slate-500">{PILLAR_DESC[p]}</p>
                  {blocker && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{blocker.description}
                    </p>
                  )}
                </div>
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0',
                  cleared ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                  {cleared ? 'Cleared' : 'Pending'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Take-home medicines */}
      {(mine.ttoMeds ?? []).length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Take-home medicines</h3>
          <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 space-y-2">
            {mine.ttoMeds!.map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                <span className="h-9 w-9 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0">
                  <Pill className="h-4.5 w-4.5 text-[var(--color-accent)]" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-900">{m.name}</p>
                  <p className="text-[12px] text-slate-500">{m.dose} · {m.freq} · for {m.duration}</p>
                </div>
              </div>
            ))}
            <p className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              Collect from <b>Pharmacy counter (Ground Floor)</b> before leaving.
            </p>
          </div>
        </div>
      )}

      {/* Discharge instructions */}
      {mine.dischargeInstructions && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">What to do at home</h3>
          <div className="rounded-3xl bg-[rgba(238,107,38,0.07)] ring-1 ring-primary/20 p-5 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-[var(--color-accent)] uppercase tracking-wide">Recovery instructions</p>
              <p className="text-[13px] text-[var(--color-primary-dark)] mt-1 leading-relaxed whitespace-pre-wrap">{mine.dischargeInstructions}</p>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up */}
      {mine.followUpDate && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Follow-up appointment</h3>
          <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0">
              <CalendarCheck className="h-5 w-5 text-[var(--color-accent)]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-slate-900">{dateOf(mine.followUpDate)}</p>
              <p className="text-[12px] text-slate-500">{mine.attendingDoctor} · please bring this discharge summary</p>
            </div>
          </div>
        </div>
      )}

      {/* Doctor's discharge summary */}
      {mine.dischargeSummary && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Doctor's discharge summary</h3>
          <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                <FileText className="h-3 w-3" />Summary
                {mine.summaryApproved && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-2 normal-case flex items-center gap-0.5">
                  <ShieldCheck className="h-3 w-3" />signed by {mine.attendingDoctor}
                </span>}
              </p>
              <button onClick={() => toast.success('Discharge summary downloaded as PDF (mock)')}
                className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] px-2.5 py-1 rounded-lg cursor-pointer">
                <Download className="h-3 w-3" />Download
              </button>
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed">{mine.dischargeSummary}</p>
          </div>
        </div>
      )}

      {/* Bring with you */}
      <div className="rounded-3xl bg-slate-50 p-5">
        <h3 className="text-[14px] font-bold text-slate-800 mb-2">Bring with you to follow-up</h3>
        <ul className="text-[12.5px] text-slate-600 space-y-1 list-disc list-inside">
          <li>This discharge summary (printed or on phone)</li>
          <li>Take-home medicine strips</li>
          <li>Any home-monitoring records (BP, glucose, weight, etc.)</li>
          <li>Insurance card</li>
        </ul>
      </div>

      {/* Help */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 flex items-center gap-3">
        <span className="h-10 w-10 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0">
          <Phone className="h-5 w-5 text-rose-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900">Help &amp; emergency</p>
          <p className="text-[12px] text-slate-500">Call <b>1066</b> for hospital emergency · <b>108</b> for ambulance</p>
        </div>
      </div>
    </div>
  )
}
