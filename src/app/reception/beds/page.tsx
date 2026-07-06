"use client"

import { useAdmissionStore, type Bed } from "@/store/useAdmissionStore"
import { VisibilityHeader, STAT_CARD } from "@/components/reception/VisibilityHeader"
import {
  BedDouble, CheckCircle2, User, Sparkles, Wrench, Clock, LogOut, AlarmClock, ArrowRight,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const STATUS_KEY: Record<string, string> = {
  Available: 'statusAvailable', Occupied: 'statusOccupied', Cleaning: 'statusCleaning', Reserved: 'statusReserved', Maintenance: 'statusMaintenance',
}

const STATUS_STYLE: Record<string, { tint: string; dot: string }> = {
  Available:   { tint: 'bg-green-50 text-green-700 border-green-100',   dot: 'bg-green-500' },
  Occupied:    { tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.15)]',      dot: 'bg-[rgba(238,107,38,0.07)]0' },
  Cleaning:    { tint: 'bg-amber-50 text-amber-700 border-amber-100',   dot: 'bg-amber-500' },
  Reserved:    { tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.15)]',dot: 'bg-[rgba(238,107,38,0.07)]0' },
  Maintenance: { tint: 'bg-slate-100 text-slate-500 border-slate-200',  dot: 'bg-slate-400' },
}
const ETA_TONE: Record<string, string> = {
  green: 'bg-green-100 text-green-700', amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700', violet: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]', slate: 'bg-slate-100 text-slate-500',
}

const minsUntil = (iso?: string) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 60000) : null)
const humanize = (mins: number) => { const a = Math.abs(mins); return a >= 60 ? `${Math.floor(a / 60)}h${a % 60 ? ` ${a % 60}m` : ''}` : `${a}m` }

function etaInfo(b: Bed): { key: string; time: string; tone: string } | null {
  const m = minsUntil(b.expectedFreeAt)
  if (m === null) return null
  if (b.status === 'Reserved') return { key: 'arriving', time: humanize(m), tone: 'violet' }
  if (b.status === 'Occupied') return m < 0 ? { key: 'overdue', time: humanize(m), tone: 'red' } : { key: 'freeIn', time: humanize(m), tone: m <= 30 ? 'green' : m <= 60 ? 'amber' : 'slate' }
  if (b.status === 'Cleaning') return m < 0 ? { key: 'overdue', time: humanize(m), tone: 'red' } : { key: 'readyIn', time: humanize(m), tone: 'amber' }
  return null
}

export default function ReceptionBeds() {
  const t = useTranslations('reception')
  const beds = useAdmissionStore(s => s.beds)
  const count = (st: string) => beds.filter(b => b.status === st).length
  const wards = [...new Set(beds.map(b => b.ward))]

  // Turnaround: occupied/cleaning beds with an expected-free time.
  const turnaround = beds.filter(b => (b.status === 'Occupied' || b.status === 'Cleaning') && b.expectedFreeAt)
  const freeing = turnaround.filter(b => (minsUntil(b.expectedFreeAt) ?? 0) >= 0).sort((a, b) => minsUntil(a.expectedFreeAt)! - minsUntil(b.expectedFreeAt)!)
  const overdue = turnaround.filter(b => (minsUntil(b.expectedFreeAt) ?? 0) < 0).sort((a, b) => minsUntil(a.expectedFreeAt)! - minsUntil(b.expectedFreeAt)!)

  const tiles = [
    { label: t('beds.tileTotalBeds'), value: beds.length, icon: BedDouble, tint: 'bg-slate-100 text-slate-600' },
    { label: t('beds.tileAvailable'), value: count('Available'), icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
    { label: t('beds.tileFreeingSoon'), value: freeing.filter(b => minsUntil(b.expectedFreeAt)! <= 60).length, icon: Clock, tint: 'bg-amber-50 text-amber-600' },
    { label: t('beds.tileOverdue'), value: overdue.length, icon: AlarmClock, tint: 'bg-red-50 text-red-600' },
    { label: t('beds.tileOccupied'), value: count('Occupied'), icon: User, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('beds.tileCleaning'), value: count('Cleaning'), icon: Sparkles, tint: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="pb-6">
      <VisibilityHeader title={t('beds.title')} subtitle={t('beds.subtitle')} owner={t('beds.owner')} />

      {/* Status tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {tiles.map(t => (
          <div key={t.label} className={STAT_CARD}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.tint)}><t.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[22px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{t.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Turnaround: freeing soon + overdue */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        {/* Freeing up */}
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
          <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Clock className="h-4.5 w-4.5 text-amber-500" /> {t('beds.freeingUpSoon')}
            <span className="ml-auto text-[12px] font-semibold text-slate-400">{freeing.length}</span></h3>
          {freeing.length === 0 ? (
            <p className="text-[13px] text-slate-400 bg-slate-50 rounded-xl p-3">{t('beds.noDischargesSoon')}</p>
          ) : (
            <div className="space-y-2">
              {freeing.map(b => {
                const m = minsUntil(b.expectedFreeAt)!
                const eta = etaInfo(b)!
                return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", b.status === 'Cleaning' ? "bg-amber-100 text-amber-600" : "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]")}>
                      {b.status === 'Cleaning' ? <Sparkles className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-slate-900 truncate">{b.bedNumber} · {b.ward}</p>
                      <p className="text-[11.5px] text-slate-500 truncate">{b.status === 'Cleaning' ? (b.cleaningAssignedTo ? t('beds.cleaningBy', { name: b.cleaningAssignedTo }) : t('beds.cleaning')) : t('beds.discharge', { name: b.occupantName ?? '' })}</p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", ETA_TONE[eta.tone])}>{m <= 30 ? '🟢 ' : ''}{t(`beds.${eta.key}`, { time: eta.time })}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className={cn("rounded-2xl p-5 border", overdue.length > 0 ? "bg-red-50/40 border-red-100 shadow-[0_1px_4px_rgba(15,23,42,0.06)]" : "bg-white border-transparent shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)]")}>
          <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><AlarmClock className={cn("h-4.5 w-4.5", overdue.length > 0 ? "text-red-500" : "text-slate-400")} /> {t('beds.overdueTurnaround')}
            <span className="ml-auto text-[12px] font-semibold text-slate-400">{overdue.length}</span></h3>
          {overdue.length === 0 ? (
            <p className="text-[13px] text-slate-400 bg-white rounded-xl p-3">{t('beds.allOnTrack')}</p>
          ) : (
            <div className="space-y-2">
              {overdue.map(b => {
                const eta = etaInfo(b)!
                const cleaning = b.status === 'Cleaning'
                return (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 border border-red-100">
                    <span className="h-9 w-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0"><AlarmClock className="h-4 w-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-slate-900 truncate">{b.bedNumber} · {b.ward}</p>
                      <p className="text-[11.5px] text-red-600 truncate">{cleaning ? (b.cleaningAssignedTo ? t('beds.cleaningOverdueBy', { name: b.cleaningAssignedTo }) : t('beds.cleaningOverdue')) : t('beds.dischargeOverdue')}</p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 flex items-center gap-1", ETA_TONE.red)}><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />{t(`beds.${eta.key}`, { time: eta.time })}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Wards */}
      <div className="space-y-4">
        {wards.map(ward => {
          const wardBeds = beds.filter(b => b.ward === ward)
          const free = wardBeds.filter(b => b.status === 'Available').length
          return (
            <div key={ward} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold text-slate-900">{ward}</h3>
                <span className={cn("text-[12px] font-bold px-2.5 py-1 rounded-full", free > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>{t('beds.freeCount', { free, total: wardBeds.length })}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {wardBeds.map(b => {
                  const st = STATUS_STYLE[b.status] ?? STATUS_STYLE.Maintenance
                  const eta = etaInfo(b)
                  return (
                    <div key={b.id} className={cn("rounded-xl border p-3", st.tint)}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13.5px] font-bold">{b.bedNumber}</span>
                        <span className={cn("h-2 w-2 rounded-full", st.dot)} />
                      </div>
                      <p className="text-[11px] font-semibold mt-1">{STATUS_KEY[b.status] ? t(`beds.${STATUS_KEY[b.status]}`) : b.status}</p>
                      <p className="text-[11px] opacity-80 truncate">{b.occupantName ?? (b.status === 'Available' ? t('beds.ready') : '—')}</p>
                      {eta && <span className={cn("inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full", ETA_TONE[eta.tone])}>{eta.tone === 'red' ? <AlarmClock className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}{t(`beds.${eta.key}`, { time: eta.time })}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
