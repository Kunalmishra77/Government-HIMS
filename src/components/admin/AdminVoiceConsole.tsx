"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useLocale, useTranslations } from "next-intl"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Mic, MicOff, X, Loader2, Database, Volume2, Sparkles } from "lucide-react"
import { useAdminAssistantStore } from "@/store/useAdminAssistantStore"
import { startVoiceCommand, speak, cancelSpeech, isSpeechSupported, unlockAudio, type Recognition } from "@/lib/voiceScribe"
import { cn } from "@/lib/utils"

type Phase = "idle" | "listening" | "thinking" | "retrieving" | "speaking"

const VOICE_ERR_KEYS: Record<string, string> = {
  "not-allowed": "assistant.voiceErr.blocked",
  "service-not-allowed": "assistant.voiceErr.blocked",
  "no-speech": "assistant.voiceErr.noSpeech",
  "audio-capture": "assistant.voiceErr.noMic",
  "network": "assistant.voiceErr.network",
  "unsupported": "assistant.voiceErr.unsupported",
}

// Turn a grounded answer (markdown + ₹ + bullets + status glyphs) into something
// that reads naturally aloud: drop markup, expand lakh/crore, say "rupees".
function speakable(s: string): string {
  return s
    .replace(/\*\*/g, "")
    .replace(/^[•\-]\s*/gm, "")
    .replace(/₹\s*([\d.,]+)\s*L\b/gi, "$1 lakh rupees")
    .replace(/₹\s*([\d.,]+)\s*Cr\b/gi, "$1 crore rupees")
    .replace(/₹\s*([\d.,]+)/g, "$1 rupees")
    .replace(/[✅🔴🟡🟢]/g, "")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\n+/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim()
}

const stripMd = (s: string) => s.replace(/\*\*/g, "")

export function AdminVoiceConsole({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin")
  const locale = useLocale() as "en" | "hi"
  const reduce = useReducedMotion()
  const { messages, ask } = useAdminAssistantStore()

  const [phase, setPhase] = useState<Phase>("idle")
  const [interim, setInterim] = useState("")
  const [voiceErr, setVoiceErr] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const recRef = useRef<Recognition | null>(null)
  const phaseRef = useRef<Phase>("idle")
  const activeRef = useRef(false)
  const langRef = useRef<"en" | "hi">(locale)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const supported = typeof window !== "undefined" && isSpeechSupported()

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { langRef.current = locale }, [locale])

  const clearTimers = useCallback(() => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }, [])

  const beginListening = useCallback(() => {
    if (!activeRef.current) return
    setVoiceErr(null)
    setInterim("")
    setPhase("listening")
    recRef.current = startVoiceCommand({
      lang: langRef.current === "hi" ? "hi-IN" : "en-IN",
      graceMs: 20000,
      onPartial: (txt) => setInterim(txt),
      onFinal: (txt) => { setInterim(""); handleUtteranceRef.current(txt) },
      onError: (err) => {
        setVoiceErr(VOICE_ERR_KEYS[err] ? t(VOICE_ERR_KEYS[err]) : t("assistant.voiceErr.generic"))
        setPhase("idle")
      },
      onEnd: () => setPhase(p => (p === "listening" ? "idle" : p)),
    })
    if (!recRef.current) setPhase("idle")
  }, [t])

  // Run the grounded engine, then speak the answer — with visible thinking →
  // retrieving → speaking beats so the state indicators read like a live agent.
  const handleUtterance = useCallback((text: string) => {
    const q = text.trim()
    if (!q) { beginListening(); return }
    clearTimers()
    setPhase("thinking")
    timersRef.current.push(setTimeout(() => {
      setPhase("retrieving")
      const aiMsg = ask(q)
      timersRef.current.push(setTimeout(() => {
        if (!activeRef.current) return
        const line = speakable(aiMsg?.text ?? "")
        setPhase("speaking")
        speak(line, langRef.current, () => { if (activeRef.current) beginListening() })
      }, 220))
    }, 320))
  }, [ask, beginListening, clearTimers])

  const handleUtteranceRef = useRef(handleUtterance)
  useEffect(() => { handleUtteranceRef.current = handleUtterance }, [handleUtterance])

  // Open → start the loop; close/unmount → tear everything down.
  useEffect(() => {
    if (!open) return
    activeRef.current = true
    unlockAudio()
    if (supported) { const id = setTimeout(() => beginListening(), 250); timersRef.current.push(id) }
    return () => {
      activeRef.current = false
      clearTimers()
      recRef.current?.stop()
      recRef.current = null
      cancelSpeech()
      setPhase("idle")
      setInterim("")
    }
  }, [open, supported, beginListening, clearTimers])

  const stop = useCallback(() => { activeRef.current = false; recRef.current?.stop(); cancelSpeech(); clearTimers(); onClose() }, [clearTimers, onClose])

  // The orb is the single control: tap to interrupt while speaking, tap to submit
  // while listening, tap to start when idle.
  const onOrbTap = () => {
    if (phase === "speaking") { cancelSpeech(); recRef.current?.stop(); clearTimers(); beginListening(); return }
    if (phase === "listening") { recRef.current?.stop(); return }
    if (phase === "idle") beginListening()
  }

  const stateLabel =
    phase === "listening" ? t("assistant.voice.state.listening")
      : phase === "thinking" ? t("assistant.voice.state.thinking")
        : phase === "retrieving" ? t("assistant.voice.state.retrieving")
          : phase === "speaking" ? t("assistant.voice.state.speaking")
            : t("assistant.voice.state.idle")

  const lastAi = [...messages].reverse().find(m => m.role === "ai")?.text
  const recent = messages.slice(-6)

  if (!open || !mounted) return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label={t("assistant.voice.title")}
    >
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, rgba(238,107,38,0.22), transparent 70%)" }} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-accent-soft text-accent grid place-items-center flex-shrink-0">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="t-body font-bold text-foreground leading-tight">{t("assistant.voice.title")}</p>
            <StateChip phase={phase} label={stateLabel} />
          </div>
        </div>
        <button onClick={stop} aria-label={t("assistant.voice.close")} className="tap h-10 w-10 rounded-full bg-surface-sunken grid place-items-center text-foreground-muted hover:text-foreground transition-colors">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Orb + spoken line */}
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-7 text-center">
        <Orb phase={phase} reduce={!!reduce} />
        <div className="mt-8 min-h-[104px] flex flex-col items-center max-w-md">
          <AnimatePresence mode="wait">
            <motion.p
              key={lastAi ?? "empty"}
              initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="t-h3 text-foreground leading-snug"
            >
              {lastAi ? stripMd(lastAi.split("\n")[0]) : t("assistant.voice.opening")}
            </motion.p>
          </AnimatePresence>
          {interim && <p className="mt-3 t-body text-foreground-lighter italic">“{interim}”</p>}
        </div>
      </div>

      {/* Live transcript strip */}
      {recent.length > 0 && (
        <div className="relative z-10 mx-auto w-full max-w-lg px-5 pb-2 max-h-[26vh] overflow-y-auto space-y-2">
          {recent.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] px-3.5 py-2 rounded-2xl t-caption leading-snug",
                m.role === "user" ? "bg-primary text-[#0D2032] rounded-br-md" : "bg-surface border border-border text-foreground-muted rounded-bl-md")}>
                {stripMd(m.text)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Control */}
      <div className="relative z-10 px-9 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 flex flex-col items-center gap-3">
        {voiceErr && <p role="alert" className="t-caption font-semibold text-danger text-center">{voiceErr}</p>}
        <button
          onClick={onOrbTap}
          disabled={!supported || phase === "thinking" || phase === "retrieving"}
          aria-label={phase === "listening" ? t("assistant.voice.submit") : phase === "speaking" ? t("assistant.voice.interrupt") : t("assistant.voice.tapToSpeak")}
          className={cn("relative h-[80px] w-[80px] rounded-full grid place-items-center transition-all active:scale-95 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent",
            phase === "listening" ? "bg-danger shadow-[0_10px_30px_rgba(239,68,68,0.4)]"
              : phase === "thinking" || phase === "retrieving" ? "bg-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.35)]"
                : phase === "speaking" ? "bg-accent shadow-[0_10px_30px_rgba(238,107,38,0.4)]"
                  : "bg-accent shadow-[0_10px_30px_rgba(238,107,38,0.4)]")}>
          {phase === "listening" && !reduce && <span className="absolute inset-0 rounded-full bg-danger animate-ping opacity-30" />}
          {phase === "thinking" || phase === "retrieving" ? <Loader2 className="h-8 w-8 text-white animate-spin" aria-hidden="true" />
            : phase === "listening" ? <MicOff className="h-8 w-8 text-white" aria-hidden="true" />
              : phase === "speaking" ? <Volume2 className="h-8 w-8 text-white" aria-hidden="true" />
                : <Mic className="h-8 w-8 text-white" aria-hidden="true" />}
        </button>
        <p className="t-caption text-foreground-lighter text-center h-4">
          {!supported ? t("assistant.voiceErr.unsupported")
            : phase === "listening" ? t("assistant.voice.listeningHint")
              : phase === "speaking" ? t("assistant.voice.interruptHint")
                : phase === "idle" ? t("assistant.voice.tapToSpeak") : ""}
        </p>
      </div>
    </motion.div>,
    document.body,
  )
}

function StateChip({ phase, label }: { phase: Phase; label: string }) {
  const dot =
    phase === "listening" ? "bg-danger" : phase === "thinking" || phase === "retrieving" ? "bg-amber-500" : phase === "speaking" ? "bg-accent" : "bg-foreground-lighter"
  const Icon = phase === "retrieving" ? Database : null
  return (
    <span className="inline-flex items-center gap-1.5 t-caption font-semibold text-foreground-lighter">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot, phase !== "idle" && "animate-pulse")} />
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  )
}

// Breathing gradient sphere: pulses while listening, spins while thinking/retrieving.
function Orb({ phase, reduce }: { phase: Phase; reduce: boolean }) {
  const listening = phase === "listening"
  const speaking = phase === "speaking"
  const busy = phase === "thinking" || phase === "retrieving"
  return (
    <div className="relative h-[180px] w-[180px] flex items-center justify-center">
      {listening && !reduce && [0, 1].map(i => (
        <motion.span key={i} className="absolute h-[160px] w-[160px] rounded-full border-2 border-[#F7B98E]"
          initial={{ scale: 0.85, opacity: 0.5 }} animate={{ scale: 1.45, opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }} />
      ))}
      <motion.div
        className="h-[160px] w-[160px] rounded-full"
        style={{
          background: "radial-gradient(circle at 32% 26%, #FDEADD 0%, #FBD5BC 22%, #F7B98E 46%, #EE6B26 72%, #C2481A 100%)",
          boxShadow: "0 24px 60px rgba(238,107,38,0.42), inset 0 -16px 40px rgba(238,107,38,0.45)",
        }}
        animate={reduce ? {} : {
          scale: listening ? [1, 1.06, 1] : speaking ? [1, 1.04, 1] : [1, 1.02, 1],
          rotate: busy ? 360 : 0,
        }}
        transition={{
          scale: { duration: listening ? 1.3 : speaking ? 1.7 : 3.4, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 3, repeat: busy ? Infinity : 0, ease: "linear" },
        }}
      >
        <div className="h-full w-full rounded-full" style={{ background: "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.6), transparent 46%)" }} />
      </motion.div>
    </div>
  )
}
