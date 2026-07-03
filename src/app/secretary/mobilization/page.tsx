'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Truck, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  MapPin, Zap, Package, AlertTriangle, ArrowRight, RefreshCw, History,
} from 'lucide-react'
import { useSecretaryMobilizationStore } from '@/store/useSecretaryMobilizationStore'
import type { MobilizationRequest } from '@/types/secretary'

const RESOURCE_ICONS: Record<MobilizationRequest['resourceType'], string> = {
  oxygen: '🫁', blood: '🩸', ventilator: '💨', 'icu-bed': '🏥',
  specialist: '👨‍⚕️', drug: '💊', ambulance: '🚑',
}

const SEVERITY_COLORS = {
  critical: { border: 'border-l-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
  warning:  { border: 'border-l-amber-500', bg: 'bg-amber-50/30', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  info:     { border: 'border-l-slate-400',  bg: 'bg-surface-sunken',  text: 'text-accent',  badge: 'bg-surface-sunken text-accent' },
}

function MobCard({ req }: { req: MobilizationRequest }) {
  const t = useTranslations('secretary')
  const { approve, reject } = useSecretaryMobilizationStore()
  const [expanded, setExpanded] = useState(false)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  const col = SEVERITY_COLORS[req.severity]

  async function handleApprove() {
    setApproving(true)
    await approve(req.id)
    setApproving(false)
    setDone('approved')
  }
  async function handleReject() {
    if (!rejectReason.trim()) return
    setApproving(true)
    await reject(req.id, rejectReason)
    setApproving(false)
    setDone('rejected')
  }

  return (
    <div className={`bg-white border border-[var(--color-border)] border-l-4 ${col.border} rounded-xl overflow-hidden`} style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{RESOURCE_ICONS[req.resourceType]}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>{req.severity.toUpperCase()}</span>
                <span className="text-sm font-bold text-[var(--color-foreground)]">{req.fromDistrict}</span>
                <ArrowRight className="h-3 w-3 text-[var(--color-foreground-muted)]" />
                <span className="text-sm font-medium text-[var(--color-foreground)]">{req.resourceDetail}</span>
              </div>
              <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{req.quantity}</p>
              {req.fromFacility && <p className="text-xs text-[var(--color-foreground-lighter)]">{req.fromFacility}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-[var(--color-foreground-muted)] flex items-center gap-1">
              <Clock className="h-3 w-3" /> {t('mobilization.hoursNeeded', { hours: req.urgencyHours })}
            </span>
            <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-[var(--color-surface-raised)] rounded">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Reason */}
        <p className="text-sm text-[var(--color-foreground)] mt-3 bg-[var(--color-surface-raised)] rounded-lg px-3 py-2">{req.reason}</p>

        {/* AI suggestion */}
        <div className="mt-3 bg-primary-soft border border-primary/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-[var(--color-accent)]" />
            <span className="text-xs font-bold text-[var(--color-accent)]">{t('mobilization.aiSuggestion')}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{req.aiSuggestion.source}</p>
          <p className="text-xs text-[var(--color-foreground-muted)]">
            {t('mobilization.distanceEta', { km: req.aiSuggestion.distanceKm, h: Math.floor(req.aiSuggestion.etaMinutes / 60), m: req.aiSuggestion.etaMinutes % 60 })}
          </p>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{req.aiSuggestion.rationale}</p>
        </div>

        {expanded && req.alternatives.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">{t('mobilization.altSources')}</p>
            {req.alternatives.map((alt, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-[var(--color-foreground)] bg-[var(--color-surface-raised)] rounded-lg px-3 py-2">
                <span>{alt.source}</span>
                <span className="text-[var(--color-foreground-muted)]">{t('mobilization.altEta', { h: Math.floor(alt.etaMinutes / 60), m: alt.etaMinutes % 60, note: alt.note })}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        {done === 'approved' && (
          <div className="mt-3 flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 text-sm font-medium">
            <CheckCircle className="h-4 w-4" /> {t('mobilization.approvedDispatched', { source: req.aiSuggestion.source })}
          </div>
        )}
        {done === 'rejected' && (
          <div className="mt-3 flex items-center gap-2 text-rose-700 bg-rose-50 rounded-lg px-3 py-2 text-sm font-medium">
            <XCircle className="h-4 w-4" /> {t('mobilization.requestRejected')}
          </div>
        )}
        {!done && req.status === 'pending' && (
          <div className="mt-3 space-y-2">
            {!rejecting ? (
              <div className="flex gap-2">
                <button onClick={handleApprove} disabled={approving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 transition-opacity">
                  {approving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {t('mobilization.approveAsSuggested')}
                </button>
                <button onClick={() => setExpanded(true)}
                  className="px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-foreground)] text-sm font-medium rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors">
                  {t('mobilization.chooseAlternative')}
                </button>
                <button onClick={() => setRejecting(true)}
                  className="px-4 py-2.5 border border-rose-300 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors">
                  {t('common.reject')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder={t('mobilization.rejectReasonPlaceholder')}
                  className="w-full border border-rose-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
                <div className="flex gap-2">
                  <button onClick={handleReject} disabled={!rejectReason.trim()}
                    className="flex-1 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50">
                    {t('common.confirmRejection')}
                  </button>
                  <button onClick={() => setRejecting(false)}
                    className="px-4 py-2 border border-[var(--color-border)] text-sm rounded-lg hover:bg-[var(--color-surface-raised)]">
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InTransitCard({ req }: { req: MobilizationRequest }) {
  const t = useTranslations('secretary')
  const eta = req.etaMinutes ?? 0
  const pct = req.aiSuggestion ? Math.max(0, Math.min(100, 100 - (eta / req.aiSuggestion.etaMinutes) * 100)) : 50
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-[var(--color-foreground)]">{req.fromDistrict} — {req.resourceDetail}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${eta === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-sunken text-accent'}`}>
          {eta === 0 ? t('mobilization.delivered') : t('mobilization.eta', { h: Math.floor(eta / 60), m: Math.round(eta % 60) })}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className="h-2 rounded-full bg-secondary transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{t('mobilization.fromSource', { quantity: req.quantity, source: req.aiSuggestion?.source ?? '' })}</p>
    </div>
  )
}

export default function MobilizationPage() {
  const t = useTranslations('secretary')
  const { requests } = useSecretaryMobilizationStore()
  const [tab, setTab] = useState<'pending' | 'transit' | 'history'>('pending')

  const pending   = requests.filter(r => r.status === 'pending')
  const inTransit = requests.filter(r => r.status === 'in-transit')
  const history   = requests.filter(r => r.status === 'delivered' || r.status === 'rejected')

  const kpis = [
    { label: t('mobilization.kpiOpen'),     labelHi: t('mobilization.kpiOpenHi'),     value: String(pending.length),   variant: 'critical' },
    { label: t('mobilization.kpiApproved'), labelHi: t('mobilization.kpiApprovedHi'), value: String(inTransit.length), variant: 'info'     },
    { label: t('mobilization.kpiResponse'), labelHi: t('mobilization.kpiResponseHi'), value: '18 min',                 variant: 'default'  },
    { label: t('mobilization.kpiVolume'),   labelHi: t('mobilization.kpiVolumeHi'),   value: '₹47L',                   variant: 'default'  },
  ]

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('mobilization.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('mobilization.subtitle')}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4 relative overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
              k.variant === 'critical' ? 'bg-rose-500' : k.variant === 'info' ? 'bg-surface-sunken' : 'bg-[var(--color-primary)]'
            }`} />
            <div className="pl-1">
              <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
              <p className="text-[10px] text-[var(--color-foreground-lighter)]">{k.labelHi}</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)] mt-1">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['pending', t('mobilization.tabPending', { count: pending.length })], ['transit', t('mobilization.tabTransit', { count: inTransit.length })], ['history', t('mobilization.tabHistory', { count: history.length })]] as const).map(([tb, label]) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
              tab === tb ? 'bg-white text-[var(--color-accent)] font-semibold shadow' : 'font-medium text-slate-500 hover:text-slate-700'
            }`}>{label}</button>
        ))}
      </div>

      {tab === 'pending' && (
        <div className="space-y-4">
          {pending.length === 0 && (
            <div className="text-center py-12 text-[var(--color-foreground-muted)]">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t('mobilization.emptyPending')}</p>
            </div>
          )}
          {pending.map(r => <MobCard key={r.id} req={r} />)}
        </div>
      )}

      {tab === 'transit' && (
        <div className="space-y-3">
          {inTransit.length === 0 && (
            <div className="text-center py-12 text-[var(--color-foreground-muted)]">
              <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t('mobilization.emptyTransit')}</p>
            </div>
          )}
          {inTransit.map(r => <InTransitCard key={r.id} req={r} />)}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-raised)]">
              <tr>
                {['mobilization.colFrom', 'mobilization.colResource', 'mobilization.colQuantity', 'mobilization.colStatus', 'mobilization.colCreated', 'mobilization.colResolved'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {history.map(r => (
                <tr key={r.id} className="hover:bg-[var(--color-surface-raised)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{r.fromDistrict}</td>
                  <td className="px-4 py-3 text-[var(--color-foreground-muted)]">{r.resourceDetail}</td>
                  <td className="px-4 py-3 text-[var(--color-foreground-muted)]">{r.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-foreground-muted)]">
                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-foreground-muted)]">
                    {r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
