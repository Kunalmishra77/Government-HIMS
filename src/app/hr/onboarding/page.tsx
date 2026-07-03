"use client"

import { useTranslations } from "next-intl"
import { ClipboardCheck, CheckCircle2, Circle } from "lucide-react"
import { useHrmsStore } from "@/store/useHrmsStore"
import { cn } from "@/lib/utils"

export default function HrOnboarding() {
  const t = useTranslations('hr')
  const { onboarding, toggleOnboardingTask } = useHrmsStore()
  const sorted = [...onboarding].sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ClipboardCheck className="h-6 w-6 text-accent" /> {t('onboarding.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('onboarding.subtitle', { count: sorted.filter(o => o.tasks.some(tk => !tk.done)).length })}</p>
      </div>

      {sorted.length === 0 && (
        <div className="bg-white border rounded-2xl p-12 text-center">
          <p className="text-sm font-semibold text-slate-500">{t('onboarding.emptyTitle')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('onboarding.emptySub')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map(o => {
          const done = o.tasks.filter(tk => tk.done).length
          const pct = Math.round((done / o.tasks.length) * 100)
          const complete = done === o.tasks.length
          return (
            <div key={o.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{o.name}</p>
                    <p className="text-[11px] text-slate-500">{t('onboarding.started', { role: o.role, date: new Date(o.startedAt).toLocaleDateString('en-IN') })}</p>
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", complete ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200')}>
                    {complete ? t('onboarding.complete') : `${pct}%`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", complete ? 'bg-emerald-500' : 'bg-[rgba(238,107,38,0.07)]0')} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="p-3 space-y-1">
                {o.tasks.map((tk, i) => (
                  <button key={i} onClick={() => toggleOnboardingTask(o.id, i)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left cursor-pointer">
                    {tk.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" /> : <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />}
                    <span className={cn("text-[13px]", tk.done ? 'text-slate-400 line-through' : 'text-slate-700')}>{tk.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
