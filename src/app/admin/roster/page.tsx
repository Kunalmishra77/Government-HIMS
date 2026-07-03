"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Users, AlertTriangle, ChevronLeft, ChevronRight, Calendar, Sparkles,
  CheckCircle, X, Filter, Eye, EyeOff,
} from "lucide-react"
import { useHRStore, type ShiftType } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { detectAllConflicts, indexConflictsByCell, worstSeverity } from "@/lib/shiftConflicts"
import { ShiftTemplateModal } from "@/components/admin/ShiftTemplateModal"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const SHIFTS: ShiftType[] = ['Morning', 'Evening', 'Night', 'Off']

const SHIFT_COLOR: Record<ShiftType, string> = {
  Morning: 'bg-amber-100 text-amber-800 border-amber-300',
  Evening: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)] border-[rgba(238,107,38,0.30)]',
  Night:   'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)] border-[rgba(238,107,38,0.30)]',
  Off:     'bg-slate-50 text-slate-400 border-slate-200',
}

const SHIFT_DOT: Record<ShiftType, string> = {
  Morning: 'bg-amber-500',
  Evening: 'bg-[rgba(238,107,38,0.07)]0',
  Night:   'bg-[var(--color-primary)]',
  Off:     'bg-slate-200',
}

const SEVERITY_RING: Record<string, string> = {
  critical: 'ring-2 ring-red-400',
  warning:  'ring-2 ring-amber-400',
  info:     'ring-1 ring-slate-300',
}

const CRITICAL_DEPTS = ['ICU', 'Emergency Room', 'Cardiac Care']

function getDateStr(offsetDays: number): string {
  const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toISOString().split('T')[0]!
}
function formatDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatDayShort(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
}
function formatDayNum(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric' })
}

export default function RosterPage() {
  const t = useTranslations('admin')
  const shiftLabel = (s: string) => t.has(`roster.shift.${s}`) ? t(`roster.shift.${s}`) : s
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const leaveRequests = useHRStore(s => s.leaveRequests)
  const dutyAssignments = useHRStore(s => s.dutyAssignments)
  const updateShift = useHRStore(s => s.updateShift)
  const approveLeave = useHRStore(s => s.approveLeave)
  const rejectLeave = useHRStore(s => s.rejectLeave)
  const getShift = useHRStore(s => s.getShift)

  const [weekOffset, setWeekOffset] = useState(0)
  const [weeksToShow, setWeeksToShow] = useState<2 | 4>(2)
  const [deptFilter, setDeptFilter] = useState('All')
  const [editCell, setEditCell] = useState<{ staffId: string; date: string } | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showConflicts, setShowConflicts] = useState(true)
  const [templateOpen, setTemplateOpen] = useState(false)

  const canWrite = canDo(currentUser?.role, 'hr.shift.write')
  const canBulk = canDo(currentUser?.role, 'hr.shift.bulk')
  const actorName = currentUser?.name ?? 'Administrator'

  const departments = useMemo(() => ['All', ...Array.from(new Set(staff.map(s => s.department))).sort()], [staff])
  const filteredStaff = useMemo(() =>
    staff
      .filter(s => s.status === 'active' || s.status === 'on_leave')
      .filter(s => deptFilter === 'All' || s.department === deptFilter),
    [staff, deptFilter])

  const startOffset = weekOffset * 7 - 3
  const dateRange = useMemo(() =>
    Array.from({ length: weeksToShow * 7 }, (_, i) => getDateStr(startOffset + i)),
    [startOffset, weeksToShow])

  // Conflicts
  const conflicts = useMemo(() =>
    detectAllConflicts({ shifts, leaves: leaveRequests, duties: dutyAssignments }),
    [shifts, leaveRequests, dutyAssignments])
  const conflictIdx = useMemo(() => indexConflictsByCell(conflicts), [conflicts])

  // Per-date coverage strip
  const shiftCoverage = useMemo(() => dateRange.map(date => {
    const alerts: string[] = []
    for (const dept of CRITICAL_DEPTS) {
      const onDuty = filteredStaff.filter(s => s.department === dept && getShift(s.id, date) !== 'Off').length
      const min = dept === 'ICU' ? 2 : 2
      if (onDuty < min) alerts.push(`${dept} ${onDuty}/${min}`)
    }
    const totalActive = filteredStaff.filter(s => getShift(s.id, date) !== 'Off').length
    return { date, alerts, totalActive }
  }), [dateRange, filteredStaff, getShift])

  const pendingLeave = leaveRequests.filter(l => l.status === 'Pending')

  // ── Actions ──────────────────────────────────────────────────────────
  const toggleRow = (id: string) => {
    setSelectedRows(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleAllRows = () => {
    if (selectedRows.size === filteredStaff.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(filteredStaff.map(s => s.id)))
  }

  const handleCellChange = (staffId: string, date: string, shift: ShiftType) => {
    if (!canWrite) { toast.error(t('roster.noPermissionEdit')); setEditCell(null); return }
    updateShift(staffId, date, shift, actorName)
    const staff = filteredStaff.find(s => s.id === staffId)
    if (staff) {
      notifyAndAudit({
        to: 'admin', type: 'system', priority: 'low',
        title: t('roster.shiftUpdatedTitle', { name: staff.name }),
        body: t('roster.shiftUpdatedBody', { name: staff.name, role: staff.role, dept: staff.department, date, shift: shiftLabel(shift), actor: actorName }),
        audit: { action: 'hr_shift_set', resource: 'roster', resourceId: `${staffId}:${date}`, detail: `Shift ${date} → ${shift}`, userName: actorName },
      })
    }
    setEditCell(null)
  }

  // ── Render ───────────────────────────────────────────────────────────
  const conflictsSummary = useMemo(() => ({
    critical: conflicts.filter(c => c.severity === 'critical').length,
    warning:  conflicts.filter(c => c.severity === 'warning').length,
    info:     conflicts.filter(c => c.severity === 'info').length,
  }), [conflicts])

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[var(--color-accent)]" />{t('roster.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('roster.subtitle', { staff: filteredStaff.length, days: weeksToShow * 7 })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {pendingLeave.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" />{t('roster.leavePending', { count: pendingLeave.length })}
            </span>
          )}
          {canBulk && (
            <button onClick={() => setTemplateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
              <Sparkles className="h-3.5 w-3.5" />{t('roster.applyPattern')}
              {selectedRows.size > 0 && <span className="text-[10px] bg-white/30 px-1 rounded">{selectedRows.size}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Conflict summary strip */}
      {(conflictsSummary.critical > 0 || conflictsSummary.warning > 0) && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('roster.conflictsInWindow')}</span>
          {conflictsSummary.critical > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />{t('roster.criticalCount', { count: conflictsSummary.critical })}
            </span>
          )}
          {conflictsSummary.warning > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {t('roster.warningCount', { count: conflictsSummary.warning })}
            </span>
          )}
          <button onClick={() => setShowConflicts(v => !v)}
            className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)] hover:underline cursor-pointer">
            {showConflicts ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showConflicts ? t('roster.hideMarkers') : t('roster.showMarkers')}
          </button>
        </div>
      )}

      {/* Pending leave requests */}
      {pendingLeave.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-2">{t('roster.pendingLeaveRequests')}</h3>
          <div className="space-y-2">
            {pendingLeave.map(leave => (
              <div key={leave.id} className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-lg border border-amber-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{leave.staffName}</p>
                  <p className="text-[11px] text-slate-500">
                    {leave.department} · {formatDate(leave.fromDate)} → {formatDate(leave.toDate)} · {leave.reason}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => {
                      approveLeave(leave.id, actorName)
                      notifyAndAudit({
                        to: 'admin', type: 'system', priority: 'low',
                        title: t('roster.leaveApprovedTitle', { name: leave.staffName }),
                        body: t('roster.leaveApprovedBody', { name: leave.staffName, from: leave.fromDate, to: leave.toDate, reason: leave.reason }),
                        audit: { action: 'hr_leave_approved', resource: 'leave_request', resourceId: leave.id, detail: `Approved leave for ${leave.staffName}`, userName: actorName },
                      })
                      toast.success(t('roster.leaveApprovedToast', { name: leave.staffName }))
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer">
                    <CheckCircle className="h-3 w-3" />{t('roster.approve')}
                  </button>
                  <button onClick={() => {
                      rejectLeave(leave.id, actorName)
                      notifyAndAudit({
                        to: 'admin', type: 'system', priority: 'low',
                        title: t('roster.leaveRejectedTitle', { name: leave.staffName }),
                        body: t('roster.leaveRejectedBody', { name: leave.staffName, from: leave.fromDate, to: leave.toDate }),
                        audit: { action: 'hr_leave_rejected', resource: 'leave_request', resourceId: leave.id, detail: `Rejected leave for ${leave.staffName}`, userName: actorName },
                      })
                      toast.success(t('roster.leaveRejectedToast', { name: leave.staffName }))
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold cursor-pointer">
                    <X className="h-3 w-3" />{t('roster.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
            {weekOffset === 0 ? t('roster.thisWeek') : weekOffset > 0 ? t('roster.weekAhead', { n: weekOffset }) : t('roster.weekBehind', { n: weekOffset })}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
          {[2, 4].map(n => (
            <button key={n} onClick={() => setWeeksToShow(n as 2 | 4)}
              data-testid={`roster-weeks-${n}`}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer',
                weeksToShow === n ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {t('roster.weeksLabel', { n })}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs font-bold border border-slate-300 rounded-xl px-2 py-1.5 bg-white">
            {departments.map(d => <option key={d} value={d}>{d === 'All' ? t('roster.allDepts') : d}</option>)}
          </Select>
        </div>
      </div>

      {/* Roster grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: weeksToShow === 4 ? 1400 : 900 }}>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="px-3 py-2 w-8 text-left">
                <input type="checkbox"
                  checked={filteredStaff.length > 0 && selectedRows.size === filteredStaff.length}
                  onChange={toggleAllRows}
                  className="cursor-pointer" />
              </th>
              <th className="text-left px-2 py-2 font-bold text-slate-600 sticky left-0 bg-slate-50/60 z-10 min-w-[170px]">{t('roster.colStaff')}</th>
              {dateRange.map(date => {
                const isToday = date === getDateStr(0)
                const cov = shiftCoverage.find(c => c.date === date)
                const hasAlert = (cov?.alerts.length ?? 0) > 0
                return (
                  <th key={date} className={cn('text-center px-1.5 py-2 font-bold text-slate-600',
                    isToday && 'bg-[rgba(238,107,38,0.07)]',
                    hasAlert && 'bg-red-50/30')}>
                    <div className={cn('text-[10px]', isToday ? 'text-[var(--color-accent)] font-extrabold' : 'text-slate-500')}>
                      {formatDayShort(date)}
                    </div>
                    <div className={cn('text-xs', isToday ? 'text-[var(--color-accent)]' : 'text-slate-700')}>{formatDayNum(date)}</div>
                    {hasAlert && (
                      <AlertTriangle className="h-3 w-3 text-red-500 mx-auto mt-0.5"
                        aria-label={cov?.alerts.join(' · ')} />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member, rowIdx) => (
              <motion.tr key={member.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: rowIdx * 0.01 }}
                className={cn('border-b border-slate-100 last:border-0 hover:bg-slate-50/50',
                  selectedRows.has(member.id) && 'bg-[rgba(238,107,38,0.07)]/30')}>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selectedRows.has(member.id)} onChange={() => toggleRow(member.id)}
                    className="cursor-pointer" />
                </td>
                <td className="px-2 py-2 sticky left-0 bg-white z-10">
                  <p className="text-[12.5px] font-bold text-slate-800 truncate">{member.name}</p>
                  <p className="text-[10.5px] text-slate-400">{member.role} · {member.department}</p>
                </td>
                {dateRange.map(date => {
                  const shift = getShift(member.id, date)
                  const isEditing = editCell?.staffId === member.id && editCell?.date === date
                  const isToday = date === getDateStr(0)
                  const cellConflicts = conflictIdx.get(`${member.id}@${date}`) ?? []
                  const sev = worstSeverity(cellConflicts)
                  return (
                    <td key={date} className={cn('px-1 py-1.5 text-center', isToday && 'bg-[rgba(238,107,38,0.07)]/40')}>
                      {isEditing ? (
                        <Select value={shift} autoFocus
                          onBlur={() => setEditCell(null)}
                          onChange={e => handleCellChange(member.id, date, e.target.value as ShiftType)}
                          className="text-[11px] rounded-lg border border-primary px-1 py-1 focus:outline-none bg-white">
                          {SHIFTS.map(s => <option key={s} value={s}>{shiftLabel(s)}</option>)}
                        </Select>
                      ) : (
                        <button onClick={() => canWrite && setEditCell({ staffId: member.id, date })}
                          disabled={!canWrite}
                          title={cellConflicts.length > 0 ? cellConflicts.map(c => c.message).join('\n') : undefined}
                          className={cn('text-[10.5px] font-bold px-2 py-1 rounded-lg border cursor-pointer hover:opacity-80 transition',
                            SHIFT_COLOR[shift],
                            showConflicts && sev && SEVERITY_RING[sev],
                            !canWrite && 'cursor-default')}>
                          {shift === 'Off' ? '—' : shift.slice(0, 3)}
                        </button>
                      )}
                    </td>
                  )
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="font-semibold text-slate-500">{t('roster.shiftsLegend')}</span>
        {SHIFTS.map(s => (
          <div key={s} className="flex items-center gap-1">
            <span className={cn('h-2 w-3 rounded-sm', SHIFT_DOT[s])} />
            <span className="text-[11px] font-semibold text-slate-600">{shiftLabel(s)}</span>
          </div>
        ))}
        <span className="text-slate-300">·</span>
        <span className="text-[11px] text-slate-500">{t('roster.clickToEdit', { critical: conflictsSummary.critical, warning: conflictsSummary.warning })}</span>
      </div>

      <ShiftTemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)}
        preselectedStaffIds={Array.from(selectedRows)} />
    </div>
  )
}
