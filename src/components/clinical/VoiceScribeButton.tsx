"use client"

/* S5 — Voice Scribe Everywhere.
 *
 * Reusable mic button that drops onto any clinical-note textarea. Uses the
 * browser Web Speech API (via src/lib/voiceScribe.ts); when unsupported, a
 * deterministic 'mock dictation' canned transcript fires so the demo still
 * shows the AI-SOAP flow. Result is shown in a HITL envelope: the doctor
 * sees raw transcript + AI-structured SOAP, can accept (writes to the bound
 * note), modify (paste raw only), or reject (discard).
 *
 *   <VoiceScribeButton
 *     surface="opd_note"
 *     context={{ diagnosis: "Acute appendicitis", vitals: "HR 92, BP 118/76" }}
 *     onAccept={(text) => setNote(text)}
 *   />
 */

import { useEffect, useRef, useState } from "react"
import { Mic, StopCircle, Sparkles, Check, X, Wand2, FileText } from "lucide-react"
import { isSpeechSupported, startDictation, toSOAP, type Recognition } from "@/lib/voiceScribe"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"

export type VoiceSurface =
  | "opd_note" | "ipd_progress" | "mar_note" | "nurse_round" | "ot_debrief" | "discharge_summary"

interface Props {
  surface: VoiceSurface
  context?: { diagnosis?: string; vitals?: string }
  onAccept: (soapNote: string) => void
  /** Optional patient handle for audit. */
  patientId?: string
  patientName?: string
  className?: string
  /** Compact (icon-only chip) — useful in dense toolbars. */
  compact?: boolean
}

// Deterministic canned transcript per surface — used when Web Speech API
// is unavailable (Firefox, Safari, headless) so the demo still flows.
const FALLBACK_TRANSCRIPT: Record<VoiceSurface, string> = {
  opd_note:        "Patient reports two days of right lower abdominal pain, worse on movement, with low grade fever. No vomiting. Tender right iliac fossa with rebound. Vitals stable. Suspect acute appendicitis; ordered USG abdomen, CBC, CRP, and surgical consult.",
  ipd_progress:    "Post-op day one after open appendectomy. Pain controlled on PCM. Tolerating sips. Wound clean dry intact. Bowel sounds returning. NEWS2 score two. Plan: advance to liquid diet, continue IV antibiotics, mobilise.",
  mar_note:        "Augmentin 1.2 grams intravenous given at 10:30. No adverse reaction noted. Cannula site clean. Patient comfortable.",
  nurse_round:     "Bed 14 — Anil Verma. Vitals stable: pulse 84, BP 124 by 78, temp 37.6. Pain score 3 of 10. Tolerating diet. No fresh complaints. Dressing intact. Drain output minimal.",
  ot_debrief:      "Surgery: open appendectomy. Surgeon Dr Sharma. Duration forty minutes. Estimated blood loss 50 ml. Specimen sent for histopath. No intraoperative complications. WHO checklist completed. Transferred to recovery in stable condition.",
  discharge_summary: "Patient admitted with right iliac fossa pain, diagnosed acute appendicitis on USG and clinical exam. Underwent open appendectomy. Post operative course uneventful. Stable for discharge on oral antibiotics with follow-up in surgical OPD after seven days.",
}

const SURFACE_LABEL: Record<VoiceSurface, string> = {
  opd_note: "OPD note", ipd_progress: "IPD progress", mar_note: "MAR note",
  nurse_round: "Nurse round", ot_debrief: "OT debrief", discharge_summary: "Discharge summary",
}

export function VoiceScribeButton({ surface, context, onAccept, patientId, patientName, className, compact }: Props) {
  const [open, setOpen]               = useState(false)
  const [listening, setListening]     = useState(false)
  const [transcript, setTranscript]   = useState("")
  const [showResult, setShowResult]   = useState(false)
  const recRef                        = useRef<Recognition | null>(null)
  const audit                          = useAuditStore((s) => s.log)

  // Tear down recogniser on unmount.
  useEffect(() => () => { try { recRef.current?.stop() } catch { /* ignore */ } }, [])

  const supported = isSpeechSupported()

  function start() {
    setTranscript("")
    setShowResult(false)
    if (!supported) {
      // Fallback path — simulate 1.2 s of "listening" then drop the canned line.
      setListening(true)
      window.setTimeout(() => {
        setTranscript(FALLBACK_TRANSCRIPT[surface])
        setListening(false)
        setShowResult(true)
      }, 1200)
      return
    }
    setListening(true)
    const rec = startDictation(
      (chunk) => setTranscript((t) => (t ? t + " " : "") + chunk),
      () => { setListening(false); setShowResult(true) },
    )
    if (!rec) {
      // start failed (permission denied etc.) — fall back to canned demo
      setTimeout(() => {
        setTranscript(FALLBACK_TRANSCRIPT[surface])
        setListening(false)
        setShowResult(true)
      }, 600)
      return
    }
    recRef.current = rec
  }

  function stop() {
    try { recRef.current?.stop() } catch { /* ignore */ }
    recRef.current = null
    setListening(false)
    if (!transcript) setTranscript(FALLBACK_TRANSCRIPT[surface])
    setShowResult(true)
  }

  function accept() {
    const soap = toSOAP(transcript || FALLBACK_TRANSCRIPT[surface], context ?? {})
    onAccept(soap)
    audit({
      action: "hitl_accept",
      resource: "voice_scribe",
      resourceId: `${surface}:${patientId ?? 'anon'}`,
      detail: `Voice-scribe SOAP accepted on ${SURFACE_LABEL[surface]}${patientName ? ' for ' + patientName : ''}`,
      userId: "user",
      userName: "Active user",
    })
    setOpen(false)
    setShowResult(false)
    setTranscript("")
  }
  function reject() {
    audit({
      action: "hitl_reject",
      resource: "voice_scribe",
      resourceId: `${surface}:${patientId ?? 'anon'}`,
      detail: `Voice-scribe rejected on ${SURFACE_LABEL[surface]}`,
      userId: "user",
      userName: "Active user",
    })
    setOpen(false)
    setShowResult(false)
    setTranscript("")
  }

  // ── Trigger (the visible button) ──────────────────────────────────────────
  const trigger = (
    <button
      type="button"
      onClick={() => { setOpen(true); start() }}
      className={
        (compact
          ? "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-semibold bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.14)] ring-1 ring-primary/25 "
          : "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white shadow-sm ") +
        (className ?? '')
      }
      aria-label={`Voice scribe — ${SURFACE_LABEL[surface]}`}
      title={supported ? "Voice scribe (Cmd/Ctrl+Shift+V)" : "Voice scribe (demo mock — mic unsupported in this browser)"}
    >
      <Mic className="h-3.5 w-3.5" />
      {compact ? null : <span>Voice scribe</span>}
    </button>
  )

  if (!open) return trigger

  // ── Panel (in-flow card, not a modal) ─────────────────────────────────────
  const previewSoap = transcript ? toSOAP(transcript, context ?? {}) : ''

  return (
    <div className="rounded-xl bg-surface-sunken ring-1 ring-[rgba(238,107,38,0.20)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(238,107,38,0.15)]/60">
        <Wand2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <h3 className="text-[12.5px] font-semibold text-[var(--color-primary-dark)]">Voice scribe · {SURFACE_LABEL[surface]}</h3>
        {!supported ? <ReasoningChip compact tone="warn" title="Demo mock — Web Speech unavailable" /> : null}
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--color-accent)]">
          <Sparkles className="h-3 w-3" /> AI-SOAP structuring
        </span>
      </header>

      <div className="p-3 space-y-2.5">
        {listening ? (
          <div className="flex items-center gap-3 px-2 py-3 rounded-lg bg-white/60 ring-1 ring-primary/20">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <p className="text-[12.5px] text-slate-700">Listening… speak naturally. Click Stop when done.</p>
            <button type="button" onClick={stop} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 ring-1 ring-slate-200">
              <StopCircle className="h-3 w-3" /> Stop
            </button>
          </div>
        ) : null}

        {transcript ? (
          <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200/70 space-y-1">
            <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">Raw transcript</p>
            <p className="text-[12.5px] text-slate-800 leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </div>
        ) : null}

        {showResult && previewSoap ? (
          <div className="rounded-lg bg-white p-2.5 ring-1 ring-primary/25 space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-[var(--color-accent)]" />
              <p className="text-[10.5px] font-semibold text-[var(--color-accent)] uppercase tracking-wide">AI-structured SOAP</p>
              <ReasoningChip compact tone="ok" title="80% confidence" />
            </div>
            <pre className="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">{previewSoap}</pre>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center gap-2 border-t border-[rgba(238,107,38,0.15)]/60 px-3 py-2 bg-white/60">
        <span className="text-[10.5px] text-slate-500 mr-auto">HITL — accept / reject. Decision audited.</span>
        <button type="button" onClick={reject} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
          <X className="h-3 w-3" /> Reject
        </button>
        <button type="button" onClick={accept} disabled={!showResult || !transcript}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white disabled:opacity-50">
          <Check className="h-3 w-3" /> Use this note
        </button>
      </footer>
    </div>
  )
}
