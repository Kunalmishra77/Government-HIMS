"use client"

import { motion } from "framer-motion"
import { Activity, Upload, Stethoscope, MapPin, FileText, FlaskConical, Salad, CalendarClock, Video, ChevronRight, Sparkles } from "lucide-react"
import { usePatientLiveStore, type LiveMode, type OpdStage } from "@/store/usePatientLiveStore"
import { cn } from "@/lib/utils"

type Nudge = { icon: React.ElementType; tint: string; title: string; detail: string; cta: string; priority?: boolean }

/**
 * Context-aware nudges. We only surface what's actually true for THIS patient
 * right now — e.g. no "abnormal lab" before any vitals/labs have happened, and
 * a clear distinction between online (video) and in-person journeys.
 */
function nudgesFor(mode: LiveMode, stage: OpdStage): Nudge[] {
  if (mode === 'video') {
    if (stage === 'booked' || stage === 'waiting_room') return [
      { icon: Video, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Be ready for your video call', detail: 'Find a quiet, well-lit spot and test your camera & mic.', cta: 'Test camera & mic', priority: true },
      { icon: Upload, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Add your past reports', detail: 'Share old prescriptions or reports so your doctor is prepared.', cta: 'Upload reports' },
      { icon: Stethoscope, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Answer a few questions', detail: 'A quick pre-consult helps your doctor make the most of the call.', cta: 'Start pre-consult' },
    ]
    if (stage === 'in_call') return [
      { icon: Video, tint: 'bg-emerald-50 text-emerald-600', title: 'Your consultation is on', detail: 'Your AI scribe is noting key points for your summary.', cta: 'Back to call', priority: true },
      { icon: FileText, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Have your reports handy', detail: 'Share any document during the call if your doctor asks.', cta: 'My reports' },
    ]
    return [ // prescription / done
      { icon: FileText, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'e-Prescription ready', detail: 'View your prescription and order medicines for home delivery.', cta: 'View & order', priority: true },
      { icon: Salad, tint: 'bg-green-50 text-green-600', title: 'Personalized diet plan', detail: 'AI-built for your concern, in your language.', cta: 'View diet plan' },
      { icon: CalendarClock, tint: 'bg-amber-50 text-amber-600', title: 'Book a follow-up', detail: 'Schedule your next check-in with the same doctor.', cta: 'Book follow-up' },
    ]
  }
  // in-person
  if (stage === 'waiting' || stage === 'vitals') return [
    { icon: Activity, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: "We'll call you for vitals", detail: 'Keep your phone close — your live status updates right here.', cta: 'View live status', priority: true },
    { icon: Upload, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Add your past reports', detail: 'Share old prescriptions or lab reports with your doctor.', cta: 'Upload reports' },
    { icon: MapPin, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Find your way', detail: 'Directions to the vitals room and consultation.', cta: 'Hospital map' },
  ]
  if (stage === 'consulting') return [
    { icon: Stethoscope, tint: 'bg-emerald-50 text-emerald-600', title: "You're with the doctor", detail: 'Your AI brief was shared so this visit is quicker.', cta: 'My record', priority: true },
    { icon: Upload, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Add your past reports', detail: 'Share documents your doctor may need.', cta: 'Upload reports' },
  ]
  return [ // pharmacy / billing / done — results now exist
    { icon: FlaskConical, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'Lab result ready — explained', detail: 'Your CBC was reviewed; we put it in plain language.', cta: 'See what it means', priority: true },
    { icon: FileText, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', title: 'e-Prescription ready', detail: 'Collect at the pharmacy or order home delivery.', cta: 'View prescription' },
    { icon: CalendarClock, tint: 'bg-amber-50 text-amber-600', title: 'Book a follow-up', detail: 'Stay on track with your care plan.', cta: 'Book follow-up' },
  ]
}

export function ForYouCard() {
  const mode = usePatientLiveStore(s => s.mode)
  const stage = usePatientLiveStore(s => s.stage)
  const nudges = nudgesFor(mode, stage)

  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4.5 w-4.5 text-[var(--color-accent)]" />
        <h3 className="text-[15px] font-bold text-slate-900">For you</h3>
        <span className="text-[11px] font-semibold text-slate-400">AI-personalized · {mode === 'video' ? 'online' : 'in-person'}</span>
      </div>
      <div className="space-y-2.5">
        {nudges.map((n, i) => {
          const Icon = n.icon
          return (
            <motion.button
              key={n.title}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all active:scale-[0.99] hover:shadow-sm",
                n.priority ? "bg-[rgba(238,107,38,0.07)]/60 ring-1 ring-primary/20" : "bg-slate-50")}
            >
              <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", n.tint)}><Icon className="h-5 w-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-slate-900">{n.title}</span>
                <span className="block text-[12.5px] text-slate-500 leading-snug mt-0.5">{n.detail}</span>
                <span className="inline-block text-[12.5px] font-semibold text-[var(--color-accent)] mt-1.5">{n.cta} →</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
