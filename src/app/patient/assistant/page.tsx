"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import { Sparkles, Mic, ArrowUp, ShieldCheck, FileText, Stethoscope, Pill, CalendarPlus } from "lucide-react"
import { cn } from "@/lib/utils"

type Msg = { role: 'ai' | 'me'; text: string }

const CANNED: { match: string[]; replyKey: string }[] = [
  { match: ['report', 'result', 'lab', 'cbc', 'blood'], replyKey: 'assistant.replyReport' },
  { match: ['serious', 'worried', 'chest', 'breath'], replyKey: 'assistant.replySerious' },
  { match: ['medicine', 'medication', 'tablet', 'drug', 'pill'], replyKey: 'assistant.replyMedicine' },
  { match: ['book', 'appointment', 'follow', 'visit'], replyKey: 'assistant.replyBook' },
  { match: ['diet', 'food', 'eat'], replyKey: 'assistant.replyDiet' },
]

const SUGGESTIONS = [
  { icon: FileText, key: "aiCare.sugReport" },
  { icon: Stethoscope, key: "aiCare.sugSerious" },
  { icon: Pill, key: "aiCare.sugMedicines" },
  { icon: CalendarPlus, key: "aiCare.sugFollowUp" },
]

export default function AssistantPage() {
  const t = useTranslations('patient')
  const replyFor = (q: string) => {
    const lower = q.toLowerCase()
    const hit = CANNED.find(c => c.match.some(m => lower.includes(m)))
    return hit ? t(hit.replyKey) : t('assistant.fallback')
  }
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'ai', text: t('assistant.greeting') },
  ])
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = (q: string) => {
    if (!q.trim()) return
    setMsgs(m => [...m, { role: 'me', text: q }])
    setText("")
    setTimeout(() => setMsgs(m => [...m, { role: 'ai', text: replyFor(q) }]), 500)
  }

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      <div className="mb-3">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center"><Sparkles className="h-4.5 w-4.5 text-white" /></span>
          {t('assistant.title')}
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">{t('assistant.subtitle')}</p>
      </div>

      <div className="flex-1 rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 280 }}>
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={cn("flex", m.role === 'me' ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed",
                  m.role === 'me' ? "bg-[var(--color-primary)] text-white rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md")}>
                  {m.text}
                  {m.role === 'ai' && i > 0 && (
                    <span className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" /> {t('common.aiGuidance')}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={endRef} />
        </div>

        <div className="px-4 pt-2 pb-4 border-t border-slate-100">
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTIONS.map(s => {
              const Icon = s.icon
              const label = t(s.key)
              return (
                <button key={s.key} onClick={() => send(label)}
                  className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-[rgba(238,107,38,0.30)] hover:text-[var(--color-accent)] transition-colors active:scale-95">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 h-12 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary/25 transition-shadow">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(text) }}
              placeholder={t('assistant.inputPlaceholder')} aria-label={t('assistant.inputAria')}
              className="intake-input flex-1 bg-transparent border-none text-[15px] text-slate-900 placeholder:text-slate-400" />
            <button aria-label={t('aiCare.speak')} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] transition-colors"><Mic className="h-4.5 w-4.5" /></button>
            <button aria-label={t('aiCare.send')} onClick={() => send(text)} className="h-8 w-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowUp className="h-4.5 w-4.5" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
