// Shared OPD registration used by both the typed wizard and the voice assistant.
// Generates a permanent UHID, registers the patient, links ABHA when supplied,
// logs the new self-check-in into the patient's live journey, and notifies staff.

import { usePatientProfileStore, emptyProfile } from '@/store/usePatientProfileStore'
import { useAuthStore } from '@/store/useAuthStore'
import { usePatientLiveStore } from '@/store/usePatientLiveStore'
import { useJourneyStore } from '@/store/useJourneyStore'
import { notifyAndAuditMany } from '@/lib/notifyAndAudit'
import type { Patient } from '@/store/usePatientStore'
import { effectiveTriage, type IntakeForm, type Gender } from '@/lib/intake/data'

export interface RegisterResult {
  patientId: string
  // Undefined for a brand-new self-check-in: no permanent UHID is stamped
  // until reception completes Aadhaar/ABHA verification for this patient
  // (see registerPatientFromIntake below). Only set here when the patient's
  // self-reported ABHA already resolves to a UHID from an earlier real visit.
  uhid?: string
  token: number
  familyToken: string | null
  estWait: number
}

export interface RegisterDeps {
  patients: Patient[]
  addPatient: (patient: Partial<Patient> & { name: string; phone: string }) => Promise<void>
  generateFamilyToken: (patientId: string, familyPhones: string[], consentGiven: boolean) => string
}

// PUH-<year>-<5-digit sequence>. Sequence continues from the highest UHID already
// issued this year so demo data stays monotonic; falls back to a timestamp tail.
export function generateUhid(patients: Patient[]): string {
  const year = new Date().getFullYear()
  const prefix = `PUH-${year}-`
  const maxSeq = patients.reduce((max, p) => {
    if (!p.uhid?.startsWith(prefix)) return max
    const seq = parseInt(p.uhid.slice(prefix.length), 10)
    return Number.isNaN(seq) ? max : Math.max(max, seq)
  }, 0)
  const seq = maxSeq > 0 ? maxSeq + 1 : Number(String(Date.now()).slice(-5))
  return `${prefix}${String(seq).padStart(5, '0')}`
}

// Returning-patient lookup (Decision Point #2): reuse the UHID already linked to
// this ABHA so repeat visitors keep one permanent identifier.
export function findUhidByAbha(abhaId: string): string | undefined {
  const clean = abhaId.trim()
  if (!clean) return undefined
  return Object.values(usePatientProfileStore.getState().profiles)
    .find(p => p.abhaId === clean && p.uhid)?.uhid
}

// ── Concurrency-safe UHID issuance ──────────────────────────────────────────
//
// generateUhid()'s per-year sequence is computed from the CALLER's local
// patients cache (Zustand state persisted in that browser), which is not
// guaranteed complete or fresh across simultaneous registrations at other
// reception terminals — two desks could compute the same "next" candidate at
// the same moment. The real `patients.uhid` column now carries a partial
// unique index (supabase/migrations/20260706070000_patients_identity_columns.sql)
// as the actual source of truth for uniqueness; this project has no existing
// precedent for a Postgres sequence/RPC doing business-logic ID issuance
// (the one existing SQL function, public.is_admin(), exists solely to break
// an RLS self-reference cycle — every domain module here otherwise keeps
// business logic in TypeScript, routed through the generic `table()` REST
// wrapper in _core.ts, which has no RPC call path). Rather than introduce
// that new pattern for one column, a collision is treated as a retry signal:
// on a unique-violation, regenerate (extending the caller's patient list with
// the failed candidate so generateUhid's own max-seq logic naturally bumps
// past it) and let the real unique index be the final arbiter. Collisions are
// expected to be rare in practice (only reception writes UHIDs, and each
// write is a discrete staff action), so a small bounded retry is sufficient —
// this can never silently produce a duplicate, since every attempt still
// goes through the same unique-constrained column.
const MAX_UHID_ATTEMPTS = 5

// Postgres reports a unique-violation with code 23505, but the generic
// `table()` wrapper in _core.ts re-throws every non-"table not found" error
// as a plain `Error` carrying only `error.message` (by design — it's shared
// infrastructure for every domain module, not worth widening just for this
// one caller's need for a machine-readable code). The unique index's name is
// stable and appears verbatim in Postgres's error text ('duplicate key value
// violates unique constraint "patients_uhid_unique_idx"'), so matching on it
// is a reliable, self-contained way to detect this specific collision
// without changing that shared error-handling contract.
const UHID_UNIQUE_INDEX_NAME = 'patients_uhid_unique_idx'

function isUhidCollision(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes(UHID_UNIQUE_INDEX_NAME)
}

/**
 * Attempt `write(candidateUhid)` — typically a `Patients.create`/`Patients.update`
 * call that persists `candidateUhid` into the real `patients.uhid` column —
 * retrying with a freshly bumped candidate if Postgres reports a unique-index
 * collision. Pass `initialUhid: undefined` for patients that aren't getting a
 * UHID at all (no collision is possible, so `write` runs exactly once).
 */
export async function writeWithUhidRetry<T>(
  patients: Patient[],
  initialUhid: string | undefined,
  write: (uhid: string | undefined) => Promise<T>,
): Promise<{ uhid: string | undefined; result: T }> {
  if (!initialUhid) return { uhid: undefined, result: await write(undefined) }
  let candidate = initialUhid
  for (let attempt = 1; attempt <= MAX_UHID_ATTEMPTS; attempt++) {
    try {
      const result = await write(candidate)
      return { uhid: candidate, result }
    } catch (err) {
      if (!isUhidCollision(err) || attempt === MAX_UHID_ATTEMPTS) throw err
      // generateUhid only ever reads `.uhid` off each entry (see its
      // implementation above), so a minimal stand-in patient carrying just
      // the failed candidate is enough to make it compute the next one —
      // `as unknown as Patient` is safe here for that reason even though
      // this stand-in doesn't populate Patient's other required fields.
      candidate = generateUhid([...patients, { uhid: candidate } as unknown as Patient])
    }
  }
  /* istanbul ignore next -- unreachable: loop always returns or throws */
  throw new Error('writeWithUhidRetry: unreachable')
}

export async function registerPatientFromIntake(form: IntakeForm, deps: RegisterDeps): Promise<RegisterResult> {
  const { patients, addPatient, generateFamilyToken } = deps
  const mode = form.consultationType === 'video' ? 'video' : 'in_person'
  const newToken = Math.max(...patients.map(p => p.token), 1000) + 1
  const newId = `PT-${Date.now()}`
  // Self-check-in never performs Aadhaar OTP verification (that only happens
  // at reception — see src/app/reception/register/page.tsx and
  // AadhaarAbhaFlow.tsx), so it must not stamp a fresh, permanent UHID here.
  // The one exception is a genuinely returning patient: if the self-reported
  // ABHA on this form already resolves to a UHID from an earlier *verified*
  // hospital visit (findUhidByAbha), reusing it is safe — that UHID was
  // established by reception's real Aadhaar flow at that prior visit, this
  // is just Decision Point #2's returning-patient shortcut, unchanged. A
  // brand-new patient (no match) gets NO uhid and `aadhaarVerified: false`,
  // so they correctly land in reception's "Needs Aadhaar" queue
  // (opd/page.tsx's matchesStatusFilter: status==='waiting' && !hasUhid) —
  // reception's own Aadhaar/ABHA/UHID flow (linkPatientIdentity) is what
  // stamps their permanent UHID, matching the intent already documented in
  // ReviewSuccess.tsx ("The UHID is created at the hospital after Aadhaar
  // verification... our staff will help you create or verify it").
  const uhid = form.abhaId ? findUhidByAbha(form.abhaId) : undefined
  const triage = effectiveTriage(form)
  const estWaitMins = (patients.filter(p => ['waiting', 'vitals'].includes(p.queueStatus)).length + 1) * 4
  const isGovtScheme = form.payer === 'govtScheme'
  const doctor = mode === 'video' ? (form.slotDoctor || 'Dr. Priya Nair') : 'Dr. Priya Nair'

  await addPatient({
    id: newId,
    uhid,
    aadhaarVerified: false,
    name: form.name,
    age: parseInt(form.age, 10),
    gender: (form.gender || 'Male') as Gender,
    phone: form.phone,
    bloodGroup: 'A+',
    token: newToken,
    estimatedWait: estWaitMins,
    doctor,
    department: form.departments[0] ?? 'General Medicine',
    departments: form.departments,
    visitTypes: [mode === 'video' ? 'Video consult' : 'In-person OPD'],
    insurer: isGovtScheme ? form.schemeName : (form.payer === 'cashless' ? (form.insurer || undefined) : undefined),
    symptoms: form.symptoms,
    history: [],
    triageLevel: triage.level,
    hasReports: form.hasReports,
  })

  // Parity with manual reception registration (src/app/reception/register/page.tsx):
  // log the new self-check-in into the live journey tracker.
  useJourneyStore.getState().addPatient(newId, form.name, doctor)

  // Persist the permanent UHID↔ABHA link so future visits resolve the returning
  // patient — only when we actually have an established UHID (the returning-patient
  // case above). A brand-new patient has no confirmed link yet; that gets written
  // once reception's own Aadhaar flow verifies and stamps a real UHID.
  if (form.abhaId && uhid) {
    usePatientProfileStore.getState().saveProfile(
      newId,
      {
        ...emptyProfile(),
        uhid,
        abhaId: form.abhaId,
        payerType: isGovtScheme ? 'Govt scheme' : undefined,
        insurer: isGovtScheme ? form.schemeName : undefined,
      },
      form.name,
    )
  }

  let familyToken: string | null = null
  if (form.dishaConsent && form.familyPhone.trim()) {
    familyToken = generateFamilyToken(newId, [form.familyPhone.trim()], true)
  }

  const auth = useAuthStore.getState()
  auth.setRole('patient')
  auth.setUser({ id: newId, name: form.name, role: 'patient' })
  usePatientLiveStore.getState().startVisit(newToken, mode)

  const uhidClause = uhid ? `UHID ${uhid}` : 'Aadhaar/UHID pending — verify at reception'
  notifyAndAuditMany(['reception', 'doctor'], {
    type: 'appointment',
    priority: triage.level === 'Critical' ? 'critical' : triage.level === 'High' ? 'high' : 'medium',
    title: `Self check-in · ${form.name}`,
    body: `${form.name} just checked in (${uhidClause}). Triage: ${triage.level}. ${isGovtScheme ? `Govt scheme: ${form.schemeName} · ABHA verified. ` : ''}${form.symptoms.length ? 'Symptoms: ' + form.symptoms.join(', ') + '.' : 'No symptoms provided.'} Token #${newToken}.`,
    patientName: form.name,
    audit: { action: 'reception_registered', resource: 'patient', resourceId: newId, detail: `Self-check-in completed · ${uhidClause} · token ${newToken}`, userName: form.name },
  })

  return { patientId: newId, uhid, token: newToken, familyToken, estWait: estWaitMins }
}
