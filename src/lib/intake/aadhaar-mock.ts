// src/lib/intake/aadhaar-mock.ts
//
// Deterministic, network-free mock of the Aadhaar → ABHA identity rails used by
// the reception registration journey and the OPD queue "Complete Aadhaar
// Verification" quick-action. Mirrors the demo conventions already in the app:
// masked Aadhaar (XXXX-XXXX-7382), a deterministic OTP, and a 14-XXXX-XXXX-XXXX
// ABHA number (matching the in-app ABHA sandbox + the seeded patient profiles).

import { portraitDataUri } from '@/lib/avatars'

export type Gender = 'Male' | 'Female' | 'Other'

export interface AadhaarDemographics {
  name: string
  fathersName?: string  // guardian / father's name as printed on Aadhaar
  dob: string          // DD-MM-YYYY
  age: number
  gender: Gender
  phone: string        // 10-digit
  email?: string
  address: string      // complete address line
  city: string
  district: string
  state: string
  pincode: string
  photo: string        // Aadhaar photograph (data-URI)
}

export interface AbhaProfile {
  abhaNumber: string   // 14-XXXX-XXXX-XXXX
  abhaAddress: string  // <digits>@abdm
}

interface AadhaarRecord extends AadhaarDemographics {
  maskedAadhaar: string        // XXXX-XXXX-NNNN
  linkedAbha?: AbhaProfile     // present → ABHA already exists for this Aadhaar
}

const abhaAddressFor = (abhaNumber: string) => `${abhaNumber.replace(/\D/g, '')}@abdm`

// Keyed by the last 4 digits of the Aadhaar number. The default (7382) matches the
// OcrIntakeCard Aadhaar OCR payload so scan/upload stays visually consistent.
const MOCK_AADHAAR_DB: Record<string, AadhaarRecord> = {
  '7382': {
    maskedAadhaar: 'XXXX-XXXX-7382',
    name: 'Anil Kumar Verma', fathersName: 'Ram Prasad Verma', dob: '12-04-1988', age: 38, gender: 'Male',
    phone: '9876543210', email: 'anil.verma@example.in',
    address: '24, Civil Lines', city: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001',
    photo: portraitDataUri('Anil Kumar Verma', 'Male'),
  },
  '9012': {
    maskedAadhaar: 'XXXX-XXXX-9012',
    name: 'Kiran Patil', fathersName: 'Dattatray Patil', dob: '03-07-1971', age: 55, gender: 'Male',
    phone: '9900112233', email: 'kiran.patil@example.in',
    address: '12, Shanti Nagar, Sector 4', city: 'Pune', district: 'Pune', state: 'Maharashtra', pincode: '411014',
    photo: portraitDataUri('Kiran Patil', 'Male'),
    linkedAbha: { abhaNumber: '14-2841-7762-9012', abhaAddress: abhaAddressFor('14-2841-7762-9012') },
  },
  '4455': {
    maskedAadhaar: 'XXXX-XXXX-4455',
    name: 'Sunita Devi', fathersName: 'Mohan Lal', dob: '19-11-1995', age: 30, gender: 'Female',
    phone: '9812345678',
    address: '7, Gandhi Marg', city: 'Kanpur', district: 'Kanpur Nagar', state: 'Uttar Pradesh', pincode: '208001',
    photo: portraitDataUri('Sunita Devi', 'Female'),
  },
}

const DEFAULT_KEY = '7382'

function recordFor(aadhaar: string): AadhaarRecord {
  const last4 = aadhaar.replace(/\D/g, '').slice(-4)
  return MOCK_AADHAAR_DB[last4] ?? MOCK_AADHAAR_DB[DEFAULT_KEY]
}

/** Simulate parsing the Aadhaar secure QR / barcode → extract the (masked) number. */
export function extractAadhaarFromQr(): { maskedAadhaar: string } {
  return { maskedAadhaar: MOCK_AADHAAR_DB[DEFAULT_KEY].maskedAadhaar }
}

/** Simulate OCR of an uploaded Aadhaar image/PDF → extract the (masked) number. */
export function parseAadhaarUpload(): { maskedAadhaar: string } {
  return { maskedAadhaar: MOCK_AADHAAR_DB[DEFAULT_KEY].maskedAadhaar }
}

/** Mask the mobile linked to an Aadhaar for display (e.g. +91 ******3210). */
export function linkedMobileFor(aadhaar: string): string {
  const phone = recordFor(aadhaar).phone
  return `+91 ******${phone.slice(-4)}`
}

/**
 * Dispatch a (mock) OTP to the Aadhaar-linked mobile. Returns the demo code so the
 * caller can surface it via toast — same convention as IdentityCaptureCard / the
 * ABHA sandbox. Deterministic from the linked phone so it's reproducible on screen.
 */
export function sendAadhaarOtp(aadhaar: string): { ref: string; demoCode: string; maskedMobile: string } {
  const phone = recordFor(aadhaar).phone
  const demoCode = String(((Number(phone.slice(-4)) || 1234) * 7 % 900000) + 100000).slice(0, 6)
  return { ref: demoCode, demoCode, maskedMobile: linkedMobileFor(aadhaar) }
}

export function verifyAadhaarOtp(code: string, ref: string): boolean {
  return code.trim() === ref
}

/** After OTP verification, fetch the demographics linked to the Aadhaar. */
export function fetchAadhaarDemographics(aadhaar: string): AadhaarDemographics {
  const r = recordFor(aadhaar)
  return {
    name: r.name, fathersName: r.fathersName, dob: r.dob, age: r.age, gender: r.gender, phone: r.phone, email: r.email,
    address: r.address, city: r.city, district: r.district, state: r.state, pincode: r.pincode, photo: r.photo,
  }
}

/** Check whether an ABHA already exists for this Aadhaar (returning patient). */
export function detectAbha(aadhaar: string): { exists: boolean; profile?: AbhaProfile } {
  const linked = recordFor(aadhaar).linkedAbha
  return linked ? { exists: true, profile: linked } : { exists: false }
}

/** Create a new ABHA (14-XXXX-XXXX-XXXX + @abdm address), matching the sandbox format. */
export function createAbha(): AbhaProfile {
  const block = () => Math.floor(1000 + Math.random() * 9000)
  const abhaNumber = `14-${block()}-${block()}-${block()}`
  return { abhaNumber, abhaAddress: abhaAddressFor(abhaNumber) }
}
