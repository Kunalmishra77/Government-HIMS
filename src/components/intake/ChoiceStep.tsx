"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Mic } from "lucide-react"
import type { Choice } from "@/lib/intake/data"
import { cn } from "@/lib/utils"
import { isSpeechSupported, startVoiceCommand, type Recognition } from "@/lib/voiceScribe"
import { toast } from "sonner"

interface Props {
  options: Choice[]
  value: string[]
  onChange: (next: string[]) => void
  multi?: boolean
  otherEnabled?: boolean
  otherPlaceholder?: string
  /** Fill the parent height; chips area flexes and the Other/footer pin to the bottom. */
  fill?: boolean
  /** Render chips as an N-column grid instead of wrapping. */
  columns?: number
  /** Smaller chips (for dense lists like symptoms). */
  compact?: boolean
  /** Pinned bottom content (e.g. the AI assessment bar) — never grows the page. */
  footer?: React.ReactNode
}

/**
 * Tap-to-select chips, single or multi, with an "Other → type" escape hatch.
 * The Other text input and any footer are pinned to the bottom of the area so
 * revealing them shrinks the chip area rather than scrolling the page.
 */
export function ChoiceStep({
  options, value, onChange, multi = false, otherEnabled = false,
  otherPlaceholder = "Type it here…", fill = false, columns, compact = false, footer,
}: Props) {
  const optionValues = options.map(o => o.value)
  const initialOther = value.find(v => !optionValues.includes(v)) ?? ''
  const known = value.filter(v => optionValues.includes(v))

  const [otherActive, setOtherActive] = useState(!!initialOther)
  const [otherText, setOtherText] = useState(initialOther)

  // Voice dictation for the "Other" field — reuses the shared Web Speech helper.
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)
  // Detect speech support only on the client to avoid SSR hydration mismatch.
  const [voiceSupported, setVoiceSupported] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(isSpeechSupported())
    return () => { recRef.current?.stop() }
  }, [])

  const commit = (nextKnown: string[], otherOn: boolean, text: string) => {
    onChange(otherOn && text.trim() ? [...nextKnown, text.trim()] : nextKnown)
  }
  const toggle = (val: string) => {
    if (multi) {
      const next = known.includes(val) ? known.filter(v => v !== val) : [...known, val]
      commit(next, otherActive, otherText)
    } else {
      setOtherActive(false); setOtherText(''); onChange([val])
    }
  }
  const toggleOther = () => {
    const next = !otherActive
    setOtherActive(next)
    if (!next) { setOtherText(''); commit(known, false, '') }
    else if (!multi) onChange([])
  }
  const onOtherText = (t: string) => { setOtherText(t); commit(multi ? known : [], true, t) }

  const toggleDictation = () => {
    if (listening) { recRef.current?.stop(); return }
    recRef.current = startVoiceCommand({
      onPartial: onOtherText,
      onFinal:   onOtherText,
      onEnd:   () => { setListening(false); recRef.current = null },
      onError: (err) => {
        setListening(false); recRef.current = null
        if (err === 'not-allowed') toast.error('Microphone permission denied — allow it in browser settings')
        else if (err !== 'no-speech') toast.error('Voice input failed — please try again')
      },
    })
    if (recRef.current) setListening(true)
    else toast.error('Could not start voice input — check microphone permissions')
  }

  const chipCls = (sel: boolean) => cn(
    "font-semibold transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] text-center",
    compact ? "rounded-[16px] h-11 px-3.5 text-[14px] flex items-center justify-center whitespace-nowrap" : "rounded-[20px] px-5 py-3.5 text-[16px]",
    sel ? "bg-[#EE6B26] border-[#EE6B26] text-[#0D2032] shadow-[0_4px_14px_rgba(238,107,38,0.3)] scale-[0.98]" : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-[0_1px_3px_rgba(0,0,0,0.02)] active:scale-[0.97]"
  )

  return (
    <div className={cn(fill ? "h-full flex flex-col" : "flex flex-col gap-3")}>
      <div
        className={cn(
          columns ? "grid content-start" : "flex flex-wrap content-start",
          compact ? "gap-1.5" : "gap-2",
          fill ? "flex-1 min-h-0 overflow-y-auto pr-1" : "",
        )}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` } : undefined}
      >
        {options.map(opt => {
          const sel = known.includes(opt.value)
          return (
            <button key={opt.value} onClick={() => toggle(opt.value)} aria-pressed={sel} className={chipCls(sel)}>
              <span>{opt.label}</span>
              {opt.desc && !compact && <span className={cn("block text-[11px] mt-0.5", sel ? "text-[rgba(255,255,255,0.75)]" : "text-slate-400")}>{opt.desc}</span>}
            </button>
          )
        })}
        {otherEnabled && (
          <button
            onClick={toggleOther}
            aria-pressed={otherActive}
            className={cn(
              "font-semibold border border-dashed transition-all active:scale-[0.97] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
              compact ? "rounded-[16px] h-11 px-4 text-[14px]" : "rounded-[20px] px-5 py-3.5 text-[16px]",
              otherActive ? "bg-[rgba(238,107,38,0.07)] border-[#F58C4E] text-[#B84A16]" : "bg-white border-slate-300 text-[#B84A16] hover:bg-slate-50",
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Other
          </button>
        )}
      </div>

      {(footer || otherEnabled) && (
        <div className="flex-shrink-0 pt-2 space-y-2">
          <AnimatePresence>
            {otherActive && (
              <motion.div
                key="other-input"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                className="relative"
              >
                <input
                  value={otherText}
                  onChange={e => onOtherText(e.target.value)}
                  placeholder={listening ? "Listening…" : otherPlaceholder}
                  aria-label="Other — type or speak your own"
                  className={cn(
                    "intake-input w-full h-12 rounded-[14px] bg-white border-[1.5px] border-[#F58C4E] text-slate-900 text-[15px] placeholder:text-slate-400 pl-4",
                    voiceSupported ? "pr-12" : "pr-4",
                  )}
                />
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleDictation}
                    aria-label={listening ? "Stop voice input" : "Speak your problem"}
                    aria-pressed={listening}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
                      listening ? "bg-[#EE6B26] text-[#0D2032] animate-pulse" : "bg-[rgba(238,107,38,0.07)] text-[#B84A16] hover:bg-[rgba(238,107,38,0.14)]",
                    )}
                  >
                    <Mic className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {footer}
        </div>
      )}
    </div>
  )
}
