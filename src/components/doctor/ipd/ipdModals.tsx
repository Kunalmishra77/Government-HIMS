"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { useInpatientStore, type Inpatient } from "@/store/useInpatientStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { toast } from "sonner"

export type IpdModalKind = 'add_med' | 'stop_med' | 'order_test' | 'refer' | 'icu' | 'ot' | 'diet' | null

const TITLES: Record<Exclude<IpdModalKind, null>, string> = {
  add_med: 'Add medication', stop_med: 'Stop medication', order_test: 'Order investigation',
  refer: 'Refer to specialist', icu: 'Shift to ICU', ot: 'Book OT / Plan surgery', diet: 'Change diet',
}

const field = "w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20"
const label = "block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"

export function IpdActionModal({ kind, patient, onClose }: { kind: IpdModalKind; patient: Inpatient; onClose: () => void }) {
  if (!kind) return null
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-4">
          <div><h2 className="text-lg font-bold text-slate-900">{TITLES[kind]}</h2><p className="text-[12px] text-slate-500">{patient.name} · {patient.ward} Bed {patient.bed}</p></div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        {kind === 'add_med' && <AddMedForm patient={patient} onClose={onClose} />}
        {kind === 'stop_med' && <StopMedForm patient={patient} onClose={onClose} />}
        {kind === 'order_test' && <OrderTestForm patient={patient} onClose={onClose} />}
        {kind === 'refer' && <ReferForm patient={patient} onClose={onClose} />}
        {kind === 'icu' && <IcuForm patient={patient} onClose={onClose} />}
        {kind === 'ot' && <OtForm patient={patient} onClose={onClose} />}
        {kind === 'diet' && <DietForm patient={patient} onClose={onClose} />}
      </motion.div>
    </motion.div>
  )
}

function Actions({ onClose, onSubmit, submitLabel = 'Save' }: { onClose: () => void; onSubmit: () => void; submitLabel?: string }) {
  return (
    <div className="flex gap-3 mt-5">
      <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-bold text-[13.5px] hover:bg-slate-50">Cancel</button>
      <button onClick={onSubmit} className="flex-1 h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[13.5px]">{submitLabel}</button>
    </div>
  )
}

function AddMedForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const addMed = useInpatientStore(s => s.addMed)
  const [name, setName] = useState(''); const [dose, setDose] = useState(''); const [freq, setFreq] = useState('OD'); const [route, setRoute] = useState('Oral')
  const submit = () => {
    if (!name.trim() || !dose.trim()) { toast.error('Medicine and dose required'); return }
    addMed(patient.patientId, { name: name.trim(), dose: dose.trim(), freq, route })
    toast.success(`${name.trim()} added to ${patient.name.split(' ')[0]}'s chart`); onClose()
  }
  return (
    <div className="space-y-3">
      <div><label className={label}>Medicine</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pantoprazole" className={field} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={label}>Dose</label><input value={dose} onChange={e => setDose(e.target.value)} placeholder="e.g. 40mg" className={field} /></div>
        <div><label className={label}>Frequency</label><Select value={freq} onChange={e => setFreq(e.target.value)} className={field}><option>OD</option><option>BD</option><option>TDS</option><option>QID</option><option>Q6H</option><option>SOS</option></Select></div>
      </div>
      <div><label className={label}>Route</label><Select value={route} onChange={e => setRoute(e.target.value)} className={field}><option>Oral</option><option>IV</option><option>IM</option><option>SC</option><option>Topical</option></Select></div>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Add medication" />
    </div>
  )
}

function StopMedForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const discontinueMed = useInpatientStore(s => s.discontinueMed)
  const active = patient.meds.filter(m => m.status === 'active')
  const [name, setName] = useState(active[0]?.name ?? ''); const [reason, setReason] = useState('')
  const submit = () => {
    if (!name) { toast.error('Pick a medication'); return }
    if (!reason.trim()) { toast.error('A reason is required to stop a medication'); return }
    discontinueMed(patient.patientId, name, reason.trim())
    toast.success(`${name} discontinued`); onClose()
  }
  if (!active.length) return <p className="text-[13px] text-slate-500">No active medications to stop.</p>
  return (
    <div className="space-y-3">
      <div><label className={label}>Medication</label><Select value={name} onChange={e => setName(e.target.value)} className={field}>{active.map(m => <option key={m.name} value={m.name}>{m.name} {m.dose}</option>)}</Select></div>
      <div><label className={label}>Reason for stopping</label><input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Course complete / adverse effect" className={field} /></div>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Stop medication" />
    </div>
  )
}

function OrderTestForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const addTest = useInpatientStore(s => s.addTest)
  const [name, setName] = useState(''); const [priority, setPriority] = useState<'Routine' | 'Urgent'>('Routine')
  const submit = () => {
    if (!name.trim()) { toast.error('Test name required'); return }
    addTest(patient.patientId, { name: name.trim(), priority })
    toast.success(`${name.trim()} ordered`); onClose()
  }
  return (
    <div className="space-y-3">
      <div><label className={label}>Investigation</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Serum Electrolytes" className={field} /></div>
      <div><label className={label}>Priority</label><Select value={priority} onChange={e => setPriority(e.target.value as 'Routine' | 'Urgent')} className={field}><option>Routine</option><option>Urgent</option></Select></div>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Order test" />
    </div>
  )
}

function ReferForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const referInpatient = useInpatientStore(s => s.referInpatient)
  const notify = useNotificationStore(s => s.add)
  const [specialty, setSpecialty] = useState('Cardiology'); const [toDoctor, setToDoctor] = useState(''); const [reason, setReason] = useState(''); const [urgent, setUrgent] = useState(false)
  const submit = () => {
    if (!reason.trim()) { toast.error('Reason for referral required'); return }
    referInpatient(patient.patientId, { specialty, toDoctor: toDoctor.trim() || undefined, reason: reason.trim(), urgent })
    notify({ type: 'referral', priority: urgent ? 'high' : 'medium', title: `Referral — ${specialty}`, body: `${patient.name} (${patient.ward} ${patient.bed}): ${reason.trim()}`, channels: ['in_app'], targetRole: 'doctor', patientName: patient.name })
    toast.success(`Referred to ${specialty}`); onClose()
  }
  return (
    <div className="space-y-3">
      <div><label className={label}>Specialty</label><Select value={specialty} onChange={e => setSpecialty(e.target.value)} className={field}>{['Cardiology', 'Neurology', 'Nephrology', 'Gastroenterology', 'Pulmonology', 'Endocrinology', 'Orthopaedics', 'General Surgery'].map(s => <option key={s}>{s}</option>)}</Select></div>
      <div><label className={label}>Consultant (optional)</label><input value={toDoctor} onChange={e => setToDoctor(e.target.value)} placeholder="e.g. Dr. Rohan Mehta" className={field} /></div>
      <div><label className={label}>Reason</label><input value={reason} onChange={e => setReason(e.target.value)} placeholder="Clinical question for the specialist" className={field} /></div>
      <label className="flex items-center gap-2 text-[13px] font-semibold text-rose-600"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Mark urgent</label>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Send referral" />
    </div>
  )
}

function IcuForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const requestIcuTransfer = useInpatientStore(s => s.requestIcuTransfer)
  const notify = useNotificationStore(s => s.add)
  const [reason, setReason] = useState(''); const [urgency, setUrgency] = useState<'Routine' | 'Urgent' | 'Emergency'>('Urgent')
  const submit = () => {
    if (!reason.trim()) { toast.error('Reason required'); return }
    requestIcuTransfer(patient.patientId, { reason: reason.trim(), urgency })
    notify({ type: 'bed_request', priority: urgency === 'Emergency' ? 'critical' : 'high', title: 'ICU bed requested', body: `${patient.name}: ${reason.trim()}`, channels: ['in_app'], targetRole: 'bed_manager', patientName: patient.name })
    toast.success('ICU transfer requested — routed to Bed Manager'); onClose()
  }
  return (
    <div className="space-y-3">
      <div><label className={label}>Reason for ICU transfer</label><input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Worsening hypoxia, needs ventilatory support" className={field} /></div>
      <div><label className={label}>Urgency</label><Select value={urgency} onChange={e => setUrgency(e.target.value as typeof urgency)} className={field}><option>Routine</option><option>Urgent</option><option>Emergency</option></Select></div>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Request ICU transfer" />
    </div>
  )
}

function OtForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const bookOT = useInpatientStore(s => s.bookOT)
  const notify = useNotificationStore(s => s.add)
  const [procedure, setProcedure] = useState(''); const [surgeon, setSurgeon] = useState(''); const [ot, setOt] = useState('OT-1')
  const [when, setWhen] = useState(() => { const d = new Date(Date.now() + 2 * 3600000); d.setMinutes(0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })
  const submit = () => {
    if (!procedure.trim() || !surgeon.trim()) { toast.error('Procedure and surgeon required'); return }
    bookOT(patient.patientId, { procedure: procedure.trim(), surgeon: surgeon.trim(), ot, scheduledAt: new Date(when).toISOString() })
    notify({ type: 'ot_confirmed', priority: 'high', title: `OT booking — ${procedure.trim()}`, body: `${patient.name} · ${ot} · ${new Date(when).toLocaleString('en-IN')}`, channels: ['in_app'], targetRole: 'ot', patientName: patient.name })
    toast.success('OT booked — routed to Operation Theatre'); onClose()
  }
  return (
    <div className="space-y-3">
      <div><label className={label}>Procedure</label><input value={procedure} onChange={e => setProcedure(e.target.value)} placeholder="e.g. Laparoscopic Cholecystectomy" className={field} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={label}>Surgeon</label><input value={surgeon} onChange={e => setSurgeon(e.target.value)} placeholder="e.g. Dr. Anisha Sharma" className={field} /></div>
        <div><label className={label}>Theatre</label><Select value={ot} onChange={e => setOt(e.target.value)} className={field}><option>OT-1</option><option>OT-2</option><option>Cath Lab</option></Select></div>
      </div>
      <div><label className={label}>Scheduled for</label><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className={field} /></div>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Book OT" />
    </div>
  )
}

function DietForm({ patient, onClose }: { patient: Inpatient; onClose: () => void }) {
  const setDiet = useInpatientStore(s => s.setDiet)
  const [diet, setDietVal] = useState(patient.diet ?? 'Normal diet')
  const submit = () => { setDiet(patient.patientId, diet); toast.success('Diet updated'); onClose() }
  return (
    <div className="space-y-3">
      <div><label className={label}>Diet order</label><Select value={diet} onChange={e => setDietVal(e.target.value)} className={field}>{['Normal diet', 'Diabetic diet', 'Cardiac diet · low salt', 'Soft diet', 'Renal diet', 'NPO — IV fluids', 'Liquid diet'].map(d => <option key={d}>{d}</option>)}</Select></div>
      <Actions onClose={onClose} onSubmit={submit} submitLabel="Update diet" />
    </div>
  )
}
