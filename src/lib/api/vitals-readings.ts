/* VitalsReadings — nurse/doctor-recorded bedside vitals, one row per reading.
 * `payload` holds whatever fields the recording form captured (hr, systolicBP,
 * diastolicBP, spo2, temp, ...) — kept as a free-form record rather than a
 * fixed schema here because the richer VitalsRecord shape (useInpatientStore.ts)
 * already owns that contract; this table just needs to store and retrieve it. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const VitalsReadingSchema = z.object({
  id: z.string(),                 // 'VR-...'
  visitId: z.string(),
  recordedBy: z.string().uuid(),
  recordedAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
})
export type VitalsReading = z.infer<typeof VitalsReadingSchema>

const vitalsReadings = table<VitalsReading>('vitals_readings', VitalsReadingSchema)

export const VitalsReadings = {
  byVisit: (visitId: string) => vitalsReadings.list((v) => v.visitId === visitId),
  async create(input: { visitId: string; recordedBy: string; payload: Record<string, unknown> }) {
    const row: VitalsReading = {
      id: newId('VR'),
      visitId: input.visitId,
      recordedBy: input.recordedBy,
      recordedAt: isoNow(),
      payload: input.payload,
    }
    return vitalsReadings.put(row)
  },
  _table: vitalsReadings,
}
