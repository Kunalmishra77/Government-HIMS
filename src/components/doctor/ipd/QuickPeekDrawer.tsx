"use client"

import { motion } from "framer-motion"
import { X, Stethoscope, Pill, FlaskConical, ArrowRight, Clock } from "lucide-react"
import { lastRound, nextRound, type Inpatient } from "@/store/useInpatientStore"
import { CONDITION_TINT, STAGE_LABEL, fmtTime } from "@/lib/ipdFormat"
import { dueChip } from "./InpatientRow"
import { cn } from "@/lib/utils"
import { ERHandoverPanel } from "./ERHandoverPanel"

// Light "glance" drawer — the deep dive lives on the full-page chart.
export function QuickPeekDrawer({ ip, onClose, onRound, onOpenChart, aiInsight }: {
  ip: Inpatient
  onClose: () => void
  onRound: () => void
  onOpenChart: () => void
  aiInsight?: string | null
}) {
  const last = lastRound(ip)
  const next = nextRound(ip)
  const dl = dueChip(ip)
  const activeMeds = ip.meds.filter(m => m.status === 'active')
  const pendingTests = ip.tests.filter(t => t.status !== 'Acknowledged')
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white z-50 shadow-2xl overflow-y-auto flex flex-col" role="dialog" aria-modal="true" aria-label="Inpatient quick view">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <p className="text-[17px] font-bold text-slate-900">{ip.name}</p>
            <p className="text-[12.5px] text-slate-500">{ip.ward} · Bed {ip.bed} · {STAGE_LABEL[ip.stage]}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4.5 w-4.5 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", CONDITION_TINT[ip.condition])}>{ip.condition}</span>
            <span className="text-[12px] text-slate-500">{ip.diagnosis}</span>
          </div>

          {aiInsight && (
            <div className="rounded-xl border border-[rgba(238,107,38,0.15)] bg-[rgba(238,107,38,0.07)]/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] mb-1">AI insight</p>
              <p className="text-[12.5px] text-[var(--color-primary-dark)] leading-snug">{aiInsight}</p>
            </div>
          )}

          <div className={cn("flex items-center gap-1.5 text-[12px] font-semibold rounded-lg px-2.5 py-2", dl.due ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500")}>
            <Clock className="h-3.5 w-3.5" /> Round {dl.text}{next && !dl.due ? ` (${fmtTime(next.scheduledAt)})` : ''}
          </div>

          {last && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Last round · {fmtTime(last.doneAt)}</p>
              <p className="text-[12.5px] text-slate-600">{last.note}</p>
              {last.vitals && <p className="text-[11px] text-slate-400 mt-1">BP {last.vitals.bp} · {last.vitals.pulse} · {last.vitals.temp} · SpO₂ {last.vitals.spo2}</p>}
            </div>
          )}

          {/* M13.11 — ER handover summary. Renders only when this inpatient
              has an ER record (came in through Emergency). Surfaces arrival
              vitals, ESI, treatment area, MLC if trauma, every order fired
              from ER + result status, and the disposition note. */}
          <ERHandoverPanel patientId={ip.patientId} />

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Pill className="h-3 w-3" /> Meds</p>
              <p className="text-[18px] font-bold text-slate-900 leading-none">{activeMeds.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{activeMeds.map(m => m.name).join(', ') || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><FlaskConical className="h-3 w-3" /> Tests</p>
              <p className="text-[18px] font-bold text-slate-900 leading-none">{pendingTests.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{ip.tests.filter(t => t.status === 'Ready').length} ready</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-2">
          <button onClick={onRound} className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[13px] flex items-center justify-center gap-1.5 transition"><Stethoscope className="h-4 w-4" /> Round</button>
          <button onClick={onOpenChart} className="flex-[1.4] h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[13px] flex items-center justify-center gap-1.5 transition">Open full chart <ArrowRight className="h-4 w-4" /></button>
        </div>
      </motion.div>
    </>
  )
}
