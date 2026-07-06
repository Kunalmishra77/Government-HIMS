// Client-side bridge to the OpenAI-backed intake turn-taker (/api/intake/turn).
// Returns the assistant's next line + extracted field patch, or null if the AI
// service is unavailable (the caller then falls back to the deterministic flow).

import type { IntakeForm } from '@/lib/intake/data'

export type Expecting =
  | 'consultType' | 'method'
  | 'name' | 'age' | 'gender' | 'phone' | 'symptoms' | 'duration'
  | 'apptDate' | 'apptSlot' | 'other'

// When the patient chooses to fill the form themselves or scan Aadhaar, the
// assistant hands off: the voice UI stops and jumps into the typed flow.
export type IntakeRoute = 'manual' | 'aadhaar'

export interface LlmIntakeTurn {
  say: string
  done: boolean
  lang: 'en' | 'hi'
  expecting: Expecting
  route: IntakeRoute | null
  patch: Partial<IntakeForm>
}

export type LlmMsg = { role: 'assistant' | 'patient'; text: string }

export async function llmIntakeTurn(
  history: LlmMsg[],
  form: IntakeForm,
  lang: 'en' | 'hi',
): Promise<LlmIntakeTurn | null> {
  try {
    const res = await fetch('/api/intake/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, form, lang }),
    })
    if (!res.ok) return null
    const data = await res.json() as LlmIntakeTurn
    if (typeof data.say !== 'string' || !data.say.trim()) return null
    return {
      say: data.say,
      done: !!data.done,
      lang: data.lang === 'en' ? 'en' : 'hi',
      expecting: data.expecting ?? 'other',
      route: data.route === 'manual' || data.route === 'aadhaar' ? data.route : null,
      patch: data.patch ?? {},
    }
  } catch {
    return null
  }
}
