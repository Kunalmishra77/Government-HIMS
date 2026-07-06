"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  Sparkles, Clock, BedDouble, TrendingDown, ArrowRight, AlertTriangle,
} from "lucide-react"
import { useAdmissionStore, type Bed } from "@/store/useAdmissionStore"
import { useInpatientStore, type Inpatient } from "@/store/useInpatientStore"
import { cn } from "@/lib/utils"

// AI-style short-term forecast: which beds are likely to free up in each
// time window, broken down by ward.
//
// Sources of signal:
//   1. bed.expectedFreeAt (highest confidence)
//   2. inpatient.condition === 'Discharge-ready' (high confidence, ~ASAP)
//   3. inpatient.stage === 'discharge_initiated' (high, within 2-4h)
//   4. inpatient.expectedDischarge text ("In 2-3 days") — parse roughly
//   5. heuristic LoS curve (medium confidence, ward-typical)
//
// Per-bed prediction returns { etaHrs, confidence (0-1), reason } and we
// bucket by window. NOT a real ML model — but the math is transparent and
// matches what an experienced bed-manager would estimate.

type EtaHrs = number
type Window = 'now' | '2h' | '4h' | '8h' | '24h'

interface BedPrediction {
  bed: Bed
  etaHrs: EtaHrs
  window: Window
  confidence: number          // 0..1
  reason: string
  patientName?: string
}

const WINDOW_BUCKETS: { key: Window; max: EtaHrs; label: string; tint: string }[] = [
  { key: 'now',  max: 0.5, label: 'Now / overdue', tint: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { key: '2h',   max: 2,   label: 'Next 2h',        tint: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  { key: '4h',   max: 4,   label: '2-4h',           tint: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  { key: '8h',   max: 8,   label: '4-8h',           tint: 'border-amber-200 bg-amber-50 text-amber-700' },
  { key: '24h',  max: 24,  label: '8-24h',          tint: 'border-slate-200 bg-slate-50 text-slate-600' },
]

// Parse hopeful free-text "In 2-3 days" / "tomorrow" / "today" / "in 4h"
function parseExpectedDischargeText(text?: string): { mid: number; conf: number } | null {
  if (!text) return null
  const t = text.toLowerCase()
  // "in X-Y days"
  let m = t.match(/in (\d+)(?:-(\d+))?\s*days?/i)
  if (m) {
    const a = parseInt(m[1]!, 10), b = m[2] ? parseInt(m[2], 10) : a
    return { mid: ((a + b) / 2) * 24, conf: 0.4 }
  }
  // "in X hours"
  m = t.match(/in (\d+)\s*h/i)
  if (m) return { mid: parseInt(m[1]!, 10), conf: 0.6 }
  if (/today|this evening/.test(t)) return { mid: 6, conf: 0.55 }
  if (/tomorrow|next day/.test(t)) return { mid: 30, conf: 0.5 }
  return null
}

function predictBed(bed: Bed, ip?: Inpatient): BedPrediction | null {
  if (bed.status === 'Available' || bed.status === 'Maintenance') return null

  // 1) Explicit timestamp on the bed
  if (bed.expectedFreeAt) {
    const etaHrs = (new Date(bed.expectedFreeAt).getTime() - Date.now()) / 3600000
    if (etaHrs <= 24) {
      return {
        bed, etaHrs: Math.max(0, etaHrs),
        window: bucketOf(etaHrs),
        confidence: 0.95,
        reason: etaHrs < 0 ? 'Overdue — was expected free already' : 'Discharge ETA on bed record',
        patientName: ip?.name ?? bed.occupantName,
      }
    }
  }

  // 2) Inpatient signals
  if (ip) {
    if (ip.stage === 'discharge_initiated' || ip.condition === 'Discharge-ready') {
      return {
        bed, etaHrs: 1.5, window: bucketOf(1.5),
        confidence: 0.85,
        reason: ip.condition === 'Discharge-ready' ? 'Patient discharge-ready' : 'Discharge initiated',
        patientName: ip.name,
      }
    }
    if (ip.stage === 'recovering' && (ip.condition === 'Improving' || ip.condition === 'Stable')) {
      return {
        bed, etaHrs: 6, window: bucketOf(6),
        confidence: 0.55,
        reason: 'Recovering, stable — likely discharge today / tomorrow',
        patientName: ip.name,
      }
    }
    const parsed = parseExpectedDischargeText(ip.expectedDischarge)
    if (parsed && parsed.mid <= 24) {
      return {
        bed, etaHrs: parsed.mid, window: bucketOf(parsed.mid),
        confidence: parsed.conf,
        reason: `Expected discharge: ${ip.expectedDischarge}`,
        patientName: ip.name,
      }
    }
  }

  // 3) Cleaning beds — assume turnover ~30-60min, 0.7 confidence
  if (bed.status === 'Cleaning') {
    return {
      bed, etaHrs: 0.75, window: bucketOf(0.75),
      confidence: 0.7,
      reason: 'Housekeeping turnover',
      patientName: undefined,
    }
  }

  // No signal — drop.
  return null
}

function bucketOf(etaHrs: number): Window {
  for (const b of WINDOW_BUCKETS) if (etaHrs <= b.max) return b.key
  return '24h'
}

export function BedFreeingForecast() {
  const beds = useAdmissionStore(s => s.beds)
  const inpatients = useInpatientStore(s => s.inpatients)

  const predictions = useMemo(() => {
    const ipByPid = new Map(inpatients.map(i => [i.patientId, i]))
    const out: BedPrediction[] = []
    for (const b of beds) {
      const ip = b.occupantId ? ipByPid.get(b.occupantId) : undefined
      const p = predictBed(b, ip)
      if (p) out.push(p)
    }
    return out.sort((a, b) => a.etaHrs - b.etaHrs)
  }, [beds, inpatients])

  const byWard = useMemo(() => {
    const map = new Map<string, { window: Window; count: number; weightedConfidence: number }[]>()
    for (const p of predictions) {
      const wardBuckets = map.get(p.bed.ward) ?? []
      const existing = wardBuckets.find(b => b.window === p.window)
      if (existing) {
        existing.count++
        existing.weightedConfidence += p.confidence
      } else {
        wardBuckets.push({ window: p.window, count: 1, weightedConfidence: p.confidence })
      }
      map.set(p.bed.ward, wardBuckets)
    }
    return map
  }, [predictions])

  const totalNext4h = predictions.filter(p => p.etaHrs <= 4).length
  const totalNext24h = predictions.length

  return (
    <div className="rounded-xl bg-white border border-[rgba(238,107,38,0.20)] overflow-hidden"
      style={{ background: "var(--color-surface-sunken)" }}>
      <div className="px-4 py-3 border-b border-[rgba(238,107,38,0.15)] flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />AI bed-freeing forecast
        </h2>
        <p className="text-[11px] text-slate-500">
          <b className="text-[var(--color-accent)]">{totalNext4h}</b> beds expected free in next 4h ·
          {' '}<b className="text-slate-700">{totalNext24h}</b> in next 24h
        </p>
      </div>

      <div className="p-3 space-y-2">
        {totalNext24h === 0 && (
          <div className="text-center py-8">
            <TrendingDown className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">No clear bed-freeing signal</p>
            <p className="text-xs text-slate-400 mt-1">Every occupied bed has no discharge ETA on file. Update the inpatient records to improve the forecast.</p>
          </div>
        )}

        {Array.from(byWard.entries()).map(([ward, buckets]) => (
          <motion.div key={ward} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-white border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-slate-800">{ward}</p>
              <p className="text-[11px] text-slate-500">
                {buckets.reduce((s, b) => s + b.count, 0)} bed{buckets.reduce((s, b) => s + b.count, 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {WINDOW_BUCKETS.map(wb => {
                const b = buckets.find(x => x.window === wb.key)
                const count = b?.count ?? 0
                const conf = b ? Math.round((b.weightedConfidence / b.count) * 100) : 0
                return (
                  <div key={wb.key} className={cn("rounded-md border p-2 flex flex-col items-center", count > 0 ? wb.tint : 'border-slate-100 bg-white text-slate-300')}>
                    <p className="text-base font-bold leading-none">{count}</p>
                    <p className="text-[9px] font-bold uppercase mt-0.5 text-center leading-tight">{wb.label}</p>
                    {count > 0 && <p className="text-[9px] font-semibold mt-0.5">{conf}% conf</p>}
                  </div>
                )
              })}
            </div>
          </motion.div>
        ))}

        {predictions.length > 0 && (
          <details className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 mt-1">
            <summary className="text-[11px] font-bold text-slate-600 cursor-pointer hover:text-slate-900 select-none flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />Per-bed predictions ({predictions.length})
            </summary>
            <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
              {predictions.map(p => (
                <li key={p.bed.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-slate-100 last:border-0">
                  <BedDouble className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span className="font-bold text-slate-900">{p.bed.bedNumber}</span>
                  <span className="text-slate-500">{p.bed.ward}</span>
                  {p.patientName && <span className="text-slate-700 font-medium truncate">{p.patientName}</span>}
                  <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                    <Clock className="h-2.5 w-2.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">
                      {p.etaHrs < 1 ? 'now' : p.etaHrs < 24 ? `${Math.round(p.etaHrs)}h` : `${Math.round(p.etaHrs / 24)}d`}
                    </span>
                    <span className="text-slate-400">· {Math.round(p.confidence * 100)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        {totalNext4h > 0 && totalNext4h >= 3 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 flex items-start gap-1.5 mt-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10.5px] text-amber-800">
              <b>{totalNext4h} beds freeing in the next 4h</b> — pull pending admission requests forward.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
