'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Shield, Globe, Monitor, Save } from 'lucide-react'

export default function SecretarySettingsPage() {
  const t = useTranslations('secretary')
  const [notifications, setNotifications] = useState({ critical: true, approval: true, daily: true, weekly: false })
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-lg">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('settings.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {[
        {
          icon: Bell, title: t('settings.notifications'), hi: 'सूचनाएं',
          children: (
            <div className="space-y-3">
              {[
                { key: 'critical', label: t('settings.notifCritical'), desc: t('settings.notifCriticalDesc') },
                { key: 'approval', label: t('settings.notifApproval'), desc: t('settings.notifApprovalDesc') },
                { key: 'daily', label: t('settings.notifDaily'), desc: t('settings.notifDailyDesc') },
                { key: 'weekly', label: t('settings.notifWeekly'), desc: t('settings.notifWeeklyDesc') },
              ].map(n => (
                <div key={n.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-foreground)]">{n.label}</p>
                    <p className="text-xs text-[var(--color-foreground-muted)]">{n.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key as keyof typeof prev] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifications[n.key as keyof typeof notifications] ? 'bg-[var(--color-primary)]' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 bg-white rounded-full shadow transition-transform ${notifications[n.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          ),
        },
        {
          icon: Globe, title: t('settings.language'), hi: 'भाषा',
          children: (
            <div className="flex gap-3">
              {([['en', 'English'], ['hi', 'हिंदी']] as const).map(([code, label]) => (
                <button key={code} onClick={() => setLanguage(code)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${language === code ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-foreground-muted)]'}`}>
                  {label}
                </button>
              ))}
            </div>
          ),
        },
        {
          icon: Shield, title: t('settings.security'), hi: 'सुरक्षा',
          children: (
            <div className="space-y-2">
              <p className="text-sm text-[var(--color-foreground-muted)]">{t('settings.twoFactor')} <strong className="text-emerald-600">{t('settings.enabled')}</strong></p>
              <p className="text-sm text-[var(--color-foreground-muted)]">{t('settings.sessionTimeout')} <strong>{t('settings.sessionTimeoutValue')}</strong></p>
              <p className="text-sm text-[var(--color-foreground-muted)]">{t('settings.lastLogin')} <strong>{t('settings.lastLoginValue')}</strong></p>
            </div>
          ),
        },
      ].map(section => {
        const Icon = section.icon
        return (
          <div key={section.title} className="bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center gap-3">
              <Icon className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-sm font-semibold text-[var(--color-foreground)]">{section.title}</span>
              <span className="text-[10px] text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{section.hi}</span>
            </div>
            <div className="p-5">{section.children}</div>
          </div>
        )
      })}

      <button onClick={handleSave}
        className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-[var(--color-primary)] text-white hover:opacity-90'}`}>
        <Save className="h-4 w-4" /> {saved ? t('settings.saved') : t('settings.save')}
      </button>
    </div>
  )
}
