'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle, XCircle, FileText, ChevronRight, RefreshCw } from 'lucide-react'
import { useSecretaryApprovalsStore } from '@/store/useSecretaryApprovalsStore'
import type { StateApproval, StateApprovalType } from '@/types/secretary'

const TYPE_STYLES: Record<StateApprovalType, { labelKey: string; badge: string }> = {
  tender:            { labelKey: 'approvals.typeTender',         badge: 'bg-accent-soft text-accent' },
  mou:               { labelKey: 'approvals.typeMou',            badge: 'bg-surface-sunken text-accent' },
  'cross-transfer':  { labelKey: 'approvals.typeCrossTransfer',  badge: 'bg-accent-soft text-accent' },
  'scheme-launch':   { labelKey: 'approvals.typeSchemeLaunch',   badge: 'bg-accent-soft text-accent' },
  'policy-circular': { labelKey: 'approvals.typePolicyCircular', badge: 'bg-accent-soft text-accent' },
}

const ALL_TYPES: StateApprovalType[] = ['tender', 'mou', 'cross-transfer', 'scheme-launch', 'policy-circular']

function ApprovalCard({ approval }: { approval: StateApproval }) {
  const t = useTranslations('secretary')
  const { approve, reject } = useSecretaryApprovalsStore()
  const [expanded, setExpanded] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const ts = TYPE_STYLES[approval.type]

  async function handleApprove() {
    setActing(true)
    await approve(approval.id)
    setActing(false)
  }

  async function handleReject() {
    if (!note.trim()) return
    setActing(true)
    await reject(approval.id, note)
    setActing(false)
    setRejecting(false)
  }

  const isActioned = approval.status !== 'pending'

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ts.badge}`}>{t(ts.labelKey)}</span>
              {approval.amount ? (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  ₹{(approval.amount / 1e7).toFixed(1)} Cr
                </span>
              ) : null}
              <span className="text-[10px] text-[var(--color-foreground-lighter)]">{t('approvals.pendingHours', { hours: approval.ageHours })}</span>
            </div>
            <p className="text-sm font-bold text-[var(--color-foreground)]">{approval.title}</p>
            <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{approval.subtitle}</p>
            <p className="text-xs text-[var(--color-foreground-lighter)] mt-0.5">{t('approvals.raisedBy', { name: approval.raisedBy })}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-[var(--color-surface-raised)] rounded-lg flex-shrink-0 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 text-[var(--color-foreground-muted)] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
            <div className="bg-[var(--color-surface-raised)] rounded-xl p-3">
              <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-1">{t('approvals.justification')}</p>
              <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{approval.justification}</p>
            </div>
            {approval.documents.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-2">{t('approvals.supportingDocs')}</p>
                <div className="space-y-1.5">
                  {approval.documents.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline cursor-pointer">
                      <FileText className="h-3 w-3 flex-shrink-0" />{d.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action area */}
        {isActioned ? (
          <div className={`mt-4 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${
            approval.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {approval.status === 'approved' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {approval.status === 'approved' ? t('approvals.approved') : t('approvals.rejected')}
            {approval.actionNote && <span className="text-xs opacity-70 ml-1">— {approval.actionNote}</span>}
          </div>
        ) : (
          <div className="mt-4">
            {!rejecting ? (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {acting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                  {t('common.approve')}
                </button>
                <button
                  onClick={() => setRejecting(true)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-rose-300 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" /> {t('common.reject')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={t('common.rejectionReason')}
                  className="w-full border border-rose-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={!note.trim() || acting}
                    className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                  >
                    {t('common.confirmRejection')}
                  </button>
                  <button
                    onClick={() => { setRejecting(false); setNote('') }}
                    className="px-4 py-2 border border-[var(--color-border)] text-sm rounded-lg hover:bg-[var(--color-surface-raised)]"
                  >
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

export default function SecretaryApprovalsPage() {
  const t = useTranslations('secretary')
  const { approvals } = useSecretaryApprovalsStore()
  const [typeFilter, setTypeFilter] = useState<StateApprovalType | 'all'>('all')

  const filtered = typeFilter === 'all' ? approvals : approvals.filter(a => a.type === typeFilter)
  const pending = filtered.filter(a => a.status === 'pending').length

  function countFor(t: StateApprovalType | 'all') {
    return t === 'all' ? approvals.length : approvals.filter(a => a.type === t).length
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('approvals.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">
          {typeFilter !== 'all'
            ? t('approvals.subtitleFiltered', { pending, type: t(TYPE_STYLES[typeFilter].labelKey), total: approvals.filter(a => a.status === 'pending').length })
            : t('approvals.subtitle', { pending, total: approvals.filter(a => a.status === 'pending').length })}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {/* All tab */}
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            typeFilter === 'all'
              ? 'bg-white text-[var(--color-accent)] shadow'
              : 'text-slate-500 hover:text-slate-700 font-medium'
          }`}
        >
          {t('approvals.all', { count: countFor('all') })}
        </button>

        {/* Per-type tabs */}
        {ALL_TYPES.map(ty => {
          const count = countFor(ty)
          if (count === 0) return null
          return (
            <button
              key={ty}
              onClick={() => setTypeFilter(ty)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                typeFilter === ty
                  ? 'bg-white text-[var(--color-accent)] shadow'
                  : 'text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              {t('approvals.tab', { label: t(TYPE_STYLES[ty].labelKey), count })}
            </button>
          )
        })}
      </div>

      {/* Items */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-foreground-muted)]">
            <p className="text-sm">{typeFilter !== 'all' ? t('approvals.empty', { type: t(TYPE_STYLES[typeFilter].labelKey) }) : t('approvals.emptyGeneric')}</p>
          </div>
        ) : (
          filtered.map(a => <ApprovalCard key={a.id} approval={a} />)
        )}
      </div>
    </div>
  )
}
