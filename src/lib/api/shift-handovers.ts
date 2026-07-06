/* NurseShiftAssignments (read-only reference data) + ShiftHandovers (the
 * real read/write workflow) — mirrors Assignment/HandoverRecord in
 * src/store/useShiftStore.ts and nurse_shift_assignments/shift_handovers in
 * supabase/migrations/20260706012000_nurse_shift_tables.sql.
 *
 * `fromNurse`/`toNurse`/`receivedBy` are, in the local store, free-text
 * display names — `sign`/`receive` take an explicit `actor: { id, name }`
 * sourced from a live session, since signing/receiving a shift handover is a
 * real clinical accountability act (mirrors IpdVitals' actor parameter). */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const ShiftType = z.enum(['Morning', 'Evening', 'Night'])
export const HandoverStatus = z.enum(['signed', 'received'])

export const NurseShiftAssignmentSchema = z.object({
  id: z.string(),                          // 'NSA-...'
  nurseId: z.string().uuid(),
  nurseName: z.string(),
  ward: z.string(),
  shift: ShiftType,
  responsibilities: z.array(z.string()).default([]),
})
export type NurseShiftAssignment = z.infer<typeof NurseShiftAssignmentSchema>

const nurseShiftAssignments = table<NurseShiftAssignment>('nurse_shift_assignments', NurseShiftAssignmentSchema)

export const NurseShiftAssignments = {
  list: () => nurseShiftAssignments.list(),
  byNurse: (nurseId: string) => nurseShiftAssignments.list((a) => a.nurseId === nurseId),
  _table: nurseShiftAssignments,
}

export const HandoverActorSchema = z.object({ id: z.string(), name: z.string() })
export type HandoverActor = z.infer<typeof HandoverActorSchema>

export const ShiftHandoverSchema = z.object({
  id: z.string(),                          // 'HO-...'
  ward: z.string(),
  date: z.string(),
  fromShift: ShiftType,
  toShift: ShiftType,
  fromNurseId: z.string().uuid(),
  fromNurseName: z.string(),
  toNurseId: z.string().uuid().optional(),
  toNurseName: z.string().optional(),
  sbar: z.string(),
  addendum: z.string().optional(),
  patientCount: z.number().int(),
  signedAt: z.string(),
  receivedAt: z.string().optional(),
  receivedById: z.string().uuid().optional(),
  receivedByName: z.string().optional(),
  status: HandoverStatus.default('signed'),
})
export type ShiftHandover = z.infer<typeof ShiftHandoverSchema>

const shiftHandovers = table<ShiftHandover>('shift_handovers', ShiftHandoverSchema)

export const ShiftHandovers = {
  list: (filter?: (h: ShiftHandover) => boolean) => shiftHandovers.list(filter),
  pendingFor: (ward: string, toShift: ShiftHandover['toShift']) =>
    shiftHandovers.list((h) => h.ward === ward && h.toShift === toShift && h.status === 'signed'),

  async sign(input: Omit<ShiftHandover, 'id' | 'fromNurseId' | 'fromNurseName' | 'signedAt' | 'status'>, actor: HandoverActor) {
    const row: ShiftHandover = {
      ...input,
      id: newId('HO'),
      fromNurseId: actor.id,
      fromNurseName: actor.name,
      signedAt: isoNow(),
      status: 'signed',
    }
    return shiftHandovers.insert(row)
  },

  async receive(id: string, actor: HandoverActor) {
    return shiftHandovers.patch(id, {
      status: 'received', receivedAt: isoNow(), receivedById: actor.id, receivedByName: actor.name,
    })
  },

  _table: shiftHandovers,
}
