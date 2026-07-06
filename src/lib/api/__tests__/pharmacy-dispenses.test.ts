import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { Prescriptions } from '@/lib/api/prescriptions'
import { PharmacyDispenses } from '@/lib/api/pharmacy-dispenses'
import type { Pharmacist } from '@/lib/api/pharmacy-dispenses'
import { getSupabaseClient } from '@/lib/supabase/client'

// PharmacyDispenses.* routes through table('pharmacy_dispenses', ...) — same
// fixture pattern as lab-tests.test.ts / radiology-studies.test.ts: reception
// creates patient+visit, doctor drafts+signs the real prescription
// (pharmacy_dispenses.prescription_id FKs to prescriptions), then pharmacy
// (role 'pharmacy') performs the actual workflow operations under test.
const testPatientId = 'PT-PHARMTEST-1'
const testVisitId = 'VIS-PHARMTEST-1'
const testDispenseId = 'PD-PHARMTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const receptionEmail = 'pharm-dispenses-test-reception@example.com'
const doctorEmail = 'pharm-dispenses-test-doctor@example.com'
const pharmacyEmail = 'pharm-dispenses-test-pharmacy@example.com'
const testPassword = 'Test-Pass-123!'
let receptionUserId: string
let doctorUserId: string
let pharmacyUserId: string
let testPrescriptionId: string

const RITU: Pharmacist = { id: 'PH-301', name: 'Ritu Sharma' }

beforeAll(async () => {
  const { data: receptionData, error: receptionError } = await admin.auth.admin.createUser({
    email: receptionEmail, password: testPassword, email_confirm: true,
  })
  if (receptionError || !receptionData.user) throw new Error(`createUser failed: ${receptionError?.message}`)
  receptionUserId = receptionData.user.id
  const { error: receptionProfileError } = await admin.from('profiles').insert({
    id: receptionUserId, role: 'reception', full_name: 'Pharm Dispenses Test Reception',
  })
  if (receptionProfileError) throw new Error(`profile insert failed: ${receptionProfileError.message}`)

  const { data: doctorData, error: doctorError } = await admin.auth.admin.createUser({
    email: doctorEmail, password: testPassword, email_confirm: true,
  })
  if (doctorError || !doctorData.user) throw new Error(`createUser failed: ${doctorError?.message}`)
  doctorUserId = doctorData.user.id
  const { error: doctorProfileError } = await admin.from('profiles').insert({
    id: doctorUserId, role: 'doctor', full_name: 'Pharm Dispenses Test Doctor',
  })
  if (doctorProfileError) throw new Error(`profile insert failed: ${doctorProfileError.message}`)

  const { data: pharmacyData, error: pharmacyError } = await admin.auth.admin.createUser({
    email: pharmacyEmail, password: testPassword, email_confirm: true,
  })
  if (pharmacyError || !pharmacyData.user) throw new Error(`createUser failed: ${pharmacyError?.message}`)
  pharmacyUserId = pharmacyData.user.id
  const { error: pharmacyProfileError } = await admin.from('profiles').insert({
    id: pharmacyUserId, role: 'pharmacy', full_name: 'Pharm Dispenses Test Pharmacy',
  })
  if (pharmacyProfileError) throw new Error(`profile insert failed: ${pharmacyProfileError.message}`)

  const { error: receptionSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: receptionEmail, password: testPassword,
  })
  if (receptionSignInError) throw new Error(`signIn failed: ${receptionSignInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-PHARMTEST-1', fullName: 'Pharm Dispenses Test', phone: '9222222222', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' } as Parameters<typeof Visits.create>[0])

  const { error: doctorSignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: doctorEmail, password: testPassword,
  })
  if (doctorSignInError) throw new Error(`signIn failed: ${doctorSignInError.message}`)

  const rx = await Prescriptions.draft({
    visitId: testVisitId, patientId: testPatientId, doctorId: doctorUserId, doctorName: 'Pharm Dispenses Test Doctor',
    lines: [{ id: 'RL-1', drugName: 'Paracetamol 500mg', dose: '500mg', days: 5, quantity: 15, status: 'draft' }],
  })
  await Prescriptions.sign(rx.id, { allergyChecked: true, interactionChecked: true, doseChecked: true, narcoticChecked: false, flags: [] })
  testPrescriptionId = rx.id

  const { error: pharmacySignInError } = await getSupabaseClient().auth.signInWithPassword({
    email: pharmacyEmail, password: testPassword,
  })
  if (pharmacySignInError) throw new Error(`signIn failed: ${pharmacySignInError.message}`)
})

afterAll(async () => {
  await admin.from('pharmacy_dispenses').delete().eq('prescription_id', testPrescriptionId)
  await admin.from('prescriptions').delete().eq('id', testPrescriptionId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', pharmacyUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(pharmacyUserId)
})

afterEach(async () => {
  await admin.from('pharmacy_dispenses').delete().eq('id', testDispenseId)
})

function baseInput(overrides: Partial<Parameters<typeof PharmacyDispenses.create>[0]> = {}) {
  return {
    id: testDispenseId, prescriptionId: testPrescriptionId, patientId: testPatientId, patientName: 'Pharm Dispenses Test',
    tokenNumber: 7, doctorName: 'Dr. Pharm Dispenses Test Doctor', department: 'General Medicine',
    source: 'OPD' as const, paymentMode: 'Cash' as const,
    medicines: [{ name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 }],
    dispatchedAt: new Date().toISOString(), estimatedReadyIn: 3,
    ...overrides,
  }
}

describe('PharmacyDispenses repository', () => {
  it('creates a dispense for a signed prescription', async () => {
    const saved = await PharmacyDispenses.create(baseInput())
    expect(saved.status).toBe('queued')
    expect(saved.medicines).toHaveLength(1)
  })

  it('byPrescription() returns the dispense', async () => {
    await PharmacyDispenses.create(baseInput())
    const rows = await PharmacyDispenses.byPrescription(testPrescriptionId)
    expect(rows.some((d) => d.id === testDispenseId)).toBe(true)
  })

  it('claim() assigns the actor and moves queued -> preparing', async () => {
    await PharmacyDispenses.create(baseInput())
    const claimed = await PharmacyDispenses.claim(testDispenseId, RITU)
    expect(claimed?.status).toBe('preparing')
    expect(claimed?.assignedTo?.id).toBe('PH-301')
  })

  it('release() clears the actor and moves preparing -> queued', async () => {
    await PharmacyDispenses.create(baseInput())
    await PharmacyDispenses.claim(testDispenseId, RITU)
    const released = await PharmacyDispenses.release(testDispenseId)
    expect(released?.status).toBe('queued')
    expect(released?.assignedTo).toBeUndefined()
  })

  it('updateStatus() moves to ready and zeroes estimatedReadyIn', async () => {
    await PharmacyDispenses.create(baseInput())
    const ready = await PharmacyDispenses.updateStatus(testDispenseId, 'ready')
    expect(ready?.status).toBe('ready')
    expect(ready?.estimatedReadyIn).toBe(0)
  })

  it('markCollected() stamps collectedBy/collectedAt/dispensedBy and moves to collected', async () => {
    await PharmacyDispenses.create(baseInput())
    await PharmacyDispenses.claim(testDispenseId, RITU)
    const collected = await PharmacyDispenses.markCollected(testDispenseId, 'Self (patient)', undefined)
    expect(collected?.status).toBe('collected')
    expect(collected?.collectedBy).toBe('Self (patient)')
    expect(collected?.dispensedBy?.id).toBe('PH-301')
  })

  it('setMedicineSupply() updates the matching medicine line', async () => {
    await PharmacyDispenses.create(baseInput())
    const updated = await PharmacyDispenses.setMedicineSupply(testDispenseId, 'Paracetamol 500mg', 'advised_outside')
    expect(updated?.medicines[0]?.supply).toBe('advised_outside')
  })

  it('substituteMedicine() swaps the name and records substitutedFrom', async () => {
    await PharmacyDispenses.create(baseInput())
    const substituted = await PharmacyDispenses.substituteMedicine(testDispenseId, 'Paracetamol 500mg', 'Ibuprofen 400mg')
    expect(substituted?.medicines[0]?.name).toBe('Ibuprofen 400mg')
    expect(substituted?.medicines[0]?.substitutedFrom).toBe('Paracetamol 500mg')
  })

  it('requestProcurement() sets procurementStatus and requestedByWardAt', async () => {
    await PharmacyDispenses.create(baseInput())
    const requested = await PharmacyDispenses.requestProcurement(testDispenseId)
    expect(requested?.procurementStatus).toBe('procurement_requested')
    expect(requested?.requestedByWardAt).toBeTruthy()
  })

  it('adjustQuantity() sets quantityModifications and bill totals', async () => {
    await PharmacyDispenses.create(baseInput())
    const adjusted = await PharmacyDispenses.adjustQuantity(testDispenseId, {
      medicineName: 'Paracetamol 500mg', originalQty: 15, adjustedQty: 10, reason: 'Partial fill',
      adjustedAt: new Date().toISOString(), adjustedBy: 'Ritu Sharma', requiresSupervisorOverride: false,
    }, 80, 120)
    expect(adjusted?.quantityModifications).toHaveLength(1)
    expect(adjusted?.adjustedBillTotal).toBe(80)
  })

  it('adjustQuantity() read-then-merges: patching one medicine leaves another medicine\'s already-saved entry untouched', async () => {
    await PharmacyDispenses.create(baseInput({
      medicines: [
        { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: 15 },
        { name: 'Amoxicillin 250mg', dosage: '250mg', frequency: 'BD', duration: '5 days', quantity: 10 },
      ],
    }))
    await PharmacyDispenses.adjustQuantity(testDispenseId, {
      medicineName: 'Paracetamol 500mg', originalQty: 15, adjustedQty: 10, reason: 'Partial fill',
      adjustedAt: new Date().toISOString(), adjustedBy: 'Ritu Sharma', requiresSupervisorOverride: false,
    }, 80, 120)
    const second = await PharmacyDispenses.adjustQuantity(testDispenseId, {
      medicineName: 'Amoxicillin 250mg', originalQty: 10, adjustedQty: 5, reason: 'Has at home',
      adjustedAt: new Date().toISOString(), adjustedBy: 'Anil Kumar', requiresSupervisorOverride: false,
    }, 170, 300)
    expect(second?.quantityModifications).toHaveLength(2)
    const paracetamolEntry = second?.quantityModifications.find((m) => m.medicineName === 'Paracetamol 500mg')
    const amoxicillinEntry = second?.quantityModifications.find((m) => m.medicineName === 'Amoxicillin 250mg')
    expect(paracetamolEntry?.adjustedBy).toBe('Ritu Sharma')
    expect(amoxicillinEntry?.adjustedBy).toBe('Anil Kumar')
  })

  it('approveSupervisorOverride() clears requiresSupervisorOverride', async () => {
    await PharmacyDispenses.create(baseInput())
    await PharmacyDispenses.adjustQuantity(testDispenseId, {
      medicineName: 'Paracetamol 500mg', originalQty: 15, adjustedQty: 2, reason: 'Unable to afford',
      adjustedAt: new Date().toISOString(), adjustedBy: 'Ritu Sharma', requiresSupervisorOverride: true,
    }, 16, 120)
    const approved = await PharmacyDispenses.approveSupervisorOverride(testDispenseId, 'Paracetamol 500mg', 'Dr. Supervisor')
    expect(approved?.quantityModifications[0]?.requiresSupervisorOverride).toBe(false)
    expect(approved?.quantityModifications[0]?.supervisorApprovedBy).toBe('Dr. Supervisor')
  })
})
