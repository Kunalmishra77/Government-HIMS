// Bedside emergency clinical scoring — NEWS2, qSOFA, and ESI heuristic.
// Pure functions; no React/store dependencies.

export type Vitals = {
  rr?: number          // breaths per minute
  spo2?: number        // %
  onOxygen?: boolean
  sbp?: number         // mmHg
  hr?: number          // bpm
  temp?: number        // °C
  consciousness?: 'A' | 'V' | 'P' | 'U'   // AVPU scale
  gcs?: number         // 3–15
  capRefill?: number   // seconds
}

// ── NEWS2 (Royal College of Physicians, UK) ────────────────────────────────
// Six aggregated parameters → 0–20 score. Threshold guidance:
// 0–4 → routine ward · 5–6 → urgent senior review · 7+ → emergency response.

export function news2(v: Vitals): { score: number; band: 'low' | 'medium' | 'high'; trigger: string } {
  let s = 0
  const explain: string[] = []

  // Respiratory rate
  if (v.rr !== undefined) {
    if (v.rr <= 8) { s += 3; explain.push('RR≤8 +3') }
    else if (v.rr <= 11) { s += 1; explain.push('RR 9–11 +1') }
    else if (v.rr >= 25) { s += 3; explain.push('RR≥25 +3') }
    else if (v.rr >= 21) { s += 2; explain.push('RR 21–24 +2') }
  }

  // SpO2 (Scale 1 — general population)
  if (v.spo2 !== undefined) {
    if (v.spo2 <= 91) { s += 3; explain.push('SpO2≤91 +3') }
    else if (v.spo2 <= 93) { s += 2; explain.push('SpO2 92–93 +2') }
    else if (v.spo2 <= 95) { s += 1; explain.push('SpO2 94–95 +1') }
  }

  // On supplemental oxygen
  if (v.onOxygen) { s += 2; explain.push('On O2 +2') }

  // Systolic BP
  if (v.sbp !== undefined) {
    if (v.sbp <= 90) { s += 3; explain.push('SBP≤90 +3') }
    else if (v.sbp <= 100) { s += 2; explain.push('SBP 91–100 +2') }
    else if (v.sbp <= 110) { s += 1; explain.push('SBP 101–110 +1') }
    else if (v.sbp >= 220) { s += 3; explain.push('SBP≥220 +3') }
  }

  // Heart rate
  if (v.hr !== undefined) {
    if (v.hr <= 40) { s += 3; explain.push('HR≤40 +3') }
    else if (v.hr <= 50) { s += 1; explain.push('HR 41–50 +1') }
    else if (v.hr >= 131) { s += 3; explain.push('HR≥131 +3') }
    else if (v.hr >= 111) { s += 2; explain.push('HR 111–130 +2') }
    else if (v.hr >= 91) { s += 1; explain.push('HR 91–110 +1') }
  }

  // Consciousness — V/P/U all score 3
  if (v.consciousness && v.consciousness !== 'A') { s += 3; explain.push(`Consciousness ${v.consciousness} +3`) }
  // GCS substitute if AVPU not recorded
  if (!v.consciousness && v.gcs !== undefined && v.gcs < 15) { s += 3; explain.push(`GCS ${v.gcs} +3`) }

  // Temperature
  if (v.temp !== undefined) {
    if (v.temp <= 35.0) { s += 3; explain.push('Temp≤35 +3') }
    else if (v.temp <= 36.0) { s += 1; explain.push('Temp 35.1–36 +1') }
    else if (v.temp >= 39.1) { s += 2; explain.push('Temp≥39.1 +2') }
    else if (v.temp >= 38.1) { s += 1; explain.push('Temp 38.1–39 +1') }
  }

  const band: 'low' | 'medium' | 'high' = s >= 7 ? 'high' : s >= 5 ? 'medium' : 'low'
  const trigger = s >= 7 ? 'Emergency response — continuous monitoring, critical care review'
              : s >= 5 ? 'Urgent — senior clinician review within 1h'
              : s >= 1 ? 'Routine — minimum 4–6h vitals interval'
                       : 'Routine — minimum 12h vitals interval'
  return { score: s, band, trigger: `${trigger}${explain.length ? ' · ' + explain.join(' ') : ''}` }
}

// ── qSOFA (sepsis screen, ICU stratification) ──────────────────────────────
// Any 2 of 3 → high mortality risk (~10%+); evaluate for sepsis.

export function qsofa(v: Vitals): { score: number; positive: boolean; criteria: string[] } {
  const c: string[] = []
  if (v.rr !== undefined && v.rr >= 22) c.push('RR≥22')
  if (v.sbp !== undefined && v.sbp <= 100) c.push('SBP≤100')
  if (v.gcs !== undefined && v.gcs < 15) c.push('GCS<15')
  else if (v.consciousness && v.consciousness !== 'A') c.push('Altered mentation')
  return { score: c.length, positive: c.length >= 2, criteria: c }
}

// ── ESI — Emergency Severity Index (5-level acuity) ────────────────────────
// We compute a *suggestion* — clinical judgement overrides.

export type ESIBand = 1 | 2 | 3 | 4 | 5

export function esiSuggest(input: { vitals: Vitals; chiefComplaint: string; age?: number; trauma?: boolean }): { level: ESIBand; reason: string } {
  const { vitals: v, chiefComplaint: cc, trauma } = input
  const ccLower = (cc ?? '').toLowerCase()

  // ESI-1 — Resuscitation: airway/breathing/circulation life-threats
  if (v.gcs !== undefined && v.gcs <= 8) return { level: 1, reason: 'GCS ≤8 — airway risk' }
  if (v.sbp !== undefined && v.sbp < 80) return { level: 1, reason: 'SBP <80 — shock' }
  if (v.spo2 !== undefined && v.spo2 < 88 && v.onOxygen) return { level: 1, reason: 'Hypoxia despite O2' }
  if (/cardiac arrest|cpr|unresponsive|airway compromise|massive haemorrhage|stab to chest/.test(ccLower)) {
    return { level: 1, reason: 'Resuscitation-criteria complaint' }
  }

  // ESI-2 — Emergent: high-risk, time-critical
  const n2 = news2(v)
  if (n2.score >= 7) return { level: 2, reason: `NEWS2 ${n2.score} — emergency response` }
  if (qsofa(v).positive) return { level: 2, reason: 'qSOFA positive — sepsis suspected' }
  if (/chest pain|stroke|fits|seizure|severe headache|meningitis|sepsis|gi bleed|active bleeding|stab|gunshot|stemi|pe\b|abdominal pain.*shock|pregnant.*bleed/.test(ccLower)) {
    return { level: 2, reason: 'Time-critical chief complaint' }
  }
  if (trauma && v.gcs !== undefined && v.gcs < 14) return { level: 2, reason: 'Trauma + GCS<14' }

  // ESI-3 — Urgent: multiple resources expected
  if (n2.score >= 5) return { level: 3, reason: `NEWS2 ${n2.score} — urgent review` }
  if (/fever|vomiting|diarrhoea|asthma|copd|fracture|laceration|moderate trauma|abdominal pain|back pain|headache/.test(ccLower)) {
    return { level: 3, reason: 'Multiple-resource presentation' }
  }

  // ESI-4 — Less urgent: one resource (e.g. X-ray or simple suture)
  if (/cough|sore throat|earache|minor injury|ankle sprain|minor laceration|uti|toothache/.test(ccLower)) {
    return { level: 4, reason: 'Single-resource presentation' }
  }

  // ESI-5 — Non-urgent: no resources expected
  return { level: 5, reason: 'No anticipated resources' }
}

// ── Treatment areas & ESI styling ──────────────────────────────────────────

export const TREATMENT_AREAS = [
  { code: 'RESUS', label: 'Resus', desc: 'Critical / ESI 1' },
  { code: 'TRAUMA', label: 'Trauma Bay', desc: 'Trauma activation' },
  { code: 'CRITICAL', label: 'Critical', desc: 'ESI 2 high acuity' },
  { code: 'ACUTE', label: 'Acute', desc: 'ESI 2–3 routine' },
  { code: 'SUBACUTE', label: 'Sub-acute', desc: 'ESI 3' },
  { code: 'FAST_TRACK', label: 'Fast Track', desc: 'ESI 4–5' },
  { code: 'OBS', label: 'Observation', desc: 'Awaiting decision / serial vitals' },
] as const

export type TreatmentArea = typeof TREATMENT_AREAS[number]['code']

export const ESI_STYLE: Record<ESIBand, { label: string; bg: string; fg: string }> = {
  1: { label: 'ESI 1', bg: 'bg-red-100',    fg: 'text-red-700' },
  2: { label: 'ESI 2', bg: 'bg-accent-soft', fg: 'text-accent' },
  3: { label: 'ESI 3', bg: 'bg-amber-100',  fg: 'text-amber-700' },
  4: { label: 'ESI 4', bg: 'bg-surface-sunken',   fg: 'text-accent' },
  5: { label: 'ESI 5', bg: 'bg-emerald-100',fg: 'text-emerald-700' },
}

// Suggest a treatment area from ESI + trauma flag
export function suggestArea(esi: ESIBand, trauma: boolean): TreatmentArea {
  if (esi === 1) return 'RESUS'
  if (trauma) return 'TRAUMA'
  if (esi === 2) return 'CRITICAL'
  if (esi === 3) return 'ACUTE'
  return 'FAST_TRACK'
}
