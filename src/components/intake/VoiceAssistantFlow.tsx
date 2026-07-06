"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Mic, MicOff, Keyboard, Loader2, MessageSquare, Pencil, AlertTriangle, ShieldCheck, X } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { promptFor, type SlotId } from "@/ai-services/intake-assistant"
import { llmIntakeTurn, type LlmMsg, type Expecting } from "@/ai-services/intake-llm"
import { startVoiceCommand, speak, cancelSpeech, isSpeechSupported, type Recognition } from "@/lib/voiceScribe"
import { registerPatientFromIntake, type RegisterResult } from "@/lib/intake/register"
import { effectiveTriage, DURATION_OPTIONS, upcomingDays, SLOT_TIMES, type IntakeForm } from "@/lib/intake/data"
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

export function VoiceAssistantFlow({ form, update, onTypeInstead }: { form: IntakeForm; update: Update; onTypeInstead: () => void }) {
  const { patients, addPatient, generateFamilyToken } = usePatientStore()
  const reduce = useReducedMotion()
  // Hindi is the default; the assistant auto-detects and switches to the
  // patient's spoken language each turn (no manual toggle).
  const [lang, setLang] = useState<'en' | 'hi'>('hi')
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
  const supported = typeof window !== 'undefined' && isSpeechSupported()

  useEffect(() => { formRef.current = form })
  useEffect(() => { langRef.current = lang })
  useEffect(() => () => { recRef.current?.stop(); cancelSpeech() }, [])

  const pushMsg = useCallback((m: Msg) => { messagesRef.current = [...messagesRef.current, m]; setMessages(messagesRef.current) }, [])

  const beginListening = useCallback(() => {
    setSttError(null)
    setPhase('listening')
    recRef.current = startVoiceCommand({
      lang: langRef.current === 'hi' ? 'hi-IN' : 'en-IN',
      onPartial: setInterim,
      onFinal: (t) => { setInterim(''); processReplyRef.current(t) },
      onError: (err) => { setSttError(err); setPhase('paused') },
      onEnd: () => setPhase(p => (p === 'listening' ? 'paused' : p)),
    })
    if (!recRef.current) setPhase('paused')
  }, [])

  // Speak `say`, then either go to the review screen (done) or listen for the
  // patient's reply. The spoken AI summary plays as the last `done` turn, so the
  // review screen stays silent — no duplicate narration.
  const present = useCallback((say: string, done: boolean) => {
    pushMsg({ role: 'assistant', text: say })
    setPhase('speaking')
    speak(say, langRef.current, () => { if (done) setStage('review'); else beginListening() })
  }, [beginListening, pushMsg])

  // Ask the OpenAI-backed receptionist for the next line + extracted fields.
  const runTurn = useCallback(async (history: LlmMsg[]) => {
    setPhase('thinking')
    const turn = await llmIntakeTurn(history, formRef.current, langRef.current)
    if (!turn) {
      failRef.current += 1
      if (failRef.current >= 3) { setAiDown(true); return }
      present(langRef.current === 'hi' ? 'माफ़ कीजिए, ज़रा फिर से बताइए?' : 'Sorry, could you say that once more?', false)
      return
    }
    failRef.current = 0
    // Adopt the language the assistant detected so TTS + the next STT match the
    // patient. Update the ref synchronously so present() speaks in the right voice.
    if (turn.lang !== langRef.current) { langRef.current = turn.lang; setLang(turn.lang) }
    setExpecting(turn.done ? 'other' : turn.expecting)
    if (Object.keys(turn.patch).length) update(turn.patch)
    present(turn.say, turn.done)
  }, [present, update])

  const processReply = useCallback(async (utterance: string) => {
    setExpecting('other')
    setPhase('thinking')
    pushMsg({ role: 'patient', text: utterance })
    await runTurn(messagesRef.current)
  }, [pushMsg, runTurn])

  useEffect(() => { processReplyRef.current = (t) => { void processReply(t) } }, [processReply])

  // Re-ask a single field from the review screen. The deterministic prompt text
  // asks the question; the patient's answer flows back through the LLM, which
  // updates that field and returns to "done" → review.
  const editField = useCallback((slot: SlotId) => {
    recRef.current?.stop()
    cancelSpeech()
    setStage('chat')
    present(promptFor(slot, formRef.current, langRef.current), false)
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

  const exitVoice = useCallback(() => { recRef.current?.stop(); cancelSpeech(); onTypeInstead() }, [onTypeInstead])

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
    void runTurn([])
  }, [runTurn])

  if (result) {
    return <SuccessStep form={form} patientId={result.patientId} token={result.token} familyToken={result.familyToken} wait={result.estWait} uhid={result.uhid} announce voice lang={lang} />
  }

  if (stage === 'review') {
    return <VoiceReview form={form} lang={lang} submitting={submitting} onUpdate={update} onEdit={editField} onConfirm={() => { void confirmAndRegister() }} onBack={() => editField('symptoms')} />
  }

  const stopAndAnswer = () => { recRef.current?.stop(); if (phase !== 'listening') beginListening() }
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.text ?? ''
  const status =
    phase === 'speaking' ? T.speaking[lang]
      : phase === 'listening' ? T.listening[lang]
        : phase === 'thinking' ? T.thinking[lang]
          : (sttError ? T.retry[lang] : T.tap[lang])

  return (
    <div className="flex flex-col flex-1 h-full w-full relative">
      {/* Soft ambient gradient — premium, restrained */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.22), transparent 70%)' }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-50 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(8,145,178,0.14), transparent 70%)' }} />

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
          <p className={cn("mt-5 text-[14px] font-semibold h-5 flex items-center gap-1.5", phase === 'listening' ? "text-[#0891B2]" : "text-slate-400")}>
            {phase === 'listening' && <span className="inline-flex gap-0.5">
              {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#0891B2] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
            </span>}
            {status}
          </p>

          {/* Quick-reply chips for constrained answers — guarantees gender (and
              similar) can be answered by tap even if speech recognition fails. */}
          {expecting === 'gender' && phase !== 'thinking' && phase !== 'speaking' && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              {(lang === 'hi'
                ? [['Male', 'पुरुष'], ['Female', 'महिला'], ['Other', 'अन्य']]
                : [['Male', 'Male'], ['Female', 'Female'], ['Other', 'Other']]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => quickAnswer(label)}
                  className="h-11 px-5 rounded-full border-2 border-[#0891B2] text-[15px] font-semibold text-[#0E7490] bg-white active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2]"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="relative z-10 px-9 pb-[max(2.25rem,env(safe-area-inset-bottom))] pt-2 flex items-center justify-between">
          <button onClick={() => setShowLog(true)} aria-label="View transcript" disabled={!messages.length} className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-transform disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2]">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
          </button>

          <button
            onClick={stopAndAnswer}
            disabled={!supported || phase === 'speaking' || phase === 'thinking'}
            aria-label={phase === 'listening' ? 'Stop and submit answer' : 'Tap to answer'}
            className={cn("relative h-[88px] w-[88px] rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0891B2]",
              phase === 'listening' ? "bg-red-500 shadow-[0_10px_30px_rgba(239,68,68,0.4)]"
                : phase === 'thinking' || phase === 'speaking' ? "bg-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.35)]"
                  : "bg-[#0891B2] shadow-[0_10px_30px_rgba(8,145,178,0.4)]")}>
            {phase === 'listening' && !reduce && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-30" />}
            {phase === 'thinking' ? <Loader2 className="h-9 w-9 text-white animate-spin" aria-hidden="true" />
              : phase === 'listening' ? <MicOff className="h-9 w-9 text-white" aria-hidden="true" />
                : <Mic className="h-9 w-9 text-white" aria-hidden="true" />}
          </button>

          <button onClick={exitVoice} aria-label="Type instead" className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2]">
            <Keyboard className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {(!supported || aiDown) && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur px-6 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] border-t border-slate-200 text-center">
            <p className="text-[14px] text-slate-600 mb-3">{aiDown ? 'The voice assistant is unavailable right now.' : 'Voice isn’t available on this device.'}</p>
            <button onClick={onTypeInstead} className="w-full py-3.5 rounded-2xl font-semibold text-[15px] text-white bg-[#0891B2] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
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
          className="absolute h-[176px] w-[176px] rounded-full border-2 border-[#22D3EE]"
          initial={{ scale: 0.85, opacity: 0.5 }}
          animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="h-[176px] w-[176px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 32% 26%, #CFFAFE 0%, #67E8F9 22%, #22D3EE 46%, #0891B2 72%, #0E7490 100%)',
          boxShadow: '0 24px 60px rgba(8,145,178,0.42), inset 0 -16px 40px rgba(14,116,144,0.45)',
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
              <div className={cn("max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-snug", m.role === 'patient' ? "bg-[#0891B2] text-white rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md")}>{m.text}</div>
            </div>
          ))}
          {interim && <div className="flex justify-end"><div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-[#0891B2]/40 text-white text-[14px] italic">{interim}</div></div>}
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
    ? { eyebrow: 'जानकारी जाँचें', title: 'अपनी जानकारी की पुष्टि करें', sub: 'पुष्टि करने तक कुछ भी सबमिट नहीं होगा।', patient: 'मरीज़', mobile: 'मोबाइल नंबर', complaint: 'मुख्य शिकायत', duration: 'लक्षण की अवधि', urgency: 'संभावित गंभीरता', appt: 'अपॉइंटमेंट', date: 'तारीख़ चुनें', time: 'समय चुनें', share: 'यह सारांश तेज़ और बेहतर देखभाल के लिए परामर्श से पहले आपके डॉक्टर के साथ साझा किया जाएगा।', confirm: 'पुष्टि करें और टोकन बनाएं', registering: 'दर्ज हो रहा है…', back: 'वापस जाएं', none: 'दर्ज नहीं' }
    : { eyebrow: 'Review Information', title: 'Please confirm your details', sub: 'Nothing is submitted until you confirm.', patient: 'Patient', mobile: 'Mobile Number', complaint: 'Chief Complaint', duration: 'Symptom Duration', urgency: 'Possible Severity / Urgency', appt: 'Appointment', date: 'Choose date', time: 'Choose time', share: 'This brief will be shared with your doctor before the consultation for faster, more accurate care.', confirm: 'Confirm & Generate Token', registering: 'Registering…', back: 'Go back', none: 'Not specified' }

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <header className="px-6 pt-6 pb-2 shrink-0">
        <p className="text-[12px] font-bold uppercase tracking-wider text-[#0891B2]">{t.eyebrow}</p>
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
                    {form.symptoms.map(s => <span key={s} className="px-2.5 py-1 text-[12.5px] font-medium rounded-lg bg-[rgba(8,145,178,0.08)] text-[#0E7490]">{s}</span>)}
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
                    className={cn("flex-shrink-0 min-w-[68px] px-3 py-2 rounded-xl border text-center transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2]",
                      active ? "bg-[#0891B2] border-[#0891B2] text-white shadow-sm" : "bg-slate-50 border-slate-200 text-slate-700")}>
                    <span className="block text-[13px] font-semibold leading-tight">{d.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[12.5px] text-slate-500 mt-3 mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t.time}</p>
            <div className="flex flex-wrap gap-2">
              {SLOT_TIMES.map(time => {
                const active = form.apptTime === time
                return (
                  <button key={time} onClick={() => onUpdate({ apptTime: time })} aria-pressed={active}
                    className={cn("px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2]",
                      active ? "bg-[#0891B2] border-[#0891B2] text-white shadow-sm" : "bg-slate-50 border-slate-200 text-slate-700")}>
                    {time}
                  </button>
                )
              })}
            </div>
          </div>

          <div className={cn("flex items-center justify-between px-4 py-3 rounded-[16px]",
            triage.variant === 'danger' ? 'bg-red-50' : triage.variant === 'warning' ? 'bg-amber-50' : triage.variant === 'orange' ? 'bg-orange-50' : 'bg-green-50')}>
            <span className="flex items-center gap-2.5">
              <AlertTriangle className={cn("h-5 w-5", triage.color)} aria-hidden="true" />
              <span className="text-[14px] font-bold text-slate-900">{t.urgency}</span>
            </span>
            <NeonBadge variant={triage.variant} dot pulse className="px-3 py-1">{triage.level}</NeonBadge>
          </div>

          <div className="flex items-start gap-2.5 px-4 py-3 bg-[rgba(8,145,178,0.06)] rounded-[16px]">
            <ShieldCheck className="h-5 w-5 text-[#0891B2] flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[12.5px] text-[#0E7490] leading-snug">{t.share}</p>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 flex flex-col gap-2.5 border-t border-slate-100 bg-gradient-to-t from-[color:var(--color-background)] via-[color:var(--color-background)] shrink-0 z-20">
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={cn("w-full h-14 rounded-2xl font-semibold text-[17px] text-white transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0891B2] flex items-center justify-center gap-2",
              submitting ? "bg-[#0891B2]/70 cursor-not-allowed" : "bg-[#0891B2] hover:bg-[#0E7490] shadow-[0_8px_20px_rgba(8,145,178,0.28)]")}
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {submitting ? t.registering : t.confirm}
          </button>
          <button onClick={onBack} disabled={submitting} className="w-full h-14 rounded-2xl font-semibold text-[15px] text-slate-600 bg-slate-100/50 hover:bg-slate-100 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2] disabled:opacity-50 disabled:cursor-not-allowed">
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
        <button onClick={onEdit} className="text-[#0891B2] text-[12px] font-semibold flex items-center gap-1 active:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0891B2] rounded px-1">
          <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
        </button>
      </div>
      {children}
    </div>
  )
}
