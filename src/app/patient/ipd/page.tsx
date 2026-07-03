"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  BedDouble, Stethoscope, CheckCircle, Clock, CalendarClock, Sparkles,
  Pill, FlaskConical, Utensils, Scissors, ShieldCheck, AlertTriangle, ArrowRight, Activity,
} from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import {
  useInpatientStore, lastRound, nextRound, DISCHARGE_PILLARS,
  type Inpatient, type Condition,
} from "@/store/useInpatientStore"
import { ipdInsights } from "@/lib/earlyWarning"
import { cn } from "@/lib/utils"

const EVENT_DOT: Record<string, string> = { info: 'bg-slate-300', success: 'bg-green-500', warning: 'bg-amber-500', critical: 'bg-red-500' }

const CONDITION_TINT: Record<Condition, string> = {
  Critical: 'bg-red-100 text-red-700', Serious: 'bg-accent-soft text-accent',
  Stable: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]', Improving: 'bg-green-100 text-green-700', 'Discharge-ready': 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
}
const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

// Journey phases shown to the patient (collapses the detailed stages).
const PHASES = ['Admitted', 'Under care', 'Recovery', 'Discharge'] as const
function phaseIndex(ip: Inpatient): number {
  switch (ip.stage) {
    case 'admitted': return 0
    case 'under_treatment': case 'pre_op': case 'in_surgery': return 1
    case 'post_op': case 'recovering': return 2
    case 'discharge_initiated': case 'discharged': return 3
    default: return 1
  }
}

export default function IpdPage() {
  const currentUser = useAuthStore(s => s.currentUser)
  const inpatients = useInpatientStore(s => s.inpatients)
  const signConsent = useInpatientStore(s => s.signConsent)
  const ip = inpatients.find(i => i.patientId === currentUser?.id) ?? null

  // This page renders live admission data with absolute timestamps; defer to
  // after mount so the server and first client render match (no hydration drift).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return (
    <div className="max-w-3xl mx-auto py-20 flex justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" role="status" aria-label="Loading" />
    </div>
  )

  if (!ip) {
    return (
      <div className="max-w-3xl mx-auto pb-10">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">IPD / Admission</h1>
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-10 text-center mt-5">
          <span className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3"><BedDouble className="h-7 w-7 text-slate-400" /></span>
          <p className="text-[15px] font-bold text-slate-900">You&apos;re not currently admitted</p>
          <p className="text-[13px] text-slate-500 mt-1">If you&apos;re admitted to a ward, your live care plan, doctor rounds and recovery will appear here.</p>
        </div>
      </div>
    )
  }

  const last = lastRound(ip)
  const next = nextRound(ip)
  const completedRounds = ip.rounds.filter(r => r.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const phase = phaseIndex(ip)
  const insight = ipdInsights(ip)
  const timeline = [...ip.events].reverse().filter(e => e.patientText)

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">IPD / Admission</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your live inpatient care — rounds, treatment and recovery</p>
      </div>

      {/* Admission header */}
      <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] shadow-[0_10px_30px_rgba(238,107,38,0.25)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><BedDouble className="h-5 w-5" /><span className="text-[13px] font-bold uppercase tracking-wider text-white/80">Admitted</span></div>
          <span className={cn("text-[12px] font-bold px-2.5 py-1 rounded-full", CONDITION_TINT[ip.condition])}>{ip.condition}</span>
        </div>
        <p className="text-[20px] font-bold mt-3">{ip.diagnosis}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 mt-3 text-[12.5px] text-white/85">
          <span>{ip.ward} · Bed {ip.bed}</span>
          <span className="flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> {ip.admittingDoctor}</span>
          <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Admitted {fmt(ip.admittedAt)}</span>
          {ip.expectedDischarge && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Est. discharge {ip.expectedDischarge}</span>}
        </div>
      </div>

      {/* Journey stage tracker */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <div className="flex items-center">
          {PHASES.map((p, i) => (
            <div key={p} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-bold", i <= phase ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-400")}>
                  {i < phase ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn("text-[11px] font-semibold", i <= phase ? "text-[var(--color-accent)]" : "text-slate-400")}>{p}</span>
              </div>
              {i < PHASES.length - 1 && <div className={cn("flex-1 h-0.5 mx-1 -mt-4 rounded", i < phase ? "bg-[var(--color-primary)]" : "bg-slate-200")} />}
            </div>
          ))}
        </div>
      </div>

      {/* AI summary */}
      <div className="rounded-3xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-9 w-9 rounded-2xl bg-[rgba(238,107,38,0.12)] flex items-center justify-center flex-shrink-0"><Sparkles className="h-4.5 w-4.5 text-[var(--color-accent)]" /></span>
          <div><p className="text-[14px] font-bold text-[var(--color-primary-dark)]">How you&apos;re doing</p><p className="text-[12px] text-[var(--color-accent)]">AI summary · in plain language</p></div>
        </div>
        <p className="text-[13.5px] text-[var(--color-primary-dark)] leading-relaxed">
          {insight.patientReassurance}{last ? ` At the last round, ${ip.admittingDoctor} noted: “${last.note}”.` : ''}
          {next ? ` Your next doctor round is expected around ${fmtTime(next.scheduledAt)}.` : ''}
        </p>
      </div>

      {/* Curated care timeline — every step, in plain language */}
      {timeline.length > 0 && (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
          <h3 className="text-[15px] font-bold text-slate-900 mb-1 flex items-center gap-2"><Activity className="h-4.5 w-4.5 text-[var(--color-accent)]" /> Your care timeline</h3>
          <p className="text-[12px] text-slate-500 mb-3">Everything happening in your care, explained simply.</p>
          <div className="space-y-3">
            {timeline.map(e => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className={cn("h-2.5 w-2.5 rounded-full mt-1.5", EVENT_DOT[e.severity ?? 'info'])} />
                  <span className="w-px flex-1 bg-slate-100 mt-1" />
                </div>
                <div className="flex-1 pb-1">
                  <p className="text-[13px] text-slate-700">{e.patientText}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmt(e.at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctor rounds timeline */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Stethoscope className="h-4.5 w-4.5 text-[var(--color-accent)]" /> Doctor rounds</h3>
        {next && <div className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-3"><Clock className="h-3.5 w-3.5" /> Next round expected ~{fmtTime(next.scheduledAt)}</div>}
        <div className="space-y-3">
          {completedRounds.map(r => (
            <div key={r.id} className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0"><span className="h-8 w-8 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center"><Stethoscope className="h-4 w-4" /></span><span className="w-px flex-1 bg-slate-100 mt-1" /></div>
              <div className="flex-1 pb-1">
                <div className="flex items-center justify-between"><p className="text-[13.5px] font-bold text-slate-900">{r.doctor}</p><span className="text-[11.5px] text-slate-400">{fmtTime(r.doneAt!)}</span></div>
                <p className="text-[13px] text-slate-600 mt-0.5">{r.note}</p>
                {r.plan && <p className="text-[12px] text-slate-500 mt-0.5">Plan: {r.plan}</p>}
                {r.vitals && <p className="text-[11.5px] text-slate-400 mt-1">BP {r.vitals.bp} · {r.vitals.pulse} · {r.vitals.temp} · SpO₂ {r.vitals.spo2}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Surgery (shows when planned) */}
      {ip.surgery && (() => {
        const sg = ip.surgery!
        const STEPS = [['consent_pending', 'Consent'], ['scheduled', 'Scheduled'], ['in_ot', 'In OT'], ['recovery', 'Recovery'], ['done', 'Done']] as const
        const sIdx = STEPS.findIndex(([k]) => k === sg.status)
        const msg =
          sg.status === 'consent_pending' && !sg.consentSigned ? `Your doctor recommends this procedure. Please review and give your consent.` :
          sg.status === 'consent_pending' ? `Consent received — your procedure is being scheduled.` :
          sg.status === 'scheduled' ? `Scheduled${sg.scheduledAt ? ` for ${fmt(sg.scheduledAt)}` : ''}${sg.ot ? ` at ${sg.ot}` : ''}. The team will prepare you.` :
          sg.status === 'in_ot' ? `You're in the operation theatre now — your family will be kept updated.` :
          sg.status === 'recovery' ? `In recovery after your procedure.${sg.postOpNote ? ` ${sg.postOpNote}` : ''}` :
          `Procedure complete.${sg.postOpNote ? ` ${sg.postOpNote}` : ''}`
        return (
          <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
            <h3 className="text-[15px] font-bold text-slate-900 mb-1 flex items-center gap-2"><Scissors className="h-4.5 w-4.5 text-rose-500" /> Procedure / Surgery</h3>
            <p className="text-[13.5px] text-slate-700">{sg.procedure} · {sg.surgeon}</p>
            {/* stepper */}
            <div className="flex items-center my-4">
              {STEPS.map(([k, label], i) => (
                <div key={k} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold", i <= sIdx ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400")}>{i < sIdx ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}</div>
                    <span className={cn("text-[10px] font-semibold", i <= sIdx ? "text-rose-600" : "text-slate-400")}>{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={cn("flex-1 h-0.5 mx-1 -mt-4 rounded", i < sIdx ? "bg-rose-500" : "bg-slate-200")} />}
                </div>
              ))}
            </div>
            <p className="text-[13px] text-slate-600 bg-slate-50 rounded-xl p-3">{msg}</p>
            {sg.status === 'consent_pending' && !sg.consentSigned && (
              <button onClick={() => signConsent(ip.patientId)} className="mt-3 w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-[14px] rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition">
                <CheckCircle className="h-4.5 w-4.5" /> Give consent for procedure
              </button>
            )}
          </div>
        )
      })()}

      {/* Medicines (MAR) */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Pill className="h-4.5 w-4.5 text-[var(--color-accent)]" /> Your medicines</h3>
        <div className="space-y-2">
          {ip.meds.map((m, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
              <span className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><Pill className="h-4.5 w-4.5" /></span>
              <div className="flex-1 min-w-0"><p className="text-[14px] font-semibold text-slate-900">{m.name} {m.dose}</p><p className="text-[12px] text-slate-500">{m.freq} · {m.route}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* Tests & results */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><FlaskConical className="h-4.5 w-4.5 text-rose-600" /> Tests &amp; investigations</h3>
        <div className="space-y-2">
          {ip.tests.map((t, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
              <span className="text-[13.5px] font-semibold text-slate-800">{t.name}</span>
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1", t.status === 'Ready' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                {t.status === 'Ready' ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}{t.status}
              </span>
            </div>
          ))}
        </div>
        {ip.diet && <p className="text-[12.5px] text-slate-500 flex items-center gap-1.5 mt-3"><Utensils className="h-4 w-4 text-slate-400" /> Diet: {ip.diet}</p>}
      </div>

      {/* Discharge (shows when initiated) */}
      {ip.discharge && (() => {
        const d = ip.discharge!
        const done = ip.stage === 'discharged'
        const clearedCount = DISCHARGE_PILLARS.filter(p => d.pillars[p.key]).length
        return (
          <div className={cn("rounded-3xl p-5 shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)]", done ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white" : "bg-white")}>
            <h3 className={cn("text-[15px] font-bold mb-3 flex items-center gap-2", done ? "text-white" : "text-slate-900")}>
              <ShieldCheck className={cn("h-4.5 w-4.5", done ? "text-white" : "text-green-600")} /> {done ? 'Discharged' : 'Discharge in progress'}
            </h3>
            {!done && (
              <>
                <div className="flex items-center justify-between mb-2"><span className="text-[12px] font-semibold text-slate-500">Clearance {clearedCount}/{DISCHARGE_PILLARS.length}</span></div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(clearedCount / DISCHARGE_PILLARS.length) * 100}%` }} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-1">
                  {DISCHARGE_PILLARS.map(p => (
                    <div key={p.key} className="flex items-center gap-1.5 text-[12.5px]">
                      {d.pillars[p.key] ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Clock className="h-4 w-4 text-amber-400" />}
                      <span className={cn("font-medium", d.pillars[p.key] ? "text-slate-700" : "text-slate-400")}>{p.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {done && <p className="text-[13.5px] text-white/90 mb-3">You&apos;ve been discharged. Here&apos;s your summary, take-home medicines and follow-up plan.</p>}

            {d.summary && (
              <div className={cn("rounded-2xl p-3 mt-2", done ? "bg-white/10" : "bg-slate-50")}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wide mb-1", done ? "text-white/70" : "text-slate-400")}>Discharge summary</p>
                <p className={cn("text-[13px] leading-relaxed", done ? "text-white/90" : "text-slate-700")}>{d.summary}</p>
              </div>
            )}
            {d.meds.length > 0 && (
              <div className="mt-3">
                <p className={cn("text-[11px] font-bold uppercase tracking-wide mb-1.5", done ? "text-white/70" : "text-slate-400")}>Take-home medicines</p>
                <div className="flex flex-wrap gap-1.5">{d.meds.map((m, i) => <span key={i} className={cn("text-[12px] font-medium px-2.5 py-1 rounded-full", done ? "bg-white/15 text-white" : "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]")}>{m.name} {m.dose} · {m.freq}</span>)}</div>
              </div>
            )}
            {d.redFlags.length > 0 && (
              <div className="mt-3">
                <p className={cn("text-[11px] font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1", done ? "text-white/70" : "text-red-500")}><AlertTriangle className="h-3.5 w-3.5" /> When to come back</p>
                <div className="flex flex-wrap gap-1.5">{d.redFlags.map((f, i) => <span key={i} className={cn("text-[12px] font-medium px-2.5 py-1 rounded-full", done ? "bg-white/15 text-white" : "bg-red-50 text-red-700")}>{f}</span>)}</div>
              </div>
            )}
            {d.followUpDate && (
              <Link href="/patient/followup" className={cn("mt-4 w-full rounded-xl py-2.5 flex items-center justify-center gap-2 font-bold text-[14px] active:scale-[0.98] transition", done ? "bg-white text-green-700" : "bg-[var(--color-primary)] text-white")}>
                <CalendarClock className="h-4.5 w-4.5" /> Follow-up {new Date(d.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · View care plan <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )
      })()}
    </div>
  )
}
