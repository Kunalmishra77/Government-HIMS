"use client"

import { cn } from "@/lib/utils"
import type { QueueStatus } from "@/store/usePatientStore"

const steps: { key: QueueStatus; label: string }[] = [
  { key: 'waiting', label: 'Registered' },
  { key: 'vitals', label: 'Vitals' },
  { key: 'consulting', label: 'Consulting' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'billing', label: 'Billing' },
  { key: 'done', label: 'Done' },
]

const statusIndex: Record<QueueStatus, number> = {
  waiting: 0, vitals: 1, consulting: 2, pharmacy: 3, billing: 4, done: 5,
}

interface StatusStepperProps {
  status: QueueStatus
  className?: string
}

export function StatusStepper({ status, className }: StatusStepperProps) {
  const current = statusIndex[status]
  return (
    <div className={cn("flex items-center w-full", className)}>
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
              idx < current ? "bg-secondary text-white" :
              idx === current ? "bg-secondary text-white ring-4 ring-primary/20" :
              "bg-slate-100 text-slate-400 border border-slate-200"
            )}>
              {idx < current ? "✓" : idx + 1}
            </div>
            <span className={cn("text-[10px] mt-1 font-medium whitespace-nowrap",
              idx <= current ? "text-accent" : "text-slate-400"
            )}>{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={cn("h-0.5 flex-1 mx-1 mb-4 transition-all duration-500",
              idx < current ? "bg-secondary" : "bg-slate-200"
            )} />
          )}
        </div>
      ))}
    </div>
  )
}
