"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Building2, Video, Calendar, Clock, CheckCircle, CalendarClock,
  RotateCcw, X, Plus, Stethoscope, IndianRupee, CalendarX2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"

// ── Types ────────────────────────────────────────────────────────────
type Mode = "in_person" | "video"
type Status = "Confirmed" | "Upcoming" | "Completed" | "Cancelled"
type Consult = {
  id: string
  doctor: string
  specialty: string
  date: string // human label
  time: string
  mode: Mode
  status: Status
}

type Doctor = { name: string; specialty: string; fee: number }

const DOCTORS: Doctor[] = [
  { name: "Dr. Priya Nair", specialty: "General Physician", fee: 600 },
  { name: "Dr. Rohan Mehta", specialty: "Cardiologist", fee: 1200 },
  { name: "Dr. Ananya Iyer", specialty: "Dermatologist", fee: 800 },
  { name: "Dr. Vikram Rao", specialty: "ENT Specialist", fee: 700 },
]

// Next few days as selectable chips
const DAYS = [
  { key: "today", label: "Today", sub: "24 May" },
  { key: "tomorrow", label: "Tomorrow", sub: "25 May" },
  { key: "mon", label: "Mon", sub: "26 May" },
  { key: "tue", label: "Tue", sub: "27 May" },
  { key: "wed", label: "Wed", sub: "28 May" },
]
const SLOTS = ["09:30 AM", "11:00 AM", "02:15 PM", "04:00 PM", "06:30 PM"]

// ── Seed mock data ───────────────────────────────────────────────────
const SEED: Consult[] = [
  { id: "c1", doctor: "Dr. Priya Nair", specialty: "General Physician", date: "Tomorrow, 25 May", time: "11:00 AM", mode: "in_person", status: "Confirmed" },
  { id: "c2", doctor: "Dr. Rohan Mehta", specialty: "Cardiologist", date: "12 Apr 2026", time: "10:30 AM", mode: "in_person", status: "Completed" },
  { id: "c3", doctor: "Dr. Ananya Iyer", specialty: "Dermatologist", date: "Mon, 26 May", time: "04:00 PM", mode: "video", status: "Upcoming" },
  { id: "c4", doctor: "Dr. Vikram Rao", specialty: "ENT Specialist", date: "30 Apr 2026", time: "06:30 PM", mode: "video", status: "Completed" },
]

// ── Small helpers ────────────────────────────────────────────────────
const STATUS_PILL: Record<Status, string> = {
  Confirmed: "bg-green-50 text-green-700",
  Upcoming: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]",
  Completed: "bg-slate-100 text-slate-500",
  Cancelled: "bg-red-50 text-red-600",
}

function ModeBadge({ mode }: { mode: Mode }) {
  return mode === "in_person" ? (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center gap-1">
      <Building2 className="h-3 w-3" /> In-person
    </span>
  ) : (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center gap-1">
      <Video className="h-3 w-3" /> Video
    </span>
  )
}

// ── Appointment card ─────────────────────────────────────────────────
function ConsultCard({
  c, isUpcoming, onJoin, onReschedule, onCancel,
}: {
  c: Consult
  isUpcoming: boolean
  onJoin: () => void
  onReschedule: (id: string) => void
  onCancel: (id: string) => void
}) {
  const tint = c.mode === "in_person" ? "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" : "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]"
  const Icon = c.mode === "in_person" ? Building2 : Video
  const cancelled = c.status === "Cancelled"

  return (
    <div className={cn("rounded-2xl bg-slate-50 p-4", cancelled && "opacity-70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", tint)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-slate-900">{c.doctor}</p>
            <p className="text-[13px] text-slate-500">{c.specialty}</p>
            <p className="text-[12.5px] text-slate-600 mt-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> {c.date}
              <span className="text-slate-300">·</span>
              <Clock className="h-3.5 w-3.5 text-slate-400" /> {c.time}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <ModeBadge mode={c.mode} />
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", STATUS_PILL[c.status])}>{c.status}</span>
        </div>
      </div>

      {isUpcoming && !cancelled && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {c.mode === "video" && (
            <button
              onClick={onJoin}
              className="text-[13px] font-semibold text-white bg-[var(--color-primary)] px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform"
            >
              <Video className="h-4 w-4" /> Join video call
            </button>
          )}
          <button
            onClick={() => onReschedule(c.id)}
            className="text-[13px] font-semibold text-slate-700 bg-slate-100 px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <RotateCcw className="h-4 w-4" /> Reschedule
          </button>
          <button
            onClick={() => onCancel(c.id)}
            className="text-[13px] font-semibold text-red-600 bg-red-50 px-3.5 py-2 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Booking panel ────────────────────────────────────────────────────
function BookingPanel({
  defaultMode, rescheduleOf, onConfirm, onClose,
}: {
  defaultMode: Mode
  rescheduleOf?: Consult
  onConfirm: (c: Consult) => void
  onClose: () => void
}) {
  const isReschedule = !!rescheduleOf
  const initDocIdx = rescheduleOf ? Math.max(0, DOCTORS.findIndex(d => d.name === rescheduleOf.doctor)) : 0
  const initDayIdx = rescheduleOf ? Math.max(0, DAYS.findIndex(d => `${d.label}, ${d.sub}` === rescheduleOf.date)) : 1
  const initSlot = rescheduleOf && SLOTS.includes(rescheduleOf.time) ? rescheduleOf.time : SLOTS[1]

  const [mode, setMode] = useState<Mode>(rescheduleOf?.mode ?? defaultMode)
  const [docIdx, setDocIdx] = useState(initDocIdx < 0 ? 0 : initDocIdx)
  const [dayIdx, setDayIdx] = useState(initDayIdx < 0 ? 1 : initDayIdx)
  const [slot, setSlot] = useState(initSlot)

  const doc = DOCTORS[docIdx]
  const day = DAYS[dayIdx]

  const confirm = () => {
    onConfirm({
      id: rescheduleOf ? rescheduleOf.id : `c${Date.now()}`,
      doctor: doc.name,
      specialty: doc.specialty,
      date: `${day.label}, ${day.sub}`,
      time: slot,
      mode,
      status: mode === "video" ? "Upcoming" : "Confirmed",
    })
  }

  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 ring-1 ring-primary/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-bold text-slate-900">{isReschedule ? "Reschedule consultation" : "Book a new consultation"}</h3>
        <button onClick={onClose} aria-label="Close booking" className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Mode */}
      <p className="text-[12px] font-semibold text-slate-400 mb-2">Consultation mode</p>
      <div className="inline-flex p-1 rounded-xl bg-slate-100 mb-4">
        {([["in_person", "In-person", Building2], ["video", "Video", Video]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setMode(key)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all", mode === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Doctor */}
      <p className="text-[12px] font-semibold text-slate-400 mb-2">Choose doctor</p>
      <div className="space-y-2 mb-4">
        {DOCTORS.map((d, i) => (
          <button key={d.name} onClick={() => setDocIdx(i)}
            className={cn("w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-[0.99]",
              docIdx === i ? "bg-[rgba(238,107,38,0.07)]/60 ring-1 ring-primary/25" : "bg-slate-50")}>
            <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><Stethoscope className="h-5 w-5" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-slate-900">{d.name}</span>
              <span className="block text-[12.5px] text-slate-500">{d.specialty}</span>
            </span>
            <span className="text-[13px] font-bold text-slate-700 flex items-center"><IndianRupee className="h-3.5 w-3.5" />{d.fee}</span>
          </button>
        ))}
      </div>

      {/* Date */}
      <p className="text-[12px] font-semibold text-slate-400 mb-2">Pick a day</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {DAYS.map((d, i) => (
          <button key={d.key} onClick={() => setDayIdx(i)}
            className={cn("px-3 py-2 rounded-xl text-center transition-all active:scale-[0.97]",
              dayIdx === i ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-700")}>
            <span className="block text-[12.5px] font-bold leading-none">{d.label}</span>
            <span className={cn("block text-[10.5px] mt-0.5", dayIdx === i ? "text-white/80" : "text-slate-400")}>{d.sub}</span>
          </button>
        ))}
      </div>

      {/* Time */}
      <p className="text-[12px] font-semibold text-slate-400 mb-2">Pick a slot</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {SLOTS.map(s => (
          <button key={s} onClick={() => setSlot(s)}
            className={cn("px-3 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all active:scale-[0.97]",
              slot === s ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-700")}>
            {s}
          </button>
        ))}
      </div>

      <button onClick={confirm}
        className="w-full text-[14px] font-semibold text-white bg-[var(--color-primary)] px-4 py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
        <CheckCircle className="h-4.5 w-4.5" /> {isReschedule ? "Confirm reschedule" : <>Confirm booking · <IndianRupee className="h-3.5 w-3.5 -ml-1" />{doc.fee}</>}
      </button>
    </div>
  )
}

// ── Section ──────────────────────────────────────────────────────────
function Section({
  title, icon: Icon, items, isUpcoming, onJoin, onReschedule, onCancel, emptyLabel,
}: {
  title: string
  icon: React.ElementType
  items: Consult[]
  isUpcoming: boolean
  onJoin: () => void
  onReschedule: (id: string) => void
  onCancel: (id: string) => void
  emptyLabel: string
}) {
  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4.5 w-4.5 text-slate-400" />
        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
        <span className="text-[11px] font-semibold text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 p-5 flex items-center gap-2.5 text-[13px] text-slate-500">
          <CalendarX2 className="h-4.5 w-4.5 text-slate-400" /> {emptyLabel}
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(c => (
            <ConsultCard key={c.id} c={c} isUpcoming={isUpcoming} onJoin={onJoin} onReschedule={onReschedule} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default function ConsultationsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Mode>("in_person")
  const [booking, setBooking] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [consults, setConsults] = useState<Consult[]>(SEED)

  const join = () => router.push("/patient/teleconsult")
  // Reschedule opens the booking panel pre-filled for that appointment.
  const reschedule = (id: string) => { setRescheduleId(id); setBooking(true) }
  const cancel = (id: string) => {
    const c = consults.find(x => x.id === id)
    setConsults(prev => prev.map(x => (x.id === id ? { ...x, status: "Cancelled" } : x)))
    if (c) {
      notifyAndAuditMany(['reception', 'doctor'], {
        type: 'appointment', priority: 'medium',
        title: `Appointment cancelled · ${c.doctor}`,
        body: `Patient cancelled the ${c.mode === 'video' ? 'video' : 'in-person'} appointment on ${c.date} at ${c.time}.`,
        patientName: 'Kiran Patil',
        audit: { action: 'reception_registered', resource: 'appointment', resourceId: c.id, detail: `Patient cancelled appointment with ${c.doctor}`, userName: 'Kiran Patil' },
      })
      toast.success(`Cancelled · ${c.doctor}'s desk notified`)
    }
  }

  const closeBooking = () => { setBooking(false); setRescheduleId(null) }
  const submitBooking = (c: Consult) => {
    setConsults(prev => rescheduleId
      ? prev.map(x => (x.id === c.id ? c : x))   // update the rescheduled one in place
      : [c, ...prev])                            // add the new booking
    setTab(c.mode)
    closeBooking()
  }

  const rescheduleOf = rescheduleId ? consults.find(c => c.id === rescheduleId) : undefined
  const forTab = consults.filter(c => c.mode === tab)
  const upcoming = forTab.filter(c => c.status === "Confirmed" || c.status === "Upcoming")
  const past = forTab.filter(c => c.status === "Completed" || c.status === "Cancelled")

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">My Consultations</h1>
          <p className="text-[13px] text-slate-500 mt-1">Your in-person (OPD) and online video appointments</p>
        </div>
        <button
          onClick={() => { setRescheduleId(null); setBooking(b => !b) }}
          className="text-[13px] font-semibold text-white bg-[var(--color-primary)] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-[0.97] transition-transform flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> Book new
        </button>
      </div>

      {booking && (
        <BookingPanel defaultMode={tab} rescheduleOf={rescheduleOf} onConfirm={submitBooking} onClose={closeBooking} />
      )}

      {/* Mode tabs */}
      <div className="inline-flex p-1 rounded-xl bg-slate-100">
        {([["in_person", "In-person (OPD)", Building2], ["video", "Online (Video)", Video]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13.5px] font-semibold transition-all", tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <Section
        title="Upcoming" icon={CalendarClock} items={upcoming} isUpcoming
        onJoin={join} onReschedule={reschedule} onCancel={cancel}
        emptyLabel={`No upcoming ${tab === "video" ? "video" : "in-person"} consultations. Book one above.`}
      />
      <Section
        title="Past & cancelled" icon={CheckCircle} items={past} isUpcoming={false}
        onJoin={join} onReschedule={reschedule} onCancel={cancel}
        emptyLabel="No past consultations yet."
      />
    </div>
  )
}
