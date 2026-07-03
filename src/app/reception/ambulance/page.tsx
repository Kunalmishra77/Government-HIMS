"use client"

import { useAmbulanceStore } from "@/store/useAmbulanceStore"
import { VisibilityHeader, STAT_CARD } from "@/components/reception/VisibilityHeader"
import { Truck, Activity, CheckCircle2, Wrench, MapPin, Navigation, Fuel, Phone } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const VEHICLE_STATUS: Record<string, { key: string; tint: string; dot: string }> = {
  available:      { key: 'statusAvailable',   tint: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
  on_trip:        { key: 'statusOnTrip',     tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',    dot: 'bg-[rgba(238,107,38,0.07)]0' },
  maintenance:    { key: 'statusMaintenance', tint: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500' },
  out_of_service: { key: 'statusOutOfService', tint: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
}
const TRIP_TINT: Record<string, string> = {
  dispatched: 'bg-amber-50 text-amber-700', en_route: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', at_scene: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  transporting: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', completed: 'bg-green-50 text-green-700', cancelled: 'bg-slate-100 text-slate-500',
}

export default function ReceptionAmbulance() {
  const t = useTranslations('reception')
  const vehicles = useAmbulanceStore(s => s.vehicles)
  const trips = useAmbulanceStore(s => s.trips)

  const available = vehicles.filter(v => v.status === 'available').length
  const onTrip = vehicles.filter(v => v.status === 'on_trip').length
  const activeTrips = trips.filter(t => t.status !== 'completed' && t.status !== 'cancelled')

  const tiles = [
    { label: t('ambulance.tileAvailable'), value: available, icon: CheckCircle2, tint: 'bg-green-50 text-green-600' },
    { label: t('ambulance.tileOnTrip'), value: onTrip, icon: Activity, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('ambulance.tileActiveTrips'), value: activeTrips.length, icon: Navigation, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('ambulance.tileFleetSize'), value: vehicles.length, icon: Truck, tint: 'bg-slate-100 text-slate-600' },
  ]

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <VisibilityHeader title={t('ambulance.title')} subtitle={t('ambulance.subtitle')} owner={t('ambulance.owner')} />
      </div>
      <div className="-mt-2 mb-4">
        <button
          onClick={() => {
            const availability = available > 0 ? t('ambulance.vehiclesAvailable', { count: available }) : t('ambulance.noVehiclesFree')
            notifyAndAudit({
              to: 'ambulance', type: 'system', priority: 'high',
              title: t('ambulance.dispatchRequestTitle'),
              body: t('ambulance.dispatchRequestBody', { availability }),
              audit: { action: 'ambulance_dispatched', resource: 'ambulance', detail: 'Reception requested dispatch via ambulance dashboard', userName: 'Reception' },
            })
            toast.success(t('ambulance.dispatchSentToast'), { description: available > 0 ? t('ambulance.dispatchSentDesc', { count: available }) : t('ambulance.noVehiclesDesc') })
          }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13.5px] font-bold shadow-sm active:scale-[0.98] transition">
          <Phone className="h-4 w-4" /> {t('ambulance.requestDispatch')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {tiles.map(t => (
          <div key={t.label} className={STAT_CARD}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.tint)}><t.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[22px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{t.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Active trips */}
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
          <h3 className="text-[15px] font-bold text-slate-900 mb-3">{t('ambulance.activeTrips')}</h3>
          {activeTrips.length === 0 ? (
            <p className="text-[13px] text-slate-400 bg-slate-50 rounded-xl p-3">{t('ambulance.noActiveTrips')}</p>
          ) : (
            <div className="space-y-2.5">
              {activeTrips.map(trip => (
                <div key={trip.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13.5px] font-bold text-slate-900 capitalize">{trip.tripType} · {trip.patientName ?? t('ambulance.emergency')}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", TRIP_TINT[trip.status] ?? 'bg-slate-100 text-slate-600')}>{trip.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {trip.pickupLocation} → {trip.destination}</p>
                  {typeof trip.responseTimeMinutes === 'number' && <p className="text-[11px] text-slate-400 mt-0.5">{t('ambulance.responseTime', { mins: trip.responseTimeMinutes })}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fleet */}
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
          <h3 className="text-[15px] font-bold text-slate-900 mb-3">{t('ambulance.fleet')}</h3>
          <div className="space-y-2">
            {vehicles.map(v => {
              const st = VEHICLE_STATUS[v.status] ?? VEHICLE_STATUS.out_of_service
              return (
                <div key={v.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", v.status === 'maintenance' ? 'bg-amber-50 text-amber-600' : 'bg-white border border-slate-200 text-slate-600')}>
                    {v.status === 'maintenance' ? <Wrench className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900 truncate">{v.vehicleNumber} <span className="font-medium text-slate-400">· {v.type}</span></p>
                    <p className="text-[11.5px] text-slate-500 truncate">{v.driverName}{typeof v.fuelLevel === 'number' ? ` · ` : ''}{typeof v.fuelLevel === 'number' && <span className="inline-flex items-center gap-0.5"><Fuel className="h-3 w-3" />{v.fuelLevel}%</span>}</p>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0", st.tint)}><span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{t(`ambulance.${st.key}`)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
