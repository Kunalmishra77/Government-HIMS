'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Sparkles, AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Building2, ArrowRight, Brain, Send, RefreshCw, Clock, MapPin,
  BarChart3, FileText, Users, Activity,
} from 'lucide-react'
import { useSecretaryAlertsStore }    from '@/store/useSecretaryAlertsStore'
import { useSecretaryDistrictsStore } from '@/store/useSecretaryDistrictsStore'
import type { District }              from '@/types/secretary'

// ── Mini MetricTile ───────────────────────────────────────────────────────
function KpiTile({
  label, labelHi, value, hint, delta, deltaDir, variant = 'default', onClick,
}: {
  label: string; labelHi?: string; value: string; hint?: string
  delta?: string; deltaDir?: 'up' | 'down' | 'neutral'
  variant?: 'default' | 'critical' | 'warning' | 'success'; onClick?: () => void
}) {
  const bar = { default: 'bg-[var(--color-primary)]', critical: 'bg-[var(--color-danger)]', warning: 'bg-amber-500', success: 'bg-emerald-500' }[variant]
  const deltaColor = deltaDir === 'up' ? 'text-emerald-600' : deltaDir === 'down' ? 'text-rose-600' : 'text-slate-500'
  return (
    <button
      onClick={onClick}
      className="bg-white border border-[var(--color-border)] rounded-xl p-4 text-left hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer relative overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l-xl`} />
      <div className="pl-1">
        <p className="text-xs text-[var(--color-foreground-muted)] uppercase tracking-wide">{label}</p>
        {labelHi && <p className="text-[10px] text-[var(--color-foreground-lighter)] font-[\'Noto_Sans_Devanagari\']">{labelHi}</p>}
        <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1">{value}</p>
        {hint && <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{hint}</p>}
        {delta && <p className={`text-xs font-medium mt-1 ${deltaColor}`}>{delta}</p>}
      </div>
    </button>
  )
}

// ── District ranking row ──────────────────────────────────────────────────
function RankRow({ district, onClick }: { district: District; onClick: () => void }) {
  const delta = district.score - district.prevScore
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors w-full text-left"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[var(--color-foreground-muted)] w-6 text-right">#{district.rank}</span>
        <div>
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{district.name}</p>
          <p className="text-[11px] text-[var(--color-foreground-lighter)] font-[Noto_Sans_Devanagari]">{district.nameHindi}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-[var(--color-foreground)]">{district.score}</span>
        {delta !== 0 && (
          <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Brief Minister modal ──────────────────────────────────────────────────
function BriefMinisterModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('secretary')
  const [sent, setSent] = useState(false)
  const channels = ['WhatsApp', 'Email', 'Print', 'In-system']
  function send(ch: string) {
    console.log(`[Secretary Demo] Brief sent to Minister via ${ch}`)
    setSent(true)
    setTimeout(onClose, 1500)
  }
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-foreground)]">{t('home.modalBriefTitle')}</h2>
            <p className="text-xs text-[var(--color-foreground-muted)]">{t('home.modalBriefSub')}</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] text-xl font-bold px-2">×</button>
        </div>
        <div className="bg-[var(--color-surface-raised)] rounded-xl p-4 text-sm text-[var(--color-foreground)] leading-relaxed mb-4 space-y-2">
          <p><strong>{t('home.modalBriefState')}</strong> {t('home.modalBriefStateBody')}</p>
          <p><strong>{t('home.modalBriefAlert')}</strong> {t('home.modalBriefAlertBody')}</p>
          <p><strong>{t('home.modalBriefResources')}</strong> {t('home.modalBriefResourcesBody')}</p>
          <p><strong>PM-JAY:</strong> {t('home.modalBriefPmjayBody')}</p>
          <p><strong>{t('home.modalBriefCabinet')}</strong> {t('home.modalBriefCabinetBody')}</p>
          <p><strong>NITI Rank:</strong> {t('home.modalBriefNitiBody')}</p>
        </div>
        {sent ? (
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle className="h-5 w-5" /> {t('home.briefSent')}
          </div>
        ) : (
          <div>
            <p className="text-xs text-[var(--color-foreground-muted)] mb-2">{t('home.sendVia')}</p>
            <div className="flex gap-2 flex-wrap">
              {channels.map(ch => (
                <button key={ch} onClick={() => send(ch)}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
                  {ch}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function SecretaryHomePage() {
  const t        = useTranslations('secretary')
  const router   = useRouter()
  const { alerts } = useSecretaryAlertsStore()
  const { districts } = useSecretaryDistrictsStore()
  const [showBriefModal, setShowBriefModal] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const sorted     = [...districts].sort((a, b) => a.rank - b.rank)
  const top5       = sorted.slice(0, 5)
  const bottom5    = sorted.slice(-5).reverse()
  const unackAlerts = alerts.filter(a => !a.acknowledged).length
  const redDistricts = districts.filter(d => d.score < 50).length

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const strategicItems = [
    { label: t('home.strategicCabinetNote'), labelHi: t('home.strategicCabinetNoteHi'), due: t('home.strategicCabinetNoteDue'), urgent: true, href: '/secretary/cabinet' },
    { label: t('home.strategicAssembly'), labelHi: t('home.strategicAssemblyHi'), due: t('home.strategicAssemblyDue'), urgent: false, href: '/secretary/cabinet' },
    { label: t('home.strategicUc'), labelHi: t('home.strategicUcHi'), due: t('home.strategicUcDue'), urgent: false, href: '/secretary/reports' },
    { label: t('home.strategicTender'), labelHi: t('home.strategicTenderHi'), due: t('home.strategicTenderDue'), urgent: false, href: '/secretary/approvals' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            {t('home.greeting')}
          </h1>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">
            {t('home.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-foreground-muted)]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('home.live', { time: timeStr })}
          </div>
          <button
            onClick={() => setShowBriefModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
          >
            <Brain className="h-4 w-4" />
            {t('home.briefMinister')}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile
          label={t('home.kpiNitiRank')} labelHi={t('home.kpiNitiRankHi')}
          value="17" delta={t('home.kpiNitiDelta')} deltaDir="up"
          onClick={() => router.push('/secretary/niti-abdm')}
        />
        <KpiTile
          label={t('home.kpiRedDistricts')} labelHi={t('home.kpiRedDistrictsHi')}
          value={String(redDistricts)} hint={t('home.kpiRedDistrictsHint')} variant="critical"
          onClick={() => router.push('/secretary/ranking')}
        />
        <KpiTile
          label={t('home.kpiStateAlerts')} labelHi={t('home.kpiStateAlertsHi')}
          value={String(unackAlerts)} hint={t('home.kpiStateAlertsHint')} variant="warning"
          onClick={() => router.push('/secretary/alerts')}
        />
        <KpiTile
          label={t('home.kpiPmjay')} labelHi={t('home.kpiPmjayHi')}
          value="₹4.2 Cr" delta={t('home.kpiPmjayDelta')} deltaDir="up"
          onClick={() => router.push('/secretary/schemes')}
        />
      </div>

      {/* State AI brief */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] bg-gradient-to-r from-primary-soft to-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('home.aiBriefTitle')}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBriefModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90"
            >
              <Send className="h-3 w-3" /> {t('home.sendToMinister')}
            </button>
          </div>
        </div>
        <div className="p-5">
          <p className="text-sm leading-relaxed text-[var(--color-foreground)]">
            {t('home.aiBriefBody')}
          </p>
          <div className="flex gap-2 mt-4 flex-wrap">
            <button onClick={() => router.push('/secretary/cabinet')}
              className="text-xs px-3 py-1.5 bg-primary-soft text-[var(--color-accent)] border border-primary/20 rounded-full font-medium hover:bg-accent-soft transition-colors">
              {t('home.openCabinetDrafter')}
            </button>
            <button onClick={() => router.push('/secretary/cabinet')}
              className="text-xs px-3 py-1.5 bg-primary-soft text-[var(--color-accent)] border border-primary/20 rounded-full font-medium hover:bg-accent-soft transition-colors">
              {t('home.openAssembly')}
            </button>
            <button onClick={() => router.push('/secretary/ranking')}
              className="text-xs px-3 py-1.5 bg-primary-soft text-[var(--color-accent)] border border-primary/20 rounded-full font-medium hover:bg-accent-soft transition-colors">
              {t('home.viewTop5')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* District ranking — embedded top5 + bottom5 */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
            <div>
              <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('home.districtRanking')}</span>
              <span className="text-xs text-[var(--color-foreground-muted)] ml-2">{t('home.districtRankingSub')}</span>
            </div>
            <button onClick={() => router.push('/secretary/ranking')}
              className="text-xs text-[var(--color-accent)] flex items-center gap-1 font-medium hover:underline">
              {t('home.viewFullRanking')} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
            <div className="p-3">
              <p className="text-xs font-semibold text-emerald-700 px-3 pb-1">{t('home.bestPerformers')}</p>
              {top5.map(d => <RankRow key={d.id} district={d} onClick={() => router.push('/secretary/ranking')} />)}
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-rose-700 px-3 pb-1">{t('home.interventionNeeded')}</p>
              {bottom5.map(d => <RankRow key={d.id} district={d} onClick={() => router.push('/secretary/ranking')} />)}
            </div>
          </div>
        </div>

        {/* Critical alerts */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('home.criticalAlerts')}</span>
            </div>
            <button onClick={() => router.push('/secretary/alerts')}
              className="text-xs text-[var(--color-accent)] flex items-center gap-1 font-medium hover:underline">
              {t('home.viewAll')} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {alerts.filter(a => !a.acknowledged).slice(0, 4).map(alert => (
              <div key={alert.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                  alert.severity === 'critical' ? 'bg-rose-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-surface-sunken'
                }`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{alert.title}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)]">{t('alerts.minAgo', { count: Math.round(alert.ageMinutes) })} · {alert.source}</p>
                </div>
              </div>
            ))}
            {alerts.filter(a => !a.acknowledged).length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-[var(--color-foreground-muted)]">{t('home.noPendingAlerts')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* State KPI trends */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />
            {t('home.stateIndicators')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'MMR', value: '163', unit: '/1L births', delta: '↓4', good: true, hi: t('home.mmrLabel') },
              { label: 'Full Immunization', value: '87%', unit: '', delta: '↑2%', good: true, hi: t('home.immunizationLabel') },
              { label: 'ABDM Compliance', value: '74%', unit: '', delta: 'M2 met', good: true, hi: t('home.abdmLabel') },
            ].map(k => (
              <div key={k.label} className="bg-[var(--color-surface-raised)] rounded-xl p-3 text-center">
                <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
                <p className="text-[10px] text-[var(--color-foreground-lighter)]">{k.hi}</p>
                <p className="text-xl font-bold text-[var(--color-foreground)] mt-1">{k.value}<span className="text-xs font-normal ml-0.5">{k.unit}</span></p>
                <p className={`text-xs font-medium mt-0.5 ${k.good ? 'text-emerald-600' : 'text-rose-600'}`}>{k.delta}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strategic items needing sign-off */}
        <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)]">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-[var(--color-foreground)]">{t('home.strategicItems')}</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {strategicItems.map((item, i) => (
              <button key={i} onClick={() => router.push(item.href)}
                className="flex items-center gap-3 px-5 py-3 w-full text-left hover:bg-[var(--color-surface-raised)] transition-colors">
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${item.urgent ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{item.label}</p>
                  <p className="text-[10px] text-[var(--color-foreground-lighter)]">{item.labelHi}</p>
                </div>
                <span className={`text-xs flex-shrink-0 ${item.urgent ? 'text-rose-600 font-semibold' : 'text-[var(--color-foreground-muted)]'}`}>{item.due}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {showBriefModal && <BriefMinisterModal onClose={() => setShowBriefModal(false)} />}
    </div>
  )
}
