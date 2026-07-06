"use client"
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useCmoApprovalsStore } from '@/store/useCmoApprovalsStore'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile }    from '@/components/shared/MetricTile'
import { DrillCard }     from '@/components/shared/DrillCard'
import { ClipboardCheck } from 'lucide-react'
import type { Approval, ApprovalType } from '@/types/cmo'
import { cn } from '@/lib/utils'
type TabFilter = 'all' | ApprovalType

const TAB_VALUES: TabFilter[] = ['all', 'indent', 'transfer', 'leave', 'pip-reallocation', 'posting']
const TAB_LABEL_KEYS: Record<TabFilter, string> = {
  'all': 'approvals.tabAll',
  'indent': 'approvals.tabIndents',
  'transfer': 'approvals.tabTransfers',
  'leave': 'approvals.tabLeaves',
  'pip-reallocation': 'approvals.tabPip',
  'posting': 'approvals.tabPostings',
}

const typeIcons: Record<ApprovalType, string> = {
  indent:           '📦',
  transfer:         '🔄',
  leave:            '📅',
  'pip-reallocation': '📊',
  posting:          '👤',
}

export default function CmoApprovalsPage() {
  const t             = useTranslations('cmo')
  const approvals     = useCmoApprovalsStore(s => s.approvals)
  const approve       = useCmoApprovalsStore(s => s.approve)
  const reject        = useCmoApprovalsStore(s => s.reject)

  const [tab, setTab]               = useState<TabFilter>('all')
  const [drill, setDrill]           = useState<Approval | null>(null)
  const [rejectId, setRejectId]     = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const pending  = approvals.filter(a => a.status === 'pending')
  const actioned = approvals.filter(a => a.status !== 'pending')

  const filtered = useMemo(() =>
    tab === 'all' ? pending : pending.filter(a => a.type === tab)
  , [pending, tab])

  const tabCount = (v: TabFilter) => v === 'all' ? pending.length : pending.filter(a => a.type === v).length
  const approvedToday = actioned.filter(a => a.status === 'approved').length
  const rejectedToday = actioned.filter(a => a.status === 'rejected').length

  return (
    <div className="max-w-5xl mx-auto space-y-5 cmo-fade-up">
      <CmoPageHeader
        title={t('approvals.title')}
        titleHindi={t('approvals.titleHindi')}
        subtitle={t('approvals.subtitle', { count: pending.length })}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('approvals.pending')}        value={pending.length}   variant="warning" />
        <MetricTile label={t('approvals.approvedToday')}  value={approvedToday}    variant="success" />
        <MetricTile label={t('approvals.rejectedToday')}  value={rejectedToday}    variant="critical" />
        <MetricTile label={t('approvals.avgResponse')}    value={t('approvals.avgResponseValue')} variant="default" />
      </div>

      <div className="flex gap-5">
        {/* Main list */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs */}
          <div className="flex gap-0.5 border-b border-[var(--color-border)] overflow-x-auto">
            {TAB_VALUES.map(tv => (
              <button key={tv} onClick={() => setTab(tv)}
                className={cn(
                  'text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px whitespace-nowrap transition-all duration-150',
                  tab === tv
                    ? 'border-[var(--color-primary)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-foreground-lighter)] hover:text-[var(--color-foreground-muted)]',
                )}>
                {t(TAB_LABEL_KEYS[tv])}
                {tabCount(tv) > 0 && (
                  <span className={cn('ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    tab === tv ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-500')}>
                    {tabCount(tv)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-[var(--color-foreground-lighter)]">
                <ClipboardCheck size={28} className="opacity-30" />
                <p className="text-[13px] font-medium">{t('approvals.noPending')}</p>
              </div>
            )}

            {filtered.map((apv, i) => (
              <div
                key={apv.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden cmo-fade-up"
                style={{ boxShadow: 'var(--shadow-card)', animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-start gap-4 px-5 py-4">
                  {/* Type icon */}
                  <div className="h-9 w-9 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex items-center justify-center text-[16px] flex-shrink-0">
                    {typeIcons[apv.type]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-[var(--color-foreground)] leading-snug"
                       style={{ fontFamily: 'var(--font-heading)' }}>
                      {apv.title}
                    </p>
                    <p className="text-[11.5px] text-[var(--color-foreground-lighter)] mt-0.5">{apv.subtitle} · {t('approvals.ageAgo', { hours: apv.ageHours })}</p>
                    <p className="text-[11.5px] text-[var(--color-foreground-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                      {apv.justification}
                    </p>
                    {apv.amount && (
                      <div className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-[var(--color-foreground)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-full px-2.5 py-0.5">
                        ₹{apv.amount.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => setDrill(apv)}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-[var(--color-border-hover)] hover:bg-slate-50 transition-all w-full text-center">
                      {t('approvals.openDetails')}
                    </button>
                    <button onClick={async () => { await approve(apv.id); toast.success(t('approvals.approvedAudit')) }}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors w-full text-center">
                      {t('approvals.approveHindi')}
                    </button>
                    <button onClick={() => { setRejectId(apv.id); setRejectReason('') }}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors w-full text-center">
                      {t('approvals.rejectHindi')}
                    </button>
                  </div>
                </div>

                {/* Inline reject form */}
                {rejectId === apv.id && (
                  <div className="flex items-center gap-2 px-5 pb-4 pt-0">
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                      placeholder={t('approvals.rejectReasonPlaceholder')}
                      className="flex-1 text-[12px] border border-[var(--color-border)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-[var(--color-foreground-lighter)]" />
                    <button disabled={!rejectReason.trim()}
                      onClick={async () => { await reject(apv.id, rejectReason); setRejectId(null); toast.success(t('approvals.rejectedAudit')) }}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-40 hover:bg-red-700 whitespace-nowrap">
                      {t('approvals.confirm')}
                    </button>
                    <button onClick={() => setRejectId(null)} className="text-[11px] text-[var(--color-foreground-lighter)] hover:text-[var(--color-foreground-muted)]">{t('common.cancel')}</button>
                  </div>
                )}
              </div>
            ))}

            {/* Recent actions */}
            {actioned.length > 0 && (
              <div className="pt-2">
                <p className="text-[10.5px] font-semibold text-[var(--color-foreground-lighter)] uppercase tracking-wider mb-2">{t('approvals.recentActions')}</p>
                <div className="space-y-1.5">
                  {actioned.slice(0, 3).map(apv => (
                    <div key={apv.id} className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl border text-[12px]',
                      apv.status === 'approved' ? 'bg-[var(--color-success-bg)] border-[border-green-200]' : 'bg-[var(--color-danger-bg)] border-[border-red-200]')}>
                      <span className={cn('font-bold', apv.status === 'approved' ? 'text-[#065F46]' : 'text-[#991B1B]')}>
                        {apv.status === 'approved' ? '✓' : '✗'}
                      </span>
                      <span className="text-[var(--color-foreground-muted)] flex-1 truncate">{apv.title}</span>
                      <span className="text-[var(--color-foreground-lighter)] text-[10.5px]">
                        {apv.actionedAt ? new Date(apv.actionedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-52 flex-shrink-0 hidden lg:block space-y-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sticky top-6"
               style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[12px] font-bold text-[var(--color-foreground)] mb-3"
               style={{ fontFamily: 'var(--font-heading)' }}>{t('approvals.todaysActivity')}</p>
            <div className="space-y-2 text-[12.5px]">
              {[[t('approvals.approved'), approvedToday, 'text-emerald-600'], [t('approvals.rejected'), rejectedToday, 'text-red-600']].map(([l, v, c]) => (
                <div key={String(l)} className="flex justify-between items-center">
                  <span className="text-[var(--color-foreground-lighter)]">{l}</span>
                  <span className={cn('font-bold text-[16px]', String(c))} style={{ fontFamily: 'var(--font-heading)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-2 text-[12.5px]">
              <p className="text-[11px] font-bold text-[var(--color-foreground-lighter)] uppercase tracking-wide">{t('approvals.thisWeek')}</p>
              {[[t('approvals.approved'), 47 + approvedToday, 'text-emerald-600'], [t('approvals.rejected'), 6 + rejectedToday, 'text-red-600'], [t('approvals.avgResponse'), t('approvals.avgResponseValue'), 'text-[var(--color-foreground)]']].map(([l, v, c]) => (
                <div key={String(l)} className="flex justify-between">
                  <span className="text-[var(--color-foreground-lighter)]">{l}</span>
                  <span className={cn('font-semibold', String(c))}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drill Card */}
      <DrillCard open={!!drill} onClose={() => setDrill(null)}
        title={drill?.title ?? ''} subtitle={`${drill?.raisedByRole} · ${drill?.amount ? `₹${drill.amount.toLocaleString('en-IN')}` : '—'}`}
        footer={
          <>
            <button onClick={async () => { if (drill) { await approve(drill.id); toast.success(t('approvals.approvedToast')); setDrill(null) } }}
              className="flex-1 text-[12.5px] font-semibold py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
              {t('approvals.approveFullHindi')}
            </button>
            <button onClick={() => { if (drill) { setRejectId(drill.id); setDrill(null) } }}
              className="text-[12.5px] font-semibold px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100">
              {t('approvals.rejectHindi')}
            </button>
          </>
        }
      >
        {drill && (
          <div className="space-y-4 text-[12.5px]">
            <div className="grid grid-cols-2 gap-2">
              {[[t('common.type'), drill.type], [t('common.raisedBy'), drill.raisedBy], [t('common.role'), drill.raisedByRole], [t('common.age'), t('approvals.ageAgo', { hours: drill.ageHours })], ...(drill.amount ? [[t('common.amount'), `₹${drill.amount.toLocaleString('en-IN')}`]] : [])].map(([k, v]) => (
                <div key={k} className="bg-[var(--color-surface-raised)] rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-foreground-lighter)] mb-0.5">{k}</p>
                  <p className="font-semibold text-[var(--color-foreground)] capitalize">{v}</p>
                </div>
              ))}
            </div>
            <div className="bg-[var(--color-surface-raised)] rounded-xl px-4 py-3">
              <p className="text-[10.5px] font-semibold text-[var(--color-foreground-lighter)] uppercase tracking-wide mb-1.5">{t('common.justification')}</p>
              <p className="text-[var(--color-foreground-muted)] leading-relaxed">{drill.justification}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-[var(--color-foreground-lighter)] uppercase tracking-wide mb-2">{t('common.documents')}</p>
              <div className="space-y-1.5">
                {drill.documents.map(doc => (
                  <div key={doc.name} className="flex items-center gap-2 text-[12px] text-[var(--color-accent)] cursor-pointer hover:opacity-80">
                    <span>📄</span>
                    <span className="underline underline-offset-2">{doc.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DrillCard>
    </div>
  )
}
