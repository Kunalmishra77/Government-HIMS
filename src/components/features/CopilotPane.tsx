"use client"

import { useState, useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, RefreshCw, X, Zap, AlertTriangle, Info, ChevronRight, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { AiConfidenceBadge } from "@/components/ui/AiConfidenceBadge"
import { AiFeedbackButtons } from "@/components/features/AiFeedbackButtons"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { useAuthStore } from "@/store/useAuthStore"
import { useAuditStore } from "@/store/useAuditStore"
import { FLAGS } from "@/config/feature-flags"
import { invokeCopilot, type CopilotRole, type CopilotInsight, type CopilotContext } from "@/ai-services/copilot-orchestrator"
import type { AiEnvelope } from "@/types/ai"

interface CopilotPaneProps {
  role: CopilotRole
  patientId?: string
  patientName?: string
  wardId?: string
}

const PRIORITY_STYLES = {
  urgent: {
    border: 'border-l-red-400',
    icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />,
  },
  info: {
    border: 'border-l-slate-400',
    icon: <Info className="h-3.5 w-3.5 text-[var(--color-accent)] flex-shrink-0" />,
  },
  suggestion: {
    border: 'border-l-amber-400',
    icon: <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />,
  },
}

function InsightBubble({ envelope, shadowMode }: { envelope: AiEnvelope<CopilotInsight>; shadowMode: boolean }) {
  const insight = envelope.data
  const styles = PRIORITY_STYLES[insight.priority]

  return (
    <div className={cn("bg-white rounded-xl border border-slate-100 border-l-4 p-3.5 shadow-sm", styles.border)}>
      {/* Title row */}
      <div className="flex items-start gap-2 mb-2">
        {styles.icon}
        <span className="flex-1 text-sm font-semibold text-slate-800 leading-tight">{insight.title}</span>
        <AiConfidenceBadge confidence={envelope.confidence} tier={envelope.confidenceTier} reasoning={envelope.reasoning} />
      </div>

      {/* Body */}
      <p className="text-xs text-slate-600 leading-relaxed mb-2.5">{insight.body}</p>

      {/* Actions */}
      {insight.actions && insight.actions.length > 0 && (
        <div className={cn("flex flex-wrap gap-1.5 mb-2.5", shadowMode && "pointer-events-none opacity-40")}>
          {insight.actions.map((action) => (
            <button
              key={action.id}
              className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 font-medium transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-50">
        <span className="text-[10px] text-slate-300">{insight.sourceService}</span>
        <AiFeedbackButtons featureId={`copilot-${insight.id}`} envelopeId={`copilot-${insight.id}`} />
      </div>
    </div>
  )
}

export function CopilotPane({ role, patientId, patientName, wardId }: CopilotPaneProps) {
  const { currentUser } = useAuthStore()
  const log = useAuditStore((s) => s.log)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<AiEnvelope<CopilotInsight>[]>([])
  const [chips, setChips] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)

  const shadowMode = FLAGS.shadowMode
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const ctx: CopilotContext = {
        role,
        patientId,
        patientName,
        wardId,
        view: typeof window !== 'undefined' ? window.location.pathname : `/${role}`,
        userId: currentUser?.id ?? 'unknown',
        userName: currentUser?.name ?? 'Unknown',
      }
      const response = await invokeCopilot(ctx)
      setInsights(response.insights)
      setChips(response.chips)
      setSessionId(response.sessionId)
      setHasLoaded(true)

      log({
        userId: ctx.userId,
        userName: ctx.userName,
        action: 'copilot_invoked',
        resource: 'ai_copilot',
        resourceId: response.sessionId,
        detail: `${role} copilot refreshed on ${ctx.view}`,
        after: { insightCount: response.insights.length, sessionId: response.sessionId },
      })
    } finally {
      setLoading(false)
    }
  }, [role, patientId, patientName, wardId, currentUser, log])

  if (!FLAGS.copilotEnabled) return null
  if (!mounted) return null

  const hasUnread = hasLoaded && !open && insights.length > 0

  return createPortal(
    <>
      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="copilot-chat"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-[380px] max-h-[580px] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            style={{ position: 'fixed', bottom: '96px', right: '24px', zIndex: 9999 }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
            >
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Bot className="h-[18px] w-[18px] text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight">AI Copilot</p>
                <p className="text-[#F58C4E] text-[11px] capitalize">{role} assistant</p>
              </div>
              {shadowMode && (
                <span className="text-[10px] font-bold bg-amber-400/30 text-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Shadow
                </span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                aria-label="Close AI Copilot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Context chips */}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                {chips.map((chip) => (
                  <span key={chip} className="text-[10px] font-medium bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] px-2 py-0.5 rounded-full border border-primary/20">
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
              {/* Ready state */}
              {!hasLoaded && !loading && (
                <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[rgba(238,107,38,0.12)] flex items-center justify-center">
                    <Bot className="h-6 w-6 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Ready to assist</p>
                    <p className="text-xs text-slate-400 mt-1">Tap below to load AI insights for this view.</p>
                  </div>
                  <button
                    onClick={refresh}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
                  >
                    <Zap className="h-3.5 w-3.5" /> Get Insights
                  </button>
                </div>
              )}

              {/* Loading skeletons */}
              {loading && (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              )}

              {/* No results */}
              {!loading && hasLoaded && insights.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-400">No insights available for this context.</p>
                </div>
              )}

              {/* Insight bubbles */}
              {!loading && insights.map((envelope) => (
                <InsightBubble key={envelope.data.id} envelope={envelope} shadowMode={shadowMode} />
              ))}

              {/* Disclaimer */}
              {!loading && hasLoaded && (
                <div className="pt-1">
                  <AiDisclaimer compact />
                  {sessionId && (
                    <p className="text-[10px] text-slate-300 mt-1 text-center">Session: {sessionId}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer — Refresh */}
            <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <button
                onClick={refresh}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                {loading ? 'Loading insights…' : 'Refresh Insights'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Action Button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-200 flex items-center justify-center"
        style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' }}
        title={open ? 'Close AI Copilot' : 'Open AI Copilot'}
        aria-label={open ? 'Close AI Copilot' : 'Open AI Copilot'}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-6 w-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Bot className="h-6 w-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread count badge */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
            {insights.length > 9 ? '9+' : insights.length}
          </span>
        )}

        {/* Pulse ring when open */}
        {open && (
          <span className="absolute inset-0 rounded-full ring-2 ring-primary/25 ring-offset-2 animate-pulse pointer-events-none" />
        )}
      </button>
    </>,
    document.body
  )
}
