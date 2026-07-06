"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Send, BrainCircuit, ShieldAlert } from "lucide-react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { runCopilot, type CopilotCtx } from "@/lib/copilotLLM"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const QUICK_PROMPT_KEYS = [
  "quickWhichRounds",
  "quickMostAcute",
  "quickReadyDischarge",
  "quickHandoverSummary",
  "quickCurrentMeds",
  "quickDiabetes",
] as const

type Msg = { role: "user" | "ai"; text: string }

function Rich({ text }: { text: string }) {
  return <>{text.split("\n").map((line, i) => (
    <span key={i} className="block min-h-[2px]">{line.split(/(\*\*[^*]+\*\*)/g).map((s, j) => /^\*\*[^*]+\*\*$/.test(s) ? <strong key={j} className="font-bold">{s.slice(2, -2)}</strong> : <span key={j}>{s}</span>)}</span>
  ))}</>
}

export default function NurseAiAssistant() {
  const t = useTranslations('nurse')
  const inpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const nurseName = useShiftStore(s => s.currentNurseName)
  const wardInpatients = useMemo(() => inpatients.filter(i => activeWard === ALL_WARDS || i.ward === activeWard), [inpatients, activeWard])

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }) }, [messages.length, thinking])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return
    setMessages(m => [...m, { role: "user", text }])
    setInput("")
    setThinking(true)
    const ctx: CopilotCtx = { patients: [], visits: [], inpatients: wardInpatients, focusId: null, doctorName: nurseName }
    setTimeout(() => {
      const reply = runCopilot(text, ctx)
      const body = reply.draft ? `${reply.text}\n\n${reply.draft.content}` : reply.text
      setMessages(m => [...m, { role: "ai", text: body }])
      setThinking(false)
    }, 500)
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-xs"><BrainCircuit className="h-4.5 w-4.5 text-white" /></span>
          <div>
            <h1 className="text-[15.5px] font-bold text-foreground leading-tight">{t('aiAssistant.title')}</h1>
            <p className="text-[11px] text-foreground-placeholder">{t('aiAssistant.grounded', { count: wardInpatients.length, ward: activeWard })}</p>
          </div>
        </div>
        <WardSwitcher />
      </div>

      <section className="flex-1 flex flex-col min-w-0 rounded-2xl bg-surface border border-border shadow-card overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 min-h-0 bg-surface-sunken">
          {messages.length === 0 && !thinking ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto px-4">
              <span className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-sm mb-4"><Sparkles className="h-7 w-7 text-white" /></span>
              <h2 className="text-[20px] font-bold text-foreground">{t('aiAssistant.emptyTitle')}</h2>
              <p className="text-[13.5px] text-foreground-lighter mt-1.5 leading-relaxed">{t('aiAssistant.emptySubtitle')}</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPT_KEYS.map(k => {
                  const prompt = t(`aiAssistant.${k}`)
                  return <button key={k} onClick={() => send(prompt)} className="text-[12.5px] font-medium text-foreground-muted bg-surface border border-border rounded-full px-3.5 py-2 hover:border-primary/30 hover:text-accent hover:bg-accent-soft transition cursor-pointer">{prompt}</button>
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "ai" && <span className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 mt-0.5"><BrainCircuit className="h-4 w-4 text-white" /></span>}
                  <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed", m.role === "user" ? "bg-primary text-[#0D2032] rounded-br-md" : "bg-surface border border-border text-foreground-muted rounded-bl-md shadow-sm")}>
                    <Rich text={m.text} />
                  </div>
                </motion.div>
              ))}
              {thinking && (
                <div className="flex gap-2.5 justify-start">
                  <span className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0"><BrainCircuit className="h-4 w-4 text-white animate-pulse" /></span>
                  <div className="rounded-2xl rounded-bl-md bg-surface border border-border px-4 py-3 shadow-sm flex items-center gap-1">
                    {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-border-light px-4 py-3 bg-surface">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }} rows={1}
              placeholder={t('aiAssistant.inputPlaceholder')}
              className="flex-1 resize-none max-h-32 rounded-2xl border border-border bg-surface-sunken px-4 py-2.5 text-[14px] text-foreground placeholder:text-foreground-placeholder outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/15 transition-colors" />
            <button onClick={() => send(input)} disabled={!input.trim() || thinking} aria-label={t('aiAssistant.send')}
              className="u-press h-11 w-11 flex-shrink-0 rounded-2xl bg-primary hover:bg-primary-dark text-[#0D2032] hover:text-[#0D2032] flex items-center justify-center disabled:opacity-40 transition-colors cursor-pointer"><Send className="h-4.5 w-4.5" /></button>
          </div>
          <p className="text-[10.5px] text-foreground-placeholder mt-2 flex items-center justify-center gap-1.5"><ShieldAlert className="h-3 w-3" /> {t('aiAssistant.disclaimer')}</p>
        </div>
      </section>
    </div>
  )
}
