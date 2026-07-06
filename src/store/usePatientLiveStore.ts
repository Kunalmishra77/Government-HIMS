import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Live patient journey for the dashboard. Front-end simulation today;
// the same shape would be fed by real backend events in production.
// Two modes: in-person OPD and online video consultation.

export type LiveMode = 'in_person' | 'video'
export type OpdStage =
  | 'waiting' | 'vitals' | 'consulting' | 'pharmacy' | 'billing' | 'done'
  | 'booked' | 'waiting_room' | 'in_call' | 'prescription'
export type LiveEventType = 'progress' | 'call' | 'result' | 'ai' | 'message' | 'info'

export interface LiveEvent {
  id: string
  at: number
  type: LiveEventType
  title: string
  detail?: string
  room?: string
}

export interface StageMeta {
  key: OpdStage
  label: string
  short: string
  room?: string
  action: string
  isCall: boolean
  joinVideo?: boolean
}

export const STAGES_IN_PERSON: StageMeta[] = [
  { key: 'waiting',    label: 'In Queue',        short: 'Arrived',  action: "You're checked in — please wait, we'll call you shortly.", isCall: false },
  { key: 'vitals',     label: 'Vitals Check',    short: 'Vitals',   room: 'Vitals Room 2',       action: 'Please proceed to Vitals — Room 2.', isCall: true },
  { key: 'consulting', label: 'With the Doctor', short: 'Consult',  room: 'Consultation Room 5', action: 'Go in to see Dr. Priya Nair — Room 5.', isCall: true },
  { key: 'pharmacy',   label: 'Pharmacy',        short: 'Pharmacy', room: 'Pharmacy Counter 3',  action: 'Collect your medicines — Pharmacy Counter 3.', isCall: true },
  { key: 'billing',    label: 'Billing',         short: 'Billing',  room: 'Billing Counter 1',   action: 'Settle your bill — Billing Counter 1.', isCall: true },
  { key: 'done',       label: 'Visit Complete',  short: 'Done',     action: 'All done — take care! Your visit summary is ready.', isCall: false },
]

export const STAGES_VIDEO: StageMeta[] = [
  { key: 'booked',       label: 'Consult Booked',      short: 'Booked',  action: 'Your video consultation is confirmed.', isCall: false },
  { key: 'waiting_room', label: 'Virtual Waiting Room', short: 'Waiting', action: "Your doctor will start shortly — keep this screen open.", isCall: false },
  { key: 'in_call',      label: 'Video Consultation',  short: 'On Call', action: 'Your doctor is ready — join the video call now.', isCall: true, joinVideo: true },
  { key: 'prescription', label: 'e-Prescription',      short: 'Rx',      action: 'Your prescription is ready.', isCall: false },
  { key: 'done',         label: 'Complete',            short: 'Done',    action: 'All done — summary ready, medicines on the way.', isCall: false },
]

export function stagesFor(mode: LiveMode): StageMeta[] {
  return mode === 'video' ? STAGES_VIDEO : STAGES_IN_PERSON
}

// Back-compat alias (in-person is the default set)
export const STAGES = STAGES_IN_PERSON

let _seq = 0
function mkEvent(type: LiveEventType, title: string, detail?: string, room?: string): LiveEvent {
  return { id: `ev-${++_seq}-${Date.now()}`, at: Date.now(), type, title, detail, room }
}

interface LiveState {
  mode: LiveMode
  stage: OpdStage
  token: number
  aheadOfYou: number
  etaMinutes: number
  // The booked appointment, carried through from check-in so the dashboard can
  // show the arrival-time guidance. ISO date + a display time like "11:00 AM".
  apptDate: string
  apptTime: string
  doctor: string
  events: LiveEvent[]
  advance: () => void
  pushEvent: (type: LiveEventType, title: string, detail?: string, room?: string) => void
  startVisit: (token: number, mode?: LiveMode, apptDate?: string, apptTime?: string, doctor?: string) => void
  reset: () => void
}

function seedEvents(mode: LiveMode, token: number): LiveEvent[] {
  if (mode === 'video') {
    return [
      mkEvent('ai', 'AI brief sent to your doctor', 'Your symptoms, history & triage score shared before the call'),
      mkEvent('progress', 'Video consult booked', `Confirmation #${token}`),
    ]
  }
  return [
    mkEvent('ai', 'AI brief sent to Dr. Priya Nair', 'Your symptoms, history & triage score shared before you walk in'),
    mkEvent('progress', 'Checked in', `Token #${token} · High priority`),
  ]
}

export const usePatientLiveStore = create<LiveState>()(persist((set, get) => ({
  mode: 'in_person',
  stage: 'waiting',
  token: 4,
  aheadOfYou: 3,
  etaMinutes: 18,
  apptDate: '',
  apptTime: '',
  doctor: 'Dr. Priya Nair',
  events: seedEvents('in_person', 4),

  advance: () => {
    const s = get()
    const stages = stagesFor(s.mode)
    const idx = stages.findIndex(m => m.key === s.stage)
    if (idx < 0 || idx >= stages.length - 1) return
    const next = stages[idx + 1]
    const events = [...s.events]

    if (s.mode === 'in_person') {
      if (next.key === 'consulting') events.unshift(mkEvent('progress', 'Vitals recorded', 'BP 130/85 · SpO₂ 98% · Temp 98.4°F · Pulse 78'))
      if (next.key === 'pharmacy') events.unshift(mkEvent('result', 'e-Prescription ready', '2 medicines · sent to pharmacy', 'Pharmacy Counter 3'))
      if (next.key === 'billing') events.unshift(mkEvent('result', 'Lab result ready', 'CBC reviewed — explained in plain language'))
      if (next.key === 'done') events.unshift(mkEvent('result', 'Visit summary ready', 'Plain-language summary + follow-up plan'))
    } else {
      if (next.key === 'waiting_room') events.unshift(mkEvent('progress', 'Pre-consult complete', 'Your details are with the doctor'))
      if (next.key === 'prescription') events.unshift(mkEvent('result', 'e-Prescription issued', '2 medicines · order for home delivery'))
      if (next.key === 'done') events.unshift(mkEvent('result', 'Summary ready · medicines out for delivery', 'Plain-language summary available'))
    }
    if (next.isCall) events.unshift(mkEvent('call', `It's your turn — ${next.label}`, next.action, next.room))

    set({
      stage: next.key,
      aheadOfYou: Math.max(0, s.aheadOfYou - 1),
      etaMinutes: next.key === 'done' ? 0 : Math.max(2, s.etaMinutes - 5),
      events,
    })
  },

  pushEvent: (type, title, detail, room) => set(s => ({ events: [mkEvent(type, title, detail, room), ...s.events] })),

  // Begin a fresh journey for a newly onboarded patient.
  startVisit: (token, mode = 'in_person', apptDate = '', apptTime = '', doctor = 'Dr. Priya Nair') => set({
    mode,
    stage: mode === 'video' ? 'booked' : 'waiting',
    token,
    aheadOfYou: mode === 'video' ? 1 : 3,
    etaMinutes: mode === 'video' ? 10 : 18,
    apptDate,
    apptTime,
    doctor: doctor || 'Dr. Priya Nair',
    events: seedEvents(mode, token),
  }),

  reset: () => { const s = get(); s.startVisit(s.token, s.mode, s.apptDate, s.apptTime, s.doctor) },
}),
  {
    name: 'agentix-patientlivestore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
