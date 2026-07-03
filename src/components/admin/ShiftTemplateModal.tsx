"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Check, Calendar, Users, Sparkles, Eye, AlertTriangle, ArrowRight,
} from "lucide-react"
import { useHRStore, type ShiftType } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface ShiftTemplateModalProps {
  open: boolean
  onClose: () => void
  /** Pre-select these staff IDs (e.g., from a roster multi-select). */
  preselectedStaffIds?: string[]
  /** Default start date — defaults to next Monday. */
  defaultStart?: string
}

const SHIFT_TINT: Record<ShiftType, string> = {
  Morning: 'bg-amber-400',
  Evening: 'bg-[rgba(238,107,38,0.07)]0',
  Night:   'bg-[var(--color-primary)]',
  Off:     'bg-slate-200',
}

function nextMonday(): string {
  const d = new Date()
  const day = d.getDay()  // 0=Sun..6=Sat
  const daysAhead = day === 0 ? 1 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().split('T')[0]!
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00'); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]!
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function ShiftTemplateModal({ open, onClose, preselectedStaffIds = [], defaultStart }: ShiftTemplateModalProps) {
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const shiftTemplates = useHRStore(s => s.shiftTemplates)
  const applyShiftPattern = useHRStore(s => s.applyShiftPattern)

  const canApply = canDo(currentUser?.role, 'hr.shift.bulk')

  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set(preselectedStaffIds))
  const [templateId, setTemplateId] = useState<string>(shiftTemplates[0]?.id ?? '')
  const [fromDate, setFromDate] = useState<string>(defaultStart ?? nextMonday())
  const [weeks, setWeeks] = useState<number>(4)
  const [staffFilter, setStaffFilter] = useState<string>('')
  const [previewOpen, setPreviewOpen] = useState(false)

  const template = shiftTemplates.find(t => t.id === templateId) ?? shiftTemplates[0]

  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff])
  const filteredStaff = useMemo(() => {
    if (!staffFilter) return activeStaff
    const f = staffFilter.toLowerCase()
    return activeStaff.filter(s =>
      s.name.toLowerCase().includes(f) ||
      s.department.toLowerCase().includes(f) ||
      s.role.toLowerCase().includes(f),
    )
  }, [activeStaff, staffFilter])

  // Preview: first 14 days of the pattern for the first selected staff member.
  const preview = useMemo(() => {
    if (!template) return []
    const out: { date: string; shift: ShiftType }[] = []
    for (let i = 0; i < Math.min(14, weeks * 7); i++) {
      const date = addDays(fromDate, i)
      const shift = template.pattern[i % template.pattern.length]!
      out.push({ date, shift })
    }
    return out
  }, [template, fromDate, weeks])

  const toggleStaff = (id: string) => {
    setSelectedStaff(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const selectAllVisible = () => {
    if (filteredStaff.every(s => selectedStaff.has(s.id))) {
      setSelectedStaff(new Set())
    } else {
      setSelectedStaff(new Set(filteredStaff.map(s => s.id)))
    }
  }

  const handleApply = () => {
    if (!canApply) { toast.error("You don't have permission to apply shift patterns"); return }
    if (selectedStaff.size === 0) { toast.error('Select at least one staff member'); return }
    if (!template) { toast.error('Pick a template'); return }
    if (weeks < 1 || weeks > 26) { toast.error('Weeks must be between 1 and 26'); return }

    const actorName = currentUser?.name ?? 'Administrator'
    applyShiftPattern(Array.from(selectedStaff), fromDate, weeks, template.id, actorName)
    toast.success(`${template.name} applied to ${selectedStaff.size} staff · ${weeks} weeks from ${fmtDate(fromDate)}`)
    onClose()
  }

  if (!template) {
    return open ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-slate-600">No shift templates available. Add one in HR settings first.</p>
          <button onClick={onClose} className="mt-3 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200">Close</button>
        </div>
      </div>
    ) : null
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />Apply Shift Pattern
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Bulk-apply a template across multiple staff · audit-logged</p>
                </div>
                <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Template selector */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Template</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {shiftTemplates.map(t => (
                      <button key={t.id} onClick={() => setTemplateId(t.id)}
                        data-testid={`tmpl-${t.id}`}
                        className={cn('rounded-xl border p-3 text-left cursor-pointer transition',
                          templateId === t.id ? 'border-primary bg-[rgba(238,107,38,0.07)]/50 ring-2 ring-primary/25' : 'border-slate-200 hover:bg-slate-50')}>
                        <p className="text-xs font-bold text-slate-800">{t.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{t.description}</p>
                        <div className="flex items-center gap-0.5 mt-2">
                          {t.pattern.map((s, i) => (
                            <span key={i} className={cn('h-2 w-3 rounded-sm', SHIFT_TINT[s])} title={`Day ${i + 1}: ${s}`} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Range */}
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">Date range</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />From
                      </p>
                      <input type="date" value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Weeks</p>
                      <input type="number" min={1} max={26} value={weeks}
                        onChange={(e) => setWeeks(Number(e.target.value))}
                        className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Pattern covers <b>{fmtDate(fromDate)}</b> → <b>{fmtDate(addDays(fromDate, weeks * 7 - 1))}</b>
                    ({weeks * 7} days)
                  </p>
                </section>

                {/* Staff selector */}
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Staff · {selectedStaff.size} selected
                    </p>
                    <button onClick={selectAllVisible}
                      className="text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer">
                      {filteredStaff.every(s => selectedStaff.has(s.id)) ? 'Deselect visible' : 'Select all visible'}
                    </button>
                  </div>
                  <input value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
                    placeholder="Filter by name / dept / role…"
                    className="w-full h-9 px-2.5 mb-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    {filteredStaff.length === 0 ? (
                      <p className="text-xs text-slate-400 italic p-4 text-center">No staff match this filter.</p>
                    ) : filteredStaff.map(m => (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={selectedStaff.has(m.id)} onChange={() => toggleStaff(m.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{m.name}</p>
                          <p className="text-[11px] text-slate-500">{m.role.replace('_', ' ')} · {m.department}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>

                {/* Preview */}
                <section>
                  <button onClick={() => setPreviewOpen(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer">
                    <Eye className="h-3 w-3" />{previewOpen ? 'Hide preview' : 'Preview first 14 days'}
                  </button>
                  {previewOpen && (
                    <div className="mt-2 grid grid-cols-7 gap-1.5">
                      {preview.map(p => (
                        <div key={p.date} className="rounded-lg bg-slate-50 p-2 text-center">
                          <p className="text-[10px] font-bold text-slate-500">{fmtDate(p.date).split(',')[0]}</p>
                          <span className={cn('inline-block h-3 w-3 rounded-sm mt-1', SHIFT_TINT[p.shift])} />
                          <p className="text-[9px] font-bold text-slate-700 mt-0.5">{p.shift.slice(0, 3)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {selectedStaff.size > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-800">
                      Will apply <b>{template.name}</b> to <b>{selectedStaff.size}</b> staff
                      for <b>{weeks} weeks</b> from <b>{fmtDate(fromDate)}</b>.
                      That&apos;s <b>{selectedStaff.size * weeks * 7}</b> shift entries replaced.
                    </p>
                  </div>
                )}

                {!canApply && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      You don&apos;t have <code>hr.shift.bulk</code> permission. Contact an administrator.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 justify-end bg-slate-50/30">
                <button onClick={onClose}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
                <button onClick={handleApply}
                  disabled={!canApply || selectedStaff.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <Check className="h-3.5 w-3.5" />Apply pattern<ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
