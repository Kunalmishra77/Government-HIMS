"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Clock, Activity, Stethoscope, Pill, CreditCard, CheckCircle, Navigation, Users, Video, CalendarCheck, FileText } from "lucide-react"
import { usePatientLiveStore, stagesFor, type OpdStage } from "@/store/usePatientLiveStore"
import { cn } from "@/lib/utils"

const STAGE_ICON: Record<OpdStage, React.ElementType> = {
  waiting: Clock, vitals: Activity, consulting: Stethoscope, pharmacy: Pill, billing: CreditCard, done: CheckCircle,
  booked: CalendarCheck, waiting_room: Clock, in_call: Video, prescription: FileText,
}

export function LiveJourneyCard() {
  const router = useRouter()
  const { mode, stage, token, aheadOfYou, etaMinutes } = usePatientLiveStore()
  const stages = stagesFor(mode)
  const idx = stages.findIndex(s => s.key === stage)
  const meta = stages[idx]
  const Icon = STAGE_ICON[stage]
  const isFirst = idx === 0
  const isDone = stage === 'done'

  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Live status</span>
        </div>
        <span className="text-[12px] font-semibold text-slate-400 flex items-center gap-1.5">
          {mode === 'video' ? <><Video className="h-3.5 w-3.5" /> Video consult</> : `Token #${token}`}
        </span>
      </div>

      <div className="px-5 pb-4">
        {/* Neutral status (waiting / booked / waiting_room / prescription) */}
        {!meta?.isCall && !isDone && (
          <motion.div key={stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-5">
            <p className="text-[15px] font-semibold text-slate-500">{meta?.label}</p>
            <p className="text-[22px] font-bold text-slate-900 tracking-tight mt-0.5">{meta?.action}</p>
            {isFirst && (
              <div className="flex gap-6 mt-4">
                <div className="flex items-center gap-2"><Users className="h-5 w-5 text-[var(--color-accent)]" /><span className="text-[15px] text-slate-700"><b className="text-slate-900">{aheadOfYou}</b> {mode === 'video' ? 'ahead in line' : 'ahead of you'}</span></div>
                <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" /><span className="text-[15px] text-slate-700">~<b className="text-slate-900">{etaMinutes}</b> min</span></div>
              </div>
            )}
          </motion.div>
        )}

        {/* "Your turn" call */}
        {meta?.isCall && (
          <motion.div key={stage} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl p-5 text-white overflow-hidden bg-gradient-to-br from-[#16A34A] to-[var(--color-primary)] shadow-[0_10px_30px_rgba(16,185,129,0.35)]">
            <motion.div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15" animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.2, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
            <div className="relative flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0"><Icon className="h-6 w-6 text-white" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-widest text-white/80">It&apos;s your turn</p>
                <p className="text-[24px] font-bold leading-tight">{meta.label}</p>
                {meta.room && <p className="text-[15px] font-semibold text-white/90 mt-0.5 flex items-center gap-1.5"><Navigation className="h-4 w-4" /> {meta.room}</p>}
                <p className="text-[14px] text-white/85 mt-1.5">{meta.action}</p>
                {meta.joinVideo ? (
                  <button onClick={() => router.push('/patient/teleconsult')} className="mt-3 inline-flex items-center gap-2 bg-white text-emerald-700 font-bold text-[14px] px-4 py-2.5 rounded-xl active:scale-[0.97] transition-transform">
                    <Video className="h-4.5 w-4.5" /> Join video call
                  </button>
                ) : (
                  <button className="mt-3 inline-flex items-center gap-2 bg-white text-emerald-700 font-semibold text-[14px] px-4 py-2 rounded-xl active:scale-[0.97] transition-transform">
                    <Navigation className="h-4 w-4" /> I&apos;m on my way
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {isDone && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl p-5 bg-surface-sunken text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-[20px] font-bold text-slate-900">{mode === 'video' ? 'Consultation complete' : 'Visit complete'}</p>
            <p className="text-[14px] text-slate-500 mt-0.5">{mode === 'video' ? 'Summary ready · medicines on the way.' : 'Your summary & follow-up plan are ready below.'}</p>
          </motion.div>
        )}
      </div>

      {/* stepper */}
      <div className="px-5 pb-5">
        <div className="flex items-center">
          {stages.map((s, i) => {
            const StepIcon = STAGE_ICON[s.key]
            const done = i < idx
            const active = i === idx
            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center transition-colors relative", done || active ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-400")}>
                    {active && <span className="absolute inset-0 rounded-full bg-[rgba(238,107,38,0.07)]0/40 animate-ping" />}
                    {done ? <CheckCircle className="h-5 w-5 relative" /> : <StepIcon className="h-4 w-4 relative" />}
                  </div>
                  <span className={cn("text-[10px] font-semibold", active ? "text-[var(--color-accent)]" : done ? "text-slate-600" : "text-slate-400")}>{s.short}</span>
                </div>
                {i < stages.length - 1 && <div className={cn("flex-1 h-0.5 mx-1 -mt-4 rounded", done ? "bg-[var(--color-primary)]" : "bg-slate-200")} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
