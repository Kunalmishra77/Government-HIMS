"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { useAmbulanceStore, type TripStatus } from "@/store/useAmbulanceStore"
import { Truck, Send, MapPin, CheckCircle2, Fuel, X, Phone } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

const TRIP_STAGES: TripStatus[] = ['dispatched', 'en_route', 'at_scene', 'transporting', 'completed']
const NEXT_STAGE: Partial<Record<TripStatus, TripStatus>> = {
  dispatched: 'en_route',
  en_route:   'at_scene',
  at_scene:   'transporting',
  transporting: 'completed',
}
const STAGE_TINT: Record<TripStatus, string> = {
  dispatched:  'bg-amber-100 text-amber-700',
  en_route:    'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  at_scene:    'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  transporting:'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-slate-100 text-slate-500',
}

function FuelModal({ vehicleId, onClose }: { vehicleId: string; onClose: () => void }) {
  const tr = useTranslations('ambulance')
  const updateVehicle = useAmbulanceStore((s) => s.updateVehicle)
  const vehicle = useAmbulanceStore((s) => s.vehicles.find((v) => v.id === vehicleId))
  const [pct, setPct] = useState(String(vehicle?.fuelLevel ?? 100))

  const submit = () => {
    const n = parseInt(pct)
    if (!vehicle || isNaN(n) || n < 0 || n > 100) return
    updateVehicle(vehicleId, { fuelLevel: n })
    notifyAndAudit({
      to: 'ambulance', type: 'system', priority: 'low',
      title: tr('dispatch.notify.fuelTitle', { vehicle: vehicle.vehicleNumber }),
      body: tr('dispatch.notify.fuelBody', { pct: n, vehicle: vehicle.vehicleNumber }),
      audit: { action: 'finance_invoice_received', resource: 'ambulance_vehicle', resourceId: vehicleId, detail: `Fuel topped to ${n}%`, userName: 'Dispatch' },
    })
    toast.success(tr('dispatch.toast.fuelSaved', { vehicle: vehicle.vehicleNumber, pct: n }))
    onClose()
  }
  if (!vehicle) return null
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{tr('dispatch.fuelModalTitle', { vehicle: vehicle.vehicleNumber })}</h2>
          <button onClick={onClose} aria-label={tr('dispatch.close')} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">{tr('dispatch.newFuelLevel')}</label>
          <input type="number" min={0} max={100} value={pct} onChange={e => setPct(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">{tr('dispatch.cancel')}</button>
          <button onClick={submit} className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">{tr('dispatch.save')}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function AmbulanceDispatch() {
  const tr = useTranslations('ambulance')
  const stageLabel = (s: TripStatus) => tr.has(`status.${s}`) ? tr(`status.${s}`) : s
  const { vehicles, trips, availableVehicles, dispatch, updateTrip } = useAmbulanceStore()
  const available = availableVehicles()
  const activeTrips = trips.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const [form, setForm] = useState({ vehicleId: '', pickup: '', destination: '', complaint: '', caller: '', phone: '' })
  const [fuelFor, setFuelFor] = useState<string | null>(null)

  const handleDispatch = () => {
    if (!form.vehicleId || !form.pickup || !form.destination) { toast.error(tr('dispatch.toast.dispatchRequired')); return }
    const vehicle = available.find(v => v.id === form.vehicleId)
    dispatch(form.vehicleId, { tripType: 'emergency', pickupLocation: form.pickup, destination: form.destination, chiefComplaint: form.complaint, callerName: form.caller, callerPhone: form.phone })
    if (vehicle) {
      // Notify the driver (mock: notify ambulance role with driver name) + ER for the inbound patient.
      notifyAndAuditMany(['ambulance', 'emergency'], {
        type: 'system', priority: 'critical',
        title: tr('dispatch.notify.dispatchTitle', { vehicle: vehicle.vehicleNumber }),
        body: tr('dispatch.notify.dispatchBody', {
          driver: vehicle.driverName,
          pickup: form.pickup,
          destination: form.destination,
          complaint: form.complaint ? ' · ' + form.complaint : '',
          caller: form.caller || tr('dispatch.notify.callerUnknown'),
          phone: form.phone || '',
        }),
        audit: { action: 'ambulance_dispatched', resource: 'ambulance_trip', detail: `${vehicle.vehicleNumber} → ${form.pickup}`, userName: 'Dispatch' },
      })
    }
    toast.success(tr('dispatch.toast.dispatched', { driver: vehicle?.driverName ?? tr('dispatch.toast.driverFallback') }))
    setForm({ vehicleId: '', pickup: '', destination: '', complaint: '', caller: '', phone: '' })
  }

  function advance(tripId: string) {
    const trip = trips.find(t => t.id === tripId)
    if (!trip) return
    const next = NEXT_STAGE[trip.status]
    if (!next) return
    updateTrip(tripId, { status: next, completedAt: next === 'completed' ? new Date().toISOString() : trip.completedAt })
    if (next === 'completed') {
      notifyAndAudit({
        to: 'admin', type: 'system', priority: 'low',
        title: tr('dispatch.notify.tripClosedTitle', { vehicle: trip.vehicleNumber }),
        body: tr('dispatch.notify.tripClosedBody', { vehicle: trip.vehicleNumber, pickup: trip.pickupLocation, destination: trip.destination }),
        audit: { action: 'ambulance_completed', resource: 'ambulance_trip', resourceId: tripId, detail: `Trip closed · vehicle released`, userName: 'Dispatch' },
      })
      toast.success(tr('dispatch.toast.tripClosed', { vehicle: trip.vehicleNumber }))
    } else {
      toast.success(tr('dispatch.toast.stageAdvanced', { vehicle: trip.vehicleNumber, stage: stageLabel(next) }))
    }
  }

  return (
    <div className="space-y-6 pt-6">
      <h2 className="text-2xl font-bold text-slate-900">{tr('dispatch.title')}</h2>

      {/* Active trips with stage advance */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--color-accent)]" /> {tr('dispatch.activeTrips', { count: activeTrips.length })}</h3>
        {activeTrips.length === 0 ? (
          <p className="text-[13px] text-slate-500 bg-slate-50 p-3 rounded-xl">{tr('dispatch.noActiveTrips')}</p>
        ) : (
          <div className="space-y-2">
            {activeTrips.map(t => {
              const next = NEXT_STAGE[t.status]
              const idx = TRIP_STAGES.indexOf(t.status)
              return (
                <div key={t.id} className="rounded-xl bg-slate-50 p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-[13.5px] font-bold text-slate-900">{t.vehicleNumber} · {tr.has(`tripType.${t.tripType}`) ? tr(`tripType.${t.tripType}`) : t.tripType}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STAGE_TINT[t.status]}`}>{stageLabel(t.status)}</span>
                      <span className="text-[10px] text-slate-400">{tr('dispatch.stageProgress', { current: idx + 1, total: TRIP_STAGES.length - 1 })}</span>
                    </div>
                    <p className="text-[11.5px] text-slate-500"><MapPin className="inline h-3 w-3 mr-0.5" /> {t.pickupLocation} → {t.destination}</p>
                    {t.chiefComplaint && <p className="text-[11px] text-slate-500">{t.chiefComplaint}</p>}
                  </div>
                  {next && (
                    <button onClick={() => advance(t.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                      {tr('dispatch.advanceTo', { stage: stageLabel(next) })}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Fleet status with fuel log */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Truck className="h-4 w-4 text-[var(--color-accent)]" /> {tr('dispatch.fleet')}</h3>
        <div className="space-y-2">
          {vehicles.map(v => (
            <div key={v.id} className="rounded-xl bg-slate-50 p-3 flex items-center gap-3 flex-wrap">
              <span className="h-9 w-9 rounded-lg bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center"><Truck className="h-4 w-4" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-slate-900">{v.vehicleNumber} <span className="text-[11px] text-slate-500 font-normal">· {v.type}</span></p>
                <p className="text-[11.5px] text-slate-500"><Phone className="inline h-3 w-3 mr-0.5" /> {v.driverName}{v.paramedicName ? ' + ' + v.paramedicName : ''}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.status === 'available' ? 'bg-green-100 text-green-700' : v.status === 'on_trip' ? 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]' : 'bg-slate-200 text-slate-700'}`}>{tr.has(`status.${v.status}`) ? tr(`status.${v.status}`) : v.status}</span>
              {typeof v.fuelLevel === 'number' && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${v.fuelLevel < 25 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>⛽ {v.fuelLevel}%</span>
              )}
              <button onClick={() => setFuelFor(v.id)} title={tr('dispatch.logFuel')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <Fuel className="h-3 w-3" /> {tr('dispatch.logFuel')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Dispatch form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Send className="h-4 w-4 text-red-500" /> {tr('dispatch.newDispatch')}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{tr('dispatch.selectVehicle')}</label>
            <Select value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              <option value="">{tr('dispatch.chooseVehicle')}</option>
              {available.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.type}) · {v.driverName}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{tr('dispatch.pickupLocation')}</label>
              <input type="text" value={form.pickup} onChange={(e) => setForm((f) => ({ ...f, pickup: e.target.value }))} placeholder={tr('dispatch.pickupPlaceholder')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{tr('dispatch.destination')}</label>
              <input type="text" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder={tr('dispatch.destinationPlaceholder')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{tr('dispatch.chiefComplaint')}</label>
            <input type="text" value={form.complaint} onChange={(e) => setForm((f) => ({ ...f, complaint: e.target.value }))} placeholder={tr('dispatch.complaintPlaceholder')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{tr('dispatch.callerName')}</label>
              <input type="text" value={form.caller} onChange={(e) => setForm((f) => ({ ...f, caller: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{tr('dispatch.callerPhone')}</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
          <button onClick={handleDispatch} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors cursor-pointer">
            <Send className="h-4 w-4" /> {tr('dispatch.dispatchNow')}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {fuelFor && <FuelModal vehicleId={fuelFor} onClose={() => setFuelFor(null)} />}
      </AnimatePresence>
    </div>
  )
}
