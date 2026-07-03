"use client"

import { useMemo, useState } from "react"
import {
  ScanLine, Sparkles, Clock, CheckCircle, Beaker, CheckCircle2, AlertTriangle, Image as ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { OrdersServiceBanner } from "@/components/patient/OrdersServiceBanner"
import { useRadiologyStudiesStore, type RadiologyStudy, type StudyStatus } from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"

type Scan = { name: string; note: string; price: number }
const SCANS: Scan[] = [
  { name: 'X-ray',      note: 'Single region · ~10 min', price: 500 },
  { name: 'Ultrasound', note: 'Abdomen / pelvis · ~20 min', price: 1200 },
  { name: 'CT Scan',    note: 'With report · ~30 min', price: 4500 },
  { name: 'MRI',        note: 'With report · ~45 min', price: 8000 },
]

const STATUS_LABEL: Record<StudyStatus, string> = {
  ordered: 'Ordered — awaiting scheduling',
  scheduled: 'Scheduled · waiting for your visit',
  arrived: 'Checked in · being prepared',
  acquiring: 'Scan in progress',
  acquired: 'Scan complete · awaiting reading',
  reading: 'Being reviewed by a radiologist',
  reported: 'Pending verification',
  verified: 'Verified · publishing',
  released: 'Report ready',
  cancelled: 'Cancelled',
}
const STATUS_TINT: Record<StudyStatus, string> = {
  ordered: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-amber-50 text-amber-700',
  arrived: 'bg-amber-50 text-amber-700',
  acquiring: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  acquired: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  reading: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  reported: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  verified: 'bg-emerald-50 text-emerald-700',
  released: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
}

const CRITICAL_RE = /\b(haemorrhage|hemorrhage|bleed|pneumothorax|tamponade|stroke|infarct|free air|pe\b|pulmonary embolism|bi-?rads (4|5|6)|lung-?rads (4|4a|4b|4x)|pi-?rads (4|5))\b/i

function plainSummary(study: RadiologyStudy): string {
  const impression = study.reportSections.impression?.trim() ?? ''
  if (!impression) return 'Report ready — your doctor will discuss the findings.'
  if (CRITICAL_RE.test(impression)) {
    return `${impression} Your doctor will discuss next steps urgently.`
  }
  return `Plain-language summary: ${impression}`
}

const dateOf = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export default function RadiologyPage() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const currentUser = useAuthStore(s => s.currentUser)
  const isPatient = currentUser?.role === 'patient'
  const id = isPatient ? currentUser.id : ''
  const name = isPatient ? currentUser.name : ''

  const myStudies = useMemo(
    () => studies.filter(s => s.patientId === id || s.patientName === name),
    [studies, id, name]
  )

  const released = myStudies.filter(s => s.status === 'released')
  const inProgress = myStudies.filter(s => s.status !== 'released' && s.status !== 'cancelled')

  const [booked, setBooked] = useState<Record<string, boolean>>({})

  if (!isPatient) {
    return (
      <div className="max-w-4xl mx-auto pb-10 space-y-5">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Radiology</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your scans and imaging reports, with plain-language explanations</p>
        </div>
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-6 text-center">
          <ScanLine className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-bold text-amber-900">Patient view only</p>
          <p className="text-xs text-amber-700 mt-1">Radiology reports are personal to each patient. Switch to your patient portal to see your records.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Radiology</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your scans and imaging reports, with plain-language explanations</p>
      </div>

      <OrdersServiceBanner filter={i => i.kind === 'test' && i.dept === 'Radiology'} paidLabel="Booked — awaiting scan" />

      {/* Reports ready (live) */}
      {released.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold text-slate-900 px-1">Reports ready</h3>
          {released.map(study => {
            const impression = study.reportSections.impression?.trim() ?? ''
            const hasCritical = CRITICAL_RE.test(impression) ||
              CRITICAL_RE.test(study.reportSections.findings ?? '')
            return (
              <div key={study.id} className={cn(
                'rounded-3xl bg-white p-5 space-y-3',
                hasCritical ? 'ring-2 ring-red-200'
                  : 'shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)]'
              )}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className={cn('h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0',
                      hasCritical ? 'bg-red-50' : 'bg-[rgba(238,107,38,0.07)]')}>
                      <ScanLine className={cn('h-5 w-5', hasCritical ? 'text-red-600' : 'text-[var(--color-accent)]')} />
                    </span>
                    <div>
                      <p className="text-[16px] font-bold text-slate-900">{study.name}</p>
                      <p className="text-[12px] text-slate-500">Ordered by {study.doctorName} · {dateOf(study.releasedAt ?? study.orderedAt)}</p>
                    </div>
                  </div>
                  {hasCritical
                    ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1 flex-shrink-0">
                        <AlertTriangle className="h-3 w-3" />Doctor will call you
                      </span>
                    : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 flex-shrink-0">Verified</span>}
                </div>

                {/* Impression */}
                {impression && (
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Impression</p>
                    <p className="text-[13px] text-slate-800">{impression}</p>
                  </div>
                )}

                {/* Image thumbnails */}
                {study.attachments.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-[11px] font-semibold text-slate-500">Images: {study.attachments.length}</p>
                  </div>
                )}

                {/* Plain-language AI summary */}
                <div className={cn('rounded-2xl p-3 flex items-start gap-2.5',
                  hasCritical ? 'bg-red-50 border border-red-100' : 'bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)]')}>
                  <Sparkles className={cn('h-4 w-4 flex-shrink-0 mt-0.5', hasCritical ? 'text-red-600' : 'text-[var(--color-accent)]')} />
                  <div className="min-w-0">
                    <p className={cn('text-[11px] font-bold', hasCritical ? 'text-red-900' : 'text-[var(--color-primary-dark)]')}>What this means · AI explanation (not a diagnosis)</p>
                    <p className={cn('text-[13px] mt-0.5', hasCritical ? 'text-red-800' : 'text-[var(--color-primary-dark)]')}>{plainSummary(study)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* In progress (live) */}
      {inProgress.length > 0 && (
        <div>
          <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">In progress</h3>
          <div className="space-y-2">
            {inProgress.map(study => (
              <div key={study.id} className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="h-9 w-9 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Beaker className="h-4.5 w-4.5 text-amber-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-slate-900">{study.name}</p>
                    <p className="text-[12px] text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />ordered {dateOf(study.orderedAt)}</p>
                  </div>
                </div>
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0', STATUS_TINT[study.status])}>{STATUS_LABEL[study.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No radiology orders yet */}
      {myStudies.length === 0 && (
        <div className="rounded-2xl bg-slate-50 p-6 text-center">
          <ScanLine className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No scans on file yet</p>
          <p className="text-xs text-slate-500 mt-1">Scans your doctor orders will appear here automatically.</p>
        </div>
      )}

      {/* Book a scan */}
      <div>
        <h3 className="text-[15px] font-bold text-slate-900 px-1 mb-3">Book a scan</h3>
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 space-y-2">
          {SCANS.map(scan => {
            const isBooked = booked[scan.name]
            return (
              <div key={scan.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50">
                <div>
                  <p className="text-[14px] font-semibold text-slate-800">{scan.name}</p>
                  <p className="text-[12px] text-slate-500">{scan.note} · <span className="font-semibold text-slate-700">₹{scan.price}</span></p>
                </div>
                <button
                  onClick={() => { setBooked(b => ({ ...b, [scan.name]: true })); toast.success(`${scan.name} booked`) }}
                  disabled={isBooked}
                  className={cn(
                    'text-[13px] font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform flex-shrink-0',
                    isBooked ? 'bg-green-50 text-green-700 cursor-default' : 'bg-[var(--color-primary)] text-white',
                  )}
                >
                  {isBooked ? <><CheckCircle2 className="h-4 w-4" /> Booked</> : 'Book'}
                </button>
              </div>
            )
          })}
        </div>
        <p className="text-[12.5px] text-slate-500 flex items-center gap-1.5 mt-3 px-1">
          <CheckCircle className="h-4 w-4 text-slate-400" />Walk-in available; home contrast not provided.
        </p>
      </div>
    </div>
  )
}
