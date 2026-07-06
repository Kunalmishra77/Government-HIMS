"use client"

import { useMemo } from "react"
import {
  Ambulance, Heart, Activity, ShieldAlert, FileWarning, Clock, FlaskConical,
  ScanLine, AlertTriangle, CheckCircle2, ChevronRight,
} from "lucide-react"
import { useERStore, latestVitals, type ERPatient } from "@/store/useERStore"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { useRadiologyStudiesStore } from "@/store/useRadiologyStudiesStore"
import { news2, qsofa, ESI_STYLE, TREATMENT_AREAS } from "@/lib/erClinical"
import { cn } from "@/lib/utils"

const ARRIVAL_LABEL: Record<ERPatient['arrival'], string> = {
  walk_in: 'Walk-in', ambulance: '108 ambulance', transfer: 'Transfer-in',
}

const minsBetween = (a: string, b?: string) =>
  Math.max(0, Math.round(((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 60000))
const fmtMins = (m: number) => m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

/**
 * ER → IPD handover panel.
 *
 * When the admitting team opens an inpatient who came in through the ER,
 * this panel surfaces the complete ER journey: arrival mode, triage vitals,
 * ESI level + reason, treatment area, MLC if trauma, every order fired from
 * the ER, and the disposition note. Lets the ward team take over without
 * re-questioning the patient.
 *
 * Returns null when the patient has no ER record — admit-from-OPD goes
 * straight to IPD without this section showing up.
 */
export function ERHandoverPanel({ patientId }: { patientId: string }) {
  const erRecord = useERStore(s => s.patients.find(p => p.patientId === patientId))
  // Select the raw arrays (stable refs) and filter in useMemo — filtering inside
  // the selector returns a new array each render, which trips zustand's snapshot
  // check and causes an infinite render loop.
  const allOrders = useLabOrdersStore(s => s.orders)
  const allStudies = useRadiologyStudiesStore(s => s.studies)
  const labOrders = useMemo(() => allOrders.filter(o => o.patientId === patientId && o.source === 'ER'), [allOrders, patientId])
  const radStudies = useMemo(() => allStudies.filter(s2 => s2.patientId === patientId && s2.source === 'ER'), [allStudies, patientId])

  const vitals = useMemo(() => erRecord ? latestVitals(erRecord) : undefined, [erRecord])
  const news = useMemo(() => vitals ? news2(vitals) : null, [vitals])
  const qs = useMemo(() => vitals ? qsofa(vitals) : null, [vitals])

  if (!erRecord) return null

  const doorToDoctor = erRecord.doctorClaimAt ? minsBetween(erRecord.arrivedAt, erRecord.doctorClaimAt) : null
  const doorToDispo  = erRecord.decisionAt    ? minsBetween(erRecord.arrivedAt, erRecord.decisionAt)    : null
  const erDwellMins  = minsBetween(erRecord.arrivedAt, erRecord.dispositionAt)

  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50/40 to-primary-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-red-100 bg-white/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Ambulance className="h-4 w-4 text-red-600" />
          <p className="text-sm font-bold text-slate-900">ER handover summary</p>
          <span className="text-[10.5px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
            ESI {erRecord.esi ?? '?'}
          </span>
          {erRecord.trauma && (
            <span className="text-[10.5px] font-bold text-accent bg-accent-soft px-1.5 py-0.5 rounded">
              TRAUMA
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          ER dwell <b className="text-slate-700">{fmtMins(erDwellMins)}</b>
          {doorToDoctor != null && <> · Door-to-doctor <b className="text-slate-700">{doorToDoctor}m</b></>}
          {doorToDispo != null && <> · Door-to-dispo <b className="text-slate-700">{doorToDispo}m</b></>}
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* Arrival + chief complaint */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white border border-slate-200 p-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">Arrival</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{ARRIVAL_LABEL[erRecord.arrival]}</p>
            <p className="text-[11px] text-slate-500">{fmtTime(erRecord.arrivedAt)}</p>
          </div>
          <div className="rounded-lg bg-white border border-slate-200 p-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">Treatment area</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">{TREATMENT_AREAS.find(a => a.code === erRecord.area)?.label ?? '—'}</p>
            <p className="text-[11px] text-slate-500">Bed {erRecord.bedNumber ?? '—'}</p>
          </div>
        </div>

        <div className="rounded-lg bg-white border border-slate-200 p-2">
          <p className="text-[10px] font-bold uppercase text-slate-400">Chief complaint</p>
          <p className="text-xs text-slate-700 mt-0.5">{erRecord.chiefComplaint}</p>
          {erRecord.esiReason && (
            <p className="text-[11px] text-slate-500 mt-0.5 italic">ESI reason: {erRecord.esiReason}</p>
          )}
        </div>

        {/* Vitals at triage */}
        {vitals && (
          <div className="rounded-lg bg-white border border-slate-200 p-2">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Activity className="h-3 w-3" />Vitals at triage
              </p>
              <p className="text-[10px] text-slate-400">
                by {vitals.by} · {fmtTime(vitals.at)}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              {vitals.rr   != null && <span><b className="text-slate-500">RR</b> {vitals.rr}</span>}
              {vitals.spo2 != null && <span><b className="text-slate-500">SpO₂</b> {vitals.spo2}%{vitals.onOxygen ? ' (O₂)' : ''}</span>}
              {vitals.sbp  != null && <span><b className="text-slate-500">SBP</b> {vitals.sbp}</span>}
              {vitals.hr   != null && <span><b className="text-slate-500">HR</b> {vitals.hr}</span>}
              {vitals.temp != null && <span><b className="text-slate-500">T</b> {vitals.temp}°C</span>}
              {vitals.gcs  != null && <span><b className="text-slate-500">GCS</b> {vitals.gcs}</span>}
            </div>
            {(news?.band === 'high' || qs?.positive) && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                {news && news.band !== 'low' && (
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded",
                    news.band === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                    NEWS2 {news.score}
                  </span>
                )}
                {qs?.positive && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-soft text-accent">
                    qSOFA+ ({qs.criteria.join(', ')})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Doctor + assignment */}
        {erRecord.assignedTo && (
          <div className="rounded-lg bg-white border border-slate-200 p-2 text-[11px] text-slate-700">
            <b className="text-slate-500 text-[10px] uppercase font-bold">ER physician</b>
            <span className="ml-1">{erRecord.assignedTo.name}</span>
            {erRecord.doctorClaimAt && <span className="text-slate-400"> · claimed at {fmtTime(erRecord.doctorClaimAt)}</span>}
          </div>
        )}

        {/* MLC */}
        {erRecord.mlc && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
            <p className="text-[10px] font-bold uppercase text-red-700 flex items-center gap-1 mb-1">
              <FileWarning className="h-3 w-3" />MLC documented · {erRecord.mlc.mlcNumber}
            </p>
            <p className="text-[11px] text-slate-700">
              {erRecord.mlc.injuryType} · {erRecord.mlc.policeStation}
              {erRecord.mlc.officerName && ` · IO ${erRecord.mlc.officerName}`}
              {erRecord.mlc.officerBadge && ` (${erRecord.mlc.officerBadge})`}
            </p>
            {erRecord.mlc.alcoholScreen !== 'pending' && (
              <p className="text-[10.5px] text-slate-500 mt-0.5">Alcohol screen: {erRecord.mlc.alcoholScreen}</p>
            )}
            {erRecord.mlc.notes && (
              <p className="text-[10.5px] italic text-slate-600 mt-1">"{erRecord.mlc.notes}"</p>
            )}
          </div>
        )}

        {/* Orders fired from ER */}
        {(labOrders.length > 0 || radStudies.length > 0) && (
          <div className="rounded-lg bg-white border border-slate-200 p-2">
            <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1">
              <FlaskConical className="h-3 w-3" />Investigations ordered from ER
            </p>
            <ul className="space-y-1">
              {labOrders.flatMap(o => o.tests).map(t => {
                const crit = t.analytes.some(a => a.flag === 'CH' || a.flag === 'CL')
                const flagged = t.analytes.filter(a => a.flag !== 'N').length
                return (
                  <li key={t.id} className="flex items-center gap-2 text-[11px]">
                    <FlaskConical className="h-2.5 w-2.5 text-amber-600 flex-shrink-0" />
                    <span className="font-bold text-slate-900 truncate flex-1">{t.name}</span>
                    <span className={cn("text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded",
                      t.status === 'released'   ? (crit ? 'bg-red-100 text-red-700' : flagged > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')
                      : t.status === 'verified' ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]'
                      : t.status === 'entered'  ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]'
                      : 'bg-slate-100 text-slate-500')}>
                      {t.status.replace('_', ' ')}
                    </span>
                    {crit && <ShieldAlert className="h-2.5 w-2.5 text-red-600" />}
                  </li>
                )
              })}
              {radStudies.map(s2 => (
                <li key={s2.id} className="flex items-center gap-2 text-[11px]">
                  <ScanLine className="h-2.5 w-2.5 text-[var(--color-accent)] flex-shrink-0" />
                  <span className="font-bold text-slate-900 truncate flex-1">{s2.modality} {s2.name}</span>
                  <span className={cn("text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded",
                    s2.status === 'released' ? 'bg-emerald-100 text-emerald-700'
                    : s2.status === 'verified' ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]'
                    : s2.status === 'reported' ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]'
                    : 'bg-slate-100 text-slate-500')}>
                    {s2.status.replace('_', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Disposition note */}
        {erRecord.dispositionNote && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
            <p className="text-[10px] font-bold uppercase text-emerald-700 mb-0.5 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />Handover note from ER
            </p>
            <p className="text-[11.5px] text-slate-700">{erRecord.dispositionNote}</p>
          </div>
        )}
      </div>
    </div>
  )
}
