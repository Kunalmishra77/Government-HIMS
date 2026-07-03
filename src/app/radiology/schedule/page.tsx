"use client"

import { Select } from "@/components/ui/Select"
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar, ScanLine, AlertTriangle, ShieldCheck, ChevronRight, X,
  CheckCircle2, Clock, Sparkles, Activity,
} from "lucide-react"
import {
  useRadiologyStudiesStore, type RadiologyStudy, type RadSource,
} from "@/store/useRadiologyStudiesStore"
import { useAuthStore } from "@/store/useAuthStore"
import { RADIOLOGY_CATALOG, type Modality, type Priority } from "@/lib/radiologyCatalog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { predictNoShow, predictScanDuration } from "@/lib/radiologyAI"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { NeonBadge } from "@/components/ui/neon-badge"
import { CompactKPI, CompactKPIStrip } from "@/components/ui/CompactKPI"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// Priority → triple-encoded clinical status (inline, not a colour map).
const priorityStatus = (p: Priority): Status =>
  p === "STAT" || p === "Critical" || p === "Stroke" || p === "Trauma" ? "critical"
    : p === "Urgent" ? "urgent" : "neutral"
// Source → neutral metadata chip; ICU/ER read as higher-acuity origins.
const sourceVariant = (s: RadSource) => s === "ICU" ? "danger" : s === "ER" ? "warning" : "muted"
const PRIORITY_RANK: Record<Priority, number> = { Critical: -3, Stroke: -2, Trauma: -1, STAT: 0, Urgent: 1, Routine: 2 }

const minsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)

// Slot generator — next available slots over the next 4 hours in 15-min steps.
function makeSlots(): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = []
  const start = new Date()
  // Round up to the next 15-min mark.
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15)
  start.setSeconds(0); start.setMilliseconds(0)
  for (let i = 0; i < 16; i++) {
    const d = new Date(start.getTime() + i * 15 * 60000)
    out.push({
      iso: d.toISOString(),
      label: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    })
  }
  return out
}

export default function RadiologySchedulePage() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const schedule = useRadiologyStudiesStore(s => s.schedule)
  const setContrastConsented = useRadiologyStudiesStore(s => s.setContrastConsented)
  const currentUser = useAuthStore(s => s.currentUser)
  const meName = currentUser?.name ?? 'Radiology Scheduler'

  const [modalityFilter, setModalityFilter] = useState<'all' | Modality>('all')
  const [bookingStudy, setBookingStudy] = useState<RadiologyStudy | null>(null)
  const [slotIso, setSlotIso] = useState<string>('')
  const [consentTicked, setConsentTicked] = useState(false)
  const [prepConfirmed, setPrepConfirmed] = useState(false)

  const slots = useMemo(() => makeSlots(), [])

  const ordered = useMemo(() => {
    return studies.filter(s => s.status === 'ordered')
      .filter(s => modalityFilter === 'all' || s.modality === modalityFilter)
      .sort((a, b) => {
        const ap = PRIORITY_RANK[a.priority]; const bp = PRIORITY_RANK[b.priority]
        if (ap !== bp) return ap - bp
        return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
      })
  }, [studies, modalityFilter])

  const byModality = useMemo(() => {
    const m: Record<Modality, number> = { XR: 0, CT: 0, MRI: 0, US: 0, MAMMO: 0, NM: 0 }
    for (const s of studies) if (s.status === 'ordered') m[s.modality]++
    return m
  }, [studies])

  const openBooking = (s: RadiologyStudy) => {
    setBookingStudy(s)
    setSlotIso(slots[0]?.iso ?? '')
    setConsentTicked(false)
    setPrepConfirmed(false)
  }

  const cat = bookingStudy ? RADIOLOGY_CATALOG[bookingStudy.code] : undefined
  const needsContrast = cat?.contrast ?? false
  const prepText = cat?.preparation
  const canBook = !!bookingStudy && !!slotIso && (!needsContrast || consentTicked) && (!prepText || prepConfirmed)

  const confirm = () => {
    if (!bookingStudy || !slotIso) return
    schedule(bookingStudy.id, slotIso)
    if (needsContrast && consentTicked) {
      setContrastConsented(bookingStudy.id, true)
    }
    const when = new Date(slotIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    notifyAndAudit({
      to: 'patient', type: 'system', priority: 'medium',
      title: `${bookingStudy.modality} ${bookingStudy.name} booked · ${when}`,
      body: `Your ${bookingStudy.modality} ${bookingStudy.name} is scheduled at ${when}. ${prepText ? `Preparation: ${prepText}` : ''} Please arrive 10 minutes before.`,
      patientName: bookingStudy.patientName,
      audit: { action: 'radiology_order', resource: 'radiology_study', resourceId: bookingStudy.id, detail: `Scheduled for ${when}${needsContrast ? ' · contrast consent obtained' : ''}`, userName: meName },
    })
    toast.success(`${bookingStudy.patientName} scheduled · ${when}${needsContrast && consentTicked ? ' · contrast consented' : ''}`)
    setBookingStudy(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="t-body text-foreground-lighter max-w-2xl">
          Assign slots · prep instructions · contrast consent · the patient becomes &quot;scheduled&quot; and shows on arrival desk
        </p>
        <Select value={modalityFilter} onChange={e => setModalityFilter(e.target.value as 'all' | Modality)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/15">
          <option value="all">All modalities</option>
          {(['XR', 'CT', 'MRI', 'US', 'MAMMO'] as Modality[]).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
      </div>

      {/* Modality KPIs */}
      <CompactKPIStrip className="gap-2">
        {(['XR', 'CT', 'MRI', 'US', 'MAMMO'] as Modality[]).map(m => (
          <CompactKPI key={m} label={`${m} ordered`} value={byModality[m]} tone="info" />
        ))}
      </CompactKPIStrip>

      <div>
        <h2 className="text-sm font-bold text-foreground-muted mb-2">Awaiting scheduling ({ordered.length})</h2>
        {ordered.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="All orders booked" description="Every new order is assigned to a slot." size="sm" />
        ) : (
          <ul className="space-y-2">
            {ordered.map(s => {
              const c = RADIOLOGY_CATALOG[s.code]
              const orderedMins = minsAgo(s.orderedAt)
              return (
                <li key={s.id} className="u-row rounded-xl bg-surface border border-border p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-foreground">{s.patientName}</p>
                        <span className="text-[11px] font-bold text-foreground-placeholder">{s.patientId}</span>
                        <NeonBadge variant={sourceVariant(s.source)}>{s.source}</NeonBadge>
                        {s.wardBed && <span className="text-[11px] text-foreground-lighter">· {s.wardBed}</span>}
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-accent-soft text-accent">{s.modality}</span>
                        <StatusPill status={priorityStatus(s.priority)} label={s.priority} dense />
                        {(() => { const ns = Math.round(predictNoShow(s).data.risk * 100); return ns >= 35 ? <NeonBadge variant="warning">No-show {ns}%</NeonBadge> : null })()}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-accent border border-primary/20">AI ~{predictScanDuration(s)}m</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground-muted mt-1">{s.name}</p>
                      <p className="text-xs text-foreground-lighter mt-0.5">
                        Ordering: {s.doctorName} · ordered {orderedMins}m ago · TAT {s.expectedTATmin}m
                      </p>
                      {s.clinicalQuestion && (
                        <p className="text-xs text-foreground-lighter mt-1.5 italic">&quot;{s.clinicalQuestion}&quot;</p>
                      )}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {c?.contrast && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-warning-bg text-brand-amber-strong flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />Contrast required
                          </span>
                        )}
                        {c?.preparation && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent-soft text-accent">
                            Prep: {c.preparation.length > 40 ? c.preparation.slice(0, 40) + '…' : c.preparation}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => openBooking(s)}
                      className="u-press flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark shadow-xs cursor-pointer transition-colors">
                      <Calendar className="h-3.5 w-3.5" />Book slot
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="bg-accent-soft border border-primary/20 rounded-xl p-4">
        <p className="text-xs font-bold text-primary-dark flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />After scheduling
        </p>
        <p className="text-[11px] text-accent mt-1">
          The patient is notified with the slot + prep. At the slot time, the arrival desk (`/radiology/arrival`)
          marks them checked-in, then the tech claims the study on the bench.
        </p>
      </div>

      {/* Booking modal */}
      <AnimatePresence>
        {bookingStudy && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setBookingStudy(null)}>
            <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 6 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="text-base font-bold text-foreground">Book slot · {bookingStudy.patientName}</h2>
                  <p className="text-xs text-foreground-lighter">{bookingStudy.modality} {bookingStudy.name}</p>
                </div>
                <button onClick={() => setBookingStudy(null)} className="p-1.5 rounded-lg hover:bg-surface-sunken cursor-pointer">
                  <X className="h-4 w-4 text-foreground-lighter" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div>
                  <p className="t-overline text-foreground-lighter mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />Slot
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
                    {slots.map(s => (
                      <button key={s.iso} type="button" onClick={() => setSlotIso(s.iso)}
                        className={cn("u-press py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border",
                          slotIso === s.iso ? 'bg-primary text-[#0D2032] border-primary' : 'bg-surface border-border text-foreground-muted hover:bg-surface-sunken')}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {prepText && (
                  <div className="rounded-lg border border-primary/20 bg-accent-soft p-3">
                    <p className="text-[11px] font-bold text-accent mb-1.5 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />Preparation instructions
                    </p>
                    <p className="text-xs text-foreground-muted">{prepText}</p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={prepConfirmed} onChange={e => setPrepConfirmed(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-primary cursor-pointer" />
                      <span className="text-[11px] font-bold text-accent">Prep counselled to patient</span>
                    </label>
                  </div>
                )}

                {needsContrast && (
                  <div className="rounded-lg border border-warning/30 bg-warning-bg p-3">
                    <p className="text-[11px] font-bold text-brand-amber-strong mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />Contrast consent required
                    </p>
                    <p className="text-xs text-foreground-muted">
                      IV contrast required for this study. Confirm screening (renal function, prior reactions, asthma) and capture written consent before scan.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={consentTicked} onChange={e => setConsentTicked(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-warning focus:ring-warning cursor-pointer" />
                      <span className="text-[11px] font-bold text-brand-amber-strong">Contrast consent obtained</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex gap-2 px-5 py-4 border-t border-border">
                <button onClick={() => setBookingStudy(null)}
                  className="u-press flex-1 h-10 rounded-xl border border-border text-sm font-bold text-foreground-lighter hover:bg-surface-sunken cursor-pointer transition-colors">
                  Cancel
                </button>
                <button onClick={confirm} disabled={!canBook}
                  className="u-press flex-1 h-10 rounded-xl bg-primary hover:bg-primary-dark text-[#0D2032] hover:text-[#0D2032] text-sm font-bold cursor-pointer disabled:opacity-50 transition-colors">
                  Confirm booking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
