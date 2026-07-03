"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { X, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert, Sparkles, UserPlus, AlertTriangle } from "lucide-react"
import { useVitalsDraft } from "./useVitalsDraft"
import { VitalsFields, VitalsAiPanel } from "./VitalsFields"
import { emptyProfile, type PatientProfile, type SmokingStatus, type AlcoholStatus, type PregnancyStatus } from "@/store/usePatientProfileStore"
import { BLOOD_GROUPS, missingMandatory, bmiBand, allergyMedConflicts, riskSnapshot, type VitalsDraft } from "@/lib/patientProfile"
import type { VitalsRecord } from "@/store/useInpatientStore"

const STEP_LABELS = ["Clinical history", "Lifestyle & measurements", "Vitals", "Review"]
const numOrUndef = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n }

function TextField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" />
    </div>
  )
}
function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      <Select value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50">
        <option value="">{placeholder ?? "Select…"}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </Select>
    </div>
  )
}
function ChipInput({ label, values, onChange, placeholder, tone = "slate" }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; tone?: "slate" | "red" }) {
  const [text, setText] = useState("")
  const add = () => { const t = text.trim(); if (t && !values.includes(t)) onChange([...values, t]); setText("") }
  const chip = tone === "red" ? "bg-red-50 text-red-700 border-red-100" : "bg-slate-100 text-slate-700 border-slate-200"
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => (
            <span key={v} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${chip}`}>
              {v}<button onClick={() => onChange(values.filter(x => x !== v))} aria-label={`Remove ${v}`} className="hover:text-slate-900 cursor-pointer">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add() } }}
          placeholder={placeholder} className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" />
        <button onClick={add} className="h-9 px-3 rounded-lg bg-slate-800 text-white text-xs font-bold cursor-pointer hover:bg-slate-900">Add</button>
      </div>
    </div>
  )
}

export function FirstVisitWizard({ title, subtitle, meta, initial, onClose, onComplete }: {
  title: string
  subtitle?: string
  meta: { age: number; gender: string }
  initial?: Partial<PatientProfile>
  onClose: () => void
  onComplete: (data: { profile: PatientProfile; vitals: Omit<VitalsRecord, "id" | "at"> }) => void
}) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState<PatientProfile>({ ...emptyProfile(), ...initial })
  const upd = (patch: Partial<PatientProfile>) => setP(prev => ({ ...prev, ...patch }))
  const api = useVitalsDraft([])
  const [saving, setSaving] = useState(false)

  const vd: VitalsDraft = {
    hr: api.draft.hr, systolicBP: api.draft.systolicBP, diastolicBP: api.draft.diastolicBP,
    rr: api.draft.rr, spo2: api.draft.spo2, temp: api.draft.temp,
    o2Delivery: api.draft.o2Delivery, consciousness: api.draft.consciousness,
  }
  const missing = useMemo(() => missingMandatory(p, vd), [p, vd])
  const conflicts = useMemo(() => allergyMedConflicts(p), [p])
  const band = bmiBand(p.weightKg, p.heightCm)
  const snapshot = useMemo(() => riskSnapshot(p, vd, meta), [p, vd, meta])

  const finish = async () => {
    if (missing.length) { setStep(missing.includes("Core vitals (HR, BP, RR, SpO₂, temp)") ? 2 : 0); return }
    setSaving(true)
    await new Promise(r => setTimeout(r, 250))
    const vitals: Omit<VitalsRecord, "id" | "at"> = { ...api.draft, weight: p.weightKg, height: p.heightCm }
    onComplete({ profile: p, vitals })
    setSaving(false)
    onClose()
  }

  // Rendered inline via {renderBody()} — NOT as <Body/>. A component defined in
  // render and used as an element gets a new type each render, remounting the
  // form on every keystroke (inputs lose focus after one character).
  const renderBody = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField label="Blood group" value={p.bloodGroup ?? ""} onChange={v => upd({ bloodGroup: v })} options={BLOOD_GROUPS} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:mt-6 cursor-pointer">
              <input type="checkbox" checked={!!p.noKnownAllergies} onChange={e => upd({ noKnownAllergies: e.target.checked, allergies: e.target.checked ? [] : p.allergies })}
                className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer" />
              No known allergies
            </label>
          </div>
          {!p.noKnownAllergies && <ChipInput label="Allergies" values={p.allergies} onChange={v => upd({ allergies: v })} placeholder="e.g. Penicillin" tone="red" />}
          <ChipInput label="Chronic conditions" values={p.chronicConditions} onChange={v => upd({ chronicConditions: v })} placeholder="e.g. Hypertension" />
          <ChipInput label="Current medications" values={p.currentMedications} onChange={v => upd({ currentMedications: v })} placeholder="e.g. Metformin 500mg" />
          <ChipInput label="Past surgeries" values={p.pastSurgeries} onChange={v => upd({ pastSurgeries: v })} placeholder="e.g. Appendectomy (2009)" />
          <ChipInput label="Family history" values={p.familyHistory} onChange={v => upd({ familyHistory: v })} placeholder="e.g. Father — heart disease" />
          {conflicts.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-red-700 mb-1"><ShieldAlert className="h-4 w-4" /> AI allergy check</p>
              {conflicts.map((c, i) => <p key={i} className="text-xs font-semibold text-red-600">{c.title}: {c.note}</p>)}
            </div>
          )}
        </div>
      )
      case 1: return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SelectField label="Smoking" value={p.smoking ?? ""} onChange={v => upd({ smoking: v as SmokingStatus })} options={["Never", "Former", "Current"]} />
            <SelectField label="Alcohol" value={p.alcohol ?? ""} onChange={v => upd({ alcohol: v as AlcoholStatus })} options={["Never", "Occasional", "Regular"]} />
            {meta.gender === "Female" && <SelectField label="Pregnancy" value={p.pregnancy ?? ""} onChange={v => upd({ pregnancy: v as PregnancyStatus })} options={["Not pregnant", "Pregnant", "Unsure"]} />}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <TextField label="Height (cm)" type="number" value={p.heightCm != null ? String(p.heightCm) : ""} onChange={v => upd({ heightCm: numOrUndef(v) })} placeholder="170" />
            <TextField label="Weight (kg)" type="number" value={p.weightKg != null ? String(p.weightKg) : ""} onChange={v => upd({ weightKg: numOrUndef(v) })} placeholder="70" />
            <div className={`rounded-xl p-3 text-sm font-bold ${band ? (band.tone === "ok" ? "bg-emerald-50 text-emerald-700" : band.tone === "warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700") : "bg-slate-100 text-slate-400"}`}>
              BMI: {band ? `${band.bmi} · ${band.label}` : "—"}
            </div>
          </div>
        </div>
      )
      case 2: return (
        <div className="space-y-5">
          <p className="text-xs text-slate-500">Comprehensive first-visit vitals. Height/weight from the previous step fill the record automatically.</p>
          <VitalsFields api={api} hideAnthropometrics />
          <VitalsAiPanel news={api.news} anomalies={api.anomalies} />
        </div>
      )
      case 3: return (
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mb-1"><Sparkles className="h-4 w-4" /> AI risk snapshot</p>
            <p className="text-sm font-semibold text-slate-800">{snapshot}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Consent</p>
            <div className="space-y-2">
              {([
                ["consentRecords", "Allow AI to read records (explanations, alerts)"],
                ["consentFamily", "Family live status tracking"],
                ["consentResearch", "Anonymised research use"],
              ] as [keyof PatientProfile, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={!!p[k]} onChange={e => upd({ [k]: e.target.checked } as Partial<PatientProfile>)}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {missing.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-700 mb-1"><AlertTriangle className="h-4 w-4" /> Required before sending to the doctor</p>
              <ul className="text-xs font-semibold text-amber-700 list-disc ml-5">{missing.map(m => <li key={m}>{m}</li>)}</ul>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Profile complete — ready to send to the doctor.</div>
          )}
        </div>
      )
      default: return null
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        {/* Header + progress */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] flex items-center justify-center"><UserPlus className="h-5 w-5 text-[var(--color-accent)]" /></div>
              <div>
                <h2 id="wizard-title" className="text-base font-bold text-slate-900">Complete Vitals</h2>
                <p className="text-sm text-slate-500 font-medium">{title}{subtitle ? ` · ${subtitle}` : ""}</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-[var(--color-primary)]" : "bg-slate-200"}`} />
            ))}
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1.5">Step {step + 1} of {STEP_LABELS.length} · {STEP_LABELS[step]}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto">{renderBody()}</div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          {step < STEP_LABELS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="ml-auto flex items-center gap-1.5 h-10 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={finish} disabled={saving || missing.length > 0}
              className="ml-auto flex items-center gap-1.5 h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle2 className="h-4 w-4" /> {saving ? "Saving…" : "Complete Vitals"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
