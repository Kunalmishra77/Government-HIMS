/* Admission requests — a doctor's request to admit a patient to a ward/ICU/bed,
 * linked back to the real visit. Mirrors the AdmissionRequest shape used by
 * useAdmissionStore.ts, minus its denormalized `bundle` snapshot (the backend
 * already has that data in real prescriptions/orders rows linked by visit_id). */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const AdmissionType = z.enum(['General Ward', 'ICU', 'Private Room', 'Semi-Private', 'Day Care'])
export const AdmissionStatus = z.enum(['requested', 'bed_assigned', 'admitted', 'cancelled'])

export const AdmissionRequestSchema = z.object({
  id: z.string(),                    // 'ADM-...'
  visitId: z.string(),
  patientId: z.string(),
  doctorId: z.string().uuid(),
  diagnosis: z.string().optional(),
  admissionType: AdmissionType,
  bedTypePreference: z.string().optional(),
  reason: z.string().optional(),
  department: z.string().optional(),
  triageLevel: z.string().optional(),
  payerType: z.string().optional(),
  status: AdmissionStatus.default('requested'),
  requestedAt: z.string(),
})
export type AdmissionRequest = z.infer<typeof AdmissionRequestSchema>

const admissionRequests = table<AdmissionRequest>('admission_requests', AdmissionRequestSchema)

export const AdmissionRequests = {
  list: (filter?: (a: AdmissionRequest) => boolean) => admissionRequests.list(filter),
  get: (id: string) => admissionRequests.get(id),
  byPatient: (patientId: string) => admissionRequests.list((a) => a.patientId === patientId),
  byStatus: (status: AdmissionRequest['status']) => admissionRequests.list((a) => a.status === status),
  async create(input: Omit<AdmissionRequest, 'id' | 'requestedAt' | 'status'> & { id?: string }) {
    const row: AdmissionRequest = {
      ...input,
      id: input.id ?? newId('ADM'),
      status: 'requested',
      requestedAt: isoNow(),
    }
    const saved = await admissionRequests.insert(row)
    audit.emit({
      action: 'admission_admit',
      resource: 'admission_request',
      resourceId: saved.id,
      userId: saved.doctorId,
      detail: `Admission requested for ${saved.patientId} — ${saved.admissionType} (${saved.department ?? 'unspecified'})`,
    })
    return saved
  },
  async assignToBed(id: string) {
    return admissionRequests.patch(id, { status: 'bed_assigned' })
  },
  async markAdmitted(id: string) {
    const patched = await admissionRequests.patch(id, { status: 'admitted' })
    if (patched) {
      audit.emit({
        action: 'admission_admit',
        resource: 'admission_request',
        resourceId: id,
        detail: `${patched.patientId} admitted`,
      })
    }
    return patched
  },
  async cancel(id: string) {
    return admissionRequests.patch(id, { status: 'cancelled' })
  },
  _table: admissionRequests,
}
