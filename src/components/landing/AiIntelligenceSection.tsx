"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Brain, AlertTriangle, Sparkles, Activity, ScanLine, Siren, TrendingUp,
  MessageSquareText, ShieldCheck, Check, Bell, BellRing, ArrowRight,
} from "lucide-react"
import { useLiveHospitalStats } from "./useLiveHospitalStats"
import { Reveal } from "./Reveal"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

/* ─── Closed-loop critical-result workflow (animates through states on scroll) ─── */
const LOOP_STEPS = [
  { icon: ScanLine, title: "Detect", body: "AI flags a critical value the instant it posts", tone: "critical" as const },
  { icon: BellRing, title: "Notify", body: "Right clinician paged across in-app · SMS · WhatsApp", tone: "ai" as const },
  { icon: Check, title: "Acknowledge", body: "Receipt tracked against a 30-minute SLA clock", tone: "stable" as const },
  { icon: Siren, title: "Escalate", body: "No ack → auto-escalation up the on-call chain", tone: "caution" as const },
]
const TONE_DOT: Record<string, string> = {
  critical: "bg-[var(--color-danger)]",
  ai: "bg-[var(--color-primary)]",
  stable: "bg-[var(--color-success)]",
  caution: "bg-[var(--color-warning)]",
}

function ClosedLoopWorkflow() {
  const reduce = useReducedMotion()
  return (
    <div className="rounded-3xl border border-[#EAECF2] bg-white p-5 lg:p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 mb-5">
        <Siren className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="text-[14px] font-bold text-[#101828]">Closed-loop critical results — how a signal becomes a safe action</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
        {LOOP_STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.18, ease: EASE }}
            className="relative rounded-2xl border border-[#EAECF2] bg-[#FBFCFE] p-4"
          >
            <div className="flex items-center gap-2">
              <span className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-white", TONE_DOT[step.tone])}>
                <step.icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Step {i + 1}</span>
            </div>
            <p className="text-[14px] font-bold text-[#101828] mt-2.5">{step.title}</p>
            <p className="text-[12px] text-[#667085] mt-1 leading-relaxed">{step.body}</p>
            {i < LOOP_STEPS.length - 1 && (
              <ArrowRight className="hidden sm:block absolute -right-[11px] top-1/2 -translate-y-1/2 h-4 w-4 text-[#CBD2DC] z-10" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ─── Predictive operations mini-chart (animated bars) ─── */
const FORECAST = [
  { h: "8a", v: 42 }, { h: "10a", v: 58 }, { h: "12p", v: 76 }, { h: "2p", v: 64 }, { h: "4p", v: 88 }, { h: "6p", v: 71 },
]
function PredictiveChart() {
  const reduce = useReducedMotion()
  const peak = Math.max(...FORECAST.map(d => d.v))
  return (
    <div className="flex items-end gap-1.5 h-20 mt-3">
      {FORECAST.map((d, i) => (
        <div key={d.h} className="flex-1 flex flex-col items-center gap-1">
          <motion.span
            className={cn("w-full rounded-t-md", d.v === peak ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary)]/[0.28]")}
            initial={reduce ? false : { height: 0 }}
            whileInView={{ height: `${d.v}%` }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: EASE }}
          />
          <span className="text-[9px] font-semibold text-[#98A2B3]">{d.h}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Natural-language ops assistant demo ─── */
function NlAssistantDemo() {
  const reduce = useReducedMotion()
  return (
    <div className="rounded-2xl border border-[#EAECF2] bg-[#FBFCFE] p-4">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-[var(--color-accent)]" />
        <span className="text-[12.5px] font-bold text-[#101828]">Ask operations, in plain language</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-tr-sm bg-[#0D2032] text-white text-[12px] px-3 py-2 leading-snug">
          Which modality is causing the most TAT breaches this week?
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
          className="max-w-[90%] w-fit rounded-2xl rounded-tl-sm bg-white border border-[#EAECF2] text-[#344054] text-[12px] px-3 py-2 leading-snug"
        >
          <span className="font-bold text-[#101828]">CT</span> accounts for 61% of breaches — driven by the 2–4pm peak. Suggested: shift one technologist to the afternoon slot.
        </motion.div>
      </div>
    </div>
  )
}

export function AiIntelligenceSection() {
  const s = useLiveHospitalStats()
  const feed = s.aiFeed.length ? s.aiFeed : [{ id: "ph", tone: "info" as const, label: "Connecting", detail: "Awaiting live clinical streams…", meta: undefined }]

  return (
    <section id="intelligence" className="scroll-mt-20 py-20 lg:py-28 bg-[#FBFCFE] border-y border-[#EAECF2]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <Reveal className="max-w-2xl">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">Intelligence, demonstrated</p>
          <h2 className="text-[30px] lg:text-[38px] font-bold text-[#101828] tracking-tight mt-2">See the intelligence — not just the claim</h2>
          <p className="text-[15.5px] text-[#475467] mt-3">Most platforms say “AI-powered.” This one shows it: every signal below is generated live from the system’s own clinical and operational data — and every suggestion stays human-confirmed.</p>
        </Reveal>

        {/* Animated closed-loop workflow */}
        <Reveal className="mt-10">
          <ClosedLoopWorkflow />
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-5 mt-5">
          {/* Live AI feed + NL assistant */}
          <div className="space-y-5">
            <Reveal>
              <div className="rounded-3xl border border-[#EAECF2] bg-white shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[#EAECF2]">
                  <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-60 animate-ping" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-primary)]" /></span>
                  <Brain className="h-4 w-4 text-[var(--color-accent)]" />
                  <h3 className="text-[14px] font-bold text-[#101828]">Live AI activity</h3>
                  <span className="ml-auto text-[10.5px] font-semibold text-[#98A2B3] tabular-nums">{s.aiFindings} findings · {s.criticalAlerts} alerts</span>
                </div>
                <div className="divide-y divide-[#F2F4F8] max-h-[300px] overflow-y-auto">
                  {feed.map(item => (
                    <div key={item.id} className="flex items-start gap-3 px-5 py-3.5">
                      <span className={cn("h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0",
                        item.tone === "critical" ? "bg-red-50 text-red-600" : item.tone === "ai" ? "bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)]" : "bg-amber-50 text-amber-600")}>
                        {item.tone === "critical" ? <AlertTriangle className="h-4 w-4" /> : item.tone === "ai" ? <Sparkles className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#101828]">{item.detail}</p>
                        <p className="text-[11.5px] text-[#667085] mt-0.5">{item.label}{item.meta ? ` · ${item.meta}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-[#EAECF2] flex items-center gap-1.5 text-[11px] font-medium text-[#667085]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" /> AI assists, never replaces — every suggestion is reviewable, audited, and human-confirmed.
                </div>
              </div>
            </Reveal>
            <Reveal>
              <NlAssistantDemo />
            </Reveal>
          </div>

          {/* Capability cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Reveal>
              <div className="rounded-3xl border border-[#EAECF2] bg-white p-5 h-full hover:border-[#D0D5DD] hover:shadow-[var(--shadow-card-hover)] transition-all">
                <span className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)]"><ScanLine className="h-5 w-5" /></span>
                <h3 className="text-[15.5px] font-bold text-[#101828] mt-3">AI radiology triage</h3>
                <p className="text-[13px] text-[#667085] mt-1.5 leading-relaxed">Modality-aware detection surfaces critical studies first — pneumothorax, bleed, PE — with confidence and heatmap overlays.</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-accent)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />{s.aiFindings} live AI findings</p>
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="rounded-3xl border border-[#EAECF2] bg-white p-5 h-full hover:border-[#D0D5DD] hover:shadow-[var(--shadow-card-hover)] transition-all">
                <span className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)]"><TrendingUp className="h-5 w-5" /></span>
                <h3 className="text-[15.5px] font-bold text-[#101828] mt-3">Predictive operations</h3>
                <p className="text-[13px] text-[#667085] mt-1.5 leading-relaxed">Forecast scan volume, no-show risk and bed pressure before they bite — staffing stays ahead of demand.</p>
                <PredictiveChart />
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <div className="rounded-3xl border border-[#EAECF2] bg-white p-5 h-full hover:border-[#D0D5DD] hover:shadow-[var(--shadow-card-hover)] transition-all">
                <span className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)]"><Bell className="h-5 w-5" /></span>
                <h3 className="text-[15.5px] font-bold text-[#101828] mt-3">Closed-loop safety</h3>
                <p className="text-[13px] text-[#667085] mt-1.5 leading-relaxed">Critical values auto-detected, communicated and tracked to acknowledgment on a 30-minute SLA with escalation.</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-accent)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />{s.criticalAlerts} active alerts</p>
              </div>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="rounded-3xl border border-[#EAECF2] bg-white p-5 h-full hover:border-[#D0D5DD] hover:shadow-[var(--shadow-card-hover)] transition-all">
                <span className="h-10 w-10 rounded-xl flex items-center justify-center bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)]"><MessageSquareText className="h-5 w-5" /></span>
                <h3 className="text-[15.5px] font-bold text-[#101828] mt-3">Natural-language ops assistant</h3>
                <p className="text-[13px] text-[#667085] mt-1.5 leading-relaxed">Ask a question over live operational data and get an answer — no dashboards to hunt through.</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-accent)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />Ask anything</p>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
