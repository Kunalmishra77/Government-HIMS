"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Plus, X, Search, Users, CheckCheck } from "lucide-react"
import { useMessagingStore, contactById, otherId, unreadFor, DIRECTORY, ROLE_LABEL } from "@/store/useMessagingStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const initials = (n: string) => n.replace(/^Dr\.\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

function cannedReply(role: string): string {
  switch (role) {
    case 'nurse': return "Understood, doctor. I'll action that now and update the chart."
    case 'pharmacy': return "Noted — I'll process that and flag it on the MAR."
    case 'lab': return "Will prioritise and send the report across once verified."
    case 'reception': return "Got it, I'll arrange that and confirm shortly."
    case 'doctor': return "Thanks — reviewed. Please proceed and keep me posted."
    default: return "Acknowledged — will follow up."
  }
}

// Viewer-aware messaging surface. `meId` is the logged-in staff id; the SAME
// store powers the doctor inbox and the nurse portal, each seeing their own side.
export function StaffMessages({ meId }: { meId: string }) {
  const { conversations, sendMessage, startConversation, markRead, receive } = useMessagingStore()
  const mine = conversations.filter(c => c.participants.includes(meId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const [selectedId, setSelectedId] = useState<string | null>(mine[0]?.id ?? null)
  const [reply, setReply] = useState('')
  const [compose, setCompose] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const selected = mine.find(c => c.id === selectedId) ?? null
  useEffect(() => { if (selectedId) markRead(selectedId, meId) }, [selectedId, selected?.messages.length, markRead, meId])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [selected?.messages.length])

  const send = () => {
    if (!reply.trim() || !selected) return
    const id = selected.id
    const other = contactById(otherId(selected, meId))
    sendMessage(id, meId, reply.trim())
    setReply('')
    setTimeout(() => receive(id, other.id, cannedReply(other.role)), 1400)
  }

  return (
    <div className="grid lg:grid-cols-[330px_1fr] gap-4 flex-1 min-h-0">
      {/* Thread list */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] overflow-y-auto flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <button onClick={() => setCompose(true)} className="w-full h-9 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13px] font-bold flex items-center justify-center gap-1.5"><Plus className="h-4 w-4" /> New message</button>
        </div>
        {mine.length === 0 && <p className="text-[13px] text-slate-400 p-5 text-center">No conversations yet.</p>}
        {mine.map(c => {
          const other = contactById(otherId(c, meId))
          const last = c.messages[c.messages.length - 1]
          const unread = unreadFor(c, meId)
          return (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={cn("w-full text-left p-3.5 border-b border-slate-50 transition flex gap-3", selectedId === c.id ? "bg-[rgba(238,107,38,0.07)]/50" : "hover:bg-slate-50")}>
              <span className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center font-bold text-[13px] flex-shrink-0">{initials(other.name)}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-bold text-slate-900 truncate">{other.name}</span>
                  <span className="text-[10.5px] text-slate-400 flex-shrink-0">{timeOf(c.updatedAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-slate-500 truncate">{last?.senderId === meId ? 'You: ' : ''}{last?.text}</span>
                  {unread > 0 && <span className="text-[10px] font-bold text-white bg-[var(--color-primary)] rounded-full h-4.5 min-w-4.5 px-1 flex items-center justify-center flex-shrink-0">{unread}</span>}
                </span>
                <span className="text-[10.5px] font-semibold text-slate-400">{ROLE_LABEL[other.role]} · {other.department}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Conversation */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] flex flex-col overflow-hidden">
        {selected ? (() => {
          const other = contactById(otherId(selected, meId))
          return (
            <>
              <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                <span className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center font-bold text-[13px]">{initials(other.name)}</span>
                <div><p className="text-[14.5px] font-bold text-slate-900 leading-tight">{other.name}</p><p className="text-[11.5px] text-slate-400">{ROLE_LABEL[other.role]} · {other.department}</p></div>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-slate-50/40">
                {selected.messages.map(m => {
                  const mineMsg = m.senderId === meId
                  return (
                    <div key={m.id} className={cn("flex", mineMsg ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2", mineMsg ? "bg-[var(--color-primary)] text-white rounded-br-md" : "bg-white text-slate-800 border border-slate-100 rounded-bl-md")}>
                        <p className="text-[13px] leading-snug">{m.text}</p>
                        <p className={cn("text-[10px] mt-1 flex items-center gap-1 justify-end", mineMsg ? "text-[rgba(255,255,255,0.75)]" : "text-slate-400")}>{timeOf(m.at)} {mineMsg && <CheckCheck className="h-3 w-3" />}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }}
                  placeholder={`Message ${other.name.split(' ')[0]}…`} className="flex-1 h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-800 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20" />
                <button onClick={send} disabled={!reply.trim()} aria-label="Send" className="h-10 w-10 rounded-xl bg-[var(--color-primary)] disabled:bg-slate-200 text-white flex items-center justify-center active:scale-95 transition"><Send className="h-4 w-4" /></button>
              </div>
            </>
          )
        })() : <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400">Select a conversation</div>}
      </div>

      <AnimatePresence>
        {compose && <ComposeModal meId={meId} onClose={() => setCompose(false)} onSend={(toId, text) => { const id = startConversation(meId, toId, text); setSelectedId(id); setCompose(false); toast.success('Message sent') }} />}
      </AnimatePresence>
    </div>
  )
}

function ComposeModal({ meId, onClose, onSend }: { meId: string; onClose: () => void; onSend: (toId: string, text: string) => void }) {
  const [q, setQ] = useState('')
  const [toId, setToId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const list = DIRECTORY.filter(c => c.id !== meId).filter(c => {
    const t = q.trim().toLowerCase()
    return !t || c.name.toLowerCase().includes(t) || ROLE_LABEL[c.role].toLowerCase().includes(t) || c.department.toLowerCase().includes(t)
  })
  const submit = () => {
    if (!toId) { toast.error('Pick a recipient'); return }
    if (!body.trim()) { toast.error('Type a message'); return }
    onSend(toId, body.trim())
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="h-5 w-5 text-[var(--color-accent)]" /> New message</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search staff by name, role or department…"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-[13.5px] text-slate-800 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="max-h-52 overflow-y-auto -mx-1 px-1 space-y-1 mb-3">
          {list.map(c => (
            <button key={c.id} onClick={() => setToId(c.id)}
              className={cn("w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition", toId === c.id ? "bg-[rgba(238,107,38,0.07)] ring-1 ring-primary/25" : "hover:bg-slate-50")}>
              <span className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center font-bold text-[12px]">{initials(c.name)}</span>
              <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-semibold text-slate-900 truncate">{c.name}</span><span className="block text-[11.5px] text-slate-400">{ROLE_LABEL[c.role]} · {c.department}</span></span>
            </button>
          ))}
          {list.length === 0 && <p className="text-[12.5px] text-slate-400 text-center py-4">No staff match “{q}”.</p>}
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Type your message…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-bold text-[13.5px] hover:bg-slate-50">Cancel</button>
          <button onClick={submit} className="flex-1 h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[13.5px] flex items-center justify-center gap-2"><Send className="h-4 w-4" /> Send</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
