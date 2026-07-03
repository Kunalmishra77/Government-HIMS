"use client"

import { HeartPulse } from "lucide-react"
import { news2FromRecord } from "@/lib/vitals"
import type { VitalsRecord } from "@/store/useInpatientStore"
import { cn } from "@/lib/utils"

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

// NEWS band → semantic token (colour + will always sit next to the numeric score).
const bandCls: Record<string, string> = {
  low: "bg-success-bg text-success-strong border-success/25",
  medium: "bg-warning-bg text-brand-amber-strong border-warning/30",
  high: "bg-danger-bg text-danger border-danger/25",
}

/**
 * Reusable vitals history — newest first, one row per recorded set with its
 * NEWS score. Used in the OPD Record-Vitals modal and reusable for IPD.
 */
export function VitalsHistory({ records, className }: { records: VitalsRecord[]; className?: string }) {
  const rows = [...records].sort((a, b) => b.at.localeCompare(a.at))
  const trend = [...records].sort((a, b) => a.at.localeCompare(b.at)).map(v => news2FromRecord(v).score)

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 mb-2.5">
        <HeartPulse className="h-4 w-4 text-success-strong" />
        <h3 className="t-title text-foreground">Vitals history</h3>
        {trend.length > 1 && (
          <span className="ml-auto text-[11px] font-semibold text-foreground-lighter">NEWS {trend.join(" → ")}</span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-foreground-placeholder py-6 text-center">No previous vitals recorded for this patient.</p>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[360px] pr-1">
          {rows.map(v => {
            const news = news2FromRecord(v)
            return (
              <div key={v.id} className="rounded-xl border border-border-light bg-surface-raised p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-foreground-placeholder">{fmt(v.at)}</span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold", bandCls[news.band])}>
                    NEWS {news.score}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-[12px] text-foreground-muted tabular-nums">
                  <span>HR <b className="text-foreground">{v.hr ?? "—"}</b></span>
                  <span>BP <b className="text-foreground">{v.systolicBP ?? "—"}/{v.diastolicBP ?? "—"}</b></span>
                  <span>RR <b className="text-foreground">{v.rr ?? "—"}</b></span>
                  <span>SpO₂ <b className="text-foreground">{v.spo2 ?? "—"}%</b></span>
                  <span>Temp <b className="text-foreground">{v.temp ?? "—"}°F</b></span>
                  {v.bloodGlucose != null && <span>Glu <b className="text-foreground">{v.bloodGlucose}</b></span>}
                </div>
                {v.by && <p className="mt-1 text-[10.5px] text-foreground-lighter">by {v.by}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
