"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  HeartPulse, Calendar, CheckCircle, UserCheck, Pill, Clock, AlertTriangle,
  Utensils, FileText, PhoneCall, Sparkles, Video, Building2, ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientLiveStore } from "@/store/usePatientLiveStore"
import { usePatientOrdersStore, acceptedItems } from "@/store/usePatientOrdersStore"
import { cn } from "@/lib/utils"

// Derive reminder times from a "1-0-1" style dose pattern.
function reminderTimes(detail: string): string[] {
  const m = detail.match(/(\d)\s*-\s*(\d)\s*-\s*(\d)/)
  if (!m) return ['As directed']
  const [, morning, noon, night] = m
  const times: string[] = []
  if (+morning > 0) times.push('08:00')
  if (+noon > 0) times.push('14:00')
  if (+night > 0) times.push('21:00')
  return times.length ? times : ['As directed']
}

const RED_FLAGS = [
  'High fever above 39°C for more than 2 days',
  'Chest pain or breathlessness',
  'Persistent vomiting — unable to keep fluids down',
  'Blood sugar consistently above 300 mg/dL',
  'New severe headache or confusion',
]

const DIET_TIPS = [
  'Low-sugar, low-salt balanced meals · small and frequent',
  'Drink 2–3 litres of water through the day',
  '20–30 min of light walking daily',
  'Take medicines on time — set the reminders below',
]

export default function FollowUpPage() {
  const currentUser = useAuthStore(s => s.currentUser)
  const mode = usePatientLiveStore(s => s.mode)
  const { items, doctor, received } = usePatientOrdersStore()

  const [followupDate, setFollowupDate] = useState('')
  const [booked, setBooked] = useState(false)
  const [checkedFlags, setCheckedFlags] = useState<string[]>([])

  const meds = received ? acceptedItems(items).filter(i => i.kind === 'medicine') : []
  const name = currentUser?.name ?? 'there'
  const first = name.split(' ')[0]

  const severe = checkedFlags.some(f => f.toLowerCase().includes('chest') || f.toLowerCase().includes('breathless'))
  const guidance = checkedFlags.length === 0 ? null
    : severe
      ? 'This may be a medical emergency. Call 102 or go to the nearest emergency room immediately.'
      : 'Please contact your care team. If symptoms worsen, visit the hospital.'

  const toggleFlag = (f: string) =>
    setCheckedFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Care &amp; Follow-up</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your recovery plan after this visit</p>
      </div>

      {/* Patient + visit header */}
      <div className="rounded-3xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white p-5 shadow-[0_10px_30px_rgba(238,107,38,0.25)]">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-white/80 mb-1">
          {mode === 'video' ? <Video className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          {mode === 'video' ? 'Video consultation' : 'In-person OPD visit'} · today
        </div>
        <p className="text-[20px] font-bold">{first}, here&apos;s your care plan</p>
        <p className="text-[13px] text-white/80 mt-0.5">Reviewed with {doctor} · {currentUser?.id ?? 'PT-00000'}</p>
      </div>

      {/* AI visit summary */}
      <div className="rounded-3xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-9 w-9 rounded-2xl bg-[rgba(238,107,38,0.12)] flex items-center justify-center flex-shrink-0"><Sparkles className="h-4.5 w-4.5 text-[var(--color-accent)]" /></span>
          <div>
            <p className="text-[14px] font-bold text-[var(--color-primary-dark)]">Your visit, in plain language</p>
            <p className="text-[12px] text-[var(--color-accent)]">AI summary · reviewed by your doctor</p>
          </div>
        </div>
        <p className="text-[13.5px] text-[var(--color-primary-dark)] leading-relaxed">
          You came in with fever and fatigue. Your doctor examined you, ordered a few tests to be safe, and started you on
          medicines to manage your blood sugar and blood pressure. Most likely this is a minor infection. Take your medicines
          on time, watch for the symptoms below, and come back for your follow-up.
        </p>
      </div>

      {/* Follow-up appointment */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="h-4.5 w-4.5 text-[var(--color-accent)]" /> Book your follow-up</h3>
        {!booked ? (
          <div className="flex gap-2">
            <input
              type="date" value={followupDate} min={new Date().toISOString().slice(0, 10)}
              onChange={e => setFollowupDate(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] text-slate-800 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={() => { if (!followupDate) { toast.error('Please pick a date'); return } setBooked(true); toast.success('Follow-up booked', { description: `${doctor} on ${new Date(followupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` }) }}
              className="bg-[var(--color-primary)] text-white font-bold text-[14px] rounded-xl px-4 flex items-center gap-2 active:scale-[0.97] transition"
            >
              <Calendar className="h-4 w-4" /> Book
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-green-50 text-green-800 text-[13.5px] font-semibold">
              <CheckCircle className="h-4.5 w-4.5" /> Follow-up: {new Date(followupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-green-50 text-green-700 text-[12.5px] font-semibold">
              <UserCheck className="h-3.5 w-3.5" /> {doctor} — available on this date
            </div>
          </div>
        )}
      </div>

      {/* Medicine reminders — from doctor's orders */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-slate-900 flex items-center gap-2"><Clock className="h-4.5 w-4.5 text-amber-600" /> Medicine reminders</h3>
          {meds.length > 0 && <Link href="/patient/pharmacy" className="text-[12.5px] font-semibold text-[var(--color-accent)] flex items-center gap-1">Pharmacy <ArrowRight className="h-3.5 w-3.5" /></Link>}
        </div>
        {meds.length === 0 ? (
          <p className="text-[13px] text-slate-500 bg-slate-50 rounded-xl p-3">
            Your medicine schedule will appear here once you review and accept your <Link href="/patient/orders" className="font-semibold text-[var(--color-accent)]">doctor&apos;s orders</Link>.
          </p>
        ) : (
          <div className="space-y-2">
            {meds.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                <span className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0"><Pill className="h-4.5 w-4.5 text-amber-600" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900">{m.name}</p>
                  <p className="text-[12px] text-slate-500">{m.detail}</p>
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {reminderTimes(m.detail).map(t => (
                    <span key={t} className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* When to return / red flags */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-1 flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-red-500" /> When to come back</h3>
        <p className="text-[12.5px] text-slate-500 mb-3">Tap any symptom you&apos;re experiencing right now:</p>
        <div className="space-y-2">
          {RED_FLAGS.map(f => {
            const on = checkedFlags.includes(f)
            return (
              <button key={f} onClick={() => toggleFlag(f)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors", on ? "bg-red-50 border-red-200" : "bg-white border-slate-100 hover:bg-slate-50")}>
                <span className={cn("h-5 w-5 rounded-md flex items-center justify-center border-2 flex-shrink-0", on ? "bg-red-500 border-red-500" : "border-slate-300")}>
                  {on && <CheckCircle className="h-3 w-3 text-white" />}
                </span>
                <span className={cn("text-[13.5px] font-medium", on ? "text-red-800" : "text-slate-700")}>{f}</span>
              </button>
            )
          })}
        </div>
        <AnimatePresence>
          {guidance && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={cn("mt-3 p-4 rounded-2xl border flex items-start gap-3", severe ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-200")}>
              <AlertTriangle className={cn("h-5 w-5 flex-shrink-0 mt-0.5", severe ? "text-red-600" : "text-amber-600")} />
              <p className={cn("text-[13.5px] font-semibold", severe ? "text-red-900" : "text-amber-900")}>{guidance}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Diet & lifestyle */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Utensils className="h-4.5 w-4.5 text-green-600" /> Diet &amp; lifestyle</h3>
        <div className="space-y-2">
          {DIET_TIPS.map(t => (
            <div key={t} className="flex items-start gap-2.5 text-[13.5px] text-slate-700">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" /> {t}
            </div>
          ))}
        </div>
      </div>

      {/* Documents + emergency */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/patient/downloads" className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 flex items-center gap-3 hover:bg-slate-50 transition">
          <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0"><FileText className="h-5 w-5 text-[var(--color-accent)]" /></span>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-slate-900">Visit documents</p>
            <p className="text-[12px] text-slate-500">Summary, prescription & bills</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </Link>
        <a href="tel:1800XXX0101" className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 flex items-center gap-3 hover:bg-slate-50 transition">
          <span className="h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0"><PhoneCall className="h-5 w-5 text-red-600" /></span>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-slate-900">Care helpline</p>
            <p className="text-[12px] text-slate-500">24/7 · 1800-XXX-0101</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </a>
      </div>
    </div>
  )
}
