"use client"

import { useState } from "react"
import { useInsuranceStore, type InsuranceClaim, type ApprovalStage, type ClaimDocument } from "@/store/useInsuranceStore"
import {
  ShieldCheck, Upload, AlertTriangle, X, ArrowRight, Send,
  PackageCheck, Hourglass, FilePlus, ClipboardList, CheckCircle2,
  FileCheck2, FileText, Clock, Activity, FileWarning,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Stage Config ─────────────────────────────────────────────────────────────

type StageConfig = {
  stage: ApprovalStage
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  headerBg: string        // column header tint
  columnBg: string        // column body
  borderTop: string       // 4px top border
  cardBorder: string      // card left accent (3px)
  iconRing: string        // icon container
  badgeCls: string        // count badge
  ctaCls: string          // primary button
}

const STAGES: StageConfig[] = [
  {
    stage: 'intake',
    label: 'New Intake',
    description: 'Initiate pre-auth',
    icon: FilePlus,
    headerBg:  'bg-amber-50/60',
    columnBg:  'bg-amber-50/30',
    borderTop: 'border-t-amber-400',
    cardBorder:'border-l-amber-400',
    iconRing:  'bg-amber-100 text-amber-700',
    badgeCls:  'bg-amber-100 text-amber-700',
    ctaCls:    'bg-amber-500 hover:bg-amber-600 text-white',
  },
  {
    stage: 'docs_collection',
    label: 'Collecting Docs',
    description: 'Upload required documents',
    icon: ClipboardList,
    headerBg:  'bg-primary-soft',
    columnBg:  'bg-primary-soft',
    borderTop: 'border-t-[var(--color-primary)]',
    cardBorder:'border-l-[var(--color-primary)]',
    iconRing:  'bg-accent-soft text-[var(--color-accent)]',
    badgeCls:  'bg-accent-soft text-[var(--color-accent)]',
    ctaCls:    'bg-slate-100 hover:bg-slate-200 text-slate-700',
  },
  {
    stage: 'pre_auth_sent',
    label: 'Pre-Auth Sent',
    description: 'Awaiting TPA decision',
    icon: Send,
    headerBg:  'bg-surface-sunken',
    columnBg:  'bg-surface-sunken',
    borderTop: 'border-t-slate-400',
    cardBorder:'border-l-slate-400',
    iconRing:  'bg-surface-sunken text-accent',
    badgeCls:  'bg-surface-sunken text-accent',
    ctaCls:    '',
  },
  {
    stage: 'tpa_query',
    label: 'TPA Query',
    description: 'Action required — respond now',
    icon: AlertTriangle,
    headerBg:  'bg-red-50/80',
    columnBg:  'bg-red-50/30',
    borderTop: 'border-t-red-500',
    cardBorder:'border-l-red-500',
    iconRing:  'bg-red-100 text-red-700',
    badgeCls:  'bg-red-500 text-white',
    ctaCls:    'bg-red-500 hover:bg-red-600 text-white',
  },
  {
    stage: 'pre_auth_approved',
    label: 'Pre-Auth Approved',
    description: 'Prepare final claim package',
    icon: CheckCircle2,
    headerBg:  'bg-emerald-50/60',
    columnBg:  'bg-emerald-50/30',
    borderTop: 'border-t-emerald-500',
    cardBorder:'border-l-emerald-500',
    iconRing:  'bg-emerald-100 text-emerald-700',
    badgeCls:  'bg-emerald-100 text-emerald-700',
    ctaCls:    'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    stage: 'final_claim',
    label: 'Final Claim',
    description: 'Submit for settlement',
    icon: PackageCheck,
    headerBg:  'bg-primary-soft',
    columnBg:  'bg-primary-soft',
    borderTop: 'border-t-orange-500',
    cardBorder:'border-l-orange-500',
    iconRing:  'bg-accent-soft text-accent',
    badgeCls:  'bg-accent-soft text-accent',
    ctaCls:    'bg-primary hover:bg-primary-dark text-white',
  },
]

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.stage, s])) as Record<ApprovalStage, StageConfig>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-[var(--color-primary)] text-white', 'bg-primary text-white', 'bg-emerald-600 text-white',
  'bg-amber-600 text-white', 'bg-secondary text-white',   'bg-rose-600 text-white',
]
function avatarColor(name: string) {
  const n = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

// ─── Document Upload Modal ────────────────────────────────────────────────────

function DocUploadModal({ claim, onClose, onDone }: {
  claim: InsuranceClaim
  onClose: () => void
  onDone: () => void
}) {
  const uploadDocument = useInsuranceStore(s => s.uploadDocument)
  const liveClaim = useInsuranceStore(s => s.claims.find(c => c.id === claim.id)) ?? claim
  const docs = liveClaim.documents ?? []
  const verifiedCount = docs.filter(d => d.status === 'verified').length
  const pendingCount = docs.length - verifiedCount
  const pct = docs.length > 0 ? Math.round((verifiedCount / docs.length) * 100) : 0

  function markUploaded(doc: ClaimDocument) {
    uploadDocument(claim.id, doc.id)
    toast.success(`"${doc.name}" uploaded`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
           style={{ maxHeight: '90vh' }}>

        {/* Modal header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[15px] font-bold", avatarColor(liveClaim.patientName))}>
                {initials(liveClaim.patientName)}
              </div>
              <div>
                <p className="text-[15px] font-bold text-slate-900 leading-tight">{liveClaim.patientName}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">{liveClaim.provider}{liveClaim.policyNumber ? ` · ${liveClaim.policyNumber}` : ''}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer flex-shrink-0 mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-slate-600">Document Progress</span>
              <span className={cn("text-[12px] font-bold tabular-nums", pct === 100 ? 'text-emerald-600' : 'text-amber-600')}>
                {verifiedCount} / {docs.length} uploaded
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", pct === 100 ? 'bg-emerald-500' : 'bg-amber-400')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {docs.map(doc => {
            const done = doc.status === 'verified'
            return (
              <div key={doc.id} className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors",
                done ? "bg-emerald-50/70 border-emerald-100" : "bg-white border-slate-150 hover:border-slate-200"
              )}>
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  done ? "bg-emerald-100" : "bg-slate-100")}>
                  {done
                    ? <FileCheck2 className="h-4 w-4 text-emerald-600" />
                    : <FileText className="h-4 w-4 text-slate-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[13px] font-semibold truncate", done ? "text-emerald-900" : "text-slate-800")}>
                    {doc.name}
                  </p>
                  {doc.uploadedAt && (
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      Uploaded at {new Date(doc.uploadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {!done && <p className="text-[11px] text-slate-400 mt-0.5">Pending upload</p>}
                </div>
                {done ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex-shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </span>
                ) : (
                  <button
                    onClick={() => markUploaded(doc)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-accent)] bg-primary-soft hover:bg-accent-soft border border-primary/20 px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload
                  </button>
                )}
              </div>
            )
          })}
          {docs.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <FileWarning className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-[13px] text-slate-400 font-medium">No documents configured</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          {pendingCount > 0 ? (
            <p className="text-[12px] text-amber-700 font-semibold mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {pendingCount} document{pendingCount > 1 ? 's' : ''} still pending — upload to proceed
            </p>
          ) : (
            <p className="text-[12px] text-emerald-700 font-semibold mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              All documents uploaded — ready to proceed
            </p>
          )}
          <button
            onClick={onDone}
            className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-[13px] font-bold hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Patient Card ─────────────────────────────────────────────────────────────

function TPAPatientCard({ claim, cfg }: { claim: InsuranceClaim; cfg: StageConfig }) {
  const [showDocs, setShowDocs] = useState(false)
  const moveToStage = useInsuranceStore(s => s.moveToStage)
  const liveClaim   = useInsuranceStore(s => s.claims.find(c => c.id === claim.id)) ?? claim
  const stage = cfg.stage

  const docs         = liveClaim.documents ?? []
  const verifiedCount= docs.filter(d => d.status === 'verified').length
  const allVerified  = docs.length > 0 && verifiedCount === docs.length
  const showDocProg  = stage === 'docs_collection' || stage === 'tpa_query'
  const docPct       = docs.length > 0 ? Math.round((verifiedCount / docs.length) * 100) : 0

  function handleAction() {
    switch (stage) {
      case 'intake':
        moveToStage(claim.id, 'docs_collection', { actor: 'TPA Desk' })
        toast.success(`Pre-auth initiated for ${liveClaim.patientName}`)
        break
      case 'docs_collection':
        if (!allVerified) { setShowDocs(true) }
        else {
          moveToStage(claim.id, 'pre_auth_sent', { actor: 'TPA Desk' })
          toast.success(`Pre-auth sent to ${liveClaim.provider}`)
        }
        break
      case 'tpa_query':
        setShowDocs(true)
        break
      case 'pre_auth_approved':
        moveToStage(claim.id, 'final_claim', { actor: 'TPA Desk' })
        toast.success(`Final claim preparation started`)
        break
      case 'final_claim':
        moveToStage(claim.id, 'settled', { actor: 'TPA Desk' })
        toast.success(`Final claim submitted for ${liveClaim.patientName}`)
        break
    }
  }

  function handleDocsDone() {
    setShowDocs(false)
    if (stage === 'tpa_query') {
      const updated = useInsuranceStore.getState().claims.find(c => c.id === claim.id)
      const allDone = (updated?.documents ?? []).every(d => d.status === 'verified')
      if (allDone && (updated?.documents?.length ?? 0) > 0) {
        moveToStage(claim.id, 'pre_auth_approved', { actor: 'TPA Desk' })
        toast.success('Query resolved — moved to Pre-Auth Approved')
      }
    }
  }

  const cta: Partial<Record<ApprovalStage, { label: string; icon: React.ComponentType<{ className?: string }> }>> = {
    intake:            { label: 'Start Pre-Auth',      icon: ArrowRight },
    docs_collection:   { label: allVerified ? 'Send for Approval' : 'Upload Documents', icon: allVerified ? Send : Upload },
    tpa_query:         { label: 'Respond & Upload',    icon: Upload },
    pre_auth_approved: { label: 'Prepare Final Claim', icon: PackageCheck },
    final_claim:       { label: 'Submit Final Claim',  icon: Send },
  }
  const action = cta[stage]
  const ctaCls = stage === 'docs_collection' && allVerified ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white' : cfg.ctaCls

  return (
    <>
      {/* Card */}
      <div className={cn(
        "bg-white rounded-xl border-l-[3px] shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.04)]",
        "hover:shadow-[0_2px_8px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.06)] transition-shadow duration-200",
        cfg.cardBorder
      )}>
        <div className="p-4">

          {/* TPA Query alert */}
          {stage === 'tpa_query' && liveClaim.tpaQuery && (
            <div className="mb-3.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <div className="flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide mb-0.5">TPA Query</p>
                  <p className="text-[12px] text-red-700 leading-snug">{liveClaim.tpaQuery}</p>
                </div>
              </div>
            </div>
          )}

          {/* Patient identity row */}
          <div className="flex items-start gap-3 mb-3">
            <div className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center text-[13px] font-bold flex-shrink-0",
              avatarColor(liveClaim.patientName)
            )}>
              {initials(liveClaim.patientName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-slate-900 leading-tight truncate">{liveClaim.patientName}</p>
              <p className="text-[11.5px] text-slate-500 mt-0.5 truncate">
                {liveClaim.provider}{liveClaim.policyNumber ? ` · ${liveClaim.policyNumber}` : ''}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[13px] font-bold text-slate-800 tabular-nums leading-tight">
                ₹{liveClaim.amount.toLocaleString('en-IN')}
              </p>
              {liveClaim.approvedAmount && liveClaim.approvedAmount < liveClaim.amount && (
                <p className="text-[10.5px] text-emerald-600 font-semibold tabular-nums">
                  ✓ ₹{liveClaim.approvedAmount.toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>

          {/* Diagnosis */}
          {liveClaim.diagnosis && (
            <p className="text-[12px] text-slate-500 leading-snug line-clamp-2 mb-3 pl-0.5">
              {liveClaim.diagnosis}
            </p>
          )}

          {/* Document progress */}
          {showDocProg && docs.length > 0 && (
            <div className="mb-3 bg-slate-50 rounded-lg px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Documents</span>
                <span className={cn("text-[11px] font-bold tabular-nums", allVerified ? 'text-emerald-600' : 'text-amber-600')}>
                  {verifiedCount}/{docs.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", allVerified ? 'bg-emerald-500' : 'bg-amber-400')}
                  style={{ width: `${docPct}%` }}
                />
              </div>
              {!allVerified && (
                <p className="text-[10.5px] text-slate-400 mt-1.5">
                  {docs.length - verifiedCount} more required to proceed
                </p>
              )}
            </div>
          )}

          {/* Awaiting chip (pre_auth_sent) */}
          {stage === 'pre_auth_sent' && (
            <div className="mb-3 flex items-center gap-2 bg-surface-sunken border border-border rounded-lg px-3 py-2.5">
              <Hourglass className="h-3.5 w-3.5 text-accent flex-shrink-0 animate-pulse" />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-accent leading-tight">Awaiting TPA response</p>
                {liveClaim.tpaReferenceId && (
                  <p className="text-[11px] text-accent font-mono mt-0.5">{liveClaim.tpaReferenceId}</p>
                )}
              </div>
            </div>
          )}

          {/* Approved chip (pre_auth_approved) */}
          {stage === 'pre_auth_approved' && liveClaim.approvedAmount && (
            <div className="mb-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-emerald-800">
                  Approved ₹{liveClaim.approvedAmount.toLocaleString('en-IN')}
                </p>
                {liveClaim.tpaReferenceId && (
                  <p className="text-[11px] text-emerald-600 font-mono mt-0.5">{liveClaim.tpaReferenceId}</p>
                )}
              </div>
            </div>
          )}

          {/* Primary CTA */}
          {action && stage !== 'pre_auth_sent' && (
            <button
              onClick={handleAction}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150 cursor-pointer",
                ctaCls || 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              )}
            >
              <action.icon className="h-3.5 w-3.5 flex-shrink-0" />
              {action.label}
            </button>
          )}
        </div>
      </div>

      {showDocs && (
        <DocUploadModal
          claim={liveClaim}
          onClose={() => setShowDocs(false)}
          onDone={handleDocsDone}
        />
      )}
    </>
  )
}

// ─── KPI Pill ─────────────────────────────────────────────────────────────────

function KpiPill({ icon: Icon, label, value, urgent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  urgent?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 px-4 py-2.5 rounded-xl border",
      urgent && value > 0
        ? "bg-red-50 border-red-200"
        : "bg-white border-slate-200/80"
    )}>
      <span className={cn(
        "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
        urgent && value > 0 ? "bg-red-100" : "bg-slate-100"
      )}>
        <Icon className={cn("h-3.5 w-3.5", urgent && value > 0 ? "text-red-600" : "text-slate-500")} />
      </span>
      <div>
        <p className={cn("text-[18px] font-bold leading-tight tabular-nums",
          urgent && value > 0 ? "text-red-700" : "text-slate-900"
        )}>{value}</p>
        <p className={cn("text-[11px] font-medium leading-none mt-0.5",
          urgent && value > 0 ? "text-red-500" : "text-slate-500"
        )}>{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsurancePipelinePage() {
  const claims = useInsuranceStore(s => s.claims)

  const activeClaims = claims.filter(c =>
    c.approvalStage && c.approvalStage !== 'settled' && c.approvalStage !== 'rejected'
  )

  function claimsForStage(stage: ApprovalStage) {
    return activeClaims.filter(c => c.approvalStage === stage)
  }

  const totalActive  = activeClaims.length
  const queryCount   = claimsForStage('tpa_query').length
  const sentCount    = claimsForStage('pre_auth_sent').length
  const finalCount   = claimsForStage('final_claim').length
  const approvedCount= claimsForStage('pre_auth_approved').length

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight">Approval Pipeline</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              End-to-end TPA cashless workflow · {totalActive} active case{totalActive !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-[rgba(238,107,38,0.08)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* KPI pills row */}
        <div className="flex gap-2.5 flex-wrap">
          <KpiPill icon={ShieldCheck}    label="Active cases"        value={totalActive} />
          <KpiPill icon={AlertTriangle}  label="TPA queries"         value={queryCount}   urgent />
          <KpiPill icon={Hourglass}      label="Awaiting response"   value={sentCount} />
          <KpiPill icon={CheckCircle2}   label="Pre-auth approved"   value={approvedCount} />
          <KpiPill icon={PackageCheck}   label="Final claim stage"   value={finalCount} />
        </div>
      </div>

      {/* ── Stage flow strip ────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-0 mb-4 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const count = claimsForStage(s.stage).length
          return (
            <div key={s.stage} className="flex items-center flex-shrink-0">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors",
                count > 0
                  ? s.stage === 'tpa_query'
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-700"
                  : "text-slate-400"
              )}>
                <s.icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{s.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "ml-0.5 h-4 min-w-4 px-1 rounded-full flex items-center justify-center text-[10px] font-bold",
                    s.stage === 'tpa_query' ? "bg-red-500 text-white" : "bg-slate-700 text-white"
                  )}>{count}</span>
                )}
              </div>
              {i < STAGES.length - 1 && (
                <div className="w-5 flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-px bg-slate-300" />
                  <div className="border-l-[4px] border-l-slate-300 border-y-[3px] border-y-transparent -ml-px" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Kanban board ────────────────────────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-4 flex-1 items-start">
        {STAGES.map(cfg => {
          const colClaims = claimsForStage(cfg.stage)
          const isUrgent  = cfg.stage === 'tpa_query' && colClaims.length > 0
          return (
            <div
              key={cfg.stage}
              className={cn(
                "flex-shrink-0 w-[276px] rounded-2xl border border-t-[3px] flex flex-col max-h-full",
                "border-slate-200/70",
                cfg.borderTop,
                isUrgent ? "shadow-[0_0_0_1px_rgba(239,68,68,0.15),0_4px_16px_rgba(239,68,68,0.08)]" : ""
              )}
              style={{ background: 'rgba(248,250,252,0.8)' }}
            >
              {/* Column header */}
              <div className={cn("px-4 pt-3.5 pb-3 rounded-t-xl border-b border-slate-200/50", cfg.headerBg)}>
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg.iconRing)}>
                    <cfg.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">{cfg.label}</p>
                      {isUrgent && (
                        <span className="relative flex h-2 w-2 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight truncate">{cfg.description}</p>
                  </div>
                  <span className={cn(
                    "h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0",
                    isUrgent ? cfg.badgeCls : colClaims.length > 0 ? cfg.badgeCls : "bg-slate-200/80 text-slate-500"
                  )}>
                    {colClaims.length}
                  </span>
                </div>
              </div>

              {/* Card list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {colClaims.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-3">
                    <div className="h-12 w-12 rounded-xl bg-slate-100/80 flex items-center justify-center mb-3">
                      <cfg.icon className="h-5 w-5 text-slate-300" />
                    </div>
                    <p className="text-[12px] text-slate-400 font-medium">No cases here</p>
                    <p className="text-[11px] text-slate-300 mt-1 leading-snug">{cfg.description}</p>
                  </div>
                ) : (
                  colClaims.map(c => (
                    <TPAPatientCard key={c.id} claim={c} cfg={cfg} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
