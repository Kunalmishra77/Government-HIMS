"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useAmbulanceStore } from "@/store/useAmbulanceStore"
import { Truck, Activity, CheckCircle2, Gauge, AlertCircle } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/PageHeader"
import { EmptyState } from "@/components/ui/EmptyState"

type VehicleStatus = "available" | "on_trip" | "maintenance" | "out_of_service"

const STATUS_BADGE: Record<VehicleStatus, { variant: "success" | "primary" | "warning" | "danger" }> = {
  available:      { variant: "success" },
  on_trip:        { variant: "primary" },
  maintenance:    { variant: "warning" },
  out_of_service: { variant: "danger" },
}

export default function AmbulanceDashboard() {
  const t = useTranslations('ambulance')
  const { vehicles, trips, availableVehicles } = useAmbulanceStore()
  const activeTrips = trips.filter((t) => !['completed', 'cancelled'].includes(t.status))

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.available')}    value={availableVehicles().length}                         icon={CheckCircle2} color="green" delay={0} />
        <StatCard label={t('dashboard.onTrip')}       value={vehicles.filter((v) => v.status === 'on_trip').length}    icon={Truck}        color="blue"  delay={0.05} />
        <StatCard label={t('dashboard.maintenance')}  value={vehicles.filter((v) => v.status === 'maintenance').length} icon={AlertCircle}  color="amber" delay={0.1} />
        <StatCard label={t('dashboard.activeTrips')}  value={activeTrips.length}                                 icon={Activity}     color="slate" delay={0.15} />
      </div>

      {/* Fleet Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Truck className="h-4 w-4 text-accent" /> {t('dashboard.fleetStatus')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vehicles.map((v, i) => {
            const sb = STATUS_BADGE[v.status as VehicleStatus] ?? { variant: "muted" as const }
            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white hover:border-slate-300 transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-900 text-sm">{v.vehicleNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{v.type}</p>
                  <p className="text-xs text-slate-500">{t('dashboard.driver', { name: v.driverName })}</p>
                  {v.fuelLevel !== undefined && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Gauge className="h-3 w-3 text-slate-400" />
                      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${v.fuelLevel > 50 ? 'bg-green-500' : v.fuelLevel > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${v.fuelLevel}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{v.fuelLevel}%</span>
                    </div>
                  )}
                </div>
                <Badge variant={sb.variant}>{(t.has(`status.${v.status}`) ? t(`status.${v.status}`) : v.status).toUpperCase()}</Badge>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Active Trips */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-accent)]" /> {t('dashboard.activeTrips')}
        </h3>
        {activeTrips.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={t('dashboard.noActiveTripsTitle')} description={t('dashboard.noActiveTripsDesc')} />
        ) : (
          <div className="space-y-3">
            {activeTrips.map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl"
              >
                <div>
                  <p className="font-bold text-slate-800 text-sm">{trip.vehicleNumber} — {(t.has(`tripType.${trip.tripType}`) ? t(`tripType.${trip.tripType}`) : trip.tripType).toUpperCase()}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{trip.pickupLocation} → {trip.destination}</p>
                  {trip.chiefComplaint && (
                    <p className="text-xs text-red-600 mt-0.5">{t('dashboard.chiefComplaint', { complaint: trip.chiefComplaint })}</p>
                  )}
                </div>
                <Badge variant="primary">{(t.has(`status.${trip.status}`) ? t(`status.${trip.status}`) : trip.status).toUpperCase()}</Badge>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
