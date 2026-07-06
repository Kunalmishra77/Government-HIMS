"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Mic, MicOff, Keyboard, Loader2, MessageSquare, Pencil, AlertTriangle, ShieldCheck, X } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { promptFor, type SlotId } from "@/ai-services/intake-assistant"
import { llmIntakeTurn, type LlmMsg, type Expecting } from "@/ai-services/intake-llm"
import { startVoiceCommand, speak, cancelSpeech, isSpeechSupported, type Recognition } from "@/lib/voiceScribe"
import { registerPatientFromIntake, type RegisterResult } from "@/lib/intake/register"
import { effectiveTriage, DURATION_OPTIONS, upcomingDays, type IntakeForm } from "@/lib/intake/data"
import { availableSlots } from "@/lib/intake/slots"
import { CalendarDays, Clock } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { SuccessStep } from "./ReviewSuccess"
import { cn } from "@/lib/utils"

type Update = (patch: Partial<IntakeForm>) => void
type Phase = 'speaking' | 'listening' | 'thinking' | 'paused'
type Stage = 'chat' | 'review'
type Msg = { role: 'assistant' | 'patient'; text: string }

const T = {
  speaking: { en: 'Speaking…', hi: 'बोल रही हूँ…' },
  listening: { en: 'Listening…', hi: 'सुन रही हूँ…' },
  thinking: { en: 'One moment…', hi: 'एक पल…' },
  tap: { en: 'Tap the mic to answer', hi: 'जवाब देने के लिए माइक दबाएं' },
  retry: { en: 'Didn’t catch that — tap to try again', hi: 'समझ नहीं आया — फिर से दबाएं' },
}

// Auto barge-in: open the mic WHILE the assistant speaks so the patient can talk
// over her. OFF by default — without hardware echo-cancellation the mic hears
// Asha's own voice and cuts her off mid-greeting ("Namaskar, Agentix…" → stop).
// The patient can always interrupt reliably by TAPPING the mic instead. Only set
// this true on kiosks/devices with proven acoustic echo-cancellation.
const BARGE_IN = false

// Escalating, reassuring nudges when the patient stays silent (by active language).
const SILENCE_NUDGES = {
  hi: ['क्या आप मेरी आवाज़ सुन पा रहे हैं?', 'कोई बात नहीं, आराम से बताइए।', 'अगर चाहें तो स्क्रीन पर भी भर सकते हैं।'],
  en: ['Can you hear me alright?', 'No rush — please take your time.', 'If you’d prefer, you can fill in your details on the screen.'],
}

export function VoiceAssistantFlow({ form, update, onExitToForm }: { form: IntakeForm; update: Update; onExitToForm: (method: 'type' | 'aadhaar') => void }) {
  const { patients, addPatient, generateFamilyToken } = usePatientStore()
  const reduce = useReducedMotion()
  // Seeds from the globally selected locale so the assistant greets and speaks
  // in the language the patient picked with the toggle; it still auto-detects and
  // switches to the patient's spoken language on each subsequent turn.
  const globalLocale = useLocale() as 'en' | 'hi'
  const [lang, setLang] = useState<'en' | 'hi'>(globalLocale)
  const [messages, setMessages] = useState<Msg[]>([])
  const [interim, setInterim] = useState('')
  const [phase, setPhase] = useState<Phase>('thinking')
  const [stage, setStage] = useState<Stage>('chat')
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sttError, setSttError] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [aiDown, setAiDown] = useState(false)
  // Which field the assistant is currently collecting — drives quick-reply chips
  // (e.g. Male/Female/Other) so constrained answers can be tapped, never stuck.
  const [expecting, setExpecting] = useState<Expecting>('other')

  // The full transcript is the source of truth sent to the LLM each turn; it
  // lives in a ref so the speech callback reads the latest, not a stale closure.
  const messagesRef = useRef<Msg[]>([])
  const recRef = useRef<Recognition | null>(null)
  const formRef = useRef(form)
  const langRef = useRef(lang)
  const failRef = useRef(0)
  const processReplyRef = useRef<(utterance: string) => void>(() => {})
  // Indirection so the auto-advance turn can re-enter runTurn without the
  // callback referencing itself before it's declared.
  const runTurnRef = useRef<(history: LlmMsg[]) => void>(() => {})
  // The date we've already auto-advanced to present slots for — guards against
  // re-presenting (or looping) if the model echoes the date on a later turn.
  const slotsShownForRef = useRef<string>('')
  // Mirrors `expecting` so beginListening (a stable callback) can pick a longer,
  // pause-tolerant mic window for free-form answers like symptoms.
  const expectingRef = useRef<Expecting>('other')
  // Mirrors `phase` for the speech callbacks (which capture a stale closure).
  const phaseRef = useRef<Phase>('thinking')
  // Whether the patient has spoken at all this listen — gates the silence nudges.
  const heardRef = useRef(false)
  // Escalating "are you there?" silence nudges, and the timers that fire them.
  const silenceTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const silenceLevelRef = useRef(0)
  const supported = typeof window !== 'undefined' && isSpeechSupported()

  useEffect(() => { formRef.current = form })
  useEffect(() => { langRef.current = lang })
  // Follow the global locale toggle: switching EN⇄हिं updates the assistant's
  // language so the greeting, quick replies and TTS stay in sync with the UI.
  useEffect(() => { setLang(globalLocale) }, [globalLocale])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => () => { recRef.current?.stop(); cancelSpeech(); silenceTimersRef.current.forEach(clearTimeout) }, [])

  const clearSilenceTimers = useCallback(() => { silenceTimersRef.current.forEach(clearTimeout); silenceTimersRef.current = [] }, [])

  // Indirection so the nudge helpers can call present/beginListening, which are
  // defined further down, without a declaration cycle.
  const beginListeningRef = useRef<(opts?: { bargeIn?: boolean }) => void>(() => {})
  const presentRef = useRef<(say: string, onComplete?: () => void) => void>(() => {})

  // Speak one reassurance line, then resume listening — keeping the escalation
  // level so each nudge is a step up (#14 silence handling).
  const fireNudge = useCallback((text: string) => {
    recRef.current?.stop()
    clearSilenceTimers()
    presentRef.current(text, () => beginListeningRef.current())
  }, [clearSilenceTimers])

  const scheduleSilenceNudges = useCallback(() => {
    const level = silenceLevelRef.current
    const lines = SILENCE_NUDGES[langRef.current]
    if (level >= lines.length) return
    const id = setTimeout(() => {
      if (heardRef.current || phaseRef.current !== 'listening') return
      silenceLevelRef.current = level + 1
      fireNudge(lines[level])
    }, level === 0 ? 6000 : 8000)
    silenceTimersRef.current.push(id)
  }, [fireNudge])

  const pushMsg = useCallback((m: Msg) => { messagesRef.current = [...messagesRef.current, m]; setMessages(messagesRef.current) }, [])

  // Start the microphone. With `bargeIn`, recognition runs WHILE the assistant is
  // still speaking, so the moment the patient starts talking we cut the speech and
  // switch to listening (#13). Otherwise it's a normal listen.
  const beginListening = useCallback((opts?: { bargeIn?: boolean }) => {
    setSttError(null)
    heardRef.current = false
    clearSilenceTimers()
    // Plain listen → show it and start the silence clock now. Barge-in listen runs
    // under the still-playing speech, so the clock starts when the speech ends.
    if (!opts?.bargeIn) { setPhase('listening'); scheduleSilenceNudges() }
    // Snappy one-word answers finalize on a short silence, but two slots need a
    // longer, pause-tolerant window or capture ends early and forces a repeat:
    //   · symptoms — described freely with pauses between complaints/history.
    //   · phone    — dictated digit-by-digit; the gaps between digits are silence.
    // Phone also runs in `digits` mode so the recognizer returns several
    // alternatives and we keep the one that best forms a 10-digit mobile.
    const slot = expectingRef.current
    const tuning =
      slot === 'symptoms' ? { continuous: true, endpointMs: 5000, maxMs: 45000 } :
      slot === 'phone' ? { continuous: true, endpointMs: 2500, maxMs: 20000, digits: true } :
      {}
    recRef.current = startVoiceCommand({
      lang: langRef.current === 'hi' ? 'hi-IN' : 'en-IN',
      graceMs: 25000,
      onPartial: (t) => {
        setInterim(t)
        if (t.trim().length > 0) { heardRef.current = true; clearSilenceTimers() }
        // Barge-in: the patient began talking over the assistant — stop speaking.
        if (opts?.bargeIn && phaseRef.current === 'speaking' && t.trim().length >= 3) {
          cancelSpeech(); setPhase('listening')
        }
      },
      onFinal: (t) => { setInterim(''); clearSilenceTimers(); processReplyRef.current(t) },
      onError: (err) => { setSttError(err); if (phaseRef.current !== 'speaking') setPhase('paused') },
      onEnd: () => setPhase(p => (p === 'listening' ? 'paused' : p)),
      ...tuning,
    })
    if (!recRef.current && !opts?.bargeIn) setPhase('paused')
  }, [clearSilenceTimers, scheduleSilenceNudges])

  useEffect(() => { beginListeningRef.current = beginListening }, [beginListening])

  // Speak `say`, then run `onComplete` (default: listen for the reply). The
  // spoken AI summary plays as the last turn before review, so the review screen
  // stays silent — no duplicate narration.
  const present = useCallback((say: string, onComplete?: () => void) => {
    pushMsg({ role: 'assistant', text: say })
    setPhase('speaking')
    if (onComplete) {
      // Terminal line (handoff / review / auto-advance / nudge) — speak fully, then act.
      speak(say, langRef.current, onComplete)
      return
    }
    // Question line. With barge-in, listen concurrently so the patient can
    // interrupt; when the line finishes we are simply listening for the answer.
    // Without it, fall back to the safe sequential speak → then listen.
    silenceLevelRef.current = 0
    if (BARGE_IN) {
      beginListening({ bargeIn: true })
      speak(say, langRef.current, () => {
        if (phaseRef.current === 'speaking') { setPhase('listening'); scheduleSilenceNudges() }
      })
    } else {
      speak(say, langRef.current, () => beginListening())
    }
  }, [beginListening, pushMsg, scheduleSilenceNudges])

  useEffect(() => { presentRef.current = present }, [present])

  // Ask the OpenAI-backed receptionist for the next line + extracted fields.
  const runTurn = useCallback(async (history: LlmMsg[]) => {
    setPhase('thinking')
    const turn = await llmIntakeTurn(history, formRef.current, langRef.current)
    if (!turn) {
      failRef.current += 1
      if (failRef.current >= 3) { setAiDown(true); return }
      present(langRef.current === 'hi' ? 'माफ़ कीजिए, ज़रा फिर से बताइए?' : 'Sorry, could you say that once more?')
      return
    }
    failRef.current = 0
    // Adopt the language the assistant detected so TTS + the next STT match the
    // patient. Update the ref synchronously so present() speaks in the right voice.
    if (turn.lang !== langRef.current) { langRef.current = turn.lang; setLang(turn.lang) }
    const nextExpecting: Expecting = turn.done ? 'other' : turn.expecting
    setExpecting(nextExpecting)
    expectingRef.current = nextExpecting
    if (Object.keys(turn.patch).length) update(turn.patch)

    // Patient chose to fill the form / scan Aadhaar — speak the handoff line, then
    // stop the assistant and jump into the typed flow.
    if (turn.route === 'manual') { present(turn.say, () => onExitToForm('type')); return }
    if (turn.route === 'aadhaar') { present(turn.say, () => onExitToForm('aadhaar')); return }

    // Just learned the appointment date — auto-advance one turn (no mic) so the
    // server can inject that date's real slots and we present them next. Guarded
    // so it fires exactly once per chosen date (incl. "today", the default).
    if (turn.patch.apptDate && !turn.patch.apptTime && slotsShownForRef.current !== turn.patch.apptDate) {
      slotsShownForRef.current = turn.patch.apptDate
      present(turn.say, () => runTurnRef.current(messagesRef.current)); return
    }

    if (turn.done) { present(turn.say, () => setStage('review')); return }
    present(turn.say)
  }, [present, update, onExitToForm])

  useEffect(() => { runTurnRef.current = (h) => { void runTurn(h) } }, [runTurn])

  const processReply = useCallback(async (utterance: string) => {
    heardRef.current = true
    clearSilenceTimers()
    setExpecting('other')
    setPhase('thinking')
    pushMsg({ role: 'patient', text: utterance })
    await runTurn(messagesRef.current)
  }, [pushMsg, runTurn, clearSilenceTimers])

  useEffect(() => { processReplyRef.current = (t) => { void processReply(t) } }, [processReply])

  // Re-ask a single field from the review screen. The deterministic prompt text
  // asks the question; the patient's answer flows back through the LLM, which
  // updates that field and returns to "done" → review.
  const editField = useCallback((slot: SlotId) => {
    recRef.current?.stop()
    cancelSpeech()
    setStage('chat')
    expectingRef.current = slot === 'symptoms' ? 'symptoms' : 'other'
    present(promptFor(slot, formRef.current, langRef.current))
  }, [present])

  const confirmAndRegister = useCallback(async () => {
    cancelSpeech()
    setSubmitting(true)
    try {
      const res = await registerPatientFromIntake(formRef.current, { patients, addPatient, generateFamilyToken })
      setResult(res)
    } finally {
      setSubmitting(false)
    }
  }, [patients, addPatient, generateFamilyToken])

  const exitVoice = useCallback(() => { recRef.current?.stop(); cancelSpeech(); onExitToForm('type') }, [onExitToForm])

  // Answer a constrained question by tapping a chip — bypasses speech entirely so
  // gender (and similar) can never dead-end on a recognition failure.
  const quickAnswer = useCallback((value: string) => {
    recRef.current?.stop()
    cancelSpeech()
    setInterim('')
    void processReply(value)
  }, [processReply])

  // Kick off the conversation once — the assistant greets and asks the first question.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    // The shared form pre-fills a default appointment (today + first slot) for the
    // typed flow. The voice assistant COLLECTS the date and time from the patient,
    // so clear them first — otherwise the model sees them as "already collected",
    // skips asking, and the review/confirmation shows the default instead of the
    // patient's actual choice.
    update({ apptDate: '', apptTime: '' })
    formRef.current = { ...formRef.current, apptDate: '', apptTime: '' }
    void runTurn([])
  }, [runTurn, update])

  if (result) {
    return <SuccessStep form={form} patientId={result.patientId} token={result.token} familyToken={result.familyToken} wait={result.estWait} uhid={result.uhid} announce voice lang={lang} />
  }

  if (stage === 'review') {
    return <VoiceReview form={form} lang={lang} submitting={submitting} onUpdate={update} onEdit={editField} onConfirm={() => { void confirmAndRegister() }} onBack={() => editField('symptoms')} />
  }

  const stopAndAnswer = () => {
    // Tapping while Asha is speaking interrupts her and starts listening.
    if (phase === 'speaking') { cancelSpeech(); recRef.current?.stop(); clearSilenceTimers(); beginListening(); return }
    recRef.current?.stop(); if (phase !== 'listening') beginListening()
  }
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.text ?? ''
  const status =
    phase === 'speaking' ? T.speaking[lang]
      : phase === 'listening' ? T.listening[lang]
        : phase === 'thinking' ? T.thinking[lang]
          : (sttError ? T.retry[lang] : T.tap[lang])

  // Tap-chips for constrained questions, so the patient can always answer by tap
  // even when speech recognition fails — consultation type, registration method,
  // gender, and the offered appointment slots. `send` is the canonical phrase fed
  // to the LLM; `label` is what's shown.
  const chipsFor = (): { send: string; label: string }[] => {
    if (expecting === 'consultType') return lang === 'hi'
      ? [{ send: 'In person', label: 'अस्पताल आऊँगा' }, { send: 'Video consultation', label: 'वीडियो पर' }]
      : [{ send: 'In person', label: 'In-person visit' }, { send: 'Video consultation', label: 'Video consult' }]
    if (expecting === 'method') return lang === 'hi'
      ? [{ send: 'I will fill it myself', label: 'खुद भरूँगा' }, { send: 'Scan my Aadhaar', label: 'आधार स्कैन' }, { send: 'You take my details', label: 'आप पूछ लीजिए' }]
      : [{ send: 'I will fill it myself', label: 'Fill it myself' }, { send: 'Scan my Aadhaar', label: 'Scan Aadhaar' }, { send: 'You take my details', label: 'Keep talking' }]
    if (expecting === 'gender') return lang === 'hi'
      ? [{ send: 'Male', label: 'पुरुष' }, { send: 'Female', label: 'महिला' }, { send: 'Other', label: 'अन्य' }]
      : [{ send: 'Male', label: 'Male' }, { send: 'Female', label: 'Female' }, { send: 'Other', label: 'Other' }]
    if (expecting === 'apptSlot') return availableSlots(form.apptDate).map(t => ({ send: t, label: t }))
    return []
  }
  const chips = phase === 'thinking' || phase === 'speaking' ? [] : chipsFor()

  return (
    <div className="flex flex-col flex-1 h-full w-full relative">
      {/* Soft ambient gradient — premium, restrained */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(238,107,38,0.22), transparent 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-50 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(238,107,38,0.14), transparent 70%)' }} />

        {/* Orb + spoken text */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-7 text-center">
          <Orb phase={phase} reduce={!!reduce} />
          <div className="mt-9 min-h-[132px] flex flex-col items-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={lastAssistant}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="text-[21px] leading-[1.45] font-semibold text-slate-800 tracking-[-0.01em] max-w-[20rem]"
              >
                {lastAssistant}
              </motion.p>
            </AnimatePresence>
            {interim && <p className="mt-3 text-[15px] text-slate-400 italic">“{interim}”</p>}
          </div>
          <p className={cn("mt-5 text-[14px] font-semibold h-5 flex items-center gap-1.5", phase === 'listening' ? "text-[#B84A16]" : "text-slate-400")}>
            {phase === 'listening' && <span className="inline-flex gap-0.5">
              {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#EE6B26] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
            </span>}
            {status}
          </p>

          {/* Quick-reply chips for constrained answers — guarantees the patient
              can always tap an answer even if speech recognition fails. */}
          {chips.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 max-h-[176px] overflow-y-auto px-1">
              {chips.map(c => (
                <button
                  key={c.send}
                  onClick={() => quickAnswer(c.send)}
                  className="h-11 px-5 rounded-full border-2 border-[#EE6B26] text-[15px] font-semibold text-[#B84A16] bg-white active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="relative z-10 px-9 pb-[max(2.25rem,env(safe-area-inset-bottom))] pt-2 flex items-center justify-between">
          <button onClick={() => setShowLog(true)} aria-label="View transcript" disabled={!messages.length} className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-transform disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            onClick={stopAndAnswer}
            disabled={!supported || phase === 'thinking'}
            aria-label={phase === 'listening' ? 'Stop and submit answer' : phase === 'speaking' ? 'Tap to interrupt and answer' : 'Tap to answer'}
            className={cn("relative h-[88px] w-[88px] rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EE6B26]",
              phase === 'listening' ? "bg-red-500 shadow-[0_10px_30px_rgba(239,68,68,0.4)]"
                : phase === 'thinking' || phase === 'speaking' ? "bg-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.35)]"
                  : "bg-[#EE6B26] shadow-[0_10px_30px_rgba(238,107,38,0.4)]")}>
            {phase === 'listening' && !reduce && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />}
            {phase === 'thinking' ? <Loader2 className="h-9 w-9 text-white animate-spin" aria-hidden="true" />
              : phase === 'listening' ? <MicOff className="h-9 w-9 text-white" aria-hidden="true" />
                : <Mic className="h-9 w-9 text-white" aria-hidden="true" />}
          </button>

          <button onClick={exitVoice} aria-label="Type instead" className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]">
            <Keyboard className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {(!supported || aiDown) && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-slate-200 text-center">
            <p className="text-[14px] text-slate-600 mb-3">{aiDown ? 'The voice assistant is unavailable right now.' : 'Voice isn’t available on this device.'}</p>
            <button onClick={() => onExitToForm('type')} className="w-full py-3.5 rounded-2xl font-semibold text-[15px] text-[#0D2032] bg-[#EE6B26] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
              <Keyboard className="h-5 w-5" aria-hidden="true" /> Type my details instead
            </button>
          </div>
        )}

        {/* Transcript sheet */}
        <AnimatePresence>
          {showLog && <TranscriptSheet messages={messages} interim={interim} onClose={() => setShowLog(false)} />}
        </AnimatePresence>
    </div>
  )
}

// Animated assistant orb — gradient sphere that breathes, pulses while
// listening, and slowly rotates while thinking. Respects reduced-motion.
function Orb({ phase, reduce }: { phase: Phase; reduce: boolean }) {
  const listening = phase === 'listening'
  const speaking = phase === 'speaking'
  const thinking = phase === 'thinking'
  return (
    <div className="relative h-[196px] w-[196px] flex items-center justify-center">
      {listening && !reduce && [0, 1].map(i => (
        <motion.span
          key={i}
          className="absolute h-[176px] w-[176px] rounded-full border-2 border-[#F7B98E]"
          initial={{ scale: 0.85, opacity: 0.5 }}
          animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="h-[176px] w-[176px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 32% 26%, #FDEADD 0%, #FBD5BC 22%, #F7B98E 46%, #EE6B26 72%, #C2481A 100%)',
          boxShadow: '0 24px 60px rgba(238,107,38,0.42), inset 0 -16px 40px rgba(238,107,38,0.45)',
        }}
        animate={reduce ? {} : {
          scale: listening ? [1, 1.06, 1] : speaking ? [1, 1.035, 1] : [1, 1.02, 1],
          rotate: thinking ? 360 : 0,
        }}
        transition={{
          scale: { duration: listening ? 1.3 : speaking ? 1.8 : 3.4, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 3.2, repeat: thinking ? Infinity : 0, ease: 'linear' },
        }}
      >
        <div className="h-full w-full rounded-full" style={{ background: 'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.6), transparent 46%)' }} />
      </motion.div>
    </div>
  )
}

function TranscriptSheet({ messages, interim, onClose }: { messages: Msg[]; interim: string; onClose: () => void }) {
  return (
    <motion.div className="absolute inset-0 z-30 flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button aria-label="Close transcript" onClick={onClose} className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
      <motion.div
        className="relative bg-white rounded-t-[28px] max-h-[72%] flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.15)]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-[16px] font-bold text-slate-900">Conversation</p>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-95"><X className="h-4.5 w-4.5" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 pt-1 space-y-2.5">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === 'patient' ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-snug", m.role === 'patient' ? "bg-[#EE6B26] text-[#0D2032] rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md")}>{m.text}</div>
            </div>
          ))}
          {interim && <div className="flex justify-end"><div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#EE6B26]/40 text-white text-[14px] italic">{interim}</div></div>}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Review Information screen ────────────────────────────────────────
// Visual confirmation of everything the assistant captured. Nothing is
// submitted until the patient taps Confirm; each field can be re-asked by voice.
// (The spoken AI summary plays just before this screen appears, so the review
// screen itself stays silent — no duplicate narration.)
function VoiceReview({ form, lang, submitting, onUpdate, onEdit, onConfirm, onBack }: {
  form: IntakeForm
  lang: 'en' | 'hi'
  submitting: boolean
  onUpdate: (patch: Partial<IntakeForm>) => void
  onEdit: (slot: SlotId) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const triage = effectiveTriage(form)
  const durVal = form.symptoms.map(s => form.symptomDurations[s]).find(Boolean)
  const durLabel = durVal ? DURATION_OPTIONS.find(o => o.value === durVal)?.label : undefined
  const days = upcomingDays(5)
  const t = lang === 'hi'
    ? { eyebrow: 'डिटेल जाँचें', title: 'अपनी डिटेल कन्फ़र्म करें', sub: 'कन्फ़र्म करने तक कुछ भी सबमिट नहीं होगा।', patient: 'मरीज़', mobile: 'मोबाइल नंबर', complaint: 'क्या तकलीफ़ है', duration: 'कब से है', urgency: 'कितनी गंभीर स्थिति', appt: 'अपॉइंटमेंट', date: 'डेट चुनें', time: 'टाइम चुनें', share: 'यह डिटेल आपके डॉक्टर के साथ कंसल्टेशन से पहले शेयर की जाएगी, ताकि आपको जल्दी और बेहतर इलाज मिल सके।', confirm: 'कन्फ़र्म करें और टोकन बनाएं', registering: 'दर्ज हो रहा है…', back: 'वापस जाएँ', none: 'नहीं भरा' }
    : { eyebrow: 'Review Information', title: 'Please confirm your details', sub: 'Nothing is submitted until you confirm.', patient: 'Patient', mobile: 'Mobile Number', complaint: 'Chief Complaint', duration: 'Symptom Duration', urgency: 'Possible Severity / Urgency', appt: 'Appointment', date: 'Choose date', time: 'Choose time', share: 'This brief will be shared with your doctor before the consultation for faster, more accurate care.', confirm: 'Confirm & Generate Token', registering: 'Registering…', back: 'Go back', none: 'Not specified' }

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <header className="px-6 pt-6 pb-2 shrink-0">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[#B84A16]">{t.eyebrow}</p>
        <h2 className="text-[28px] font-bold text-slate-900 tracking-tight mt-0.5 leading-tight">{t.title}</h2>
        <p className="text-[15px] text-slate-500 mt-1">{t.sub}</p>
      </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3 space-y-3">
          <div className="bg-white rounded-[20px] overflow-hidden border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] divide-y divide-slate-100">
            <ReviewRow label={t.patient} onEdit={() => onEdit('name')}>
              <p className="text-[16px] text-slate-900 font-semibold">{form.name || '—'} <span className="text-slate-400 font-normal text-[13px]">· {form.age || '—'} yrs · {form.gender || '—'}</span></p>
            </ReviewRow>
            <ReviewRow label={t.mobile} onEdit={() => onEdit('phone')}>
              <p className="text-[16px] text-slate-900 font-semibold tabular-nums">{form.phone || '—'}</p>
            </ReviewRow>
            <ReviewRow label={t.complaint} onEdit={() => onEdit('symptoms')}>
              {form.symptoms.length === 0
                ? <span className="text-slate-400 text-[14px]">—</span>
                : <div className="flex flex-wrap gap-1.5">
                    {form.symptoms.map(s => <span key={s} className="px-2.5 py-1 text-[12.5px] font-medium rounded-lg bg-[rgba(238,107,38,0.08)] text-[#B84A16]">{s}</span>)}
                  </div>}
            </ReviewRow>
            <ReviewRow label={t.duration} onEdit={() => onEdit('symptomDuration')}>
              <p className="text-[16px] text-slate-900 font-semibold">{durLabel ?? <span className="text-slate-400 font-normal text-[14px]">{t.none}</span>}</p>
            </ReviewRow>
          </div>

          {/* Appointment date + time selector — patient can book in advance */}
          <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4">
            <p className="text-[11px] uppercase text-slate-400 font-bold tracking-wider flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {t.appt}</p>
            <p className="text-[12.5px] text-slate-500 mt-1 mb-2">{t.date}</p>
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {days.map(d => {
                const active = form.apptDate === d.value
                return (
                  <button key={d.value} onClick={() => onUpdate({ apptDate: d.value })} aria-pressed={active}
                    className={cn("flex-shrink-0 min-w-[68px] px-3 py-2 rounded-xl border text-center transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
                      active ? "bg-[#EE6B26] border-[#EE6B26] text-[#0D2032] shadow-sm" : "bg-slate-50 border-slate-200 text-slate-700")}>
                    <span className="block text-[13px] font-semibold leading-tight">{d.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[12.5px] text-slate-500 mt-3 mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t.time}</p>
            <div className="flex flex-wrap gap-2">
              {availableSlots(form.apptDate).map(time => {
                const active = form.apptTime === time
                return (
                  <button key={time} onClick={() => onUpdate({ apptTime: time })} aria-pressed={active}
                    className={cn("px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
                      active ? "bg-[#EE6B26] border-[#EE6B26] text-[#0D2032] shadow-sm" : "bg-slate-50 border-slate-200 text-slate-700")}>
                    {time}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={cn("flex items-center justify-between px-4 py-3 rounded-[16px]",
            triage.variant === 'danger' ? 'bg-red-50' : triage.variant === 'warning' ? 'bg-amber-50' : triage.variant === 'orange' ? 'bg-primary-soft' : 'bg-green-50')}>
            <span className="flex items-center gap-2.5">
              <AlertTriangle className={cn("h-5 w-5", triage.color)} aria-hidden="true" />
              <span className="text-[14px] font-bold text-slate-900">{t.urgency}</span>
            </span>
            <NeonBadge variant={triage.variant} dot pulse className="px-3 py-1">{triage.level}</NeonBadge>
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3 bg-[rgba(238,107,38,0.06)] rounded-[16px]">
            <ShieldCheck className="h-5 w-5 text-[#B84A16] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12.5px] text-[#B84A16] leading-snug">{t.share}</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 flex flex-col gap-2.5 border-t border-slate-100 bg-gradient-to-t from-[color:var(--color-background)] via-[color:var(--color-background)] shrink-0 z-20">
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={cn("w-full h-14 rounded-2xl font-semibold text-[17px] text-[#0D2032] transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EE6B26] flex items-center justify-center gap-2",
              submitting ? "bg-[#EE6B26]/70 cursor-not-allowed" : "bg-[#EE6B26] hover:bg-[#C2481A] shadow-[0_8px_20px_rgba(238,107,38,0.28)]")}
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {submitting ? t.registering : t.confirm}
          </button>
          <button onClick={onBack} disabled={submitting} className="w-full h-14 rounded-2xl font-semibold text-[15px] text-slate-600 bg-slate-100/50 hover:bg-slate-100 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] disabled:opacity-50 disabled:cursor-not-allowed">

            {t.back}
          </button>
        </div>
    </div>
  )
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] uppercase text-slate-400 font-bold tracking-wider">{label}</p>
        <button onClick={onEdit} className="text-[#B84A16] text-[12px] font-semibold flex items-center gap-1 active:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] rounded px-1">
          <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
        </button>
      </div>
      {children}
    </div>
  )
}
