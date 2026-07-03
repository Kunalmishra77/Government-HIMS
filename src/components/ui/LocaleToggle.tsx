"use client"

import { useSetLocale } from "@/components/i18n/LocaleProvider"

export function LocaleToggle() {
  const { locale, setLocale } = useSetLocale()

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
      title={locale === 'en' ? 'Switch to Hindi' : 'Switch to English'}
    >
      <span className={locale === 'en' ? 'text-accent' : 'text-slate-400'}>EN</span>
      <span className="text-slate-300">|</span>
      <span className={locale === 'hi' ? 'text-accent' : 'text-slate-400'}>हिं</span>
    </button>
  )
}
