"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'

export default function CmoSettingsPage() {
  const t = useTranslations('cmo')
  const [settings, setSettings] = useState({
    language: 'both',
    o2AlertHours: 4,
    alertSound: false,
    emailAlerts: true,
    smsAlerts: true,
    pushAlerts: false,
    delegateName: 'Dr. Anita Sharma (Addl. CMO)',
    timezone: 'Asia/Kolkata',
  })

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <CmoPageHeader title={t('settings.title')} />

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {/* Language */}
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-slate-900 mb-2">{t('settings.language')}</p>
          <div className="flex gap-3">
            {[{v:'en', l:t('settings.langEnOnly')}, {v:'hi', l:t('settings.langHiOnly')}, {v:'both', l:t('settings.langBoth')}].map(opt => (
              <label key={opt.v} className="flex items-center gap-1.5 cursor-pointer text-[12px]">
                <input type="radio" name="lang" value={opt.v} checked={settings.language === opt.v}
                  onChange={() => setSettings(s => ({...s, language: opt.v}))} />
                {opt.l}
              </label>
            ))}
          </div>
        </div>

        {/* Notification preferences */}
        <div className="px-5 py-4 space-y-2">
          <p className="text-[13px] font-semibold text-slate-900 mb-2">{t('settings.notificationChannels')}</p>
          {[
            { key: 'emailAlerts', labelKey: 'settings.emailAlerts' },
            { key: 'smsAlerts', labelKey: 'settings.smsAlerts' },
            { key: 'pushAlerts', labelKey: 'settings.pushAlerts' },
            { key: 'alertSound', labelKey: 'settings.alertSound' },
          ].map(({ key, labelKey }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-[12px] text-slate-700">{t(labelKey)}</span>
              <input type="checkbox" checked={settings[key as keyof typeof settings] as boolean}
                onChange={() => setSettings(s => ({...s, [key]: !s[key as keyof typeof s]}))} className="rounded" />
            </label>
          ))}
        </div>

        {/* Alert thresholds */}
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-slate-900 mb-2">{t('settings.alertThresholds')}</p>
          <label className="flex items-center gap-3 text-[12px] text-slate-700">
            {t('settings.o2AlertBefore')}
            <input type="number" min={1} max={24} value={settings.o2AlertHours}
              onChange={e => setSettings(s => ({...s, o2AlertHours: +e.target.value}))}
              className="w-16 border border-slate-300 rounded px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-primary/25" />
            {t('settings.hours')}
          </label>
        </div>

        {/* Delegation */}
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-slate-900 mb-2">{t('settings.delegation')}</p>
          <input value={settings.delegateName} onChange={e => setSettings(s => ({...s, delegateName: e.target.value}))}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25" />
        </div>

        {/* Timezone */}
        <div className="px-5 py-4">
          <p className="text-[13px] font-semibold text-slate-900 mb-2">{t('settings.timeZone')}</p>
          <select value={settings.timezone} onChange={e => setSettings(s => ({...s, timezone: e.target.value}))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
            <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
          </select>
        </div>
      </div>

      <button onClick={() => toast.success(t('settings.settingsSaved'))}
        className="w-full text-[13px] font-semibold py-2.5 rounded-xl bg-secondary text-white hover:bg-secondary-light transition-colors">
        {t('settings.saveSettings')}
      </button>
    </div>
  )
}
