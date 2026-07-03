"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Mic, ArrowUp, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  { q: "Explain my report", a: "Your latest CBC is largely normal. Your haemoglobin is 13.2 g/dL (healthy). One marker — WBC — is slightly raised, which usually points to a minor infection your body is already fighting. Nothing urgent; your doctor has seen this." },
  { q: "Is this serious?", a: "Based on what you've shared (chest tightness + breathlessness), this is being treated as high priority and you've been fast-tracked. Please don't leave the premises — if the tightness worsens, tell any staff member immediately." },
  { q: "What are my medicines for?", a: "You're on 2 medicines. One controls blood sugar (take with meals), one is a short course for your current symptoms. They're safe together — no interactions detected. I'll remind you when each is due." },
  { q: "Book a follow-up", a: "Your earliest good slot is Thursday 4:00 PM with Dr. Priya Nair (shortest wait that day). Want me to book it?" },
]

export function AiCompanionBar() {
  const [active, setActive] = useState<number | null>(null)
  const [text, setText] = useState("")

  return (
    <div
      className="rounded-3xl shadow-[0_8px_28px_rgba(238,107,38,0.25)] p-4"
      style={{
        background: 'linear-gradient(#fff,#fff) padding-box, linear-gradient(to right,var(--color-primary),var(--color-primary-light),var(--color-primary)) border-box',
        border: '1.5px solid transparent',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-slate-900 leading-tight">Your AI Health Companion</p>
          <p className="text-[12px] text-slate-400">Ask anything about your health, reports, or visit</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 h-12 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary/25 transition-shadow">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ask about your health…"
          aria-label="Ask the AI health companion"
          className="intake-input flex-1 bg-transparent border-none text-[15px] text-slate-900 placeholder:text-slate-400"
        />
        <button aria-label="Speak" className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] transition-colors"><Mic className="h-4.5 w-4.5" /></button>
        <button aria-label="Send" className="h-8 w-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowUp className="h-4.5 w-4.5" /></button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s, i) => (
          <button key={s.q} onClick={() => setActive(active === i ? null : i)}
            className={cn("text-[13px] font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95",
              active === i ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white" : "bg-white border-slate-200 text-slate-600 hover:border-[rgba(238,107,38,0.30)]")}>
            {s.q}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {active !== null && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-3 rounded-2xl bg-[rgba(238,107,38,0.07)]/70 border border-[rgba(238,107,38,0.15)] p-4">
              <p className="text-[14px] text-slate-800 leading-relaxed">{SUGGESTIONS[active].a}</p>
              <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                AI-generated for guidance · always verify with your doctor
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
