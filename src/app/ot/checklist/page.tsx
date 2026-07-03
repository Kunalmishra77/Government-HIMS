"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import {
  ClipboardCheck, Bed, Stethoscope, ChevronDown, ChevronRight, ShieldCheck,
  CheckCircle, Hourglass, AlertTriangle, Sparkles, Heart, Wind, FileText, X,
} from "lucide-react"
import {
  useOTStore,
  type OTProcedure, type WHOPhase, type ASAClass, type Mallampati, type Pillar, type Clearance,
  ASA_DESC,
} from "@/store/useOTStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const ALL_PILLARS: Pillar[] = ['surgical', 'anesthesia', 'nursing', 'lab', 'pharmacy', 'bloodbank', 'imaging', 'cssd']
const PHASE_TINT: Record<WHOPhase, string> = {
  sign_in: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25',
  time_out: 'bg-amber-50 text-amber-700 ring-amber-200',
  sign_out: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}
const CLEARANCE_TINT: Record<Clearance, string> = {
  pending: 'bg-amber-100 text-amber-700 ring-amber-200',
  cleared: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  na: 'bg-slate-100 text-slate-500 ring-slate-200',
}

export default function OTCaseWorkflow() {
  const t = useTranslations('ot')
  const timeAgo = (iso?: string) => {
    if (!iso) return ''
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 60) return t('checklist.minsAgo', { mins })
    return t('checklist.hoursAgo', { hours: Math.round(mins / 60) })
  }
  const procedures = useOTStore(s => s.procedures)
  const checkWHO = useOTStore(s => s.checkWHO)
  const setClearance = useOTStore(s => s.setClearance)
  const setASA = useOTStore(s => s.setASA)
  const setMallampati = useOTStore(s => s.setMallampati)
  const setAnesthesiaTechnique = useOTStore(s => s.setAnesthesiaTechnique)
  const setCount = useOTStore(s => s.setCount)
  const confirmCounts = useOTStore(s => s.confirmCounts)
  const addSpecimen = useOTStore(s => s.addSpecimen)
  const recordDebrief = useOTStore(s => s.recordDebrief)
  const updateStatus = useOTStore(s => s.updateStatus)

  // Pick the first non-completed procedure by default
  const defaultId = useMemo(() => procedures.find(p => p.status !== 'Completed')?.id ?? procedures[0]?.id ?? '', [procedures])
  const [activeId, setActiveId] = useState(defaultId)
  const active = procedures.find(p => p.id === activeId) ?? procedures[0]

  const [openPhase, setOpenPhase] = useState<WHOPhase | null>('sign_in')
  const [specimenLabel, setSpecimenLabel] = useState('')
  const [debriefDraft, setDebriefDraft] = useState({ complications: '', lessons: '', postOpInstructions: '' })

  if (!active) {
    return <div className="p-8 text-center text-slate-400">{t('checklist.noProcedures')}</div>
  }

  const clearance = active.clearance ?? {} as Record<Pillar, Clearance>
  const allCleared = Object.values(clearance).every(c => c === 'cleared' || c === 'na')
  const allPillars = ALL_PILLARS

  const items = active.whoChecklist ?? []
  const phaseItems = (phase: WHOPhase) => items.filter(i => i.phase === phase)
  const phaseProgress = (phase: WHOPhase) => {
    const arr = phaseItems(phase); const done = arr.filter(i => i.checked).length
    return { done, total: arr.length }
  }

  const onSpecimenAdd = () => {
    if (!specimenLabel.trim()) { toast.error(t('checklist.specimenLabelRequired')); return }
    addSpecimen(active.id, specimenLabel.trim())
    toast.success(t('checklist.specimenLogged'))
    setSpecimenLabel('')
  }

  const counts = active.counts ?? {}
  const onCount = (kind: 'sponges'|'instruments'|'needles', side: 'initial'|'final', raw: string) => {
    const v = parseInt(raw, 10)
    if (!isNaN(v)) setCount(active.id, kind, side, v)
  }
  const countLabel = (kind: 'sponges'|'instruments'|'needles') =>
    t(`checklist.count${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as 'checklist.countSponges' | 'checklist.countInstruments' | 'checklist.countNeedles')
  const onConfirmCount = (kind: 'sponges'|'instruments'|'needles') => {
    const c = counts[kind] ?? {}
    if (c.initial === undefined || c.final === undefined) { toast.error(t('checklist.enterBothCounts')); return }
    confirmCounts(active.id, kind, c.initial === c.final)
    toast(c.initial === c.final ? t('checklist.countCorrect', { kind: countLabel(kind) }) : t('checklist.countDiscrepancy', { kind: countLabel(kind) }))
  }

  const onCompleteCase = () => {
    if (!allCleared) { toast.error(t('checklist.allPillarsCleared')); return }
    const signOutItems = phaseItems('sign_out')
    const incomplete = signOutItems.filter(i => i.critical && !i.checked)
    if (incomplete.length > 0) { toast.error(t('checklist.signOutIncomplete', { label: incomplete[0].label })); return }
    if (active.status !== 'Completed') updateStatus(active.id, 'Completed')
    toast.success(t('checklist.caseCompleted', { patient: active.patientName }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[var(--color-accent)]" /> {t('checklist.title')}
          </h1>
          <p className="text-sm text-[#64748B] mt-1">{t('checklist.subtitle')}</p>
        </div>
      </div>

      {/* Case picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-slate-500">{t('checklist.case')}</span>
        {procedures.map(p => (
          <button key={p.id} onClick={() => setActiveId(p.id)}
            className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ring-1',
              p.id === activeId ? 'bg-[var(--color-primary)] text-white ring-primary/20' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
            {t('checklist.caseLabel', { patient: p.patientName, room: p.otRoom })}
          </button>
        ))}
      </div>

      {/* Patient header */}
      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
            {active.patientName} <span className="text-[11px] font-bold text-slate-400">{t('checklist.patientAge', { age: active.patientAge })}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">{active.otRoom}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{t.has(`status.${active.status}`) ? t(`status.${active.status}`) : active.status}</span>
            {active.bloodRequired && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">{t('checklist.bloodRx')}</span>}
          </p>
          <p className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1">
            <Stethoscope className="h-3 w-3" />{t('checklist.anaesthetistMeta', { surgeon: active.surgeon, anaesthetist: active.anaesthetist })}
          </p>
          <p className="text-[13px] font-bold text-[var(--color-accent)] mt-1">{active.procedureName}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('checklist.scheduled')}</p>
          <p className="text-sm font-bold text-slate-900">{active.scheduledTime}</p>
          <p className="text-[11px] text-slate-500">{t('checklist.durationApprox', { mins: active.durationMinutes })}</p>
        </div>
      </div>

      {/* Pre-op clearance pillars */}
      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" />{t('checklist.preOpClearance')}</h2>
          {allCleared
            ? <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">{t('checklist.allCleared')}</span>
            : <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700">{t('checklist.pending')}</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {allPillars.map(p => {
            const status = clearance[p] ?? 'pending'
            return (
              <div key={p} className={cn('rounded-lg ring-1 p-2 text-center', CLEARANCE_TINT[status])}>
                <p className="text-[10px] font-bold uppercase tracking-wide">{t(`pillar.${p}`)}</p>
                <p className="text-[10px] font-bold mt-0.5 uppercase">{status === 'na' ? t('checklist.na') : (t.has(`clearanceStatus.${status}`) ? t(`clearanceStatus.${status}`) : status)}</p>
                <div className="flex justify-center gap-1 mt-1.5">
                  <button onClick={() => setClearance(active.id, p, 'cleared')}
                    className={cn('w-5 h-5 rounded text-[10px] font-bold', status === 'cleared' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:bg-emerald-50')}>✓</button>
                  <button onClick={() => setClearance(active.id, p, 'na')}
                    className={cn('w-5 h-5 rounded text-[9px] font-bold', status === 'na' ? 'bg-slate-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-100')}>—</button>
                  <button onClick={() => setClearance(active.id, p, 'pending')}
                    className={cn('w-5 h-5 rounded text-[10px] font-bold', status === 'pending' ? 'bg-amber-500 text-white' : 'bg-white text-slate-500 hover:bg-amber-50')}>?</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* WHO checklist phases */}
      <div className="space-y-2">
        {(['sign_in', 'time_out', 'sign_out'] as WHOPhase[]).map(phase => {
          const { done, total } = phaseProgress(phase)
          const allDone = total > 0 && done === total
          const open = openPhase === phase
          return (
            <div key={phase} className={cn('rounded-xl bg-white ring-1 overflow-hidden',
              allDone ? 'ring-emerald-200' : 'ring-slate-200')}>
              <button onClick={() => setOpenPhase(open ? null : phase)} className="w-full flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-slate-50">
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-lg ring-1', PHASE_TINT[phase])}>{t(`phase.${phase}`)}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-slate-900">{
                    phase === 'sign_in' ? t('checklist.phaseSignInDesc') :
                    phase === 'time_out' ? t('checklist.phaseTimeOutDesc') :
                    t('checklist.phaseSignOutDesc')
                  }</p>
                  <p className="text-[11px] text-slate-500">{t('checklist.itemsConfirmed', { done, total, state: allDone ? t('checklist.stateComplete') : t('checklist.stateInProgress') })}</p>
                </div>
                {allDone && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              </button>

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-2">
                  {phaseItems(phase).map(item => (
                    <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                      <input type="checkbox" checked={item.checked} onChange={() => checkWHO(active.id, item.id)}
                        className="mt-0.5 accent-blue-600" />
                      <span className={cn('text-[13px] flex-1',
                        item.checked ? 'text-slate-500 line-through' : 'text-slate-800')}>
                        {item.label}
                        {item.critical && !item.checked && <span className="ml-1.5 text-[10px] font-bold text-red-600">{t('checklist.critical')}</span>}
                      </span>
                    </label>
                  ))}

                  {/* Phase-specific extras */}
                  {phase === 'sign_in' && (
                    <AnesthesiaPanel
                      procedureId={active.id}
                      asa={active.anesthesia?.asa}
                      mallampati={active.anesthesia?.mallampati}
                      technique={active.anesthesia?.technique}
                      setASA={(a) => setASA(active.id, a)}
                      setMallampati={(m) => setMallampati(active.id, m)}
                      setTechnique={(t) => setAnesthesiaTechnique(active.id, t)}
                    />
                  )}
                  {phase === 'sign_out' && (
                    <>
                      {/* Counts */}
                      <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('checklist.counts')}</p>
                        {(['sponges','instruments','needles'] as const).map(k => {
                          const c = counts[k] ?? {}
                          return (
                            <div key={k} className="flex items-center gap-2 flex-wrap text-[12px]">
                              <span className="font-semibold text-slate-700 w-24 capitalize">{countLabel(k)}</span>
                              <label className="text-[11px] text-slate-500">{t('checklist.initial')}</label>
                              <input type="number" value={c.initial ?? ''} onChange={e => onCount(k, 'initial', e.target.value)}
                                className="w-16 h-7 px-2 rounded-md border border-slate-200" />
                              <label className="text-[11px] text-slate-500">{t('checklist.final')}</label>
                              <input type="number" value={c.final ?? ''} onChange={e => onCount(k, 'final', e.target.value)}
                                className="w-16 h-7 px-2 rounded-md border border-slate-200" />
                              <button onClick={() => onConfirmCount(k)}
                                className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1 rounded cursor-pointer">{t('checklist.confirm')}</button>
                              {c.correct === true && <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5"><CheckCircle className="h-3 w-3" />{t('checklist.correct')}</span>}
                              {c.correct === false && <span className="text-[11px] font-bold text-red-700 flex items-center gap-0.5"><X className="h-3 w-3" />{t('checklist.discrepancy')}</span>}
                            </div>
                          )
                        })}
                      </div>

                      {/* Specimens */}
                      <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('checklist.specimens')}</p>
                        <div className="space-y-1">
                          {(active.specimens ?? []).map(sp => (
                            <p key={sp.id} className="text-[12px] text-slate-700 flex items-center gap-2">
                              <FileText className="h-3 w-3 text-slate-400" /><b>{sp.label}</b>
                              <span className="text-[10px] text-slate-400">{t('checklist.specimenMeta', { sentTo: sp.sentTo ?? "", time: new Date(sp.collectedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })}</span>
                            </p>
                          ))}
                          {(active.specimens ?? []).length === 0 && <p className="text-[11px] text-slate-400 italic">{t('checklist.noSpecimens')}</p>}
                        </div>
                        <div className="flex gap-1.5">
                          <input value={specimenLabel} onChange={e => setSpecimenLabel(e.target.value)}
                            placeholder={t('checklist.specimenPlaceholder')}
                            className="flex-1 h-7 px-2 text-[11px] rounded-md border border-slate-200" />
                          <button onClick={onSpecimenAdd}
                            className="text-[11px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-2.5 py-1 rounded cursor-pointer">{t('checklist.log')}</button>
                        </div>
                      </div>

                      {/* Debrief */}
                      <div className="rounded-lg bg-white ring-1 ring-slate-200 p-3 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('checklist.debrief')}</p>
                        <textarea rows={2} value={debriefDraft.complications} onChange={e => setDebriefDraft(d => ({ ...d, complications: e.target.value }))}
                          placeholder={t('checklist.complicationsPlaceholder')}
                          className="w-full text-[12px] rounded-md border border-slate-200 p-1.5" />
                        <textarea rows={2} value={debriefDraft.lessons} onChange={e => setDebriefDraft(d => ({ ...d, lessons: e.target.value }))}
                          placeholder={t('checklist.lessonsPlaceholder')}
                          className="w-full text-[12px] rounded-md border border-slate-200 p-1.5" />
                        <textarea rows={2} value={debriefDraft.postOpInstructions} onChange={e => setDebriefDraft(d => ({ ...d, postOpInstructions: e.target.value }))}
                          placeholder={t('checklist.postOpPlaceholder')}
                          className="w-full text-[12px] rounded-md border border-slate-200 p-1.5" />
                        <div className="flex justify-end">
                          <button onClick={() => { recordDebrief(active.id, debriefDraft); toast.success(t('checklist.debriefRecorded')) }}
                            className="text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded cursor-pointer">{t('checklist.saveDebrief')}</button>
                        </div>
                        {active.debrief?.recordedAt && (
                          <p className="text-[10px] text-emerald-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" />{t('checklist.recorded', { ago: timeAgo(active.debrief.recordedAt) })}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Complete case */}
      <div className="flex justify-end">
        <button onClick={onCompleteCase}
          className="flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl cursor-pointer"
          style={{ background: 'linear-gradient(135deg,#16A34A,var(--color-primary-dark))', boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }}>
          <CheckCircle className="h-4 w-4" />{t('checklist.completeCase')}
        </button>
      </div>
    </div>
  )
}

function AnesthesiaPanel(props: {
  procedureId: string
  asa?: ASAClass
  mallampati?: Mallampati
  technique?: 'GA' | 'Spinal' | 'Epidural' | 'CSE' | 'Regional' | 'MAC' | 'Local'
  setASA: (a: ASAClass) => void
  setMallampati: (m: Mallampati) => void
  setTechnique: (t: 'GA' | 'Spinal' | 'Epidural' | 'CSE' | 'Regional' | 'MAC' | 'Local') => void
}) {
  const t = useTranslations('ot')
  return (
    <div className="rounded-lg bg-white ring-1 ring-primary/25 p-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] flex items-center gap-1"><Sparkles className="h-3 w-3" />{t('checklist.anaesthesiaAssessment')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px]">
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t('checklist.asa')}</label>
          <div className="flex gap-1">
            {(['1','2','3','4','5','6'] as ASAClass[]).map(a => (
              <button key={a} onClick={() => props.setASA(a)}
                className={cn('flex-1 text-[11px] font-bold px-1.5 py-1 rounded',
                  props.asa === a ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{a}</button>
            ))}
          </div>
          {props.asa && <p className="text-[10px] text-slate-500 mt-1">{ASA_DESC[props.asa]}</p>}
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t('checklist.mallampati')}</label>
          <div className="flex gap-1">
            {([1,2,3,4] as Mallampati[]).map(m => (
              <button key={m} onClick={() => props.setMallampati(m)}
                className={cn('flex-1 text-[11px] font-bold px-1.5 py-1 rounded',
                  props.mallampati === m ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">{t('checklist.technique')}</label>
          <Select value={props.technique ?? ''} onChange={e => props.setTechnique(e.target.value as 'GA' | 'Spinal' | 'Epidural' | 'CSE' | 'Regional' | 'MAC' | 'Local')}
            className="w-full h-7 px-2 text-[12px] rounded-md border border-slate-200 cursor-pointer">
            <option value="">{t('checklist.select')}</option>
            {['GA','Spinal','Epidural','CSE','Regional','MAC','Local'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
        </div>
      </div>
    </div>
  )
}
