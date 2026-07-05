"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Mic, Send, ArrowRight, Trash2, ShieldCheck } from "lucide-react"
import { useAdminAssistantStore } from "@/store/useAdminAssistantStore"
import { isSpeechSupported, unlockAudio } from "@/lib/voiceScribe"
import { AdminVoiceConsole } from "@/components/admin/AdminVoiceConsole"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const SUGGESTION_KEYS = [
  "assistant.suggestion.snapshot",
  "assistant.suggestion.revenue",
  "assistant.suggestion.icu",
  "assistant.suggestion.licences",
  "assistant.suggestion.coverage",
  "assistant.suggestion.denialRisk",
  "assistant.suggestion.statutory",
  "assistant.suggestion.erCensus",
]

// Lightweight inline formatter: **bold** segments only (answers are plain text + bullets).
function fmt(line: string): ReactNode {
  const parts = line.split("**")
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-bold text-foreground">{p}</strong> : <span key={i}>{p}</span>))
}

function AnswerText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        const bullet = line.trimStart().startsWith("•")
        return (
          <p key={i} className={cn("t-body text-foreground-muted leading-relaxed", bullet && "pl-1")}>
            {fmt(line)}
          </p>
        )
      })}
    </div>
  )
}

export default function AdminAssistantPage() {
  const t = useTranslations('admin')
  const router = useRouter()
  const { messages, ask, clear } = useAdminAssistantStore()
  const [input, setInput] = useState("")
  const [mounted, setMounted] = useState(false)
  const [voiceOk, setVoiceOk] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true); setVoiceOk(isSpeechSupported()) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages.length])

  const submit = (text: string) => {
    const q = text.trim()
    if (!q) return
    ask(q)
    setInput("")
  }

  const empty = mounted && messages.length === 0

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] max-w-3xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 rounded-xl bg-accent-soft text-accent grid place-items-center flex-shrink-0">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="t-title text-foreground leading-tight">Agentix HIMS AI</h2>
            <p className="t-caption text-foreground-lighter">{t('assistant.headerSubtitle')}</p>
          </div>
        </div>
        {mounted && messages.length > 0 && (
          <button onClick={clear} className="inline-flex items-center gap-1.5 t-caption font-semibold text-foreground-lighter hover:text-danger transition-colors tap rounded-lg px-2 py-1" aria-label={t('assistant.clearConversation')}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('assistant.clear')}
          </button>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1" aria-live="polite" aria-label={t('assistant.conversation')}>
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <span className="h-14 w-14 rounded-2xl bg-accent-soft text-accent grid place-items-center mb-4">
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </span>
            <h3 className="t-h3 text-foreground">{t('assistant.emptyHeading')}</h3>
            <p className="t-body text-foreground-lighter mt-1.5 max-w-md">
              {t('assistant.emptyBody')}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-xl">
              {SUGGESTION_KEYS.map(key => {
                const label = t(key)
                return (
                  <button
                    key={key}
                    onClick={() => submit(label)}
                    className="rounded-full border border-border bg-surface px-3.5 py-1.5 t-caption font-semibold text-foreground-muted hover:border-primary hover:text-accent hover:bg-accent-soft transition-colors"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-4">
            {messages.map((m, i) => (
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-[#0D2032] px-4 py-2.5 t-body">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className="h-8 w-8 rounded-lg bg-accent-soft text-accent grid place-items-center flex-shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 shadow-card">
                    <AnswerText text={m.text} />
                    {m.links && m.links.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.links.map(l => (
                          <button
                            key={l.route}
                            onClick={() => router.push(l.route)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 t-caption font-semibold text-accent hover:bg-accent-soft hover:border-primary transition-colors"
                          >
                            {l.label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <p className="mt-2.5 inline-flex items-center gap-1.5 t-caption text-foreground-lighter">
                        <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                        {t('assistant.grounded')} · {m.sources.join(", ")}{typeof m.confidence === "number" ? ` · ${Math.round(m.confidence * 100)}%` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); submit(input) }}
        className="mt-3 flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-card focus-within:border-primary transition-colors"
      >
        {voiceOk && (
          <button
            type="button"
            onClick={() => { unlockAudio(); setVoiceOpen(true) }}
            aria-label={t('assistant.voice.title')}
            className="tap grid place-items-center h-11 w-11 rounded-xl flex-shrink-0 text-accent hover:bg-accent-soft transition-colors"
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <label htmlFor="admin-ai-input" className="sr-only">{t('assistant.inputLabel')}</label>
        <input
          id="admin-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('assistant.inputPlaceholder')}
          autoComplete="off"
          className="flex-1 bg-transparent px-2 py-2.5 t-body text-foreground placeholder:text-foreground-placeholder focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label={t('assistant.send')}
          className="tap grid place-items-center h-11 w-11 rounded-xl flex-shrink-0 bg-primary text-[#0D2032] hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
      <p className="mt-2 t-caption text-foreground-lighter text-center">
        {t('assistant.disclaimer')}
      </p>
      <AdminVoiceConsole open={voiceOpen} onClose={() => setVoiceOpen(false)} />
    </div>
  )
}
