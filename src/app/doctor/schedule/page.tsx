"use client"

import { motion, useReducedMotion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { Calendar, Clock, ArrowRight, CheckCircle2, Video, Building2, Settings, Plane, CalendarClock } from "lucide-react"
import { usePatientStore, type QueueStatus } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

type Slot = "done" | "in-progress" | "upcoming"

// Row tint + status chip both resolve to design tokens — no raw palette values.
const SLOT_ROW: Record<Slot, string> = {
  done:          "bg-success-bg/40 border-success/15",
  "in-progress": "bg-accent-soft border-primary/20",
  upcoming:      "bg-surface border-border",
}
function slotStatus(q: QueueStatus): Slot {
  if (["pharmacy", "billing", "done"].includes(q)) return "done"
  if (q === "consulting") return "in-progress"
  return "upcoming"
}
const SLOT_LABEL_KEY: Record<Slot, string> = { done: "slotSeen", "in-progress": "slotInProgress", upcoming: "slotUpcoming" }
const SLOT_VARIANT = { done: "success", "in-progress": "blue", upcoming: "muted" } as const

// "09:10 AM" / "03:20 PM" → minutes since midnight (for correct chronological sort).
function toMinutes(t: string): number {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 0
  let h = parseInt(m[1]) % 12
  if (/pm/i.test(m[3])) h += 12
  return h * 60 + parseInt(m[2])
}

export default function DoctorSchedule() {
  const t = useTranslations('doctor')
  const router = useRouter()
  const reduce = useReducedMotion()
  const patients = usePatientStore(s => s.patients)
  const appointments = usePatientStore(s => s.appointments)
  const currentUser = useAuthStore(s => s.currentUser)
  const setCurrentPatient = useConsultationStore(s => s.setCurrentPatient)
  const profile = useDoctorProfileStore()

  const today = new Date().toISOString().slice(0, 10)
  const mine = patients
    .filter(p => p.doctor === currentUser?.name && (p.registeredDate ?? today) === today)
    .sort((a, b) => toMinutes(a.registeredAt) - toMinutes(b.registeredAt))

  const upcomingAppts = appointments
    .filter(a => a.doctorName === currentUser?.name && a.date > today && a.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))

  const openConsult = (patientId: string) => {
    const p = patients.find(x => x.id === patientId)
    if (p) setCurrentPatient(p)
    router.push('/doctor/dashboard')
  }

  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-3xl mx-auto pb-8">
      {/* AppShell already renders the "My Schedule" page title + breadcrumb, so
          the page leads with a slim context/action row instead of repeating it. */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="t-body text-foreground-lighter">
          {t.rich('schedule.patientsToday', { date: dateLabel, count: mine.length, b: (c) => <span className="font-semibold text-foreground-muted tabular-nums">{c}</span> })}
        </p>
        <Link
          href="/doctor/settings"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold text-foreground-muted bg-surface border border-border hover:border-border-hover hover:text-foreground shadow-sm transition-colors flex-shrink-0"
        >
          <Settings className="h-3.5 w-3.5" /> {t('schedule.editAvailability')}
        </Link>
      </div>

      {/* Availability — driven by Settings */}
      <div className="hms-card p-4 flex flex-wrap items-center gap-2.5 mb-5">
        <span className="flex items-center gap-1.5 t-label text-foreground">
          <Clock className="h-4 w-4 text-accent" /> {profile.hoursStart}–{profile.hoursEnd}
        </span>
        <NeonBadge variant={profile.availableForOPD ? "blue" : "muted"} className="text-[11.5px] px-2 py-0.5">
          <Building2 className="h-3 w-3" /> {profile.availableForOPD ? t('schedule.opdOn') : t('schedule.opdOff')}
        </NeonBadge>
        <NeonBadge variant={profile.availableForOnline ? "blue" : "muted"} className="text-[11.5px] px-2 py-0.5">
          <Video className="h-3 w-3" /> {profile.availableForOnline ? t('schedule.onlineOn') : t('schedule.onlineOff')}
        </NeonBadge>
        {profile.onLeave && (
          <NeonBadge variant="warning" className="text-[11.5px] px-2 py-0.5">
            <Plane className="h-3 w-3" /> {t('schedule.onLeave')}{profile.leaveUntil ? t('schedule.onLeaveUntil', { date: new Date(profile.leaveUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }) : ''}
          </NeonBadge>
        )}
      </div>

      {mine.length === 0 ? (
        <div className="hms-card">
          <EmptyState
            icon={CalendarClock}
            title={t('schedule.noPatientsTitle')}
            description={t('schedule.noPatientsDesc')}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {mine.map((p, i) => {
            const slot = slotStatus(p.queueStatus)
            const done = slot === "done"
            return (
              <motion.div
                key={p.id}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className={cn("flex items-center gap-4 rounded-2xl border p-4 shadow-card", SLOT_ROW[slot])}
              >
                <div className="w-20 t-label text-foreground-muted flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-foreground-placeholder" />{p.registeredAt}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="t-title text-foreground truncate">{p.name}</p>
                  <p className="t-caption text-foreground-lighter truncate">{p.age}y · {p.symptoms[0] ?? p.department}</p>
                </div>
                <NeonBadge variant={SLOT_VARIANT[slot]} className="text-[11px] px-2.5 py-1 flex-shrink-0">{t(`schedule.${SLOT_LABEL_KEY[slot]}`)}</NeonBadge>
                {done ? (
                  <span className="w-28 t-caption font-semibold text-success flex items-center justify-end gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {t('schedule.done')}
                  </span>
                ) : (
                  <button
                    onClick={() => openConsult(p.id)}
                    className="w-28 h-9 rounded-full bg-primary hover:bg-primary-dark text-[#0D2032] hover:text-[#0D2032] text-[12.5px] font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition cursor-pointer"
                  >
                    {t('schedule.open')} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {upcomingAppts.length > 0 && (
        <div className="mt-6">
          <p className="t-overline text-foreground-lighter mb-2">Upcoming appointments</p>
          <div className="space-y-2.5">
            {upcomingAppts.map(a => (
              <div key={a.id} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent-soft text-accent">
                  {a.mode === 'online' ? <Video className="h-[18px] w-[18px]" /> : <Building2 className="h-[18px] w-[18px]" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="t-title text-foreground truncate">{a.patientName ?? a.patientId}</p>
                  <p className="t-caption text-foreground-lighter">{a.specialty} · {a.mode === 'online' ? 'Video' : 'In-person'}</p>
                </div>
                <span className="t-caption font-semibold text-foreground-muted flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-foreground-placeholder" /> {new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {a.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
