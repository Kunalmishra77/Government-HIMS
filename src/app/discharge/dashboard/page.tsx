"use client"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2, AlertCircle, Clock, FileText, Sparkles, X,
  Stethoscope, Pill, Receipt, ShieldCheck, Bed, Plus, User
} from "lucide-react"
import { useDischargeStore, type ClearancePillar, type DischargePatient } from "@/store/useDischargeStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { DischargeClearanceBoard } from "@/components/discharge/DischargeClearanceBoard"
import { DischargeSummaryResubmitModal, type ResubmitData } from "@/components/discharge/DischargeSummaryResubmitModal"
import { useInpatientStore } from "@/store/useInpatientStore"
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { LogOut, ChevronRight as ChevronRightIcon } from "lucide-react"

const PILLAR_CONFIG: Record<ClearancePillar, { label: string; icon: React.ElementType; color: string }> = {
  doctor:    { label: 'Doctor',    icon: Stethoscope, color: 'text-[var(--color-accent)]' },
  nursing:   { label: 'Nursing',   icon: User,        color: 'text-green-500' },
  pharmacy:  { label: 'Pharmacy',  icon: Pill,        color: 'text-[var(--color-accent)]' },
  billing:   { label: 'Billing',   icon: Receipt,     color: 'text-accent' },
  insurance: { label: 'Insurance', icon: ShieldCheck, color: 'text-[var(--color-accent)]' },
}

const PILLARS: ClearancePillar[] = ['doctor', 'nursing', 'pharmacy', 'billing', 'insurance']

const AI_SUMMARY_TEMPLATE = (p: DischargePatient) => {
  const admittedOn = new Date(p.admittedOn)
  const days = Math.max(1, Math.round((Date.now() - admittedOn.getTime()) / 86400000))
  const followUpDays = /surgery|appendect|cardiac|cabg|PCI/i.test(p.diagnosis) ? 7 : 14
  return [
    `DISCHARGE SUMMARY · ${p.patientName} (${p.patientId})`,
    `Admitted: ${admittedOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · LOS: ${days} day${days === 1 ? '' : 's'}`,
    `Attending: ${p.attendingDoctor}`,
    ``,
    `1. Diagnosis: ${p.diagnosis}.`,
    `2. Course: Treatment plan completed without major complications. Vitals stable at discharge.`,
    `3. Investigations: Latest labs / imaging reviewed and within acceptable range for discharge.`,
    `4. Medications at discharge: Reconciled prescription (TTO) attached.`,
    `5. Follow-up: Outpatient review in ${followUpDays} days with ${p.attendingDoctor}.`,
    `6. Red-flag advice: Patient and attendant counselled on warning signs that need immediate ER attention (fever > 38.5°C, worsening pain, breathlessness, bleeding).`,
    `7. Activity: Resume routine activities as tolerated. Avoid heavy lifting and driving for ${followUpDays} days.`,
    `8. Diet: Continue prescribed diet plan; resume normal diet after follow-up.`,
  ].join('\n')
}

function ClearancePillarBadge({ pillar, status, onClick }: { pillar: ClearancePillar; status: 'pending' | 'cleared'; onClick: () => void }) {
  const cfg = PILLAR_CONFIG[pillar]
  const Icon = cfg.icon
  return (
    <button
      onClick={onClick}
      title={`Toggle ${cfg.label} clearance`}
      className={cn(
        "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all cursor-pointer min-w-[64px]",
        status === 'cleared'
          ? "bg-green-50 border-green-300 shadow-sm"
          : "bg-slate-50 border-slate-200 hover:border-slate-300"
      )}
    >
      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", status === 'cleared' ? "bg-green-100" : "bg-white border border-slate-200")}>
        {status === 'cleared'
          ? <CheckCircle2 className="h-5 w-5 text-green-600" />
          : <Icon className={cn("h-4 w-4", cfg.color)} />
        }
      </div>
      <span className={cn("text-[10px] font-bold leading-tight text-center", status === 'cleared' ? "text-green-700" : "text-slate-500")}>
        {cfg.label}
      </span>
    </button>
  )
}

function PatientCard({ patient, highlighted = false, dimmed = false }: { patient: DischargePatient; highlighted?: boolean; dimmed?: boolean }) {
  const { setClearance, addBlocker, resolveBlocker, draftSummary, approveSummary, issueExitClearance, setFollowUp } = useDischargeStore()
  const getProfile = usePatientProfileStore(s => s.getProfile)
  const [expanded, setExpanded] = useState(false)
  const [newBlocker, setNewBlocker] = useState({ type: 'Other', description: '', owner: '' })
  const [showBlockerForm, setShowBlockerForm] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [followUpDate, setFollowUpDate] = useState(patient.followUpDate?.split('T')[0] ?? '')

  const allCleared = PILLARS.every(p => patient.clearances[p] === 'cleared')
  const unresolvedBlockers = patient.blockers.filter(b => !b.resolvedAt)
  const canExit = allCleared && patient.summaryApproved && unresolvedBlockers.length === 0

  const handleDraftSummary = () => {
    const summary = patient.dischargeSummary || AI_SUMMARY_TEMPLATE(patient)
    draftSummary(patient.patientId, summary)
    toast.success("AI discharge summary drafted — awaiting doctor approval")
  }

  const handleIssueExit = () => {
    if (!canExit) { toast.error("All clearances must be done and summary approved first"); return }
    issueExitClearance(patient.patientId)
    // Notify housekeeping to turn the bed + patient that exit is issued.
    notifyAndAudit({
      to: 'housekeeping', type: 'system', priority: 'medium',
      title: `Bed turnover · ${patient.patientName}`,
      body: `${patient.patientName} has been exit-cleared. Please turn over the bed.`,
      patientName: patient.patientName,
      audit: { action: 'exit_clearance_issued', resource: 'discharge', resourceId: patient.patientId, detail: `Exit clearance issued for ${patient.patientName} — housekeeping notified`, userName: 'Discharge desk' },
    })
    notifyAndAudit({
      to: 'patient', type: 'discharge_ready', priority: 'high',
      title: 'Your exit is cleared',
      body: 'You may now collect your discharge summary and proceed to the exit. Thank you for choosing Agentix HIMS.',
      patientName: patient.patientName,
      audit: { action: 'exit_clearance_issued', resource: 'discharge', resourceId: patient.patientId, detail: 'Patient-side exit-cleared notification' },
    })
    toast.success(`Exit clearance issued · Housekeeping + Patient notified`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white border shadow-sm rounded-xl overflow-hidden transition-all",
        patient.exitClearanceIssued && "opacity-60",
        highlighted && "ring-2 ring-primary/25 ring-offset-2 shadow-md",
        dimmed && "opacity-50",
      )}
    >
      {/* Header */}
      <div
        className="p-5 flex items-start gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-bold text-slate-900">{patient.patientName}</h3>
            {patient.exitClearanceIssued
              ? <NeonBadge variant="success" dot>Exit Issued</NeonBadge>
              : canExit
                ? <NeonBadge variant="success" dot pulse>Ready to Discharge</NeonBadge>
                : <NeonBadge variant="warning" dot pulse>In Progress</NeonBadge>
            }
            <span className="text-sm text-slate-500">{patient.payerType}</span>
            {(patient.payerType?.includes('PMJAY') || patient.payerType?.includes('CMHIS')) &&
              getProfile(patient.patientId)?.abhaId && (
                <span className="text-xs text-accent font-medium">
                  · ABHA: {getProfile(patient.patientId)?.abhaId}
                </span>
              )
            }
          </div>
          <p className="text-sm text-slate-600 font-medium">{patient.diagnosis}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{patient.wardBed}</span>
            <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{patient.attendingDoctor}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Admitted {new Date(patient.admittedOn).toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        {/* Clearance pillars summary */}
        <div className="flex gap-1.5">
          {PILLARS.map(pillar => {
            const status = patient.clearances[pillar]
            const Icon = PILLAR_CONFIG[pillar].icon
            return (
              <div key={pillar} title={`${PILLAR_CONFIG[pillar].label}: ${status}`}
                className={cn("h-8 w-8 rounded-lg flex items-center justify-center", status === 'cleared' ? "bg-green-100" : "bg-slate-100")}
              >
                {status === 'cleared'
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <Icon className={cn("h-4 w-4", PILLAR_CONFIG[pillar].color, "opacity-50")} />
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 p-5 space-y-5">

              {/* Clearance pillars interactive */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Clearance Status — click to toggle</p>
                <div className="flex gap-2 flex-wrap">
                  {PILLARS.map(pillar => (
                    <ClearancePillarBadge
                      key={pillar}
                      pillar={pillar}
                      status={patient.clearances[pillar]}
                      onClick={() => {
                        const newStatus = patient.clearances[pillar] === 'cleared' ? 'pending' : 'cleared'
                        setClearance(patient.patientId, pillar, newStatus)
                        if (newStatus === 'cleared') {
                          // Pillar role → notification mapping so the role responsible
                          // is told their clearance was logged (positive ack).
                          const PILLAR_ROLE: Record<string, 'doctor' | 'nurse' | 'pharmacy' | 'billing' | 'insurance'> =
                            { doctor: 'doctor', nursing: 'nurse', pharmacy: 'pharmacy', billing: 'billing', insurance: 'insurance' }
                          const role = PILLAR_ROLE[pillar]
                          if (role) {
                            notifyAndAudit({
                              to: role, type: 'system', priority: 'low',
                              title: `${PILLAR_CONFIG[pillar].label} clearance — ${patient.patientName}`,
                              body: `Your clearance has been logged for ${patient.patientName}. Patient is one step closer to discharge.`,
                              patientName: patient.patientName,
                              audit: { action: 'discharge_clearance', resource: 'discharge', resourceId: patient.patientId, detail: `${pillar} clearance cleared`, userName: 'Discharge desk' },
                            })
                          }
                          toast.success(`${PILLAR_CONFIG[pillar].label} clearance given`)
                        } else if (pillar === 'doctor') {
                          // Doctor clearance withdrawn for a queued patient → ask the
                          // doctor to review & resubmit the discharge summary.
                          notifyAndAudit({
                            to: 'doctor', type: 'discharge_initiated', priority: 'high',
                            title: `Review & resubmit discharge summary — ${patient.patientName}`,
                            body: `Doctor clearance was withdrawn. Review the discharge summary and resubmit; the patient will return to IPD / Inpatients.`,
                            patientName: patient.patientName,
                            link: `/discharge/dashboard?resubmit=${patient.patientId}`,
                            audit: { action: 'discharge_clearance', resource: 'discharge', resourceId: patient.patientId, detail: 'Doctor clearance withdrawn — resubmission requested', userName: 'Discharge desk' },
                          })
                          toast('Doctor clearance withdrawn · doctor asked to resubmit')
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* M13.7 — 9-step canonical clearance board.
                  Replaces the cognitive overhead of "which pillar = which step"
                  with an explicit numbered checklist, dependency hints, and
                  per-step Mark-cleared action that fires notifyAndAudit. */}
              <DischargeClearanceBoard patient={patient} actorName="Discharge Coordinator" />

              {/* Blockers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Blockers ({unresolvedBlockers.length} active)</p>
                  <button onClick={() => setShowBlockerForm(!showBlockerForm)} className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] flex items-center gap-1 cursor-pointer">
                    <Plus className="h-3 w-3" /> Add Blocker
                  </button>
                </div>

                {showBlockerForm && (
                  <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <Input value={newBlocker.description} onChange={e => setNewBlocker(b => ({ ...b, description: e.target.value }))} placeholder="Blocker description..." className="text-sm h-8" />
                    <div className="flex gap-2">
                      <Input value={newBlocker.owner} onChange={e => setNewBlocker(b => ({ ...b, owner: e.target.value }))} placeholder="Owner / responsible team" className="text-sm h-8 flex-1" />
                      <Button size="sm" onClick={() => {
                        if (!newBlocker.description || !newBlocker.owner) return
                        addBlocker(patient.patientId, { type: newBlocker.type, description: newBlocker.description, owner: newBlocker.owner })
                        setNewBlocker({ type: 'Other', description: '', owner: '' })
                        setShowBlockerForm(false)
                        toast.success(`Blocker added · ${newBlocker.owner}`)
                      }}>Add</Button>
                    </div>
                  </div>
                )}

                {patient.blockers.length === 0 && (
                  <p className="text-sm text-slate-500 italic">No blockers</p>
                )}
                {patient.blockers.map(blocker => (
                  <div key={blocker.id} className={cn("flex items-start justify-between p-3 rounded-lg mb-2 border", blocker.resolvedAt ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200")}>
                    <div>
                      <p className={cn("text-sm font-semibold", blocker.resolvedAt ? "text-green-800 line-through" : "text-red-900")}>{blocker.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Owner: {blocker.owner}</p>
                    </div>
                    {!blocker.resolvedAt && (
                      <button onClick={() => {
                        resolveBlocker(patient.patientId, blocker.id)
                        // Notify the owner role of resolution (inferred from owner name).
                        const ownerLower = blocker.owner.toLowerCase()
                        const role: 'doctor' | 'pharmacy' | 'billing' | 'insurance' | 'nurse' | 'admin' =
                          ownerLower.includes('pharmacy') ? 'pharmacy'
                          : ownerLower.includes('billing') ? 'billing'
                          : ownerLower.includes('insurance') ? 'insurance'
                          : ownerLower.includes('nurse') ? 'nurse'
                          : ownerLower.includes('doctor') ? 'doctor'
                          : 'admin'
                        notifyAndAudit({
                          to: role, type: 'system', priority: 'low',
                          title: `Blocker resolved · ${patient.patientName}`,
                          body: `Discharge blocker "${blocker.description}" marked resolved.`,
                          patientName: patient.patientName,
                          audit: { action: 'discharge_clearance', resource: 'discharge_blocker', resourceId: blocker.id, detail: `Resolved blocker: ${blocker.description}`, userName: 'Discharge desk' },
                        })
                        toast.success(`Blocker resolved · ${blocker.owner} notified`)
                      }} className="ml-2 text-xs font-bold text-green-600 hover:text-green-800 bg-green-50 border border-green-200 px-2 py-1 rounded cursor-pointer">
                        Resolve
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Discharge Summary */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Discharge Summary</p>
                  {!patient.summaryDrafted && (
                    <button onClick={handleDraftSummary} className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] flex items-center gap-1 cursor-pointer">
                      <Sparkles className="h-3 w-3" /> AI Draft
                    </button>
                  )}
                  {patient.summaryDrafted && (
                    <button onClick={() => setShowSummary(!showSummary)} className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] cursor-pointer">
                      {showSummary ? "Hide" : "View"} Summary
                    </button>
                  )}
                </div>
                {patient.summaryDrafted ? (
                  <>
                    <AnimatePresence>
                      {showSummary && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                          <p className="text-sm text-slate-700 bg-slate-50 border rounded-xl p-3 mb-3 leading-relaxed whitespace-pre-line">{patient.dischargeSummary?.trim() ? patient.dischargeSummary : AI_SUMMARY_TEMPLATE(patient)}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex items-center gap-3">
                      {!patient.summaryApproved
                        ? <Button size="sm" onClick={() => { approveSummary(patient.patientId); toast.success("Summary approved by doctor") }}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Summary
                          </Button>
                        : <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700"><CheckCircle2 className="h-4 w-4 text-green-500" />Summary Approved</span>
                      }
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">No summary drafted yet</p>
                )}
              </div>

              {/* Follow-up date */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={e => setFollowUpDate(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <Button size="sm" variant="secondary" onClick={() => { setFollowUp(patient.patientId, followUpDate); toast.success("Follow-up scheduled") }}>
                  Set
                </Button>
              </div>

              {/* Exit Clearance */}
              <div className="pt-2 border-t border-slate-100">
                <Button
                  onClick={handleIssueExit}
                  disabled={!canExit || patient.exitClearanceIssued}
                  className="w-full h-11 font-bold"
                  variant={patient.exitClearanceIssued ? "success" : canExit ? "primary" : "secondary"}
                >
                  {patient.exitClearanceIssued
                    ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Exit Clearance Issued</>
                    : canExit
                      ? "Issue Exit Clearance"
                      : `${PILLARS.filter(p => patient.clearances[p] === 'pending').length} clearance(s) remaining`
                  }
                </Button>
                {!patient.summaryApproved && !patient.exitClearanceIssued && (
                  <p className="text-xs text-center text-accent font-medium mt-2">Discharge summary must be approved before exit</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Inline Input component to avoid import issues
function Input({ value, onChange, placeholder, className }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; className?: string }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn("rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-shadow", className)}
    />
  )
}

export default function DischargeDashboard() {
  const { dischargeQueue, draftSummary, approveSummary, setFollowUp, setInstructions, removeFromQueue } = useDischargeStore()
  const revertDischarge = useInpatientStore(s => s.revertDischarge)
  const addProgressNote = useInpatientStore(s => s.addProgressNote)
  const inpatients = useInpatientStore(s => s.inpatients)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Discharge-summary resubmission (opened from the doctor's "review & resubmit"
  // notification, ?resubmit=<patientId>). On resubmit the patient returns to IPD.
  const resubmitId = searchParams.get('resubmit')
  const resubmitPatient = resubmitId ? dischargeQueue.find(p => p.patientId === resubmitId) : undefined
  const closeResubmit = () => router.replace('/discharge/dashboard')
  const handleResubmit = (p: DischargePatient, data: ResubmitData) => {
    // Persist the reviewed summary, then pull the patient back to active care.
    draftSummary(p.patientId, data.summary)
    approveSummary(p.patientId)
    if (data.followUpDate) setFollowUp(p.patientId, data.followUpDate)
    if (data.instructions) setInstructions(p.patientId, data.instructions)
    const ip = inpatients.find(i => i.patientId === p.patientId)
    if (ip) {
      addProgressNote(p.patientId, `Discharge summary reviewed & revised by doctor; patient returned to ward. ${data.summary}`, ip.condition)
      revertDischarge(p.patientId)
    }
    removeFromQueue(p.patientId)
    notifyAndAudit({
      to: 'doctor', type: 'discharge_initiated', priority: 'medium',
      title: `Patient returned to IPD / Inpatients — ${p.patientName}`,
      body: `Discharge summary resubmitted. ${p.patientName} is back in IPD / Inpatients for continued care.`,
      patientName: p.patientName,
      link: '/doctor/ipd',
      audit: { action: 'discharge_clearance', resource: 'discharge', resourceId: p.patientId, detail: 'Discharge summary resubmitted — patient returned to IPD', userName: 'Attending doctor' },
    })
    toast.success(`${p.patientName} returned to IPD / Inpatients`)
    closeResubmit()
  }

  const today = dischargeQueue.filter(p => !p.exitClearanceIssued)
  const cleared = dischargeQueue.filter(p => p.exitClearanceIssued)
  // Discharged-patients history — newest first (by discharge time).
  const dischargedHistory = [...cleared].sort((a, b) => (b.dischargedAt ?? '').localeCompare(a.dischargedAt ?? ''))
  const blockerCount = today.reduce((acc, p) => acc + p.blockers.filter(b => !b.resolvedAt).length, 0)
  const clearancesDone = today.reduce((acc, p) =>
    acc + Object.values(p.clearances).filter(v => v === 'cleared').length, 0
  )
  const clearancesTotal = today.length * 5

  // M13.7 — pipeline counts for the 4-stage strip.
  // Steps cleared per patient (out of 9 canonical steps) drives the
  // "Clearing" vs "Ready" classification.
  const stepsCleared = (p: DischargePatient) => {
    let n = 1 // order always cleared
    if (p.summaryDrafted) n++
    if (p.summaryApproved) n++
    if (p.clearances.pharmacy === 'cleared') n++
    if (p.clearances.nursing === 'cleared') n++
    if (p.clearances.insurance === 'cleared') n++
    if (p.clearances.billing === 'cleared') n++
    if (p.clearances.doctor === 'cleared') n++
    if (p.exitClearanceIssued) n++
    return n
  }
  const initiated = today.filter(p => stepsCleared(p) <= 2).length
  const clearing  = today.filter(p => stepsCleared(p) > 2 && stepsCleared(p) < 8).length
  const ready     = today.filter(p => stepsCleared(p) === 8 && !p.exitClearanceIssued).length

  // Clicking a pipeline stage filters the queue below to patients in that stage.
  // Clicking a pipeline stage card highlights (scrolls to) patients in that stage —
  // it never hides anyone, so in-workflow patients always stay visible.
  const [highlightStage, setHighlightStage] = useState<string | null>(null)
  const matchesStage = (p: DischargePatient) => {
    const steps = stepsCleared(p)
    switch (highlightStage) {
      case 'Initiated':   return !p.exitClearanceIssued && steps <= 2
      case 'Clearing':    return !p.exitClearanceIssued && steps > 2 && steps < 8
      case 'Ready':       return !p.exitClearanceIssued && steps === 8
      case 'Exit issued': return p.exitClearanceIssued
      case 'Blockers':    return p.blockers.some(b => !b.resolvedAt)
      default:            return true
    }
  }
  // The queue always lists every in-workflow patient — stage cards highlight, never hide.
  const queueList = today
  const highlightCount = highlightStage ? today.filter(matchesStage).length : 0

  return (
    <div className="space-y-6">
      {/* M13.7 — Discharge pipeline strip.
          Four stages mirror how an inpatient becomes a "discharged today":
          Order issued → Clearing pillars → Ready (8/9 cleared, awaiting exit) →
          Exit issued. Blockers tile flags anything stuck. */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 flex-wrap">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <LogOut className="h-4 w-4" />
            </span>
            Discharge pipeline
            <span className="text-[11px] font-semibold text-slate-400">· 9-step clearance</span>
          </h2>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary-light)] opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[rgba(238,107,38,0.07)]0" />
              </span>
              {today.length} in flight
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
              {cleared.length} exits today
            </span>
          </div>
        </div>
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 items-stretch">
          {[
            { label: 'Initiated',   sub: 'Order + draft',     count: initiated,      icon: FileText,     fg: 'text-slate-900', card: 'border-slate-200 bg-white', chip: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',     ring: 'ring-primary/25' },
            { label: 'Clearing',    sub: 'Pillars in flight', count: clearing,       icon: Clock,        fg: 'text-slate-900', card: 'border-slate-200 bg-white', chip: 'bg-amber-50 text-amber-600',   ring: 'ring-amber-300' },
            { label: 'Ready',       sub: '8/9 cleared',       count: ready,          icon: CheckCircle2, fg: 'text-slate-900', card: 'border-slate-200 bg-white', chip: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', ring: 'ring-primary/25' },
            { label: 'Exit issued', sub: 'Today',             count: cleared.length, icon: LogOut,       fg: 'text-slate-900', card: 'border-slate-200 bg-white', chip: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-300' },
            { label: 'Blockers',    sub: 'Stuck steps',       count: blockerCount,   icon: AlertCircle,  alert: true, ring: 'ring-red-300',
              fg: blockerCount > 0 ? 'text-red-600' : 'text-slate-300',
              card: blockerCount > 0 ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white',
              chip: blockerCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400' },
          ].map((s, i, arr) => {
            const active = highlightStage === s.label
            return (
            <button key={s.label} type="button"
              onClick={() => {
                setHighlightStage(active ? null : s.label)
                if (!active) document.getElementById('discharge-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              aria-pressed={active}
              title={active ? `Show all · clear "${s.label}" filter` : `Filter queue to ${s.label}`}
              className={cn(
                "relative rounded-xl border p-4 text-left w-full cursor-pointer transition-all duration-200 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)]",
                s.card,
                active && cn("ring-2 ring-offset-1 shadow-sm", s.ring),
              )}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("grid place-items-center h-9 w-9 rounded-lg flex-shrink-0", s.chip)}>
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={cn("text-3xl font-bold leading-none tabular-nums", s.fg)}>{s.count}</span>
              </div>
              <p className="mt-3 text-[13px] font-semibold text-slate-800 flex items-center gap-1.5">
                {s.label}
                {s.alert && s.count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-500 motion-safe:animate-pulse" aria-hidden="true" />}
              </p>
              <p className="text-[11px] text-slate-500">{active ? 'Highlighting · tap to clear' : s.sub}</p>
              {/* Flow chevron — sits inside the gutter (width matches lg gap), never overlaps a card. */}
              {i < arr.length - 1 && (
                <span className="hidden lg:flex items-center justify-center absolute left-full top-1/2 -translate-y-1/2 w-4 h-4 z-10" aria-hidden="true">
                  <ChevronRightIcon className="h-4 w-4 text-slate-300" />
                </span>
              )}
            </button>
          )})}
        </div>
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Discharging Today", value: today.length, color: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]" },
          { label: "Active Blockers", value: blockerCount, color: blockerCount > 0 ? "text-red-600" : "text-green-600", bg: blockerCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200" },
          { label: "Clearances Obtained", value: `${clearancesDone}/${clearancesTotal}`, color: "text-green-600", bg: "bg-green-50 border-green-200" },
          { label: "Exits Issued Today", value: cleared.length, color: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-xl border p-5", bg)}>
            <p className={cn("text-3xl font-bold", color)}>{value}</p>
            <p className="text-sm font-semibold text-slate-600 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Blocker alert */}
      {blockerCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-900">{blockerCount} active discharge blocker(s)</p>
            <p className="text-xs text-red-700 mt-0.5">Resolve all blockers and obtain all clearances before issuing exit.</p>
          </div>
        </div>
      )}

      {/* Discharge queue */}
      <div id="discharge-queue" className="space-y-4 scroll-mt-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">Today's Discharge Queue</h2>
          {highlightStage && (
            <button onClick={() => setHighlightStage(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.14)] transition-colors cursor-pointer">
              Highlighting: {highlightStage} · {highlightCount}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {queueList.length === 0 && (
          <div className="bg-white border rounded-xl p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-lg font-bold text-slate-700">No pending discharges</p>
            <p className="text-sm text-slate-500 mt-1">All today&apos;s discharges have been processed.</p>
          </div>
        )}
        {queueList.map(patient => (
          <PatientCard
            key={patient.id}
            patient={patient}
            highlighted={!!highlightStage && matchesStage(patient)}
            dimmed={!!highlightStage && !matchesStage(patient)}
          />
        ))}
      </div>

      {/* Discharged patients history */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" /> Discharged Patients History ({dischargedHistory.length})
        </h2>
        {dischargedHistory.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">No patients discharged yet</p>
            <p className="text-xs text-slate-400 mt-1">Patients appear here once exit clearance is issued.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dischargedHistory.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{p.patientName}</p>
                  <p className="text-sm text-slate-600 truncate">{p.diagnosis} • {p.wardBed}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.attendingDoctor} · {p.payerType}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <NeonBadge variant="success" dot>Exit Issued</NeonBadge>
                  {p.dischargedAt && (
                    <p className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(p.dischargedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {resubmitPatient && (
          <DischargeSummaryResubmitModal
            patient={resubmitPatient}
            initialSummary={resubmitPatient.dischargeSummary?.trim() ? resubmitPatient.dischargeSummary : AI_SUMMARY_TEMPLATE(resubmitPatient)}
            onClose={closeResubmit}
            onResubmit={(data) => handleResubmit(resubmitPatient, data)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
