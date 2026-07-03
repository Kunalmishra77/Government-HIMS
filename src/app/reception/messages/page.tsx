"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageSquare, Bell, Send, ShieldCheck, ShieldAlert, ArrowUpRight, CheckCheck,
  X, Plus, Bot, User, Headset,
} from "lucide-react"
import { useWhatsAppStore } from "@/store/useWhatsAppStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { useAuthStore, type Role } from "@/store/useAuthStore"
import { StaffMessages } from "@/components/messaging/StaffMessages"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const RECIPIENT_KEY: Record<string, string> = {
  Doctor: 'recipientDoctor', Nurse: 'recipientNurse', Pharmacy: 'recipientPharmacy', Laboratory: 'recipientLaboratory', Billing: 'recipientBilling', Admin: 'recipientAdmin', Ambulance: 'recipientAmbulance',
}

// Map the friendly recipient label to the role the notification is addressed to.
const TO_ROLE: Record<string, Role> = {
  Doctor: 'doctor', Nurse: 'nurse', Pharmacy: 'pharmacy', Laboratory: 'lab', Billing: 'billing', Admin: 'admin', Ambulance: 'ambulance',
}

const THREAD_STATUS: Record<string, string> = {
  active: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', escalated: 'bg-red-50 text-red-600', resolved: 'bg-green-50 text-green-700',
}
const PRIORITY_TINT: Record<string, string> = {
  critical: 'bg-red-50 text-red-600', high: 'bg-primary-soft text-accent', medium: 'bg-amber-50 text-amber-700', low: 'bg-slate-100 text-slate-500',
}
const RECIPIENTS = ['Doctor', 'Nurse', 'Pharmacy', 'Laboratory', 'Billing', 'Admin', 'Ambulance'] as const

export default function ReceptionMessages() {
  const t = useTranslations('reception')
  const { threads, addMessage, escalateToHuman, resolveThread } = useWhatsAppStore()
  const { notifications, unreadCount, markRead, markAllRead, add } = useNotificationStore()

  const receptionId = useAuthStore(s => s.currentUser?.id ?? 'RC-204')
  const [tab, setTab] = useState<'chats' | 'staff' | 'inbox'>('chats')
  const [selectedId, setSelectedId] = useState<string | null>(threads[0]?.id ?? null)
  const [reply, setReply] = useState('')
  const [compose, setCompose] = useState(false)
  const [draft, setDraft] = useState({ to: 'Doctor', subject: '', body: '' })

  const selected = threads.find(t => t.id === selectedId) ?? null
  const escalatedCount = threads.filter(t => t.status === 'escalated').length

  const sendReply = () => {
    if (!reply.trim() || !selected) return
    addMessage(selected.id, { from: 'human_agent', text: reply.trim() })
    setReply('')
  }

  const sendInternal = () => {
    if (!draft.subject.trim() || !draft.body.trim()) { toast.error(t('messages.addSubjectAndMessage')); return }
    const toLabel = t(`messages.${RECIPIENT_KEY[draft.to]}`)
    add({ type: 'system', priority: 'medium', title: t('messages.internalTitle', { to: toLabel, subject: draft.subject.trim() }), body: draft.body.trim(), channels: ['in_app'], targetRole: TO_ROLE[draft.to] })
    toast.success(t('messages.sentToToast', { to: toLabel }))
    setDraft({ to: 'Doctor', subject: '', body: '' })
    setCompose(false)
  }

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('messages.pageTitle')}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{t('messages.pageSubtitle')}</p>
        </div>
        <button onClick={() => setCompose(true)} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13.5px] font-bold shadow-sm active:scale-[0.98] transition">
          <Plus className="h-4 w-4" /> {t('messages.newMessage')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-4">
        <button onClick={() => setTab('chats')} className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition", tab === 'chats' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
          <MessageSquare className="h-3.5 w-3.5" /> {t('messages.patientChats')} {escalatedCount > 0 && <span className="text-[11px] font-bold px-1.5 rounded-full bg-red-100 text-red-600">{escalatedCount}</span>}
        </button>
        <button onClick={() => setTab('staff')} className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition", tab === 'staff' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
          <User className="h-3.5 w-3.5" /> {t('messages.staffMessages')}
        </button>
        <button onClick={() => setTab('inbox')} className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition", tab === 'inbox' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
          <Bell className="h-3.5 w-3.5" /> {t('messages.teamInbox')} {unreadCount > 0 && <span className="text-[11px] font-bold px-1.5 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">{unreadCount}</span>}
        </button>
      </div>

      {tab === 'chats' ? (
        <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-230px)]">
          {/* Thread list */}
          <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] overflow-y-auto">
            {threads.length === 0 && <p className="text-[13px] text-slate-400 p-5 text-center">{t('messages.noConversations')}</p>}
            {threads.map(th => {
              const last = th.messages[th.messages.length - 1]
              return (
                <button key={th.id} onClick={() => setSelectedId(th.id)}
                  className={cn("w-full text-left p-3.5 border-b border-slate-50 transition", selectedId === th.id ? "bg-[rgba(238,107,38,0.07)]/50" : "hover:bg-slate-50")}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[13.5px] font-bold text-slate-900 truncate flex items-center gap-1.5">
                      {th.patientName ?? th.patientPhone}
                      {th.identityVerified ? <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
                    </p>
                    <span className={cn("text-[9.5px] font-bold px-1.5 py-0.5 rounded-full capitalize flex-shrink-0", THREAD_STATUS[th.status])}>{th.status}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 truncate">{last?.from === 'human_agent' ? t('messages.youPrefix') : last?.from === 'ai' ? t('messages.aiPrefix') : ''}{last?.text}</p>
                </button>
              )
            })}
          </div>

          {/* Conversation */}
          <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[14.5px] font-bold text-slate-900 flex items-center gap-1.5">{selected.patientName ?? selected.patientPhone}
                      {selected.identityVerified ? <span className="text-[10px] font-bold text-green-600 flex items-center gap-0.5"><ShieldCheck className="h-3 w-3" /> {t('messages.verified')}</span> : <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5"><ShieldAlert className="h-3 w-3" /> {t('messages.unverified')}</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-400">{selected.patientPhone}</p>
                  </div>
                  <div className="flex gap-2">
                    {selected.status !== 'escalated' && <button onClick={() => { escalateToHuman(selected.id); toast(t('messages.escalatedToast')) }} className="text-[12px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"><ArrowUpRight className="h-3.5 w-3.5" /> {t('messages.escalate')}</button>}
                    {selected.status !== 'resolved' && <button onClick={() => { resolveThread(selected.id); toast.success(t('messages.conversationResolvedToast')) }} className="text-[12px] font-bold text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"><CheckCheck className="h-3.5 w-3.5" /> {t('messages.resolve')}</button>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/40">
                  {selected.messages.map(m => {
                    const mine = m.from === 'human_agent'
                    const ai = m.from === 'ai'
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2", mine ? "bg-[var(--color-primary)] text-white" : ai ? "bg-[rgba(238,107,38,0.07)] text-[var(--color-primary-dark)] border border-[rgba(238,107,38,0.15)]" : "bg-white text-slate-800 border border-slate-100")}>
                          {!mine && <p className="text-[10px] font-bold mb-0.5 flex items-center gap-1 opacity-70">{ai ? <><Bot className="h-3 w-3" /> {t('messages.aiAssistant')}</> : <><User className="h-3 w-3" /> {t('messages.patient')}</>}</p>}
                          <p className="text-[13px] leading-snug">{m.text}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-3 border-t border-slate-100 flex items-center gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendReply() }}
                    placeholder={t('messages.replyPlaceholder')} className="flex-1 h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-800 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20" />
                  <button onClick={sendReply} disabled={!reply.trim()} aria-label={t('messages.send')} className="h-10 w-10 rounded-xl bg-[var(--color-primary)] disabled:bg-slate-200 text-white flex items-center justify-center active:scale-95 transition"><Send className="h-4 w-4" /></button>
                </div>
              </>
            ) : <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400">{t('messages.selectConversation')}</div>}
          </div>
        </div>
      ) : tab === 'staff' ? (
        <div className="h-[calc(100vh-230px)] flex flex-col min-h-0"><StaffMessages meId={receptionId} /></div>
      ) : (
        /* Team inbox */
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-slate-900">{t('messages.notifications')}</h3>
            {unreadCount > 0 && <button onClick={() => markAllRead()} className="text-[12.5px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)]">{t('messages.markAllRead')}</button>}
          </div>
          <div className="space-y-2">
            {notifications.map(n => (
              <button key={n.id} onClick={() => markRead(n.id)}
                className={cn("w-full text-left flex items-start gap-3 rounded-xl p-3 transition", n.read ? "bg-white hover:bg-slate-50" : "bg-[rgba(238,107,38,0.07)]/50 hover:bg-[rgba(238,107,38,0.10)]")}>
                {!n.read && <span className="h-2 w-2 rounded-full bg-[rgba(238,107,38,0.07)]0 mt-1.5 flex-shrink-0" />}
                <div className={cn("flex-1 min-w-0", n.read && "ml-5")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-slate-900 truncate">{n.title}</p>
                    <span className={cn("text-[9.5px] font-bold px-1.5 py-0.5 rounded-full capitalize flex-shrink-0", PRIORITY_TINT[n.priority])}>{n.priority}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 truncate">{n.body}</p>
                  {n.patientName && <p className="text-[11px] text-slate-400 mt-0.5">{n.patientName}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compose modal */}
      <AnimatePresence>
        {compose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCompose(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Headset className="h-5 w-5 text-[var(--color-accent)]" /> {t('messages.newMessage')}</h2>
                <button onClick={() => setCompose(false)} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('messages.labelTo')}</label>
                  <Select value={draft.to} onChange={e => setDraft(d => ({ ...d, to: e.target.value }))} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20">
                    {RECIPIENTS.map(r => <option key={r} value={r}>{t(`messages.${RECIPIENT_KEY[r]}`)}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('messages.labelSubject')}</label>
                  <input value={draft.subject} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} placeholder={t('messages.subjectPlaceholder')} className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('messages.labelMessage')}</label>
                  <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={3} placeholder={t('messages.messagePlaceholder')} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setCompose(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-bold text-[13.5px] hover:bg-slate-50">{t('common.cancel')}</button>
                <button onClick={sendInternal} className="flex-1 h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[13.5px] flex items-center justify-center gap-2"><Send className="h-4 w-4" /> {t('messages.send')}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
