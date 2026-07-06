"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Save, ShieldOff, UserCheck, AlertTriangle, Calendar,
  Activity, Mail, Phone, BadgeCheck, Briefcase, IndianRupee,
} from "lucide-react"
import { useHRStore, BRANCH_LABEL, type StaffMember, type ShiftType } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useAuditStore, moduleOf, severityOf } from "@/store/useAuditStore"
import { useDoctorStatsStore } from "@/store/useDoctorStatsStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"

type Tab = 'profile' | 'schedule' | 'credentials' | 'activity' | 'audit'

const STATUS_TINT: Record<StaffMember['status'], string> = {
  active:      'bg-emerald-100 text-emerald-700 ring-emerald-200',
  on_leave:    'bg-amber-100 text-amber-700 ring-amber-200',
  suspended:   'bg-red-100 text-red-700 ring-red-200',
  terminated:  'bg-slate-300 text-slate-700 ring-slate-400',
  inactive:    'bg-slate-100 text-slate-500 ring-slate-200',
}

const SHIFT_DOT: Record<ShiftType, string> = {
  Morning: 'bg-amber-500',
  Evening: 'bg-[rgba(238,107,38,0.07)]0',
  Night:   'bg-[var(--color-primary)]',
  Off:     'bg-slate-200',
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDate = (s: string) => new Date(s + (s.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const today = () => new Date().toISOString().split('T')[0]!
const daysUntil = (date: string) => Math.round((new Date(date + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()) / 86400000)

export interface StaffProfileDrawerProps {
  staffId: string | null
  onClose: () => void
}

export function StaffProfileDrawer({ staffId, onClose }: StaffProfileDrawerProps) {
  const currentUser  = useAuthStore(s => s.currentUser)
  const staff        = useHRStore(s => s.staff)
  const shifts       = useHRStore(s => s.shifts)
  const dutyAssignments = useHRStore(s => s.dutyAssignments)
  const leaveRequests = useHRStore(s => s.leaveRequests)
  const updateStaff  = useHRStore(s => s.updateStaff)
  const deactivateStaff = useHRStore(s => s.deactivateStaff)
  const reactivateStaff = useHRStore(s => s.reactivateStaff)
  const terminateStaff = useHRStore(s => s.terminateStaff)
  const removeCredential = useHRStore(s => s.removeCredential)

  const auditEntries = useAuditStore(s => s.entries)
  const totalsFor = useDoctorStatsStore(s => s.totalsFor)

  const member = useMemo(() => staff.find(s => s.id === staffId), [staff, staffId])
  const [tab, setTab] = useState<Tab>('profile')
  const [edit, setEdit] = useState<Partial<StaffMember>>({})

  // All hooks must run on every render — early return goes BELOW all hook calls.
  const memberId = member?.id ?? ''
  const memberName = member?.name ?? ''

  const upcomingShifts = useMemo(() => {
    if (!memberId) return []
    const t = today()
    return shifts
      .filter(s => s.staffId === memberId && s.date >= t)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 14)
  }, [shifts, memberId])

  const upcomingDuty = useMemo(() => {
    if (!memberId) return []
    return dutyAssignments
      .filter(d => d.staffId === memberId && d.date >= today())
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [dutyAssignments, memberId])

  const memberLeave = useMemo(() => {
    if (!memberId) return []
    return leaveRequests
      .filter(l => l.staffId === memberId)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
  }, [leaveRequests, memberId])

  const auditTrail = useMemo(() => {
    if (!memberId) return []
    return auditEntries
      .filter(e =>
        e.userId === memberId ||
        e.detail?.includes(memberName) ||
        e.detail?.includes(memberId))
      .slice(0, 30)
  }, [auditEntries, memberId, memberName])

  const doctorStats = member && (member.role === 'doctor' || member.role === 'emergency' || member.role === 'ot' || member.role === 'radiology')
    ? totalsFor(member.id, 'month')
    : null

  if (!member) return null

  const actorName = currentUser?.name ?? 'Administrator'
  const { confirm, prompt, view: dialogView } = useDialogs()

  // ── Actions ──────────────────────────────────────────────────────────
  const handleSave = () => {
    if (Object.keys(edit).length === 0) { toast.info('No changes to save'); return }
    updateStaff(member.id, edit, actorName)
    setEdit({})
    toast.success(`${member.name} updated`)
  }

  const handleDeactivate = async () => {
    const values = await prompt({
      title: `Deactivate ${member.name}?`,
      body: 'Staff member loses portal access. Re-activation requires admin sign-off.',
      tone: 'warn',
      confirmLabel: 'Deactivate',
      fields: [
        { id: 'reason', label: 'Reason', type: 'textarea',
          defaultValue: 'Temporary leave', required: true },
      ],
    })
    if (!values) return
    deactivateStaff(member.id, values.reason, actorName)
    toast.success(`${member.name} deactivated`)
  }

  const handleReactivate = () => {
    reactivateStaff(member.id, actorName)
    toast.success(`${member.name} reactivated`)
  }

  const handleTerminate = async () => {
    const values = await prompt({
      title: `Terminate ${member.name}?`,
      body: 'PERMANENT action — staff status changes to terminated and the audit trail records the reason.',
      tone: 'danger',
      confirmLabel: 'Terminate',
      fields: [
        { id: 'reason', label: 'Reason for termination', type: 'textarea',
          placeholder: 'e.g. End of contract, performance issue, retirement', required: true },
      ],
    })
    if (!values) return
    terminateStaff(member.id, values.reason, actorName)
    toast.success(`${member.name} terminated`)
    onClose()
  }

  // ── Render ────────────────────────────────────────────────────────────
  const initials = member.name.replace('Dr. ', '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <AnimatePresence>
      {member && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[640px] bg-white shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-label={`Staff profile · ${member.name}`}
          >
            {/* Header */}
            <div className="flex items-start gap-4 p-5 border-b border-slate-100">
              <span className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center text-base font-bold flex-shrink-0">
                {initials}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 truncate">{member.name}</p>
                <p className="text-[12.5px] text-slate-500 mt-0.5">
                  {member.designation} · {member.department}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded ring-1', STATUS_TINT[member.status])}>
                    {member.status.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{member.id}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{member.employeeId}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{member.contractType}</span>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer flex-shrink-0">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-100 bg-slate-50/40 overflow-x-auto">
              {(['profile', 'schedule', 'credentials', 'activity', 'audit'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('text-xs font-bold px-3 py-1.5 rounded-lg capitalize whitespace-nowrap cursor-pointer transition',
                    tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {t}
                  {t === 'credentials' && member.credentials.length > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">{member.credentials.length}</span>
                  )}
                  {t === 'audit' && auditTrail.length > 0 && (
                    <span className="ml-1 text-[10px] text-slate-400">{auditTrail.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {tab === 'profile' && (
                <>
                  <Section title="Contact">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Email" icon={Mail}>
                        <input value={(edit.email ?? member.email)} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className={INPUT} />
                      </Field>
                      <Field label="Phone" icon={Phone}>
                        <input value={(edit.phone ?? member.phone)} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className={INPUT} />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Role & Department">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Designation" icon={Briefcase}>
                        <input value={(edit.designation ?? member.designation)} onChange={(e) => setEdit({ ...edit, designation: e.target.value })} className={INPUT} />
                      </Field>
                      <Field label="Department" icon={Briefcase}>
                        <input value={(edit.department ?? member.department)} onChange={(e) => setEdit({ ...edit, department: e.target.value })} className={INPUT} />
                      </Field>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Field label="Joining date" icon={Calendar}>
                        <p className="text-sm font-bold text-slate-800">{fmtDate(member.joiningDate)}</p>
                      </Field>
                      <Field label="Branch" icon={Briefcase}>
                        <p className="text-sm font-bold text-slate-800">{BRANCH_LABEL[member.branchId]}</p>
                      </Field>
                    </div>
                  </Section>

                  <Section title="Compensation">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Monthly rate (₹)" icon={IndianRupee}>
                        <input type="number" value={(edit.monthlyRate ?? member.monthlyRate ?? 0)}
                          onChange={(e) => setEdit({ ...edit, monthlyRate: Number(e.target.value) })} className={INPUT} />
                      </Field>
                      <Field label="OT rate (₹/hr)" icon={IndianRupee}>
                        <input type="number" value={(edit.hourlyOTRate ?? member.hourlyOTRate ?? 0)}
                          onChange={(e) => setEdit({ ...edit, hourlyOTRate: Number(e.target.value) })} className={INPUT} />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Notes">
                    <textarea
                      value={(edit.notes ?? member.notes ?? '')}
                      onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                      rows={3}
                      placeholder="Internal HR notes…"
                      className={cn(INPUT, 'h-auto py-2')}
                    />
                  </Section>
                </>
              )}

              {tab === 'schedule' && (
                <>
                  <Section title={`Next 14 days · ${upcomingShifts.length} shifts`}>
                    {upcomingShifts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No upcoming shifts on record.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {upcomingShifts.map(s => (
                          <div key={`${s.staffId}-${s.date}`} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                            <span className={cn('h-2 w-2 rounded-full', SHIFT_DOT[s.shift])} />
                            <span className="w-28 text-slate-500 font-semibold">{fmtDate(s.date)}</span>
                            <span className="font-bold text-slate-800">{s.shift}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>

                  {upcomingDuty.length > 0 && (
                    <Section title={`Duty assignments · ${upcomingDuty.length}`}>
                      <div className="space-y-1.5">
                        {upcomingDuty.map(d => (
                          <div key={d.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs">
                            <p className="font-bold text-slate-800">{fmtDate(d.date)} · {d.shift}</p>
                            <p className="text-[11px] text-slate-500">{d.ward}{d.notes ? ` · ${d.notes}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {memberLeave.length > 0 && (
                    <Section title={`Leave history · ${memberLeave.length}`}>
                      <div className="space-y-1.5">
                        {memberLeave.map(l => (
                          <div key={l.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs">
                            <p className="font-bold text-slate-800">
                              {fmtDate(l.fromDate)} → {fmtDate(l.toDate)}
                              <span className={cn('ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                l.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                l.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                                {l.status}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500">{l.reason}</p>
                            {l.decidedBy && <p className="text-[10px] text-slate-400 mt-0.5">{l.status} by {l.decidedBy} · {l.decidedAt ? fmt(l.decidedAt) : ''}</p>}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}

              {tab === 'credentials' && (
                <>
                  {member.credentials.length === 0 ? (
                    <div className="text-center py-10">
                      <BadgeCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-500">No credentials on record</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {member.credentials.map(c => {
                        const d = daysUntil(c.expiryDate)
                        const isLifetime = c.expiryDate.startsWith('2099')
                        const expired = !isLifetime && d < 0
                        const expiringSoon = !isLifetime && d >= 0 && d <= 90
                        return (
                          <div key={c.id} className={cn('rounded-xl border p-3',
                            expired ? 'border-red-200 bg-red-50/30'
                            : expiringSoon ? 'border-amber-200 bg-amber-50/30'
                            : 'border-slate-200')}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                                  {c.label}
                                  <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{c.type}</span>
                                  {expired && <span className="text-[10px] font-bold uppercase bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Expired</span>}
                                  {expiringSoon && <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Expiring</span>}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Reg. {c.number}</p>
                                <p className="text-[11px] text-slate-500">
                                  Issued {fmtDate(c.issuedDate)} · Expires {isLifetime ? 'Lifetime' : fmtDate(c.expiryDate)}
                                  {!isLifetime && (
                                    <span className={cn('ml-2 font-bold',
                                      expired ? 'text-red-700' : expiringSoon ? 'text-amber-700' : 'text-slate-500')}>
                                      ({d >= 0 ? `${d}d left` : `${Math.abs(d)}d overdue`})
                                    </span>
                                  )}
                                </p>
                              </div>
                              <button onClick={async () => {
                                const ok = await confirm({
                                  title: `Remove "${c.label}"?`,
                                  body: `Credential will be deleted from ${member.name}'s profile. Audited.`,
                                  tone: 'danger',
                                  confirmLabel: 'Remove',
                                })
                                if (ok) {
                                  removeCredential(member.id, c.id, actorName)
                                  toast.success(`Credential removed`)
                                }
                              }} className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer flex-shrink-0">
                                Remove
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {tab === 'activity' && (
                <>
                  {doctorStats ? (
                    <Section title="This month — clinical activity">
                      <div className="grid grid-cols-2 gap-3">
                        <Stat label="Consults" value={doctorStats.consults} icon={Activity} />
                        <Stat label="In-person" value={doctorStats.opd} icon={Activity} />
                        <Stat label="Online" value={doctorStats.online} icon={Activity} />
                        <Stat label="Tests ordered" value={doctorStats.tests} icon={Activity} />
                        <Stat label="Prescriptions" value={doctorStats.prescriptions} icon={Activity} />
                        <Stat label="Admissions" value={doctorStats.admissions} icon={Activity} />
                      </div>
                    </Section>
                  ) : (
                    <Section title="Activity">
                      <p className="text-xs text-slate-400 italic">
                        Detailed activity stats are available for clinical roles.
                      </p>
                      {member.lastLoginAt && (
                        <p className="text-xs text-slate-600 mt-2">
                          Last login: <b>{fmt(member.lastLoginAt)}</b>
                        </p>
                      )}
                    </Section>
                  )}
                </>
              )}

              {tab === 'audit' && (
                <Section title="Audit trail — entries mentioning this staff member">
                  {auditTrail.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No audit entries on record.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {auditTrail.map(e => {
                        const sev = severityOf(e.action)
                        return (
                          <div key={e.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800">{e.action.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{moduleOf(e.action)}</span>
                              {sev !== 'info' && (
                                <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                  sev === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{sev}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">{e.detail ?? e.resource}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{e.userName} · {fmt(e.timestamp)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Section>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 flex-wrap bg-slate-50/30">
              {tab === 'profile' && (
                <button onClick={handleSave}
                  disabled={Object.keys(edit).length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save className="h-3.5 w-3.5" />Save changes
                </button>
              )}
              {member.status !== 'terminated' && (
                <>
                  {member.status === 'active' ? (
                    <button onClick={handleDeactivate}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 cursor-pointer ml-auto">
                      <ShieldOff className="h-3.5 w-3.5" />Deactivate
                    </button>
                  ) : (
                    <button onClick={handleReactivate}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer ml-auto">
                      <UserCheck className="h-3.5 w-3.5" />Reactivate
                    </button>
                  )}
                  <button onClick={handleTerminate}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer">
                    <AlertTriangle className="h-3.5 w-3.5" />Terminate
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
      {dialogView}
    </AnimatePresence>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────
const INPUT = 'w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" />{label}
      </p>
      {children}
    </div>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-black text-slate-900 mt-1 tabular-nums">{value.toLocaleString('en-IN')}</p>
    </div>
  )
}
