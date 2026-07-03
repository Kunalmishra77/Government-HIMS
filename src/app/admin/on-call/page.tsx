"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Phone, ChevronLeft, ChevronRight, Sparkles, Calendar, AlertTriangle,
  CheckCircle, Stethoscope, Heart, Activity, FlaskConical, Pill,
} from "lucide-react"
import { useHRStore, type StaffMember } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { SwapRequestModal } from "@/components/admin/SwapRequestModal"
import { useTranslations } from "next-intl"

// On-call rotation is stored locally in component state for Phase 2; will be
// promoted to its own slice in `useHRStore.onCallRotations` in a follow-up.
// For now, we seed a 14-day rotation across critical departments.

type OnCallSlot = {
  date: string
  shift: 'Day' | 'Night'
  department: string
  staffId: string
}

const ON_CALL_DEPTS = [
  { dept: 'Emergency',    icon: Heart,       roles: ['emergency', 'doctor'] },
  { dept: 'Cardiology',   icon: Heart,       roles: ['doctor'] },
  { dept: 'OB-GYN',       icon: Activity,    roles: ['doctor'] },
  { dept: 'Anaesthesia',  icon: Stethoscope, roles: ['ot', 'doctor'] },
  { dept: 'Radiology',    icon: Activity,    roles: ['radiology'] },
  { dept: 'Pathology',    icon: FlaskConical,roles: ['lab'] },
  { dept: 'Pharmacy',     icon: Pill,        roles: ['pharmacy'] },
]

function isoDay(d: Date): string { return d.toISOString().split('T')[0]! }
function dateOffset(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d)
}
function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}
function fmtTime(s: string): string {
  return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function OnCallPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)

  const canWrite = canDo(currentUser?.role, 'hr.duty.write')
  const deptLabel = (d: string) => t.has(`onCall.dept.${d}`) ? t(`onCall.dept.${d}`) : d
  const shiftLabel = (s: string) => t.has(`onCall.shift.${s}`) ? t(`onCall.shift.${s}`) : s

  const [weekOffset, setWeekOffset] = useState(0)
  const [swapOpenFor, setSwapOpenFor] = useState<OnCallSlot | null>(null)

  // Seed a deterministic 14-day rotation
  const allSlots = useMemo<OnCallSlot[]>(() => {
    const out: OnCallSlot[] = []
    for (let dayOffset = -3; dayOffset < 14; dayOffset++) {
      const date = dateOffset(dayOffset)
      for (const { dept, roles } of ON_CALL_DEPTS) {
        const candidates = staff.filter(s => s.status === 'active' && roles.includes(s.role))
        if (candidates.length === 0) continue
        for (const shift of ['Day', 'Night'] as const) {
          // Pseudo-random but deterministic pick
          const seed = (dayOffset + 100) * 7 + (shift === 'Day' ? 1 : 2) + dept.length
          const pick = candidates[seed % candidates.length]!
          out.push({ date, shift, department: dept, staffId: pick.id })
        }
      }
    }
    return out
  }, [staff])

  const dateRange = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => dateOffset(weekOffset * 7 + i)),
    [weekOffset])

  const slotsForWindow = useMemo(() =>
    allSlots.filter(s => dateRange.includes(s.date)),
    [allSlots, dateRange])

  // Live: who's on-call right now?
  const nowOnCall = useMemo(() => {
    const today = dateOffset(0)
    const hour = new Date().getHours()
    const currentShift = hour >= 8 && hour < 20 ? 'Day' : 'Night'
    return allSlots.filter(s => s.date === today && s.shift === currentShift)
  }, [allSlots])

  const getStaffById = (id: string): StaffMember | undefined => staff.find(s => s.id === id)

  const handleEditSlot = (slot: OnCallSlot) => {
    if (!canWrite) { toast.error(t('onCall.noPermission')); return }
    setSwapOpenFor(slot)
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Phone className="h-6 w-6 text-accent" />{t('onCall.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t('onCall.subtitle', { count: ON_CALL_DEPTS.length })}</p>
        </div>
      </div>

      {/* Who's on-call NOW */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary-soft to-amber-50/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-accent animate-pulse" />
          <h3 className="text-sm font-bold text-accent">{t('onCall.liveNow')}</h3>
          <span className="text-[10px] font-bold uppercase tracking-wide text-accent bg-accent-soft px-2 py-0.5 rounded">
            {fmtTime(new Date().toISOString())}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {nowOnCall.length === 0 ? (
            <p className="text-xs text-accent col-span-3 italic">{t('onCall.noAssignments')}</p>
          ) : nowOnCall.map((slot, i) => {
            const member = getStaffById(slot.staffId)
            const Icon = ON_CALL_DEPTS.find(d => d.dept === slot.department)?.icon ?? Phone
            return (
              <motion.div key={`${slot.date}-${slot.department}-${slot.shift}`}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-lg bg-white border border-primary/20 p-3 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{member?.name ?? slot.staffId}</p>
                  <p className="text-[11px] text-slate-500">{deptLabel(slot.department)} · {shiftLabel(slot.shift)}</p>
                </div>
                {member?.phone && (
                  <a href={`tel:${member.phone}`}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer">
                    <Phone className="h-3 w-3" />{t('onCall.call')}
                  </a>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
            {weekOffset === 0 ? t('onCall.thisWeek') : weekOffset > 0 ? t('onCall.weekAhead', { n: weekOffset }) : t('onCall.weekBehind', { n: weekOffset })}
          </span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500">{fmtDate(dateRange[0]!)} → {fmtDate(dateRange[6]!)}</p>
      </div>

      {/* On-call grid: dept × day */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1000 }}>
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 sticky left-0 bg-slate-50 z-10 min-w-[140px]">{t('onCall.department')}</th>
              {dateRange.map(date => {
                const isToday = date === dateOffset(0)
                return (
                  <th key={date} className={cn('text-center px-2 py-3 text-[10px] font-bold uppercase tracking-wide',
                    isToday ? 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]' : 'text-slate-500')}>
                    <div>{fmtDate(date).split(',')[0]}</div>
                    <div className="text-[9px] text-slate-400">{fmtDate(date).split(',')[1]}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ON_CALL_DEPTS.map(({ dept, icon: Icon }) => (
              <tr key={dept} className="hover:bg-slate-50">
                <td className="px-4 py-3 sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold text-slate-800">{deptLabel(dept)}</span>
                  </div>
                </td>
                {dateRange.map(date => {
                  const day = slotsForWindow.find(s => s.date === date && s.department === dept && s.shift === 'Day')
                  const night = slotsForWindow.find(s => s.date === date && s.department === dept && s.shift === 'Night')
                  const dayMember = day ? getStaffById(day.staffId) : undefined
                  const nightMember = night ? getStaffById(night.staffId) : undefined
                  return (
                    <td key={date} className="px-2 py-2 text-center">
                      <div className="space-y-1">
                        {dayMember ? (
                          <button onClick={() => day && handleEditSlot(day)}
                            className="block w-full text-[10px] font-bold px-1.5 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer truncate"
                            title={t('onCall.dayTooltip', { name: dayMember.name, role: dayMember.role })}>
                            ☀ {dayMember.name.replace('Dr. ', '').split(' ')[0]}
                          </button>
                        ) : (
                          <span className="block text-[10px] text-slate-300 italic">—</span>
                        )}
                        {nightMember ? (
                          <button onClick={() => night && handleEditSlot(night)}
                            className="block w-full text-[10px] font-bold px-1.5 py-1 rounded bg-[rgba(238,107,38,0.07)] text-[var(--color-primary-dark)] hover:bg-[rgba(238,107,38,0.14)] cursor-pointer truncate"
                            title={t('onCall.nightTooltip', { name: nightMember.name, role: nightMember.role })}>
                            ☾ {nightMember.name.replace('Dr. ', '').split(' ')[0]}
                          </button>
                        ) : (
                          <span className="block text-[10px] text-slate-300 italic">—</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="font-semibold text-slate-500">{t('onCall.shifts')}</span>
        <div className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-amber-400" />
          <span className="text-[11px] font-semibold text-slate-600">{t('onCall.dayLegend')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-[var(--color-primary)]" />
          <span className="text-[11px] font-semibold text-slate-600">{t('onCall.nightLegend')}</span>
        </div>
        <span className="text-slate-300">·</span>
        <span className="text-[11px] text-slate-500">{t('onCall.legendNote')}</span>
      </div>

      <SwapRequestModal
        open={!!swapOpenFor}
        onClose={() => setSwapOpenFor(null)}
        defaults={swapOpenFor ? {
          requesterId: swapOpenFor.staffId,
          requesterDate: swapOpenFor.date,
          requesterShift: swapOpenFor.shift === 'Day' ? 'Morning' : 'Night',
        } : undefined}
      />
    </div>
  )
}
