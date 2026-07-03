"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { CalendarDays, Check, X, Plus } from "lucide-react"
import { useHRStore } from "@/store/useHRStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ANNUAL_ENTITLEMENT = 24
const todayISO = () => new Date().toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1)

export default function HrLeave() {
  const t = useTranslations('hr')
  const staff = useHRStore(s => s.staff)
  const leaveRequests = useHRStore(s => s.leaveRequests)
  const requestLeave = useHRStore(s => s.requestLeave)
  const approveLeave = useHRStore(s => s.approveLeave)
  const rejectLeave = useHRStore(s => s.rejectLeave)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ staffId: '', fromDate: todayISO(), toDate: todayISO(), reason: '' })

  const pending = leaveRequests.filter(l => l.status === 'Pending')
  const onLeaveToday = leaveRequests.filter(l => l.status === 'Approved' && l.fromDate <= todayISO() && l.toDate >= todayISO())
  const usedDays = (staffId: string) => leaveRequests
    .filter(l => l.staffId === staffId && l.status === 'Approved')
    .reduce((n, l) => n + daysBetween(l.fromDate, l.toDate), 0)

  const decide = (id: string, approve: boolean) => {
    const lr = leaveRequests.find(l => l.id === id)
    if (approve) approveLeave(id, 'Anita Rao'); else rejectLeave(id, 'Anita Rao')
    if (lr) {
      const member = staff.find(s => s.id === lr.staffId)
      notifyAndAudit({
        to: (member?.role ?? 'admin'),
        type: 'system', priority: 'medium',
        title: approve ? t('leave.notifyTitleApproved', { name: lr.staffName }) : t('leave.notifyTitleRejected', { name: lr.staffName }),
        body: approve
          ? t('leave.notifyBodyApproved', { from: lr.fromDate, to: lr.toDate })
          : t('leave.notifyBodyRejected', { from: lr.fromDate, to: lr.toDate }),
        patientName: lr.staffName,
        audit: { action: approve ? 'hr_leave_approved' : 'hr_leave_rejected', resource: 'leave', resourceId: id, detail: `Leave ${approve ? 'approved' : 'rejected'} for ${lr.staffName}`, userName: 'Anita Rao' },
      })
    }
    toast.success(approve ? t('leave.decisionApproved') : t('leave.decisionRejected'))
  }

  const submit = () => {
    const member = staff.find(s => s.id === form.staffId)
    if (!member) { toast.error(t('leave.selectEmployeeError')); return }
    requestLeave({ staffId: member.id, staffName: member.name, department: member.department, fromDate: form.fromDate, toDate: form.toDate, reason: form.reason || t('leave.defaultReason') }, 'Anita Rao')
    toast.success(t('leave.appliedToast', { name: member.name }))
    setShowForm(false)
    setForm({ staffId: '', fromDate: todayISO(), toDate: todayISO(), reason: '' })
  }

  const STATUS_STYLE: Record<string, string> = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><CalendarDays className="h-6 w-6 text-amber-600" /> {t('leave.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('leave.subtitle', { pending: pending.length, onLeave: onLeaveToday.length })}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">
          <Plus className="h-4 w-4" /> {t('leave.applyLeave')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('common.employee')}</label>
            <select value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              <option value="">{t('common.select')}</option>
              {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name} · {s.department}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('leave.from')}</label>
            <input type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('leave.to')}</label>
            <input type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div className="flex gap-2">
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('leave.reasonPlaceholder')} className="flex-1 h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            <button onClick={submit} className="h-10 px-4 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">{t('common.submit')}</button>
          </div>
        </div>
      )}

      {/* Requests */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800">{t('leave.leaveRequests')}</h2></div>
        <div className="divide-y divide-slate-50">
          {leaveRequests.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t('leave.noRequests')}</p>}
          {leaveRequests.map(l => {
            const used = usedDays(l.staffId)
            return (
              <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{l.staffName} <span className="text-[11px] font-normal text-slate-400">· {l.department}</span></p>
                  <p className="text-[11px] text-slate-500">{l.fromDate} → {l.toDate} · {daysBetween(l.fromDate, l.toDate)}d · {l.reason}</p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">{t('leave.balance', { remaining: Math.max(0, ANNUAL_ENTITLEMENT - used), total: ANNUAL_ENTITLEMENT })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[l.status])}>{t(`leaveStatus.${l.status}`)}</span>
                  {l.status === 'Pending' && (
                    <>
                      <button onClick={() => decide(l.id, true)} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"><Check className="h-3 w-3" /> {t('common.approve')}</button>
                      <button onClick={() => decide(l.id, false)} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"><X className="h-3 w-3" /> {t('common.reject')}</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
