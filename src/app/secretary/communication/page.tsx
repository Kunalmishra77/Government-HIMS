'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Megaphone, MessageSquare, Video, Globe, Send, CheckCircle } from 'lucide-react'

const CHANNEL_META = [
  { id: 'broadcast', labelKey: 'communication.chBroadcast', icon: Megaphone, hi: 'सीएमओ प्रसारण', descKey: 'communication.chBroadcastDesc' },
  { id: 'vc', labelKey: 'communication.chVc', icon: Video, hi: 'वीडियो कॉन्फ्रेंस', descKey: 'communication.chVcDesc' },
  { id: 'press', labelKey: 'communication.chPress', icon: Globe, hi: 'प्रेस बयान', descKey: 'communication.chPressDesc' },
  { id: 'public', labelKey: 'communication.chPublic', icon: Globe, hi: 'सार्वजनिक', descKey: 'communication.chPublicDesc' },
]

const RECENT_BROADCASTS = [
  { to: 'All CMOs', subject: 'Dengue preparedness — vector control intensification', time: '2 hrs ago', status: 'delivered', channel: 'In-system + SMS' },
  { to: 'Tribal district CMOs', subject: 'Sickle cell mission Q3 targets communicated', time: '1 day ago', status: 'delivered', channel: 'Email + WhatsApp' },
  { to: 'High-burden malaria CMOs (8)', subject: 'IRS coverage completion deadline extended to June 30', time: '2 days ago', status: 'delivered', channel: 'In-system' },
  { to: 'All CMOs', subject: 'Monthly performance review — June 28, 11 AM', time: '3 days ago', status: 'delivered', channel: 'Video conference invite' },
]

export default function CommunicationPage() {
  const t = useTranslations('secretary')
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSend() {
    if (!message.trim()) return
    setSent(true)
    setTimeout(() => { setSent(false); setMessage(''); setActiveChannel(null) }, 2500)
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('communication.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('communication.subtitle')}</p>
      </div>

      {/* Channel picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CHANNEL_META.map(ch => {
          const Icon = ch.icon
          return (
            <button key={ch.id} onClick={() => setActiveChannel(activeChannel === ch.id ? null : ch.id)}
              className={`bg-white border rounded-xl p-5 text-left transition-all hover:shadow-md ${activeChannel === ch.id ? 'border-[var(--color-primary)] shadow-md bg-primary-soft' : 'border-[var(--color-border)]'}`}
              style={{ boxShadow: 'var(--shadow-card)' }}>
              <Icon className={`h-6 w-6 mb-3 ${activeChannel === ch.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-foreground-muted)]'}`} />
              <p className="text-sm font-bold text-[var(--color-foreground)]">{t(ch.labelKey)}</p>
              <p className="text-[10px] text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{ch.hi}</p>
              <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{t(ch.descKey)}</p>
            </button>
          )
        })}
      </div>

      {/* Compose area */}
      {activeChannel && !sent && (
        <div className="bg-white border border-[var(--color-primary)] rounded-2xl p-5 space-y-3">
          <p className="text-sm font-bold text-[var(--color-foreground)]">{t('communication.compose', { channel: (() => { const c = CHANNEL_META.find(c => c.id === activeChannel); return c ? t(c.labelKey) : '' })() })}</p>
          <input placeholder={t('communication.subjectPlaceholder')} className="w-full border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t('communication.messagePlaceholder')} rows={5}
            className="w-full border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          <div className="flex gap-2">
            <button onClick={handleSend} disabled={!message.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
              <Send className="h-4 w-4" /> {t('communication.send')}
            </button>
            <button onClick={() => setActiveChannel(null)} className="px-5 py-2.5 border border-[var(--color-border)] text-sm rounded-xl">{t('common.cancel')}</button>
          </div>
        </div>
      )}
      {sent && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700">{t('communication.sentSuccess')}</p>
        </div>
      )}

      {/* Recent broadcasts */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">{t('communication.recentBroadcasts')}</h2>
        <div className="space-y-2">
          {RECENT_BROADCASTS.map((b, i) => (
            <div key={i} className="flex items-center gap-4 bg-white border border-[var(--color-border)] rounded-xl px-4 py-3" style={{ boxShadow: 'var(--shadow-card)' }}>
              <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{b.subject}</p>
                <p className="text-xs text-[var(--color-foreground-muted)]">{t('communication.to', { to: b.to, channel: b.channel })}</p>
              </div>
              <span className="text-xs text-[var(--color-foreground-lighter)] flex-shrink-0">{b.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
