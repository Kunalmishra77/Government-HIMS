/* LabReflexSuggestions — auto-suggested follow-up tests raised when a released
 * lab result crosses a reflex rule (src/lib/reflexRules.ts's evaluateReflex).
 * Mirrors `ReflexSuggestion` in src/store/useLabOrdersStore.ts and the
 * `lab_reflex_suggestions` table in
 * supabase/migrations/20260704210827_laboratory_schema.sql.
 *
 * No actor/identity field on this table (unlike lab-tests.ts's assignedTo/
 * enteredBy/verifiedBy) — a reflex suggestion is a system-generated inference
 * from a released result, not an action performed by a specific person, so
 * there is no segregation-of-duties concern here the way there is for
 * LabTests' actor-scoped methods.
 *
 * Phase 4 Task 6 — created narrowly so `releaseTest`'s reflex auto-trigger
 * (useLabOrdersStore.ts) can write a real row alongside the local
 * `pushReflex()` call, giving Task 8's accept/dismiss bridge something real
 * to act on. Only `create()` was needed for that.
 *
 * Phase 4 Task 8 — added `orderIt`/`dismiss` for the `orderReflex`/
 * `dismissReflex` store bridge. "Order" stamps `ordered_at` in place (the row
 * survives — mirrors the LOCAL orderReflex action, which keeps the suggestion
 * and just stamps `orderedAt`, moving it into the UI's "Ordered" history).
 * "Dismiss" deletes the row outright — there is no `dismissed` column on this
 * table (see the schema migration), and the LOCAL dismissReflex action simply
 * filters the suggestion out of state entirely with no dismissed-history view
 * anywhere in the UI, so a real DELETE is the matching real-world action. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const LabReflexSuggestionSchema = z.object({
  id: z.string(),                 // 'RS-...'
  basedOnTestId: z.string(),      // FK -> lab_tests.id (the REAL test id, not the local one)
  patientName: z.string(),
  triggerSummary: z.string(),
  code: z.string(),               // suggested follow-up test's catalog code
  reason: z.string(),
  orderedAt: z.string().optional(),  // stamped once the incharge accepts the suggestion (Task 8)
  createdAt: z.string(),
})
export type LabReflexSuggestion = z.infer<typeof LabReflexSuggestionSchema>

const labReflexSuggestions = table<LabReflexSuggestion>('lab_reflex_suggestions', LabReflexSuggestionSchema)

export const LabReflexSuggestions = {
  list: (filter?: (r: LabReflexSuggestion) => boolean) => labReflexSuggestions.list(filter),
  get: (id: string) => labReflexSuggestions.get(id),
  byTest: (testId: string) => labReflexSuggestions.list((r) => r.basedOnTestId === testId),

  async create(input: Omit<LabReflexSuggestion, 'id' | 'createdAt'> & { id?: string }) {
    const row: LabReflexSuggestion = {
      ...input,
      id: input.id ?? newId('RS'),
      createdAt: isoNow(),
    }
    return labReflexSuggestions.insert(row)
  },

  // Phase 4 Task 8 — stamps `ordered_at` once the lab incharge accepts the
  // suggestion (see useLabOrdersStore.ts's orderReflex bridge). The row is
  // otherwise left in place, matching the local action's behavior.
  async orderIt(id: string) {
    return labReflexSuggestions.patch(id, { orderedAt: isoNow() })
  },

  // Phase 4 Task 8 — deletes the row outright (see useLabOrdersStore.ts's
  // dismissReflex bridge and this module's header comment for why deletion,
  // not a status column, is the correct real-world counterpart to "dismiss").
  async dismiss(id: string) {
    return labReflexSuggestions.remove(id)
  },

  _table: labReflexSuggestions,
}
