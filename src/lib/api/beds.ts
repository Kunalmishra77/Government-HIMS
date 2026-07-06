/* Beds — the hospital's own bed board. Mirrors `Bed` in
 * src/store/useAdmissionStore.ts and the `beds` table in
 * supabase/migrations/20260706011000_beds_schema.sql.
 *
 * No `realId` indirection: a bed's local id (e.g. 'BED-101') IS the real
 * row's primary key directly (see this plan's Global Constraints).
 * `upsert()` uses `put()` (upsert), not `insert()`-only, so repeatedly
 * assigning/cleaning the same bed always updates the one real row. */
import { z } from 'zod'
import { audit, table } from './_core'

export const BedWard = z.enum(['General Ward', 'ICU', 'Private Room', 'Semi-Private', 'Day Care'])
export const BedStatus = z.enum(['Available', 'Occupied', 'Cleaning', 'Reserved', 'Maintenance'])
export const BedGender = z.enum(['Male', 'Female', 'Any'])

export const BedSchema = z.object({
  id: z.string(),                          // 'BED-...'
  bedNumber: z.string(),
  ward: BedWard,
  floor: z.string(),
  status: BedStatus.default('Available'),
  occupantId: z.string().optional(),
  occupantName: z.string().optional(),
  cleaningAssignedTo: z.string().optional(),
  lastCleaned: z.string().optional(),
  gender: BedGender.optional(),
  expectedFreeAt: z.string().optional(),
})
export type Bed = z.infer<typeof BedSchema>

const beds = table<Bed>('beds', BedSchema)

export const Beds = {
  list: (filter?: (b: Bed) => boolean) => beds.list(filter),
  get: (id: string) => beds.get(id),
  byWard: (ward: Bed['ward']) => beds.list((b) => b.ward === ward),

  async upsert(bed: Bed) {
    const saved = await beds.put(bed)
    audit.emit({
      action: bed.status === 'Occupied' ? 'admission_admit' : 'housekeeping_bed_turned',
      resource: 'bed',
      resourceId: saved.id,
      detail: `Bed ${saved.bedNumber} (${saved.ward}) -> ${saved.status}`,
    })
    return saved
  },

  _table: beds,
}
