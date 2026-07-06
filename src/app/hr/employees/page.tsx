"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Search, UserPlus, Users } from "lucide-react"
import { useHRStore, type StaffStatus } from "@/store/useHRStore"
import { StaffProfileDrawer } from "@/components/admin/StaffProfileDrawer"
import { AddStaffWizard } from "@/components/admin/AddStaffWizard"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<StaffStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  on_leave: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-primary-soft text-accent border-primary/20',
  terminated: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-50 text-slate-500 border-slate-200',
}

export default function HrEmployees() {
  const t = useTranslations('hr')
  const staff = useHRStore(s => s.staff)
  const [q, setQ] = useState("")
  const [dept, setDept] = useState("All")
  const [status, setStatus] = useState("All")
  const [selected, setSelected] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const departments = useMemo(() => ['All', ...Array.from(new Set(staff.map(s => s.department))).sort()], [staff])

  const filtered = staff.filter(s => {
    const matchesQ = !q || `${s.name} ${s.employeeId} ${s.designation} ${s.department}`.toLowerCase().includes(q.toLowerCase())
    return matchesQ && (dept === 'All' || s.department === dept) && (status === 'All' || s.status === status)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Users className="h-6 w-6 text-[var(--color-accent)]" /> {t('employees.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('employees.count', { shown: filtered.length, total: staff.length })}</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">
          <UserPlus className="h-4 w-4" /> {t('employees.addEmployee')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('employees.searchPlaceholder')}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
          {departments.map(d => <option key={d} value={d}>{d === 'All' ? t('employees.allDepartments') : d}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
          {['All', 'active', 'on_leave', 'suspended', 'terminated', 'inactive'].map(s => <option key={s} value={s}>{s === 'All' ? t('employees.allStatuses') : t(`staffStatus.${s}`)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3">{t('common.employee')}</th>
                <th className="px-4 py-3">{t('common.department')}</th>
                <th className="px-4 py-3">{t('common.designation')}</th>
                <th className="px-4 py-3">{t('employees.colContract')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setSelected(s.id)} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{s.employeeId}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.department}</td>
                  <td className="px-4 py-3 text-slate-600">{s.designation}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{s.contractType}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[s.status])}>{t(`staffStatus.${s.status}`)}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{t('employees.noMatch')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <StaffProfileDrawer staffId={selected} onClose={() => setSelected(null)} />}
      <AddStaffWizard open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
