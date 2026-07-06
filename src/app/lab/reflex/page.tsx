"use client"

import { useMemo } from "react"
import { Sparkles, Zap, CheckCircle, FileCheck2, ArrowRight, Activity, X } from "lucide-react"
import { useLabOrdersStore } from "@/store/useLabOrdersStore"
import { LAB_CATALOG } from "@/lib/labCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const ORDERED_HISTORY_CAP = 20

const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}

export default function LabReflex() {
  const suggestions = useLabOrdersStore(s => s.reflexSuggestions)
  const orderReflex = useLabOrdersStore(s => s.orderReflex)
  const dismissReflex = useLabOrdersStore(s => s.dismissReflex)

  const { pending, ordered } = useMemo(() => {
    const orderedAll = suggestions
      .filter(s => !!s.orderedAt)
      .sort((a, b) => (b.orderedAt ?? '').localeCompare(a.orderedAt ?? ''))
    return {
      pending: suggestions.filter(s => !s.orderedAt),
      ordered: orderedAll.slice(0, ORDERED_HISTORY_CAP),
    }
  }, [suggestions])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[var(--color-accent)]" /> Reflex Tests
        </h1>
        <p className="text-sm text-[#64748B] mt-1">AI-suggested follow-up tests triggered automatically when a result trips a rule · one-click to order</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Pending suggestions", value: pending.length, icon: Zap, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
          { label: "Ordered today", value: ordered.length, icon: CheckCircle, fg: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Active rules", value: 5, icon: Activity, fg: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl p-4 flex items-center gap-3", s.bg)}>
            <div className="p-2.5 rounded-xl bg-white shadow-sm"><s.icon className={cn("h-5 w-5", s.fg)} /></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p><h3 className="text-2xl font-bold text-slate-900">{s.value}</h3></div>
          </div>
        ))}
      </div>

      {/* Pending */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="text-sm font-bold text-slate-800">Pending suggestions</h2>
          <span className="text-xs text-slate-400">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <div className="px-4 py-10 flex flex-col items-center justify-center text-slate-400">
            <FileCheck2 className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-semibold">No reflex suggestions pending</p>
            <p className="text-xs">Release a result on Benches that trips a rule (e.g. high HbA1c, high Troponin, leucocytosis) to populate this list.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pending.map(s => {
              const cat = LAB_CATALOG[s.code]
              return (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                      <span className="font-bold">{s.patientName}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[var(--color-accent)]">{cat?.name ?? s.code}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">{cat?.bench ?? '?'}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5"><b className="text-slate-700">{s.triggerSummary}</b> · {s.reason}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">suggested {timeAgo(s.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { dismissReflex(s.id); toast(`Reflex suggestion dismissed`) }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap" aria-label="Dismiss suggestion">
                      <X className="h-3 w-3" /> Dismiss
                    </button>
                    <button onClick={() => { orderReflex(s.id); toast.success(`Reflex ${cat?.name ?? s.code} ordered for ${s.patientName}`) }}
                      className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl cursor-pointer whitespace-nowrap"
                      style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))", boxShadow: "0 2px 8px rgba(238,107,38,0.25)" }}>
                      <Zap className="h-3.5 w-3.5" /> Order reflex
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ordered (history) */}
      {ordered.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">Ordered</h2>
            <span className="text-xs text-slate-400">{ordered.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {ordered.map(s => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                    <b>{s.patientName}</b>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    {LAB_CATALOG[s.code]?.name ?? s.code}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.triggerSummary}</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />ordered {timeAgo(s.orderedAt!)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
