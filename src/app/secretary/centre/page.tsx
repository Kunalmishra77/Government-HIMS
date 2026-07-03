'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSecretaryCentreStore } from '@/store/useSecretaryCentreStore'

export default function CentrePage() {
  const t = useTranslations('secretary')
  const { correspondence } = useSecretaryCentreStore()
  const [selected, setSelected] = useState<string | null>(null)

  const FUND_FLOW = [
    { label: t('centre.fundNhmRelease'), amount: '₹824 Cr', note: t('centre.fundNhmReleaseNote') },
    { label: t('centre.fundToSociety'), amount: '₹824 Cr', note: t('centre.fundToSocietyNote') },
    { label: t('centre.fundToDistricts'), amount: '₹612 Cr', note: t('centre.fundToDistrictsNote') },
    { label: t('centre.fundToFacility'), amount: '₹490 Cr', note: t('centre.fundToFacilityNote') },
  ]

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('centre.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('centre.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Correspondence list */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">{t('centre.recentComms', { count: correspondence.length })}</h2>
          <div className="space-y-2">
            {correspondence.map(c => (
              <button key={c.id} onClick={() => setSelected(selected === c.id ? null : c.id)}
                className={`w-full text-left bg-white border rounded-xl p-4 transition-all hover:shadow-md ${selected === c.id ? 'border-[var(--color-primary)] shadow-md' : 'border-[var(--color-border)]'}`}
                style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-sunken text-accent">{t('centre.inbound')}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        c.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>{c.status}</span>
                      <span className="text-[10px] text-[var(--color-foreground-lighter)]">{c.date}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{c.subject}</p>
                    <p className="text-xs text-[var(--color-foreground-muted)]">{c.from}</p>
                  </div>
                  {c.status === 'pending' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">{t('centre.actionNeeded')}</span>
                  )}
                </div>
                {selected === c.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    {c.dueDate && <p className="text-xs text-[var(--color-foreground-muted)] mb-2">{t('centre.due', { date: c.dueDate })}</p>}
                    {c.amount && <p className="text-xs font-medium text-[var(--color-foreground)] mb-2">{t('centre.amount', { amount: (c.amount / 1e7).toFixed(1) })}</p>}
                    {c.status === 'pending' && (
                      <button className="mt-2 px-4 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg">{t('centre.draftResponse')}</button>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fund flow diagram */}
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-foreground)] mb-3">{t('centre.fundFlowTitle')}</h2>
          <div className="bg-white border border-[var(--color-border)] rounded-2xl p-5 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
            {FUND_FLOW.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && <div className="ml-4 w-px h-4 bg-[var(--color-border)]" />}
                <div className={`flex items-center justify-between w-full bg-[var(--color-surface-raised)] rounded-xl px-4 py-3 ${i === 0 ? 'border-2 border-[var(--color-primary)]' : ''}`}>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{f.label}</p>
                    <p className="text-[10px] text-[var(--color-foreground-lighter)]">{f.note}</p>
                  </div>
                  <p className={`text-base font-bold ${i === 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-foreground)]'}`}>{f.amount}</p>
                </div>
              </div>
            ))}
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-700 font-medium">{t('centre.fundWarning')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
