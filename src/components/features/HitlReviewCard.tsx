"use client"

import { useState, type ReactNode } from "react"
import { CheckCircle, XCircle, Edit3, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { confidenceBorderColor, confidenceBgColor } from "@/lib/ai-helpers"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { AiFeedbackButtons } from "@/components/features/AiFeedbackButtons"
import { useAuditStore } from "@/store/useAuditStore"
import { useAuthStore } from "@/store/useAuthStore"
import type { AiEnvelope } from "@/types/ai"

interface HitlReviewCardProps<T> {
  envelope: AiEnvelope<T>
  title: string
  featureId: string
  renderContent: (data: T) => ReactNode
  onAccept: (data: T) => void
  onReject: (reason: string) => void
  onModify?: (data: T) => void
  className?: string
  shadowMode?: boolean
}

export function HitlReviewCard<T>({
  envelope,
  title,
  featureId,
  renderContent,
  onAccept,
  onReject,
  onModify,
  className,
  shadowMode = false,
}: HitlReviewCardProps<T>) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'rejected' | 'modifying'>('pending')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectInput, setShowRejectInput] = useState(false)
  const log = useAuditStore((s) => s.log)
  const { currentUser } = useAuthStore()

  const logDecision = (action: 'hitl_accept' | 'hitl_reject' | 'hitl_modify', reason?: string) => {
    log({
      userId: currentUser?.id ?? 'unknown',
      userName: currentUser?.name ?? 'Unknown',
      action,
      resource: 'ai_suggestion',
      resourceId: featureId,
      detail: reason ?? action,
      before: { status: 'pending' },
      after: { status: action.replace('hitl_', '') },
    })
  }

  const handleAccept = () => {
    setStatus('accepted')
    logDecision('hitl_accept')
    onAccept(envelope.data)
  }

  const handleReject = () => {
    if (!rejectReason.trim()) { setShowRejectInput(true); return }
    setStatus('rejected')
    logDecision('hitl_reject', rejectReason)
    onReject(rejectReason)
  }

  const handleModify = () => {
    setStatus('modifying')
    logDecision('hitl_modify')
    onModify?.(envelope.data)
  }

  const tierLabel = {
    high: 'AI Suggested — Auto-apply available',
    medium: 'Review Required',
    low: 'Manual Entry Recommended',
  }[envelope.confidenceTier]

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden transition-all",
      confidenceBorderColor(envelope.confidenceTier),
      status === 'accepted' && 'border-green-400',
      status === 'rejected' && 'border-slate-300 opacity-60',
      className
    )}>
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center justify-between gap-3", confidenceBgColor(envelope.confidenceTier))}>
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 text-slate-500 flex-shrink-0" />
          <p className="font-semibold text-slate-800 text-sm truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <AiConfidenceBadge confidence={envelope.confidence} tier={envelope.confidenceTier} reasoning={envelope.reasoning} />
        </div>
      </div>

      <div className="p-4 bg-white space-y-3">
        {/* Tier label */}
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{tierLabel}</p>

        {/* Content */}
        <div>{renderContent(envelope.data)}</div>

        <AiDisclaimer compact />

        {/* Shadow mode banner */}
        {shadowMode && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs font-semibold">
            <Bot className="h-3.5 w-3.5 flex-shrink-0" />
            Shadow Mode — AI suggestions visible for observation only. Actions are disabled.
          </div>
        )}

        {/* Actions */}
        {status === 'pending' && (
          <div className={cn("flex items-center gap-2 pt-1", shadowMode && "pointer-events-none opacity-40 select-none")}>
            <button
              onClick={handleAccept}
              title={shadowMode ? 'Actions disabled in Shadow Mode' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <CheckCircle className="h-4 w-4" /> Accept
            </button>
            {onModify && (
              <button
                onClick={handleModify}
                title={shadowMode ? 'Actions disabled in Shadow Mode' : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Edit3 className="h-4 w-4" /> Modify
              </button>
            )}
            <button
              onClick={() => setShowRejectInput(true)}
              title={shadowMode ? 'Actions disabled in Shadow Mode' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-400 text-sm font-semibold rounded-lg transition-colors"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
            <div className="ml-auto">
              <AiFeedbackButtons featureId={featureId} envelopeId={featureId} />
            </div>
          </div>
        )}

        {showRejectInput && status === 'pending' && (
          <div className="flex gap-2 items-start">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleReject()}
            />
            <button
              onClick={handleReject}
              className="px-3 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700"
            >
              Confirm
            </button>
          </div>
        )}

        {status === 'accepted' && (
          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
            <CheckCircle className="h-4 w-4" /> Accepted and applied
          </div>
        )}
        {status === 'rejected' && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <XCircle className="h-4 w-4" /> Rejected — {rejectReason}
          </div>
        )}
        {status === 'modifying' && (
          <div className="flex items-center gap-2 text-[var(--color-accent)] text-sm font-semibold">
            <Edit3 className="h-4 w-4" /> Editing mode activated
          </div>
        )}
      </div>
    </div>
  )
}
