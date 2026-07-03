"use client"

/* S4 — Confirmation preview for a parsed Copilot intent.
 *
 * Renders inside the Command Palette when the user types a natural-language
 * query. The user sees what was understood, the confidence, the reasoning,
 * and an explicit "Run" button BEFORE the app navigates / mutates. Reject
 * sends them back to free-text. Audit-emit on every accept/reject.
 */

import { Sparkles, Check, X, ArrowRight, Wand2 } from "lucide-react"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"
import { describeIntent, type CopilotIntent } from "@/lib/aiCopilot"

interface Props {
  intent: CopilotIntent
  onAccept: () => void
  onReject: () => void
}

type Tone = "ok" | "info" | "warn"
const toneFor = (c: number): Tone => (c >= 0.7 ? "ok" : c >= 0.4 ? "info" : "warn")

export function CopilotPreviewCard({ intent, onAccept, onReject }: Props) {
  const audit = useAuditStore((s) => s.log)
  const confPct = Math.round(intent.confidence * 100)
  const summary = describeIntent(intent)
  const lowConf = intent.confidence < 0.4 || intent.action === "unknown"

  const handleAccept = () => {
    audit({
      action: "hitl_accept",
      resource: "ai_copilot_intent",
      resourceId: intent.action + (intent.object ? ':' + intent.object.value : ''),
      detail: `Copilot intent accepted — ${summary} (conf ${confPct}%)`,
      userId: "user",
      userName: "Active user",
    })
    onAccept()
  }
  const handleReject = () => {
    audit({
      action: "hitl_reject",
      resource: "ai_copilot_intent",
      resourceId: intent.action,
      detail: `Copilot intent rejected — "${intent.raw}"`,
      userId: "user",
      userName: "Active user",
    })
    onReject()
  }

  return (
    <div className="mx-3 my-2 rounded-xl bg-surface-sunken ring-1 ring-[rgba(238,107,38,0.20)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(238,107,38,0.15)]/60">
        <Wand2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <h3 className="text-[12.5px] font-semibold text-[var(--color-primary-dark)]">AI Copilot — confirm before running</h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--color-accent)]">
          <Sparkles className="h-3 w-3" /> {confPct}% confidence
        </span>
      </header>

      <div className="p-3 space-y-2">
        <p className="text-[13.5px] font-semibold text-slate-900">{summary}</p>

        <div className="flex flex-wrap gap-1.5">
          <ReasoningChip compact tone={toneFor(intent.confidence)} title={intent.action.toUpperCase()} />
          {intent.object ? <ReasoningChip compact tone="info" title={`${intent.object.kind}: ${intent.object.value}`} /> : null}
          {intent.patient?.name ? <ReasoningChip compact tone="info" title={intent.patient.name} /> : null}
          {intent.time ? <ReasoningChip compact tone="info" title={intent.time.value} /> : null}
        </div>

        {intent.reasoning.length > 0 ? (
          <ul className="text-[11.5px] text-slate-600 space-y-0.5 pl-4 list-disc marker:text-[var(--color-primary-light)]">
            {intent.reasoning.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : null}

        {intent.destination ? (
          <p className="text-[11.5px] text-slate-700 inline-flex items-center gap-1">
            <ArrowRight className="h-3 w-3 text-[var(--color-accent)]" /> {intent.destination.label}
            <span className="font-mono text-[10.5px] text-slate-400">({intent.destination.route})</span>
          </p>
        ) : null}
      </div>

      <footer className="flex items-center gap-2 border-t border-[rgba(238,107,38,0.15)]/60 px-3 py-2 bg-white/60">
        <span className="text-[10.5px] text-slate-500 mr-auto">HITL — accept / reject. Decision audited.</span>
        <button
          type="button"
          onClick={handleReject}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200"
        >
          <X className="h-3 w-3" /> Reject
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={lowConf && intent.action === "unknown"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="h-3 w-3" /> Run
        </button>
      </footer>
    </div>
  )
}
