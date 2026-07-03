"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, AlertCircle, ArrowRight, Sparkles, CheckCircle2, Calendar,
  Users, Phone, Mail, Award,
} from "lucide-react"
import { useHRStore, type ShiftType, type StaffMember } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface SickCallModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fill from a roster cell. */
  defaults?: { staffId?: string; date?: string; shift?: ShiftType; ward?: string }
}

type Step = 'capture' | 'find_replacement' | 'confirm'

interface Candidate {
  staff: StaffMember
  score: number
  reasons: string[]
}

const today = () => new Date().toISOString().split('T')[0]!
const addDays = (date: string, n: number): string => {
  const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]!
}

export function SickCallModal({ open, onClose, defaults }: SickCallModalProps) {
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const markSickCall = useHRStore(s => s.markSickCall)
  const assignReplacement = useHRStore(s => s.assignReplacement)
  const getShift = useHRStore(s => s.getShift)
  const dutyAssignments = useHRStore(s => s.dutyAssignments)
  const overtimeEntries = useHRStore(s => s.overtimeEntries)

  const canReport = canDo(currentUser?.role, 'hr.sick_call.report')
  const canReplace = canDo(currentUser?.role, 'hr.sick_call.replace')
  const actorName = currentUser?.name ?? 'Administrator'

  const [step, setStep] = useState<Step>('capture')
  const [staffId, setStaffId] = useState(defaults?.staffId ?? '')
  const [date, setDate] = useState(defaults?.date ?? today())
  const [shift, setShift] = useState<ShiftType>(defaults?.shift ?? 'Morning')
  const [ward, setWard] = useState(defaults?.ward ?? '')
  const [expectedReturn, setExpectedReturn] = useState(addDays(today(), 1))
  const [reason, setReason] = useState('')
  const [pickedReplacement, setPickedReplacement] = useState<string | null>(null)
  const [createdSickCallId, setCreatedSickCallId] = useState<string | null>(null)

  const sickStaff = staff.find(s => s.id === staffId)

  // ── Replacement ranking ───────────────────────────────────────────────
  const candidates = useMemo<Candidate[]>(() => {
    if (!sickStaff) return []
    // Pool: active staff in same dept OR same role, on Off shift that date, not already on duty.
    const dutyToday = new Set(
      dutyAssignments.filter(d => d.date === date).map(d => d.staffId),
    )
    const pool = staff.filter(s => {
      if (s.id === sickStaff.id) return false
      if (s.status !== 'active') return false
      const sh = getShift(s.id, date)
      // Take staff who are OFF on that day so calling them in isn't a conflict
      if (sh !== 'Off') return false
      if (dutyToday.has(s.id)) return false
      return true
    })

    return pool.map(p => {
      const reasons: string[] = []
      let score = 0
      // Same dept = 3 pts
      if (p.department === sickStaff.department) { score += 3; reasons.push('Same department') }
      // Same role = 2 pts
      if (p.role === sickStaff.role) { score += 2; reasons.push('Same role') }
      // Has the required credentials? (basic check — has any credential)
      if (p.credentials.length > 0) { score += 1; reasons.push('Credentials on file') }
      // OT load this week — lower is better
      const otHours = overtimeEntries
        .filter(o => o.staffId === p.id && o.approved && o.date >= addDays(date, -7) && o.date <= date)
        .reduce((sum, o) => sum + o.hours, 0)
      if (otHours < 4) { score += 1; reasons.push('Low recent OT') }
      else if (otHours > 12) { score -= 1; reasons.push(`High recent OT (${otHours}h)`) }
      // Within branch
      if (p.branchId === sickStaff.branchId) { score += 1 }
      return { staff: p, score, reasons }
    }).sort((a, b) => b.score - a.score).slice(0, 10)
  }, [sickStaff, staff, date, getShift, dutyAssignments, overtimeEntries])

  const isCaptureValid = staffId && date && shift && expectedReturn && reason.trim().length > 1

  const handleNextFromCapture = () => {
    if (!canReport) { toast.error('No permission to report a sick call'); return }
    if (!isCaptureValid) { toast.error('Fill all fields to continue'); return }
    setStep('find_replacement')
  }

  const handleConfirmSickCall = () => {
    if (!sickStaff) return
    const id = markSickCall({
      staffId, staffName: sickStaff.name, date, shift, ward,
      expectedReturn, reason: reason.trim(),
    }, actorName)
    setCreatedSickCallId(id)
    if (pickedReplacement && canReplace) {
      assignReplacement(id, pickedReplacement, actorName)
      const replacement = staff.find(s => s.id === pickedReplacement)
      toast.success(`Sick call logged · ${replacement?.name ?? pickedReplacement} assigned as replacement`)
    } else {
      toast.success(`Sick call logged · no replacement yet`)
    }
    setStep('confirm')
  }

  const reset = () => {
    setStep('capture')
    setStaffId(defaults?.staffId ?? '')
    setDate(defaults?.date ?? today())
    setShift(defaults?.shift ?? 'Morning')
    setWard(defaults?.ward ?? '')
    setExpectedReturn(addDays(today(), 1))
    setReason('')
    setPickedReplacement(null)
    setCreatedSickCallId(null)
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
                    <AlertCircle className="h-5 w-5 text-amber-600" />Sick Call
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {step === 'capture' && 'Step 1 of 3 · Report unavailability'}
                    {step === 'find_replacement' && 'Step 2 of 3 · Find replacement'}
                    {step === 'confirm' && 'Step 3 of 3 · Confirmed'}
                  </p>
                </div>
                <button onClick={handleClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                {(['capture', 'find_replacement', 'confirm'] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                      step === s ? 'bg-amber-600 text-white'
                      : (step === 'find_replacement' && s === 'capture') || (step === 'confirm' && s !== 'confirm') ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500')}>
                      {((step === 'find_replacement' && s === 'capture') || (step === 'confirm' && s !== 'confirm'))
                        ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                    </span>
                    {i < 2 && <div className={cn('h-0.5 flex-1', step === 'confirm' || (step === 'find_replacement' && i === 0) ? 'bg-emerald-500' : 'bg-slate-200')} />}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {step === 'capture' && (
                  <>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Staff member</p>
                      <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}
                        className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200">
                        <option value="">— Pick —</option>
                        {staff.filter(s => s.status === 'active').map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.role} · {s.department})</option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Date</p>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                          className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Shift</p>
                        <Select value={shift} onChange={(e) => setShift(e.target.value as ShiftType)}
                          className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200">
                          {(['Morning', 'Evening', 'Night'] as ShiftType[]).map(s => <option key={s}>{s}</option>)}
                        </Select>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Expected return</p>
                        <input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)}
                          className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Ward (optional)</p>
                      <input value={ward} onChange={(e) => setWard(e.target.value)}
                        placeholder="e.g., ICU"
                        className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Reason</p>
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="e.g., Fever / family emergency"
                        className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200" />
                    </div>
                  </>
                )}

                {step === 'find_replacement' && sickStaff && (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                      <p className="text-xs text-amber-800">
                        <b>{sickStaff.name}</b> unavailable for <b>{shift}</b> on <b>{date}</b>
                        {ward ? ` (${ward})` : ''}.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)]">
                        Ranked candidates ({candidates.length}) · click one to assign
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Off-shift active staff matched by dept · role · low recent OT
                    </p>
                    {candidates.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                        <Users className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">No off-shift candidates match. Proceed without replacement to escalate.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {candidates.map(c => (
                          <button key={c.staff.id} onClick={() => setPickedReplacement(c.staff.id)}
                            className={cn('w-full text-left rounded-xl border p-3 cursor-pointer transition',
                              pickedReplacement === c.staff.id
                                ? 'border-[var(--color-primary-light)] bg-[rgba(238,107,38,0.07)]/60 ring-2 ring-primary/25'
                                : 'border-slate-200 hover:bg-slate-50')}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{c.staff.name}</p>
                                <p className="text-[11px] text-slate-500 truncate">{c.staff.role.replace('_', ' ')} · {c.staff.department}</p>
                              </div>
                              <span className={cn('text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded',
                                c.score >= 5 ? 'bg-emerald-100 text-emerald-700' :
                                c.score >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                                {c.score}pts
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.reasons.map((r, i) => (
                                <span key={i} className="text-[10px] text-[var(--color-accent)] bg-white border border-[rgba(238,107,38,0.15)] px-1.5 py-0.5 rounded">{r}</span>
                              ))}
                            </div>
                            {(c.staff.phone || c.staff.email) && (
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                                {c.staff.phone && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{c.staff.phone}</span>}
                                {c.staff.email && <span className="flex items-center gap-1 truncate"><Mail className="h-2.5 w-2.5" />{c.staff.email}</span>}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {step === 'confirm' && (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-base font-bold text-slate-800">Sick call recorded</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Ref: {createdSickCallId}
                    </p>
                    {pickedReplacement ? (
                      <p className="text-xs text-emerald-700 mt-2">
                        Replacement assigned · duty slot filled · audit logged.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 mt-2">
                        No replacement picked. Coverage gauge will flag the shortfall.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 justify-end bg-slate-50/30">
                {step === 'capture' && (
                  <>
                    <button onClick={handleClose}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
                    <button onClick={handleNextFromCapture} disabled={!isCaptureValid}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                      Find replacement<ArrowRight className="h-3 w-3" />
                    </button>
                  </>
                )}
                {step === 'find_replacement' && (
                  <>
                    <button onClick={() => setStep('capture')}
                      className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Back</button>
                    <button onClick={handleConfirmSickCall}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {pickedReplacement ? 'Confirm + assign' : 'Confirm without replacement'}
                    </button>
                  </>
                )}
                {step === 'confirm' && (
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
