// Unique Health ID (UHID) — the primary patient identifier surfaced across the
// platform. Canonical UHIDs live on the reception patient record
// (usePatientStore). Downstream domain stores (lab, radiology, pharmacy, …)
// historically key patients only by internal id (PT-XXXXX); this helper derives
// a stable, realistic UHID from that id so the same patient shows the same UHID
// everywhere, even where a canonical value was never captured.

const UHID_YEAR = 2026

// Deterministic: same patientId always yields the same UHID (no randomness, so
// it is safe in seed data and SSR). Format: PUH-YYYY-NNNNN.
export function deriveUhid(patientId: string): string {
  const digits = patientId.replace(/\D/g, '')
  let n = 0
  for (let i = 0; i < patientId.length; i++) n = (n * 31 + patientId.charCodeAt(i)) >>> 0
  const serial = (digits ? Number(digits.slice(-5)) : n % 100000) % 100000
  return `PUH-${UHID_YEAR}-${String(serial).padStart(5, '0')}`
}

// Prefer an explicit/canonical UHID when present, else derive one.
export function resolveUhid(patientId: string, canonical?: string | null): string {
  return canonical && canonical.trim() ? canonical : deriveUhid(patientId)
}
