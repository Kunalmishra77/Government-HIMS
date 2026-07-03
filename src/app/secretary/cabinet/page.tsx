'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  Sparkles, Send, FileText, CheckCircle, Lock, Edit3, RefreshCw,
  Clock, Languages, BarChart3, Minimize2, Maximize2, FileCheck,
  MessageSquare, BookOpen, Link2,
} from 'lucide-react'
import { useSecretaryCabinetStore }  from '@/store/useSecretaryCabinetStore'
import { useSecretaryAssemblyStore } from '@/store/useSecretaryAssemblyStore'
import type { CabinetNote, AssemblyQuestion } from '@/types/secretary'

// ── Streaming text animation ──────────────────────────────────────────────
function useStreamingText(fullText: string | null, enabled: boolean) {
  const [displayed, setDisplayed] = useState('')
  const [streaming, setStreaming] = useState(false)
  const iRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!fullText || !enabled) { setDisplayed(fullText || ''); return }
    setDisplayed('')
    setStreaming(true)
    let i = 0
    iRef.current = setInterval(() => {
      i += 6
      setDisplayed(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(iRef.current!)
        setDisplayed(fullText)
        setStreaming(false)
      }
    }, 16)
    return () => { if (iRef.current) clearInterval(iRef.current) }
  }, [fullText, enabled])

  return { displayed, streaming }
}

// ── Cabinet notes tab ────────────────────────────────────────────────────
function CabinetNotesTab() {
  const t = useTranslations('secretary')
  const store = useSecretaryCabinetStore()
  // Read currentDraft as a reactive value so the effect fires when it changes
  const currentDraft = useSecretaryCabinetStore(s => s.currentDraft)
  const [editableText, setEditableText] = useState('')
  const [streamTarget, setStreamTarget] = useState<string | null>(null)
  const [sendModal, setSendModal] = useState<CabinetNote | null>(null)
  const [sentChannel, setSentChannel] = useState('')

  const { displayed, streaming: isStreaming } = useStreamingText(streamTarget, true)

  useEffect(() => {
    store.loadNotes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When generateDraft resolves and updates currentDraft in the store, kick off streaming
  useEffect(() => {
    if (currentDraft && !store.drafting) {
      setStreamTarget(currentDraft)
    }
  }, [currentDraft, store.drafting])

  useEffect(() => {
    if (displayed) setEditableText(displayed)
  }, [displayed])

  async function handleDraft() {
    if (!store.drafterPrompt.trim()) return
    setStreamTarget(null)
    setEditableText('')
    await store.generateDraft()
    // currentDraft update triggers the useEffect above → sets streamTarget
  }

  async function handleSave() {
    if (!editableText.trim()) return
    await store.saveDraft()
    store.loadNotes()
  }

  async function handleSign(id: string) {
    await store.signDraft(id)
    store.loadNotes()
  }

  async function handleSendToMinister(note: CabinetNote, channel: string) {
    await store.sendToMinister(note.id, channel)
    store.loadNotes()
    setSentChannel(channel)
    setTimeout(() => { setSendModal(null); setSentChannel('') }, 1500)
  }

  const statusColor: Record<CabinetNote['status'], string> = {
    draft: 'bg-amber-100 text-amber-700',
    signed: 'bg-surface-sunken text-accent',
    sent: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="grid grid-cols-4 gap-0 h-[calc(100vh-220px)] min-h-[600px]">
      {/* Left: Recent notes */}
      <div className="col-span-1 border-r border-[var(--color-border)] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">{t('cabinet.recentNotes')}</p>
        </div>
        {store.notes.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-[var(--color-foreground-lighter)]">
            {t('cabinet.noNotes')}
          </div>
        )}
        {store.notes.map(note => (
          <div key={note.id} className="px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            onClick={() => { setEditableText(note.content); store.setDrafterPrompt(note.prompt) }}>
            <p className="text-xs font-medium text-[var(--color-foreground)] line-clamp-2">{note.prompt || t('cabinet.untitled')}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor[note.status]}`}>{note.status}</span>
              <span className="text-[10px] text-[var(--color-foreground-lighter)]">{new Date(note.createdAt).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Middle: Drafter */}
      <div className="col-span-2 flex flex-col border-r border-[var(--color-border)]">
        {/* Prompt area */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('cabinet.drafterTitle')}</span>
            <span className="text-[10px] text-[var(--color-foreground-lighter)] font-[Noto_Sans_Devanagari]">कैबिनेट नोट तैयारकर्ता</span>
          </div>
          <input
            value={store.drafterPrompt}
            onChange={e => store.setDrafterPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleDraft() }}
            placeholder={t('cabinet.promptPlaceholder')}
            className="w-full border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] mb-3"
          />
          {/* Template chips */}
          <div className="flex flex-wrap gap-2 mb-3">
            {store.templates.map(tpl => (
              <button key={tpl.id} onClick={() => store.setDrafterPrompt(tpl.promptLabel)}
                className="text-xs px-3 py-1.5 bg-primary-soft text-[var(--color-accent)] border border-primary/20 rounded-full hover:bg-accent-soft transition-colors font-medium">
                {tpl.promptLabel}
              </button>
            ))}
          </div>
          <button
            onClick={handleDraft}
            disabled={!store.drafterPrompt.trim() || store.drafting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {store.drafting ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> {t('cabinet.drafting')}<span className="animate-pulse">...</span></>
            ) : (
              <><Sparkles className="h-4 w-4" /> {t('cabinet.draft')}</>
            )}
          </button>
        </div>

        {/* Draft area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!store.currentDraft && !editableText && !store.drafting && (
            <div className="h-full flex items-center justify-center text-center">
              <div className="text-[var(--color-foreground-lighter)]">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('cabinet.emptyDraft')}</p>
                <p className="text-xs mt-1">{t('cabinet.emptyDraftSub')}</p>
              </div>
            </div>
          )}
          {(store.drafting) && (
            <div className="flex items-center gap-2 text-[var(--color-foreground-muted)] text-sm">
              <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
              {t('cabinet.draftingNote')}<span className="animate-pulse">...</span>
            </div>
          )}
          {(displayed || editableText) && !store.drafting && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {[
                  { icon: Edit3, label: t('cabinet.makeFormal') },
                  { icon: Languages, label: t('cabinet.translateHindi') },
                  { icon: BarChart3, label: t('cabinet.addData') },
                  { icon: Minimize2, label: t('cabinet.shorten') },
                  { icon: Maximize2, label: t('cabinet.lengthen') },
                ].map(btn => (
                  <button key={btn.label}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)] transition-colors">
                    <btn.icon className="h-3 w-3" /> {btn.label}
                  </button>
                ))}
              </div>
              <textarea
                value={editableText}
                onChange={e => setEditableText(e.target.value)}
                className="w-full border border-[var(--color-border)] rounded-xl p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                style={{ minHeight: '400px' }}
              />
              {isStreaming && <p className="text-xs text-[var(--color-accent)] mt-1 animate-pulse">{t('cabinet.writing')}</p>}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        {editableText && !store.drafting && (
          <div className="p-4 border-t border-[var(--color-border)] flex gap-2 flex-wrap">
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-sm font-medium rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors">
              <FileText className="h-4 w-4" /> {t('cabinet.saveDraft')}
            </button>
            {store.notes[0] && store.notes[0].status === 'draft' && (
              <button onClick={() => handleSign(store.notes[0].id)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary-light transition-colors">
                <Lock className="h-4 w-4" /> {t('cabinet.signLock')}
              </button>
            )}
            {store.notes[0] && store.notes[0].status === 'signed' && (
              <button onClick={() => setSendModal(store.notes[0])}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
                <Send className="h-4 w-4" /> {t('cabinet.sendToMinister')}
              </button>
            )}
            <button onClick={store.discardDraft}
              className="flex items-center gap-2 px-4 py-2 border border-rose-300 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors ml-auto">
              {t('cabinet.discard')}
            </button>
          </div>
        )}
      </div>

      {/* Right: Live data sidebar */}
      <div className="col-span-1 overflow-y-auto p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide">{t('cabinet.liveData')}</p>
        {[
          { label: t('cabinet.ldSickle'), value: '3.1L', sub: t('cabinet.ldSickleSub') },
          { label: t('cabinet.ldTribal'), value: '21', sub: t('cabinet.ldTribalSub') },
          { label: t('cabinet.ldHydroxyurea'), value: '980', sub: t('cabinet.ldHydroxyureaSub') },
          { label: t('cabinet.ldDengue'), value: '72', sub: t('cabinet.ldDengueSub') },
          { label: t('cabinet.ldPmjay'), value: '₹4.2 Cr', sub: t('cabinet.ldPmjaySub') },
          { label: t('cabinet.ldAlerts'), value: '8', sub: t('cabinet.ldAlertsSub') },
        ].map(item => (
          <div key={item.label} className="bg-[var(--color-surface-raised)] rounded-xl p-3">
            <p className="text-xs text-[var(--color-foreground-muted)]">{item.label}</p>
            <p className="text-lg font-bold text-[var(--color-foreground)]">{item.value}</p>
            <p className="text-[10px] text-[var(--color-foreground-lighter)]">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Send to Minister modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSendModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--color-foreground)] mb-2">{t('cabinet.sendToMinister')}</h3>
            <p className="text-xs text-[var(--color-foreground-muted)] mb-4">{t('cabinet.chooseChannel')}</p>
            {sentChannel ? (
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
                <CheckCircle className="h-5 w-5" /> {t('cabinet.sentVia', { channel: sentChannel })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {['WhatsApp', 'Email', 'Print', 'In-system'].map(ch => (
                  <button key={ch} onClick={() => handleSendToMinister(sendModal, ch)}
                    className="px-4 py-3 bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
                    {ch}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Assembly Q&A tab ──────────────────────────────────────────────────────
function AssemblyTab() {
  const t = useTranslations('secretary')
  const store = useSecretaryAssemblyStore()
  const [selected, setSelected] = useState<AssemblyQuestion | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState('')

  async function handleDraftAnswer(q: AssemblyQuestion) {
    setSelected(q)
    setDrafting(true)
    const text = await store.draftAnswer(q.id)
    setDrafting(false)
    setDraft(text)
  }

  async function handleLodge(q: AssemblyQuestion) {
    await store.saveDraftAnswer(q.id, draft)
    await store.lodgeAnswer(q.id)
    setSelected(null)
    setDraft('')
  }

  const starred = store.questions.filter(q => q.isStarred)
  const unstarred = store.questions.filter(q => !q.isStarred)

  return (
    <div className="grid grid-cols-2 gap-0 h-[calc(100vh-220px)]">
      {/* Left: Questions list */}
      <div className="border-r border-[var(--color-border)] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase">
            {t('cabinet.assemblySession', { starred: starred.length, unstarred: unstarred.length })}
          </p>
          <p className="text-[10px] text-[var(--color-foreground-lighter)] mt-0.5">{t('cabinet.assemblyDue')}</p>
        </div>
        {[...starred, ...unstarred].map(q => (
          <div key={q.id}
            className={`px-4 py-3 border-b border-[var(--color-border)] cursor-pointer transition-colors hover:bg-[var(--color-surface-raised)] ${selected?.id === q.id ? 'bg-primary-soft border-l-2 border-l-[var(--color-primary)]' : ''}`}
            onClick={() => setSelected(q)}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[var(--color-foreground-muted)]">{q.questionNumber}</span>
              {q.isStarred && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded-full font-bold">{t('cabinet.starred')}</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                q.status === 'lodged' ? 'bg-emerald-100 text-emerald-700' : q.status === 'drafted' ? 'bg-surface-sunken text-accent' : 'bg-amber-100 text-amber-700'
              }`}>{q.status}</span>
            </div>
            <p className="text-xs font-medium text-[var(--color-foreground)] line-clamp-2">{q.mlaName} · {q.constituency}</p>
            <p className="text-[10px] text-[var(--color-foreground-muted)] mt-0.5 line-clamp-2">{q.questionTextHi}</p>
          </div>
        ))}
      </div>

      {/* Right: Drafter */}
      <div className="flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-center text-[var(--color-foreground-lighter)]">
            <div>
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('cabinet.selectQuestion')}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
              <p className="text-xs font-bold text-[var(--color-foreground-muted)]">{selected.questionNumber}</p>
              <p className="text-sm font-semibold text-[var(--color-foreground)] mt-0.5">{selected.mlaName} · {selected.constituency}</p>
              <p className="text-xs text-[var(--color-foreground-muted)] mt-2">{selected.questionTextEn}</p>
              <p className="text-xs text-[var(--color-foreground-lighter)] mt-1 font-[Noto_Sans_Devanagari]">{selected.questionTextHi}</p>
              <button onClick={() => handleDraftAnswer(selected)} disabled={drafting}
                className="mt-3 flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-60">
                {drafting ? <><RefreshCw className="h-3 w-3 animate-spin" /> {t('cabinet.draftingAnswer')}</> : <><Sparkles className="h-3 w-3" /> {t('cabinet.draftAnswer')}</>}
              </button>
            </div>
            {draft && (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    className="w-full border border-[var(--color-border)] rounded-xl p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none h-64"
                  />
                </div>
                <div className="p-4 border-t border-[var(--color-border)] flex gap-2">
                  <button onClick={() => handleLodge(selected)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90">
                    <FileCheck className="h-4 w-4" /> {t('cabinet.signLodge')}
                  </button>
                  <button className="px-4 py-2 border border-[var(--color-border)] text-sm rounded-lg hover:bg-[var(--color-surface-raised)]">
                    {t('cabinet.forwardToMinister')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Policy & MoU placeholders ─────────────────────────────────────────────
function PolicyTab() {
  const t = useTranslations('secretary')
  const policies = [
    { title: t('cabinet.polMandatoryAbha'), status: t('cabinet.polMandatoryAbhaStatus'), version: 'v3', date: '2024-06-15' },
    { title: t('cabinet.polStg'), status: t('cabinet.polStgStatus'), version: 'v2', date: '2024-06-10' },
    { title: t('cabinet.polTribalIncentive'), status: t('cabinet.polTribalIncentiveStatus'), version: 'v1', date: '2024-06-08' },
    { title: t('cabinet.polFreeDrug'), status: t('cabinet.polFreeDrugStatus'), version: 'v4', date: '2024-05-28' },
  ]
  return (
    <div className="p-4 space-y-3">
      {policies.map(p => (
        <div key={p.title} className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div>
            <p className="text-sm font-medium text-[var(--color-foreground)]">{p.title}</p>
            <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{p.version} · {p.date}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-foreground-muted)]">{p.status}</span>
            <button className="px-3 py-1.5 text-xs bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg hover:bg-white transition-colors">{t('cabinet.edit')}</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function MousTab() {
  const t = useTranslations('secretary')
  const mous = [
    { partner: 'TCS', purpose: t('cabinet.mouTcsPurpose'), signed: '2024-03-01', expires: '2026-02-28', status: t('cabinet.mouActive') },
    { partner: 'NHSRC', purpose: t('cabinet.mouNhsrcPurpose'), signed: '2023-09-15', expires: '2025-09-14', status: t('cabinet.mouActive') },
    { partner: 'AIIMS Bhopal', purpose: t('cabinet.mouAiimsPurpose'), signed: '2024-01-20', expires: '2026-01-19', status: t('cabinet.mouActive') },
    { partner: 'ICMR', purpose: t('cabinet.mouIcmrPurpose'), signed: '2024-05-01', expires: '2027-04-30', status: t('cabinet.mouActive') },
  ]
  return (
    <div className="p-4 space-y-3">
      {mous.map(m => (
        <div key={m.partner} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--color-foreground)]">{m.partner}</p>
              <p className="text-xs text-[var(--color-foreground-muted)]">{m.purpose}</p>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{m.status}</span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[var(--color-foreground-muted)]">
            <span>{t('cabinet.mouSigned', { date: m.signed })}</span>
            <span>{t('cabinet.mouExpires', { date: m.expires })}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
type TabId = 'cabinet' | 'assembly' | 'policy' | 'mous'

export default function CabinetPage() {
  const t = useTranslations('secretary')
  const [tab, setTab] = useState<TabId>('cabinet')

  const tabs: { id: TabId; labelKey: string }[] = [
    { id: 'cabinet',  labelKey: 'cabinet.tabCabinet' },
    { id: 'assembly', labelKey: 'cabinet.tabAssembly' },
    { id: 'policy',   labelKey: 'cabinet.tabPolicy' },
    { id: 'mous',     labelKey: 'cabinet.tabMous' },
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] max-w-screen-2xl">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-[var(--color-border)] flex-shrink-0">
        <h1 className="text-xl font-bold text-[var(--color-foreground)]">{t('cabinet.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('cabinet.subtitle')}</p>
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mt-3 w-fit">
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
                tab === tb.id ? 'bg-white text-[var(--color-accent)] font-semibold shadow' : 'font-medium text-slate-500 hover:text-slate-700'
              }`}>
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'cabinet'  && <CabinetNotesTab />}
        {tab === 'assembly' && <AssemblyTab />}
        {tab === 'policy'   && <PolicyTab />}
        {tab === 'mous'     && <MousTab />}
      </div>
    </div>
  )
}
