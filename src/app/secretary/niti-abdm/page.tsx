'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  TrendingUp, TrendingDown, CheckCircle, Clock, BarChart3,
  AlertTriangle, Target, Award, Sparkles, ArrowRight, X,
} from 'lucide-react'
import { useSecretaryNitiStore }  from '@/store/useSecretaryNitiStore'
import { useSecretaryAbdmStore }  from '@/store/useSecretaryAbdmStore'
import type { NitiIndicator, AbdmMilestone } from '@/types/secretary'

const STATUS_STYLES = {
  achieving:   { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', textKey: 'niti.statusAchieving' },
  'in-progress': { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', textKey: 'niti.statusInProgress' },
  lagging:     { bar: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700',    textKey: 'niti.statusLagging' },
}

const MILESTONE_STYLES = {
  achieved:     { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-500' },
  'in-progress': { icon: Clock,       color: 'text-accent',    bg: 'bg-surface-sunken border-border',       bar: 'bg-secondary' },
  'not-started': { icon: Target,      color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-200',     bar: 'bg-slate-300' },
}

// ── Mini sparkline ────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 60
    const y = 16 - ((v - min) / range) * 14
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox="0 0 60 18" className="w-16 h-5" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Indicator row ─────────────────────────────────────────────────────────
function IndicatorRow({ indicator, onClick }: { indicator: NitiIndicator; onClick: () => void }) {
  const t = useTranslations('secretary')
  const st = STATUS_STYLES[indicator.status]
  const trend = indicator.trend
  const improving = trend[trend.length - 1] > trend[0]
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-raised)] transition-colors w-full text-left border border-transparent hover:border-[var(--color-border)]"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{indicator.name}</p>
        <p className="text-[10px] text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{indicator.nameHindi}</p>
      </div>
      <div className="text-right w-20 flex-shrink-0">
        <p className="text-sm font-bold text-[var(--color-foreground)]">{indicator.currentValue}<span className="text-xs font-normal ml-0.5 text-[var(--color-foreground-muted)]">{indicator.unit.slice(0, 8)}</span></p>
        <p className="text-[10px] text-[var(--color-foreground-lighter)]">{t('niti.best', { value: indicator.bestStateValue, state: indicator.bestState })}</p>
      </div>
      <div className="w-20 flex-shrink-0">
        <Sparkline data={indicator.trend} color={improving ? '#16a34a' : '#dc2626'} />
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.badge}`}>{t(st.textKey)}</span>
    </button>
  )
}

// ── Indicator drill drawer ────────────────────────────────────────────────
function IndicatorDrill({ ind, onClose }: { ind: NitiIndicator; onClose: () => void }) {
  const t = useTranslations('secretary')
  const st = STATUS_STYLES[ind.status]
  const gap = Math.abs(ind.currentValue - ind.bestStateValue)
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-[420px] bg-white h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--color-foreground)]">{ind.name}</h2>
            <p className="text-xs text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>{ind.nameHindi}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-surface-raised)] rounded-lg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('niti.mpCurrent'), value: `${ind.currentValue} ${ind.unit}`, color: 'text-[var(--color-foreground)]' },
              { label: t('niti.bestState'), value: `${ind.bestStateValue} (${ind.bestState})`, color: 'text-emerald-600' },
              { label: t('niti.targetLabel'), value: `${ind.target} ${ind.unit}`, color: 'text-[var(--color-accent)]' },
            ].map(m => (
              <div key={m.label} className="bg-[var(--color-surface-raised)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-foreground-muted)]">{m.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-2">{t('niti.trend8y')}</p>
            <div className="flex items-end gap-1 h-16">
              {ind.trend.map((v, i) => {
                const min = Math.min(...ind.trend)
                const max = Math.max(...ind.trend)
                const pct = ((v - min) / (max - min + 0.1)) * 80 + 20
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-[var(--color-foreground-muted)]">{v}</span>
                    <div className="w-full rounded-t" style={{ height: `${pct}%`, background: 'var(--color-primary)', opacity: 0.6 + (i / ind.trend.length) * 0.4 }} />
                    <span className="text-[8px] text-[var(--color-foreground-lighter)]">{2017 + i}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className={`px-4 py-3 rounded-xl border ${st.badge.replace('text-', 'border-').replace('bg-', 'border-')}`}>
            <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">{t('niti.domainStatus', { domain: ind.domain, status: t(st.textKey) })}</p>
            <p className="text-sm text-[var(--color-foreground)]">
              {t('niti.gapToBest')}<strong>{t('niti.gapValue', { gap: gap.toFixed(1), unit: ind.unit })}</strong>.{' '}
              {ind.status === 'lagging' && t('niti.laggingNote', { name: ind.name })}
              {ind.status === 'in-progress' && t('niti.inProgressNote')}
              {ind.status === 'achieving' && t('niti.achievingNote')}
            </p>
          </div>
          <div className="bg-primary-soft border border-primary/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
              <p className="text-xs font-bold text-[var(--color-accent)]">{t('niti.aiIntervention')}</p>
            </div>
            <p className="text-sm text-[var(--color-foreground)]">
              {t('niti.aiInterventionBody', { name: ind.name.toLowerCase() })}
            </p>
            <button className="mt-2 text-xs text-[var(--color-accent)] font-semibold hover:underline">
              {t('niti.applySuggestion')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── ABDM milestone card ───────────────────────────────────────────────────
function MilestoneCard({ m }: { m: AbdmMilestone }) {
  const t = useTranslations('secretary')
  const st = MILESTONE_STYLES[m.status]
  const Icon = st.icon
  return (
    <div className={`bg-white border ${st.bg} rounded-xl p-4`} style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${st.bg} border flex-shrink-0`}>
          <Icon className={`h-5 w-5 ${st.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-[var(--color-foreground)]">{m.id} — {m.name}</p>
              <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{m.description}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
              m.status === 'achieved' ? 'bg-emerald-100 text-emerald-700' :
              m.status === 'in-progress' ? 'bg-surface-sunken text-accent' : 'bg-slate-100 text-slate-500'
            }`}>{m.status.replace('-', ' ')}</span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-foreground-muted)]">{t('niti.progress')}</span>
              <span className="font-bold text-[var(--color-foreground)]">{m.progressPct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className={`h-2 rounded-full transition-all ${st.bar}`} style={{ width: `${m.progressPct}%` }} />
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[var(--color-foreground-muted)]">
            <span>{t('niti.incentive')} <strong className="text-[var(--color-foreground)]">₹{m.incentiveAmountCr} Cr</strong></span>
            <span>{t('niti.earned')} <strong className={m.earnedCr > 0 ? 'text-emerald-600' : 'text-[var(--color-foreground)]'}>₹{m.earnedCr} Cr</strong></span>
            {m.achievedAt && <span>{t('niti.achieved')} <strong className="text-emerald-600">{m.achievedAt}</strong></span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function NitiAbdmPage() {
  const t = useTranslations('secretary')
  const { indicators } = useSecretaryNitiStore()
  const { milestones } = useSecretaryAbdmStore()
  const [selected, setSelected] = useState<NitiIndicator | null>(null)
  const [domainFilter, setDomainFilter] = useState<1 | 2 | 3 | 0>(0)

  const domainLabels: Record<number, string> = {
    0: t('niti.domainAll'),
    1: t('niti.domain1'),
    2: t('niti.domain2'),
    3: t('niti.domain3'),
  }

  const filtered = domainFilter === 0 ? indicators : indicators.filter(i => i.domain === domainFilter)

  const achieved   = milestones.filter(m => m.status === 'achieved').length
  const totalEarned = milestones.reduce((s, m) => s + m.earnedCr, 0)
  const totalIncentive = milestones.reduce((s, m) => s + m.incentiveAmountCr, 0)

  const aiSuggestions = [
    { indicator: t('niti.aiSuggImmName'), lift: t('niti.aiSuggImmLift'), cost: '₹6.2 Cr', action: t('niti.aiSuggImmAction') },
    { indicator: t('niti.aiSuggVacName'), lift: t('niti.aiSuggVacLift'), cost: '₹28 Cr/yr', action: t('niti.aiSuggVacAction') },
    { indicator: t('niti.aiSuggNqasName'), lift: t('niti.aiSuggNqasLift'), cost: '₹14 Cr', action: t('niti.aiSuggNqasAction') },
  ]

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('niti.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('niti.subtitle')}</p>
      </div>

      {/* NITI rank banner */}
      <div className="bg-gradient-to-r from-primary to-primary text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{t('niti.bannerTitle')}</p>
          <p className="text-[10px] opacity-60 mt-0.5">{t('niti.bannerSub')}</p>
          <div className="flex items-end gap-3 mt-2">
            <span className="text-6xl font-black">17</span>
            <div className="mb-2">
              <span className="text-lg font-semibold opacity-80">{t('niti.of36')}</span>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-bold text-emerald-300">{t('niti.fromLastYear')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <Award className="h-16 w-16 opacity-30" />
          <p className="text-sm opacity-70 mt-1">{t('niti.target2027')}</p>
        </div>
      </div>

      {/* Domain tabs */}
      <div className="flex gap-2 flex-wrap">
        {([0, 1, 2, 3] as const).map(d => (
          <button key={d} onClick={() => setDomainFilter(d)}
            className={`text-sm px-4 py-2 rounded-xl font-medium border transition-colors ${
              domainFilter === d ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-[var(--color-primary)]'
            }`}>{domainLabels[d]}</button>
        ))}
        <div className="ml-auto flex gap-3 text-xs self-center">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('niti.legendAchieving', { count: indicators.filter(i => i.status === 'achieving').length })}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> {t('niti.legendInProgress', { count: indicators.filter(i => i.status === 'in-progress').length })}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> {t('niti.legendLagging', { count: indicators.filter(i => i.status === 'lagging').length })}</span>
        </div>
      </div>

      {/* Indicator grid */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('niti.indicatorsTitle', { count: filtered.length })}</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {filtered.map(ind => <IndicatorRow key={ind.id} indicator={ind} onClick={() => setSelected(ind)} />)}
        </div>
      </div>

      {/* ABDM section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-foreground)]">{t('niti.abdmTitle')}</h2>
            <p className="text-sm text-[var(--color-foreground-muted)]">
              {t('niti.abdmSub', { achieved, earned: totalEarned, total: totalIncentive })}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {milestones.map(m => <MilestoneCard key={m.id} m={m} />)}
        </div>
      </div>

      {/* AI suggestions */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)] bg-primary-soft">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('niti.aiSuggestionsTitle')}</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {aiSuggestions.map((s, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">{s.indicator}</p>
                  <p className="text-sm text-[var(--color-foreground-muted)] mt-1">{s.action}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-emerald-700 font-medium">{t('niti.impact', { lift: s.lift })}</span>
                    <span className="text-[var(--color-foreground-muted)]">{t('niti.cost', { cost: s.cost })}</span>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] border border-primary/20 rounded-lg hover:bg-primary-soft flex-shrink-0">
                  {t('niti.apply')} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && <IndicatorDrill ind={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
