"use client"

/* MoM §11 — Live Patient Journey Board.
 *
 * One hospital-wide view of every active patient and the department/stage they
 * are currently in, driven by useJourneyStore. Reception (the command centre)
 * uses it to spot bottlenecks: rows turn red when a patient has sat in a stage
 * past its SLA. Click a row for the full per-patient journey timeline.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { useTranslations } from "next-intl"
import { useJourneyStore, type JourneyState } from "@/store/useJourneyStore"
import { usePatientStore } from "@/store/usePatientStore"
import { cn } from "@/lib/utils"

// Journey state → the department it sits in + a stage label key.
const STAGE_MAP: Record<JourneyState, { dept: string; labelKey: string }> = {
  OPD_REGISTERED:            { dept: 'Registration', labelKey: 'stageRegistered' },
  VITALS_IN_PROGRESS:        { dept: 'OPD',          labelKey: 'stageVitals' },
  IN_CONSULT:                { dept: 'OPD',          labelKey: 'stageInConsultation' },
  LAB_ORDERED:               { dept: 'Lab',          labelKey: 'stageSamplePending' },
  LAB_RESULTED:              { dept: 'Lab',          labelKey: 'stageResulted' },
  RADIOLOGY_ORDERED:         { dept: 'Radiology',    labelKey: 'stageScanPending' },
  RADIOLOGY_RESULTED:        { dept: 'Radiology',    labelKey: 'stageReported' },
  PHARMACY_QUEUED:           { dept: 'Pharmacy',     labelKey: 'stageAwaitingMedicines' },
  BILLING_PENDING:           { dept: 'Billing',      labelKey: 'stageBillingPending' },
  DISCHARGE_PENDING_BILLING: { dept: 'Billing',      labelKey: 'stageDischargeBilling' },
  ADMITTED_IPD:              { dept: 'IPD',          labelKey: 'stageAdmitted' },
  IPD_STABLE:                { dept: 'IPD',          labelKey: 'stageStable' },
  IPD_CRITICAL:              { dept: 'IPD',          labelKey: 'stageCritical' },
  DISCHARGE_INITIATED:       { dept: 'Discharge',    labelKey: 'stageDischargeInitiated' },
  COMPLETED:                 { dept: 'Done',         labelKey: 'stageCompleted' },
}
const DEPT_KEY: Record<string, string> = {
  Registration: 'deptRegistration', OPD: 'deptOpd', Lab: 'deptLab', Radiology: 'deptRadiology',
  Pharmacy: 'deptPharmacy', Billing: 'deptBilling', IPD: 'deptIpd', Discharge: 'deptDischarge', Done: 'deptDone',
}

// SLA thresholds (minutes) — mirrors useJourneyStore so the board flags breaches live.
const SLA_MINUTES: Partial<Record<JourneyState, number>> = {
  VITALS_IN_PROGRESS: 10, IN_CONSULT: 30, LAB_ORDERED: 60, LAB_RESULTED: 45,
  PHARMACY_QUEUED: 20, BILLING_PENDING: 30, DISCHARGE_PENDING_BILLING: 60,
}

const DEPT_ORDER = ['Registration', 'OPD', 'Lab', 'Radiology', 'Pharmacy', 'Billing', 'IPD', 'Discharge', 'Done']

export default function LiveJourneyBoardPage() {
  const t = useTranslations('reception')
  const router = useRouter()
  const entries = useJourneyStore(s => s.entries)
  const patients = usePatientStore(s => s.patients)
  const [now, setNow] = useState(new Date())
  const [dept, setDept] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20_000)  // live SLA refresh
    return () => clearInterval(id)
  }, [])

  const rows = useMemo(() => {
    // Resolve a UHID when the patient exists in the OPD store; else show the journey id.
    const uhidFor = (patientId: string) => patients.find(p => p.id === patientId)?.uhid ?? patientId
    const active = entries.filter(e => e.currentState !== 'COMPLETED')
    return active
      .map(e => {
        const stage = STAGE_MAP[e.currentState]
        const mins = Math.max(0, Math.round((now.getTime() - new Date(e.enteredStateAt).getTime()) / 60000))
        const threshold = SLA_MINUTES[e.currentState]
        const delayed = threshold != null && mins > threshold
        return { ...e, ...stage, uhid: uhidFor(e.patientId), mins, delayed }
      })
      .filter(r => dept === 'All' || r.dept === dept)
      .filter(r => {
        const q = search.toLowerCase()
        return !q || r.patientName.toLowerCase().includes(q) || r.uhid.toLowerCase().includes(q)
      })
      .sort((a, b) => Number(b.delayed) - Number(a.delayed) || b.mins - a.mins)
  }, [entries, patients, dept, search, now])

  const activeCount = entries.filter(e => e.currentState !== 'COMPLETED').length
  const delayedCount = rows.filter(r => r.delayed).length
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      if (e.currentState === 'COMPLETED') continue
      const d = STAGE_MAP[e.currentState].dept
      counts[d] = (counts[d] ?? 0) + 1
    }
    return counts
  }, [entries])

  const fmtMins = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`)

  return (
    <div className="p-1 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.10)] text-[var(--color-accent)] flex items-center justify-center"><Activity className="h-4.5 w-4.5" /></span>
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 leading-tight">{t('journey.pageTitle')}</h1>
            <p className="text-[12px] text-slate-500">{t('journey.pageSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700"><Clock className="h-3.5 w-3.5" /> {t('journey.activeCount', { count: activeCount })}</span>
          <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl", delayedCount ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")} suppressHydrationWarning>
            {delayedCount ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {t('journey.delayedCount', { count: delayedCount })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('journey.searchPlaceholder')} aria-label={t('journey.searchAria')}
            className="w-full pl-9 h-9 rounded-xl ring-1 ring-slate-200 bg-white text-[13px] focus:outline-none focus:ring-[var(--color-primary)]" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...DEPT_ORDER.filter(d => d !== 'Done' && (deptCounts[d] ?? 0) > 0)].map(d => (
            <button key={d} onClick={() => setDept(d)}
              className={cn("text-[11.5px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer",
                dept === d ? "bg-[var(--color-primary)] text-white shadow-sm" : "bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50")}>
              {d === 'All' ? t('journey.filterAll') : t(`journey.${DEPT_KEY[d]}`)}{d !== 'All' && deptCounts[d] ? ` · ${deptCounts[d]}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">{t('journey.colUhid')}</th>
              <th className="px-4 py-3">{t('journey.colPatient')}</th>
              <th className="px-4 py-3">{t('journey.colDepartment')}</th>
              <th className="px-4 py-3">{t('journey.colCurrentStage')}</th>
              <th className="px-4 py-3">{t('journey.colInStage')}</th>
              <th className="px-4 py-3">{t('journey.colStatus')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => (
              <tr key={r.patientId} onClick={() => router.push(`/journey/${r.patientId}`)}
                className={cn("text-[13px] cursor-pointer transition", r.delayed ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-slate-50")}>
                <td className="px-4 py-3 font-mono text-[12px] text-slate-500">{r.uhid}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{r.patientName}</td>
                <td className="px-4 py-3 text-slate-600">{t(`journey.${DEPT_KEY[r.dept]}`)}</td>
                <td className="px-4 py-3 text-slate-700">{t(`journey.${r.labelKey}`)}</td>
                <td className="px-4 py-3 text-slate-500 tabular-nums" suppressHydrationWarning>{fmtMins(r.mins)}</td>
                <td className="px-4 py-3" suppressHydrationWarning>
                  {r.delayed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3" /> {t('journey.delayed')}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> {t('journey.onTrack')}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-slate-400">{t('journey.noActivePatients')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
