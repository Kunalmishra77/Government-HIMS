"use client"

import { useState } from "react"
import { useInsuranceStore, type InsuranceClaim, type AiValidationFlag } from "@/store/useInsuranceStore"
import { validateInsuranceClaim } from "@/ai-services/insurance-preauth"
import { FileText, CheckCircle, XCircle, AlertCircle, X, Sparkles, Loader2, Send, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Upload, ListChecks } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { useAuthStore } from "@/store/useAuthStore"

const STATUS_COLOR: Record<InsuranceClaim['status'], string> = {
  'Pending Pre-Auth': 'warning',
  'Approved':         'success',
  'Rejected':         'danger',
  'In Process':       'blue',
}

const FLAG_CONFIG: Record<AiValidationFlag['severity'], { color: string; dot: string; label: string }> = {
  ok:      { color: 'text-green-700 bg-green-50 border-green-200',  dot: 'bg-green-500',  label: 'OK' },
  warning: { color: 'text-amber-700 bg-amber-50 border-amber-200',  dot: 'bg-amber-500',  label: 'Warning' },
  error:   { color: 'text-red-700 bg-red-50 border-red-200',        dot: 'bg-red-500',    label: 'Error' },
}

function ValidationPanel({ claim, onClose }: { claim: InsuranceClaim; onClose: () => void }) {
  const { setSubmissionStatus } = useInsuranceStore()
  const v = claim.aiValidation!
  const errorCount = v.flags.filter(f => f.severity === 'error').length
  const warnCount = v.flags.filter(f => f.severity === 'warning').length

  const handleSubmit = () => {
    const ref = `TPA-${claim.provider.toUpperCase().replace(/\s/g,'-')}-${Date.now().toString(36).toUpperCase()}`
    setSubmissionStatus(claim.id, 'submitted', ref)
    notifyAndAuditMany(['billing', 'patient'], {
      type: 'system', priority: 'high',
      title: `Claim submitted · ${claim.id}`,
      body: `Claim ${claim.id} for ${claim.patientName} (₹${claim.amount.toLocaleString('en-IN')}) submitted to ${claim.provider}. TPA reference: ${ref}.`,
      patientName: claim.patientName,
      audit: { action: 'insurance_claim_submitted', resource: 'claim', resourceId: claim.id, detail: `Submitted to ${claim.provider} · ref ${ref}`, userName: 'Insurance Desk' },
    })
    toast.success(`Claim ${claim.id} submitted to ${claim.provider}. Reference: ${ref}`)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="mt-3 rounded-xl border border-[rgba(238,107,38,0.20)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'linear-gradient(135deg,var(--color-primary-dark)12,var(--color-primary)0A)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-bold text-slate-900">AI Claim Validation</span>
          {errorCount > 0 && <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{errorCount} error{errorCount > 1 ? 's' : ''}</span>}
          {warnCount > 0 && <span className="text-[11px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">{warnCount} warning{warnCount > 1 ? 's' : ''}</span>}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Completeness bar */}
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-600">Claim Completeness</span>
          <span className={cn("text-sm font-black", v.completeness >= 80 ? 'text-green-600' : v.completeness >= 60 ? 'text-amber-600' : 'text-red-600')}>
            {v.completeness}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", v.completeness >= 80 ? 'bg-green-500' : v.completeness >= 60 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${v.completeness}%` }}
          />
        </div>
      </div>

      {/* Per-field flags */}
      <div className="divide-y divide-slate-50 bg-white">
        {v.flags.map((flag, i) => {
          const cfg = FLAG_CONFIG[flag.severity]
          return (
            <div key={i} className={cn("flex items-start gap-3 px-4 py-2.5 border-l-2", flag.severity === 'error' ? 'border-l-red-400 bg-red-50/30' : flag.severity === 'warning' ? 'border-l-amber-400 bg-amber-50/20' : 'border-l-green-400')}>
              <span className={cn("h-2 w-2 rounded-full flex-shrink-0 mt-1.5", cfg.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">{flag.field}</p>
                <p className="text-xs text-slate-500 mt-0.5">{flag.message}</p>
              </div>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0", cfg.color)}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          {v.canSubmit ? 'Ready for digital submission' : 'Resolve errors before submitting'}
        </p>
        {v.canSubmit ? (
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer"
            style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))', boxShadow: '0 2px 8px rgba(238,107,38,0.25)' }}
          >
            <Send className="h-4 w-4" /> Submit to TPA
          </button>
        ) : (
          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
            <XCircle className="h-4 w-4" /> Fix errors to enable submission
          </span>
        )}
      </div>
    </motion.div>
  )
}

function ReviewModal({ claim, onClose }: { claim: InsuranceClaim; onClose: (action?: 'approve' | 'reject') => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="review-title"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="review-title" className="text-lg font-bold text-slate-900">Review Claim</h2>
          <button onClick={() => onClose()} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-3 mb-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Claim Details</p>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="font-medium text-slate-500">Claim ID</span>   <span className="font-bold text-slate-900">{claim.id}</span>
              <span className="font-medium text-slate-500">Patient</span>    <span className="font-bold text-slate-900">{claim.patientName}</span>
              <span className="font-medium text-slate-500">Provider</span>   <span className="font-bold text-slate-900">{claim.provider}</span>
              <span className="font-medium text-slate-500">Amount</span>     <span className="font-bold text-slate-900">₹{claim.amount.toLocaleString('en-IN')}</span>
              <span className="font-medium text-slate-500">Status</span>     <span className="font-bold text-slate-900">{claim.status}</span>
            </div>
          </div>
          {claim.aiProbability !== undefined && (
            <div className={`p-3 rounded-xl border flex items-center gap-3 ${claim.aiProbability >= 80 ? 'bg-green-50 border-green-200' : claim.aiProbability >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <AlertCircle className={`h-5 w-5 flex-shrink-0 ${claim.aiProbability >= 80 ? 'text-green-600' : claim.aiProbability >= 50 ? 'text-amber-600' : 'text-red-600'}`} />
              <div>
                <p className="text-xs font-bold text-slate-700">AI Approval Probability</p>
                <p className={`text-lg font-black ${claim.aiProbability >= 80 ? 'text-green-700' : claim.aiProbability >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                  {claim.aiProbability}%
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => onClose('reject')} className="flex-1 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm transition-colors cursor-pointer border border-red-200 flex items-center justify-center gap-2">
            <XCircle className="h-4 w-4" /> Reject
          </button>
          <button onClick={() => onClose('approve')} className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" /> Approve
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function InsuranceClaimsPage() {
  const claims              = useInsuranceStore(s => s.claims)
  const setValidation       = useInsuranceStore(s => s.setValidation)
  const setStatus           = useInsuranceStore(s => s.setStatus)
  const computeDenialRisk   = useInsuranceStore(s => s.computeDenialRisk)
  const uploadDocument      = useInsuranceStore(s => s.uploadDocument)

  const [reviewing, setReviewing]     = useState<InsuranceClaim | null>(null)
  const [filter, setFilter]           = useState<'All' | InsuranceClaim['status']>('All')
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [expandedValidationId, setExpandedValidationId] = useState<string | null>(null)
  const [expandedDocsId, setExpandedDocsId] = useState<string | null>(null)
  const currentUser = useAuthStore(s => s.currentUser)
  const actor = currentUser?.name ?? 'Insurance Desk'

  const handleReviewClose = (action?: 'approve' | 'reject') => {
    if (action && reviewing) {
      const newStatus = action === 'approve' ? 'Approved' : 'Rejected'
      setStatus(reviewing.id, newStatus, { actor, approvedAmount: action === 'approve' ? reviewing.amount : undefined })
      notifyAndAuditMany(['billing', 'patient'], {
        type: 'system', priority: action === 'reject' ? 'high' : 'medium',
        title: `Claim ${newStatus} · ${reviewing.patientName}`,
        body: `Claim ${reviewing.id} for ${reviewing.patientName} (${reviewing.provider}, ₹${reviewing.amount.toLocaleString('en-IN')}) ${newStatus.toLowerCase()} by ${actor}.`,
        patientName: reviewing.patientName,
        audit: { action: 'insurance_claim_submitted', resource: 'claim', resourceId: reviewing.id, detail: `Claim ${newStatus} by ${actor}`, userName: actor },
      })
      toast.success(`Claim ${reviewing.id} ${newStatus}`)
    }
    setReviewing(null)
  }

  const handleValidate = async (claim: InsuranceClaim) => {
    setValidatingId(claim.id)
    const result = await validateInsuranceClaim(claim.id)
    setValidation(claim.id, result.data)
    computeDenialRisk(claim.id)
    setExpandedValidationId(claim.id)
    setValidatingId(null)
    toast.success(`AI validation complete — ${result.data.completeness}% complete`)
  }

  const filtered = claims.filter(c => filter === 'All' || c.status === filter)
  const totalValue = claims.reduce((sum, c) => sum + c.amount, 0)
  const pending = claims.filter(c => c.status === 'Pending Pre-Auth' || c.status === 'In Process').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Active Claims</h1>
        <p className="text-sm text-[#64748B] mt-1">Manage insurance claims, AI validation, and digital TPA submission</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[rgba(238,107,38,0.07)]/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-dark)]/60 mb-1">Total Claims Value</p>
          <p className="text-xl font-black text-[#0F172A]">₹{(totalValue / 100000).toFixed(1)}L</p>
        </div>
        <div className="rounded-xl bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60 mb-1">Pending Review</p>
          <p className="text-xl font-black text-[#0F172A]">{pending}</p>
        </div>
        <div className="rounded-xl bg-green-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-800/60 mb-1">Approved</p>
          <p className="text-xl font-black text-[#0F172A]">{claims.filter(c => c.status === 'Approved').length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Pending Pre-Auth', 'In Process', 'Approved', 'Rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filter === f ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Claims */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FileText className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-semibold">No claims in this status</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(claim => (
            <Card key={claim.id} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-[rgba(238,107,38,0.07)]/80 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#0F172A] text-sm">{claim.id}</p>
                      <NeonBadge variant={STATUS_COLOR[claim.status] as any}>{claim.status}</NeonBadge>
                      {claim.submissionStatus === 'submitted' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] px-2 py-0.5 rounded-full border border-[rgba(238,107,38,0.20)]">
                          <Send className="h-2.5 w-2.5" /> Submitted
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#64748B] mt-0.5">{claim.patientName} · {claim.provider}</p>
                    <p className="text-xs font-bold text-[#0F172A] mt-0.5">₹{claim.amount.toLocaleString('en-IN')}</p>
                    {claim.tpaReferenceId && (
                      <p className="text-xs text-slate-400 mt-0.5">TPA Ref: {claim.tpaReferenceId}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                  {claim.aiProbability !== undefined && (
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Score</p>
                      <p className={`text-base font-black ${claim.aiProbability >= 80 ? 'text-green-600' : claim.aiProbability >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {claim.aiProbability}%
                      </p>
                    </div>
                  )}

                  {claim.aiDenialRisk && (
                    <div className="text-center" title={claim.aiDenialRisk.reasons.join(' · ')}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 justify-center">
                        <ShieldAlert className="h-2.5 w-2.5" />Denial Risk
                      </p>
                      <p className={cn("text-base font-black",
                        claim.aiDenialRisk.score >= 70 ? 'text-red-600'
                        : claim.aiDenialRisk.score >= 40 ? 'text-amber-600' : 'text-green-600')}>
                        {claim.aiDenialRisk.score}<span className="text-[10px] text-slate-400">/100</span>
                      </p>
                    </div>
                  )}

                  {(claim.documents?.length ?? 0) > 0 && (
                    <button
                      onClick={() => setExpandedDocsId(prev => prev === claim.id ? null : claim.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                      Docs <span className="text-slate-500">
                        {(claim.documents ?? []).filter(d => d.status === 'verified').length}/{claim.documents?.length}
                      </span>
                      {expandedDocsId === claim.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}

                  {/* AI Validate & Submit button — shown for non-submitted claims */}
                  {claim.submissionStatus !== 'submitted' && claim.status !== 'Rejected' && (
                    <button
                      onClick={() => {
                        if (claim.aiValidation) {
                          setExpandedValidationId(prev => prev === claim.id ? null : claim.id)
                        } else {
                          handleValidate(claim)
                        }
                      }}
                      disabled={validatingId === claim.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-60 transition-all"
                      style={{ background: 'linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))', boxShadow: '0 2px 8px rgba(238,107,38,0.25)' }}
                    >
                      {validatingId === claim.id
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating…</>
                        : claim.aiValidation
                          ? <><ShieldCheck className="h-3.5 w-3.5" /> {expandedValidationId === claim.id ? 'Hide' : 'View'} Validation {expandedValidationId === claim.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</>
                          : <><Sparkles className="h-3.5 w-3.5" /> Validate & Submit</>
                      }
                    </button>
                  )}

                  {(claim.status === 'Pending Pre-Auth' || claim.status === 'In Process') && (
                    <button
                      onClick={() => setReviewing(claim)}
                      className="px-4 py-2 rounded-xl bg-[rgba(238,107,38,0.07)]/80 hover:bg-[rgba(238,107,38,0.14)] text-[var(--color-accent)] text-sm font-bold transition-colors cursor-pointer shadow-sm"
                    >
                      Review
                    </button>
                  )}
                  {claim.status === 'Approved' && (
                    <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                      <CheckCircle className="h-4 w-4" /> Approved
                    </div>
                  )}
                  {claim.status === 'Rejected' && (
                    <div className="flex items-center gap-1 text-sm font-bold text-red-600">
                      <XCircle className="h-4 w-4" /> Rejected
                    </div>
                  )}
                </div>
              </div>

              {/* AI Validation Panel */}
              <AnimatePresence>
                {expandedValidationId === claim.id && claim.aiValidation && (
                  <ValidationPanel
                    claim={{ ...claim, aiValidation: claim.aiValidation }}
                    onClose={() => setExpandedValidationId(null)}
                  />
                )}
              </AnimatePresence>

              {/* Documents panel */}
              <AnimatePresence>
                {expandedDocsId === claim.id && (claim.documents?.length ?? 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="mt-3 rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-bold text-slate-900">Claim documents</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">
                        {(claim.documents ?? []).filter(d => d.status === 'verified').length}/{claim.documents?.length} verified
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                      {(claim.documents ?? []).map(d => (
                        <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                          <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                            {d.uploadedAt && (
                              <p className="text-[10px] text-slate-400">
                                Uploaded {new Date(d.uploadedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                            {d.rejectionReason && (
                              <p className="text-[11px] text-red-600">{d.rejectionReason}</p>
                            )}
                          </div>
                          {d.status === 'verified' ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-50 text-green-700 ring-1 ring-green-200">Verified</span>
                          ) : d.status === 'rejected' ? (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-50 text-red-700 ring-1 ring-red-200">Rejected</span>
                          ) : (
                            <button
                              onClick={() => {
                                uploadDocument(claim.id, d.id)
                                notifyAndAudit({
                                  to: 'audit_officer', type: 'system', priority: 'low',
                                  title: `Claim doc uploaded · ${claim.id}`,
                                  body: `${d.name} uploaded for claim ${claim.id} (${claim.patientName}) by ${actor}.`,
                                  patientName: claim.patientName,
                                  audit: { action: 'insurance_doc_upload', resource: 'claim', resourceId: claim.id, detail: `Uploaded: ${d.name}`, userName: actor },
                                })
                                toast.success(`${d.name} uploaded`)
                              }}
                              className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.12)] px-2 py-1 rounded-lg cursor-pointer"
                            >
                              <Upload className="h-3 w-3" />Upload
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {claim.aiDenialRisk && (
                      <div className="px-4 py-3 bg-[rgba(238,107,38,0.07)]/40 border-t border-[rgba(238,107,38,0.15)] text-xs">
                        <p className="font-bold text-[var(--color-primary-dark)] flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5" />AI denial-risk · {claim.aiDenialRisk.score}/100
                        </p>
                        <ul className="mt-1 ml-5 list-disc text-[var(--color-accent)] space-y-0.5">
                          {claim.aiDenialRisk.reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}

      <AnimatePresence>
        {reviewing && <ReviewModal claim={reviewing} onClose={handleReviewClose} />}
      </AnimatePresence>
    </div>
  )
}
