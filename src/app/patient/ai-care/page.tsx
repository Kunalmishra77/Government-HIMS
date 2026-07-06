"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import { Sparkles, Mic, ArrowUp, ShieldCheck, FileText, Stethoscope, Pill, CalendarPlus, Bot, CheckCircle, Eye, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Ask AI (assistant) ───────────────────────────────────────────────
type Msg = { role: 'ai' | 'me'; text: string }
const CANNED: { match: string[]; replyKey: string }[] = [
  { match: ['report', 'result', 'lab', 'cbc', 'blood'], replyKey: 'aiCare.replyReport' },
  { match: ['serious', 'worried', 'chest', 'breath'], replyKey: 'aiCare.replySerious' },
  { match: ['medicine', 'medication', 'tablet', 'drug', 'pill'], replyKey: 'aiCare.replyMedicine' },
  { match: ['book', 'appointment', 'follow', 'visit'], replyKey: 'aiCare.replyBook' },
]
const SUGGESTIONS = [
  { icon: FileText, key: "aiCare.sugReport" },
  { icon: Stethoscope, key: "aiCare.sugSerious" },
  { icon: Pill, key: "aiCare.sugMedicines" },
  { icon: CalendarPlus, key: "aiCare.sugFollowUp" },
]

function AskAI() {
  const t = useTranslations('patient')
  const replyFor = (q: string) => {
    const lower = q.toLowerCase()
    const hit = CANNED.find(c => c.match.some(m => lower.includes(m)))
    return hit ? t(hit.replyKey) : t('aiCare.fallback')
  }
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'ai', text: t('aiCare.greeting') }])
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  const send = (q: string) => {
    if (!q.trim()) return
    setMsgs(m => [...m, { role: 'me', text: q }]); setText("")
    setTimeout(() => setMsgs(m => [...m, { role: 'ai', text: replyFor(q) }]), 450)
  }
  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] flex flex-col overflow-hidden" style={{ minHeight: 420 }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 440 }}>
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.role === 'me' ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed", m.role === 'me' ? "bg-[var(--color-primary)] text-white rounded-br-md" : "bg-slate-100 text-slate-800 rounded-bl-md")}>
                {m.text}
                {m.role === 'ai' && i > 0 && <span className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" /> {t('common.aiGuidance')}</span>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <div className="px-4 pt-2 pb-4 border-t border-slate-100">
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map(s => { const Icon = s.icon; const label = t(s.key); return (
            <button key={s.key} onClick={() => send(label)} className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:border-[rgba(238,107,38,0.30)] hover:text-[var(--color-accent)] transition-colors active:scale-95">
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ) })}
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-3 h-12 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary/25 transition-shadow">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(text) }} placeholder={t('aiCare.inputPlaceholder')} aria-label={t('aiCare.inputAria')} className="intake-input flex-1 bg-transparent border-none text-[15px] text-slate-900 placeholder:text-slate-400" />
          <button aria-label={t('aiCare.speak')} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] transition-colors"><Mic className="h-4.5 w-4.5" /></button>
          <button aria-label={t('aiCare.send')} onClick={() => send(text)} className="h-8 w-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center active:scale-95 transition-transform"><ArrowUp className="h-4.5 w-4.5" /></button>
        </div>
      </div>
    </div>
  )
}

// ── AI in my Care (transparency) ─────────────────────────────────────
type Decision = { titleKey: string; detailKey: string; confidence: number; reviewedBy?: string }
const DECISIONS: Decision[] = [
  { titleKey: 'aiCare.decTriageTitle', detailKey: 'aiCare.decTriageDetail', confidence: 0.91, reviewedBy: 'Triage Nurse' },
  { titleKey: 'aiCare.decBriefTitle', detailKey: 'aiCare.decBriefDetail', confidence: 0.88, reviewedBy: 'Dr. Priya Nair' },
  { titleKey: 'aiCare.decLabTitle', detailKey: 'aiCare.decLabDetail', confidence: 0.93, reviewedBy: 'Dr. Priya Nair' },
  { titleKey: 'aiCare.decDietTitle', detailKey: 'aiCare.decDietDetail', confidence: 0.84 },
]

function Transparency() {
  const t = useTranslations('patient')
  const tier = (c: number) => c >= 0.85 ? { label: t('aiCare.highConfidence'), cls: 'bg-green-50 text-green-700' } : c >= 0.6 ? { label: t('aiCare.reviewSuggested'), cls: 'bg-amber-50 text-amber-700' } : { label: t('aiCare.lowConfidence'), cls: 'bg-red-50 text-red-700' }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-sunken border border-slate-200 p-4 grid grid-cols-3 gap-3 text-center">
        <div><Sparkles className="h-5 w-5 text-[var(--color-accent)] mx-auto mb-1" /><p className="text-[12px] text-slate-500">{t('aiCare.aiIs')}</p><p className="text-[13px] font-bold text-slate-900">{t('aiCare.advisoryOnly')}</p></div>
        <div><CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" /><p className="text-[12px] text-slate-500">{t('aiCare.decisionsBy')}</p><p className="text-[13px] font-bold text-slate-900">{t('aiCare.yourDoctor')}</p></div>
        <div><ShieldCheck className="h-5 w-5 text-[var(--color-accent)] mx-auto mb-1" /><p className="text-[12px] text-slate-500">{t('aiCare.everyAction')}</p><p className="text-[13px] font-bold text-slate-900">{t('aiCare.logged')}</p></div>
      </div>
      <div className="space-y-3">
        {DECISIONS.map(d => { const tr = tier(d.confidence); return (
          <div key={d.titleKey} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[15px] font-bold text-slate-900">{t(d.titleKey)}</p><p className="text-[13px] text-slate-500 mt-0.5">{t(d.detailKey)}</p></div>
              <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", tr.cls)}>{Math.round(d.confidence * 100)}% · {tr.label}</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[12.5px]">
              {d.reviewedBy ? <span className="flex items-center gap-1.5 text-green-700 font-semibold"><CheckCircle className="h-4 w-4" /> {t('aiCare.reviewedApprovedBy', { name: d.reviewedBy })}</span>
                : <span className="flex items-center gap-1.5 text-amber-700 font-semibold"><Eye className="h-4 w-4" /> {t('aiCare.awaitingReview')}</span>}
            </div>
          </div>
        ) })}
      </div>
      <div className="rounded-2xl bg-slate-50 p-4 flex items-start gap-2.5 text-[12.5px] text-slate-500">
        <Lock className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
        {t('aiCare.modelNote')}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function AiCarePage() {
  const t = useTranslations('patient')
  const [tab, setTab] = useState<'ask' | 'transparency'>('ask')
  return (
    <div className="max-w-3xl mx-auto pb-10">
      <h1 className="text-[24px] font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center"><Sparkles className="h-4.5 w-4.5 text-white" /></span>
        {t('aiCare.title')}
      </h1>
      <div className="inline-flex p-1 rounded-xl bg-slate-100 mb-4">
        {([['ask', t('aiCare.tabAsk'), Sparkles], ['transparency', t('aiCare.tabTransparency'), Bot]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-all", tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === 'ask' ? <AskAI /> : <Transparency />}
    </div>
  )
}
