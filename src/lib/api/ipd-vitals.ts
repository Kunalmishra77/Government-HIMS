/* IpdVitals — bedside vitals recorded independently by nursing staff, one row
 * per recording. Mirrors `VitalsRecord` in src/store/useInpatientStore.ts and
 * the `ipd_vitals` table in supabase/migrations/20260706010000_ipd_stays_schema.sql.
 *
 * `systolicBp`/`diastolicBp` (not the store's `systolicBP`/`diastolicBP`) —
 * _core.ts's naive camelCase<->snake_case conversion cannot round-trip two
 * adjacent uppercase letters. The store bridge (Task 6) maps between the two
 * spellings explicitly, exactly mirroring Lab's expectedTatMin precedent.
 *
 * `recordedBy`/`recordedByName` are a real `profiles.id` + denormalized
 * display name, not a free-text label — unlike Lab/Radiology's LabTech/
 * RadTech (whose local roster isn't backed by real auth users), IPD nursing
 * staff genuinely sign in as `role = 'nurse'` profiles, so `record()` takes
 * an explicit `actor: { id, name }` the caller MUST source from a live
 * session (see useInpatientStore.ts's `resolveRealIpdActor`, Task 4) — never
 * from the store's free-text `by` field, which stays a local-only display
 * convenience. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const IpdO2Delivery = z.enum(['Room air', 'Nasal cannula', 'Face mask', 'Non-rebreather', 'Ventilator'])
export const IpdConsciousness = z.enum(['A', 'V', 'P', 'U'])

export const IpdVitalActorSchema = z.object({ id: z.string(), name: z.string() })
export type IpdVitalActor = z.infer<typeof IpdVitalActorSchema>

export const IpdVitalSchema = z.object({
  id: z.string(),                          // 'IPV-...'
  ipdStayId: z.string(),
  patientId: z.string(),
  recordedAt: z.string(),
  recordedBy: z.string().uuid(),
  recordedByName: z.string(),
  hr: z.number().optional(),
  systolicBp: z.number().optional(),
  diastolicBp: z.number().optional(),
  rr: z.number().optional(),
  spo2: z.number().optional(),
  o2Delivery: IpdO2Delivery.optional(),
  o2Flow: z.number().optional(),
  temp: z.number().optional(),
  pain: z.number().optional(),
  bloodGlucose: z.number().optional(),
  consciousness: IpdConsciousness.optional(),
  gcs: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  capillaryRefill: z.number().optional(),
  urineOutput: z.number().optional(),
  note: z.string().optional(),
})
export type IpdVital = z.infer<typeof IpdVitalSchema>

const ipdVitals = table<IpdVital>('ipd_vitals', IpdVitalSchema)

export const IpdVitals = {
  byStay: (ipdStayId: string) => ipdVitals.list((v) => v.ipdStayId === ipdStayId),
  byPatient: (patientId: string) => ipdVitals.list((v) => v.patientId === patientId),

  async record(input: Omit<IpdVital, 'id' | 'recordedAt' | 'recordedBy' | 'recordedByName'>, actor: IpdVitalActor) {
    const row: IpdVital = {
      ...input,
      id: newId('IPV'),
      recordedAt: isoNow(),
      recordedBy: actor.id,
      recordedByName: actor.name,
    }
    return ipdVitals.insert(row)
  },

  _table: ipdVitals,
}
