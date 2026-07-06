/* Visits — OPD / ER / IPD top-level visit record. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const VisitKind = z.enum(['OPD', 'ER', 'IPD', 'OnlineConsult'])
export const VisitStatus = z.enum([
  'scheduled', 'waiting', 'vitals', 'consulting', 'pharmacy', 'billing',
  'completed', 'cancelled',
])

export const VisitSchema = z.object({
  id: z.string(),                        // VIS-...
  patientId: z.string(),
  kind: VisitKind,
  doctorId: z.string().uuid().optional(),
  doctorName: z.string().optional(),
  department: z.string(),
  status: VisitStatus,
  token: z.number().int().optional(),
  scheduledAt: z.string().optional(),
  arrivedAt: z.string().optional(),
  servedAt: z.string().optional(),
  completedAt: z.string().optional(),
  payerType: z.enum(['cash', 'corporate', 'insurance', 'govt']).default('cash'),
  chiefComplaint: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  estimatedWaitMin: z.number().int().optional(),
  triageLevel: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Visit = z.infer<typeof VisitSchema>

const visits = table<Visit>('visits', VisitSchema)

export const Visits = {
  list: (filter?: (v: Visit) => boolean) => visits.list(filter),
  get: (id: string) => visits.get(id),
  byPatient: (patientId: string) => visits.list((v) => v.patientId === patientId),
  active: () => visits.list((v) => v.status !== 'completed' && v.status !== 'cancelled'),
  async create(input: Omit<Visit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const row: Visit = {
      ...input,
      id: input.id ?? newId('VIS'),
      createdAt: isoNow(),
      updatedAt: isoNow(),
    }
    // Insert-only — a new visit is always a brand-new row, never an
    // overwrite of an existing one. See _core.ts's `insert()` doc comment:
    // `put()`'s upsert would require UPDATE privilege on every column at
    // plan time, which the narrowed nurse column grant
    // (20260704125515_nurse_visits_column_grant.sql) no longer grants.
    const saved = await visits.insert(row)
    audit.emit({
      action: 'reception_registered',
      resource: 'visit',
      resourceId: saved.id,
      detail: `${saved.kind} visit opened for ${saved.patientId}`,
    })
    return saved
  },
  async advance(id: string, to: Visit['status']) {
    const patched = await visits.patch(id, { status: to, updatedAt: isoNow() })
    if (patched) {
      audit.emit({
        action: 'reception_queue_advance',
        resource: 'visit',
        resourceId: id,
        detail: `Queue advance → ${to}`,
      })
    }
    return patched
  },
  async complete(id: string) {
    const patched = await visits.patch(id, {
      status: 'completed', completedAt: isoNow(), updatedAt: isoNow(),
    })
    return patched
  },
  patch: (id: string, partial: Partial<Visit>) =>
    visits.patch(id, { ...partial, updatedAt: isoNow() }),
  _table: visits,
}
