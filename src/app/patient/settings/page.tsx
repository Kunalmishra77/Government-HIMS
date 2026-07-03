"use client"

/* M8 — Patient settings: notification prefs + locale + reminder timing.
 *
 * Phase-1 mock: writes a small `agentix.patient.prefs` blob to localStorage.
 * Phase-2 swaps for a real user-prefs endpoint.
 */

import { useEffect, useState } from "react"
import { Bell, MessageCircle, Smartphone, Mail, Globe, Clock, ShieldCheck, Save } from "lucide-react"
import { toast } from "sonner"

type Channel = 'in_app' | 'whatsapp' | 'sms' | 'email'
type ReminderHrs = 1 | 4 | 12 | 24

interface PatientPrefs {
  appointmentChannels: Channel[]
  resultChannels: Channel[]
  followupChannels: Channel[]
  pharmacyChannels: Channel[]
  promotionalOptIn: boolean
  locale: 'en-IN' | 'hi-IN' | 'mr-IN'
  reminderBeforeHrs: ReminderHrs
}

const DEFAULT_PREFS: PatientPrefs = {
  appointmentChannels: ['in_app', 'sms'],
  resultChannels:      ['in_app', 'whatsapp'],
  followupChannels:    ['whatsapp', 'sms'],
  pharmacyChannels:    ['in_app', 'whatsapp'],
  promotionalOptIn:    false,
  locale:              'en-IN',
  reminderBeforeHrs:   24,
}

const LS_KEY = 'agentix.patient.prefs'

function loadPrefs(): PatientPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Partial<PatientPrefs>) } } catch { return DEFAULT_PREFS }
}
function savePrefs(p: PatientPrefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

const CHANNELS: { key: Channel; label: string; icon: React.ElementType; sub: string }[] = [
  { key: 'in_app',   label: 'In-app',    icon: Bell,          sub: 'Notification panel' },
  { key: 'whatsapp', label: 'WhatsApp',  icon: MessageCircle, sub: 'Mock outbound' },
  { key: 'sms',      label: 'SMS',       icon: Smartphone,    sub: 'Mock gateway' },
  { key: 'email',    label: 'Email',     icon: Mail,          sub: 'Mock sender' },
]

const LOCALES: { value: PatientPrefs['locale']; label: string }[] = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { value: 'mr-IN', label: 'मराठी (Marathi)' },
]

function ChannelToggleRow({ title, sub, channels, onChange }: { title: string; sub: string; channels: Channel[]; onChange: (next: Channel[]) => void }) {
  const toggle = (c: Channel) => {
    onChange(channels.includes(c) ? channels.filter(x => x !== c) : [...channels, c])
  }
  return (
    <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
      <div className="mb-3">
        <p className="text-[14px] font-bold text-slate-900">{title}</p>
        <p className="text-[11.5px] text-slate-500">{sub}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {CHANNELS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => toggle(key)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg ring-1 text-left transition cursor-pointer ${channels.includes(key) ? 'ring-emerald-300 bg-emerald-50 text-emerald-800' : 'ring-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[12px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PatientSettings() {
  const [prefs, setPrefs] = useState<PatientPrefs>(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setPrefs(loadPrefs()); setLoaded(true) }, [])

  function update<K extends keyof PatientPrefs>(k: K, v: PatientPrefs[K]) { setPrefs((p) => ({ ...p, [k]: v })) }
  function save() { savePrefs(prefs); toast.success('Preferences saved') }

  if (!loaded) return null

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-[13px] text-slate-500 mt-1">Notification channels, language, reminder timing</p>
      </div>

      {/* Notification channels per event */}
      <div className="space-y-3">
        <ChannelToggleRow title="Appointment reminders" sub="When you book, reschedule, or have an upcoming visit"
          channels={prefs.appointmentChannels} onChange={(c) => update('appointmentChannels', c)} />
        <ChannelToggleRow title="Test results ready" sub="When labs or radiology release a report"
          channels={prefs.resultChannels} onChange={(c) => update('resultChannels', c)} />
        <ChannelToggleRow title="Follow-up + chronic care" sub="Refill reminders, HbA1c-due, BP-log nudges"
          channels={prefs.followupChannels} onChange={(c) => update('followupChannels', c)} />
        <ChannelToggleRow title="Pharmacy + dispense" sub="When medicines are ready or refills are due"
          channels={prefs.pharmacyChannels} onChange={(c) => update('pharmacyChannels', c)} />
      </div>

      {/* Locale + reminder timing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-[14px] font-bold text-slate-900">Language</p>
          </div>
          <div className="space-y-1.5">
            {LOCALES.map((l) => (
              <button key={l.value} onClick={() => update('locale', l.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg ring-1 text-left transition cursor-pointer ${prefs.locale === l.value ? 'ring-primary/25 bg-[rgba(238,107,38,0.07)] text-[var(--color-primary-dark)]' : 'ring-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                <span className="flex-1 text-[13px] font-semibold">{l.label}</span>
                {prefs.locale === l.value ? <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-[14px] font-bold text-slate-900">Remind me</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[1, 4, 12, 24].map((hrs) => (
              <button key={hrs} onClick={() => update('reminderBeforeHrs', hrs as ReminderHrs)}
                className={`px-3 py-2 rounded-lg ring-1 text-[12.5px] font-semibold transition cursor-pointer ${prefs.reminderBeforeHrs === hrs ? 'ring-primary/25 bg-[rgba(238,107,38,0.07)] text-[var(--color-primary-dark)]' : 'ring-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                {hrs}h before
              </button>
            ))}
          </div>
          <p className="text-[10.5px] text-slate-400 mt-2">How early before an appointment to ping you.</p>
        </div>
      </div>

      {/* Promotional opt-in */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-4 flex items-center gap-3">
        <span className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"><ShieldCheck className="h-4 w-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-semibold text-slate-900">Health camps + offers</p>
          <p className="text-[11.5px] text-slate-500">Occasional WhatsApp/email about screenings + camps. You can opt out any time.</p>
        </div>
        <button onClick={() => update('promotionalOptIn', !prefs.promotionalOptIn)}
          className={`text-[12px] font-bold px-3 py-1 rounded-full cursor-pointer ${prefs.promotionalOptIn ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
          {prefs.promotionalOptIn ? 'On' : 'Off'}
        </button>
      </div>

      <button onClick={save}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[14px] font-bold cursor-pointer">
        <Save className="h-4 w-4" /> Save preferences
      </button>
    </div>
  )
}
