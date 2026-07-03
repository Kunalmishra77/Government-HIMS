"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, Info } from "lucide-react"
import type { ConfidenceTier } from "@/types/ai"

export interface AiInsight {
  id: string
  title: string
  body: string
  confidence: number
  confidenceTier: ConfidenceTier
  reasoning?: string
  actionLabel?: string
  dismissLabel?: string
  onAccept?: () => void
  onReject?: () => void
}

interface AiInsightPanelProps {
  insights: AiInsight[]
  title?: string
  compact?: boolean
  className?: string
}

const TIER_STYLES: Record<ConfidenceTier, { bg: string; badge: string; text: string; dot: string }> = {
  high: {
    bg: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
    badge: 'linear-gradient(135deg, #059669, #10B981)',
    text: '#065F46',
    dot: '#10B981',
  },
  medium: {
    bg: 'linear-gradient(135deg, #FFF7ED, #FFFBEB)',
    badge: 'linear-gradient(135deg, #D97706, #F59E0B)',
    text: '#78350F',
    dot: '#F59E0B',
  },
  low: {
    bg: 'linear-gradient(135deg, #FEF2F2, #FFF1F2)',
    badge: 'linear-gradient(135deg, #DC2626, #EF4444)',
    text: '#7F1D1D',
    dot: '#EF4444',
  },
}

function ConfidenceMeter({ value }: { value: number }) {
  const tier: ConfidenceTier = value >= 80 ? 'high' : value >= 60 ? 'medium' : 'low'
  const color = tier === 'high' ? '#10B981' : tier === 'medium' ? '#F59E0B' : '#EF4444'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>{value}%</span>
    </div>
  )
}

function InsightCard({ insight, compact }: { insight: AiInsight; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const styles = TIER_STYLES[insight.confidenceTier]

  if (dismissed) return null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl p-4 overflow-hidden"
      style={{ background: styles.bg, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: styles.badge }}>
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: styles.text }}>{insight.title}</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: styles.badge }}>
              {insight.confidenceTier.toUpperCase()}
            </span>
          </div>
          {!compact && (
            <ConfidenceMeter value={insight.confidence} />
          )}
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: styles.text, opacity: 0.85 }}>{insight.body}</p>
        </div>
        {insight.reasoning && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/50 transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>
        )}
      </div>

      {/* Reasoning expansion */}
      <AnimatePresence>
        {expanded && insight.reasoning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/60">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: styles.text, opacity: 0.7 }} />
                <p className="text-[11px] leading-relaxed" style={{ color: styles.text, opacity: 0.75 }}>
                  {insight.reasoning}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HITL Actions */}
      {(insight.onAccept || insight.onReject) && (
        <div className="flex items-center gap-2 mt-3">
          {insight.onAccept && (
            <button
              onClick={() => { insight.onAccept?.(); setDismissed(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: '0 2px 8px rgba(5,150,105,0.25)' }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {insight.actionLabel ?? 'Accept'}
            </button>
          )}
          {insight.onReject && (
            <button
              onClick={() => { insight.onReject?.(); setDismissed(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all hover:bg-white/80"
              style={{ background: 'rgba(255,255,255,0.6)', color: styles.text }}
            >
              <XCircle className="h-3.5 w-3.5" />
              {insight.dismissLabel ?? 'Dismiss'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

export function AiInsightPanel({ insights, title = 'AI Insights', compact = false, className = '' }: AiInsightPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const activeCount = insights.length
  const urgentCount = insights.filter(i => i.confidenceTier === 'high').length

  return (
    <div className={`rounded-2xl overflow-hidden border border-border ${className}`} style={{ boxShadow: '0 2px 12px rgba(238,107,38,0.07), 0 1px 4px rgba(16,24,40,0.05)' }}>
      {/* Panel Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #9A3A14, #C2481A)' }}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-white/90" />
          <span className="text-sm font-bold text-white">{title}</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] font-black text-white">
              {activeCount}
            </span>
          )}
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-[10px] font-bold text-amber-200">
              <AlertTriangle className="h-2.5 w-2.5" /> {urgentCount} high
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/60 font-medium">HITL Active</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {collapsed ? <ChevronDown className="h-4 w-4 text-white/70" /> : <ChevronUp className="h-4 w-4 text-white/70" />}
        </div>
      </button>

      {/* Insights List */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white"
          >
            <div className="p-4 space-y-3">
              {insights.length === 0 ? (
                <div className="py-6 text-center">
                  <Sparkles className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No active AI insights</p>
                </div>
              ) : (
                insights.map(insight => (
                  <InsightCard key={insight.id} insight={insight} compact={compact} />
                ))
              )}
            </div>
            <div className="px-4 pb-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <p className="text-[10px] text-slate-400">AI suggestions require human review before action · Agentix HIMS AI v2.4</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AiInsightPanel
