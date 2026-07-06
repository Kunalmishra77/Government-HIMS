"use client"

import { useEffect, useState } from "react"
import { RotateCcw, ShieldAlert, Database, CheckCircle2 } from "lucide-react"
import { resetDemoData, listDemoKeys } from "@/lib/demoReset"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

export default function AdminSettingsPage() {
  const t = useTranslations('admin')
  const [keys, setKeys] = useState<string[]>([])
  const { confirm, view: dialogView } = useDialogs()

  useEffect(() => { setKeys(listDemoKeys()) }, [])

  const onReset = async () => {
    const ok = await confirm({
      title: t('settings.confirmTitle'),
      body: t('settings.confirmBody', { count: keys.length }),
      tone: 'danger',
      confirmLabel: t('settings.confirmLabel'),
    })
    if (!ok) return
    const { cleared } = resetDemoData()
    toast.success(t('settings.cleared', { count: cleared }))
    setTimeout(() => window.location.reload(), 400)
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="h-6 w-6 text-[var(--color-accent)]" />{t('settings.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">{t('settings.persistedStores')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('settings.storesActive', { count: keys.length })}</p>
          </div>
        </div>
        {keys.length > 0 && (
          <details className="border-t border-slate-100 pt-3">
            <summary className="text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-900">{t('settings.showKeys', { count: keys.length })}</summary>
            <ul className="text-[11px] text-slate-500 font-mono mt-2 space-y-0.5 max-h-48 overflow-y-auto">
              {keys.map(k => <li key={k}>{k}</li>)}
            </ul>
          </details>
        )}
      </div>

      <div className="bg-amber-50/40 rounded-xl border border-amber-200 p-5">
        <div className="flex items-start gap-3 mb-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">{t('settings.resetTitle')}</p>
            <p className="text-xs text-slate-600 mt-0.5">
              {t('settings.resetBody')}
              <strong className="text-slate-900"> {t('settings.loginStays')}</strong>
            </p>
          </div>
        </div>
        <button onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer">
          <RotateCcw className="h-4 w-4" />{t('settings.resetButton')}
        </button>
      </div>

      {dialogView}
    </div>
  )
}
