"use client"

import { useState } from "react"
import { Layers, ChevronDown, Zap } from "lucide-react"
import { ORDER_SETS, materializeOrderSet, type OrderSetDef, type OrderSetCategory } from "@/lib/clinicalOrderSets"
import { cn } from "@/lib/utils"

// Track A — one-click protocol bundles. Selecting a set stages diagnosis +
// labs + imaging + meds (+ admission) into the consultation workspace below,
// which the doctor reviews and sends through the existing safety-gated flow.

const CATEGORY_COLOR: Record<OrderSetCategory, string> = {
  Cardiac: '#DC2626',
  Infection: '#D97706',
  Respiratory: 'var(--color-primary)',
  Metabolic: 'var(--color-primary-dark)',
  Neuro: 'var(--color-primary)',
  Abdominal: '#059669',
}

function setSummary(def: OrderSetDef): string {
  const m = materializeOrderSet(def)
  const parts: string[] = []
  if (m.labs.length) parts.push(`${m.labs.length} lab`)
  if (m.imaging.length) parts.push(`${m.imaging.length} imaging`)
  if (m.prescriptions.length) parts.push(`${m.prescriptions.length} Rx`)
  if (m.admission) parts.push('admit')
  return parts.join(' · ')
}

export function OrderSetPicker({
  onApply,
  disabled,
}: {
  onApply: (def: OrderSetDef) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/25"
      >
        <span className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg bg-[rgba(238,107,38,0.07)] flex items-center justify-center">
            <Layers className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[13px] font-bold text-slate-900">Quick order sets</span>
            <span className="block text-[11px] text-slate-400">Stage a full protocol in one tap — review before sending</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ORDER_SETS.map((def) => (
            <button
              key={def.id}
              type="button"
              disabled={disabled}
              onClick={() => onApply(def)}
              title={def.presentation}
              aria-label={`Apply order set: ${def.label}. ${def.presentation}. Stages ${setSummary(def)}.`}
              className={cn(
                "group text-left rounded-xl border border-slate-200 p-3 transition-all",
                "hover:border-slate-300 hover:shadow-sm active:scale-[0.99]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLOR[def.category] }} aria-hidden="true" />
                <span className="text-[12.5px] font-bold text-slate-900 leading-tight">{def.label}</span>
                {def.urgent && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    <Zap className="h-2.5 w-2.5" aria-hidden="true" />Urgent
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">{def.presentation}</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-1.5">{setSummary(def)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
