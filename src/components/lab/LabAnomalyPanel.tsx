"use client"

import { useState } from "react"
import { Bot, Loader2, AlertTriangle, Activity } from "lucide-react"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { detectLabAnomalies, type LabAnomaly } from "@/ai-services/lab-anomaly"
import type { AiEnvelope } from "@/types/ai"
import { useNotificationStore } from "@/store/useNotificationStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Track B — surfaces the (stubbed) lab-anomaly AI on the verification bench.
// Detects out-of-range results, classifies severity, and on accept escalates
// any CRITICAL value to the ordering doctor as a callback (closing the loop
// the rules-engine `critical-values` gate exists for). All decisions are
// audit-logged by HitlReviewCard.

const SEV: Record<LabAnomaly['severity'], { box: string; pill: string; label: string }> = {
  critical:   { box: 'bg-red-50 border-red-200',     pill: 'bg-red-600 text-white',      label: 'CRITICAL' },
  abnormal:   { box: 'bg-amber-50 border-amber-200', pill: 'bg-amber-500 text-white',    label: 'ABNORMAL' },
  borderline: { box: 'bg-slate-50 border-slate-200', pill: 'bg-slate-400 text-white',    label: 'BORDERLINE' },
}

export function LabAnomalyPanel({ patientName }: { patientName?: string }) {
  const [env, setEnv] = useState<AiEnvelope<LabAnomaly[]> | null>(null)
  const [loading, setLoading] = useState(false)
  const addNotif = useNotificationStore(s => s.add)

  const run = async () => {
    setLoading(true)
    setEnv(await detectLabAnomalies({}))
    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={run}
        disabled={loading}
        aria-busy={loading}
        className="flex items-center gap-2 px-3.5 py-2 bg-[var(--color-primary)] text-white text-[13px] font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
        {loading ? 'Scanning…' : 'AI anomaly scan'}
      </button>

      {env && (
        <HitlReviewCard
          envelope={env}
          title="AI Lab Anomaly Detection"
          featureId="lab-anomaly-detect"
          renderContent={(rows) => (
            <div className="space-y-2">
              {rows.map((a, i) => {
                const s = SEV[a.severity]
                return (
                  <div key={`${a.testCode}-${i}`} className={cn("rounded-xl border p-3", s.box)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", s.pill)}>{s.label}</span>
                      <span className="text-[13px] font-bold text-slate-900">{a.testName}</span>
                      <span className="ml-auto text-[12px] font-mono font-bold text-slate-700">
                        {a.value} {a.unit} <span className="text-slate-400 font-normal">(ref {a.referenceRange})</span>
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-600">{a.clinicalSignificance}</p>
                    <p className="text-[11.5px] font-medium text-slate-800 mt-0.5 flex items-start gap-1">
                      <Activity className="h-3 w-3 mt-0.5 flex-shrink-0 text-slate-500" aria-hidden="true" />{a.suggestedAction}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
          onAccept={(rows) => {
            const crit = rows.filter(a => a.severity === 'critical')
            crit.forEach(a => addNotif({
              type: 'critical_value', priority: 'critical',
              title: 'Critical value — callback required',
              body: `${patientName ? `${patientName} — ` : ''}${a.testName} ${a.value} ${a.unit} (ref ${a.referenceRange}). ${a.suggestedAction}`,
              targetRole: 'doctor', patientName, channels: ['in_app'],
            }))
            toast.success(crit.length
              ? `${crit.length} critical value(s) escalated to the doctor`
              : 'Anomalies acknowledged')
            setEnv(null)
          }}
          onReject={() => setEnv(null)}
        />
      )}
    </div>
  )
}
