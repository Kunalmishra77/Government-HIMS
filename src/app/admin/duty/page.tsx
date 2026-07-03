"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ClipboardList, ChevronLeft, ChevronRight, AlertTriangle,
  Stethoscope, Activity, FlaskConical, Pill, Sparkles, CheckCircle, XCircle, Copy,
  Microscope, Truck, Heart, Beaker, RefreshCw,
} from "lucide-react"
import { useHRStore, type ShiftType, type StaffMember } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { detectAllConflicts, indexConflictsByCell, worstSeverity } from "@/lib/shiftConflicts"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const SHIFTS: ShiftType[] = ['Morning', 'Evening', 'Night']

const SHIFT_CONFIG: Record<ShiftType, { label: string; time: string; gradient: string; tint: string }> = {
  Morning: { label: 'Morning', time: '06:00 – 14:00', gradient: 'linear-gradient(135deg, #D97706, #F59E0B)', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
  Evening: { label: 'Evening', time: '14:00 – 22:00', gradient: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))', tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]' },
  Night:   { label: 'Night',   time: '22:00 – 06:00', gradient: 'linear-gradient(135deg, #9A3A14, var(--color-primary-dark))', tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]' },
  Off:     { label: 'Off',     time: '',              gradient: '',                                          tint: 'bg-slate-100 text-slate-400 border-slate-200' },
}

const ROLE_ICON: Record<string, React.ElementType> = {
  doctor: Stethoscope, emergency: Heart, nurse: Activity, ot: Stethoscope,
  lab: FlaskConical, pharmacy: Pill, radiology: Microscope,
  ambulance: Truck, blood_bank: Beaker,
}

const WARDS = ['ICU', 'Emergency', 'General Ward', 'Cardiac Care', 'Maternity', 'Radiology', 'Pathology', 'Pharmacy', 'OT', 'Microbiology', 'CCU', 'NICU']

const WARD_TINT: Record<string, string> = {
  ICU:           'bg-red-50 text-red-700',
  Emergency:     'bg-primary-soft text-accent',
  CCU:           'bg-rose-50 text-rose-700',
  NICU:          'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  'General Ward':'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  'Cardiac Care':'bg-rose-50 text-rose-700',
  Maternity:     'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  Radiology:     'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  Pathology:     'bg-emerald-50 text-emerald-700',
  Microbiology:  'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  Pharmacy:      'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  OT:            'bg-surface-sunken text-accent',
}

function getDateStr(offsetDays: number): string {
  const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().split('T')[0]!
}
function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function DutyAssignmentPage() {
  const t = useTranslations('admin')
  const shiftLabel = (s: string) => t.has(`duty.shift.${s}`) ? t(`duty.shift.${s}`) : s
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const dutyAssignments = useHRStore(s => s.dutyAssignments)
  const leaveRequests = useHRStore(s => s.leaveRequests)
  const assignDuty = useHRStore(s => s.assignDuty)
  const clearDuty = useHRStore(s => s.clearDuty)
  const getShift = useHRStore(s => s.getShift)

  const [dateOffset, setDateOffset] = useState(0)
  const [selectedShift, setSelectedShift] = useState<ShiftType>('Morning')
  const [roleFilter, setRoleFilter] = useState('All')
  const [assignTarget, setAssignTarget] = useState<{ staffId: string; staffName: string } | null>(null)
  const [selectedWard, setSelectedWard] = useState<string>('General Ward')

  const canWrite = canDo(currentUser?.role, 'hr.duty.write')
  const actorName = currentUser?.name ?? 'Administrator'

  const currentDate = getDateStr(dateOffset)
  const roles = useMemo(() => ['All', ...Array.from(new Set(staff.map(s => s.role)))], [staff])
  const filteredStaff = useMemo(() =>
    staff.filter(s => s.status === 'active' && (roleFilter === 'All' || s.role === roleFilter)),
    [staff, roleFilter])

  // Conflicts indexed by cell for quick lookup
  const conflicts = useMemo(() =>
    detectAllConflicts({ shifts, leaves: leaveRequests, duties: dutyAssignments }),
    [shifts, leaveRequests, dutyAssignments])
  const conflictIdx = useMemo(() => indexConflictsByCell(conflicts), [conflicts])

  // Build a map of (staffId → duty for the current date+shift)
  const dutyMap = useMemo(() => {
    const m = new Map<string, typeof dutyAssignments[0]>()
    for (const d of dutyAssignments) {
      if (d.date === currentDate && d.shift === selectedShift) m.set(d.staffId, d)
    }
    return m
  }, [dutyAssignments, currentDate, selectedShift])

  // Ward coverage for current shift+date
  const wardCoverage = WARDS.map(ward => ({
    ward,
    count: dutyAssignments.filter(d => d.date === currentDate && d.shift === selectedShift && d.ward === ward).length,
  }))

  const criticalUnderstaffed = ['ICU', 'Emergency'].filter(w => {
    const count = wardCoverage.find(wc => wc.ward === w)?.count ?? 0
    return count < 1
  })

  const handleAssign = (staffId: string, ward: string) => {
    if (!canWrite) { toast.error(t('duty.noPermissionAssign')); return }
    assignDuty({ staffId, date: currentDate, shift: selectedShift, ward, assignedBy: actorName }, actorName)
    const member = staff.find(s => s.id === staffId)
    toast.success(t('duty.assignedToast', { name: member?.name ?? staffId, ward, shift: shiftLabel(selectedShift) }))
    setAssignTarget(null)
  }

  const handleClear = (dutyId: string, staffName: string) => {
    if (!canWrite) { toast.error(t('duty.noPermissionClear')); return }
    clearDuty(dutyId, actorName)
    toast.success(t('duty.clearedToast', { name: staffName }))
  }

  const rollFromYesterday = () => {
    if (!canWrite) { toast.error(t('duty.noPermission')); return }
    const yesterday = getDateStr(dateOffset - 1)
    const previous = dutyAssignments.filter(d => d.date === yesterday && d.shift === selectedShift)
    if (previous.length === 0) {
      toast.info(t('duty.noAssignmentsToCopy', { date: formatDate(yesterday) }))
      return
    }
    let copied = 0
    for (const p of previous) {
      // Only copy if not already assigned
      if (!dutyMap.has(p.staffId)) {
        assignDuty({ staffId: p.staffId, date: currentDate, shift: selectedShift, ward: p.ward, assignedBy: actorName, notes: `Rolled from ${yesterday}` }, actorName)
        copied++
      }
    }
    toast.success(t('duty.copiedToast', { copied, total: previous.length, date: formatDate(yesterday) }))
  }

  // AI suggestion: for each unfilled critical ward, pick the best-suited
  // on-shift staff member (dept match → skill match → workload-balanced).
  const suggestedAssignments = useMemo(() => {
    if (!canWrite) return []
    type Suggestion = { staffId: string; staffName: string; ward: string; reason: string }
    const suggestions: Suggestion[] = []
    const usedStaff = new Set(Array.from(dutyMap.keys()))
    for (const ward of WARDS) {
      const haveCount = wardCoverage.find(w => w.ward === ward)?.count ?? 0
      if (haveCount > 0) continue
      // Find on-shift staff for current date with matching role
      const onShiftCandidates = filteredStaff.filter(s => {
        if (usedStaff.has(s.id)) return false
        if (getShift(s.id, currentDate) !== selectedShift) return false
        // Match by ward expertise (department fuzzy match)
        const deptL = s.department.toLowerCase()
        const wardL = ward.toLowerCase()
        return deptL.includes(wardL.split(' ')[0]!) || wardL.includes(deptL.split(' ')[0]!) ||
          (ward === 'ICU' && s.role === 'nurse') ||
          (ward === 'Emergency' && (s.role === 'emergency' || s.role === 'nurse')) ||
          (ward === 'Radiology' && s.role === 'radiology') ||
          (ward === 'Pathology' && s.role === 'lab') ||
          (ward === 'Pharmacy' && s.role === 'pharmacy')
      })
      if (onShiftCandidates.length > 0) {
        const pick = onShiftCandidates[0]!
        suggestions.push({ staffId: pick.id, staffName: pick.name, ward, reason: t('duty.reasonFit', { dept: pick.department, shift: shiftLabel(selectedShift) }) })
        usedStaff.add(pick.id)
        if (suggestions.length >= 5) break
      }
    }
    return suggestions
  }, [canWrite, filteredStaff, currentDate, selectedShift, dutyMap, wardCoverage, getShift, t])

  const shiftCfg = SHIFT_CONFIG[selectedShift]

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-[var(--color-accent)]" />{t('duty.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('duty.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <button onClick={rollFromYesterday}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
              <Copy className="h-3.5 w-3.5" />{t('duty.rollYesterday')}
            </button>
          )}
        </div>
      </div>

      {criticalUnderstaffed.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <p className="text-xs font-bold text-red-700">
            {t('duty.understaffed', { depts: criticalUnderstaffed.join(' & '), shift: shiftLabel(selectedShift), date: formatDate(currentDate) })}
          </p>
        </div>
      )}

      {/* Date nav + shift selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
          <button onClick={() => setDateOffset(d => d - 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <span className="text-sm font-bold text-slate-800 min-w-[130px] text-center">
            {dateOffset === 0 ? t('duty.today') : dateOffset === 1 ? t('duty.tomorrow') : dateOffset === -1 ? t('duty.yesterday') : formatDate(currentDate)}
          </span>
          <span className="text-xs text-slate-400">{formatDate(currentDate)}</span>
          <button onClick={() => setDateOffset(d => d + 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          {SHIFTS.map(s => (
            <button key={s} onClick={() => setSelectedShift(s)}
              data-testid={`duty-shift-${s.toLowerCase()}`}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition',
                selectedShift === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {shiftLabel(s)}
              <span className="ml-1 text-[10px] text-slate-400">{SHIFT_CONFIG[s].time}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-2 bg-white">
            {roles.map(r => <option key={r} value={r}>{r === 'All' ? t('duty.allRoles') : r.replace('_', ' ')}</option>)}
          </Select>
        </div>
      </div>

      {/* Ward coverage strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">{t('duty.wardCoverage', { shift: shiftLabel(selectedShift) })}</p>
        <div className="flex flex-wrap gap-2">
          {wardCoverage.map(wc => (
            <div key={wc.ward} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold',
              wc.count === 0 ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : wc.count < 2 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200')}>
              <span>{wc.ward}</span>
              <span>{wc.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI suggestions */}
      {suggestedAssignments.length > 0 && (
        <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-surface-sunken p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-[var(--color-primary-dark)]">{t('duty.suggestedPairings')}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-accent)] bg-[rgba(238,107,38,0.12)] px-2 py-0.5 rounded">
              {t('duty.candidates', { count: suggestedAssignments.length })}
            </span>
          </div>
          <div className="space-y-2">
            {suggestedAssignments.map(s => (
              <div key={`${s.staffId}-${s.ward}`} className="rounded-lg bg-white border border-[rgba(238,107,38,0.15)] p-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-800">{s.staffName} → {s.ward}</p>
                  <p className="text-[11px] text-slate-500">{s.reason}</p>
                </div>
                <button onClick={() => handleAssign(s.staffId, s.ward)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                  <CheckCircle className="h-3.5 w-3.5" />{t('duty.accept')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff list with on-shift status + duty */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[t('duty.colStaff'), t('duty.colDepartment'), t('duty.colRoster'), t('duty.colDuty'), ''].map((h, hi) => (
                <th key={hi} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStaff.map((member, i) => {
              const Icon = ROLE_ICON[member.role] ?? Activity
              const rosterShift = getShift(member.id, currentDate)
              const duty = dutyMap.get(member.id)
              const cellConflicts = conflictIdx.get(`${member.id}@${currentDate}`) ?? []
              const sev = worstSeverity(cellConflicts)
              return (
                <motion.tr key={member.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                  className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{member.name}</p>
                        <p className="text-[11px] text-slate-400">{member.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{member.department}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded ring-1 border', SHIFT_CONFIG[rosterShift].tint)}>
                      {shiftLabel(rosterShift)}
                    </span>
                    {sev && (
                      <span className={cn('ml-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                        sev === 'critical' ? 'bg-red-100 text-red-700' :
                        sev === 'warning'  ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500')}
                        title={cellConflicts.map(c => c.message).join('\n')}>
                        ! {cellConflicts.length}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {duty ? (
                      <div className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded', WARD_TINT[duty.ward] ?? 'bg-slate-100 text-slate-700')}>
                          {duty.ward}
                        </span>
                        {duty.notes && <span className="text-[11px] text-slate-400 italic">· {duty.notes}</span>}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">{t('duty.unassigned')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      duty ? (
                        <button onClick={() => handleClear(duty.id, member.name)}
                          className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer">{t('duty.clear')}</button>
                      ) : rosterShift !== 'Off' ? (
                        <button onClick={() => { setAssignTarget({ staffId: member.id, staffName: member.name }); setSelectedWard('General Ward') }}
                          className="text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer">{t('duty.assign')}</button>
                      ) : (
                        <span className="text-[11px] text-slate-300 italic">{t('duty.off')}</span>
                      )
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        {t('duty.footer', { staff: filteredStaff.length, duties: dutyMap.size, shift: shiftLabel(selectedShift) })}
      </p>

      {/* Assign duty modal */}
      {assignTarget && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAssignTarget(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-slate-900 mb-1">{t('duty.assignModalTitle', { name: assignTarget.staffName })}</h3>
            <p className="text-xs text-slate-500 mb-4">{shiftLabel(selectedShift)} · {formatDate(currentDate)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">{t('duty.wardLabel')}</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {WARDS.map(w => (
                <button key={w} onClick={() => setSelectedWard(w)}
                  className={cn('text-[11px] font-bold px-2 py-2 rounded-lg border cursor-pointer transition',
                    selectedWard === w ? 'bg-[var(--color-primary)] text-white border-primary' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50')}>
                  {w}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignTarget(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">{t('duty.cancel')}</button>
              <button onClick={() => handleAssign(assignTarget.staffId, selectedWard)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                <CheckCircle className="h-3.5 w-3.5" />{t('duty.assign')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
