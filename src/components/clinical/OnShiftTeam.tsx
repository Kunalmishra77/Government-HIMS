"use client"

import { useMemo } from "react"
import { Phone, Mail, Users, ShieldAlert, Stethoscope, Activity, Heart, FlaskConical, Pill, Microscope, Truck, Beaker } from "lucide-react"
import { useHRStore, type ShiftType, type StaffMember } from "@/store/useHRStore"
import { cn } from "@/lib/utils"
import type { Role } from "@/types/roles"

// ─────────────────────────────────────────────────────────────────────────
// Reusable "Who's on-shift right now" widget. Used by:
//   • Nurse dashboard (M4.2)
//   • Bed manager admission picker (M4.3)
//   • ER dashboard (M4.4)
//   • OT scheduling (M4.5)
//
// Picks staff who are:
//   1. status=active
//   2. department matches (loose: ward-name fuzzy match)
//   3. either (a) rostered to the given shift on the given date, or
//             (b) have a duty assignment to that ward+shift
//   4. (optional) role matches the requested role filter
// ─────────────────────────────────────────────────────────────────────────

export interface OnShiftTeamProps {
  /** Ward / department / unit to filter by. Matches StaffMember.department loosely. */
  department: string
  date: string                  // YYYY-MM-DD
  shift: ShiftType
  /** Restrict to specific roles (e.g., ['doctor', 'nurse'] for ICU). */
  roles?: Role[]
  /** Compact UI variant. Default false. */
  compact?: boolean
  /** Click handler for individual staff. */
  onClickMember?: (staff: StaffMember) => void
  /** Empty-state message. */
  emptyMessage?: string
  /** Header label override. */
  title?: string
}

const ROLE_ICON: Record<string, React.ElementType> = {
  doctor: Stethoscope,
  emergency: Heart,
  nurse: Activity,
  ot: Stethoscope,
  lab: FlaskConical,
  pharmacy: Pill,
  radiology: Microscope,
  ambulance: Truck,
  blood_bank: Beaker,
}

const ROLE_TINT: Record<string, string> = {
  doctor:    'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  emergency: 'bg-red-50 text-red-700',
  nurse:     'bg-emerald-50 text-emerald-700',
  ot:        'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  lab:       'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  pharmacy:  'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  radiology: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
}

function deptMatches(staffDept: string, target: string): boolean {
  const a = staffDept.toLowerCase()
  const b = target.toLowerCase()
  return a === b || a.includes(b) || b.includes(a)
}

export function OnShiftTeam({
  department, date, shift, roles, compact = false, onClickMember, emptyMessage, title,
}: OnShiftTeamProps) {
  const staff = useHRStore(s => s.staff)
  const shifts = useHRStore(s => s.shifts)
  const dutyAssignments = useHRStore(s => s.dutyAssignments)

  const team = useMemo(() => {
    // Find staff rostered to this shift on this date
    const rosteredIds = new Set(
      shifts
        .filter(sh => sh.date === date && sh.shift === shift)
        .map(sh => sh.staffId),
    )
    // Find staff assigned via duty to this ward+shift+date
    const dutyIds = new Set(
      dutyAssignments
        .filter(d => d.date === date && d.shift === shift && deptMatches(d.ward, department))
        .map(d => d.staffId),
    )

    const result: StaffMember[] = []
    for (const s of staff) {
      if (s.status !== 'active') continue
      if (roles && !roles.includes(s.role)) continue
      const onRoster = rosteredIds.has(s.id) && deptMatches(s.department, department)
      const onDuty = dutyIds.has(s.id)
      if (onRoster || onDuty) result.push(s)
    }
    // De-dup & sort: doctors first, then nurses, then others
    const seen = new Set<string>()
    const ordered = result
      .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
      .sort((a, b) => {
        const roleOrder = (r: Role) => (
          r === 'doctor' || r === 'emergency' || r === 'ot' ? 0 :
          r === 'nurse' ? 1 :
          r === 'radiology' || r === 'lab' || r === 'pharmacy' ? 2 : 3
        )
        const d = roleOrder(a.role) - roleOrder(b.role)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      })
    return ordered
  }, [staff, shifts, dutyAssignments, department, date, shift, roles])

  const header = title ?? `${department} · on shift · ${shift}`

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
          <Users className="h-3 w-3" />{header}
        </p>
        <span className="text-[10px] font-bold text-slate-400">{team.length}</span>
      </div>

      {team.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{emptyMessage ?? 'No staff currently on shift for this department.'}</p>
        </div>
      ) : (
        <div className={cn(compact ? 'flex flex-wrap gap-1.5' : 'space-y-1.5')}>
          {team.map(member => {
            const Icon = ROLE_ICON[member.role] ?? Users
            const roleTint = ROLE_TINT[member.role] ?? 'bg-slate-100 text-slate-700'
            const initials = member.name.replace('Dr. ', '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            if (compact) {
              return (
                <button key={member.id}
                  onClick={() => onClickMember?.(member)}
                  disabled={!onClickMember}
                  title={`${member.name} · ${member.designation}`}
                  className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold cursor-pointer hover:bg-slate-50 transition',
                    !onClickMember && 'cursor-default')}>
                  <span className={cn('text-[9px] font-bold uppercase px-1 py-0.5 rounded', roleTint)}>{member.role.replace('_', ' ')}</span>
                  <span className="text-slate-800 truncate max-w-[120px]">{member.name}</span>
                </button>
              )
            }
            return (
              <button key={member.id}
                onClick={() => onClickMember?.(member)}
                disabled={!onClickMember}
                className={cn('w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition',
                  !onClickMember && 'cursor-default')}>
                <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                  {initials}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <Icon className="h-3 w-3 text-slate-400 flex-shrink-0" />
                    {member.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{member.designation} · {member.department}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {member.phone && (
                    <a href={`tel:${member.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      title={`Call ${member.phone}`}
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer">
                      <Phone className="h-3 w-3" />
                    </a>
                  )}
                  {member.email && (
                    <a href={`mailto:${member.email}`}
                      onClick={(e) => e.stopPropagation()}
                      title={`Email ${member.email}`}
                      className="p-1.5 rounded-lg bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.14)] cursor-pointer">
                      <Mail className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
