"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import {
  Ambulance, AlertTriangle, ChevronDown, ChevronRight, UserPlus, Send,
  Activity, ShieldAlert, Heart, Thermometer, Wind, Clock,
} from "lucide-react"
import {
  useERStore, latestVitals,
  ER_TRIAGE_NURSE,
  type ERPatient, type Arrival,
} from "@/store/useERStore"
import {
  news2, qsofa, esiSuggest, suggestArea, ESI_STYLE, TREATMENT_AREAS,
  type Vitals, type ESIBand,
} from "@/lib/erClinical"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

// Vital range validation — flag values outside plausible human ranges.
const VITAL_RANGES: Record<string, { min: number; max: number; label: string; unit: string }> = {
  rr:    { min: 5,  max: 60,  label: 'Respiratory rate', unit: '/min' },
  spo2:  { min: 50, max: 100, label: 'SpO₂',              unit: '%'    },
  sbp:   { min: 50, max: 260, label: 'Systolic BP',       unit: 'mmHg' },
  hr:    { min: 25, max: 250, label: 'Heart rate',        unit: 'bpm'  },
  temp:  { min: 28, max: 43,  label: 'Temperature',       unit: '°C'   },
  gcs:   { min: 3,  max: 15,  label: 'GCS',               unit: ''     },
  capRefill: { min: 0, max: 10, label: 'Cap refill', unit: 's' },
}
function validateVitals(v: Vitals, fmt: (key: string, label: string, value: number, unit: string, min: number, max: number) => string): string[] {
  const errs: string[] = []
  for (const key of ['rr','spo2','sbp','hr','temp','gcs','capRefill'] as const) {
    const range = VITAL_RANGES[key]
    const val = v[key]
    if (!range || typeof val !== 'number') continue
    if (val < range.min || val > range.max) errs.push(fmt(key, range.label, val, range.unit, range.min, range.max))
  }
  return errs
}

const ARRIVAL_STYLE: Record<Arrival, string> = {
  walk_in: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  ambulance: 'bg-red-50 text-red-700',
  transfer: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
}

const minsSince = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

export default function TriagePage() {
  const t = useTranslations('emergency')
  const patients = useERStore(s => s.patients)
  const mci = useERStore(s => s.mciActive)
  const registerArrival = useERStore(s => s.registerArrival)
  const recordVitals = useERStore(s => s.recordVitals)
  const setESI = useERStore(s => s.setESI)
  const routeToArea = useERStore(s => s.routeToArea)

  const [tab, setTab] = useState<'awaiting' | 'triaged'>('awaiting')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [vitalsDraft, setVitalsDraft] = useState<Record<string, Vitals>>({})
  const [showRegister, setShowRegister] = useState(false)
  const [reg, setReg] = useState({
    name: '', age: '', gender: 'M' as 'M' | 'F' | 'X',
    arrival: 'walk_in' as Arrival,
    chiefComplaint: '', trauma: false,
    phone: '', attendantName: '', attendantPhone: '',
    unconscious: false,
    insurer: '', policyNumber: '',
  })

  const { awaiting, triaged } = useMemo(() => ({
    awaiting: patients.filter(p => p.phase === 'awaiting_triage'),
    triaged: patients.filter(p => p.phase === 'triaged'),
  }), [patients])

  const getDraft = (id: string): Vitals => vitalsDraft[id] ?? {}
  const setDraft = (id: string, patch: Partial<Vitals>) =>
    setVitalsDraft(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }))

  const saveVitals = (p: ERPatient) => {
    const v = getDraft(p.id)
    // M13.10 — vitals are OPTIONAL throughout the ER flow. ESI + treatment-
    // area routing + disposition can all be applied without them. The Save
    // button is here for convenience; clicking it with nothing entered is a
    // silent no-op rather than an error.
    if (Object.keys(v).length === 0) { return }
    const errs = validateVitals(v, (key, label, value, unit, min, max) =>
      t('triage.vitalOutsideRange', {
        label: t.has(`triage.vitalLabel.${key}`) ? t(`triage.vitalLabel.${key}`) : label,
        value, unit, min, max,
      }))
    if (errs.length > 0) {
      toast.error(t('triage.outOfRangeVital'), { description: errs.join(' · ') })
      return
    }
    recordVitals(p.id, v, ER_TRIAGE_NURSE.name)
    setVitalsDraft(prev => { const c = { ...prev }; delete c[p.id]; return c })
    // NEWS2 auto-alert: high score pages the on-duty doctor + ER physician.
    const score = news2(v)
    if (score.band === 'high' || score.score >= 5) {
      notifyAndAuditMany(['doctor', 'emergency'], {
        type: 'critical_value', priority: 'critical',
        title: t('triage.news2AlertTitle', { score: score.score, name: p.name }),
        body: t('triage.news2AlertBody', { name: p.name, id: p.id, score: score.score, band: score.band, trigger: score.trigger }),
        patientName: p.name,
        audit: { action: 'er_triage', resource: 'er_patient', resourceId: p.id, detail: `NEWS2 ${score.score} (${score.band}) auto-alert · ${score.trigger}`, userName: ER_TRIAGE_NURSE.name },
      })
      toast.warning(t('triage.news2Notified', { score: score.score, band: score.band }), { description: score.trigger })
    } else {
      toast.success(t('triage.vitalsRecorded', { name: p.name, score: score.score }))
    }
  }

  const applyESI = (p: ERPatient, level: ESIBand, reason: string) => {
    setESI(p.id, level, reason)
    const area = suggestArea(level, p.trauma)
    routeToArea(p.id, area)
    // Notify the treatment-area staff so they know the patient is incoming.
    notifyAndAudit({
      to: level <= 2 ? 'doctor' : 'nurse',
      type: 'system', priority: level <= 2 ? 'critical' : 'high',
      title: t('triage.patientRouted', { name: p.name }),
      body: t('triage.patientRoutedBody', { name: p.name, level, area: TREATMENT_AREAS.find(a => a.code === area)?.label ?? area, reason }),
      patientName: p.name,
      audit: { action: 'er_triage', resource: 'er_patient', resourceId: p.id, detail: `ESI ${level} · ${area} · ${reason}`, userName: ER_TRIAGE_NURSE.name },
    })
    toast.success(t('triage.triagedRouted', { name: p.name, level, area: TREATMENT_AREAS.find(a => a.code === area)?.label ?? area }))
  }

  const submitRegister = () => {
    // M13.10 — name + chief complaint required UNLESS unconscious case
    // (NABH ACC.4.1 deferred-registration path).
    if (!reg.chiefComplaint.trim()) { toast.error(t('triage.chiefComplaintRequired')); return }
    if (!reg.unconscious && !reg.name.trim()) { toast.error(t('triage.nameRequired')); return }
    if (reg.insurer && !reg.insurer.trim()) { toast.error(t('triage.insurerRequired')); return }
    // Patient dedup — flag if a patient with the same name arrived in the
    // last 24h. Skip for unconscious (no name to compare).
    if (reg.name.trim()) {
      const since = Date.now() - 24 * 3600 * 1000
      const possibleDupe = patients.find(p => p.name.trim().toLowerCase() === reg.name.trim().toLowerCase() && new Date(p.arrivedAt).getTime() >= since)
      if (possibleDupe && !window.confirm(t('triage.dupeConfirm', { name: reg.name, phase: possibleDupe.phase }))) {
        return
      }
    }
    const age = parseInt(reg.age, 10) || 0
    registerArrival({
      name: reg.name.trim() || undefined,
      age: age || undefined,
      gender: reg.gender,
      arrival: reg.arrival, chiefComplaint: reg.chiefComplaint.trim(), trauma: reg.trauma,
      phone: reg.phone.trim() || undefined,
      attendantName: reg.attendantName.trim() || undefined,
      attendantPhone: reg.attendantPhone.trim() || undefined,
      unconscious: reg.unconscious,
      insurer: reg.insurer.trim() || undefined,
      policyNumber: reg.policyNumber.trim() || undefined,
    })
    const who = reg.name.trim() || t('triage.unidentifiedPatient')
    const extras: string[] = []
    if (reg.attendantPhone) extras.push(t('triage.smsSentAttendant'))
    if (reg.insurer) extras.push(t('triage.insuranceNotified', { insurer: reg.insurer }))
    if (reg.unconscious) extras.push(t('triage.tempUhidDeferred'))
    toast.success(t('triage.registeredAwaiting', { who }) + (extras.length ? ' · ' + extras.join(' · ') : ''))
    setReg({
      name: '', age: '', gender: 'M', arrival: 'walk_in',
      chiefComplaint: '', trauma: false,
      phone: '', attendantName: '', attendantPhone: '',
      unconscious: false, insurer: '', policyNumber: '',
    })
    setShowRegister(false)
  }

  // ── ER quick orders — physician can place lab / Rx / imaging from the bedside.
  function placeERLab(p: ERPatient) {
    notifyAndAudit({
      to: 'lab', type: 'system', priority: p.esi && p.esi <= 2 ? 'critical' : 'high',
      title: t('triage.statLabTitle', { name: p.name }),
      body: t('triage.statLabBody', { name: p.name, complaint: p.chiefComplaint }),
      patientName: p.name,
      audit: { action: 'lab_order', resource: 'er_patient', resourceId: p.id, detail: t('triage.statLabDetail', { complaint: p.chiefComplaint }), userName: t('triage.erPhysician') },
    })
    toast.success(t('triage.statLabToast', { name: p.name }))
  }
  function placeERImaging(p: ERPatient) {
    notifyAndAudit({
      to: 'radiology', type: 'system', priority: 'high',
      title: t('triage.imagingTitle', { name: p.name }),
      body: t('triage.imagingBody', { name: p.name, complaint: p.chiefComplaint }),
      patientName: p.name,
      audit: { action: 'radiology_order', resource: 'er_patient', resourceId: p.id, detail: t('triage.imagingDetail', { complaint: p.chiefComplaint }), userName: t('triage.erPhysician') },
    })
    toast.success(t('triage.imagingToast', { name: p.name }))
  }
  function placeERRx(p: ERPatient) {
    notifyAndAudit({
      to: 'pharmacy', type: 'medicines_ready', priority: 'high',
      title: t('triage.rxTitle', { name: p.name }),
      body: t('triage.rxBody', { name: p.name }),
      patientName: p.name,
      audit: { action: 'prescription_create', resource: 'er_patient', resourceId: p.id, detail: t('triage.rxDetail', { name: p.name }), userName: t('triage.erPhysician') },
    })
    toast.success(t('triage.rxToast', { name: p.name }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <Ambulance className="h-6 w-6 text-red-600" /> {t('triage.title')}
          </h1>
          <p className="text-sm text-[#64748B] mt-1">{t('triage.subtitle')}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {mci && (
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-red-100 text-red-700 ring-1 ring-red-300 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />{t('mci.mode')}
            </span>
          )}
          <button onClick={() => setShowRegister(s => !s)}
            className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer"
            style={{ background: 'linear-gradient(135deg,#EF4444,#EE6B26)', boxShadow: '0 2px 8px rgba(239,68,68,0.25)' }}>
            <UserPlus className="h-3.5 w-3.5" />{t('triage.registerArrival')}
          </button>
        </div>
      </div>

      {showRegister && (
        <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 space-y-3">
          {/* M13.10 — Two-mode registration:
              · Standard: name + age + gender + contact + chief complaint
              · Unconscious / unidentified: deferred-registration (NABH ACC.4.1)
                — UHID becomes ER-TEMP-XXXXX, SMS deferred until ID captured. */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{t('triage.registerHeading')}</p>
            <label className={cn("flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer transition",
              reg.unconscious ? 'bg-red-50 border-red-300 text-red-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}>
              <input type="checkbox" checked={reg.unconscious}
                onChange={e => setReg(r => ({ ...r, unconscious: e.target.checked }))}
                className="h-3 w-3" />
              {t('triage.unconsciousToggle')}
            </label>
          </div>

          {/* Identity row */}
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
            <input value={reg.name} onChange={e => setReg(r => ({ ...r, name: e.target.value }))}
              placeholder={reg.unconscious ? t('triage.namePlaceholderOptional') : t('triage.namePlaceholderRequired')}
              className="sm:col-span-2 h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={reg.age} onChange={e => setReg(r => ({ ...r, age: e.target.value }))}
              placeholder={t('triage.agePlaceholder')} type="number"
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <Select value={reg.gender} onChange={e => setReg(r => ({ ...r, gender: e.target.value as 'M' | 'F' | 'X' }))}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200">
              <option value="M">{t('triage.genderMale')}</option><option value="F">{t('triage.genderFemale')}</option><option value="X">{t('triage.genderOther')}</option>
            </Select>
            <Select value={reg.arrival} onChange={e => setReg(r => ({ ...r, arrival: e.target.value as Arrival }))}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200">
              <option value="walk_in">{t('triage.arrivalWalkIn')}</option>
              <option value="ambulance">{t('triage.arrivalAmbulance')}</option>
              <option value="transfer">{t('triage.arrivalTransfer')}</option>
            </Select>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold px-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={reg.trauma} onChange={e => setReg(r => ({ ...r, trauma: e.target.checked }))} className="h-3 w-3" />
              <span>{t('triage.trauma')}</span>
            </label>
          </div>

          {/* Contact row — required for SMS-link to attendant */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <input value={reg.phone} onChange={e => setReg(r => ({ ...r, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              placeholder={t('triage.patientPhonePlaceholder')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={reg.attendantName} onChange={e => setReg(r => ({ ...r, attendantName: e.target.value }))}
              placeholder={t('triage.attendantNamePlaceholder')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={reg.attendantPhone} onChange={e => setReg(r => ({ ...r, attendantPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              placeholder={t('triage.attendantPhonePlaceholder')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>

          {/* Insurance row — optional, fires cashless notify */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <input value={reg.insurer} onChange={e => setReg(r => ({ ...r, insurer: e.target.value }))}
              placeholder={t('triage.insurerPlaceholder')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
            <input value={reg.policyNumber} onChange={e => setReg(r => ({ ...r, policyNumber: e.target.value }))}
              placeholder={t('triage.policyPlaceholder')}
              className="h-9 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>

          {/* Chief complaint */}
          <input value={reg.chiefComplaint} onChange={e => setReg(r => ({ ...r, chiefComplaint: e.target.value }))}
            placeholder={t('triage.chiefComplaintPlaceholder')}
            className="w-full h-9 px-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-200" />

          {/* What will happen on save — explicit so the user knows */}
          <div className="rounded-md bg-slate-50 border border-slate-200 p-2 text-[10.5px] text-slate-600 space-y-0.5">
            <p className="font-bold text-slate-700">{t('triage.onSaveHeading')}</p>
            <p>{t.rich('triage.onSaveUhid', {
              uhid: () => reg.unconscious || !reg.name.trim()
                ? <span className="font-bold text-amber-700">ER-TEMP-XXXXX</span>
                : <span className="font-bold text-emerald-700">PT-XXXXX</span>,
            })}</p>
            {reg.attendantPhone && !reg.unconscious && <p>{t.rich('triage.onSaveSms', {
              phone: () => <span className="font-mono">+91 {reg.attendantPhone}</span>,
            })}</p>}
            {reg.insurer && <p>{t.rich('triage.onSaveInsurer', {
              insurer: () => <b>{reg.insurer}</b>,
            })}</p>}
            <p>{t('triage.onSaveQueue')}</p>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowRegister(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer px-3 py-1.5">{t('triage.cancel')}</button>
            <button onClick={submitRegister}
              className="text-xs font-bold text-white px-4 py-1.5 rounded-lg cursor-pointer"
              style={{ background: 'linear-gradient(135deg,#EF4444,#EE6B26)' }}>
              {t('triage.registerSubmit')}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        {([['awaiting', t('triage.tabAwaiting', { count: awaiting.length })], ['triaged', t('triage.tabTriaged', { count: triaged.length })]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition',
              tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {(tab === 'awaiting' ? awaiting : triaged).length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Activity className="h-9 w-9 mb-2 opacity-40" />
            <p className="text-sm font-semibold">{tab === 'awaiting' ? t('triage.queueClear') : t('triage.noPatientsWaiting')}</p>
          </div>
        )}
        {(tab === 'awaiting' ? awaiting : triaged).map(p => (
          <TriageRow key={p.id} p={p}
            expanded={expandedId === p.id}
            draft={getDraft(p.id)}
            onToggle={() => setExpandedId(id => id === p.id ? null : p.id)}
            onDraft={(patch) => setDraft(p.id, patch)}
            onSaveVitals={() => saveVitals(p)}
            onApplyESI={(level, reason) => applyESI(p, level, reason)}
            onOrderLab={() => placeERLab(p)}
            onOrderImaging={() => placeERImaging(p)}
            onOrderRx={() => placeERRx(p)}
          />
        ))}
      </div>
    </div>
  )
}

function TriageRow(props: {
  p: ERPatient
  expanded: boolean
  draft: Vitals
  onToggle: () => void
  onDraft: (patch: Partial<Vitals>) => void
  onSaveVitals: () => void
  onApplyESI: (level: ESIBand, reason: string) => void
  onOrderLab: () => void
  onOrderImaging: () => void
  onOrderRx: () => void
}) {
  const t = useTranslations('emergency')
  const { p, expanded, draft } = props
  const mins = minsSince(p.arrivedAt)
  const vitals = latestVitals(p)
  const news = vitals ? news2(vitals) : null
  const qs = vitals ? qsofa(vitals) : null
  const suggestion = vitals ? esiSuggest({ vitals, chiefComplaint: p.chiefComplaint, age: p.age, trauma: p.trauma }) : null
  const draftSuggestion = Object.keys(draft).length > 0
    ? esiSuggest({ vitals: draft, chiefComplaint: p.chiefComplaint, age: p.age, trauma: p.trauma }) : null

  return (
    <div className={cn('rounded-xl bg-white ring-1 overflow-hidden',
      news?.band === 'high' ? 'ring-red-200' : qs?.positive ? 'ring-primary/25' : 'ring-slate-200/70')}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className={cn('flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg', ARRIVAL_STYLE[p.arrival])}>{t(`triage.arrivalLabel.${p.arrival}`)}</span>

        <button onClick={props.onToggle} className="flex-1 min-w-0 text-left cursor-pointer">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 truncate">{p.name}</span>
            <span className="text-[11px] font-bold text-slate-400">{p.age}{p.gender}</span>
            {p.trauma && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" />{t('floor.trauma')}</span>}
            {p.esi && <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', ESI_STYLE[p.esi].bg, ESI_STYLE[p.esi].fg)}>{ESI_STYLE[p.esi].label}</span>}
            {news && news.band !== 'low' && <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded',
              news.band === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>NEWS2 {news.score}</span>}
            {qs?.positive && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-accent">{t('triage.qsofaSepsis')}</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1 flex-wrap">
            <span>{p.chiefComplaint}</span>
            <span className="text-slate-400 mx-1">·</span>
            <Clock className="h-3 w-3" />{t('triage.inDept', { mins })}
          </p>
        </button>

        <button onClick={props.onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">{t('triage.recordVitals')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              <VitalInput label="RR" unit="/min" icon={Wind} value={draft.rr} onChange={v => props.onDraft({ rr: v })} />
              <VitalInput label="SpO2" unit="%" value={draft.spo2} onChange={v => props.onDraft({ spo2: v })} />
              <label className="flex items-center gap-1 text-[11px] font-semibold rounded-lg bg-white ring-1 ring-slate-200 px-2.5 py-2 cursor-pointer">
                <input type="checkbox" checked={!!draft.onOxygen} onChange={e => props.onDraft({ onOxygen: e.target.checked })} />
                {t('triage.onOxygen')}
              </label>
              <VitalInput label="SBP" unit="mmHg" icon={Heart} value={draft.sbp} onChange={v => props.onDraft({ sbp: v })} />
              <VitalInput label="HR" unit="bpm" icon={Heart} value={draft.hr} onChange={v => props.onDraft({ hr: v })} />
              <VitalInput label="Temp" unit="°C" step="0.1" icon={Thermometer} value={draft.temp} onChange={v => props.onDraft({ temp: v })} />
              <VitalInput label="GCS" unit="/15" value={draft.gcs} onChange={v => props.onDraft({ gcs: v })} />
            </div>
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mr-1">{t('triage.quickOrders')}</span>
                <button onClick={props.onOrderLab}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 cursor-pointer">
                  {t('triage.statLab')}
                </button>
                <button onClick={props.onOrderImaging}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.12)] border border-primary/20 cursor-pointer">
                  {t('triage.imaging')}
                </button>
                <button onClick={props.onOrderRx}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.14)] border border-[rgba(238,107,38,0.20)] cursor-pointer">
                  {t('triage.erRx')}
                </button>
              </div>
              <button onClick={props.onSaveVitals}
                className="text-[11px] font-bold text-white px-3 py-1.5 rounded-lg cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#EF4444,#EE6B26)' }}>
                {t('floor.saveVitals')}
              </button>
            </div>
          </div>

          {(news || qs || draftSuggestion) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {news && (
                <div className={cn('rounded-lg p-2.5 ring-1',
                  news.band === 'high' ? 'ring-red-200 bg-red-50' : news.band === 'medium' ? 'ring-amber-200 bg-amber-50' : 'ring-slate-200 bg-white')}>
                  <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1"><Activity className="h-3 w-3" />NEWS2</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{news.score}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-3">{news.trigger}</p>
                </div>
              )}
              {qs && (
                <div className={cn('rounded-lg p-2.5 ring-1',
                  qs.positive ? 'ring-primary/25 bg-primary-soft' : 'ring-slate-200 bg-white')}>
                  <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1"><ShieldAlert className="h-3 w-3" />qSOFA</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{qs.score} {qs.positive && <span className="text-[10px] text-accent font-bold">{t('triage.sepsisRisk')}</span>}</p>
                  <p className="text-[10px] text-slate-500">{qs.criteria.length ? qs.criteria.join(' · ') : t('triage.noCriteriaMet')}</p>
                </div>
              )}
              {(draftSuggestion ?? suggestion) && (
                <div className={cn('rounded-lg p-2.5 ring-1', 'ring-primary/25 bg-[rgba(238,107,38,0.07)]')}>
                  <p className="text-[11px] font-bold text-[var(--color-accent)] flex items-center gap-1">{t('triage.aiEsiSuggestion')}</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">ESI {(draftSuggestion ?? suggestion)!.level}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{(draftSuggestion ?? suggestion)!.reason}</p>
                </div>
              )}
            </div>
          )}

          {(suggestion || draftSuggestion) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] font-semibold text-slate-500">{t('triage.applyEsi')}</span>
              {([1, 2, 3, 4, 5] as ESIBand[]).map(lvl => {
                const sug = draftSuggestion ?? suggestion
                const isSuggested = sug && sug.level === lvl
                return (
                  <button key={lvl} onClick={() => props.onApplyESI(lvl, isSuggested ? sug!.reason : t('triage.manualTriage'))}
                    className={cn('text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer ring-1',
                      isSuggested ? `${ESI_STYLE[lvl].bg} ${ESI_STYLE[lvl].fg} ring-current` : 'bg-white ring-slate-200 text-slate-600 hover:bg-slate-50')}>
                    {ESI_STYLE[lvl].label}{isSuggested ? ' ★' : ''}
                  </button>
                )
              })}
              <Send className="h-3 w-3 text-slate-400 ml-auto" />
              <span className="text-[10px] text-slate-400">{t('triage.routesTo', { area: TREATMENT_AREAS.find(a => a.code === suggestArea(((draftSuggestion ?? suggestion)?.level ?? 5), p.trauma))?.label ?? '' })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function VitalInput({ label, unit, value, onChange, step = '1', icon: Icon }: {
  label: string; unit: string; value?: number; step?: string
  onChange: (v: number | undefined) => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-lg bg-white ring-1 ring-slate-200 px-2 py-1.5">
      <label className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
        {Icon && <Icon className="h-3 w-3" />}{label}
      </label>
      <div className="flex items-center gap-1 mt-0.5">
        <input
          type="number" step={step}
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-full text-sm font-bold text-slate-900 bg-transparent focus:outline-none"
        />
        <span className="text-[10px] text-slate-400">{unit}</span>
      </div>
    </div>
  )
}
