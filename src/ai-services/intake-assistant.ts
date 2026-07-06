// Conversational intake dialogue manager.
//
// Deterministic today (regex/keyword parsing reused from voice-intake), but shaped
// as an async AiEnvelope service so a real LLM turn-taker can drop in later without
// touching the UI: the component only consumes { say, expecting, patch, done }.
//
// Conversation shape mirrors the "AI Voice Assistant Flow for Patient Check-in"
// spec: greet → name → age → gender → mobile → chief complaint → symptom
// duration → spoken summary. Consultation type is chosen before the assistant
// starts, so it is not asked here.

import { wrapAiResponse } from '@/lib/ai-helpers'
import type { AiEnvelope } from '@/types/ai'
import {
  matchSymptoms,
  extractAge, extractGender,
} from '@/ai-services/voice-intake'
import {
  suggestDepartments, triageScore, DURATION_OPTIONS,
  type IntakeForm, type Gender,
} from '@/lib/intake/data'

export type SlotId =
  | 'name' | 'age' | 'gender' | 'phone'
  | 'symptoms' | 'symptomDuration' | 'confirm'

export interface IntakeTurn {
  say: string                       // what the assistant should speak/show
  expecting: SlotId                 // the slot this prompt is collecting
  patch?: Partial<IntakeForm>       // parsed from the patient's last reply
  done?: boolean                    // intake complete — register now
  needsRepair?: boolean             // last reply wasn't understood; re-asking
}

const SLOT_ORDER: SlotId[] = ['name', 'age', 'gender', 'phone', 'symptoms', 'symptomDuration']

// Symptom duration is helpful but never blocks the flow — the patient may not know.
const OPTIONAL: SlotId[] = ['symptomDuration']

const isNo = (t: string) => /\b(no|nope|skip|none|cancel|nahi|dunno|don't know|do not know)\b/i.test(t) || /नहीं|नही|पता नहीं/.test(t)

function digits(t: string): string { return t.replace(/\D/g, '') }

// "My name is Mithlesh Mishra" / "Mithlesh Mishra" / "I am Ram Kumar".
function parseName(text: string): string | undefined {
  const prefixed = text.match(/(?:my name is|i am|i'm|name is|this is)\s+([a-z][a-z'.]*(?:\s+[a-z][a-z'.]*){0,2})/i)
  if (prefixed) return titleCase(prefixed[1])
  const hindi = text.match(/(?:मेरा नाम|नाम है|मैं)\s+([^\s,।]+(?:\s+[^\s,।]+)?)/)
  if (hindi) return hindi[1]
  // Bare reply: accept 1–3 alphabetic words as the name.
  const bare = text.trim().match(/^([a-z][a-z'.]*(?:\s+[a-z][a-z'.]*){0,2})$/i)
  if (bare) return titleCase(bare[1])
  return undefined
}

function titleCase(s: string): string {
  return s.trim().replace(/\s+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

// Parse the first number in free speech: digits, or spelled-out compounds like
// "forty five" / "twenty-eight", plus vague quantifiers (a, couple, few).
function spokenNumber(text: string): number | undefined {
  const lower = text.toLowerCase()
  const digit = lower.match(/\d+/)
  if (digit) return parseInt(digit[0], 10)
  const tokens = lower.replace(/[-,]/g, ' ').split(/\s+/)
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i]
    if (w in TENS) {
      const next = tokens[i + 1]
      return TENS[w] + (next && next in ONES && ONES[next] < 10 ? ONES[next] : 0)
    }
    if (w in ONES) return ONES[w]
    if (w === 'a' || w === 'an') return 1
    if (w === 'couple') return 2
    if (w === 'few') return 3
  }
  return undefined
}

// Free-form symptom duration → one of DURATION_OPTIONS values. Handles the spec
// examples: "for the last 2 days", "since yesterday", "about a week",
// "the past 4–5 days", "almost a month".
export function parseDuration(text: string): string | undefined {
  const lower = text.toLowerCase().replace(/[–—]/g, '-')

  if (/\bmonth|\bमहीन|\bमाह/.test(lower)) return '1m+'

  if (/week|हफ्त|सप्ताह/.test(lower)) {
    const weeks = spokenNumber(lower) ?? 1
    if (weeks >= 2 || /more than|over|past few|several/.test(lower)) return '1w+'
    return '4-7d'
  }

  if (/\b(today|this morning|since morning|few hours|hours|abhi|आज)\b/.test(lower)) return 'today'
  if (/yesterday|कल/.test(lower)) return '1-3d'

  // "4-5 days", "4 to 5 days" → take the larger bound.
  const range = lower.match(/(\d+)\s*(?:-|to|or)\s*(\d+)\s*day/)
  if (range) return bucketDays(Math.max(parseInt(range[1], 10), parseInt(range[2], 10)))

  if (/day|दिन|din/.test(lower)) {
    const n = spokenNumber(lower)
    if (n !== undefined) return bucketDays(n)
    return '1-3d'
  }

  // Vague long-duration phrasings.
  if (/long time|many days|quite some time|काफ़ी|काफी|बहुत दिन|लंबे समय/.test(lower)) return '1w+'

  // Bare number with no unit (e.g. answering "how long?" with just "four") → days.
  const bare = spokenNumber(lower)
  if (bare !== undefined) return bucketDays(bare)

  return undefined
}

function bucketDays(n: number): string {
  if (n <= 0) return 'today'
  if (n <= 3) return '1-3d'
  if (n <= 7) return '4-7d'
  return '1w+'
}

function durationLabel(value: string): string {
  return DURATION_OPTIONS.find(o => o.value === value)?.label ?? value
}

function parseSlot(slot: SlotId, text: string, form: IntakeForm): Partial<IntakeForm> {
  switch (slot) {
    case 'name': {
      const name = parseName(text)
      return name ? { name } : {}
    }
    case 'age': {
      const age = extractAge(text) ?? spokenNumber(text)
      return age && age >= 1 && age <= 120 ? { age: String(age) } : {}
    }
    case 'gender': {
      const gender = extractGender(text)
      return gender ? { gender: gender as Gender } : {}
    }
    case 'phone': {
      const d = digits(text)
      return d.length >= 10 ? { phone: d.slice(-10) } : {}
    }
    case 'symptoms': {
      const found = matchSymptoms(text)
      if (!found.length) return {}
      const symptoms = [...new Set([...form.symptoms, ...found])]
      return { symptoms, departments: suggestDepartments(symptoms) }
    }
    case 'symptomDuration': {
      const value = parseDuration(text)
      if (!value || !form.symptoms.length) return {}
      const symptomDurations = { ...form.symptomDurations }
      for (const s of form.symptoms) symptomDurations[s] = value
      return { symptomDurations }
    }
    default:
      return {}
  }
}

function satisfied(slot: SlotId, f: IntakeForm): boolean {
  switch (slot) {
    case 'name': return f.name.trim().length > 0
    case 'age': { const n = parseInt(f.age, 10); return !Number.isNaN(n) && n >= 1 && n <= 120 }
    case 'gender': return f.gender !== ''
    case 'phone': return /^\d{10}$/.test(f.phone.replace(/\D/g, ''))
    case 'symptoms': return f.symptoms.length > 0
    default: return true // optional slots are satisfied once handled
  }
}

export type Lang = 'en' | 'hi'

const GENDER_HI: Record<string, string> = { Male: 'पुरुष', Female: 'महिला', Other: 'अन्य' }
const TRIAGE_HI: Record<string, string> = { Low: 'कम', Medium: 'मध्यम', High: 'उच्च', Critical: 'गंभीर' }

// Prompt text for re-asking a single slot (used when editing from the review
// screen, which bypasses the slot-ordering loop).
export function promptFor(slot: SlotId, f: IntakeForm, lang: Lang = 'en'): string {
  if (slot === 'name') return lang === 'hi' ? 'ज़रूर, अपना नाम दोबारा बताइए।' : 'Sure — your name again?'
  return prompt(slot, f, lang)
}

function prompt(slot: SlotId, f: IntakeForm, lang: Lang): string {
  if (lang === 'hi') {
    switch (slot) {
      case 'name': return 'नमस्ते! मैं आशा हूँ, Agentix HIMS की AI रिसेप्शनिस्ट। आपका नाम बताइए।'
      case 'age': return 'और आपकी उम्र?'
      case 'gender': return 'आपका जेंडर बताइए — पुरुष, महिला या अन्य।'
      case 'phone': return 'अपना मोबाइल नंबर बताइए।'
      case 'symptoms': return 'आज आपको किस वजह से डॉक्टर को दिखाना है?'
      case 'symptomDuration': return 'यह परेशानी कब से है?'
      case 'confirm': return summary(f, lang)
    }
  }
  switch (slot) {
    case 'name': return 'Hello, I’m Asha, the AI receptionist at Agentix HIMS. May I have your name?'
    case 'age': return 'And your age?'
    case 'gender': return 'Your gender — male, female, or other?'
    case 'phone': return 'Please tell me your mobile number.'
    case 'symptoms': return 'What’s brought you in to see the doctor today?'
    case 'symptomDuration': return 'And how long has this been going on?'
    case 'confirm': return summary(f, lang)
  }
}

function repairPrompt(slot: SlotId, lang: Lang): string {
  if (lang === 'hi') {
    switch (slot) {
      case 'name': return 'माफ़ करना, मैं आपका नाम समझ नहीं पाई। ज़रा दोबारा बता दीजिए।'
      case 'age': return 'अपनी उम्र साल में बता दीजिए — जैसे अट्ठाईस।'
      case 'gender': return 'बस बता दीजिए — पुरुष, महिला, या अन्य।'
      case 'phone': return 'लगता है नंबर पूरा नहीं मिला — एक-एक अंक करके बता दीजिए।'
      case 'symptoms': return 'बताइए, आपको क्या तकलीफ़ है — जैसे बुखार, खांसी, या पेट दर्द।'
      default: return 'ज़रा दोबारा कहिए।'
    }
  }
  switch (slot) {
    case 'name': return 'Sorry, I didn’t catch your name. Could you please say it again?'
    case 'age': return 'Could you tell me your age in years — for example, twenty-eight?'
    case 'gender': return 'Please say male, female, or other.'
    case 'phone': return 'I need a ten-digit mobile number. Please say it digit by digit.'
    case 'symptoms': return 'Please tell me what is troubling you — for example, fever, cough, or stomach pain.'
    default: return 'Could you repeat that please?'
  }
}

// Spoken AI summary — the structured pre-consultation brief the spec calls for:
// chief complaint, symptom duration, and the assistant's priority read.
function summary(f: IntakeForm, lang: Lang): string {
  const durVal = f.symptoms.map(s => f.symptomDurations[s]).find(Boolean)
  const triage = triageScore(f.symptoms, f.symptomDurations)
  if (lang === 'hi') {
    const dur = durVal ? durationLabel(durVal).replace('<', '').replace('>', '') : ''
    const parts = [
      `थैंक यू। मैंने सब नोट कर लिया है। नाम ${f.name}, उम्र ${f.age}${f.gender ? `, ${GENDER_HI[f.gender] ?? f.gender}` : ''}।`,
      f.symptoms.length ? `तकलीफ़ — ${f.symptoms.join(' और ')}${dur ? `, ${dur} से` : ''}।` : '',
      `प्राथमिकता — ${TRIAGE_HI[triage.level] ?? triage.level}।`,
    ].filter(Boolean)
    return parts.join(' ')
  }
  const parts = [
    `Thank you. I have recorded the following. Name ${f.name}, age ${f.age}${f.gender ? `, ${f.gender}` : ''}.`,
    f.symptoms.length ? `Chief complaint, ${f.symptoms.join(' and ')}${durVal ? `, for ${durationLabel(durVal).replace('<', 'less than').replace('>', 'more than')}` : ''}.` : '',
    `Assessed priority, ${triage.level}.`,
  ].filter(Boolean)
  return parts.join(' ')
}

function turn(say: string, expecting: SlotId, patch: Partial<IntakeForm>, extra: Partial<IntakeTurn> = {}): AiEnvelope<IntakeTurn> {
  const conf = extra.needsRepair ? 0.45 : 0.9
  return wrapAiResponse<IntakeTurn>(
    { say, expecting, patch: Object.keys(patch).length ? patch : undefined, ...extra },
    conf,
    `Intake dialogue · collecting "${expecting}"${extra.needsRepair ? ' (repair)' : ''}`,
  )
}

// One conversational turn. `askedSlot`/`lastUtterance` describe the reply just
// received; `handled` lists slots already completed (the caller tracks these).
export async function nextIntakeTurn(
  form: IntakeForm,
  lastUtterance: string,
  askedSlot: SlotId | null,
  handled: SlotId[],
  lang: Lang = 'en',
): Promise<AiEnvelope<IntakeTurn>> {
  let patch: Partial<IntakeForm> = {}

  if (askedSlot && askedSlot !== 'confirm' && lastUtterance.trim()) {
    patch = parseSlot(askedSlot, lastUtterance, form)
    const eff = { ...form, ...patch }
    const isOptional = OPTIONAL.includes(askedSlot)
    const declined = isOptional && isNo(lastUtterance)
    if (!isOptional && !satisfied(askedSlot, eff)) {
      return turn(repairPrompt(askedSlot, lang), askedSlot, patch, { needsRepair: true })
    }
    if (isOptional && !declined && Object.keys(patch).length === 0) {
      return turn(repairPrompt(askedSlot, lang), askedSlot, patch, { needsRepair: true })
    }
  }

  const eff = { ...form, ...patch }
  const done = askedSlot ? [...handled, askedSlot] : handled

  for (const slot of SLOT_ORDER) {
    if (done.includes(slot)) continue
    if (!OPTIONAL.includes(slot) && satisfied(slot, eff)) continue
    return turn(prompt(slot, eff, lang), slot, patch)
  }

  return turn(prompt('confirm', eff, lang), 'confirm', patch)
}
