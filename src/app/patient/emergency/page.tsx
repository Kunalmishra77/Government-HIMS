"use client"

import { useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  Siren, Activity, Phone, Clock, MapPin, Stethoscope, ShieldCheck,
  AlertTriangle, ArrowRight, Heart, CheckCircle2, BedDouble, FileText,
} from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { useERStore, latestVitals, getNEWS2, getQSOFA, dispositionLabel, type ERPatient } from "@/store/useERStore"
import { cn } from "@/lib/utils"

const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const minsBetween = (from: string, to: string) => Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))

const AREA_LABEL: Record<string, string> = {
  RESUS: 'Resuscitation', TRAUMA: 'Trauma bay', CRITICAL: 'Critical area',
  ACUTE: 'Acute area', SUBACUTE: 'Sub-acute', FAST_TRACK: 'Fast track', OBS: 'Observation',
}

const ESI_TINT: Record<number, string> = {
  1: 'bg-red-100 text-red-800 ring-red-200',
  2: 'bg-accent-soft text-accent ring-primary/25',
  3: 'bg-amber-100 text-amber-800 ring-amber-200',
  4: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  5: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)] ring-primary/25',
}

function plainNEWS2(band: 'low' | 'medium' | 'high') {
  if (band === 'high') return 'Your readings need urgent attention from a doctor. The team is monitoring closely.'
  if (band === 'medium') return 'Your readings are slightly off and the team is checking you more often than usual.'
  return 'Your readings look stable. The team will keep monitoring as normal.'
}

function VisitCard({ visit, active }: { visit: ERPatient; active: boolean }) {
  const v = latestVitals(visit)
  const news = getNEWS2(visit)
  const q = getQSOFA(visit)
  const totalMins = visit.dispositionAt
    ? minsBetween(visit.arrivedAt, visit.dispositionAt)
    : minsBetween(visit.arrivedAt, new Date().toISOString())

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className={cn(
        "px-5 py-3 border-b flex items-center justify-between flex-wrap gap-2",
        active ? "bg-red-50/40 border-red-100" : "bg-slate-50 border-slate-100",
      )}>
        <div className="flex items-center gap-2">
          {active
            ? <Siren className="h-4 w-4 text-red-600" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span className={cn("text-xs font-bold uppercase tracking-wide",
            active ? "text-red-700" : "text-emerald-700")}>
            {active ? 'Active emergency visit' : 'Past emergency visit'}
          </span>
          {visit.esi && (
            <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded ring-1", ESI_TINT[visit.esi])}>
              ESI {visit.esi}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">Arrived {fmtTime(visit.arrivedAt)} · {totalMins} min visit</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Chief complaint */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Reason for ER visit</p>
          <p className="text-sm font-semibold text-slate-800 mt-1">{visit.chiefComplaint}</p>
          {visit.esiReason && <p className="text-[11px] text-slate-500 mt-0.5">{visit.esiReason}</p>}
        </div>

        {/* Care team + location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <Stethoscope className="h-3 w-3" />Care team
            </p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {visit.assignedTo?.name ?? <span className="italic text-slate-400">Awaiting doctor assignment</span>}
            </p>
            {visit.assignedTo?.id && <p className="text-[11px] text-slate-500">{visit.assignedTo.id}</p>}
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />Location
            </p>
            <p className="text-sm font-bold text-slate-800 mt-1">
              {visit.area ? AREA_LABEL[visit.area] : <span className="italic text-slate-400">Waiting room</span>}
              {visit.bedNumber && <span className="text-slate-500"> · Bed {visit.bedNumber}</span>}
            </p>
          </div>
        </div>

        {/* Latest vitals */}
        {v && (
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                <Heart className="h-3 w-3" />Latest readings
              </p>
              <p className="text-[10px] text-slate-400">{fmtTime(v.at)}{v.by ? ` · ${v.by}` : ''}</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <Vital label="RR" value={v.rr != null ? `${v.rr}` : '—'} unit="/min" />
              <Vital label="SpO₂" value={v.spo2 != null ? `${v.spo2}` : '—'} unit="%" subscript={v.onOxygen ? 'on O₂' : 'room air'} />
              <Vital label="BP" value={v.sbp != null ? `${v.sbp}` : '—'} unit="mmHg" />
              <Vital label="HR" value={v.hr != null ? `${v.hr}` : '—'} unit="/min" />
              <Vital label="Temp" value={v.temp != null ? v.temp.toFixed(1) : '—'} unit="°C" />
              <Vital label="GCS" value={v.gcs != null ? `${v.gcs}` : '—'} unit="/15" />
            </div>
          </div>
        )}

        {/* NEWS2 plain summary */}
        {v && (
          <div className={cn(
            "rounded-xl p-3 border",
            news.band === 'high' ? 'bg-red-50 border-red-200'
            : news.band === 'medium' ? 'bg-amber-50 border-amber-200'
            : 'bg-emerald-50 border-emerald-200',
          )}>
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs font-bold flex items-center gap-1.5">
                {news.band === 'low' ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                <span className={
                  news.band === 'high' ? 'text-red-700'
                  : news.band === 'medium' ? 'text-amber-700' : 'text-emerald-700'
                }>
                  Early-warning score: {news.score}/20 · {news.band.toUpperCase()}
                </span>
              </p>
              {q.positive && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  qSOFA positive
                </span>
              )}
            </div>
            <p className="text-[12px] text-slate-700 mt-1.5">{plainNEWS2(news.band)}</p>
          </div>
        )}

        {/* Disposition (decision made) */}
        {visit.disposition && (
          <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <BedDouble className="h-3 w-3" />Outcome decision
            </p>
            <p className="text-sm font-bold text-slate-800 mt-1">{dispositionLabel(visit.disposition)}</p>
            {visit.dispositionNote && <p className="text-[11px] text-slate-600 mt-0.5">{visit.dispositionNote}</p>}
            {visit.decisionAt && (
              <p className="text-[10px] text-slate-400 mt-1">Decided {fmtTime(visit.decisionAt)}</p>
            )}
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />Visit timeline
          </p>
          <div className="space-y-1.5 text-[12px]">
            <TimelineRow at={visit.arrivedAt} label={`Arrived via ${visit.arrival.replace('_', ' ')}`} />
            {visit.triagedAt && <TimelineRow at={visit.triagedAt} label={`Triaged ESI ${visit.esi ?? '?'}`} />}
            {visit.doctorClaimAt && <TimelineRow at={visit.doctorClaimAt} label={`Care team accepted: ${visit.assignedTo?.name ?? 'doctor'}`} />}
            {visit.decisionAt && <TimelineRow at={visit.decisionAt} label="Outcome decision made" />}
            {visit.dispositionAt && <TimelineRow at={visit.dispositionAt} label="Left emergency department" />}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function Vital({ label, value, unit, subscript }: { label: string; value: string; unit: string; subscript?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-black text-slate-800 mt-0.5">{value} <span className="text-[10px] font-bold text-slate-500">{unit}</span></p>
      {subscript && <p className="text-[9px] text-slate-400 mt-0.5">{subscript}</p>}
    </div>
  )
}

function TimelineRow({ at, label }: { at: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      <span className="text-slate-500 w-32 flex-shrink-0">{fmtTime(at)}</span>
      <span className="text-slate-800 font-semibold">{label}</span>
    </div>
  )
}

export default function PatientEmergencyPage() {
  const currentUser = useAuthStore(s => s.currentUser)
  const patients = useERStore(s => s.patients)

  const isPatient = currentUser?.role === 'patient'

  const myVisits = useMemo(() => {
    if (!isPatient) return []
    const idLower = (currentUser?.id ?? '').toLowerCase()
    const nameLower = (currentUser?.name ?? '').toLowerCase()
    return patients.filter(p =>
      (idLower && p.patientId.toLowerCase() === idLower) ||
      (nameLower && p.name.toLowerCase() === nameLower)
    )
  }, [patients, currentUser, isPatient])

  if (!isPatient) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center max-w-lg mx-auto">
          <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Patient portal only</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in as a patient to view your emergency visits.</p>
        </div>
      </div>
    )
  }

  const active = myVisits.find(v => v.phase !== 'disposed')
  const past = myVisits.filter(v => v.phase === 'disposed')
    .sort((a, b) => new Date(b.dispositionAt ?? b.arrivedAt).getTime() - new Date(a.dispositionAt ?? a.arrivedAt).getTime())

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Siren className="h-6 w-6 text-red-600" />Emergency Visits
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Live status from the ER team · plain-language summary of your care
          </p>
        </div>
        <a
          href="tel:102"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer shadow"
        >
          <Phone className="h-4 w-4" />Call ambulance (102)
        </a>
      </div>

      {/* Active visit */}
      {active && <VisitCard visit={active} active />}

      {/* Past visits */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />Previous ER visits
          </h2>
          {past.map(v => <VisitCard key={v.id} visit={v} active={false} />)}
        </div>
      )}

      {/* Empty state */}
      {!active && past.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Activity className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">No emergency visits on record</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            You don&apos;t have any emergency visits in your record. If you are unwell now and need urgent help,
            call <b className="text-red-700">102</b> or visit our 24×7 ER directly.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Link href="/patient/help" className="text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.12)] px-3 py-2 rounded-xl flex items-center gap-1">
              Help &amp; emergency contacts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
