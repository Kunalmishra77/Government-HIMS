/* Patients — registry of identifying + demographic data. Mirrors TRD §5 /api/patients. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const Sex = z.enum(['Male', 'Female', 'Other'])
export const PayerType = z.enum(['cash', 'corporate', 'insurance', 'govt'])

export const PatientSchema = z.object({
  id: z.string(),                  // PT-XXXXX
  hn: z.string(),                  // Hospital Number, unique-per-tenant
  fullName: z.string(),
  phone: z.string(),
  dob: z.string().optional(),
  age: z.number().int().nonnegative().optional(),
  sex: Sex,
  bloodGroup: z.string().optional(),
  primaryPayer: PayerType.default('cash'),
  insurerName: z.string().optional(),
  address: z.string().optional(),
  allergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  dishaConsentAt: z.string().optional(),
  authUserId: z.string().uuid().optional(),
  // AABHA/UHID identity (Reception's Aadhaar -> ABHA -> UHID flow).
  // uhid/abhaId single-capital acronyms -> uhid/abha_id snake_case via
  // _core.ts's toSnakeCase (no consecutive-capitals pitfall here — that only
  // bites names like "abhaID"). uhid stays optional/nullable: self-check-in
  // patients don't get one until reception completes verification (see
  // src/lib/intake/register.ts).
  uhid: z.string().optional(),
  abhaId: z.string().optional(),
  aadhaarVerified: z.boolean().default(false),
  familyContacts: z.array(z.object({ name: z.string(), relation: z.string(), phone: z.string() })).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
})
export type Patient = z.infer<typeof PatientSchema>

const patients = table<Patient>('patients', PatientSchema)

export const Patients = {
  list: (filter?: (p: Patient) => boolean) => patients.list(filter ?? ((p) => !p.deletedAt)),
  get: (id: string) => patients.get(id),
  async create(input: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const candidate: Patient = {
      ...input,
      id: input.id ?? (input.hn ? `PT-${input.hn}` : newId('PT')),
      createdAt: isoNow(),
      updatedAt: isoNow(),
    } as Patient
    const saved = await patients.put(candidate)
    audit.emit({
      action: 'reception_registered',
      resource: 'patient',
      resourceId: saved.id,
      detail: `${saved.fullName} (${saved.sex}, ${saved.age ?? '?'}y) registered`,
    })
    return saved
  },
  async update(idOrPatient: string | Patient, partial?: Partial<Patient>) {
    if (typeof idOrPatient === 'string') {
      const patched = await patients.patch(idOrPatient, { ...(partial ?? {}), updatedAt: isoNow() })
      if (patched) {
        audit.emit({
          action: 'reception_registered',
          resource: 'patient',
          resourceId: patched.id,
          detail: `Updated ${patched.fullName}`,
        })
      }
      return patched
    }
    const saved = await patients.put({ ...idOrPatient, updatedAt: isoNow() })
    return saved
  },
  async softDelete(id: string) {
    const patched = await patients.patch(id, { deletedAt: isoNow(), updatedAt: isoNow() })
    if (patched) {
      audit.emit({
        action: 'disha_rtbf_fulfilled',
        resource: 'patient',
        resourceId: patched.id,
        detail: `${patched.fullName} soft-deleted (RTBF)`,
      })
    }
    return patched
  },
  count: () => patients.count(),
  _table: patients,
}
