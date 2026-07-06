export type ESILevel = 1 | 2 | 3 | 4 | 5

export interface TriageVitals {
  heartRate?: number
  respiratoryRate?: number
  systolicBP?: number
  spo2?: number
  temperatureCelsius?: number
  gcsScore?: number
}

export interface TriageResult {
  esiLevel: ESILevel
  label: string
  color: string
  maxWaitMinutes: number
  triggeringCriteria: string[]
}

const ESI_META: Record<ESILevel, Omit<TriageResult, 'esiLevel' | 'triggeringCriteria'>> = {
  1: { label: 'Resuscitation',    color: '#DC2626', maxWaitMinutes: 0 },
  2: { label: 'Emergent',         color: '#EE6B26', maxWaitMinutes: 10 },
  3: { label: 'Urgent',           color: '#EAB308', maxWaitMinutes: 30 },
  4: { label: 'Less Urgent',      color: '#22C55E', maxWaitMinutes: 60 },
  5: { label: 'Non-Urgent',       color: '#338AF0', maxWaitMinutes: 120 },
}

export function classifyTriage(vitals: TriageVitals): TriageResult {
  const criteria: string[] = []
  let level: ESILevel = 5
  const { heartRate: hr, respiratoryRate: rr, systolicBP: sbp, spo2, temperatureCelsius: temp, gcsScore: gcs } = vitals
  if (gcs !== undefined && gcs < 9) { criteria.push(`GCS ${gcs} — unresponsive`); level = 1 }
  if (sbp !== undefined && sbp < 70) { criteria.push(`SBP ${sbp} mmHg — severe hypotension`); level = 1 }
  if (spo2 !== undefined && spo2 < 85) { criteria.push(`SpO2 ${spo2}% — severe hypoxia`); level = 1 }
  if (rr !== undefined && rr > 30) { criteria.push(`RR ${rr}/min — severe respiratory distress`); level = Math.min(level, 2) as ESILevel }
  if (hr !== undefined && hr > 130) { criteria.push(`HR ${hr} — severe tachycardia`); level = Math.min(level, 2) as ESILevel }
  if (sbp !== undefined && sbp < 90) { criteria.push(`SBP ${sbp} mmHg — hypotension`); level = Math.min(level, 2) as ESILevel }
  if (spo2 !== undefined && spo2 < 92) { criteria.push(`SpO2 ${spo2}% — hypoxia`); level = Math.min(level, 2) as ESILevel }
  if (temp !== undefined && temp > 39) { criteria.push(`Temp ${temp}°C — high fever`); level = Math.min(level, 3) as ESILevel }
  if (hr !== undefined && (hr > 100 || hr < 50)) { criteria.push(`HR ${hr} — abnormal`); level = Math.min(level, 3) as ESILevel }
  if (criteria.length === 0) { criteria.push('Vital signs within normal limits'); level = 4 }
  const meta = ESI_META[level]
  return { esiLevel: level, ...meta, triggeringCriteria: criteria }
}
