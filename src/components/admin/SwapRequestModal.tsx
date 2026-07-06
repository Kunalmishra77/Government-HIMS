"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ArrowRight, ArrowLeftRight, CheckCircle2, RefreshCw, AlertTriangle,
} from "lucide-react"
import { useHRStore, type ShiftType } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface SwapRequestModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fill requester (current user typically). */
  defaults?: { requesterId?: string; requesterDate?: string; requesterShift?: ShiftType }
}

type Step = 'pick' | 'review' | 'sent'

const today = () => new Date().toISOString().split('T')[0]!
const dayOffset = (n: number): string => {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]!
}
const fmtDate = (s: string): string =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

export function SwapRequestModal({ open, onClose, defaults }: SwapRequestModalProps) {
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const requestSwap = useHRStore(s => s.requestSwap)

  const canRequest = canDo(currentUser?.role, 'hr.swap.request')
  const actorName = currentUser?.name ?? 'Administrator'

  const [step, setStep] = useState<Step>('pick')
  const [requesterId, setRequesterId] = useState(defaults?.requesterId ?? currentUser?.id ?? '')
  const [requesterDate, setRequesterDate] = useState(defaults?.requesterDate ?? dayOffset(2))
  const [requesterShift, setRequesterShift] = useState<ShiftType>(defaults?.requesterShift ?? 'Morning')
  const [targetId, setTargetId] = useState('')
  const [targetDate, setTargetDate] = useState(dayOffset(3))
  const [targetShift, setTargetShift] = useState<ShiftType>('Morning')
  const [reason, setReason] = useState('')

  const requester = staff.find(s => s.id === requesterId)
  const target = staff.find(s => s.id === targetId)

  // Show staff with matching role for fairness
  const eligibleTargets = useMemo(() => {
    if (!requester) return []
    return staff.filter(s => s.id !== requester.id && s.status === 'active' && s.role === requester.role)
  }, [staff, requester])

  // For convenience, show requester's actual shifts in the next 14 days so they pick one they really have
  const myShifts = useMemo(() => {
    if (!requesterId) return []
    return shifts
      .filter(s => s.staffId === requesterId && s.date >= today() && s.shift !== 'Off')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 14)
  }, [shifts, requesterId])

  const targetShifts = useMemo(() => {
    if (!targetId) return []
    return shifts
      .filter(s => s.staffId === targetId && s.date >= today() && s.shift !== 'Off')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 14)
  }, [shifts, targetId])

  const isValid = requesterId && targetId && requesterDate && targetDate && requesterShift && targetShift && requesterId !== targetId

  const handleNext = () => {
    if (!canRequest) { toast.error('No permission to request a swap'); return }
    if (!isValid) { toast.error('Pick both shifts to continue'); return }
    setStep('review')
  }

  const handleSubmit = () => {
    requestSwap({
      requesterId, requesterDate, requesterShift,
      targetId, targetDate, targetShift,
      reason: reason.trim() || undefined,
    }, actorName)
    toast.success(`Swap request sent to ${target?.name ?? targetId}`)
    setStep('sent')
  }

  const reset = () => {
    setStep('pick')
    setRequesterId(defaults?.requesterId ?? currentUser?.id ?? '')
    setRequesterDate(defaults?.requesterDate ?? dayOffset(2))
    setRequesterShift(defaults?.requesterShift ?? 'Morning')
    setTargetId('')
    setTargetDate(dayOffset(3))
    setTargetShift('Morning')
    setReason('')
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleClose}>
            <div onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-[var(--color-accent)]" />Swap Request
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {step === 'pick' && 'Step 1 · Pick shifts to swap'}
                    {step === 'review' && 'Step 2 · Review and send'}
                    {step === 'sent' && 'Step 3 · Sent for peer + admin approval'}
                  </p>
                </div>
                <button onClick={handleClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {step === 'pick' && (
                  <>
                    {/* Requester column */}
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Your shift (giving up)</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 mb-0.5">Staff (you)</p>
                          <Select value={requesterId} onChange={(e) => setRequesterId(e.target.value)}
                            className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25">
                            <option value="">— Pick —</option>
                            {staff.filter(s => s.status === 'active').map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                            ))}
                          </Select>
                        </div>
                        {myShifts.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 mb-0.5">Pick from your upcoming shifts</p>
                            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                              {myShifts.map(s => (
                                <button key={`${s.date}-${s.shift}`} type="button"
                                  onClick={() => { setRequesterDate(s.date); setRequesterShift(s.shift) }}
                                  className={cn('text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition text-left',
                                    requesterDate === s.date && requesterShift === s.shift
                                      ? 'border-[var(--color-primary-light)] bg-[rgba(238,107,38,0.07)]' : 'border-slate-200 hover:bg-slate-50')}>
                                  {fmtDate(s.date)} · {s.shift.slice(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No upcoming shifts for this staff member.</p>
                        )}
                      </div>
                    </div>

                    {/* Target column */}
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Swap with (their shift)</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 mb-0.5">Colleague (same role)</p>
                          <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}
                            className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25">
                            <option value="">— Pick —</option>
                            {eligibleTargets.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.department})</option>
                            ))}
                          </Select>
                        </div>
                        {targetShifts.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 mb-0.5">Pick from their upcoming shifts</p>
                            <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                              {targetShifts.map(s => (
                                <button key={`${s.date}-${s.shift}`} type="button"
                                  onClick={() => { setTargetDate(s.date); setTargetShift(s.shift) }}
                                  className={cn('text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition text-left',
                                    targetDate === s.date && targetShift === s.shift
                                      ? 'border-[var(--color-primary-light)] bg-[rgba(238,107,38,0.07)]' : 'border-slate-200 hover:bg-slate-50')}>
                                  {fmtDate(s.date)} · {s.shift.slice(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          targetId && <p className="text-[11px] text-slate-400 italic">No upcoming shifts for this colleague.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Reason (optional)</p>
                      <input value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g., Family wedding"
                        className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                    </div>
                  </>
                )}

                {step === 'review' && requester && target && (
                  <>
                    <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {requester.name.replace('Dr. ', '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{requester.name}</p>
                          <p className="text-[11px] text-slate-500">Gives up: <b>{fmtDate(requesterDate)} · {requesterShift}</b></p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <ArrowLeftRight className="h-5 w-5 text-[var(--color-accent)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {target.name.replace('Dr. ', '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{target.name}</p>
                          <p className="text-[11px] text-slate-500">Gives up: <b>{fmtDate(targetDate)} · {targetShift}</b></p>
                        </div>
                      </div>
                    </div>
                    {reason && (
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Reason</p>
                        <p className="text-xs text-slate-700">{reason}</p>
                      </div>
                    )}
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        Once submitted, {target.name} must accept the swap, then an admin makes the final approval.
                        Audit-logged at every step.
                      </p>
                    </div>
                  </>
                )}

                {step === 'sent' && (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-base font-bold text-slate-800">Swap request sent</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Now pending: peer acceptance from {target?.name ?? targetId}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 justify-end bg-slate-50/30">
                {step === 'pick' && (
                  <>
                    <button onClick={handleClose}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
                    <button onClick={handleNext} disabled={!isValid}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      Review<ArrowRight className="h-3 w-3" />
                    </button>
                  </>
                )}
                {step === 'review' && (
                  <>
                    <button onClick={() => setStep('pick')}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Back</button>
                    <button onClick={handleSubmit}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                      <RefreshCw className="h-3.5 w-3.5" />Send swap request
                    </button>
                  </>
                )}
                {step === 'sent' && (
                  <button onClick={handleClose}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                    Done
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
