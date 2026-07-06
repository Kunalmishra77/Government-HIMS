/* NarcoticsLog — controlled-substance (Schedule H1/X) dual-signature
 * register. Mirrors `NarcoticEntry` in src/store/useNarcoticsStore.ts and the
 * `narcotics_log` table in supabase/migrations/20260705050000_pharmacy_schema.sql.
 *
 * Unlike every other bridged action in this phase, NarcoticsLog.create() has
 * no `realId`-backed parent entity to gate on — the local NarcoticEntry
 * carries no prescription/dispense id at all (only free-text patient/
 * patientId display fields), so there is no local-vs-real distinction to
 * reconcile. The store bridge (Task 6) gates purely on live-session presence,
 * matching how src/lib/api/_core.ts's own `audit.emit()` fire-and-forgets
 * without a parent-entity handshake.
 *
 * `dispenser` is NOT verified by this module — see pharmacy-dispenses.ts's
 * module-level note; the same actor-identity caveat applies. `prescriber` and
 * `secondSignatory` are plain display-label copies of the prescription's
 * already-known doctor name (not "who is performing this action"), so they
 * carry no equivalent impersonation risk and are passed through as-is. */
import { z } from 'zod'
import { id as newId, table } from './_core'

export const NarcoticEntrySchema = z.object({
  id: z.string(),                    // 'NCL-...'
  drug: z.string(),
  date: z.string(),
  time: z.string(),
  patient: z.string(),
  patientId: z.string(),
  dose: z.string(),
  prescriber: z.string(),
  dispenser: z.string(),
  secondSignatory: z.string(),
  batchNo: z.string(),
  runningStock: z.number().int().nonnegative(),
})
export type NarcoticEntry = z.infer<typeof NarcoticEntrySchema>

const narcoticsLog = table<NarcoticEntry>('narcotics_log', NarcoticEntrySchema)

export const NarcoticsLog = {
  list: (filter?: (e: NarcoticEntry) => boolean) => narcoticsLog.list(filter),
  get: (id: string) => narcoticsLog.get(id),

  async create(input: Omit<NarcoticEntry, 'id'>) {
    return narcoticsLog.insert({ ...input, id: newId('NCL') })
  },

  _table: narcoticsLog,
}
