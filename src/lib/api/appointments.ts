/* Appointments — patient bookings with a doctor. Mirrors the Appointment shape
 * used by usePatientStore.ts, now backed by Postgres instead of localStorage. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const ApptMode = z.enum(['online', 'in_person'])
export const ApptStatus = z.enum(['upcoming', 'confirmed', 'cancelled'])

export const AppointmentSchema = z.object({
  id: z.string(),                    // 'APT-...'
  patientId: z.string(),
  patientName: z.string().optional(),
  doctorId: z.string().uuid().optional(),
  doctorName: z.string(),
  specialty: z.string(),
  date: z.string(),                  // 'YYYY-MM-DD'
  time: z.string(),
  mode: ApptMode.default('in_person'),
  status: ApptStatus.default('upcoming'),
  createdAt: z.string(),
})
export type Appointment = z.infer<typeof AppointmentSchema>

const appointments = table<Appointment>('appointments', AppointmentSchema)

export const Appointments = {
  list: (filter?: (a: Appointment) => boolean) => appointments.list(filter),
  get: (id: string) => appointments.get(id),
  byPatient: (patientId: string) => appointments.list((a) => a.patientId === patientId),
  byDoctor: (doctorId: string) => appointments.list((a) => a.doctorId === doctorId),
  async create(input: Omit<Appointment, 'id' | 'createdAt' | 'status'> & { id?: string }) {
    const row: Appointment = {
      ...input,
      id: input.id ?? newId('APT'),
      status: 'upcoming',
      createdAt: isoNow(),
    }
    const saved = await appointments.put(row)
    audit.emit({
      action: 'reception_registered',
      resource: 'appointment',
      resourceId: saved.id,
      detail: `Appointment booked for ${saved.patientId} with ${saved.doctorName} on ${saved.date} ${saved.time}`,
    })
    return saved
  },
  async updateStatus(id: string, status: Appointment['status']) {
    return appointments.patch(id, { status })
  },
  _table: appointments,
}
