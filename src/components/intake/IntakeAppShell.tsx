"use client"

import { ChevronLeft } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useTranslations } from "next-intl"
import { LocaleToggle } from "@/components/ui/LocaleToggle"

export interface IntakeAppShellProps {
  stepNumber?: number
  totalSteps?: number
  onBack?: () => void
  headerTitle?: React.ReactNode
  children: React.ReactNode
}

/**
 * A native-feeling iOS style shell for the Patient Check-in flow.
 * Provides the sticky header, back navigation, and consistent layout.
 */
export function IntakeAppShell({ stepNumber, totalSteps, onBack, headerTitle, children }: IntakeAppShellProps) {
  const reduce = useReducedMotion()
  const t = useTranslations("intake.shell")
  const pct = stepNumber && totalSteps ? Math.round((stepNumber / totalSteps) * 100) : 0

  return (
    <div className="min-h-[100dvh] w-full bg-[color:var(--color-background)] flex flex-col md:bg-slate-100 md:py-8 intake-theme">
      <div className="relative flex-1 w-full max-w-[480px] mx-auto flex flex-col bg-[color:var(--color-background)] overflow-hidden md:rounded-[44px] md:shadow-2xl md:border md:border-slate-200/60">
        
        {/* Navigation Bar */}
        <header className="relative z-20 bg-[color:var(--color-background)]/85 backdrop-blur-xl border-b border-slate-200/50">
          <div className="flex items-center justify-between px-4 h-[max(3.5rem,calc(3.5rem+env(safe-area-inset-top)))] pt-[env(safe-area-inset-top)]">
            <div className="w-24 flex justify-start">
              {onBack && (
                <button 
                  onClick={onBack}
                  aria-label={t("back")}
                  className="inline-flex items-center gap-0.5 text-[17px] font-medium text-accent hover:opacity-80 active:opacity-50 transition-opacity focus:outline-none rounded-lg -ml-2 px-2 py-1 cursor-pointer"
                >
                  <ChevronLeft className="h-[24px] w-[24px] -ml-1 stroke-[2.5]" />
                  <span>{t("back")}</span>
                </button>
              )}
            </div>
            
            <div className="flex-1 flex justify-center">
              <span className="text-[17px] font-semibold text-foreground tracking-tight">
                {headerTitle || t("headerCheckin")}
              </span>
            </div>

            <div className="flex justify-end items-center gap-2">
              {stepNumber && totalSteps && (
                <span className="text-[13px] font-semibold text-foreground-placeholder tracking-tight tabular-nums">
                  {t("stepOf", { current: stepNumber, total: totalSteps })}
                </span>
              )}
              <LocaleToggle />
            </div>
          </div>

          {/* Minimal Progress Bar */}
          {totalSteps && totalSteps > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-200/50">
              <motion.div 
                className="h-full bg-primary rounded-r-full"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
              />
            </div>
          )}
        </header>

        {/* Content Area - Children handle their own scrolling */}
        <main className="flex-1 overflow-hidden relative z-10 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
