import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { runAdminCopilot } from '@/lib/copilotLLM'
import type { AdminLink, AdminContext } from '@/lib/adminCopilot'

// Admin AI assistant conversation — a single grounded, whole-hospital chat,
// persisted so the thread survives navigation/reload. Answers are produced by
// the grounded engine (runAdminCopilot); the store just records the exchange.

export type AdminMsg = {
  role: 'user' | 'ai'
  text: string
  links?: AdminLink[]
  sources?: string[]
  confidence?: number
  ts: string
}

interface AdminAssistantState {
  messages: AdminMsg[]
  /** Conversational focus carried between turns so follow-ups resolve. */
  context: AdminContext
  /**
   * Append the user's question, run the grounded engine (with the carried
   * context), append the answer, and remember the new focus. Returns the AI
   * message so callers (e.g. the voice console) can speak it.
   */
  ask: (query: string) => AdminMsg | null
  clear: () => void
}

export const useAdminAssistantStore = create<AdminAssistantState>()(
  persist(
    (set, get) => ({
      messages: [],
      context: {},
      ask: (query: string) => {
        const q = query.trim()
        if (!q) return null
        const now = () => new Date().toISOString()
        const userMsg: AdminMsg = { role: 'user', text: q, ts: now() }
        const a = runAdminCopilot(q, get().context)
        const aiMsg: AdminMsg = {
          role: 'ai', text: a.text, links: a.links, sources: a.sources, confidence: a.confidence, ts: now(),
        }
        set(s => ({ messages: [...s.messages, userMsg, aiMsg], context: a.context ?? {} }))
        return aiMsg
      },
      clear: () => set({ messages: [], context: {} }),
    }),
    { name: 'umang-admin-assistant' },
  ),
)
