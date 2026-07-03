'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type TabId = 'overview' | 'facilities' | 'workforce' | 'integration' | 'quality'

const TAB_IDS: { id: TabId; labelKey: string }[] = [
  { id: 'overview', labelKey: 'ayush.tabOverview' },
  { id: 'facilities', labelKey: 'ayush.tabFacilities' },
  { id: 'workforce', labelKey: 'ayush.tabWorkforce' },
  { id: 'integration', labelKey: 'ayush.tabIntegration' },
  { id: 'quality', labelKey: 'ayush.tabQuality' },
]

const FACILITY_TYPES = [
  { type: 'Ayurvedic dispensaries', count: 2180, active: 1940 },
  { type: 'Homeopathic dispensaries', count: 820, active: 710 },
  { type: 'Unani dispensaries', count: 340, active: 280 },
  { type: 'AYUSH hospitals (beds)', count: 52, active: 48 },
  { type: 'Yoga wellness centers', count: 180, active: 164 },
]

export default function AyushPage() {
  const t = useTranslations('secretary')
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('ayush.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('ayush.subtitle')}</p>
      </div>
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TAB_IDS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${tab === tb.id ? 'bg-white text-[var(--color-accent)] font-semibold shadow' : 'font-medium text-slate-500 hover:text-slate-700'}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'AYUSH facilities', value: '3,572', sub: 'All types' },
              { label: 'OPD attendance/month', value: '18.4L', sub: 'AYUSH systems' },
              { label: 'AYUSH doctors', value: '6,240', sub: 'In position' },
              { label: 'NHM AYUSH co-location', value: '82%', sub: 'PHCs with AYUSH' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
                <p className="text-2xl font-bold mt-1 text-[var(--color-foreground)]">{k.value}</p>
                <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
              <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('ayush.facilityBreakdown')}</p>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {FACILITY_TYPES.map(f => (
                <div key={f.type} className="px-5 py-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{f.type}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-emerald-600 font-medium">{t('ayush.active', { count: f.active })}</span>
                    <span className="text-xs text-[var(--color-foreground-lighter)]">{t('ayush.ofTotal', { count: f.count })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {tab !== 'overview' && (
        <div className="text-center py-16 text-[var(--color-foreground-muted)]">
          <p className="text-sm">{t('ayush.comingSoon', { tab: t(TAB_IDS.find(x => x.id === tab)?.labelKey ?? 'ayush.tabOverview') })}</p>
        </div>
      )}
    </div>
  )
}
