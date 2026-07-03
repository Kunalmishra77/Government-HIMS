"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Ambulance, MapPin, Navigation, Phone, Clock, CheckCircle, Map, Siren } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"

type AmbType = 'BLS' | 'ALS'

const HISTORY = [
  { date: '08 Apr 2026', route: 'Home, Indiranagar → Agentix HIMS', type: 'ALS' },
  { date: '15 Feb 2026', route: 'Agentix HIMS → Home, Indiranagar', type: 'BLS' },
]

const ACTIVE_STATUS_TINT = 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]'

export default function AmbulancePage() {
  const t = useTranslations('patient')
  const [pickup, setPickup] = useState('Home, Indiranagar, Bengaluru')
  const [destination, setDestination] = useState('Agentix HIMS, MG Road')
  const [type, setType] = useState<AmbType>('BLS')
  const [active, setActive] = useState(false)

  const status = t('ambulance.statusEnRoute')

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('ambulance.title')}</h1>
        <p className="text-[13px] text-slate-500 mt-1">{t('ambulance.subtitle')}</p>
      </div>

      {/* Request form */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2"><Siren className="h-4.5 w-4.5 text-red-500" /> {t('ambulance.requestHeading')}</h3>

        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-3.5 flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><MapPin className="h-5 w-5" /></span>
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-400">{t('ambulance.pickup')}</label>
              <input value={pickup} onChange={e => setPickup(e.target.value)} className="w-full bg-transparent text-[14px] font-semibold text-slate-900 outline-none" />
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3.5 flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><Navigation className="h-5 w-5" /></span>
            <div className="flex-1">
              <label className="text-[12px] font-semibold text-slate-400">{t('ambulance.destination')}</label>
              <input value={destination} onChange={e => setDestination(e.target.value)} className="w-full bg-transparent text-[14px] font-semibold text-slate-900 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-slate-400 px-1">{t('ambulance.typeLabel')}</label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              {(['BLS', 'ALS'] as AmbType[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setType(opt)}
                  className={cn("rounded-2xl p-3 text-left transition-colors", type === opt ? "bg-[var(--color-primary)] text-white" : "bg-slate-50 text-slate-700")}
                >
                  <p className="text-[14px] font-bold">{opt}</p>
                  <p className={cn("text-[11.5px]", type === opt ? "text-white/80" : "text-slate-500")}>{opt === 'BLS' ? t('ambulance.bls') : t('ambulance.als')}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setActive(true)
            notifyAndAuditMany(['ambulance', 'emergency'], {
              type: 'system', priority: 'critical',
              title: t('ambulance.notifTitle', { type }),
              body: `Patient (Kiran Patil) requested ${type === 'BLS' ? 'Basic Life Support' : 'Advanced Life Support'} ambulance via portal. Dispatch and notify ER.`,
              patientName: 'Kiran Patil',
              audit: { action: 'ambulance_dispatched', resource: 'patient_request', detail: `Patient self-requested ${type} ambulance`, userName: 'Kiran Patil' },
            })
            toast.success(t('ambulance.toastDispatched', { type }))
          }}
          className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold text-[15px] rounded-xl py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-[0_8px_20px_rgba(220,38,38,0.3)] cursor-pointer"
        >
          <Ambulance className="h-5 w-5" /> {t('ambulance.requestNow')}
        </button>
      </div>

      {/* Active trip */}
      {active && (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-bold text-slate-900">{t('ambulance.activeTrip')}</h3>
            <span className={cn("text-[12px] font-bold px-2.5 py-1 rounded-full", ACTIVE_STATUS_TINT)}>{status}</span>
          </div>

          {/* Map placeholder */}
          <div className="relative rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 h-36 flex items-center justify-center overflow-hidden mb-4">
            <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,rgba(148,163,184,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.3)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="relative flex flex-col items-center text-slate-400">
              <Map className="h-7 w-7 mb-1" />
              <span className="text-[12px] font-semibold">{t('ambulance.liveTracking')}</span>
            </div>
            <span className="absolute bottom-3 right-3 h-9 w-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg animate-pulse"><Ambulance className="h-4.5 w-4.5" /></span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <p className="text-[12px] text-slate-400 font-semibold">{t('ambulance.vehicle')}</p>
              <p className="text-[14px] font-bold text-slate-900">KA-01-AB-4521 · {type}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <p className="text-[12px] text-slate-400 font-semibold">{t('ambulance.eta')}</p>
              <p className="text-[14px] font-bold text-slate-900 flex items-center gap-1.5"><Clock className="h-4 w-4 text-[var(--color-accent)]" /> {t('ambulance.etaValue')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 mt-3">
            <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0 font-bold text-[15px]">SK</span>
            <div className="flex-1"><p className="text-[14px] font-semibold text-slate-900">{t('ambulance.driverName')}</p><p className="text-[12.5px] text-slate-500">{t('ambulance.driverRole')}</p></div>
            <a href="tel:+918012345678" className="h-10 w-10 rounded-2xl bg-green-600 text-white flex items-center justify-center active:scale-[0.97] transition-transform"><Phone className="h-4.5 w-4.5" /></a>
          </div>

          <p className="text-[12.5px] text-slate-500 mt-3 px-1">{pickup} → {destination}</p>
        </div>
      )}

      {/* Trip history */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3">{t('ambulance.tripHistory')}</h3>
        <div className="space-y-2">
          {HISTORY.map((trip, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
              <span className="h-10 w-10 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center flex-shrink-0"><Ambulance className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 truncate">{trip.route}</p>
                <p className="text-[12.5px] text-slate-500">{trip.date} · {trip.type}</p>
              </div>
              <span className="text-[12px] font-semibold text-green-600 flex items-center gap-1 flex-shrink-0"><CheckCircle className="h-4 w-4" /> {t('ambulance.statusCompleted')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
