"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ShieldCheck, Plus, X, Save, Trash2, AlertTriangle, Sparkles, Edit2,
} from "lucide-react"
import { useHRStore, type DeptMinimum } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { ALL_ROLES } from "@/types/roles"
import type { Role } from "@/types/roles"
import { CoverageGauge } from "@/components/admin/CoverageGauge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { useTranslations } from "next-intl"

const SEVERITY_TINT: Record<'critical' | 'warning' | 'ok', string> = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  warning:  'bg-amber-50 border-amber-200 text-amber-700',
  ok:       'bg-emerald-50 border-emerald-200 text-emerald-700',
}

const today = () => new Date().toISOString().split('T')[0]!

export default function CoveragePage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const deptMinimums = useHRStore(s => s.deptMinimums)
  const setDeptMinimum = useHRStore(s => s.setDeptMinimum)
  const addDeptMinimum = useHRStore(s => s.addDeptMinimum)
  const removeDeptMinimum = useHRStore(s => s.removeDeptMinimum)
  const getCoverage = useHRStore(s => s.getCoverage)
  const staff = useHRStore(s => s.staff)

  const canWrite = canDo(currentUser?.role, 'hr.shift.write')
  const actorName = currentUser?.name ?? 'Administrator'
  const { confirm, view: dialogView } = useDialogs()

  const [editing, setEditing] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Partial<DeptMinimum>>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newDept, setNewDept] = useState<DeptMinimum>({
    department: '', min: 1, ideal: 2, roles: ['nurse'], perShift: true,
  })

  // Sort the dept minimums alphabetically for stability
  const sorted = useMemo(() => [...deptMinimums].sort((a, b) => a.department.localeCompare(b.department)), [deptMinimums])

  // Live coverage snapshot: today's Morning shift per dept
  const liveCoverage = useMemo(() =>
    sorted.map(d => ({ dept: d, coverage: getCoverage(d.department, today(), 'Morning') })),
    [sorted, getCoverage])

  const critical = liveCoverage.filter(x => x.coverage.severity === 'critical')

  const handleSave = (dept: string) => {
    const draft = drafts[dept]
    if (!draft) { setEditing(null); return }
    setDeptMinimum(dept, draft, actorName)
    setDrafts(prev => { const n = { ...prev }; delete n[dept]; return n })
    setEditing(null)
    toast.success(t('coverage.requirementsSaved', { dept }))
  }

  const handleRemove = async (dept: string) => {
    const ok = await confirm({
      title: t('coverage.removeTitle', { dept }),
      body: t('coverage.removeBody'),
      confirmLabel: t('coverage.remove'),
      tone: 'danger',
    })
    if (!ok) return
    removeDeptMinimum(dept, actorName)
    toast.success(t('coverage.requirementRemoved', { dept }))
  }

  const handleAdd = () => {
    if (!newDept.department.trim()) { toast.error(t('coverage.deptNameRequired')); return }
    if (deptMinimums.some(d => d.department === newDept.department.trim())) {
      toast.error(t('coverage.alreadySet', { dept: newDept.department })); return
    }
    addDeptMinimum({ ...newDept, department: newDept.department.trim() }, actorName)
    toast.success(t('coverage.requirementAdded', { dept: newDept.department }))
    setNewDept({ department: '', min: 1, ideal: 2, roles: ['nurse'], perShift: true })
    setShowAdd(false)
  }

  // Suggest depts that have active staff but no minimum set yet
  const suggestableDepts = useMemo(() => {
    const existing = new Set(deptMinimums.map(d => d.department))
    const all = Array.from(new Set(staff.filter(s => s.status === 'active').map(s => s.department)))
    return all.filter(d => !existing.has(d))
  }, [staff, deptMinimums])

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-[var(--color-accent)]" />{t('coverage.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('coverage.subtitle')}
          </p>
        </div>
        {canWrite && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
            <Plus className="h-3.5 w-3.5" />{t('coverage.addRequirement')}
          </button>
        )}
      </div>

      {critical.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">
            {t.rich('coverage.criticalBanner', { count: critical.length, b: (chunks) => <b>{chunks}</b> })}
            {' '}<b>{critical.map(c => c.dept.department).join(', ')}</b>
          </p>
        </div>
      )}

      {/* Live coverage snapshot */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-slate-800">{t('coverage.liveCoverage')}</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('coverage.departmentsCount', { count: sorted.length })}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {liveCoverage.map(({ dept, coverage }) => (
            <CoverageGauge key={dept.department}
              dept={dept.department}
              date={today()}
              shift="Morning" />
          ))}
        </div>
      </div>

      {/* Editable requirements table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['colDepartment', 'colMin', 'colIdeal', 'colRoles', 'colPerShift', 'colLive', 'colActions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t(`coverage.${h}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400 italic">
                {t('coverage.noRequirements')}
              </td></tr>
            ) : sorted.map(dept => {
              const cov = liveCoverage.find(c => c.dept.department === dept.department)?.coverage
              const isEditing = editing === dept.department
              const draft = drafts[dept.department] ?? {}
              return (
                <motion.tr key={dept.department}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-bold text-slate-800">{dept.department}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input type="number" min={1} value={draft.min ?? dept.min}
                        onChange={(e) => setDrafts(prev => ({ ...prev, [dept.department]: { ...draft, min: Number(e.target.value) } }))}
                        className="w-16 h-8 px-2 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                    ) : (
                      <span className="text-sm font-bold text-slate-800 tabular-nums">{dept.min}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input type="number" min={1} value={draft.ideal ?? dept.ideal}
                        onChange={(e) => setDrafts(prev => ({ ...prev, [dept.department]: { ...draft, ideal: Number(e.target.value) } }))}
                        className="w-16 h-8 px-2 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                    ) : (
                      <span className="text-sm font-bold text-slate-800 tabular-nums">{dept.ideal}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {dept.roles.map(r => (
                        <span key={r} className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {t.has(`coverage.role.${r}`) ? t(`coverage.role.${r}`) : r.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                      dept.perShift ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]' : 'bg-slate-100 text-slate-600')}>
                      {dept.perShift ? t('coverage.perShift') : t('coverage.daily')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {cov && (
                      <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ring-1',
                        cov.severity === 'critical' ? 'bg-red-50 text-red-700 ring-red-200' :
                        cov.severity === 'warning' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                        'bg-emerald-50 text-emerald-700 ring-emerald-200')}
                        title={cov.staff.map(s => s.name).join(', ')}>
                        {cov.headcount} / {cov.min} · {t.has(`coverage.severity.${cov.severity}`) ? t(`coverage.severity.${cov.severity}`) : cov.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      isEditing ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleSave(dept.department)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer">
                            <Save className="h-3 w-3" />{t('coverage.save')}
                          </button>
                          <button onClick={() => { setEditing(null); setDrafts(prev => { const n = { ...prev }; delete n[dept.department]; return n }) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px] font-bold cursor-pointer">
                            <X className="h-3 w-3" />{t('coverage.cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => setEditing(dept.department)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] text-[11px] font-bold cursor-pointer">
                            <Edit2 className="h-3 w-3" />{t('coverage.edit')}
                          </button>
                          <button onClick={() => handleRemove(dept.department)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 text-[11px] font-bold cursor-pointer">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Suggest depts without minimums */}
      {suggestableDepts.length > 0 && canWrite && (
        <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            <h3 className="text-sm font-bold text-[var(--color-primary-dark)]">{t('coverage.suggested')}</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestableDepts.map(d => (
              <button key={d} onClick={() => { setNewDept({ ...newDept, department: d }); setShowAdd(true) }}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-[rgba(238,107,38,0.20)] hover:bg-[rgba(238,107,38,0.14)] text-[var(--color-accent)] cursor-pointer">
                + {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add requirement modal */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAdd(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="h-4 w-4 text-[var(--color-accent)]" />{t('coverage.modalTitle')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{t('coverage.modalSubtitle')}</p>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('coverage.colDepartment')}</p>
                <input value={newDept.department}
                  onChange={(e) => setNewDept({ ...newDept, department: e.target.value })}
                  placeholder={t('coverage.deptPlaceholder')}
                  className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('coverage.colMin')}</p>
                  <input type="number" min={1} value={newDept.min}
                    onChange={(e) => setNewDept({ ...newDept, min: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('coverage.colIdeal')}</p>
                  <input type="number" min={1} value={newDept.ideal}
                    onChange={(e) => setNewDept({ ...newDept, ideal: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('coverage.expectedRoles')}</p>
                <div className="flex flex-wrap gap-1">
                  {ALL_ROLES.filter(r => r !== 'patient').map(r => (
                    <button key={r} type="button" onClick={() => {
                      setNewDept(prev => ({
                        ...prev,
                        roles: prev.roles.includes(r as Role) ? prev.roles.filter(x => x !== r) : [...prev.roles, r as Role],
                      }))
                    }}
                      className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded cursor-pointer',
                        newDept.roles.includes(r as Role) ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}>
                      {t.has(`coverage.role.${r}`) ? t(`coverage.role.${r}`) : r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newDept.perShift}
                  onChange={(e) => setNewDept({ ...newDept, perShift: e.target.checked })} />
                <span className="text-xs text-slate-700">{t('coverage.applyPerShift')}</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowAdd(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">{t('coverage.cancel')}</button>
              <button onClick={handleAdd}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                <Save className="h-3.5 w-3.5" />{t('coverage.addRequirement')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      {dialogView}
    </div>
  )
}
