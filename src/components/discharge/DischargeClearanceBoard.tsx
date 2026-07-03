"use client"

import { motion } from "framer-motion"
import {
  CheckCircle2, AlertTriangle, Clock, FileText, ClipboardCheck,
  Pill, Activity, Receipt, ShieldCheck, MessageSquareText, LogOut,
  RotateCcw, ChevronRight, Stethoscope,
} from "lucide-react"
import { useDischargeStore, type DischargePatient } from "@/store/useDischargeStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Role } from "@/types/roles"

// The canonical paperless discharge has 9 steps. The store models 5 clearance
// pillars + 3 sequence flags; this board derives the 9-step view from those.
type StepStatus = 'cleared' | 'in_progress' | 'pending' | 'blocked'

interface Step {
  id: string
  number: number
  label: string
  owner: string
  ownerRole: Role
  icon: React.ElementType
  getStatus: (p: DischargePatient) => StepStatus
  /** Mark cleared. Returns true if the action was applied. */
  clear: (p: DischargePatient, ctx: ClearCtx) => boolean
  /** Revert a cleared step. Omit when the step is terminal / can't be reopened. */
  reopen?: (p: DischargePatient, ctx: ClearCtx) => void
  /** This step's dependencies — IDs of steps that must clear first to enable. */
  dependsOn?: string[]
  helpText: string
}

interface ClearCtx {
  setClearance: ReturnType<typeof useDischargeStore.getState>['setClearance']
  setOrderIssued: ReturnType<typeof useDischargeStore.getState>['setOrderIssued']
  draftSummary: ReturnType<typeof useDischargeStore.getState>['draftSummary']
  approveSummary: ReturnType<typeof useDischargeStore.getState>['approveSummary']
  undraftSummary: ReturnType<typeof useDischargeStore.getState>['undraftSummary']
  unapproveSummary: ReturnType<typeof useDischargeStore.getState>['unapproveSummary']
  issueExitClearance: ReturnType<typeof useDischargeStore.getState>['issueExitClearance']
  defaultSummary: (p: DischargePatient) => string
  actorName: string
}

const STEPS: Step[] = [
  {
    id: 'order', number: 1, label: 'Discharge order issued',
    owner: 'Attending doctor', ownerRole: 'doctor', icon: Stethoscope,
    helpText: 'Doctor decides patient is medically fit; order goes into the discharge queue.',
    // Always cleared once the patient is in the queue.
    // Backed by `orderIssued` (default cleared) so the Doctor pillar can revert it.
    getStatus: (p) => p.orderIssued === false ? 'in_progress' : 'cleared',
    clear: (p, ctx) => { ctx.setOrderIssued(p.patientId, true); return true },
    reopen: (p, ctx) => ctx.setOrderIssued(p.patientId, false),
  },
  {
    id: 'summary_draft', number: 2, label: 'Discharge summary drafted',
    owner: 'Attending doctor', ownerRole: 'doctor', icon: FileText,
    helpText: 'Draft the discharge summary (course, diagnosis, meds, follow-up). Auto-template available.',
    getStatus: (p) => p.summaryDrafted ? 'cleared' : 'in_progress',
    clear: (p, ctx) => {
      if (p.summaryDrafted) return false
      ctx.draftSummary(p.patientId, ctx.defaultSummary(p))
      return true
    },
    reopen: (p, ctx) => ctx.undraftSummary(p.patientId),
  },
  {
    id: 'summary_approve', number: 3, label: 'Summary approved',
    owner: 'Attending doctor', ownerRole: 'doctor', icon: ClipboardCheck,
    dependsOn: ['summary_draft'],
    helpText: 'Senior consultant signs off the summary text. Locks it for distribution.',
    getStatus: (p) => p.summaryApproved ? 'cleared' : (p.summaryDrafted ? 'in_progress' : 'pending'),
    clear: (p, ctx) => {
      if (!p.summaryDrafted) { toast.error('Draft the summary before approving'); return false }
      if (p.summaryApproved) return false
      ctx.approveSummary(p.patientId)
      return true
    },
    reopen: (p, ctx) => ctx.unapproveSummary(p.patientId),
  },
  {
    id: 'pharmacy', number: 4, label: 'Pharmacy clearance (TTO meds)',
    owner: 'Pharmacy', ownerRole: 'pharmacy', icon: Pill,
    helpText: 'Take-home meds dispensed and counselled. Pharmacy signs off.',
    getStatus: (p) => p.clearances.pharmacy === 'cleared' ? 'cleared' : 'in_progress',
    clear: (p, ctx) => { ctx.setClearance(p.patientId, 'pharmacy', 'cleared'); return true },
    reopen: (p, ctx) => ctx.setClearance(p.patientId, 'pharmacy', 'pending'),
  },
  {
    id: 'investigations', number: 5, label: 'Investigations & equipment',
    owner: 'Ward nursing', ownerRole: 'nurse', icon: Activity,
    helpText: 'All pending labs/imaging back. Cannula removed, equipment returned (IV pumps, syringe drivers).',
    // Map to the existing 'nursing' pillar — captures equipment + investigations together.
    getStatus: (p) => p.clearances.nursing === 'cleared' ? 'cleared' : 'in_progress',
    clear: (p, ctx) => { ctx.setClearance(p.patientId, 'nursing', 'cleared'); return true },
    reopen: (p, ctx) => ctx.setClearance(p.patientId, 'nursing', 'pending'),
  },
  {
    id: 'insurance', number: 6, label: 'Insurance final approval',
    owner: 'Insurance desk', ownerRole: 'insurance', icon: ShieldCheck,
    helpText: 'Cashless cases: TPA approves the final claim amount. Reimbursement: claim forms handed to patient.',
    getStatus: (p) => p.clearances.insurance === 'cleared' ? 'cleared' : 'in_progress',
    clear: (p, ctx) => { ctx.setClearance(p.patientId, 'insurance', 'cleared'); return true },
    reopen: (p, ctx) => ctx.setClearance(p.patientId, 'insurance', 'pending'),
  },
  {
    id: 'billing', number: 7, label: 'Billing finalized',
    owner: 'Billing desk', ownerRole: 'billing', icon: Receipt,
    dependsOn: ['insurance'],
    helpText: 'Final bill frozen and patient share collected. Insurance share booked against the claim.',
    getStatus: (p) => p.clearances.billing === 'cleared' ? 'cleared' : (p.clearances.insurance === 'cleared' ? 'in_progress' : 'pending'),
    clear: (p, ctx) => { ctx.setClearance(p.patientId, 'billing', 'cleared'); return true },
    reopen: (p, ctx) => ctx.setClearance(p.patientId, 'billing', 'pending'),
  },
  {
    id: 'counselling', number: 8, label: 'Patient counselling',
    owner: 'Doctor + nurse', ownerRole: 'nurse', icon: MessageSquareText,
    dependsOn: ['summary_approve', 'pharmacy'],
    helpText: 'Meds explained, follow-up date confirmed, diet plan handed over, red-flag advice given.',
    // Use the 'doctor' pillar to track counselling (which the attending signs off after the summary is approved).
    getStatus: (p) => p.clearances.doctor === 'cleared' ? 'cleared' : (p.summaryApproved && p.clearances.pharmacy === 'cleared' ? 'in_progress' : 'pending'),
    clear: (p, ctx) => { ctx.setClearance(p.patientId, 'doctor', 'cleared'); return true },
    reopen: (p, ctx) => ctx.setClearance(p.patientId, 'doctor', 'pending'),
  },
  {
    id: 'exit', number: 9, label: 'Exit pass · bed released',
    owner: 'Discharge desk', ownerRole: 'discharge', icon: LogOut,
    dependsOn: ['summary_approve', 'pharmacy', 'nursing' as never, 'insurance', 'billing', 'counselling'],
    helpText: 'Discharge desk issues the exit pass; bed manager + housekeeping receive the turnover request.',
    getStatus: (p) => p.exitClearanceIssued ? 'cleared' : (
      p.summaryApproved && p.clearances.pharmacy === 'cleared' &&
      p.clearances.nursing === 'cleared' && p.clearances.insurance === 'cleared' &&
      p.clearances.billing === 'cleared' && p.clearances.doctor === 'cleared'
        ? 'in_progress' : 'pending'
    ),
    clear: (p, ctx) => {
      const ready = p.summaryApproved && p.clearances.pharmacy === 'cleared' &&
        p.clearances.nursing === 'cleared' && p.clearances.insurance === 'cleared' &&
        p.clearances.billing === 'cleared' && p.clearances.doctor === 'cleared'
      if (!ready) { toast.error('Other clearances still pending'); return false }
      if (p.exitClearanceIssued) return false
      ctx.issueExitClearance(p.patientId)
      return true
    },
    // Terminal — exit pass / bed release can't be reopened from the board (no reopen).
  },
]

const STATUS_STYLES: Record<StepStatus, { dot: string; ring: string; label: string; chip: string }> = {
  cleared:     { dot: 'bg-emerald-500', ring: 'ring-emerald-100', label: 'Cleared',     chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_progress: { dot: 'bg-[rgba(238,107,38,0.07)]0',    ring: 'ring-primary/20',    label: 'In progress', chip: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]' },
  pending:     { dot: 'bg-slate-300',   ring: 'ring-slate-100',   label: 'Pending',     chip: 'bg-slate-50 text-slate-500 border-slate-200' },
  blocked:     { dot: 'bg-red-500',     ring: 'ring-red-100',     label: 'Blocker',     chip: 'bg-red-50 text-red-700 border-red-200' },
}

interface Props {
  patient: DischargePatient
  actorName?: string
  /** Compact = right-rail; full = main column. */
  variant?: 'full' | 'compact'
}

export function DischargeClearanceBoard({ patient, actorName = 'Discharge Coordinator', variant = 'full' }: Props) {
  const { setClearance, setOrderIssued, draftSummary, approveSummary, undraftSummary, unapproveSummary, issueExitClearance } = useDischargeStore()

  const ctx: ClearCtx = {
    setClearance, setOrderIssued, draftSummary, approveSummary, undraftSummary, unapproveSummary, issueExitClearance,
    actorName, defaultSummary: defaultSummaryFor,
  }

  const stepStatuses = STEPS.map(s => ({ step: s, status: applyBlockers(patient, s.getStatus(patient)) }))
  const clearedCount = stepStatuses.filter(s => s.status === 'cleared').length
  const blockedCount = stepStatuses.filter(s => s.status === 'blocked').length

  const onClear = (step: Step) => {
    const did = step.clear(patient, ctx)
    if (!did) return
    notifyAndAudit({
      to: step.ownerRole, type: 'system', priority: 'low',
      title: `Discharge step cleared · ${patient.patientName}`,
      body: `Step ${step.number}/9 "${step.label}" marked complete by ${actorName}.`,
      patientName: patient.patientName,
      audit: { action: 'discharge_clearance', resource: 'discharge', resourceId: patient.id, detail: `Step ${step.number} (${step.label}) cleared`, userName: actorName },
    })
    if (step.id === 'exit') {
      // Issuing exit also pages bed_manager + housekeeping (bed turnover request).
      notifyAndAudit({
        to: 'bed_manager', type: 'system', priority: 'medium',
        title: `Bed release · ${patient.patientName}`,
        body: `${patient.patientName} discharged from ${patient.wardBed}. Bed ready for turnover.`,
        patientName: patient.patientName,
        audit: { action: 'exit_clearance_issued', resource: 'discharge', resourceId: patient.id, detail: `Exit pass issued for ${patient.patientName}`, userName: actorName },
      })
      notifyAndAudit({
        to: 'housekeeping', type: 'system', priority: 'high',
        title: `Bed cleaning request · ${patient.wardBed}`,
        body: `${patient.wardBed} requires turnover after discharge of ${patient.patientName}.`,
        audit: { action: 'housekeeping_bed_turned', resource: 'bed', detail: `Discharge turnover ${patient.wardBed}`, userName: actorName },
      })
    }
    toast.success(`Step ${step.number}: ${step.label} · cleared`)
  }

  const onReopen = (step: Step) => {
    if (!step.reopen) return
    step.reopen(patient, ctx)
    notifyAndAudit({
      to: step.ownerRole, type: 'system', priority: 'low',
      title: `Discharge step reopened · ${patient.patientName}`,
      body: `Step ${step.number}/9 "${step.label}" reopened by ${actorName}.`,
      patientName: patient.patientName,
      audit: { action: 'discharge_clearance', resource: 'discharge', resourceId: patient.id, detail: `Step ${step.number} (${step.label}) reopened`, userName: actorName },
    })
    toast(`Step ${step.number}: ${step.label} · reopened`)
  }

  return (
    <div className={cn("rounded-xl bg-white border border-slate-200 overflow-hidden", variant === 'compact' && 'shadow-sm')}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">9-step clearance board</h3>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            {clearedCount} / 9 cleared
          </span>
          {blockedCount > 0 && (
            <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />{blockedCount} blocked
            </span>
          )}
        </div>
        {patient.exitClearanceIssued && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />Exit pass issued
          </span>
        )}
      </div>

      {/* Steps */}
      <ol className="relative pl-9 pr-4 py-4 space-y-3">
        {/* Spine */}
        <div className="absolute left-[18px] top-4 bottom-4 w-px bg-slate-200" />

        {stepStatuses.map(({ step, status }) => {
          const Icon = step.icon
          const sty = STATUS_STYLES[status]
          const canClear = status === 'in_progress'
          return (
            <motion.li key={step.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
              className="relative">
              {/* Dot */}
              <span className={cn("absolute -left-7 top-1 h-5 w-5 rounded-full flex items-center justify-center ring-4 flex-shrink-0", sty.dot, sty.ring)}>
                {status === 'cleared' ? <CheckCircle2 className="h-3 w-3 text-white" /> :
                 status === 'blocked' ? <AlertTriangle className="h-3 w-3 text-white" /> :
                 <span className="text-[9px] font-bold text-white">{step.number}</span>}
              </span>

              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-bold flex items-center gap-1.5 flex-wrap", status === 'cleared' ? 'text-slate-500 line-through decoration-emerald-400 decoration-2' : 'text-slate-900')}>
                    <Icon className={cn("h-3.5 w-3.5", status === 'cleared' ? 'text-emerald-500' : 'text-slate-400')} />
                    {step.label}
                    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border", sty.chip)}>{sty.label}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    <span className="font-semibold text-slate-700">{step.owner}</span> · {step.helpText}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canClear && (
                    <button onClick={() => onClear(step)}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                      <CheckCircle2 className="h-3 w-3" />Mark cleared
                    </button>
                  )}
                  {status === 'cleared' && step.reopen && (
                    <button onClick={() => onReopen(step)}
                      className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer">
                      <RotateCcw className="h-2.5 w-2.5" />Re-open
                    </button>
                  )}
                  {status === 'pending' && step.dependsOn && step.dependsOn.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400 italic">
                      waits on step {step.dependsOn.map(d => STEPS.find(s => s.id === d)?.number).filter(Boolean).join('+')}
                    </span>
                  )}
                </div>
              </div>
            </motion.li>
          )
        })}
      </ol>

      {/* Blockers footer */}
      {patient.blockers.filter(b => !b.resolvedAt).length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 bg-red-50/40">
          <p className="text-[11px] font-bold text-red-700 mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />Active blockers ({patient.blockers.filter(b => !b.resolvedAt).length})
          </p>
          <ul className="space-y-1">
            {patient.blockers.filter(b => !b.resolvedAt).map(b => (
              <li key={b.id} className="text-[11px] text-slate-700 flex items-center gap-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-red-700 bg-red-100 px-1.5 py-0.5 rounded">{b.type}</span>
                <span>{b.description}</span>
                <span className="text-slate-400 italic">— owner: {b.owner}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Blockers turn pending/in_progress into 'blocked' visually.
function applyBlockers(p: DischargePatient, base: StepStatus): StepStatus {
  if (base === 'cleared') return base
  // A blocker that's not resolved makes the underlying step appear blocked.
  if (p.blockers.some(b => !b.resolvedAt)) return base === 'pending' ? 'pending' : 'blocked'
  return base
}

function defaultSummaryFor(p: DischargePatient): string {
  const admittedOn = new Date(p.admittedOn)
  const days = Math.max(1, Math.round((Date.now() - admittedOn.getTime()) / 86400000))
  const followUpDays = /surgery|appendect|cardiac|cabg|PCI|ortho|ORIF|fracture/i.test(p.diagnosis) ? 7 : 14
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
    `6. Red-flag advice: Patient and attendant counselled on warning signs (fever > 38.5°C, worsening pain, breathlessness, bleeding).`,
    `7. Activity: Resume routine activities as tolerated. Avoid heavy lifting and driving for ${followUpDays} days.`,
    `8. Diet: Continue prescribed diet plan; resume normal diet after follow-up.`,
  ].join('\n')
}
