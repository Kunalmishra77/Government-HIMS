// Patient onboarding — data, options, and pure logic.
// The flow is data-driven; consultation type (in-person vs video) drives the branch.

export const HOSPITAL = {
  name: 'Agentix HIMS',
  fullName: 'Agentix HIMS',
  address: 'Bhanpur, Bhopal Bypass Road, Bhopal',
  phone: '0755-4005000',
} as const

export type Gender = 'Male' | 'Female' | 'Other'
export type IntakeMethod = 'type' | 'aadhaar' | 'voice'
export type TriageLevel = 'Low' | 'Medium' | 'High' | 'Critical'
export type ConsultationType = '' | 'in_person' | 'video'
export type Payer = '' | 'self' | 'cashless' | 'govtScheme'
export type PayMethod = '' | 'upi' | 'card' | 'counter'

export interface IntakeForm {
  consultationType: ConsultationType
  method: IntakeMethod
  name: string
  phone: string
  age: string
  gender: '' | Gender
  symptoms: string[]
  symptomDurations: Record<string, string>
  departments: string[]
  slotDoctor: string
  slotDate: string
  slotTime: string
  hasReports: boolean
  dishaConsent: boolean
  familyPhone: string
  payer: Payer
  payMethod: PayMethod
  insurer: string
  insuranceCardNo: string
  policyId: string
  policyHolder: string
  insuranceVerified: boolean
  abhaId: string
  ayushmanCardNo: string
  govtSchemeVerified: boolean
  schemeName: 'AB-PMJAY' | 'CMHIS-UP' | ''
  // Preferred appointment slot (patient may book in advance). Defaults to today
  // at the next standard OPD time; editable on the review screen.
  apptDate: string   // ISO yyyy-mm-dd
  apptTime: string   // e.g. "10:30 AM"
  // AI-derived during free-form (LLM) intake. Optional — absent in the typed flow.
  chiefComplaint?: string
  aiUrgency?: TriageLevel
}

export function initialForm(): IntakeForm {
  return {
    consultationType: '',
    method: 'type',
    name: '', phone: '', age: '', gender: '',
    symptoms: [], symptomDurations: {}, departments: [],
    slotDoctor: '', slotDate: '', slotTime: '',
    apptDate: todayIso(), apptTime: SLOT_TIMES[0],
    hasReports: false, dishaConsent: false, familyPhone: '',
    payer: '', payMethod: '', insurer: '', insuranceCardNo: '',
    policyId: '', policyHolder: '', insuranceVerified: false,
    abhaId: '', ayushmanCardNo: '', govtSchemeVerified: false, schemeName: '',
  }
}

function todayIso(): string { return new Date().toISOString().slice(0, 10) }

// Human-readable appointment date, e.g. "15 July 2026" (or "Today" / "Tomorrow").
export function formatApptDate(iso: string, lang: 'en' | 'hi' = 'en'): string {
  if (!iso) return ''
  const today = todayIso()
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  if (iso === today) return lang === 'hi' ? 'आज' : 'Today'
  if (iso === tomorrow) return lang === 'hi' ? 'कल' : 'Tomorrow'
  return new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Options ──────────────────────────────────────────────────────────
export interface Choice { value: string; label: string; desc?: string }

export const SYMPTOMS: string[] = [
  'Fever', 'Cough', 'Cold', 'Headache',
  'Chest Pain', 'Breathlessness', 'Sore Throat', 'Body Ache',
  'Stomach Pain', 'Vomiting', 'Diarrhea', 'Dizziness',
  'Back Pain', 'Joint Pain', 'Fatigue', 'Skin Rash',
  'Vision Issue', 'Hearing Issue', 'Swallowing Pain', 'Injury',
]

export interface DurationOption { value: string; label: string }
export const DURATION_OPTIONS: DurationOption[] = [
  { value: 'today', label: '< 1 day' },
  { value: '1-3d', label: '1–3 days' },
  { value: '4-7d', label: '4–7 days' },
  { value: '1w+', label: '> 1 week' },
  { value: '1m+', label: '> 1 month' },
]

export const DEPARTMENTS: string[] = [
  'General Medicine', 'Cardiology', 'Orthopedics', 'Neurology',
  'Dermatology', 'ENT', 'Ophthalmology', 'Gastroenterology',
]

export const INSURERS: string[] = [
  'Star Health Insurance', 'HDFC Ergo Health', 'Niva Bupa Health',
  'Care Health Insurance', 'Max Bupa Health', 'United India Insurance',
  'New India Assurance', 'National Insurance', 'Oriental Insurance',
]

export interface DoctorOption { id: string; name: string; specialty: string; fee: number }
export const DOCTORS: DoctorOption[] = [
  { id: 'D1', name: 'Dr. Priya Nair', specialty: 'General Medicine', fee: 600 },
  { id: 'D2', name: 'Dr. Rohan Mehta', specialty: 'Cardiology', fee: 900 },
  { id: 'D3', name: 'Dr. Anjali Rao', specialty: 'Dermatology', fee: 700 },
  { id: 'D4', name: 'Dr. Vikram Rao', specialty: 'Orthopedics', fee: 800 },
]

export const SLOT_TIMES = ['10:00 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM']

export function upcomingDays(n = 4): Choice[] {
  const out: Choice[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
    out.push({ value: iso, label })
  }
  return out
}

const IN_PERSON_FEE = 600
export function consultFee(form: IntakeForm): number {
  if (form.consultationType === 'video') {
    return DOCTORS.find(d => d.name === form.slotDoctor)?.fee ?? 500
  }
  return IN_PERSON_FEE
}

// ── Symptom → department suggestion ──────────────────────────────────
export const SYMPTOM_DEPARTMENT_MAP: Record<string, string> = {
  'Chest Pain': 'Cardiology', 'Breathlessness': 'Cardiology',
  'Headache': 'Neurology', 'Dizziness': 'Neurology',
  'Stomach Pain': 'Gastroenterology', 'Vomiting': 'Gastroenterology', 'Diarrhea': 'Gastroenterology',
  'Back Pain': 'Orthopedics', 'Joint Pain': 'Orthopedics', 'Injury': 'Orthopedics',
  'Vision Issue': 'Ophthalmology',
  'Hearing Issue': 'ENT', 'Swallowing Pain': 'ENT', 'Sore Throat': 'ENT',
  'Skin Rash': 'Dermatology',
  'Fever': 'General Medicine', 'Cough': 'General Medicine', 'Cold': 'General Medicine',
  'Body Ache': 'General Medicine', 'Fatigue': 'General Medicine',
}

export function suggestDepartments(symptoms: string[]): string[] {
  const set = new Set<string>()
  for (const s of symptoms) { const dept = SYMPTOM_DEPARTMENT_MAP[s]; if (dept) set.add(dept) }
  set.add('General Medicine')
  return [...set]
}

// ── Triage scoring ───────────────────────────────────────────────────
export type TriageVariant = 'success' | 'warning' | 'orange' | 'danger'

export function triageScore(
  symptoms: string[],
  durations: Record<string, string> = {},
): { level: TriageLevel; color: string; variant: TriageVariant } {
  const criticalList = ['Chest Pain', 'Breathlessness', 'Swallowing Pain']
  const highList = ['Fever', 'Dizziness', 'Stomach Pain', 'Vision Issue', 'Injury', 'Vomiting']

  const isLong = (s: string) => ['4-7d', '1w+', '1m+'].includes(durations[s] ?? '')
  const isVeryLong = (s: string) => ['1w+', '1m+'].includes(durations[s] ?? '')

  const hasCritical = symptoms.some(s => criticalList.includes(s))
  const highCount = symptoms.filter(s => highList.includes(s)).length
  const anyHighLingering = symptoms.some(s => highList.includes(s) && isLong(s))

  // Critical: any critical symptom, OR fever persisting > 1 week
  if (hasCritical) return { level: 'Critical', color: 'text-red-600', variant: 'danger' }
  if (symptoms.includes('Fever') && isVeryLong('Fever')) return { level: 'Critical', color: 'text-red-600', variant: 'danger' }

  // High: 2+ high-risk symptoms, OR single high-risk lingering, OR 5+ symptoms total
  if (highCount >= 2) return { level: 'High', color: 'text-accent', variant: 'orange' }
  if (anyHighLingering) return { level: 'High', color: 'text-accent', variant: 'orange' }
  if (symptoms.length >= 5) return { level: 'High', color: 'text-accent', variant: 'orange' }

  // Medium: 3+ symptoms or any high-risk symptom present
  if (symptoms.length >= 3) return { level: 'Medium', color: 'text-amber-500', variant: 'warning' }
  if (highCount >= 1) return { level: 'Medium', color: 'text-amber-500', variant: 'warning' }

  return { level: 'Low', color: 'text-green-500', variant: 'success' }
}

const TRIAGE_DISPLAY: Record<TriageLevel, { color: string; variant: TriageVariant }> = {
  Critical: { color: 'text-red-600', variant: 'danger' },
  High: { color: 'text-accent', variant: 'orange' },
  Medium: { color: 'text-amber-500', variant: 'warning' },
  Low: { color: 'text-green-500', variant: 'success' },
}

// Triage for display/registration. Prefers the AI's own urgency read (free-form
// LLM intake understands any symptom); otherwise falls back to keyword scoring.
export function effectiveTriage(form: IntakeForm): { level: TriageLevel; color: string; variant: TriageVariant } {
  if (form.aiUrgency) return { level: form.aiUrgency, ...TRIAGE_DISPLAY[form.aiUrgency] }
  return triageScore(form.symptoms, form.symptomDurations)
}

// ── Step flow configuration ──────────────────────────────────────────
export type StepId =
  | 'welcome' | 'voice' | 'aadhaar'
  | 'about' | 'symptoms' | 'symptomDuration' | 'department'
  | 'slot' | 'reports' | 'family' | 'review' | 'payment' | 'success'

// The AI voice agent is the single entry point after Welcome. From there it
// either books the whole visit conversationally, or hands off to the typed form
// (about → …) or the Aadhaar scan. Consultation type and registration method are
// no longer screens — the assistant asks them out loud.
export const STEP_ORDER: StepId[] = [
  'welcome', 'voice', 'aadhaar',
  'about', 'symptoms', 'symptomDuration', 'department',
  'slot', 'reports', 'family', 'review', 'payment', 'success',
]

/** The steps actually shown for the current branch (conditionals filtered out). */
export function visibleSteps(form: IntakeForm): StepId[] {
  return STEP_ORDER.filter((id) => {
    if (id === 'voice') return true
    if (id === 'aadhaar') return form.method === 'aadhaar'
    if (id === 'slot') return form.consultationType === 'video'
    return true
  })
}

export const STEP_TITLES: Record<StepId, string> = {
  welcome: 'Welcome',
  aadhaar: 'Scan your Aadhaar',
  voice: 'Tell us in your words',
  about: 'Your details',
  symptoms: 'Select your symptoms',
  symptomDuration: 'How long have you had these?',
  department: 'AI department recommendation',
  slot: 'Pick a time',
  reports: 'Bringing old reports?',
  family: 'Share live status with family?',
  review: 'Review & confirm',
  payment: 'Consultation payment',
  success: 'Done',
}

/** Whether the primary CTA is enabled for a given step. */
export function canContinue(id: StepId, form: IntakeForm): boolean {
  switch (id) {
    case 'about': {
      const n = parseInt(form.age, 10)
      return form.name.trim().length > 0
        && /^\d{10}$/.test(form.phone.replace(/\D/g, ''))
        && !isNaN(n) && n >= 1 && n <= 120
        && form.gender !== ''
    }
    case 'symptoms': return form.symptoms.length > 0
    case 'department': return form.departments.length > 0
    case 'slot': return !!form.slotDoctor && !!form.slotDate && !!form.slotTime
    case 'payment':
      if (form.payer === 'govtScheme') return form.govtSchemeVerified
      if (form.payer === 'cashless') return form.insuranceVerified
      return form.payer === 'self' && !!form.payMethod
    default: return true // method/aadhaar/voice/reports/family/review
  }
}
