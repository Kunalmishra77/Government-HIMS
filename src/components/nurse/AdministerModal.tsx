"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { X, ShieldAlert, CheckCircle2, Pill, AlertTriangle } from "lucide-react"
import { checkRx, hasMajor, type RxWarning } from "@/lib/drugSafety"
import type { MarSlot } from "@/lib/mar"

const NURSE = "Anjali Desai"
const RIGHTS = ["Right patient (name + wristband)", "Right drug", "Right dose", "Right route", "Right time"] as const

export function AdministerModal({ slot, allergies, comorbidities, onClose, onAdminister, onHold }: {
  slot: MarSlot
  allergies?: string[]
  comorbidities?: string[]
  onClose: () => void
  onAdminister: (note?: string) => void
  onHold: (note?: string) => void
}) {
  const warnings: RxWarning[] = useMemo(
    () => checkRx([slot.medName], { allergies, comorbidities }),
    [slot.medName, allergies, comorbidities],
  )
  const blocking = hasMajor(warnings) || warnings.some(w => w.type === "allergy")
  const [checks, setChecks] = useState<boolean[]>(RIGHTS.map(() => false))
  const [override, setOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState("")
  const [holdReason, setHoldReason] = useState("")

  const allRights = checks.every(Boolean)
  const canGive = allRights && (!blocking || (override && overrideReason.trim().length > 0))

  const give = () => {
    const note = blocking && override ? `Override: ${overrideReason.trim()} (by ${NURSE})` : undefined
    onAdminister(note)
    onClose()
  }
  const hold = () => {
    // M9 — NABH-traceability: holding without a reason is no longer allowed.
    if (holdReason.trim().length < 3) {
      // Surface a tiny inline complaint via the input's own validity
      // hint — see id below — instead of toast.
      const el = typeof document !== 'undefined' ? document.getElementById('hold-reason') as HTMLInputElement | null : null
      if (el) { el.focus(); el.setCustomValidity('Hold reason required (≥ 3 chars).'); el.reportValidity(); setTimeout(() => el.setCustomValidity(''), 1500) }
      return
    }
    onHold(holdReason.trim()); onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="admin-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] flex items-center justify-center flex-shrink-0">
              <Pill className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div className="min-w-0">
              <h2 id="admin-title" className="text-base font-bold text-slate-900 truncate">{slot.medName} {slot.dose}</h2>
              <p className="text-sm text-slate-500 font-medium truncate">{slot.patientName} · {slot.ward} {slot.bed} · {slot.route} · {slot.slot}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* AI safety gate */}
          {warnings.length > 0 ? (
            <div className={`rounded-xl border p-3 ${blocking ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
              <div className={`flex items-center gap-2 mb-2 text-sm font-bold ${blocking ? "text-red-700" : "text-amber-700"}`}>
                <ShieldAlert className="h-4 w-4" /> AI safety check {blocking ? "— administration blocked" : "— caution"}
              </div>
              <ul className="space-y-1.5">
                {warnings.map((w, i) => (
                  <li key={i} className={`text-xs font-semibold ${w.severity === "major" || w.type === "allergy" ? "text-red-600" : "text-amber-600"}`}>
                    <span className="font-bold">{w.title}:</span> {w.note}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> No allergy or interaction conflicts detected.
            </div>
          )}

          {/* 5 Rights */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Verify the 5 rights</p>
            <div className="space-y-1.5">
              {RIGHTS.map((r, i) => (
                <label key={r} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={checks[i]} onChange={e => setChecks(c => c.map((v, j) => j === i ? e.target.checked : v))}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer" />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {/* Override (only when blocked) */}
          {blocking && (
            <div className="rounded-xl border border-red-200 bg-white p-3">
              <label className="flex items-center gap-2.5 text-sm font-semibold text-red-700 cursor-pointer">
                <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                Override safety block (clinician-authorised)
              </label>
              {override && (
                <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Override reason (required)"
                  className="mt-2 w-full h-9 px-3 rounded-lg border border-red-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-400 bg-red-50/50" />
              )}
            </div>
          )}

          {/* Hold reason */}
          <div>
            <label htmlFor="hold-reason" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hold reason (if holding)</label>
            <input id="hold-reason" value={holdReason} onChange={e => setHoldReason(e.target.value)} placeholder="e.g. patient NBM for procedure"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-slate-50" />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={hold} className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-amber-200 bg-amber-50 text-sm font-bold text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer">
            <AlertTriangle className="h-4 w-4" /> Hold
          </button>
          <button onClick={give} disabled={!canGive}
            className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            {blocking ? (override ? "Override & Administer" : "Administer (blocked)") : "Administer"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
