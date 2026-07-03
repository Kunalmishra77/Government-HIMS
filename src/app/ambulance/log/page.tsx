"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Truck, ArrowRight, CheckCircle2, MapPin, ShieldCheck } from "lucide-react"
import { useAmbulanceStore, type AmbulanceTrip, type TripStatus } from "@/store/useAmbulanceStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_TINT: Record<TripStatus, string> = {
  dispatched: 'bg-amber-100 text-amber-700',
  en_route:   'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  at_scene:   'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  transporting: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  completed:  'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-slate-200 text-slate-600',
}

// Next status in the lifecycle for the action button.
const NEXT: Partial<Record<TripStatus, TripStatus>> = {
  dispatched: 'en_route',
  en_route:   'at_scene',
  at_scene:   'transporting',
  transporting: 'completed',
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AmbulanceLogPage() {
  const tr = useTranslations('ambulance')
  const trips      = useAmbulanceStore(s => s.trips)
  const updateTrip = useAmbulanceStore(s => s.updateTrip)

  const statusLabel = (s: TripStatus) => tr.has(`status.${s}`) ? tr(`status.${s}`) : s

  const [tab, setTab] = useState<'active' | 'history'>('active')

  const sorted = useMemo(() => [...trips].sort((a, b) => new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime()), [trips])
  const active = sorted.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const history = sorted.filter(t => t.status === 'completed' || t.status === 'cancelled')

  const advance = (t: AmbulanceTrip) => {
    const next = NEXT[t.status]
    if (!next) return
    updateTrip(t.id, { status: next, ...(next === 'completed' ? { completedAt: new Date().toISOString() } : {}) })
    toast.success(tr('dispatch.toast.stageAdvanced', { vehicle: t.vehicleNumber, stage: statusLabel(next) }))
  }

  const list = tab === 'active' ? active : history

  return (
    <div className="space-y-5 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Truck className="h-6 w-6 text-accent" />{tr('log.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{tr('log.subtitle')}</p>
      </div>

      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 w-fit">
        {(['active', 'history'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer',
              tab === tabKey ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {tabKey === 'active' ? tr('log.tabActive') : tr('log.tabHistory')} <span className="text-slate-400">{tabKey === 'active' ? active.length : history.length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">{tr('log.noTrips')}</p>
          </div>
        )}
        {list.map(t => {
          const minsActive = Math.round((Date.now() - new Date(t.dispatchedAt).getTime()) / 60000)
          const next = NEXT[t.status]
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {t.vehicleNumber}
                    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", STATUS_TINT[t.status])}>
                      {statusLabel(t.status)}
                    </span>
                    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                      t.tripType === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]')}>
                      {tr.has(`tripType.${t.tripType}`) ? tr(`tripType.${t.tripType}`) : t.tripType}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{t.pickupLocation} <ArrowRight className="h-3 w-3 text-slate-400" /> {t.destination}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {tr('log.dispatchedAt', { time: fmt(t.dispatchedAt), mins: minsActive })}
                    {t.chiefComplaint ? ` · ${t.chiefComplaint}` : ''}
                    {t.callerName ? ` · ${tr('log.callerPrefix')} ${t.callerName}${t.callerPhone ? ` (${t.callerPhone})` : ''}` : ''}
                  </p>
                  {t.responseTimeMinutes !== undefined && (
                    <p className="text-[11px] text-emerald-700 mt-0.5">{tr('log.responseTime', { mins: t.responseTimeMinutes })}</p>
                  )}
                  {t.completedAt && (
                    <p className="text-[11px] text-slate-500 mt-0.5">{tr('log.completedAt', { time: fmt(t.completedAt) })}</p>
                  )}
                </div>
                {next && (
                  <button onClick={() => advance(t)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary-dark text-white cursor-pointer">
                    <ArrowRight className="h-3.5 w-3.5" />{tr('log.advanceTo', { stage: statusLabel(next) })}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3" />{tr('log.footer')}
      </p>
    </div>
  )
}
