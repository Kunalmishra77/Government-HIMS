import type { PatientProfile } from "@/store/usePatientProfileStore"
import { checkRx, type RxWarning } from "@/lib/drugSafety"
import { news2FromRecord, bmi as calcBmi } from "@/lib/vitals"

// Validation + AI helpers for the first-visit profile wizard. AI here is
// deterministic and grounded: an allergy↔medication cross-check (reusing the
// drug-safety matrix), a BMI band, and a one-line risk snapshot for the doctor.

// The minimal vitals the gating cares about (matches the M2 VitalsRecord subset).
export type VitalsDraft = {
  hr?: number; systolicBP?: number; diastolicBP?: number; rr?: number; spo2?: number; temp?: number
  o2Delivery?: string; consciousness?: string
}

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const RELATIONS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Guardian', 'Other']
export const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Kannada', 'Other']

// Required to advance the patient to the doctor (fully-required policy). Allergies
// must be either listed or explicitly marked "none" — an explicit clinical statement.
export function missingMandatory(p: PatientProfile, v: VitalsDraft): string[] {
  const m: string[] = []
  if (!p.bloodGroup) m.push("Blood group")
  if (p.allergies.length === 0 && !p.noKnownAllergies) m.push("Allergies (add, or mark “no known allergies”)")
  const coreVitals = [v.hr, v.systolicBP, v.diastolicBP, v.rr, v.spo2, v.temp]
  if (coreVitals.some(x => x == null)) m.push("Core vitals (HR, BP, RR, SpO₂, temp)")
  return m
}

export type BmiBand = { bmi: number; label: string; tone: "ok" | "warn" | "bad" }
export function bmiBand(weightKg?: number, heightCm?: number): BmiBand | undefined {
  const b = calcBmi(weightKg, heightCm)
  if (b == null) return undefined
  if (b < 18.5) return { bmi: b, label: "Underweight", tone: "warn" }
  if (b < 25) return { bmi: b, label: "Normal", tone: "ok" }
  if (b < 30) return { bmi: b, label: "Overweight", tone: "warn" }
  return { bmi: b, label: "Obese", tone: "bad" }
}

// AI: does any listed allergy conflict with a listed current medication?
export function allergyMedConflicts(p: PatientProfile): RxWarning[] {
  if (!p.allergies.length || !p.currentMedications.length) return []
  return checkRx(p.currentMedications, { allergies: p.allergies }).filter(w => w.type === "allergy")
}

// AI risk snapshot — one grounded line for the doctor, from profile + vitals.
export function riskSnapshot(p: PatientProfile, v: VitalsDraft, meta: { age: number; gender: string }): string {
  const news = news2FromRecord({
    hr: v.hr, systolicBP: v.systolicBP, rr: v.rr, spo2: v.spo2, temp: v.temp,
    o2Delivery: v.o2Delivery as never, consciousness: v.consciousness as never,
  })
  const bits: string[] = [`${meta.age}${(meta.gender || "?")[0]}`]
  if (p.chronicConditions.length) bits.push(p.chronicConditions.join(" + "))
  if (p.allergies.length) bits.push(`${p.allergies[0]}-allergic`)
  bits.push(`NEWS ${news.score} (${news.band})`)
  const band = bmiBand(p.weightKg, p.heightCm)
  if (band && band.tone !== "ok") bits.push(band.label.toLowerCase())
  if (p.smoking === "Current") bits.push("current smoker")
  let flag = ""
  if (news.band === "high") flag = " — escalate / senior review"
  else if (news.band === "medium") flag = " — closer monitoring"
  else if (allergyMedConflicts(p).length) flag = " — allergy/med conflict, review meds"
  return bits.join(", ") + flag + "."
}

// Coarse completeness (for the review checklist / progress).
export function completeness(p: PatientProfile): number {
  const checks = [
    !!p.bloodGroup, !!p.address?.trim(), !!p.emergencyName?.trim(), !!p.emergencyPhone?.trim(),
    p.allergies.length > 0 || !!p.noKnownAllergies, p.chronicConditions.length >= 0,
    p.heightCm != null && p.weightKg != null, !!p.smoking, !!p.payerType,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
