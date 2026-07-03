"use client"

import { Select } from "@/components/ui/Select"
import { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Plus, Send, Trash2, MessageSquare, Copy, Check,
  ClipboardCheck, FileText, User, BrainCircuit, BedDouble, ShieldAlert, Printer,
} from "lucide-react"
import { toast } from "sonner"
import { useAssistantStore, type AssistantDraft } from "@/store/useAssistantStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { runCopilot, type CopilotCtx } from "@/lib/copilotLLM"
import { executeDraft, EXECUTE_LABEL, DONE_LABEL } from "@/lib/copilotTools"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { openPrint, pre } from "@/lib/printDoc"
import { cn } from "@/lib/utils"

const PRINT_KIND: Partial<Record<AssistantDraft['kind'], 'Prescription' | 'Discharge Summary' | 'Referral Letter'>> = {
  prescription: 'Prescription', discharge_summary: 'Discharge Summary', referral: 'Referral Letter',
}

const QUICK_PROMPTS = [
  "Which rounds are due?",
  "Who has diabetes?",
  "Who's in ICU?",
  "Draft a discharge summary for Mohan Lal",
  "Summarise Kiran Patil",
]

export default function AiAssistantPage() {
  const { threads, activeId, newThread, selectThread, appendMessage, deleteThread } = useAssistantStore()
  const allPatients = usePatientStore(s => s.patients)
  const visits = usePatientStore(s => s.visits)
  const allInpatients = useInpatientStore(s => s.inpatients)
  const doctorName = useAuthStore(s => s.currentUser?.name ?? "Dr. Priya Nair")

  const [mounted, setMounted] = useState(false)
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Doctor-scoped data (a doctor only sees their own patients)
  const patients = useMemo(() => allPatients.filter(p => p.doctor === doctorName), [allPatients, doctorName])
  const inpatients = useMemo(() => allInpatients.filter(i => i.admittingDoctor === doctorName), [allInpatients, doctorName])

  // Union of people the doctor can pin as context
  const pinnable = useMemo(() => {
    const map = new Map<string, { id: string; name: string; tag: string }>()
    inpatients.forEach(i => map.set(i.patientId, { id: i.patientId, name: i.name, tag: `Admitted · ${i.bed}` }))
    patients.forEach(p => { if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, tag: p.queueStatus === 'done' ? 'OPD · seen' : 'OPD' }) })
    return [...map.values()]
  }, [patients, inpatients])

  const active = threads.find(t => t.id === activeId) ?? null
  const messages = active?.messages ?? []

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, thinking])

  const send = (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return
    let id = activeId
    if (!id) id = newThread()
    appendMessage(id, { role: 'user', text })
    setInput("")
    setThinking(true)
    const ctx: CopilotCtx = { patients, visits, inpatients, focusId, doctorName }
    const targetId = id
    setTimeout(() => {
      const reply = runCopilot(text, ctx)
      appendMessage(targetId, { role: 'ai', text: reply.text, draft: reply.draft })
      setThinking(false)
    }, 600)
  }

  const focusName = pinnable.find(p => p.id === focusId)?.name

  return (
    <div className="flex h-full gap-4 min-h-0">
      {/* ── Threads history ─────────────────────────── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <button onClick={() => newThread()}
            className="w-full h-10 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white font-semibold text-[13.5px] flex items-center justify-center gap-2 hover:opacity-95 transition">
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
          {!mounted ? null : threads.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center px-3 py-6">Your conversations are saved here.</p>
          ) : threads.map(t => (
            <button key={t.id} onClick={() => selectThread(t.id)}
              className={cn("group w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition", t.id === activeId ? "bg-[rgba(238,107,38,0.07)]" : "hover:bg-slate-50")}>
              <MessageSquare className={cn("h-4 w-4 mt-0.5 flex-shrink-0", t.id === activeId ? "text-[var(--color-accent)]" : "text-slate-400")} />
              <span className="flex-1 min-w-0">
                <span className={cn("block text-[13px] font-semibold truncate", t.id === activeId ? "text-[var(--color-primary-dark)]" : "text-slate-700")}>{t.title}</span>
                <span className="block text-[10.5px] text-slate-400">{new Date(t.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {t.messages.length} msg</span>
              </span>
              <span role="button" tabIndex={0} aria-label="Delete conversation"
                onClick={e => { e.stopPropagation(); deleteThread(t.id) }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 transition">
                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Conversation ────────────────────────────── */}
      <section className="flex-1 flex flex-col min-w-0 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-sm">
              <BrainCircuit className="h-4.5 w-4.5 text-white" />
            </span>
            <div>
              <h1 className="text-[15.5px] font-bold text-slate-900 leading-tight">Clinical Copilot</h1>
              <p className="text-[11px] text-slate-400">Grounded in your {patients.length} OPD · {inpatients.length} admitted patients</p>
            </div>
          </div>
          {/* Focus patient selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Context:</span>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Select value={focusId ?? ''} onChange={e => setFocusId(e.target.value || null)}
                className="h-9 pl-8 pr-7 rounded-xl bg-slate-50 border border-slate-200 text-[12.5px] font-medium text-slate-700 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer max-w-[200px]">
                <option value="">No patient pinned</option>
                {pinnable.map(p => <option key={p.id} value={p.id}>{p.name} — {p.tag}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 min-h-0 bg-[#FBFBFE]">
          {messages.length === 0 && !thinking ? (
            <EmptyHero focusName={focusName} onPick={send} />
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} draft={m.draft} />
              ))}
              {thinking && <ThinkingBubble />}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-slate-100 px-4 py-3 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  rows={1}
                  placeholder={focusName ? `Ask about ${focusName}, or "draft a round note"…` : 'Ask about a patient, a cohort, or request a draft…'}
                  className="w-full resize-none max-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button onClick={() => send(input)} disabled={!input.trim() || thinking} aria-label="Send"
                className="h-11 w-11 flex-shrink-0 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white flex items-center justify-center disabled:opacity-40 hover:opacity-95 transition">
                <Send className="h-4.5 w-4.5" />
              </button>
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2 flex items-center justify-center gap-1.5">
              <ShieldAlert className="h-3 w-3" /> AI · answers drawn from your patient records · verify clinically before acting
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function EmptyHero({ focusName, onPick }: { focusName?: string; onPick: (q: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto px-4">
      <span className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-lg mb-4">
        <Sparkles className="h-7 w-7 text-white" />
      </span>
      <h2 className="text-[20px] font-bold text-slate-900">Your clinical copilot</h2>
      <p className="text-[13.5px] text-slate-500 mt-1.5 leading-relaxed">
        Ask about any of your patients, run cohort questions, or have me draft a note, prescription, or discharge summary — all grounded in your records.
      </p>
      {focusName && <p className="text-[12px] font-semibold text-[var(--color-accent)] mt-3 bg-[rgba(238,107,38,0.07)] px-3 py-1 rounded-full">Pinned: {focusName}</p>}
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {QUICK_PROMPTS.map(p => (
          <button key={p} onClick={() => onPick(p)}
            className="text-[12.5px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:border-[rgba(238,107,38,0.30)] hover:text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] transition">
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ role, text, draft }: { role: 'user' | 'ai'; text: string; draft?: AssistantDraft }) {
  const isUser = role === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center flex-shrink-0 mt-0.5">
          <BrainCircuit className="h-4 w-4 text-white" />
        </span>
      )}
      <div className={cn("max-w-[80%] space-y-2", isUser && "flex flex-col items-end")}>
        <div className={cn("rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
          isUser ? "bg-[var(--color-primary)] text-white rounded-br-md" : "bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm")}>
          <Rich text={text} />
        </div>
        {draft && <DraftCard draft={draft} />}
      </div>
    </motion.div>
  )
}

const DRAFT_ICON: Record<AssistantDraft['kind'], React.ElementType> = {
  round_note: ClipboardCheck, prescription: FileText, discharge_summary: BedDouble, referral: FileText,
}

function DraftCard({ draft }: { draft: AssistantDraft }) {
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const doctorName = useAuthStore(s => s.currentUser?.name ?? "Dr. Priya Nair")
  const signature = useDoctorProfileStore(s => s.signature)
  const Icon = DRAFT_ICON[draft.kind]
  const canExecute = !!draft.patientId
  const printKind = PRINT_KIND[draft.kind]

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft.content); setCopied(true); toast.success("Draft copied"); setTimeout(() => setCopied(false), 1600) }
    catch { toast.error("Couldn't copy") }
  }
  const print = () => {
    if (!printKind) return
    const patient = draft.title.split('·').slice(1).join('·').trim() || 'Patient'
    const ok = openPrint({ kind: printKind, patient, doctor: doctorName, signature, bodyHtml: pre(draft.content) })
    if (!ok) toast.error('Allow pop-ups to print')
  }
  // One-click suggestion → real action, with a confirm tap (no silent writes).
  const run = () => {
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 4000); return }
    const res = executeDraft(draft, doctorName)
    if (res.ok) { setDone(true); toast.success(res.message) }
    else { toast.error(res.message); setConfirming(false) }
  }

  return (
    <div className="w-full rounded-2xl border border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/40 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-white/70 border-b border-[rgba(238,107,38,0.15)]">
        <span className="flex items-center gap-2 text-[12px] font-bold text-[var(--color-primary-dark)]">
          <Icon className="h-3.5 w-3.5" /> {draft.title}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary-light)]">AI draft</span>
      </div>
      <pre className="px-4 py-3 text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">{draft.content}</pre>
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-[rgba(238,107,38,0.15)] bg-white/50">
        <button onClick={copy} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
        {printKind && (
          <button onClick={print} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        )}
        {canExecute && (
          <button onClick={run} disabled={done}
            className={cn("flex items-center gap-1.5 text-[12px] font-semibold text-white rounded-lg px-3 py-1.5 transition disabled:opacity-60", confirming ? "bg-amber-600 hover:bg-amber-700" : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]")}>
            {done ? <Check className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />} {done ? DONE_LABEL[draft.kind] : confirming ? `Confirm — ${EXECUTE_LABEL[draft.kind]}` : EXECUTE_LABEL[draft.kind]}
          </button>
        )}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex gap-2.5 justify-start">
      <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center flex-shrink-0">
        <BrainCircuit className="h-4 w-4 text-white animate-pulse" />
      </span>
      <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 shadow-sm flex items-center gap-1">
        {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary-light)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    </div>
  )
}

// Lightweight markdown: **bold**, _italic_, line breaks.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i} className="block min-h-[2px]">{renderInline(line)}</span>
      ))}
    </>
  )
}
function renderInline(line: string) {
  return line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((seg, i) => {
    if (/^\*\*[^*]+\*\*$/.test(seg)) return <strong key={i} className="font-bold">{seg.slice(2, -2)}</strong>
    if (/^_[^_]+_$/.test(seg)) return <em key={i} className="opacity-70">{seg.slice(1, -1)}</em>
    return <span key={i}>{seg}</span>
  })
}
