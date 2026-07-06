'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, FileText, TrendingUp, MessageSquare, Users, RefreshCw, ArrowRight } from 'lucide-react'

const ASSISTANTS = [
  { id: 'brief', titleKey: 'aiAssistants.briefTitle', hiKey: 'aiAssistants.briefHi', icon: FileText, color: 'teal', descKey: 'aiAssistants.briefDesc', promptKeys: ['aiAssistants.briefP1', 'aiAssistants.briefP2', 'aiAssistants.briefP3'] },
  { id: 'scenario', titleKey: 'aiAssistants.scenarioTitle', hiKey: 'aiAssistants.scenarioHi', icon: TrendingUp, color: 'blue', descKey: 'aiAssistants.scenarioDesc', promptKeys: ['aiAssistants.scenarioP1', 'aiAssistants.scenarioP2', 'aiAssistants.scenarioP3'] },
  { id: 'policy', titleKey: 'aiAssistants.policyTitle', hiKey: 'aiAssistants.policyHi', icon: Sparkles, color: 'purple', descKey: 'aiAssistants.policyDesc', promptKeys: ['aiAssistants.policyP1', 'aiAssistants.policyP2', 'aiAssistants.policyP3'] },
  { id: 'press', titleKey: 'aiAssistants.pressTitle', hiKey: 'aiAssistants.pressHi', icon: MessageSquare, color: 'orange', descKey: 'aiAssistants.pressDesc', promptKeys: ['aiAssistants.pressP1', 'aiAssistants.pressP2', 'aiAssistants.pressP3'] },
  { id: 'assembly', titleKey: 'aiAssistants.assemblyTitle', hiKey: 'aiAssistants.assemblyHi', icon: Users, color: 'rose', descKey: 'aiAssistants.assemblyDesc', promptKeys: ['aiAssistants.assemblyP1', 'aiAssistants.assemblyP2', 'aiAssistants.assemblyP3'] },
]

const COLOR_STYLES = {
  teal: { bg: 'bg-primary-soft', border: 'border-primary/20', icon: 'text-[var(--color-accent)]', btn: 'bg-[var(--color-primary)]' },
  blue: { bg: 'bg-surface-sunken', border: 'border-border', icon: 'text-accent', btn: 'bg-secondary' },
  purple: { bg: 'bg-primary-soft', border: 'border-primary/20', icon: 'text-accent', btn: 'bg-primary' },
  orange: { bg: 'bg-primary-soft', border: 'border-primary/20', icon: 'text-accent', btn: 'bg-primary' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600', btn: 'bg-rose-600' },
}

export default function AiAssistantsPage() {
  const t = useTranslations('secretary')
  const [active, setActive] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGenerate(assistantId: string, prompt: string) {
    setActive(assistantId)
    setInput(prompt)
    setOutput('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setLoading(false)
    const asst = ASSISTANTS.find(a => a.id === assistantId)
    setOutput(t('aiAssistants.demoResponse', { prompt, assistant: asst ? t(asst.titleKey) : '' }))
  }

  const activeAsst = ASSISTANTS.find(a => a.id === active)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('aiAssistants.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('aiAssistants.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          {ASSISTANTS.map(a => {
            const cs = COLOR_STYLES[a.color as keyof typeof COLOR_STYLES]
            const Icon = a.icon
            return (
              <div key={a.id} className={`bg-white border rounded-2xl p-5 transition-all hover:shadow-md ${active === a.id ? `${cs.border} shadow-md` : 'border-[var(--color-border)]'}`}
                style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${cs.bg} border ${cs.border} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${cs.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--color-foreground)]">{t(a.titleKey)}</p>
                    <p className="text-[10px] text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{t(a.hiKey)}</p>
                    <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{t(a.descKey)}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {a.promptKeys.map(pk => {
                        const p = t(pk)
                        return (
                        <button key={pk} onClick={() => handleGenerate(a.id, p)}
                          className={`text-[10px] px-2.5 py-1.5 border rounded-full transition-colors ${cs.border} ${cs.bg} ${cs.icon} hover:opacity-80 font-medium`}>
                          {p.length > 35 ? p.slice(0, 35) + '…' : p}
                        </button>
                      )})}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Output panel */}
        <div className="sticky top-4">
          {!active && !loading && (
            <div className="h-full flex items-center justify-center text-center text-[var(--color-foreground-lighter)] bg-[var(--color-surface-raised)] rounded-2xl min-h-64 border border-[var(--color-border)] p-8">
              <div>
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('aiAssistants.emptyState')}</p>
              </div>
            </div>
          )}
          {loading && (
            <div className="h-full flex items-center justify-center bg-[var(--color-surface-raised)] rounded-2xl min-h-64 border border-[var(--color-border)]">
              <div className="flex items-center gap-3 text-[var(--color-accent)]">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <p className="text-sm font-medium">{t('aiAssistants.generating', { assistant: activeAsst ? t(activeAsst.titleKey) : '' })}</p>
              </div>
            </div>
          )}
          {output && !loading && activeAsst && (
            <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center gap-2 bg-primary-soft">
                <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                <span className="text-sm font-semibold text-[var(--color-foreground)]">{t(activeAsst.titleKey)}</span>
              </div>
              <div className="p-5">
                <p className="text-xs text-[var(--color-foreground-muted)] mb-2">{t('aiAssistants.promptLabel', { prompt: input })}</p>
                <pre className="text-sm text-[var(--color-foreground)] leading-relaxed whitespace-pre-wrap font-sans">{output}</pre>
                <div className="flex gap-2 mt-4">
                  <button className="px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg">{t('aiAssistants.useDraft')}</button>
                  <button onClick={() => handleGenerate(activeAsst.id, input)} className="flex items-center gap-1.5 px-4 py-2 border border-[var(--color-border)] text-xs rounded-lg">
                    <RefreshCw className="h-3 w-3" /> {t('aiAssistants.regenerate')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
