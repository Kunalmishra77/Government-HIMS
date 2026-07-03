"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Navigation, FlaskConical, Sparkles, MessageSquare, CheckCircle2 } from "lucide-react"
import { usePatientLiveStore, type LiveEventType } from "@/store/usePatientLiveStore"
import { cn } from "@/lib/utils"

const ICON: Record<LiveEventType, React.ElementType> = {
  progress: CheckCircle2, call: Navigation, result: FlaskConical, ai: Sparkles, message: MessageSquare, info: Bell,
}
const TINT: Record<LiveEventType, string> = {
  progress: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  call: "bg-emerald-50 text-emerald-600",
  result: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  ai: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  message: "bg-surface-sunken text-accent",
  info: "bg-slate-100 text-slate-500",
}

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.floor((now - ts) / 1000))
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function LiveFeed() {
  const events = usePatientLiveStore(s => s.events)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t) }, [])

  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] h-full flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <h3 className="text-[15px] font-bold text-slate-900">Live activity</h3>
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          Live
        </span>
      </div>
      <div className="px-3 py-3 space-y-1 overflow-y-auto" style={{ maxHeight: 460 }}>
        <AnimatePresence initial={false}>
          {events.map(e => {
            const I = ICON[e.type]
            return (
              <motion.div key={e.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0", TINT[e.type])}>
                  <I className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-slate-900 leading-snug">{e.title}</p>
                  {e.detail && <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{e.detail}</p>}
                  {e.room && <p className="text-[12px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1"><Navigation className="h-3 w-3" /> {e.room}</p>}
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap">{ago(e.at, now)}</span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
