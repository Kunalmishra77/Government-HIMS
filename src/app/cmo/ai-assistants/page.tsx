"use client"
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles, Bug, Pill, Newspaper } from 'lucide-react'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { DrillCard } from '@/components/shared/DrillCard'
import { cn } from '@/lib/utils'

export default function CmoAiAssistantsPage() {
  const t = useTranslations('cmo')
  const [openDrill, setOpenDrill] = useState<string | null>(null)
  const [pressPrompt, setPressPrompt] = useState('')
  const [pressResponse, setPressResponse] = useState('')
  const [pressLoading, setPressLoading] = useState(false)

  const generatePressBrief = () => {
    setPressLoading(true)
    setPressResponse('')
    setTimeout(() => {
      setPressResponse(t('aiAssistants.pressDefaultResponse'))
      setPressLoading(false)
    }, 2000)
  }

  const ASSISTANTS = [
    {
      id: 'brief',
      icon: <Sparkles size={20} className="text-accent" />,
      title: t('aiAssistants.briefTitle'),
      preview: t('aiAssistants.briefPreview'),
      desc: t('aiAssistants.briefDesc'),
    },
    {
      id: 'outbreak',
      icon: <Bug size={20} className="text-amber-600" />,
      title: t('aiAssistants.outbreakTitle'),
      preview: t('aiAssistants.outbreakPreview'),
      desc: t('aiAssistants.outbreakDesc'),
    },
    {
      id: 'stockout',
      icon: <Pill size={20} className="text-red-600" />,
      title: t('aiAssistants.stockoutTitle'),
      preview: t('aiAssistants.stockoutPreview'),
      desc: t('aiAssistants.stockoutDesc'),
    },
    {
      id: 'press',
      icon: <Newspaper size={20} className="text-slate-600" />,
      title: t('aiAssistants.pressTitle'),
      preview: t('aiAssistants.pressPreview'),
      desc: t('aiAssistants.pressDesc'),
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <CmoPageHeader title={t('aiAssistants.title')} subtitle={t('aiAssistants.subtitle')} />

      <div className="grid grid-cols-2 gap-4">
        {ASSISTANTS.map(a => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-border hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center">{a.icon}</div>
              <div>
                <p className="text-[13px] font-bold text-slate-900">{a.title}</p>
                <p className="text-[11px] text-slate-500">{a.desc}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mb-3 font-mono">{a.preview}</p>
            <button onClick={() => setOpenDrill(a.id)}
              className="w-full text-[12px] font-semibold py-2 rounded-lg border border-border text-accent hover:bg-surface-sunken transition-colors">
              {t('aiAssistants.openAssistant')}
            </button>
          </div>
        ))}
      </div>

      {/* Drills */}
      <DrillCard open={openDrill === 'brief'} onClose={() => setOpenDrill(null)} title={t('aiAssistants.briefTitle')}>
        <div className="space-y-3 text-[13px] text-slate-700 leading-relaxed" style={{ fontFamily: "'Noto Sans Devanagari', system-ui" }}>
          <p>{t('aiAssistants.briefLine1')}</p>
          <p>{t('aiAssistants.briefLine2')}</p>
          <p>{t('aiAssistants.briefLine3')}</p>
        </div>
      </DrillCard>

      <DrillCard open={openDrill === 'outbreak'} onClose={() => setOpenDrill(null)} title={t('aiAssistants.outbreakTitle')}>
        <div className="space-y-3 text-[13px]">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="font-semibold text-amber-900">{t('aiAssistants.outbreakDengueTitle')}</p>
            <p className="text-amber-700 text-[12px] mt-1">{t('aiAssistants.outbreakDengueDetail')}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="font-semibold text-green-900">{t('aiAssistants.outbreakNoRed')}</p>
            <p className="text-green-700 text-[12px] mt-1">{t('aiAssistants.outbreakNoRedDetail')}</p>
          </div>
        </div>
      </DrillCard>

      <DrillCard open={openDrill === 'stockout'} onClose={() => setOpenDrill(null)} title={t('aiAssistants.stockoutForecasterTitle')}>
        <div className="space-y-2 text-[12px]">
          {[
            { drug: 'Oxytocin', facilities: 6, days: 4, risk: 'critical' },
            { drug: 'Paracetamol', facilities: 3, days: 8, risk: 'high' },
            { drug: 'Amoxicillin', facilities: 2, days: 11, risk: 'medium' },
            { drug: 'ORS', facilities: 8, days: 14, risk: 'medium' },
          ].map(s => (
            <div key={s.drug} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5',
              s.risk === 'critical' ? 'bg-red-50 border border-red-200' : s.risk === 'high' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200')}>
              <span className="font-semibold text-slate-900 flex-1">{s.drug}</span>
              <span className="text-slate-500">{t('aiAssistants.facilitiesCount', { count: s.facilities })}</span>
              <span className={cn('font-bold', s.risk === 'critical' ? 'text-red-700' : s.risk === 'high' ? 'text-amber-700' : 'text-slate-600')}>{t('aiAssistants.inDays', { days: s.days })}</span>
            </div>
          ))}
        </div>
      </DrillCard>

      <DrillCard open={openDrill === 'press'} onClose={() => setOpenDrill(null)} title={t('aiAssistants.pressTitle')}>
        <div className="space-y-3">
          <textarea value={pressPrompt} onChange={e => setPressPrompt(e.target.value)}
            placeholder={t('aiAssistants.pressPromptPlaceholder')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25 h-20" />
          <button disabled={!pressPrompt.trim() || pressLoading} onClick={generatePressBrief}
            className="w-full text-[12px] font-semibold py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40">
            {pressLoading ? t('aiAssistants.generating') : t('aiAssistants.generatePressBrief')}
          </button>
          {pressLoading && <div className="h-2 bg-surface-sunken rounded-full overflow-hidden"><div className="h-full bg-secondary animate-pulse w-2/3" /></div>}
          {pressResponse && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-[12px] text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900 mb-1 text-[11px] uppercase tracking-wider text-slate-400">{t('aiAssistants.aiGeneratedStatement')}</p>
              {pressResponse}
            </div>
          )}
        </div>
      </DrillCard>
    </div>
  )
}
