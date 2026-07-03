"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { motion } from "framer-motion"
import { X, CheckCircle2, Scissors, ArrowRight, ShieldCheck, Clock, Printer } from "lucide-react"
import {
  useInpatientStore, lastRound, ROUND_HRS, DISCHARGE_PILLARS,
  type Inpatient, type Condition, type SurgeryStatus,
} from "@/store/useInpatientStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { openPrint, olFrom, para } from "@/lib/printDoc"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const CONDITIONS: Condition[] = ['Critical', 'Serious', 'Stable', 'Improving', 'Discharge-ready']

// Self-contained round modal — writes the round (and any condition change) to the store.
export function RoundModal({ ip, onClose }: { ip: Inpatient; onClose: () => void }) {
  const recordRound = useInpatientStore(s => s.recordRound)
  const setCondition = useInpatientStore(s => s.setCondition)
  const lastV = lastRound(ip)?.vitals
  const [bp, setBp] = useState(lastV?.bp ?? '120/80')
  const [pulse, setPulse] = useState(lastV?.pulse ?? '78 bpm')
  const [temp, setTemp] = useState(lastV?.temp ?? '98.6°F')
  const [spo2, setSpo2] = useState(lastV?.spo2 ?? '98%')
  const [rr, setRr] = useState(lastV?.rr ?? '16/min')
  const [avpu, setAvpu] = useState(lastV?.avpu ?? 'A')
  const [note, setNote] = useState('')
  const [plan, setPlan] = useState('')
  const [condition, setCond] = useState<Condition>(ip.condition)
  const field = "w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20"

  const save = () => {
    if (!note.trim()) { toast.error('Add a progress note'); return }
    recordRound(ip.patientId, { note: note.trim(), plan: plan.trim(), vitals: { bp, pulse, temp, spo2, rr, avpu } })
    if (condition !== ip.condition) setCondition(ip.patientId, condition)
    toast.success(`Round recorded — ${ip.name}`, { description: `Next round auto-scheduled (${ROUND_HRS[condition]}h)` })
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-lg font-bold text-slate-900">Doctor round</h2><p className="text-[12px] text-slate-500">{ip.name} · {ip.ward} Bed {ip.bed}</p></div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Vitals reviewed</label>
            <div className="grid grid-cols-2 gap-2">
              <input value={bp} onChange={e => setBp(e.target.value)} placeholder="BP" className={field} />
              <input value={pulse} onChange={e => setPulse(e.target.value)} placeholder="Pulse" className={field} />
              <input value={temp} onChange={e => setTemp(e.target.value)} placeholder="Temp" className={field} />
              <input value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="SpO₂" className={field} />
              <input value={rr} onChange={e => setRr(e.target.value)} placeholder="Resp. rate" className={field} />
              <Select value={avpu} onChange={e => setAvpu(e.target.value)} className={field} title="Consciousness (AVPU)">
                <option value="A">Alert</option><option value="V">Voice</option><option value="P">Pain</option><option value="U">Unresponsive</option>
              </Select>
            </div>
          </div>
          <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Progress note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Findings & response to treatment…" className={cn(field, "h-auto py-2 resize-none")} /></div>
          <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Plan</label>
            <input value={plan} onChange={e => setPlan(e.target.value)} placeholder="e.g. Continue antibiotics; repeat CBC tomorrow" className={field} /></div>
          <div><label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Condition after round</label>
            <Select value={condition} onChange={e => setCond(e.target.value as Condition)} className={field}>{CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}</Select></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-bold text-[13.5px] hover:bg-slate-50">Cancel</button>
          <button onClick={save} className="flex-1 h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[13.5px] flex items-center justify-center gap-2"><CheckCircle2 className="h-4.5 w-4.5" /> Record round</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const SURGERY_FLOW: { key: SurgeryStatus; label: string }[] = [
  { key: 'consent_pending', label: 'Consent' }, { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_ot', label: 'In OT' }, { key: 'recovery', label: 'Recovery' }, { key: 'done', label: 'Done' },
]
export function SurgeryPanel({ ip }: { ip: Inpatient }) {
  const { requestSurgery, signConsent, scheduleSurgery, advanceSurgery, setPostOpNote } = useInpatientStore()
  const sg = ip.surgery
  const [proc, setProc] = useState(''); const [surgeon, setSurgeon] = useState(''); const [reason, setReason] = useState('')
  const [ot, setOt] = useState('OT-1')
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 2 * 3600000); d.setMinutes(0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })
  const [postOp, setPostOp] = useState('')
  const field = "w-full h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-primary/20"

  if (!sg) {
    return (
      <div className="space-y-2">
        <input value={proc} onChange={e => setProc(e.target.value)} placeholder="Procedure (e.g. Appendectomy)" className={field} />
        <div className="grid grid-cols-2 gap-2">
          <input value={surgeon} onChange={e => setSurgeon(e.target.value)} placeholder="Surgeon" className={field} />
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Indication" className={field} />
        </div>
        <button onClick={() => { if (!proc.trim() || !surgeon.trim()) { toast.error('Procedure & surgeon required'); return } requestSurgery(ip.patientId, { procedure: proc.trim(), surgeon: surgeon.trim(), reason: reason.trim() }); toast.success('Surgery requested — patient consent pending') }}
          className="h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-bold flex items-center gap-1.5 transition"><Scissors className="h-3.5 w-3.5" /> Request surgery</button>
      </div>
    )
  }

  const idx = SURGERY_FLOW.findIndex(f => f.key === sg.status)
  return (
    <div>
      <p className="text-[13.5px] font-bold text-slate-900">{sg.procedure}</p>
      <p className="text-[12px] text-slate-500 mb-2">{sg.surgeon}{sg.reason ? ` · ${sg.reason}` : ''}{sg.ot ? ` · ${sg.ot}` : ''}</p>
      <div className="flex items-center mb-3">
        {SURGERY_FLOW.map((f, i) => (
          <div key={f.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-0.5">
              <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold", i <= idx ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400")}>{i < idx ? '✓' : i + 1}</div>
              <span className={cn("text-[9.5px] font-semibold", i <= idx ? "text-rose-600" : "text-slate-400")}>{f.label}</span>
            </div>
            {i < SURGERY_FLOW.length - 1 && <div className={cn("flex-1 h-0.5 mx-0.5 -mt-3.5 rounded", i < idx ? "bg-rose-500" : "bg-slate-200")} />}
          </div>
        ))}
      </div>
      {sg.status === 'consent_pending' && !sg.consentSigned && (
        <div className="rounded-lg bg-amber-50 p-2.5 flex items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-amber-700">Awaiting patient consent</span>
          <button onClick={() => { signConsent(ip.patientId); toast.success('Consent recorded') }} className="text-[11.5px] font-bold text-amber-800 underline">Record consent</button>
        </div>
      )}
      {sg.status === 'consent_pending' && sg.consentSigned && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Consent received — schedule OT</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={ot} onChange={e => setOt(e.target.value)} className={field}><option>OT-1</option><option>OT-2</option><option>Cath Lab</option></Select>
            <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={field} />
          </div>
          <button onClick={() => { scheduleSurgery(ip.patientId, { ot, scheduledAt: new Date(when).toISOString() }); toast.success('Surgery scheduled') }} className="h-9 px-3.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-bold">Schedule surgery</button>
        </div>
      )}
      {sg.status === 'scheduled' && (
        <button onClick={() => { advanceSurgery(ip.patientId); toast.success('Patient sent to OT') }} className="h-9 px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[12.5px] font-bold flex items-center gap-1.5">Send to OT <ArrowRight className="h-3.5 w-3.5" /></button>
      )}
      {sg.status === 'in_ot' && (
        <button onClick={() => { advanceSurgery(ip.patientId); toast.success('Moved to recovery') }} className="h-9 px-3.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-bold flex items-center gap-1.5">Move to recovery <ArrowRight className="h-3.5 w-3.5" /></button>
      )}
      {sg.status === 'recovery' && (
        <div className="space-y-2">
          <textarea value={postOp} onChange={e => setPostOp(e.target.value)} rows={2} placeholder="Post-op note…" className={cn(field, "h-auto py-2 resize-none")} />
          <button onClick={() => { if (postOp.trim()) setPostOpNote(ip.patientId, postOp.trim()); advanceSurgery(ip.patientId); toast.success('Surgery completed') }} className="h-9 px-3.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[12.5px] font-bold flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Complete surgery</button>
        </div>
      )}
      {sg.status === 'done' && <p className="text-[12.5px] text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Completed{sg.postOpNote ? ` · ${sg.postOpNote}` : ''}</p>}
    </div>
  )
}

export function DischargePanel({ ip }: { ip: Inpatient }) {
  const { initiateDischarge, clearPillar, setDischargeSummary, completeDischarge } = useInpatientStore()
  const addVisit = usePatientStore(s => s.addVisit)
  const signature = useDoctorProfileStore(s => s.signature)
  const printDischarge = () => {
    const dd = ip.discharge
    const body = para('Diagnosis', ip.diagnosis)
      + (dd?.summary ? para('Hospital course & summary', dd.summary) : '')
      + para('Discharge medications (TTO)', '') + olFrom((dd?.meds ?? []).map(m => `${m.name} ${m.dose} — ${m.freq} (${m.duration})`))
      + (dd?.followUpDate ? para('Follow-up', new Date(dd.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })) : '')
      + (dd?.redFlags?.length ? para('Return immediately if', dd.redFlags.join(', ')) : '')
    openPrint({ kind: 'Discharge Summary', patient: ip.name, patientMeta: `${ip.patientId} · ${ip.age}y / ${ip.gender} · ${ip.ward} ${ip.bed}`, doctor: ip.admittingDoctor, signature, bodyHtml: body })
  }
  const d = ip.discharge
  const [summary, setSummary] = useState(d?.summary ?? `Admitted with ${ip.diagnosis}. Treated and clinically stable. Fit for discharge with the plan below.`)
  const [fu, setFu] = useState(d?.followUpDate ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
  const [flags, setFlags] = useState(d?.redFlags.join(', ') ?? 'Chest pain or breathlessness, High fever, Persistent vomiting')
  const field = "w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-primary/20"

  if (ip.stage === 'discharged') return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-green-700 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Discharged · summary & follow-up issued</p>
      <button onClick={printDischarge} className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-bold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print discharge summary</button>
    </div>
  )
  if (!d) return (
    <button onClick={() => { initiateDischarge(ip.patientId); toast.success('Discharge initiated — clearance started') }}
      className="h-9 px-3.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[12.5px] font-bold flex items-center gap-1.5 transition"><ShieldCheck className="h-3.5 w-3.5" /> Initiate discharge</button>
  )

  const allCleared = DISCHARGE_PILLARS.every(p => d.pillars[p.key])
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {DISCHARGE_PILLARS.map(p => (
          <div key={p.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
            <span className={cn("text-[12.5px] font-medium flex items-center gap-1.5", d.pillars[p.key] ? "text-slate-700" : "text-slate-400")}>
              {d.pillars[p.key] ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Clock className="h-3.5 w-3.5 text-amber-400" />} {p.label}
            </span>
            {!d.pillars[p.key] && <button onClick={() => clearPillar(ip.patientId, p.key)} className="text-[11px] font-bold text-[var(--color-accent)]">Clear</button>}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} placeholder="Discharge summary…" className={cn(field, "resize-none")} />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={fu} onChange={e => setFu(e.target.value)} className={field} />
          <input value={flags} onChange={e => setFlags(e.target.value)} placeholder="Red flags (comma-separated)" className={field} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setDischargeSummary(ip.patientId, { summary: summary.trim(), followUpDate: fu, meds: ip.meds.filter(m => m.status === 'active').map(m => ({ name: m.name, dose: m.dose, freq: m.freq, duration: '7 days' })), redFlags: flags.split(',').map(s => s.trim()).filter(Boolean) }); toast.success('Discharge summary saved') }}
            className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-bold">Save summary + TTO meds</button>
          {d.summary && <button onClick={printDischarge} className="h-9 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-bold flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" /> Print</button>}
        </div>
      </div>
      <button onClick={() => {
        completeDischarge(ip.patientId)
        addVisit({
          patientId: ip.patientId,
          date: new Date().toISOString().slice(0, 10),
          doctor: ip.admittingDoctor,
          diagnosis: ip.diagnosis,
          notes: d.summary ?? `Discharged after inpatient care for ${ip.diagnosis}.`,
          prescriptions: (d.meds.length ? d.meds : ip.meds.filter(m => m.status === 'active').map(m => ({ name: m.name, dose: m.dose, freq: m.freq, duration: '7 days' }))).map(m => ({ medicine: m.name, dosage: m.dose, duration: m.duration })),
        })
        toast.success(`${ip.name} discharged`)
      }} disabled={!allCleared || !d.summary}
        className="w-full h-10 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition">
        <CheckCircle2 className="h-4 w-4" /> Complete discharge {!allCleared && '(clear all pillars)'}
      </button>
    </div>
  )
}

export function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {title}</p>
      {children}
    </div>
  )
}
