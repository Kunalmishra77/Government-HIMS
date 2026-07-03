"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock, CheckCircle, Stethoscope, Pill, CreditCard,
  Sparkles, Bell, ChevronRight, Activity, Users,
  BedDouble, Scissors, ShieldCheck,
} from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { ProgressRing } from "@/components/ui/progress-ring"
import { usePatientStore } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useDischargeStore } from "@/store/useDischargeStore"
import { cn } from "@/lib/utils"

const IPD_JOURNEY = [
  { id: 'admitted', label: 'Admitted' },
  { id: 'investigations', label: 'Investigations' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'discharge_prep', label: 'Discharge Prep' },
  { id: 'discharged', label: 'Discharged' },
]

function IPDFamilyTracker() {
  const { dischargeQueue } = useDischargeStore()
  const ipd = dischargeQueue[0]

  if (!ipd) return (
    <div className="hms-card p-8 text-center text-slate-400">
      <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p className="font-semibold">No admitted patient linked to this account</p>
    </div>
  )

  const allClear = Object.values(ipd.clearances).every(v => v === 'cleared')
  const clearedCount = Object.values(ipd.clearances).filter(v => v === 'cleared').length
  const totalPillars = Object.keys(ipd.clearances).length
  const activeBlockers = ipd.blockers.filter(b => !b.resolvedAt)

  const journeyStep = allClear ? 4 : clearedCount >= 3 ? 3 : clearedCount >= 1 ? 2 : 0

  const CLEARANCE_LABELS: Record<string, string> = {
    doctor: "Doctor's clearance",
    nursing: "Nursing handover",
    pharmacy: "Pharmacy — take-home meds",
    billing: "Final bill settled",
    insurance: "Insurance / TPA clearance",
  }

  return (
    <div className="space-y-5">
      {/* Patient info card */}
      <div className="hms-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Admitted Patient</p>
            <h2 className="text-xl font-bold text-slate-900">{ipd.patientName}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{ipd.wardBed}</p>
            <p className="text-sm text-slate-500">{ipd.attendingDoctor}</p>
          </div>
          <NeonBadge variant={ipd.condition === 'Stable' ? 'success' : ipd.condition === 'Critical' ? 'danger' : 'warning'} dot pulse>
            {ipd.condition}
          </NeonBadge>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Admitted {new Date(ipd.admittedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      {/* OT status — shown if in OT */}
      {ipd.inOT && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl"
        >
          <Scissors className="h-5 w-5 text-[var(--color-accent)] flex-shrink-0 animate-pulse" />
          <div>
            <p className="text-sm font-bold text-[var(--color-primary-dark)]">Surgery in progress</p>
            <p className="text-xs text-[var(--color-accent)] mt-0.5">{ipd.otProcedure} · Expected completion {ipd.otExpectedEnd}</p>
          </div>
        </motion.div>
      )}

      {/* Journey stepper */}
      <div className="hms-card p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Patient Journey</p>
        <div className="relative flex items-start justify-between">
          <div className="absolute top-6 left-6 right-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[rgba(238,107,38,0.07)]0 rounded-full transition-all duration-700"
              style={{ width: `${(journeyStep / (IPD_JOURNEY.length - 1)) * 100}%` }}
            />
          </div>
          {IPD_JOURNEY.map((step, i) => {
            const done = i < journeyStep
            const active = i === journeyStep
            return (
              <div key={step.id} className="flex flex-col items-center gap-2 z-10 w-16">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center border-2 transition-all",
                  done ? "bg-green-50 border-green-500" :
                  active ? "bg-[rgba(238,107,38,0.07)] border-[var(--color-primary)] ring-4 ring-primary/20" :
                  "bg-white border-slate-200"
                )}>
                  {done
                    ? <CheckCircle className="h-5 w-5 text-green-500" />
                    : <BedDouble className={cn("h-5 w-5", active ? "text-[var(--color-accent)]" : "text-slate-300")} />
                  }
                </div>
                <p className={cn("text-[10px] font-bold text-center leading-tight",
                  done ? "text-green-600" : active ? "text-[var(--color-accent)]" : "text-slate-400"
                )}>
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Discharge clearance tasks */}
      {journeyStep >= 3 && (
        <div className="hms-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Steps to Discharge ({clearedCount}/{totalPillars} done)
          </p>
          <div className="space-y-2">
            {Object.entries(ipd.clearances).map(([pillar, status]) => (
              <div key={pillar} className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                status === 'cleared' ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-slate-200"
              )}>
                {status === 'cleared'
                  ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  : <div className="h-5 w-5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                }
                <span className={cn("text-sm font-semibold", status === 'cleared' ? "text-green-800" : "text-slate-700")}>
                  {CLEARANCE_LABELS[pillar]}
                </span>
                <span className={cn("ml-auto text-xs font-bold", status === 'cleared' ? "text-green-600" : "text-slate-400")}>
                  {status === 'cleared' ? "Done" : "Pending"}
                </span>
              </div>
            ))}
          </div>
          {activeBlockers.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-bold text-amber-800 mb-1">Active blockers ({activeBlockers.length})</p>
              {activeBlockers.map(b => (
                <p key={b.id} className="text-xs text-amber-700">• {b.description}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-xl flex items-start gap-3 bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)]">
        <ShieldCheck className="h-5 w-5 mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
        <p className="text-sm font-medium leading-relaxed text-[var(--color-primary-dark)]">
          <strong className="text-[var(--color-primary-dark)]">Privacy note:</strong> Clinical details are not shown here. For medical updates, please speak directly with the treating doctor or nursing team.
        </p>
      </div>
    </div>
  )
}

const STEPS = [
  { id: 'arrived',     label: 'Arrived',       icon: CheckCircle },
  { id: 'vitals',      label: 'Vitals',         icon: Activity },
  { id: 'consulting',  label: 'Consulting',     icon: Stethoscope },
  { id: 'pharmacy',    label: 'Pharmacy',       icon: Pill },
  { id: 'billing',     label: 'Billing',        icon: CreditCard },
]

const AI_MESSAGES = [
  'Analysing your symptoms for triage score…',
  'Cross-referencing with medical history database…',
  'Generating patient brief for Dr. Priya Nair…',
  'Flagging potential drug interactions…',
  'Brief ready — doctor is now reviewing your details…',
]

function getFirstName(name: string) { return name.split(' ')[0] }

export default function WaitingRoomPage() {
  const { patients } = usePatientStore()
  const { currentUser } = useAuthStore()
  const myPatient = patients.find(p => p.id === (currentUser?.id ?? 'PT-20394'))

  const waiting = patients.filter(p => ['waiting', 'vitals'].includes(p.queueStatus))
  const myPosition = myPatient ? waiting.findIndex(p => p.id === myPatient.id) + 1 : 4

  const [queuePos, setQueuePos] = useState(myPosition || 4)
  const [waitMin, setWaitMin] = useState(myPatient?.estimatedWait ?? 18)
  const [currentStep] = useState<string>(myPatient?.queueStatus ?? 'vitals')
  const [aiMsgIdx, setAiMsgIdx] = useState(0)
  const [viewMode, setViewMode] = useState<'opd' | 'ipd'>('opd')
  const [notifications] = useState([
    { id: 1, text: 'Your vitals have been recorded.', time: '2 min ago', icon: Activity, color: 'text-green-500', bg: 'bg-green-50' },
    { id: 2, text: 'AI brief sent to Dr. Priya Nair.', time: '1 min ago', icon: Sparkles, color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]' },
    { id: 3, text: '3 patients ahead of you.', time: 'Just now', icon: Users, color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]' },
  ])

  /* Simulate queue countdown */
  useEffect(() => {
    const t = setInterval(() => {
      setWaitMin(m => Math.max(0, m - 1))
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  /* Cycle AI messages */
  useEffect(() => {
    const t = setInterval(() => {
      setAiMsgIdx(i => (i + 1) % AI_MESSAGES.length)
    }, 3200)
    return () => clearInterval(t)
  }, [])

  const stepIdx = STEPS.findIndex(s => s.id === currentStep)
  const progressPct = ((stepIdx + 1) / STEPS.length) * 100

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Mode Tab */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1">
        <button onClick={() => setViewMode('opd')} className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer", viewMode === 'opd' ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          OPD Queue Status
        </button>
        <button onClick={() => setViewMode('ipd')} className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer", viewMode === 'ipd' ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          IPD Patient Tracker
        </button>
      </div>

      {viewMode === 'ipd' && <IPDFamilyTracker />}

      {viewMode === 'opd' && <>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <NeonBadge variant="blue" dot pulse className="mb-2">Digital Waiting Room</NeonBadge>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {getFirstName(myPatient?.name ?? 'Patient')}
          </h1>
          <p className="text-sm mt-1 text-slate-500 font-medium">
            Token <strong className="text-[var(--color-accent)]">#{myPatient?.token ?? '—'}</strong> • {myPatient?.department ?? 'General Medicine'} • {myPatient?.doctor ?? 'Your Doctor'}
          </p>
        </div>
        <button
          className="h-10 w-10 rounded-xl flex items-center justify-center relative bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border border-white" />
        </button>
      </motion.div>

      {/* Queue Position + Wait Time */}
      <div className="grid grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="hms-card p-6 flex items-center gap-5">
            <ProgressRing
              value={Math.max(5, 100 - queuePos * 18)}
              size={76}
              strokeWidth={6}
              color="var(--color-primary-light)"
              label={
                <span className="font-bold text-xl text-slate-900">
                  {queuePos}
                </span>
              }
            />
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Queue Position</p>
              <p className="text-3xl font-bold text-slate-900">#{queuePos} ahead</p>
              <p className="text-xs font-medium text-[var(--color-accent)] mt-1">Updates in real-time</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="hms-card p-6 flex items-center gap-5">
            <ProgressRing
              value={Math.max(5, 100 - (waitMin / 30) * 100)}
              size={76}
              strokeWidth={6}
              color="var(--color-primary-light)"
              label={
                <span className="font-bold text-base text-slate-900">
                  {waitMin}m
                </span>
              }
            />
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Est. Wait Time</p>
              <p className="text-3xl font-bold text-slate-900">{waitMin} min</p>
              <p className="text-xs font-medium text-[var(--color-accent)] mt-1">AI predicted</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Journey Steps */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="hms-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
            Your Journey
          </p>
          <div className="relative flex items-start justify-between">
            {/* Progress line */}
            <div className="absolute top-6 left-6 right-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[rgba(238,107,38,0.07)]0 rounded-full"
                style={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            {STEPS.map((s, i) => {
              const done = i < stepIdx
              const active = i === stepIdx
              const Icon = s.icon
              return (
                <div key={s.id} className="flex flex-col items-center gap-3 z-10 w-20">
                  <div
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 ${
                      done ? 'bg-green-50 border-green-500 shadow-sm' : 
                      active ? 'bg-[rgba(238,107,38,0.07)] border-[var(--color-primary)] shadow-md ring-4 ring-primary/20' : 
                      'bg-white border-slate-200'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${done ? 'text-green-500' : active ? 'text-[var(--color-accent)]' : 'text-slate-300'}`}
                    />
                  </div>
                  <p
                    className={`text-xs font-bold text-center ${done ? 'text-green-600' : active ? 'text-[var(--color-accent)]' : 'text-slate-400'}`}
                  >
                    {s.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* AI Brief Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="hms-card p-6 border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/30">
          <div className="flex items-start gap-5">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-[rgba(238,107,38,0.12)] border border-[rgba(238,107,38,0.20)]">
              <Sparkles className="h-6 w-6 text-[var(--color-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-bold text-slate-900">AI Engine</p>
                <NeonBadge variant="purple" dot pulse>Processing</NeonBadge>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={aiMsgIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-sm font-medium text-slate-600"
                >
                  {AI_MESSAGES[aiMsgIdx]}
                </motion.p>
              </AnimatePresence>
              {/* Progress bar */}
              <div className="mt-4 h-1.5 rounded-full bg-[rgba(238,107,38,0.12)]/50 overflow-hidden">
                <motion.div
                  className="h-full bg-[rgba(238,107,38,0.07)]0 rounded-full"
                  animate={{ width: [`${(aiMsgIdx / AI_MESSAGES.length) * 80}%`, `${((aiMsgIdx + 1) / AI_MESSAGES.length) * 100}%`] }}
                  transition={{ duration: 3.2 }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="hms-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Recent Updates
          </p>
          <div className="space-y-3">
            {notifications.map(n => {
              const Icon = n.icon
              return (
                <div key={n.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${n.bg}`}>
                    <Icon className={`h-4 w-4 ${n.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{n.text}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 flex-shrink-0">{n.time}</span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>

      {/* Tips */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <div className="p-4 rounded-xl flex items-start gap-3 bg-amber-50 border border-amber-200">
          <Clock className="h-5 w-5 mt-0.5 flex-shrink-0 text-amber-600" />
          <p className="text-sm font-medium leading-relaxed text-amber-800">
            <strong className="text-amber-900">Tip:</strong> The doctor already has your AI brief. Once called, your consultation will take significantly less time. Pharmacy will have your medicines ready before you arrive.
          </p>
        </div>
      </motion.div>
      </>}
    </div>
  )
}
