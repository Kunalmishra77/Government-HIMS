"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { Bed, Clock, AlertCircle, CheckCircle2, X, ChevronRight, Sparkles, FileText, FlaskConical, ScanLine, Pill, ShieldAlert, Info, UserCheck, BedDouble, Hourglass, Activity, Wrench, ArrowRight } from "lucide-react"
import { useAdmissionStore, type AdmissionRequest } from "@/store/useAdmissionStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { deriveUhid } from "@/lib/uhid"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { OnShiftTeam } from "@/components/clinical/OnShiftTeam"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { BedFreeingForecast } from "@/components/admission/BedFreeingForecast"
import { BedHoverCard } from "@/components/admission/BedHoverCard"

const TRIAGE_COLORS: Record<string, string> = {
  Critical: "bg-red-50 border-red-200 text-red-700",
  High: "bg-primary-soft border-primary/20 text-accent",
  Medium: "bg-yellow-50 border-yellow-200 text-yellow-700",
  Low: "bg-green-50 border-green-200 text-green-700",
}

function BundlePanel({ req }: { req: AdmissionRequest }) {
  const t = useTranslations('admission')
  const b = req.bundle
  if (!b) return (
    <div className="p-4 text-center text-xs text-slate-400 font-medium">{t('bundle.noDocuments')}</div>
  )
  const urgencyColor: Record<string, string> = { Emergency: 'bg-red-100 text-red-700 border-red-200', Urgent: 'bg-accent-soft text-accent border-primary/20', Routine: 'bg-green-100 text-green-700 border-green-200' }
  return (
    <div className="p-4 space-y-4">
      {/* Urgency + header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {t('bundle.admissionBundle')}</p>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", urgencyColor[b.urgency] ?? urgencyColor.Routine)}>{b.urgency}</span>
      </div>

      {/* Allergies / Comorbidities */}
      {(b.allergies || b.comorbidities) && (
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          {b.allergies && (
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-800"><span className="font-bold">{t('bundle.allergies')}</span> {b.allergies}</p>
            </div>
          )}
          {b.comorbidities && (
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs font-semibold text-accent"><span className="font-bold">{t('bundle.comorbidities')}</span> {b.comorbidities}</p>
            </div>
          )}
        </div>
      )}

      {/* Special instructions */}
      {b.specialInstructions && (
        <div className="rounded-xl p-3" style={{ background: '#F6F9FC', border: '1px solid #E3E8EE' }}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] mb-1">{t('bundle.specialInstructions')}</p>
          <p className="text-xs text-[var(--color-primary-dark)] font-medium">{b.specialInstructions}</p>
        </div>
      )}

      {/* Prescriptions */}
      {b.prescriptions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1"><Pill className="h-3 w-3" /> {t('bundle.prescriptions', { count: b.prescriptions.length })}</p>
          <div className="space-y-1.5">
            {b.prescriptions.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(238,107,38,0.06)', border: '1px solid #EEF2F7' }}>
                <div className="h-1.5 w-1.5 rounded-full bg-[rgba(238,107,38,0.07)]0 flex-shrink-0" />
                <span className="text-xs font-semibold text-[var(--color-primary-dark)]">{p.medicine}</span>
                <span className="text-[10px] text-[var(--color-accent)] ml-auto">{p.dosage} · {p.duration}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lab Orders */}
      {b.labOrders.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1"><FlaskConical className="h-3 w-3" /> {t('bundle.labOrders', { count: b.labOrders.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {b.labOrders.map((o, i) => (
              <span key={i} className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border", o.priority === 'Urgent' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                {o.testName} <span className="opacity-70">· {o.priority}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Radiology Orders */}
      {b.radiologyOrders.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1"><ScanLine className="h-3 w-3" /> {t('bundle.radiology', { count: b.radiologyOrders.length })}</p>
          <div className="flex flex-wrap gap-1.5">
            {b.radiologyOrders.map((o, i) => (
              <span key={i} className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border", o.priority === 'Urgent' ? 'bg-primary-soft text-accent border-primary/20' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                {o.scanType} — {o.bodyPart} <span className="opacity-70">· {o.priority}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdmissionDashboard() {
  const t = useTranslations('admission')
  const { admissionRequests, beds, assignBed, markAdmitted, cancelRequest } = useAdmissionStore()
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null)
  const [bundleViewId, setBundleViewId] = useState<string | null>(null)

  const pending = admissionRequests.filter(r => r.status === 'Pending')
  const assigned = admissionRequests.filter(r => r.status === 'Assigned')
  const availableBeds = beds.filter(b => b.status === 'Available')
  const occupiedBeds = beds.filter(b => b.status === 'Occupied')
  const cleaningBeds = beds.filter(b => b.status === 'Cleaning')

  const selectedReq = admissionRequests.find(r => r.id === selectedRequest)
  const matchingBeds = selectedReq
    ? availableBeds.filter(b =>
        b.ward.toLowerCase().includes(selectedReq.admissionType.toLowerCase()) ||
        selectedReq.admissionType === 'General Ward' && b.ward === 'General Ward'
      )
    : []

  // Pipeline cards for in-page stages scroll to the relevant section rather
  // than navigating to the current route (which was a no-op). Falls back
  // through the list so a conditionally-rendered section degrades gracefully.
  const scrollToFirst = (ids: string[]) => {
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    }
  }

  const handleAssign = (bedId: string) => {
    if (!selectedRequest) return
    const req = admissionRequests.find(r => r.id === selectedRequest)
    const bed = beds.find(b => b.id === bedId)
    assignBed(selectedRequest, bedId)
    if (req && bed) {
      notifyAndAudit({
        to: 'nurse', type: 'bed_allocated', priority: 'high',
        title: t('dashboard.newAdmissionTitle', { bedNumber: bed.bedNumber }),
        body: t('dashboard.newAdmissionBody', { patient: req.patientName, ward: bed.ward, bedNumber: bed.bedNumber }),
        patientName: req.patientName,
        audit: { action: 'admission_admit', resource: 'admission', resourceId: req.id, detail: `Bed ${bed.bedNumber} (${bed.ward}) allocated to ${req.patientName}`, userName: 'Bed Manager' },
      })
    }
    toast.success(t('dashboard.bedAssigned'))
    setSelectedRequest(null)
  }

  const elapsed = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    return mins < 60 ? t('time.minsAgo', { mins }) : t('time.hoursMinsAgo', { hours: Math.floor(mins / 60), mins: mins % 60 })
  }

  // M13.5 — pipeline strip counts. Reservations / cleaning beds frame
  // the "incoming capacity" half of the bed-manager's mental model;
  // admission pipeline (pending/assigned/admitted today) frames the demand half.
  const assignedReqs = admissionRequests.filter(r => r.status === 'Assigned').length
  const admittedTodayCount = admissionRequests.filter(r => {
    if (r.status !== 'Admitted') return false
    return true   // approximate — could be tightened with a timestamp if needed
  }).length

  return (
    <div className="space-y-6">
      {/* M13.5 — Admission pipeline strip.
          Six chevron-linked stages mirroring the demand → supply cycle:
          Pending request → Assigned → Admitted → Occupied → Cleaning → Available. */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-[var(--color-accent)]" />{t('pipeline.heading')}
          </h2>
          <p className="text-[11px] text-slate-500">
            {t('pipeline.flow')}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-stretch">
          {([
            { key: 'pending',   label: t('pipeline.pending'),   sub: t('pipeline.pendingSub'),     count: pending.length,        color: 'border-primary/20 bg-primary-soft',   icon: Hourglass,    fg: 'text-accent',   scrollTo: ['admission-requests'],                  cta: t('pipeline.pendingCta') },
            { key: 'assigned',  label: t('pipeline.assigned'),  sub: t('pipeline.assignedSub'), count: assignedReqs,          color: 'border-amber-200 bg-amber-50',     icon: UserCheck,    fg: 'text-amber-700',    scrollTo: ['assigned-awaiting', 'admission-requests'], cta: t('pipeline.assignedCta') },
            { key: 'admitted',  label: t('pipeline.admitted'),  sub: t('pipeline.admittedSub'),            count: admittedTodayCount,    color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',       icon: CheckCircle2, fg: 'text-[var(--color-accent)]',     scrollTo: ['bed-board'],                           cta: t('pipeline.admittedCta') },
            { key: 'occupied',  label: t('pipeline.occupied'),  sub: t('pipeline.occupiedSub'),         count: occupiedBeds.length,   color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',   icon: Bed,          fg: 'text-[var(--color-accent)]',   href: '/admission/beds',      cta: t('pipeline.occupiedCta') },
            { key: 'cleaning',  label: t('pipeline.cleaning'),  sub: t('pipeline.cleaningSub'),     count: cleaningBeds.length,   color: 'border-yellow-200 bg-yellow-50',   icon: Wrench,       fg: 'text-yellow-700',   href: '/admission/beds',      cta: t('pipeline.cleaningCta') },
            { key: 'available', label: t('pipeline.available'), sub: t('pipeline.availableSub'),        count: availableBeds.length,  color: 'border-emerald-200 bg-emerald-50', icon: Activity,     fg: 'text-emerald-700',  href: '/admission/beds',      cta: t('pipeline.availableCta') },
          ] as const).map((s, i, arr) => {
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <s.icon className={cn("h-4 w-4 flex-shrink-0", s.fg)} />
                    <p className={cn("text-xs font-bold truncate", s.fg)}>{s.label}</p>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 hidden lg:block" />}
                </div>
                <p className={cn("text-2xl font-bold leading-none", s.fg)}>{s.count}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
                <p className={cn("text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 group-hover:underline", s.fg)}>
                  {s.cta} <ArrowRight className="h-2.5 w-2.5" />
                </p>
              </>
            )
            const cardCls = cn("relative rounded-xl border p-3 hover:shadow-md transition flex flex-col gap-1 cursor-pointer group text-left w-full", s.color)
            return 'href' in s
              ? <Link key={s.key} href={s.href} className={cardCls}>{inner}</Link>
              : <button key={s.key} type="button" onClick={() => scrollToFirst([...s.scrollTo])} className={cardCls}>{inner}</button>
          })}
        </div>
      </div>

      {/* M13.5 — AI bed-freeing forecast — short-term (next 24h) per-ward
          prediction so the bed manager can see incoming supply before drilling
          into the pending requests below. */}
      <BedFreeingForecast />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { key: "pendingAdmissions", label: t('stats.pendingAdmissions'), value: pending.length, color: "text-accent", bg: "bg-primary-soft", border: "border-primary/20" },
          { key: "availableBeds", label: t('stats.availableBeds'), value: availableBeds.length, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
          { key: "bedsBeingCleaned", label: t('stats.bedsBeingCleaned'), value: cleaningBeds.length, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
          { key: "occupiedBeds", label: t('stats.occupiedBeds'), value: occupiedBeds.length, color: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)]", border: "border-[rgba(238,107,38,0.20)]" },
        ].map(({ key, label, value, color, bg, border }) => (
          <div key={key} className={cn("rounded-xl border p-5", bg, border)}>
            <p className={cn("text-3xl font-bold", color)}>{value}</p>
            <p className="text-sm font-semibold text-slate-600 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Pending Requests */}
        <div id="admission-requests" className="bg-white border shadow-sm rounded-xl overflow-hidden scroll-mt-6">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.admissionRequests')}</h2>
            {pending.length > 0 && <NeonBadge variant="warning" dot pulse>{t('dashboard.pendingBadge', { count: pending.length })}</NeonBadge>}
          </div>

          <div className="divide-y divide-slate-100">
            <AnimatePresence>
              {pending.map((req, i) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn(
                    "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
                    selectedRequest === req.id && "bg-[rgba(238,107,38,0.07)] ring-inset ring-1 ring-primary/25"
                  )}
                  onClick={() => setSelectedRequest(selectedRequest === req.id ? null : req.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900">{req.patientName}</p>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">{deriveUhid(req.patientId)}</span>
                        <span className="text-xs text-slate-400">{t('dashboard.ageGender', { age: req.patientAge, gender: req.patientGender })}</span>
                        {req.triageLevel && (
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", TRIAGE_COLORS[req.triageLevel] || TRIAGE_COLORS.Low)}>
                            {req.triageLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 font-medium mb-1">{req.diagnosis}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{req.admissionType}</span>
                        <span className="flex items-center gap-1" suppressHydrationWarning><Clock className="h-3 w-3" />{elapsed(req.requestedAt)}</span>
                        <span>{req.payerType}</span>
                        {(req.payerType?.includes('AB-PMJAY') || req.payerType?.includes('PMJAY') || req.payerType?.includes('CMHIS')) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-accent border border-primary/20">
                            {t('dashboard.ayushman')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.bundle && (
                        <button
                          onClick={e => { e.stopPropagation(); setBundleViewId(bundleViewId === req.id ? null : req.id) }}
                          className="p-1.5 rounded-lg text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] transition-colors cursor-pointer"
                          title={t('dashboard.viewBundle')}
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      <Button size="sm" variant={selectedRequest === req.id ? "primary" : "secondary"}>
                        {selectedRequest === req.id ? t('dashboard.selectingBed') : t('dashboard.assignBed')}
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                      <button onClick={(e) => { e.stopPropagation(); cancelRequest(req.id); toast.info(t('dashboard.requestCancelled')) }} className="p-1.5 text-slate-400 hover:text-red-500 rounded cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Admission bundle expandable panel */}
                  <AnimatePresence>
                    {bundleViewId === req.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-[rgba(238,107,38,0.15)]"
                        style={{ background: '#FAFAFE' }}
                      >
                        <BundlePanel req={req} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>

            {pending.length === 0 && (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">{t('dashboard.noPendingRequests')}</p>
              </div>
            )}
          </div>

          {assigned.length > 0 && (
            <div id="assigned-awaiting" className="p-4 border-t border-slate-100 bg-green-50 scroll-mt-6">
              <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{t('dashboard.assignedAwaiting', { count: assigned.length })}</p>
              {assigned.map(req => (
                <div key={req.id} className="flex items-center justify-between py-1.5 border-b border-green-100 last:border-0">
                  <span className="text-xs text-green-800 font-medium">{t('dashboard.toBed', { patient: req.patientName, bedNumber: beds.find(b => b.id === req.assignedBedId)?.bedNumber ?? '—' })}</span>
                  <button
                    onClick={() => {
                      markAdmitted(req.id)
                      notifyAndAudit({
                        to: 'doctor', type: 'system', priority: 'high',
                        title: t('dashboard.patientArrivedTitle', { patient: req.patientName }),
                        body: t('dashboard.patientArrivedBody', { patient: req.patientName, diagnosis: req.diagnosis }),
                        patientName: req.patientName,
                        audit: { action: 'admission_admit', resource: 'admission', resourceId: req.id, detail: `Patient ${req.patientName} marked as Admitted`, userName: 'Bed Manager' },
                      })
                      toast.success(t('dashboard.markedAdmitted', { patient: req.patientName }))
                    }}
                    className="flex items-center gap-1 text-[10px] font-bold text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <UserCheck className="h-3 w-3" /> {t('dashboard.markArrived')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bed Selection */}
        <div id="bed-board" className="bg-white border shadow-sm rounded-xl overflow-hidden scroll-mt-6">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {selectedReq ? t('dashboard.assignBedFor', { patient: selectedReq.patientName }) : t('dashboard.bedBoard')}
            </h2>
            <Link href="/admission/beds">
              <Button size="sm" variant="secondary">{t('dashboard.fullBoard')}</Button>
            </Link>
          </div>

          {selectedReq ? (
            <div className="p-4 space-y-3">
              {/* AI recommendation banner */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)]">
                <Sparkles className="h-4 w-4 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[var(--color-primary-dark)]">{t('dashboard.aiBedRecommendation')}</p>
                  <p className="text-xs text-[var(--color-accent)] mt-0.5">
                    {matchingBeds.length > 0
                      ? t('dashboard.bestMatch', { bedNumber: matchingBeds[0].bedNumber, ward: matchingBeds[0].ward, floor: matchingBeds[0].floor })
                      : t('dashboard.noExactMatch', { type: selectedReq.admissionType })}
                  </p>
                </div>
              </div>

              {/* M4.3 — Live team for the target ward */}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <OnShiftTeam
                  department={selectedReq.admissionType}
                  date={new Date().toISOString().split('T')[0]!}
                  shift={(() => {
                    const h = new Date().getHours()
                    if (h >= 6 && h < 14) return 'Morning'
                    if (h >= 14 && h < 22) return 'Evening'
                    return 'Night'
                  })()}
                  title={t('dashboard.teamOn', { ward: selectedReq.admissionType })}
                  emptyMessage={t('dashboard.noTeamRostered', { ward: selectedReq.admissionType })}
                  roles={['doctor', 'nurse']}
                  compact
                />
              </div>

              {matchingBeds.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">{t('dashboard.noMatchingBeds')}</p>
              )}

              {(matchingBeds.length > 0 ? matchingBeds : availableBeds).map(bed => (
                <motion.button
                  key={bed.id}
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  onClick={() => handleAssign(bed.id)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-green-50 border border-green-200 hover:border-green-400 hover:bg-green-100 transition-all cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-600 text-white flex items-center justify-center text-sm font-bold">
                      {bed.bedNumber}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{t.has(`wards.${bed.ward}`) ? t(`wards.${bed.ward}`) : bed.ward}</p>
                      <p className="text-xs text-slate-500">{t('dashboard.bedFloorGender', { floor: bed.floor ?? "", gender: bed.gender ?? "" })}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg border border-green-200">{t('dashboard.assignArrow')}</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-slate-500 mb-4 text-center">{t('dashboard.selectRequestHint')}</p>
              <div className="space-y-2">
                {['Available', 'Occupied', 'Cleaning', 'Reserved', 'Maintenance'].map(status => {
                  const count = beds.filter(b => b.status === status).length
                  const colors: Record<string, string> = {
                    Available: 'bg-green-100 text-green-700 border-green-200',
                    Occupied: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
                    Cleaning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                    Reserved: 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
                    Maintenance: 'bg-red-100 text-red-700 border-red-200',
                  }
                  return (
                    <div key={status} className={cn("flex items-center justify-between p-3 rounded-xl border", colors[status])}>
                      <span className="text-sm font-semibold">{t.has(`bedStatus.${status}`) ? t(`bedStatus.${status}`) : status}</span>
                      <span className="text-xl font-bold">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alert: Beds awaiting admission for too long */}
      {pending.some(r => Date.now() - new Date(r.requestedAt).getTime() > 30 * 60000) && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-900">{t('dashboard.delayAlertTitle')}</p>
            <p className="text-xs text-red-700 mt-0.5">{t('dashboard.delayAlertBody')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
