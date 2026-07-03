"use client"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, BrainCircuit, Activity, AlertCircle } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import type { Patient } from "@/store/usePatientStore"
import { useState, useEffect } from "react"

// Derive a per-patient brief from their actual symptoms/history/triage.
// (Stands in for a model; keeps the brief honest to the selected patient.)
function deriveBrief(patient: Patient): { flag: string; recommend: string } {
  const text = [...patient.symptoms, ...patient.history].join(' ').toLowerCase()
  const has = (...w: string[]) => w.some(k => text.includes(k))
  const urgent = patient.triageLevel === 'Critical' || patient.triageLevel === 'High'

  if (has('chest', 'breath', 'palpitation'))
    return { flag: `${urgent ? 'High-priority' : 'Possible'} cardiac/respiratory symptoms — rule out ACS.`, recommend: 'ECG, Troponin I & Chest X-ray.' }
  if (has('fever', 'sore throat', 'cough', 'cold'))
    return { flag: 'Febrile / respiratory illness — watch for sustained fever.', recommend: 'CBC, CRP; consider Dengue serology if fever persists.' }
  if (has('stomach', 'abdominal', 'loose motion', 'vomit', 'nausea'))
    return { flag: 'GI symptoms — assess hydration & electrolytes.', recommend: 'Stool routine, Serum electrolytes; advise ORS.' }
  if (has('diabetes', 'sugar'))
    return { flag: 'Known diabetic — monitor glycaemic control.', recommend: 'HbA1c & fasting glucose; review medication adherence.' }
  if (has('joint', 'swelling', 'pain'))
    return { flag: 'Musculoskeletal complaint — assess for inflammation.', recommend: 'CRP/ESR; X-ray of affected joint if indicated.' }
  return { flag: urgent ? 'Flagged high-priority at triage — assess promptly.' : 'No acute red flags from intake.', recommend: 'Targeted history & examination; investigate as indicated.' }
}

export function AiPreBrief({ patient }: { patient: Patient }) {
  const [analyzing, setAnalyzing] = useState(true)
  const brief = deriveBrief(patient)
  const hasVitals = !!patient.vitals

  useEffect(() => {
    setAnalyzing(true)
    const t = setTimeout(() => setAnalyzing(false), 1200)
    return () => clearTimeout(t)
  }, [patient.id])

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent-soft flex items-center justify-center border border-primary/20 shadow-sm">
            <BrainCircuit className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-primary-dark)] tracking-tight">AI Pre-Consultation Brief</h3>
            <p className="text-[11px] font-semibold text-[var(--color-accent)]/70 uppercase tracking-wider mt-0.5">Auto-generated summary</p>
          </div>
        </div>
        <NeonBadge variant="purple" dot pulse={analyzing}>
          {analyzing ? "Analyzing Data..." : "Ready"}
        </NeonBadge>
      </div>

      <div className="p-5 relative min-h-[120px]">
        <AnimatePresence mode="wait">
          {analyzing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-[2px]"
            >
              <Sparkles className="h-6 w-6 text-[var(--color-primary-light)] animate-pulse mb-3" />
              <div className="space-y-2 w-3/4 max-w-sm">
                <div className="h-2 w-full rounded-full bg-surface-sunken shimmer" />
                <div className="h-2 w-5/6 rounded-full bg-surface-sunken shimmer" />
                <div className="h-2 w-4/6 rounded-full bg-surface-sunken shimmer" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                <span className="font-bold text-slate-900">Summary:</span> {patient.name.split(' ')[0]} ({patient.age}y) presents with{" "}
                <span className="text-[var(--color-accent)] font-bold bg-accent-soft px-1 rounded">{patient.symptoms.length ? patient.symptoms.join(', ') : 'no specific complaint recorded'}</span>.
                {' '}{patient.history.length ? `History: ${patient.history.join(', ')}.` : 'No significant past medical history.'}
                {' '}{hasVitals ? 'Vitals recorded at triage.' : 'Vitals not yet recorded.'}
              </p>

              <div className="flex gap-3 mt-4">
                <div className="flex-1 rounded-lg border border-danger/20 bg-danger-bg p-3 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-danger mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-danger mb-1">Key Flags</p>
                    <p className="text-xs font-medium text-danger/90">{brief.flag}</p>
                  </div>
                </div>
                <div className="flex-1 rounded-lg border border-border bg-surface-sunken p-3 flex items-start gap-3">
                  <Activity className="h-4 w-4 text-[var(--color-accent)] mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-foreground mb-1">Recommended</p>
                    <p className="text-xs font-medium text-foreground-muted">{brief.recommend}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
