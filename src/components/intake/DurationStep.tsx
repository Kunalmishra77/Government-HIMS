"use client"

import { useTranslations } from "next-intl"
import { DURATION_OPTIONS } from "@/lib/intake/data"
import { cn } from "@/lib/utils"

interface Props {
  symptoms: string[]
  durations: Record<string, string>
  onChange: (next: Record<string, string>) => void
}

export function DurationStep({ symptoms, durations, onChange }: Props) {
  const t = useTranslations("intake")
  const set = (symptom: string, value: string) => {
    const next = { ...durations }
    if (next[symptom] === value) {
      delete next[symptom]
    } else {
      next[symptom] = value
    }
    onChange(next)
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto pr-1 gap-3">
      <p className="text-[13px] text-slate-500 flex-shrink-0">
        {t('durationUi.intro')}
      </p>

      <div className="flex flex-col gap-2.5">
        {symptoms.map(symptom => {
          const selected = durations[symptom]
          return (
            <div
              key={symptom}
              className="bg-white rounded-[16px] px-4 py-3 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <p className="text-[14px] font-semibold text-slate-900 mb-2.5">{t.has(`symptom.${symptom}`) ? t(`symptom.${symptom}`) : symptom}</p>
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map(opt => {
                  const active = selected === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => set(symptom, opt.value)}
                      aria-pressed={active}
                      className={cn(
                        "h-8 px-3 rounded-[10px] text-[12px] font-medium border transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
                        active
                          ? "bg-[#EE6B26] border-[#EE6B26] text-[#0D2032] shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-[#EE6B26]/40",
                      )}
                    >
                      {t(`duration.${opt.value}`)}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[12px] text-slate-400 flex-shrink-0 pt-1">
        {t('durationUi.footer')}
      </p>
    </div>
  )
}
