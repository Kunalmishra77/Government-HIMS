"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useHRStore, type ShiftType } from "@/store/useHRStore"
import { useTranslations } from "next-intl"
import {
  Users, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Sparkles, Activity, Stethoscope, FlaskConical, Pill, Shield, ChevronRight
} from "lucide-react"

const DEPT_REQUIREMENTS: Record<string, { min: number; ideal: number; roles: string[] }> = {
  'Emergency':      { min: 2, ideal: 4, roles: ['Doctor', 'Nurse'] },
  'ICU':            { min: 3, ideal: 5, roles: ['Doctor', 'Nurse'] },
  'General Ward':   { min: 2, ideal: 4, roles: ['Nurse'] },
  'Radiology':      { min: 1, ideal: 2, roles: ['Radiologist'] },
  'Pathology':      { min: 1, ideal: 2, roles: ['Lab Technician'] },
  'Pharmacy':       { min: 1, ideal: 2, roles: ['Pharmacist'] },
  'General Medicine': { min: 1, ideal: 2, roles: ['Doctor'] },
}

const DEPT_ICONS: Record<string, React.ElementType> = {
  Emergency: Shield,
  ICU: Activity,
  'General Ward': Users,
  Radiology: Activity,
  Pathology: FlaskConical,
  Pharmacy: Pill,
  'General Medicine': Stethoscope,
}

const DEPT_GRADIENTS: Record<string, { gradient: string; light: string; text: string; shadow: string }> = {
  Emergency:        { gradient: 'linear-gradient(135deg, #DC2626, #EF4444)', light: '#FEE2E2', text: '#7F1D1D', shadow: 'rgba(220,38,38,0.25)' },
  ICU:              { gradient: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))', light: 'rgba(238,107,38,0.06)', text: '#9A3A14', shadow: 'rgba(238,107,38,0.25)' },
  'General Ward':   { gradient: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))', light: '#F6F9FC', text: 'var(--color-primary-dark)', shadow: 'rgba(238,107,38,0.25)' },
  Radiology:        { gradient: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))', light: '#FFF3EC', text: '#0C4A6E', shadow: 'rgba(238,107,38,0.25)' },
  Pathology:        { gradient: 'linear-gradient(135deg, #059669, #10B981)', light: '#ECFDF5', text: '#065F46', shadow: 'rgba(5,150,105,0.25)' },
  Pharmacy:         { gradient: 'linear-gradient(135deg, #BE185D, #EC4899)', light: '#FDF2F8', text: '#831843', shadow: 'rgba(190,24,93,0.25)' },
  'General Medicine': { gradient: 'linear-gradient(135deg, #D97706, #F59E0B)', light: '#FFFBEB', text: '#78350F', shadow: 'rgba(217,119,6,0.25)' },
}

const SHIFTS: ShiftType[] = ['Morning', 'Evening', 'Night']

const SHIFT_LABELS: Record<ShiftType, string> = {
  Morning: 'Morning (06–14)',
  Evening: 'Evening (14–22)',
  Night:   'Night (22–06)',
  Off:     'Off',
}

function getDateStr(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function StatusBar({ actual, min, ideal }: { actual: number; min: number; ideal: number }) {
  const pct = Math.min((actual / ideal) * 100, 100)
  const color = actual < min ? '#EF4444' : actual < ideal ? '#F59E0B' : '#10B981'
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{actual}/{ideal}</span>
    </div>
  )
}

export default function StaffingPage() {
  const t = useTranslations('admin')
  const { staff, shifts } = useHRStore()
  const [selectedShift, setSelectedShift] = useState<ShiftType>('Morning')
  const today = getDateStr(0)
  const deptLabel = (d: string) => t.has(`staffing.dept.${d}`) ? t(`staffing.dept.${d}`) : d
  const shiftLabel = (s: string) => t.has(`staffing.shift.${s}`) ? t(`staffing.shift.${s}`) : s

  const SHIFT_CONFIG = {
    Morning: { gradient: 'linear-gradient(135deg, #D97706, #F59E0B)', shadow: 'rgba(217,119,6,0.3)' },
    Evening: { gradient: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))', shadow: 'rgba(238,107,38,0.25)' },
    Night:   { gradient: 'linear-gradient(135deg, #9A3A14, var(--color-primary-dark))', shadow: 'rgba(154,58,20,0.3)' },
    Off:     { gradient: 'linear-gradient(135deg, #94A3B8, #CBD5E1)', shadow: 'rgba(148,163,184,0.2)' },
  }

  const onDutyStaff = staff.filter(s => {
    const shift = shifts.find(sh => sh.staffId === s.id && sh.date === today)
    return shift?.shift === selectedShift
  })

  const deptStats = Object.entries(DEPT_REQUIREMENTS).map(([dept, req]) => {
    const deptStaff = onDutyStaff.filter(s => s.department === dept)
    const actual = deptStaff.length
    const status = actual < req.min ? 'critical' : actual < req.ideal ? 'low' : 'ok'
    return { dept, actual, ...req, status, staff: deptStaff }
  })

  const criticalCount = deptStats.filter(d => d.status === 'critical').length
  const lowCount = deptStats.filter(d => d.status === 'low').length
  const totalOnDuty = onDutyStaff.length

  const allDepts = Array.from(new Set(staff.map(s => s.department)))
  const headcountByDept = allDepts.map(dept => ({
    dept,
    total: staff.filter(s => s.department === dept).length,
    onDuty: onDutyStaff.filter(s => s.department === dept).length,
  }))

  const shiftCfg = SHIFT_CONFIG[selectedShift]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('staffing.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('staffing.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {SHIFTS.map(s => {
            const cfg = SHIFT_CONFIG[s]
            return (
              <button key={s} onClick={() => setSelectedShift(s)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                style={selectedShift === s
                  ? { background: cfg.gradient, color: '#fff', boxShadow: `0 4px 12px ${cfg.shadow}` }
                  : { background: '#fff', color: '#64748B', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }
                }
              >
                {shiftLabel(s)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('staffing.onDutyNow'), value: totalOnDuty, icon: Users, gradient: shiftCfg.gradient, shadow: shiftCfg.shadow },
          { label: t('staffing.totalStaff'), value: staff.length, icon: Users, gradient: 'linear-gradient(135deg, #0F172A, #16324A)', shadow: 'rgba(15,23,42,0.3)' },
          { label: t('staffing.criticallyLow'), value: criticalCount, icon: AlertTriangle, gradient: criticalCount > 0 ? 'linear-gradient(135deg, #DC2626, #EF4444)' : 'linear-gradient(135deg, #059669, #10B981)', shadow: criticalCount > 0 ? 'rgba(220,38,38,0.3)' : 'rgba(5,150,105,0.3)' },
          { label: t('staffing.belowIdeal'), value: lowCount, icon: TrendingDown, gradient: lowCount > 0 ? 'linear-gradient(135deg, #D97706, #F59E0B)' : 'linear-gradient(135deg, #059669, #10B981)', shadow: lowCount > 0 ? 'rgba(217,119,6,0.3)' : 'rgba(5,150,105,0.3)' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.gradient, boxShadow: `0 4px 12px ${stat.shadow}` }}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Critical Alerts */}
      {criticalCount > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #FEF2F2, #FFF1F2)', boxShadow: '0 2px 8px rgba(220,38,38,0.1)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-bold text-red-800">{t('staffing.criticalAlert', { shift: shiftLabel(selectedShift) })}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {deptStats.filter(d => d.status === 'critical').map(d => (
              <div key={d.dept} className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl text-sm font-semibold text-red-700" style={{ boxShadow: '0 1px 4px rgba(220,38,38,0.15)' }}>
                <span>{deptLabel(d.dept)}</span>
                <span className="text-red-400">·</span>
                <span>{t('staffing.minRequired', { actual: d.actual, min: d.min })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Department Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {deptStats.map((dept, i) => {
          const cfg = DEPT_GRADIENTS[dept.dept] ?? { gradient: 'linear-gradient(135deg, #64748B, #94A3B8)', light: '#F8FAFC', text: '#334155', shadow: 'rgba(100,116,139,0.2)' }
          const DeptIcon = DEPT_ICONS[dept.dept] ?? Users
          const statusColor = dept.status === 'ok' ? '#10B981' : dept.status === 'low' ? '#F59E0B' : '#EF4444'

          return (
            <motion.div
              key={dept.dept}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-5"
              style={{ boxShadow: dept.status === 'critical' ? `0 0 0 2px ${statusColor}40, 0 4px 16px rgba(15,23,42,0.06)` : '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}
            >
              {/* Dept Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cfg.gradient, boxShadow: `0 4px 12px ${cfg.shadow}` }}>
                  <DeptIcon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm">{deptLabel(dept.dept)}</p>
                  <p className="text-xs text-slate-500">{t('staffing.minIdeal', { min: dept.min, ideal: dept.ideal })}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: `${statusColor}15`, color: statusColor }}>
                  {dept.status === 'ok' ? <CheckCircle className="h-3 w-3" /> : dept.status === 'low' ? <TrendingDown className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {dept.status === 'ok' ? t('staffing.staffed') : dept.status === 'low' ? t('staffing.low') : t('staffing.critical')}
                </div>
              </div>

              {/* Status Bar */}
              <StatusBar actual={dept.actual} min={dept.min} ideal={dept.ideal} />

              {/* Staff on duty */}
              {dept.staff.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-50">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">{t('staffing.onDuty')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dept.staff.map(s => (
                      <span key={s.id} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: cfg.light, color: cfg.text }}>
                        {s.name.split(' ').slice(0, 2).join(' ')}
                      </span>
                    ))}
                    {dept.actual === 0 && (
                      <span className="text-[11px] text-slate-400 italic">{t('staffing.noStaffAssigned')}</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Total Headcount by Department */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.06)' }}>
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-700">{t('staffing.totalHeadcount')}</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {headcountByDept.map((row, i) => {
            const pct = Math.round((row.onDuty / Math.max(row.total, 1)) * 100)
            const cfg = DEPT_GRADIENTS[row.dept]
            return (
              <motion.div
                key={row.dept}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800 w-36 flex-shrink-0">{deptLabel(row.dept)}</p>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.04 }}
                    className="h-full rounded-full"
                    style={{ background: cfg?.gradient ?? 'linear-gradient(135deg, #64748B, #94A3B8)' }}
                  />
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                  <span className="text-sm font-bold text-slate-900 tabular-nums">{row.onDuty}</span>
                  <span className="text-xs text-slate-400">/ {row.total}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                    style={{ background: pct > 0 ? '#D1FAE5' : '#FEE2E2', color: pct > 0 ? '#065F46' : '#7F1D1D' }}>
                    {pct}%
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* AI Staffing Insight */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, rgba(238,107,38,0.06), #F6F9FC)', boxShadow: '0 2px 12px rgba(238,107,38,0.25)' }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary-dark))', boxShadow: '0 4px 12px rgba(238,107,38,0.25)' }}>
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-bold text-[var(--color-primary-dark)]">{t('staffing.aiForecast')}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(238,107,38,0.20)] text-[var(--color-primary-dark)]">{t('staffing.confidence')}</span>
            </div>
            <p className="text-xs text-[var(--color-accent)] leading-relaxed">
              {t('staffing.aiForecastBody')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { dept: 'ICU', shift: 'Evening', actionKey: 'staffing.recNurses' },
                { dept: 'Emergency', shift: 'Evening', actionKey: 'staffing.recDoctor' },
              ].map(rec => (
                <div key={rec.dept} className="flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-xl">
                  <span className="text-xs font-bold text-[var(--color-primary-dark)]">{deptLabel(rec.dept)}</span>
                  <span className="text-[11px] text-[var(--color-accent)]">{shiftLabel(rec.shift)}</span>
                  <span className="text-xs font-black text-emerald-600">{t(rec.actionKey)}</span>
                  <ChevronRight className="h-3 w-3 text-[var(--color-primary-light)]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
