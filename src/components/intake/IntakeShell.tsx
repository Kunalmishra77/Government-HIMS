"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface FlowStep {
  id: string
  title: string
  milestone: string
  summary: string
}

interface Props {
  doneSteps: FlowStep[] // Kept for interface compatibility, unused in new UI
  current: { id: string; title: string; milestone: string; stepNumber: number; totalSteps: number }
  onEditStep: (id: string) => void // Kept for compatibility
  onBack?: () => void // Kept for compatibility
  ctaLabel: string
  onCta: () => void
  ctaDisabled?: boolean
  ctaLoading?: boolean
  children: React.ReactNode
}

/**
 * Step content wrapper for form steps.
 * Provides a clean content area with a sticky bottom action button.
 */
export function IntakeShell({
  current, ctaLabel, onCta, ctaDisabled, ctaLoading, children,
}: Props) {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      {/* Step Title Header (inside content) */}
      <div className="px-6 pt-6 pb-2 shrink-0">
        {current.milestone && (
          <p className="text-[12px] font-bold uppercase tracking-wider text-[#B84A16] mb-1">
            {current.milestone}
          </p>
        )}
        <h2 className="text-[28px] font-bold text-slate-900 tracking-tight leading-tight">
          {current.title}
        </h2>
      </div>

      {/* Main Form Content - Scrollable area for children */}
      {/* We add pb-28 to ensure the bottom content isn't hidden behind the sticky footer */}
      <div className="flex-1 px-6 pt-4 pb-[120px] relative min-h-0 overflow-y-auto">
        {children}
      </div>

      {/* Sticky Bottom CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-6 bg-gradient-to-t from-[color:var(--color-background)] via-[color:var(--color-background)] to-transparent pointer-events-none z-20">
        <div className="pointer-events-auto shadow-2xl rounded-2xl">
          <button
            onClick={onCta}
            disabled={ctaDisabled || ctaLoading}
            className={cn(
              "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EE6B26]",
              (ctaDisabled || ctaLoading) 
                ? "cursor-not-allowed bg-slate-200 text-slate-400" 
                : "bg-[#EE6B26] text-[#0D2032] hover:bg-[#C2481A] active:scale-[0.98] shadow-[0_8px_20px_rgba(238,107,38,0.28)]",
            )}
          >
            {ctaLoading ? (
              <>
                <motion.span 
                  animate={{ rotate: 360 }} 
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} 
                  className="h-5 w-5 rounded-full border-[3px] border-white/30 border-t-white" 
                />
                Finalizing…
              </>
            ) : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
