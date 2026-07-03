"use client"

import { useMemo } from "react"
import {
  Stethoscope, Calendar, Activity, ShieldAlert, AlertTriangle,
  Pill, Clock, BedDouble, ClipboardList, FlaskConical, NotebookPen,
  History, CalendarClock, HeartPulse,
} from "lucide-react"
import type { Bed } from "@/store/useAdmissionStore"
import { useInpatientStore, latestVitalsRecord, lastRound, type Inpatient } from "@/store/useInpatientStore"
import { cn } from "@/lib/utils"

const CONDITION_TINT: Record<string, string> = {
  Critical:           'bg-red-50 text-red-700 border-red-200',
  Serious:            'bg-primary-soft text-accent border-primary/20',
  Stable:             'bg-emerald-50 text-emerald-700 border-emerald-200',
  Improving:          'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  'Discharge-ready':  'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
}

const STAGE_LABEL: Record<string, string> = {
  admitted:        'Admitted',
  under_treatment: 'Under treatment',
  pre_op:          'Pre-op',
  in_surgery:      'In surgery',
  post_op:         'Post-op',
  recovering:      'Recovering',
  discharge_initiated: 'Discharge initiated',
  discharged:      'Discharged',
}

const EVENT_DOT: Record<string, string> = {
  info: 'bg-slate-300', success: 'bg-emerald-400', warning: 'bg-amber-400', critical: 'bg-red-500',
}

function hoursOfStay(admittedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(admittedAt).getTime()) / 3600000))
}

function fmtLoS(h: number): string {
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

interface Props {
  bed: Bed
  /** Side of the trigger to anchor against. */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * Rich, scrollable patient hover card for an occupied / reserved bed.
 *
 * Resolves the inpatient record by occupantId → name → ward+bed (the bed's
 * occupantId uses the admin PT-* namespace while the IPD store uses IP-*, so a
 * direct id match alone misses), then surfaces the full ward chart: diagnosis,
 * admission details, vitals, current meds, treatment plan, doctor's notes,
 * investigations, allergies and the stay-history timeline.
 *
 * Placed as an absolute sibling inside a `group` parent — appears on
 * group-hover/focus. Interactive (pointer-events on hover) so it can be
 * scrolled; a transparent padding bridge keeps it open as the cursor moves in.
 */
export function BedHoverCard({ bed, side = 'right' }: Props) {
  const inpatient = useInpatientStore(s => {
    if (bed.occupantId) {
      const byId = s.inpatients.find(i => i.patientId === bed.occupantId)
      if (byId) return byId
    }
    const name = bed.occupantName?.trim().toLowerCase()
    if (name) {
      const byName = s.inpatients.find(i => i.name.trim().toLowerCase() === name)
      if (byName) return byName
    }
    return s.inpatients.find(i => i.bed === bed.bedNumber && i.ward === bed.ward)
  })

  const data = useMemo(() => extract(bed, inpatient), [bed, inpatient])
  if (!data) return null

  // Padding (not margin) so the bridge area is part of the hovered subtree and
  // doesn't drop the hover when the cursor travels from the bed into the card.
  const posClass =
    side === 'right'  ? 'left-full top-0 pl-2' :
    side === 'left'   ? 'right-full top-0 pr-2' :
    side === 'top'    ? 'bottom-full left-1/2 -translate-x-1/2 pb-2' :
                        'top-full left-1/2 -translate-x-1/2 pt-2'

  return (
    <div
      className={cn(
        "absolute z-40 opacity-0 invisible scale-95 transition-all duration-150 pointer-events-none",
        "group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:pointer-events-auto",
        "group-focus-within:opacity-100 group-focus-within:visible group-focus-within:scale-100 group-focus-within:pointer-events-auto",
        posClass,
      )}
      role="tooltip"
    >
      <div className="w-80 max-h-[78vh] overflow-y-auto rounded-xl bg-white shadow-2xl border border-slate-200 p-3.5 text-left">
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
            {data.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{data.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{data.patientId} · {data.ageGender} · {data.wardBed}</p>
          </div>
          {data.condition && (
            <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border whitespace-nowrap", CONDITION_TINT[data.condition] ?? CONDITION_TINT.Stable)}>
              {data.condition}
            </span>
          )}
        </div>

        {/* Diagnosis + comorbidities */}
        {data.diagnosis && (
          <div className="mb-2 px-2 py-1.5 rounded-lg bg-slate-50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">Diagnosis</p>
            <p className="text-xs font-semibold text-slate-800">{data.diagnosis}</p>
            {data.comorbidities && data.comorbidities.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {data.comorbidities.map(c => (
                  <span key={c} className="text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">{c}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admission details */}
        {(data.doctor || data.los || data.stage || data.admittedLabel || data.expectedDischarge) && (
          <Section icon={CalendarClock} label="Admission">
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {data.admittedLabel && <Field icon={Calendar}>{data.admittedLabel}</Field>}
              {data.doctor && <Field icon={Stethoscope}>{data.doctor}</Field>}
              {data.los && <Field icon={Clock}><b>LoS</b> {data.los}</Field>}
              {data.stage && <Field icon={Activity}>{data.stage}</Field>}
              {data.expectedDischarge && <Field icon={BedDouble} className="col-span-2"><b>Est. discharge</b> {data.expectedDischarge}</Field>}
            </div>
          </Section>
        )}

        {/* Latest vitals */}
        {data.vitals && (
          <div className="mb-2 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-[10px] font-bold uppercase text-emerald-700 mb-0.5 flex items-center gap-1"><HeartPulse className="h-3 w-3" />Latest vitals {data.vitalsAt && <span className="font-medium text-emerald-600 normal-case">· {data.vitalsAt}</span>}</p>
            <p className="text-[11px] text-emerald-900 font-medium">{data.vitals}</p>
          </div>
        )}

        {/* Current medications */}
        {data.meds.length > 0 && (
          <Section icon={Pill} label={`Current medications (${data.meds.length})`}>
            <ul className="space-y-0.5">
              {data.meds.map((m, i) => (
                <li key={i} className="text-[11px] text-slate-700 flex items-baseline gap-1">
                  <span className="font-semibold text-slate-800">{m.name}</span>
                  <span className="text-slate-500">{m.dose} · {m.freq} · {m.route}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Treatment plan + recommendations */}
        {(data.plan || data.orders.length > 0 || data.diet) && (
          <Section icon={ClipboardList} label="Treatment plan">
            {data.plan && <p className="text-[11px] text-slate-700">{data.plan}</p>}
            {data.orders.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {data.orders.map((o, i) => (
                  <span key={i} className="text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]">{o}</span>
                ))}
              </div>
            )}
            {data.diet && <p className="text-[10.5px] text-slate-500 mt-1"><b>Diet:</b> {data.diet}</p>}
          </Section>
        )}

        {/* Doctor's notes */}
        {data.notes.length > 0 && (
          <Section icon={NotebookPen} label="Doctor's notes">
            <div className="space-y-1.5">
              {data.notes.map(n => (
                <div key={n.id} className="text-[11px]">
                  <p className="text-[9.5px] text-slate-400 font-medium">{n.doctor} · {fmtDate(n.at)} {fmtTime(n.at)}</p>
                  <p className="text-slate-700">{n.text}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Investigations */}
        {data.tests.length > 0 && (
          <Section icon={FlaskConical} label="Investigations">
            <ul className="space-y-0.5">
              {data.tests.map(t => (
                <li key={t.id} className="text-[11px] flex items-start justify-between gap-2">
                  <span className="text-slate-700 min-w-0">
                    <span className={cn("font-semibold", t.critical ? "text-red-700" : "text-slate-800")}>{t.name}</span>
                    {t.result && <span className="block text-[10px] text-slate-500">{t.result}</span>}
                  </span>
                  <span className={cn("text-[9px] font-bold uppercase px-1 py-0.5 rounded border whitespace-nowrap flex-shrink-0",
                    t.status === 'Ready' || t.status === 'Acknowledged' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                    t.status === 'In progress' ? "bg-amber-50 border-amber-200 text-amber-700" :
                    "bg-slate-50 border-slate-200 text-slate-500")}>{t.status}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Allergies */}
        {data.allergies && (
          <div className="mb-1.5 px-2 py-1 rounded-md bg-red-50 border border-red-200 flex items-start gap-1.5">
            <ShieldAlert className="h-3 w-3 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-red-800"><b>Allergies:</b> {data.allergies}</p>
          </div>
        )}

        {/* Code status (only when not full code) */}
        {data.codeStatus && data.codeStatus !== 'Full code' && (
          <div className="mb-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-amber-800"><b>Code:</b> {data.codeStatus}</p>
          </div>
        )}

        {/* Stay history */}
        {data.history.length > 0 && (
          <Section icon={History} label="Stay history">
            <ol className="space-y-1.5">
              {data.history.map(h => (
                <li key={h.id} className="flex items-start gap-1.5 text-[11px]">
                  <span className={cn("h-1.5 w-1.5 rounded-full mt-1 flex-shrink-0", EVENT_DOT[h.severity ?? 'info'])} />
                  <span className="min-w-0">
                    <span className="text-slate-700 font-medium">{h.title}</span>
                    <span className="block text-[9.5px] text-slate-400">{fmtDate(h.at)} {fmtTime(h.at)}{h.actor ? ` · ${h.actor}` : ''}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {bed.expectedFreeAt && (
          <div className="flex items-center gap-1 text-[10.5px] text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
            <BedDouble className="h-2.5 w-2.5" />Expected free: {fmtTime(bed.expectedFreeAt)}
          </div>
        )}

        {!inpatient && bed.status === 'Occupied' && (
          <p className="text-[10.5px] text-slate-400 mt-1 italic">Limited details — full inpatient chart not yet created for this bed.</p>
        )}
      </div>
    </div>
  )
}

// Small labelled section wrapper.
function Section({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 border-t border-slate-100 pt-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3 text-slate-400" />{label}
      </p>
      {children}
    </div>
  )
}

function Field({ icon: Icon, children, className }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 text-[11px] text-slate-700 min-w-0", className)}>
      <Icon className="h-3 w-3 text-slate-400 flex-shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  )
}

// Build the display data — works even when the inpatient store doesn't have
// the patient (some beds are occupied by ER/OT placeholders).
function extract(bed: Bed, ip?: Inpatient) {
  if (bed.status !== 'Occupied' && bed.status !== 'Reserved' && bed.status !== 'Cleaning' && bed.status !== 'Maintenance') {
    return null
  }
  const empty = { meds: [], orders: [], notes: [], tests: [], history: [] } as const

  if (bed.status === 'Cleaning' || bed.status === 'Maintenance') {
    return {
      initials: bed.bedNumber.slice(0, 2),
      name: `Bed ${bed.bedNumber}`,
      patientId: '—',
      ageGender: bed.ward,
      wardBed: `${bed.ward} · ${bed.floor} floor`,
      diagnosis: bed.status === 'Cleaning' ? 'Bed under cleaning' : 'Maintenance',
      comorbidities: undefined,
      doctor: bed.cleaningAssignedTo,
      admittedLabel: undefined,
      los: undefined,
      stage: bed.status === 'Cleaning' ? 'Turning over' : 'Maintenance',
      expectedDischarge: bed.expectedFreeAt ? `Ready by ${fmtTime(bed.expectedFreeAt)}` : undefined,
      vitals: undefined, vitalsAt: undefined,
      allergies: undefined, codeStatus: undefined, condition: undefined, diet: undefined, plan: undefined,
      ...empty,
    }
  }

  // Occupied/Reserved — prefer full inpatient record, fall back to bed.
  const name = ip?.name ?? bed.occupantName ?? 'Unknown'
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const v = ip ? latestVitalsRecord(ip) : undefined
  const vitalsStr = v
    ? [
        v.hr != null ? `HR ${v.hr}` : null,
        v.systolicBP != null && v.diastolicBP != null ? `BP ${v.systolicBP}/${v.diastolicBP}` : null,
        v.spo2 != null ? `SpO₂ ${v.spo2}%` : null,
        v.temp != null ? `T ${v.temp}°F` : null,
        v.rr != null ? `RR ${v.rr}` : null,
        v.pain != null ? `Pain ${v.pain}/10` : null,
      ].filter(Boolean).join(' · ')
    : undefined

  const round = ip ? lastRound(ip) : undefined

  return {
    initials,
    name,
    patientId: ip?.patientId ?? bed.occupantId ?? '—',
    ageGender: ip ? `${ip.age}${ip.gender === 'Male' ? 'M' : ip.gender === 'Female' ? 'F' : ''}` : (bed.gender ?? ''),
    wardBed: `${bed.ward} · Bed ${bed.bedNumber}`,
    diagnosis: ip?.diagnosis,
    comorbidities: ip?.comorbidities?.filter(c => c && c.toLowerCase() !== 'none significant'),
    doctor: ip?.admittingDoctor,
    admittedLabel: ip ? `Admitted ${fmtDate(ip.admittedAt)}` : undefined,
    los: ip ? fmtLoS(hoursOfStay(ip.admittedAt)) : undefined,
    stage: ip ? STAGE_LABEL[ip.stage] : undefined,
    expectedDischarge: ip?.expectedDischarge,
    vitals: vitalsStr,
    vitalsAt: v ? fmtTime(v.at) : undefined,
    meds: (ip?.meds ?? []).filter(m => m.status === 'active').map(m => ({ name: m.name, dose: m.dose, freq: m.freq, route: m.route })),
    plan: round?.plan ?? round?.note,
    orders: round?.orders ?? [],
    diet: ip?.diet,
    notes: (ip?.progressNotes ?? []).slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3),
    tests: ip?.tests ?? [],
    allergies: ip?.allergies?.join(', '),
    codeStatus: ip?.codeStatus,
    condition: ip?.condition,
    history: (ip?.events ?? []).slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5),
  }
}
