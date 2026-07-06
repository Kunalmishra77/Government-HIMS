// ─────────────────────────────────────────────────────────────────────────
// Radiology AI engine — SIMULATED heuristics (no external ML, no PHI leaves
// the app). Every engine returns an AiEnvelope (confidence + reasoning +
// disclaimer + requiresReview) so the UI can render HITL accept/reject. The
// heuristics are deterministic per study id so the same study always yields
// the same "AI" output across renders. AI assists, never replaces.
// ─────────────────────────────────────────────────────────────────────────

import type { AiEnvelope } from '@/types/ai'
import { wrapAiResponse } from '@/lib/ai-helpers'
import {
  RADIOLOGY_CATALOG, PRIORITY_META, priorityRank,
  type Priority, type Modality,
} from '@/lib/radiologyCatalog'
import type { RadiologyStudy, AiFinding } from '@/store/useRadiologyStudiesStore'

// ── Centralised critical-finding detector (was duplicated in 3 pages + store) ─
export const CRITICAL_RE =
  /\b(haemorrhage|hemorrhage|bleed|pneumothorax|tamponade|stroke|infarct|acute occlusion|free air|peritonitis|pe\b|pulmonary embolism|cord compression|midline shift|bi-?rads ?(4|5|6)|lung-?rads ?(4|4a|4b|4x)|pi-?rads ?(4|5))\b/i

// Negation cues that turn a critical keyword into a *normal* (ruled-out)
// statement — "no pneumothorax", "no evidence of haemorrhage", "negative for
// PE". Without this, the report-consistency gate falsely demands the radiologist
// "reconcile" a critical finding that the Findings section actually excluded.
const NEGATION_CUE = /\b(no|without|negative for|no evidence of|free of|ruled out|absent|unremarkable for)\b/

export function isCriticalText(text?: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  const re = new RegExp(CRITICAL_RE.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(lower)) !== null) {
    // Scope to the current clause (sentence-level boundaries, NOT commas, so a
    // negated list like "no consolidation, effusion, or pneumothorax" stays one
    // clause under its leading "no"). Only an ASSERTED critical term — one with
    // no negation cue before it in the same clause — counts as critical.
    const clauseStart = Math.max(
      lower.lastIndexOf('.', m.index),
      lower.lastIndexOf(';', m.index),
      lower.lastIndexOf(':', m.index),
    ) + 1
    if (!NEGATION_CUE.test(lower.slice(clauseStart, m.index))) return true
  }
  return false
}

// ── Deterministic pseudo-randomness (stable per seed) ────────────────────────
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
const rand01 = (seed: string) => (hash(seed) % 10000) / 10000
const pick = <T>(arr: T[], seed: string): T => arr[hash(seed) % arr.length]
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

// ── TAT helpers (shared) ─────────────────────────────────────────────────────
export const minsElapsed = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 60000)
export const ACTIVE_STATUSES = new Set(['ordered', 'scheduled', 'arrived', 'acquiring', 'acquired', 'reading', 'reported'])
/** Effective TAT target = catalog TAT × the priority SLA multiplier. */
export function effectiveTAT(study: RadiologyStudy): number {
  const sla = PRIORITY_META[study.priority]?.sla ?? 1
  return Math.round(study.expectedTATmin * sla)
}
export function isTatBreached(study: RadiologyStudy): boolean {
  if (!ACTIVE_STATUSES.has(study.status)) return false
  return minsElapsed(study.orderedAt) > effectiveTAT(study)
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 1 — Order intelligence
// ─────────────────────────────────────────────────────────────────────────

/** Suggest a 6-level priority from the clinical question keywords. */
export function classifyPriority(clinicalQuestion?: string, fallback: Priority = 'Routine'): Priority {
  const q = (clinicalQuestion ?? '').toLowerCase()
  if (/stroke|cva|gcs|fast positive|hemiparesis|slurred/.test(q)) return 'Stroke'
  if (/trauma|rta|rtc|fall|assault|poly.?trauma|fracture\b/.test(q)) return 'Trauma'
  if (/arrest|shock|unstable|critical|peri.?arrest/.test(q)) return 'Critical'
  if (/r\/o (bleed|haemorrhage|hemorrhage|pe|embolism|perforation)|acute|sudden|severe/.test(q)) return 'STAT'
  if (/breathless|dyspnoea|pain|suspected|follow.?up urgent/.test(q)) return 'Urgent'
  return fallback
}

export type Appropriateness = { verdict: 'appropriate' | 'review' | 'consider-alternative'; rationale: string; alternative?: string }
export function checkAppropriateness(code: string, clinicalQuestion?: string, priority?: Priority): AiEnvelope<Appropriateness> {
  const cat = RADIOLOGY_CATALOG[code]
  const q = (clinicalQuestion ?? '').toLowerCase()
  let verdict: Appropriateness['verdict'] = 'appropriate'
  let rationale = `${cat?.name ?? code} is appropriate for the stated indication.`
  let alternative: string | undefined
  let confidence = 0.9
  if (!q.trim()) { verdict = 'review'; rationale = 'No clinical indication provided — confirm appropriateness before scheduling.'; confidence = 0.55 }
  else if (cat?.modality === 'CT' && /headache|chronic|screening/.test(q) && !/acute|sudden|trauma|bleed/.test(q)) {
    verdict = 'consider-alternative'; rationale = 'Non-acute headache rarely needs CT (ACR usually low-yield); MRI or clinical review may be preferred.'; alternative = 'MRI Brain'; confidence = 0.72
  } else if (cat?.radiationDose === 'high' && /young|paediatric|pediatric|pregnan/.test(q)) {
    verdict = 'review'; rationale = 'High-dose study in a radiosensitive patient — confirm justification / consider ultrasound or MRI.'; alternative = 'Ultrasound / MRI'; confidence = 0.68
  }
  return wrapAiResponse({ verdict, rationale, alternative }, confidence, `ACR-style appropriateness heuristic on indication "${clinicalQuestion ?? '—'}" and priority ${priority ?? cat?.defaultPriority}.`)
}

export type DuplicateHit = { priorId: string; priorName: string; daysAgo: number; note: string } | null
export function detectDuplicate(study: RadiologyStudy, all: RadiologyStudy[]): AiEnvelope<DuplicateHit> {
  const priors = all
    .filter(s => s.id !== study.id && s.patientId === study.patientId && s.bodyPart === study.bodyPart && s.modality === study.modality)
    .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
  const prior = priors[0]
  if (!prior) return wrapAiResponse(null, 0.95, 'No prior same-region study found for this patient.')
  const daysAgo = Math.max(0, Math.round((Date.now() - new Date(prior.orderedAt).getTime()) / 86400000))
  return wrapAiResponse(
    { priorId: prior.id, priorName: prior.name, daysAgo, note: `Previous ${prior.name} performed ${daysAgo === 0 ? 'today' : `${daysAgo} day(s) ago`}. Consider comparison or whether a repeat is warranted.` },
    0.88, 'Matched same patient + body part + modality within history.',
  )
}

export type ProtocolRec = { protocol: string; contrast: boolean; note: string }
export function recommendProtocol(code: string, clinicalQuestion?: string): AiEnvelope<ProtocolRec> {
  const cat = RADIOLOGY_CATALOG[code]
  const q = (clinicalQuestion ?? '').toLowerCase()
  let contrast = !!cat?.contrast
  let note = cat?.preparation ?? 'Standard protocol.'
  if (cat?.modality === 'CT' && /pe|embolism|aneurysm|dissection|mass|malignancy|abscess/.test(q)) { contrast = true; note = 'Contrast-enhanced protocol recommended for vascular/oncologic indication.' }
  if (cat?.modality === 'CT' && /stone|calculus|renal colic/.test(q)) { contrast = false; note = 'Non-contrast (stone protocol) recommended.' }
  const protocol = `${cat?.name ?? code}${contrast ? ' · with IV contrast' : ' · non-contrast'}`
  return wrapAiResponse({ protocol, contrast, note }, 0.82, 'Catalog defaults adjusted by indication keywords.')
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 2 — Scheduling intelligence
// ─────────────────────────────────────────────────────────────────────────

const BASE_DURATION: Record<Modality, number> = { XR: 10, US: 25, CT: 20, MRI: 40, MAMMO: 20, NM: 30 }
export function predictScanDuration(study: RadiologyStudy): number {
  const base = BASE_DURATION[study.modality] ?? 20
  const contrastBump = RADIOLOGY_CATALOG[study.code]?.contrast ? 10 : 0
  const jitter = Math.round(rand01(study.id + 'dur') * 10) - 5
  return Math.max(5, base + contrastBump + jitter)
}

export type NoShowPrediction = { risk: number; factors: string[] }
export function predictNoShow(study: RadiologyStudy): AiEnvelope<NoShowPrediction> {
  let risk = 0.12 + rand01(study.id + 'ns') * 0.2
  const factors: string[] = []
  if (study.source === 'OPD') { risk += 0.12; factors.push('Outpatient walk-in') }
  if (study.priority === 'Routine') { risk += 0.08; factors.push('Routine priority') }
  if (RADIOLOGY_CATALOG[study.code]?.preparation) { risk += 0.1; factors.push('Requires patient prep') }
  if (study.modality === 'MRI') { risk += 0.06; factors.push('Long MRI slot') }
  risk = clamp01(risk)
  if (!factors.length) factors.push('No major risk factors')
  return wrapAiResponse({ risk, factors }, 0.7, 'No-show propensity from source, priority, prep and modality.')
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 3 — Arrival / prep checks
// ─────────────────────────────────────────────────────────────────────────

export type PrepIssue = { kind: 'consent' | 'fasting' | 'document' | 'screening'; message: string }
export function checkPrepReadiness(study: RadiologyStudy): AiEnvelope<PrepIssue[]> {
  const cat = RADIOLOGY_CATALOG[study.code]
  const issues: PrepIssue[] = []
  if (cat?.contrast && !study.contrastConsented) issues.push({ kind: 'consent', message: 'IV contrast consent not captured.' })
  if (/fasting/i.test(cat?.preparation ?? '')) issues.push({ kind: 'fasting', message: `${study.name} requires fasting — confirm NPO status.` })
  if (/metal screening/i.test(cat?.preparation ?? '')) issues.push({ kind: 'screening', message: 'MRI metal/implant screening not documented.' })
  if (cat?.contrast && /ct|contrast/i.test(cat.name)) issues.push({ kind: 'document', message: 'eGFR / renal function for contrast not on file.' })
  const conf = issues.length ? 0.8 : 0.92
  return wrapAiResponse(issues, conf, 'Prep gates derived from catalog preparation + consent state.')
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 4 — Image quality assessment
// ─────────────────────────────────────────────────────────────────────────

export type QualityAssessment = { passed: boolean; motion: boolean; incompleteCoverage: boolean; note: string }
export function assessImageQuality(study: RadiologyStudy): AiEnvelope<QualityAssessment> {
  const r = rand01(study.id + 'q')
  const motion = study.modality === 'MRI' && r > 0.78
  const incompleteCoverage = study.modality === 'XR' && r > 0.85
  let note = 'Acquisition complete — diagnostic quality.'
  if (incompleteCoverage) note = study.bodyPart === 'Chest' ? 'Chest apex appears clipped — verify full lung coverage.' : `${study.bodyPart} coverage may be incomplete.`
  else if (motion) note = 'Motion artifact detected — consider re-acquiring affected sequence.'
  const passed = !motion && !incompleteCoverage
  return wrapAiResponse({ passed, motion, incompleteCoverage, note }, passed ? 0.9 : 0.66, 'Heuristic QA on modality + acquisition.')
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 5 — Finding detection (modality-specific, structured)
// ─────────────────────────────────────────────────────────────────────────

type Candidate = { label: string; category: AiFinding['category']; base: number; extra?: Partial<AiFinding> }
const FINDINGS_BY_KEY: Record<string, Candidate[]> = {
  'XR|Chest': [
    { label: 'Pneumonia (consolidation)', category: 'actionable', base: 0.7 },
    { label: 'Tuberculosis (apical opacity)', category: 'actionable', base: 0.6 },
    { label: 'Pleural effusion', category: 'actionable', base: 0.62 },
    { label: 'Pneumothorax', category: 'critical', base: 0.55 },
    { label: 'Cardiomegaly', category: 'actionable', base: 0.6 },
    { label: 'No acute abnormality', category: 'normal', base: 0.9 },
  ],
  'CT|Head': [
    { label: 'Intracranial haemorrhage', category: 'critical', base: 0.6 },
    { label: 'Acute infarct / stroke', category: 'critical', base: 0.58 },
    { label: 'Mass effect / midline shift', category: 'critical', base: 0.5 },
    { label: 'No acute intracranial abnormality', category: 'normal', base: 0.9 },
  ],
  'CT|Chest': [
    { label: 'Pulmonary embolism', category: 'critical', base: 0.55 },
    { label: 'Lung nodule', category: 'actionable', base: 0.66, extra: { lungrads: '3' } },
    { label: 'Consolidation', category: 'actionable', base: 0.62 },
    { label: 'No acute abnormality', category: 'normal', base: 0.88 },
  ],
  'CT|Abdomen-Pelvis': [
    { label: 'Free air (perforation)', category: 'critical', base: 0.5 },
    { label: 'Bowel obstruction', category: 'actionable', base: 0.6 },
    { label: 'Appendicitis', category: 'actionable', base: 0.58 },
    { label: 'No acute abnormality', category: 'normal', base: 0.88 },
  ],
  'MRI|Brain': [
    { label: 'White-matter lesions', category: 'actionable', base: 0.64 },
    { label: 'Intracranial tumour', category: 'critical', base: 0.5 },
    { label: 'Acute infarct (DWI)', category: 'critical', base: 0.55 },
    { label: 'No acute abnormality', category: 'normal', base: 0.88 },
  ],
  'MRI|Lumbar Spine': [
    { label: 'Disc prolapse / herniation', category: 'actionable', base: 0.7 },
    { label: 'Cord compression', category: 'critical', base: 0.48 },
    { label: 'No significant abnormality', category: 'normal', base: 0.85 },
  ],
  'MAMMO|Breasts': [
    { label: 'Suspicious lesion', category: 'critical', base: 0.55, extra: { birads: '4' } },
    { label: 'Benign finding', category: 'actionable', base: 0.7, extra: { birads: '2' } },
    { label: 'Negative', category: 'normal', base: 0.9, extra: { birads: '1' } },
  ],
  'US|Abdomen': [
    { label: 'Cholelithiasis', category: 'actionable', base: 0.68 },
    { label: 'Hydronephrosis', category: 'actionable', base: 0.6 },
    { label: 'Normal study', category: 'normal', base: 0.88 },
  ],
}
const DEFAULT_CANDIDATES: Candidate[] = [{ label: 'No acute abnormality', category: 'normal', base: 0.85 }]

export function detectFindings(study: RadiologyStudy): AiEnvelope<AiFinding[]> {
  const key = `${study.modality}|${study.bodyPart}`
  const candidates = FINDINGS_BY_KEY[key] ?? DEFAULT_CANDIDATES
  const q = (study.clinicalQuestion ?? '').toLowerCase()
  // Pick a primary finding deterministically, biased by the clinical question.
  let primary = pick(candidates.filter(c => c.category !== 'normal').length ? candidates : DEFAULT_CANDIDATES, study.id + 'f1')
  const biased = candidates.find(c => q && c.label.toLowerCase().split(/[ (/]/)[0] && q.includes(c.label.toLowerCase().split(/[ (/]/)[0]))
  if (biased) primary = biased
  const findings: AiFinding[] = []
  const conf = clamp01(primary.base + (rand01(study.id + 'fc') * 0.2 - 0.1))
  findings.push({
    id: `${study.id}-aif1`, label: primary.label, category: primary.category,
    confidence: Number(conf.toFixed(2)),
    heatmap: primary.category === 'normal' ? undefined : { x: 0.3 + rand01(study.id + 'hx') * 0.3, y: 0.25 + rand01(study.id + 'hy') * 0.3, w: 0.18, h: 0.18 },
    ...primary.extra,
  })
  // Occasionally add a secondary incidental finding.
  if (primary.category !== 'normal' && rand01(study.id + 's') > 0.6) {
    const sec = pick(candidates.filter(c => c.label !== primary.label), study.id + 'f2')
    if (sec) findings.push({ id: `${study.id}-aif2`, label: `Incidental: ${sec.label}`, category: 'actionable', confidence: Number((0.5 + rand01(study.id + 'sc') * 0.2).toFixed(2)) })
  }
  const overall = findings[0].confidence
  return wrapAiResponse(findings, overall, `Modality-aware detection for ${study.modality} ${study.bodyPart}.`)
}

/** Compose a draft impression from detected findings (HITL — radiologist edits). */
export function draftImpression(findings: AiFinding[]): string {
  if (!findings.length) return ''
  const critical = findings.filter(f => f.category === 'critical')
  const actionable = findings.filter(f => f.category === 'actionable')
  if (critical.length) return `${critical.map(f => f.label).join('; ')} — URGENT correlation and clinical action advised.`
  if (actionable.length) return `${actionable.map(f => f.label).join('; ')}. Correlate clinically; follow-up as indicated.`
  return 'No acute abnormality detected on AI review. Clinical correlation advised.'
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 6 — Report consistency / release gate
// ─────────────────────────────────────────────────────────────────────────

export type ConsistencyResult = { ok: boolean; issues: string[] }
export function checkReportConsistency(study: RadiologyStudy): AiEnvelope<ConsistencyResult> {
  const sec = study.reportSections ?? {}
  const issues: string[] = []
  const findingsText = [sec.findings, sec.lungrads, sec.birads, sec.pirads, sec.tirads].filter(Boolean).join(' ')
  const impression = (sec.impression ?? '').trim()
  if (!impression) issues.push('Impression section is empty.')
  if (isCriticalText(findingsText) && !impression) issues.push('Findings mention a critical result but Impression is missing — release blocked.')
  if (isCriticalText(findingsText) && impression && !isCriticalText(impression)) issues.push('Critical finding in Findings is not reflected in Impression — please reconcile.')
  if (!(sec.findings ?? '').trim()) issues.push('Findings section is empty.')
  const ok = issues.length === 0
  return wrapAiResponse({ ok, issues }, ok ? 0.9 : 0.78, 'Cross-checked Findings ↔ Impression and required sections.')
}

// ─────────────────────────────────────────────────────────────────────────
// PHASE 8 — Patient-friendly summary
// ─────────────────────────────────────────────────────────────────────────

const GLOSSARY: [RegExp, string][] = [
  [/no acute (cardiopulmonary )?(findings|abnormality|intracranial pathology)/i, 'the scan looks normal with nothing urgent'],
  [/cardiomegaly/i, 'a slightly enlarged heart'],
  [/effusion/i, 'a small collection of fluid'],
  [/consolidation/i, 'an area of lung that may be infected'],
  [/nodule/i, 'a small spot that should be watched'],
  [/disc bulge|disc prolapse|protrusion/i, 'a disc in the spine pressing slightly'],
  [/fibroglandular/i, 'normal breast tissue'],
  [/bi-?rads ?1/i, 'a normal result'],
  [/cyst/i, 'a harmless fluid-filled sac'],
]
export function patientFriendlySummary(reportSections: Record<string, string>, patientName?: string): AiEnvelope<{ summary: string }> {
  const impression = reportSections.impression || reportSections.findings || ''
  let plain = impression
  for (const [re, repl] of GLOSSARY) plain = plain.replace(re, repl)
  plain = plain.replace(/[A-Z]{2,}/g, m => m.charAt(0) + m.slice(1).toLowerCase())
  const summary = impression
    ? `Hi${patientName ? ' ' + patientName.split(' ')[0] : ''}, your scan has been reviewed by a specialist. In simple terms: ${plain.toLowerCase()}. Your doctor will discuss what this means and any next steps with you.`
    : 'Your scan has been reviewed. Your doctor will discuss the results with you.'
  return wrapAiResponse({ summary }, 0.8, 'Templated plain-language rewrite with a medical-term glossary.')
}

// ─────────────────────────────────────────────────────────────────────────
// AI Command Center — queue urgency, workload forecast, ops assistant
// ─────────────────────────────────────────────────────────────────────────

/** Higher = more urgent for the AI Queue (criticality × confidence × priority). */
export function aiUrgencyScore(study: RadiologyStudy): number {
  const f = study.aiFindings ?? []
  const crit = f.find(x => x.category === 'critical')
  const top = f.reduce((m, x) => Math.max(m, x.confidence), 0)
  const critWeight = crit ? 2 : f.some(x => x.category === 'actionable') ? 1 : 0
  return critWeight * 100 + top * 50 + priorityRank(study.priority) * 10
}

export type WorkloadForecast = {
  next24hVolume: number
  byModality: { modality: Modality; count: number }[]
  staffingNeed: number
  tatRiskPct: number
  series: { hour: string; volume: number }[]
}
export function forecastWorkload(studies: RadiologyStudy[]): WorkloadForecast {
  const active = studies.filter(s => ACTIVE_STATUSES.has(s.status))
  const mods: Modality[] = ['XR', 'CT', 'MRI', 'US', 'MAMMO']
  const byModality = mods.map(modality => {
    const live = active.filter(s => s.modality === modality).length
    const base = ({ XR: 38, CT: 22, MRI: 14, US: 20, MAMMO: 8, NM: 6 } as Record<Modality, number>)[modality] ?? 10
    const count = Math.round(base + live * 1.5 + rand01(modality + 'wf') * 8)
    return { modality, count }
  })
  const next24hVolume = byModality.reduce((n, m) => n + m.count, 0)
  const breaches = studies.filter(isTatBreached).length
  const tatRiskPct = Math.min(100, Math.round((breaches / Math.max(1, active.length)) * 100) + 8)
  const staffingNeed = Math.max(2, Math.ceil(next24hVolume / 28))
  const series = Array.from({ length: 8 }, (_, i) => {
    const hr = (new Date().getHours() + i * 3) % 24
    const peak = hr >= 9 && hr <= 14 ? 1.5 : hr >= 18 ? 0.6 : 1
    return { hour: `${String(hr).padStart(2, '0')}:00`, volume: Math.round((next24hVolume / 8) * peak * (0.8 + rand01('s' + i) * 0.4)) }
  })
  return { next24hVolume, byModality, staffingNeed, tatRiskPct, series }
}

export type OpsAnswer = { text: string; rows?: { label: string; value: string }[] }
export function opsAssistantAnswer(query: string, studies: RadiologyStudy[]): OpsAnswer {
  const q = query.toLowerCase().trim()
  const active = studies.filter(s => ACTIVE_STATUSES.has(s.status))
  const breaches = studies.filter(isTatBreached)
  const modFromQ = (['xr', 'ct', 'mri', 'us', 'mammo'] as const).find(m => q.includes(m))
  const modUpper = modFromQ?.toUpperCase() as Modality | undefined

  if (/no.?show/.test(q)) {
    const risky = active.filter(s => (s.noShowRisk ?? 0) >= 0.35).sort((a, b) => (b.noShowRisk ?? 0) - (a.noShowRisk ?? 0)).slice(0, 6)
    return { text: `${risky.length} scheduled study(ies) have elevated no-show risk.`, rows: risky.map(s => ({ label: `${s.patientName} · ${s.name}`, value: `${Math.round((s.noShowRisk ?? 0) * 100)}%` })) }
  }
  if (/which modality|most (tat )?breach|worst modality/.test(q)) {
    const grouped = breaches.reduce<Record<string, number>>((acc, s) => { acc[s.modality] = (acc[s.modality] ?? 0) + 1; return acc }, {})
    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1])
    return { text: sorted.length ? `${sorted[0][0]} is causing the most TAT breaches (${sorted[0][1]}).` : 'No TAT breaches right now.', rows: sorted.map(([m, n]) => ({ label: m, value: `${n} breach(es)` })) }
  }
  if (/delay|overdue|breach|tat|> ?2 ?h|over 2/.test(q)) {
    let list = breaches
    if (modUpper) list = list.filter(s => s.modality === modUpper)
    if (/2 ?h|two hour|120/.test(q)) list = list.filter(s => minsElapsed(s.orderedAt) > 120)
    return { text: `${list.length} ${modUpper ?? ''} study(ies) currently breaching TAT.`.replace('  ', ' '), rows: list.slice(0, 8).map(s => ({ label: `${s.patientName} · ${s.name}`, value: `${minsElapsed(s.orderedAt)}m (target ${effectiveTAT(s)}m)` })) }
  }
  if (/critical/.test(q)) {
    const crit = studies.filter(s => (s.aiFindings ?? []).some(f => f.category === 'critical') || isCriticalText(s.reportSections?.impression))
    return { text: `${crit.length} study(ies) with critical AI/report findings.`, rows: crit.slice(0, 8).map(s => ({ label: `${s.patientName} · ${s.name}`, value: s.status })) }
  }
  if (/pending read|unread|to read|reading queue/.test(q)) {
    const acq = active.filter(s => s.status === 'acquired')
    return { text: `${acq.length} study(ies) acquired and awaiting a radiologist.`, rows: acq.slice(0, 8).map(s => ({ label: `${s.patientName} · ${s.name}`, value: `${minsElapsed(s.orderedAt)}m old` })) }
  }
  if (/volume|how many|count|today/.test(q)) {
    const byMod = (['XR', 'CT', 'MRI', 'US', 'MAMMO'] as Modality[]).map(m => ({ label: m, value: String(studies.filter(s => s.modality === m).length) }))
    return { text: `${studies.length} studies in the system today · ${active.length} active in the pipeline.`, rows: byMod }
  }
  return {
    text: `I can answer questions about TAT breaches, modality bottlenecks, no-show risk, critical findings, the reading queue and volumes. ${active.length} active studies, ${breaches.length} TAT breaches right now.`,
    rows: [
      { label: 'Active studies', value: String(active.length) },
      { label: 'TAT breaches', value: String(breaches.length) },
      { label: 'Awaiting read', value: String(active.filter(s => s.status === 'acquired').length) },
    ],
  }
}
