'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, MapPin, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Users, Building2, Activity, Trophy, MessageSquare, ClipboardList,
  Heart, Baby, ShieldCheck, Package, UserCheck, FileText, ChevronRight,
} from 'lucide-react'
import { useSecretaryDistrictsStore } from '@/store/useSecretaryDistrictsStore'
import { mockSecretaryApi } from '@/lib/mocks/secretary/api'
import type { District } from '@/types/secretary'
import { toast } from 'sonner'

function scoreColor(s: number) {
  if (s >= 75) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-500' }
  if (s >= 60) return { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   bar: 'bg-amber-400'   }
  return            { bg: 'bg-red-50',    text: 'text-red-700',     border: 'border-red-200',     bar: 'bg-red-500'     }
}

const COMPONENTS = [
  { key: 'mmr',            labelKey: 'district.compMmr',        icon: Heart,       unitKey: 'district.compMmrUnit',        lowerBetter: true },
  { key: 'imr',            labelKey: 'district.compImr',        icon: Baby,        unitKey: 'district.compImrUnit',        lowerBetter: true },
  { key: 'nqasPct',        labelKey: 'district.compNqas',       icon: ShieldCheck, unitKey: 'district.compNqasUnit',       lowerBetter: false },
  { key: 'stockHealth',    labelKey: 'district.compStock',      icon: Package,     unitKey: 'district.compStockUnit',      lowerBetter: false },
  { key: 'attendance',     labelKey: 'district.compAttendance', icon: UserCheck,   unitKey: 'district.compAttendanceUnit', lowerBetter: false },
  { key: 'schemeCoverage', labelKey: 'district.compScheme',     icon: FileText,    unitKey: 'district.compSchemeUnit',     lowerBetter: false },
] as const

export default function DistrictCockpitPage() {
  const t         = useTranslations('secretary')
  const params    = useParams()
  const router    = useRouter()
  const id        = params.id as string
  const { districts, sendCongratulation, issueShowCause } = useSecretaryDistrictsStore()

  const [district, setDistrict] = useState<District | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showCauseText, setShowCauseText] = useState('')
  const [showCauseOpen, setShowCauseOpen] = useState(false)
  const [actioning, setActioning] = useState(false)

  useEffect(() => {
    // Try store first (already loaded), fall back to API
    const fromStore = districts.find(d => d.id === id)
    if (fromStore) { setDistrict(fromStore); setLoading(false); return }
    mockSecretaryApi.getDistrictDetail(id).then(d => {
      setDistrict(d)
      setLoading(false)
    })
  }, [id, districts])

  const onCongratulate = async () => {
    if (!district) return
    setActioning(true)
    await sendCongratulation(district.id)
    toast.success(t('district.toastCongrat', { name: district.cmoName }))
    setActioning(false)
  }

  const onShowCause = async () => {
    if (!district || !showCauseText.trim()) { toast.error(t('district.toastEnterReason')); return }
    setActioning(true)
    await issueShowCause(district.id, showCauseText.trim())
    toast.success(t('district.toastShowCause', { name: district.name }))
    setShowCauseText('')
    setShowCauseOpen(false)
    setActioning(false)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--color-foreground-muted)]">{t('district.loading')}</p>
        </div>
      </div>
    )
  }

  if (!district) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-base font-bold text-[var(--color-foreground)]">{t('district.notFound')}</p>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-1">{t('district.notFoundDetail', { id })}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1 mx-auto">
          <ArrowLeft className="h-4 w-4" /> {t('district.back')}
        </button>
      </div>
    )
  }

  const sc    = scoreColor(district.score)
  const delta = district.score - district.prevScore
  const rankDelta = district.prevRank - district.rank // positive = improved

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Back + breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-foreground-muted)]">
        <button onClick={() => router.push('/secretary/districts')} className="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" />{t('district.breadcrumb')}
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-[var(--color-foreground)]">{district.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 flex flex-wrap gap-5 items-start" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-[var(--color-foreground)]">{district.name}</h1>
            <p className="text-base text-[var(--color-foreground-muted)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{district.nameHindi}</p>
            {district.isTribal && (
              <span className="text-[10px] font-bold bg-accent-soft text-accent px-2 py-0.5 rounded-full">{t('district.tribal')}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--color-foreground-muted)]">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t('district.population', { count: district.population })}</span>
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{t('district.facilities', { count: district.facilitiesCount })}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t('district.region', { region: district.region })}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">{t('district.cmo')} <span className="font-semibold text-[var(--color-foreground)]">{district.cmoName}</span></p>
        </div>

        {/* Score + rank */}
        <div className="flex gap-4 items-start">
          <div className={`rounded-2xl p-4 text-center min-w-[80px] ${sc.bg} border ${sc.border}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-foreground-muted)] mb-1">{t('district.score')}</p>
            <p className={`text-4xl font-black ${sc.text}`}>{district.score}</p>
            {delta !== 0 && (
              <span className={`text-[11px] flex items-center justify-center gap-0.5 mt-1 font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {t('district.pts', { delta: `${delta > 0 ? '+' : ''}${delta}` })}
              </span>
            )}
          </div>
          <div className="rounded-2xl p-4 text-center min-w-[80px] bg-[var(--color-surface)] border border-[var(--color-border)]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-foreground-muted)] mb-1">{t('district.rank')}</p>
            <p className="text-4xl font-black text-[var(--color-foreground)]">#{district.rank}</p>
            {rankDelta !== 0 && (
              <span className={`text-[11px] flex items-center justify-center gap-0.5 mt-1 font-bold ${rankDelta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {rankDelta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {t('district.ranks', { delta: `${rankDelta > 0 ? '+' : ''}${rankDelta}` })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alerts banner */}
      {district.topAlerts > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm font-semibold text-red-800">
            {district.topAlerts > 1 ? t('district.alertsBanner', { count: district.topAlerts }) : t('district.alertBanner', { count: district.topAlerts })}
          </p>
          <button onClick={() => router.push('/secretary/alerts')} className="ml-auto text-xs font-bold text-red-700 underline cursor-pointer">
            {t('district.viewAlerts')}
          </button>
        </div>
      )}

      {/* Score components */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-bold text-[var(--color-foreground)] flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />{t('district.performanceComponents')}
          </h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {COMPONENTS.map(({ key, labelKey, icon: Icon, unitKey, lowerBetter }) => {
            const comp  = district.components[key]
            const color = scoreColor(comp.score)
            return (
              <div key={key} className="px-5 py-3 flex items-center gap-4">
                <div className={`p-2 rounded-lg ${color.bg}`}>
                  <Icon className={`h-4 w-4 ${color.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-[var(--color-foreground)]">{t(labelKey)}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-foreground-muted)]">
                        {comp.value} {t(unitKey)}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                        {comp.score}/100
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color.bar} transition-all`} style={{ width: `${comp.score}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 className="text-sm font-bold text-[var(--color-foreground)] mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[var(--color-accent)]" />{t('district.secretaryActions')}
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onCongratulate}
            disabled={actioning || district.score < 75}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            {t('district.sendCongrat')}
          </button>
          <button
            onClick={() => setShowCauseOpen(v => !v)}
            disabled={actioning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <ClipboardList className="h-4 w-4" />
            {t('district.issueShowCause')}
          </button>
          <button
            onClick={() => router.push('/secretary/alerts')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-surface)] hover:bg-slate-100 text-[var(--color-foreground)] border border-[var(--color-border)] cursor-pointer transition-colors"
          >
            <AlertTriangle className="h-4 w-4" />
            {t('district.viewDistrictAlerts')}
          </button>
          <button
            onClick={() => router.push('/secretary/ranking')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--color-surface)] hover:bg-slate-100 text-[var(--color-foreground)] border border-[var(--color-border)] cursor-pointer transition-colors"
          >
            <Trophy className="h-4 w-4" />
            {t('district.stateRanking')}
          </button>
        </div>

        {/* Show-cause inline form */}
        {showCauseOpen && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <p className="text-xs font-bold text-red-800 uppercase tracking-wide">{t('district.showCauseTitle', { name: district.name })}</p>
            <textarea
              value={showCauseText}
              onChange={e => setShowCauseText(e.target.value)}
              rows={3}
              placeholder={t('district.showCausePlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm bg-white text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={onShowCause}
                disabled={actioning || !showCauseText.trim()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer transition-colors"
              >
                {t('district.issueNotice')}
              </button>
              <button
                onClick={() => { setShowCauseOpen(false); setShowCauseText('') }}
                className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-100 cursor-pointer transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* No alerts green state */}
      {district.topAlerts === 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">{t('district.noAlerts')}</p>
        </div>
      )}
    </div>
  )
}
