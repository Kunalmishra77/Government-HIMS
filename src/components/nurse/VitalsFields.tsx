"use client"

import { Select } from "@/components/ui/Select"
import { Activity, AlertTriangle } from "lucide-react"
import { AVPU_OPTIONS, type VitalsDraftApi } from "./useVitalsDraft"
import type { Consciousness, News2, Anomaly } from "@/lib/vitals"

function Field({ id, label, unit, value, onChange, placeholder, step }: {
  id: string; label: string; unit?: string; value: string; onChange: (v: string) => void; placeholder?: string; step?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
        {label}{unit ? <span className="text-slate-400 font-semibold normal-case"> ({unit})</span> : null}
      </label>
      <input
        id={id} type="number" inputMode="decimal" step={step} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50"
      />
    </div>
  )
}

// The grouped vitals inputs. `hideAnthropometrics` drops weight/height/BMI for the
// wizard (captured once in its measurements step).
export function VitalsFields({ api, hideAnthropometrics = false }: { api: VitalsDraftApi; hideAnthropometrics?: boolean }) {
  const { f, set, avpu, setAvpu, liveBmi } = api
  return (
    <div className="space-y-5">
      <section>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cardiorespiratory</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field id="vital-hr" label="Heart rate" unit="bpm" value={f.hr} onChange={set("hr")} placeholder="72" />
          <Field id="vital-sys" label="Systolic BP" unit="mmHg" value={f.sys} onChange={set("sys")} placeholder="120" />
          <Field id="vital-dia" label="Diastolic BP" unit="mmHg" value={f.dia} onChange={set("dia")} placeholder="80" />
          <Field id="vital-rr" label="Resp. rate" unit="/min" value={f.rr} onChange={set("rr")} placeholder="16" />
          <Field id="vital-spo2" label="SpO₂" unit="%" value={f.spo2} onChange={set("spo2")} placeholder="98" />
        </div>
      </section>

      <section>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">General & metabolic</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field id="vital-temp" label="Temperature" unit="°F" value={f.temp} onChange={set("temp")} placeholder="98.6" step="0.1" />
          <Field id="vital-pain" label="Pain score" unit="0–10" value={f.pain} onChange={set("pain")} placeholder="0" />
          <Field id="vital-glu" label="Blood glucose" unit="mg/dL" value={f.glu} onChange={set("glu")} placeholder="110" />
        </div>
      </section>

      <section>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Neurological</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="vital-avpu" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Consciousness (AVPU)</label>
            <Select id="vital-avpu" value={avpu} onChange={e => setAvpu(e.target.value as Consciousness)}
              className="w-full h-10 px-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50">
              {AVPU_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </Select>
          </div>
        </div>
      </section>

      {!hideAnthropometrics && (
        <section>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Anthropometric</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field id="vital-weight" label="Weight" unit="kg" value={f.weight} onChange={set("weight")} placeholder="70" step="0.1" />
            <Field id="vital-height" label="Height" unit="cm" value={f.height} onChange={set("height")} placeholder="170" />
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">BMI</label>
              <div className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 flex items-center">
                {liveBmi != null ? `${liveBmi} kg/m²` : "—"}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <label htmlFor="vital-note" className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Note (optional)</label>
        <textarea id="vital-note" rows={2} value={f.note} onChange={e => set("note")(e.target.value)}
          placeholder="e.g. patient comfortable, tolerating oral intake"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 bg-slate-50" />
      </section>
    </div>
  )
}

const bandStyle = (band: string) =>
  band === "high" ? "bg-red-100 text-red-700 border-red-200"
    : band === "medium" ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-emerald-100 text-emerald-700 border-emerald-200"

export function VitalsAiPanel({ news, anomalies }: { news: News2; anomalies: Anomaly[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">AI early-warning</span>
        <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full border ${bandStyle(news.band)}`}>
          NEWS {news.score} · {news.band.toUpperCase()}{news.partial ? " (partial)" : ""}
        </span>
      </div>
      {news.drivers.length > 0 && (
        <p className="text-xs text-slate-500 mb-2"><span className="font-semibold">Drivers:</span> {news.drivers.join(" · ")}</p>
      )}
      {anomalies.length === 0 ? (
        <p className="text-xs text-emerald-600 font-medium">No abnormal values flagged.</p>
      ) : (
        <ul className="space-y-1.5">
          {anomalies.map((a, i) => (
            <li key={i} className={`flex items-center gap-2 text-xs font-semibold ${a.severity === "critical" ? "text-red-600" : "text-amber-600"}`}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> {a.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
