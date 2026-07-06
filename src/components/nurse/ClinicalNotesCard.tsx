"use client"

/* M9-B — Nurse clinical-note modules: Wound care · Fall risk · Care plan.
 *
 * Light-weight UI on top of localStorage so the nurse can record the three
 * NABH-relevant note types without a deeper store change. Each entry fires
 * audit + notifies doctor when something abnormal is captured (e.g. fall
 * risk = high).
 */

import { Select } from "@/components/ui/Select"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Bandage, Footprints, ClipboardList, ChevronDown, ChevronRight, Plus, X, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

export type WoundStage = 'I' | 'II' | 'III' | 'IV' | 'DTI' | 'Unstageable'

interface WoundEntry {
  id: string; at: string; location: string; stage: WoundStage; description: string
}
interface FallRiskEntry {
  id: string; at: string; morseScore: number; level: 'low' | 'medium' | 'high'; notes: string
}
interface CarePlanEntry {
  id: string; at: string; problem: string; goal: string; interventions: string[]; review: string
}

interface NoteBundle {
  wounds: WoundEntry[]
  fallRisk: FallRiskEntry[]
  carePlan: CarePlanEntry[]
}

const EMPTY: NoteBundle = { wounds: [], fallRisk: [], carePlan: [] }
const LS = (patientId: string) => `agentix.nurse.notes.${patientId}`

function load(patientId: string): NoteBundle {
  if (typeof window === 'undefined') return EMPTY
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(LS(patientId)) ?? '{}') as Partial<NoteBundle>) } } catch { return EMPTY }
}
function save(patientId: string, b: NoteBundle) {
  try { localStorage.setItem(LS(patientId), JSON.stringify(b)) } catch { /* ignore */ }
}

const STAGES: WoundStage[] = ['I', 'II', 'III', 'IV', 'DTI', 'Unstageable']

export function ClinicalNotesCard({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [bundle, setBundle] = useState<NoteBundle>(EMPTY)
  const [openSection, setOpenSection] = useState<'wound' | 'fall' | 'careplan' | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { setBundle(load(patientId)); setLoaded(true) }, [patientId])

  // Wound form
  const [wLocation, setWLocation] = useState('')
  const [wStage, setWStage] = useState<WoundStage>('II')
  const [wDesc, setWDesc] = useState('')
  function addWound() {
    if (!wLocation.trim()) return
    const e: WoundEntry = { id: `W-${Date.now()}`, at: new Date().toISOString(), location: wLocation.trim(), stage: wStage, description: wDesc.trim() }
    const next = { ...bundle, wounds: [e, ...bundle.wounds] }
    setBundle(next); save(patientId, next)
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: wStage === 'III' || wStage === 'IV' || wStage === 'Unstageable' ? 'high' : 'medium',
      title: `Wound logged · ${patientName}`,
      body: `Stage ${wStage} wound at ${wLocation}${wDesc ? ' — ' + wDesc : ''}.`,
      patientName,
      audit: { action: 'nurse_handover', resource: 'wound_care', resourceId: e.id, detail: `Wound stage ${wStage} at ${wLocation}`, userName: 'Nurse' },
    })
    toast.success(`Wound recorded · doctor notified`)
    setWLocation(''); setWDesc(''); setWStage('II')
  }
  function removeWound(id: string) { const next = { ...bundle, wounds: bundle.wounds.filter(w => w.id !== id) }; setBundle(next); save(patientId, next) }

  // Fall-risk form (Morse scale shortcut)
  const [fHistory, setFHistory] = useState(false)
  const [fSecondary, setFSecondary] = useState(false)
  const [fAmbulatoryAid, setFAmbulatoryAid] = useState<0 | 15 | 30>(0)
  const [fIVtherapy, setFIVtherapy] = useState(false)
  const [fGait, setFGait] = useState<0 | 10 | 20>(0)
  const [fMentalStatus, setFMentalStatus] = useState<0 | 15>(0)
  const morseScore = (fHistory ? 25 : 0) + (fSecondary ? 15 : 0) + fAmbulatoryAid + (fIVtherapy ? 20 : 0) + fGait + fMentalStatus
  const morseLevel: FallRiskEntry['level'] = morseScore >= 45 ? 'high' : morseScore >= 25 ? 'medium' : 'low'
  function addFallRisk() {
    const e: FallRiskEntry = { id: `F-${Date.now()}`, at: new Date().toISOString(), morseScore, level: morseLevel, notes: '' }
    const next = { ...bundle, fallRisk: [e, ...bundle.fallRisk] }
    setBundle(next); save(patientId, next)
    if (morseLevel === 'high') {
      notifyAndAudit({
        to: 'doctor', type: 'system', priority: 'high',
        title: `High fall risk · ${patientName}`,
        body: `Morse score ${morseScore} — high fall risk. Initiate fall-prevention bundle (low bed · bed alarm · 1:1 if needed).`,
        patientName,
        audit: { action: 'nurse_handover', resource: 'fall_risk', resourceId: e.id, detail: `Morse ${morseScore} (high)`, userName: 'Nurse' },
      })
      toast.warning(`HIGH fall risk · doctor notified`)
    } else {
      toast.success(`Fall-risk score logged · ${morseLevel}`)
    }
    setFHistory(false); setFSecondary(false); setFAmbulatoryAid(0); setFIVtherapy(false); setFGait(0); setFMentalStatus(0)
  }

  // Care plan form
  const [cpProblem, setCpProblem] = useState('')
  const [cpGoal, setCpGoal] = useState('')
  const [cpInterventions, setCpInterventions] = useState('')
  const [cpReview, setCpReview] = useState('')
  function addCarePlan() {
    if (!cpProblem.trim() || !cpGoal.trim()) return
    const interventions = cpInterventions.split('\n').map(s => s.trim()).filter(Boolean)
    const e: CarePlanEntry = { id: `CP-${Date.now()}`, at: new Date().toISOString(), problem: cpProblem.trim(), goal: cpGoal.trim(), interventions, review: cpReview.trim() }
    const next = { ...bundle, carePlan: [e, ...bundle.carePlan] }
    setBundle(next); save(patientId, next)
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'low',
      title: `Care plan added · ${patientName}`,
      body: `Problem: ${e.problem}. Goal: ${e.goal}.`,
      patientName,
      audit: { action: 'nurse_handover', resource: 'care_plan', resourceId: e.id, detail: `Care plan: ${e.problem}`, userName: 'Nurse' },
    })
    toast.success('Care plan added')
    setCpProblem(''); setCpGoal(''); setCpInterventions(''); setCpReview('')
  }

  const counts = useMemo(() => ({
    wound: bundle.wounds.length, fall: bundle.fallRisk.length, careplan: bundle.carePlan.length,
  }), [bundle])

  if (!loaded) return null

  return (
    <section className="rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-surface-sunken">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-semibold text-slate-900">Clinical notes · {patientName}</h3>
        <span className="ml-auto text-[10.5px] text-slate-500">{counts.wound} wound · {counts.fall} fall-risk · {counts.careplan} care plan</span>
      </header>

      <div className="divide-y divide-slate-100">
        {/* Wound care */}
        <div>
          <button onClick={() => setOpenSection(openSection === 'wound' ? null : 'wound')}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
            <Bandage className="h-4 w-4 text-rose-600" />
            <span className="text-[13px] font-semibold text-slate-900">Wound care</span>
            <span className="ml-auto text-[10px] text-slate-400">{counts.wound}</span>
            {openSection === 'wound' ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {openSection === 'wound' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 py-3 bg-slate-50/50 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={wLocation} onChange={e => setWLocation(e.target.value)} placeholder="Location (e.g. Sacrum)"
                  className="h-9 px-2.5 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-rose-400" />
                <Select value={wStage} onChange={e => setWStage(e.target.value as WoundStage)}
                  className="h-9 px-2 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-rose-400">
                  {STAGES.map(s => <option key={s} value={s}>Stage {s}</option>)}
                </Select>
                <button onClick={addWound} className="h-9 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Add wound
                </button>
              </div>
              <textarea value={wDesc} onChange={e => setWDesc(e.target.value)} rows={2} placeholder="Description (size, exudate, dressing applied…)"
                className="w-full px-2.5 py-1.5 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-rose-400 resize-none" />
              <div className="space-y-1">
                {bundle.wounds.map(w => (
                  <div key={w.id} className="flex items-center gap-2 rounded-md bg-white ring-1 ring-slate-200 px-2.5 py-1.5">
                    <span className="text-[10.5px] font-mono text-slate-500">{new Date(w.at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[12px] font-semibold text-slate-900">Stage {w.stage}</span>
                    <span className="text-[12px] text-slate-600 truncate flex-1">{w.location} — {w.description}</span>
                    <button onClick={() => removeWound(w.id)} aria-label="Remove" className="text-slate-300 hover:text-rose-600"><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Fall risk */}
        <div>
          <button onClick={() => setOpenSection(openSection === 'fall' ? null : 'fall')}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
            <Footprints className="h-4 w-4 text-amber-600" />
            <span className="text-[13px] font-semibold text-slate-900">Fall risk · Morse scale</span>
            <span className="ml-auto text-[10px] text-slate-400">{counts.fall}</span>
            {openSection === 'fall' ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {openSection === 'fall' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 py-3 bg-slate-50/50 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[12.5px]">
                <label className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md ring-1 ring-slate-200">
                  <input type="checkbox" checked={fHistory} onChange={e => setFHistory(e.target.checked)} />
                  History of falls (3 mo) <span className="ml-auto text-slate-400">+25</span>
                </label>
                <label className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md ring-1 ring-slate-200">
                  <input type="checkbox" checked={fSecondary} onChange={e => setFSecondary(e.target.checked)} />
                  Secondary diagnosis <span className="ml-auto text-slate-400">+15</span>
                </label>
                <label className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md ring-1 ring-slate-200">
                  <input type="checkbox" checked={fIVtherapy} onChange={e => setFIVtherapy(e.target.checked)} />
                  IV therapy / heparin lock <span className="ml-auto text-slate-400">+20</span>
                </label>
                <label className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md ring-1 ring-slate-200">
                  <input type="checkbox" checked={fMentalStatus === 15} onChange={e => setFMentalStatus(e.target.checked ? 15 : 0)} />
                  Forgets limitations <span className="ml-auto text-slate-400">+15</span>
                </label>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">Ambulatory aid:</span>
                {[[0, 'None / nurse'], [15, 'Crutches'], [30, 'Furniture']].map(([v, label]) => (
                  <button key={label} onClick={() => setFAmbulatoryAid(v as 0 | 15 | 30)}
                    className={`text-[11.5px] font-semibold px-2 py-1 rounded-md cursor-pointer ${fAmbulatoryAid === v ? 'bg-amber-600 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {label} (+{v})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">Gait:</span>
                {[[0, 'Normal'], [10, 'Weak'], [20, 'Impaired']].map(([v, label]) => (
                  <button key={label} onClick={() => setFGait(v as 0 | 10 | 20)}
                    className={`text-[11.5px] font-semibold px-2 py-1 rounded-md cursor-pointer ${fGait === v ? 'bg-amber-600 text-white' : 'bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {label} (+{v})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-[14px] font-bold ${morseLevel === 'high' ? 'text-rose-700' : morseLevel === 'medium' ? 'text-amber-700' : 'text-emerald-700'}`}>
                  Morse score {morseScore} · {morseLevel.toUpperCase()}
                </span>
                <button onClick={addFallRisk}
                  className="ml-auto h-8 px-3 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Log assessment
                </button>
              </div>
              <div className="space-y-1 mt-1">
                {bundle.fallRisk.slice(0, 4).map(f => (
                  <div key={f.id} className="flex items-center gap-2 rounded-md bg-white ring-1 ring-slate-200 px-2.5 py-1.5">
                    <span className="text-[10.5px] font-mono text-slate-500">{new Date(f.at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${f.level === 'high' ? 'bg-rose-100 text-rose-700' : f.level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{f.level.toUpperCase()}</span>
                    <span className="text-[12px] font-semibold text-slate-900">Score {f.morseScore}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Care plan */}
        <div>
          <button onClick={() => setOpenSection(openSection === 'careplan' ? null : 'careplan')}
            className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
            <ClipboardList className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-[13px] font-semibold text-slate-900">Care plan</span>
            <span className="ml-auto text-[10px] text-slate-400">{counts.careplan}</span>
            {openSection === 'careplan' ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {openSection === 'careplan' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 py-3 bg-slate-50/50 space-y-2">
              <input value={cpProblem} onChange={e => setCpProblem(e.target.value)} placeholder="Problem (e.g. Risk for fluid volume deficit)"
                className="w-full h-9 px-2.5 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
              <input value={cpGoal} onChange={e => setCpGoal(e.target.value)} placeholder="Goal (e.g. Maintain urine output ≥ 30 ml/h)"
                className="w-full h-9 px-2.5 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
              <textarea value={cpInterventions} onChange={e => setCpInterventions(e.target.value)} rows={2} placeholder="Interventions (one per line)"
                className="w-full px-2.5 py-1.5 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)] resize-none" />
              <div className="flex items-center gap-2">
                <input value={cpReview} onChange={e => setCpReview(e.target.value)} placeholder="Review (e.g. 24h reassess)"
                  className="flex-1 h-9 px-2.5 rounded-md ring-1 ring-slate-200 bg-white text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                <button onClick={addCarePlan}
                  className="h-9 px-3 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Add to plan
                </button>
              </div>
              <div className="space-y-1.5 mt-1">
                {bundle.carePlan.slice(0, 4).map(c => (
                  <div key={c.id} className="rounded-md bg-white ring-1 ring-slate-200 px-2.5 py-2">
                    <p className="text-[12.5px] font-semibold text-slate-900">{c.problem}</p>
                    <p className="text-[11.5px] text-slate-600">Goal: {c.goal}</p>
                    {c.interventions.length ? <ul className="text-[11px] text-slate-500 list-disc pl-4 mt-0.5">{c.interventions.slice(0, 3).map((i, idx) => <li key={idx}>{i}</li>)}</ul> : null}
                    {c.review ? <p className="text-[10.5px] text-slate-400 mt-0.5">Review: {c.review}</p> : null}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
