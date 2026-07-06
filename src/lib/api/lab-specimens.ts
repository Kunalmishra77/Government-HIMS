/* LabSpecimens — physical specimen tracking (accession, collection, rejection).
 * Mirrors `Specimen` in src/store/useLabOrdersStore.ts and the `lab_specimens`
 * table in supabase/migrations/20260704210827_laboratory_schema.sql.
 *
 * `collectedBy` is a free-text phlebotomist name (e.g. "Phlebo Saira"), NOT a
 * profiles FK — phlebotomists aren't necessarily authenticated profiles rows
 * in this store, matching the migration's design note. Unlike LabTests'
 * LabTech actors (assignedTo/enteredBy/verifiedBy), there is no
 * impersonation/audit-trail concern here: no real backend identity is being
 * claimed, just a display label. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const LabSpecimenType = z.enum(['EDTA', 'serum', 'urine_cup', 'blood_culture', 'swab', 'sputum', 'tissue'])
export const LabRejectReason = z.enum(['hemolyzed', 'clotted', 'insufficient', 'wrong_tube', 'unlabeled', 'contaminated'])

export const LabSpecimenSchema = z.object({
  id: z.string(),                       // accession, e.g. 'ACC-1042'
  orderId: z.string(),
  type: LabSpecimenType,
  container: z.string(),
  collectedBy: z.string().optional(),   // free-text name — not a profiles FK
  collectedAt: z.string().optional(),
  volume: z.string().optional(),
  rejectReason: LabRejectReason.optional(),
})
export type LabSpecimen = z.infer<typeof LabSpecimenSchema>

const labSpecimens = table<LabSpecimen>('lab_specimens', LabSpecimenSchema)

export const LabSpecimens = {
  list: (filter?: (s: LabSpecimen) => boolean) => labSpecimens.list(filter),
  get: (id: string) => labSpecimens.get(id),
  byOrder: (orderId: string) => labSpecimens.list((s) => s.orderId === orderId),

  async create(input: Omit<LabSpecimen, 'id'> & { id?: string }) {
    const row: LabSpecimen = { ...input, id: input.id ?? newId('ACC') }
    return labSpecimens.insert(row)
  },

  async collect(accession: string, collectedBy: string) {
    return labSpecimens.patch(accession, { collectedBy, collectedAt: isoNow() })
  },

  async reject(accession: string, reason: z.infer<typeof LabRejectReason>) {
    const patched = await labSpecimens.patch(accession, { rejectReason: reason })
    if (patched) {
      audit.emit({
        action: 'lab_order',
        resource: 'lab_specimen',
        resourceId: accession,
        detail: `Specimen ${accession} (${patched.type}) rejected — ${reason}`,
      })
    }
    return patched
  },

  // Phase 4 Task 4 — reverses `reject`: clears rejectReason and any previous
  // collection stamp so the specimen re-enters "awaiting collection",
  // mirroring useLabOrdersStore.recollectOrder's local reset. Explicit
  // `null`s (not `undefined`) actually clear the columns — see
  // lab-tests.ts's unclaim() comment on why undefined-valued keys never
  // reach Postgres via patch()'s JSON body.
  async recollect(accession: string) {
    return labSpecimens.patch(accession, {
      rejectReason: null as unknown as LabSpecimen['rejectReason'],
      collectedAt: null as unknown as LabSpecimen['collectedAt'],
      collectedBy: null as unknown as LabSpecimen['collectedBy'],
    })
  },

  _table: labSpecimens,
}
