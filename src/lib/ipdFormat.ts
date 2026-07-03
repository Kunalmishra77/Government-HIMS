import type { IpdEventType, Condition, IpdStage } from '@/store/useInpatientStore'

// Shared IPD labels/tints reused across the table, drawer and full-page chart (DRY).

export const CONDITION_TINT: Record<Condition, string> = {
  Critical: 'bg-red-100 text-red-700', Serious: 'bg-accent-soft text-accent',
  Stable: 'bg-surface-sunken text-accent', Improving: 'bg-emerald-100 text-emerald-700',
  'Discharge-ready': 'bg-green-100 text-green-700',
}

export const STAGE_LABEL: Record<IpdStage, string> = {
  admitted: 'Admitted', under_treatment: 'Under treatment', pre_op: 'Pre-op',
  in_surgery: 'In surgery', post_op: 'Post-op', recovering: 'Recovering',
  discharge_initiated: 'Discharge in progress', discharged: 'Discharged',
}

export const EVENT_META: Record<IpdEventType, { label: string; color: string }> = {
  admission: { label: 'Admission', color: 'text-slate-500' },
  round: { label: 'Round', color: 'text-accent' },
  condition_change: { label: 'Condition', color: 'text-accent' },
  note: { label: 'Note', color: 'text-slate-600' },
  med_start: { label: 'Med started', color: 'text-accent' },
  med_stop: { label: 'Med stopped', color: 'text-rose-600' },
  med_change: { label: 'Med changed', color: 'text-amber-600' },
  test_order: { label: 'Test ordered', color: 'text-accent' },
  test_result: { label: 'Result', color: 'text-accent' },
  diet_change: { label: 'Diet', color: 'text-lime-600' },
  referral: { label: 'Referral', color: 'text-accent' },
  icu_transfer: { label: 'ICU transfer', color: 'text-red-600' },
  ot_booking: { label: 'OT booking', color: 'text-accent' },
  surgery_status: { label: 'Surgery', color: 'text-accent' },
  discharge_step: { label: 'Discharge', color: 'text-green-600' },
  discharged: { label: 'Discharged', color: 'text-green-700' },
}

export const SEVERITY_DOT: Record<NonNullable<import('@/store/useInpatientStore').IpdEvent['severity']>, string> = {
  info: 'bg-slate-300', success: 'bg-green-500', warning: 'bg-amber-500', critical: 'bg-red-500',
}

export const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
export const fmtDay = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
