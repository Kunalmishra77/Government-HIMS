/* PharmacyDispenses — the dispensing queue: one row per doctor-signed
 * prescription, covering the queued -> preparing -> ready -> collected
 * lifecycle plus substitution, quantity modification, and procurement.
 * Mirrors `PharmacyPrescription` in src/store/usePharmacyStore.ts and the
 * `pharmacy_dispenses` table in
 * supabase/migrations/20260705050000_pharmacy_schema.sql.
 *
 * IMPORTANT — actor identity (read before wiring a UI bridge to this module):
 * `assignedTo`/`dispensedBy` are jsonb Pharmacist objects ({id, name}), NOT
 * profiles FKs — the local pharmacy roster (RITU, ANIL) plus whatever
 * useAuthStore.currentUser happens to hold isn't necessarily backed by a real
 * Supabase-authenticated user. Every method below that records who performed
 * an action takes that identity as an explicit `actor: Pharmacist` parameter —
 * never folded into a generic partial-update object.
 *
 * This module does NOT and CANNOT verify `actor` is truthful — it is a dumb
 * persistence layer, same as every other src/lib/api/* module. Enforcing
 * "actor must be the real signed-in user" is the CALLER's job: the store
 * bridges (Phase 6 Tasks 4-6) MUST source `actor` from a live
 * `getSupabaseClient().auth.getSession()` + a `profiles` lookup, never from
 * the local Zustand/UI-selected `Pharmacist` the store already carries. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const PharmRxSource = z.enum(['OPD', 'IPD', 'OT', 'ICU', 'Home Rx', 'Discharge'])
export const PharmPaymentMode = z.enum(['Cash', 'UPI', 'Card', 'Insurance', 'Credit'])
export const MedSupply = z.enum(['pharmacy', 'advised_outside', 'order_raised'])
export const PrepStatus = z.enum(['queued', 'preparing', 'ready', 'collected'])
export const ProcurementStatus = z.enum(['immediate', 'deferred_ipd', 'procurement_requested'])
export const ModificationReason = z.enum(['Has at home', 'Partial fill', 'Unable to afford', 'Travelling today', 'Out of stock'])
export const PharmTriageLevel = z.enum(['Low', 'Medium', 'High', 'Critical'])

// A pharmacy-roster actor — a real signed-in pharmacist. See the module-level
// note above: callers must source this from a live session.
export const PharmacistSchema = z.object({ id: z.string(), name: z.string() })
export type Pharmacist = z.infer<typeof PharmacistSchema>

export const PharmacyMedicineSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  quantity: z.number().int().nonnegative(),
  inStock: z.boolean().optional(),
  supply: MedSupply.optional(),
  substitutedFrom: z.string().optional(),
})
export type PharmacyMedicine = z.infer<typeof PharmacyMedicineSchema>

export const QuantityModificationSchema = z.object({
  medicineName: z.string(),
  originalQty: z.number().int().nonnegative(),
  adjustedQty: z.number().int().nonnegative(),
  reason: ModificationReason,
  adjustedAt: z.string(),
  adjustedBy: z.string(),
  requiresSupervisorOverride: z.boolean(),
  supervisorApprovedBy: z.string().optional(),
})
export type QuantityModification = z.infer<typeof QuantityModificationSchema>

export const PharmacyDispenseSchema = z.object({
  id: z.string(),                    // 'PD-...'
  prescriptionId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  tokenNumber: z.number().int().nonnegative().default(0),
  doctorName: z.string(),
  department: z.string(),
  source: PharmRxSource.default('OPD'),
  paymentMode: PharmPaymentMode.default('Cash'),
  medicines: z.array(PharmacyMedicineSchema).default([]),
  status: PrepStatus.default('queued'),
  dispatchedAt: z.string(),
  estimatedReadyIn: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
  triageLevel: PharmTriageLevel.optional(),
  patientModifications: z.array(z.string()).default([]),
  procurementStatus: ProcurementStatus.optional(),
  requestedByWardAt: z.string().optional(),
  wardBed: z.string().optional(),
  quantityModifications: z.array(QuantityModificationSchema).default([]),
  adjustedBillTotal: z.number().optional(),
  originalBillTotal: z.number().optional(),
  assignedTo: PharmacistSchema.optional(),
  dispensedBy: PharmacistSchema.optional(),
  collectedBy: z.string().optional(),
  collectedAt: z.string().optional(),
  updatedAt: z.string(),
})
export type PharmacyDispense = z.infer<typeof PharmacyDispenseSchema>

const pharmacyDispenses = table<PharmacyDispense>('pharmacy_dispenses', PharmacyDispenseSchema)

export const PharmacyDispenses = {
  list: (filter?: (d: PharmacyDispense) => boolean) => pharmacyDispenses.list(filter),
  get: (id: string) => pharmacyDispenses.get(id),
  byPrescription: (prescriptionId: string) => pharmacyDispenses.list((d) => d.prescriptionId === prescriptionId),

  async create(input: Omit<PharmacyDispense, 'id' | 'status' | 'medicines' | 'patientModifications' | 'quantityModifications' | 'updatedAt'> & {
    id?: string
    status?: PharmacyDispense['status']
    medicines?: PharmacyMedicine[]
    patientModifications?: string[]
    quantityModifications?: QuantityModification[]
  }) {
    const row: PharmacyDispense = {
      ...input,
      id: input.id ?? newId('PD'),
      status: input.status ?? 'queued',
      medicines: input.medicines ?? [],
      patientModifications: input.patientModifications ?? [],
      quantityModifications: input.quantityModifications ?? [],
      updatedAt: isoNow(),
    }
    const saved = await pharmacyDispenses.insert(row)
    audit.emit({
      action: 'prescription_create',
      resource: 'pharmacy_dispense',
      resourceId: saved.id,
      detail: `${saved.medicines.length} medicine(s) queued for ${saved.patientId}`,
    })
    return saved
  },

  // actor: the real signed-in pharmacist claiming this queue entry.
  async claim(id: string, actor: Pharmacist) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const status = row.status === 'queued' ? ('preparing' as const) : row.status
    return pharmacyDispenses.patch(id, { assignedTo: actor, status, updatedAt: isoNow() })
  },

  async release(id: string) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const status = row.status === 'preparing' ? ('queued' as const) : row.status
    // NB: `assignedTo: undefined` would NOT clear the column — _core.ts's
    // patch() JSON-serializes the partial before sending it, and
    // JSON.stringify drops undefined-valued keys, so the column would
    // silently keep its previous value. An explicit `null` is required —
    // same precedent as lab-tests.ts's unclaim().
    return pharmacyDispenses.patch(id, {
      assignedTo: null as unknown as PharmacyDispense['assignedTo'], status, updatedAt: isoNow(),
    })
  },

  async updateStatus(id: string, status: PharmacyDispense['status']) {
    return pharmacyDispenses.patch(id, {
      status,
      estimatedReadyIn: status === 'ready' ? 0 : undefined,
      updatedAt: isoNow(),
    })
  },

  // dispensedBy: the real signed-in pharmacist confirming collection,
  // resolved by the caller (usePharmacyStore.markCollected's bridge, Task 6
  // fix) via resolveRealPharmacyActor() — never the UI-supplied local
  // Pharmacist the row's assignedTo/dispensedBy may hold locally. The person
  // confirming collection is not necessarily who prepared it, so this can
  // legitimately differ from row.assignedTo; falling back to row.assignedTo
  // only covers the case where dispensedBy itself is omitted.
  async markCollected(id: string, collectedBy: string | undefined, dispensedBy: Pharmacist | undefined) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    return pharmacyDispenses.patch(id, {
      status: 'collected',
      collectedBy: collectedBy ?? row.collectedBy ?? 'Self (patient)',
      collectedAt: isoNow(),
      dispensedBy: dispensedBy ?? row.assignedTo,
      updatedAt: isoNow(),
    })
  },

  // Read-then-write (upsert-merge), same pattern as RadiologyStudies.attachImage.
  async setMedicineSupply(id: string, medicineName: string, supply: PharmacyMedicine['supply']) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const medicines = row.medicines.map((m) => m.name === medicineName ? { ...m, supply } : m)
    return pharmacyDispenses.patch(id, { medicines, updatedAt: isoNow() })
  },

  async substituteMedicine(id: string, originalName: string, newName: string) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const medicines = row.medicines.map((m) =>
      m.name === originalName
        ? { ...m, name: newName, inStock: true, supply: 'pharmacy' as const, substitutedFrom: m.substitutedFrom ?? originalName }
        : m
    )
    return pharmacyDispenses.patch(id, { medicines, updatedAt: isoNow() })
  },

  async requestProcurement(id: string) {
    return pharmacyDispenses.patch(id, {
      procurementStatus: 'procurement_requested', requestedByWardAt: isoNow(), updatedAt: isoNow(),
    })
  },

  // Read-then-merge (upsert-merge), same pattern as approveSupervisorOverride
  // and setMedicineSupply. `mod` is the single QuantityModification just
  // computed for `mod.medicineName` — its `adjustedBy` MUST already be the
  // real signed-in pharmacist, resolved by the caller (never the local/UI
  // Pharmacist the store's `quantityModifications` array may hold). We only
  // ever touch the entry for `mod.medicineName`: every OTHER medicine's
  // entry is read fresh from Postgres and copied through byte-for-byte, so
  // an earlier real `adjustedBy` can never be clobbered by a stale or
  // client-spoofed in-memory array (this previously full-column-overwrote
  // `quantity_modifications` with the entire client-supplied array, which
  // silently reverted every other already-adjusted medicine's real
  // `adjustedBy` back to whatever spoofable value the client last held for
  // it). `adjustedBillTotal`/`originalBillTotal` are still computed
  // client-side (UNIT_PRICES has no server-side equivalent) and passed
  // through as already-computed values, same as RadiologyStudies.recordDose's
  // pattern.
  async adjustQuantity(id: string, mod: QuantityModification, adjustedBillTotal: number | undefined, originalBillTotal: number | undefined) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const existing = row.quantityModifications.some((m) => m.medicineName === mod.medicineName)
    const quantityModifications = existing
      ? row.quantityModifications.map((m) => m.medicineName === mod.medicineName ? mod : m)
      : [...row.quantityModifications, mod]
    return pharmacyDispenses.patch(id, {
      quantityModifications, adjustedBillTotal, originalBillTotal, updatedAt: isoNow(),
    })
  },

  // actor: the real signed-in supervisor approving the override — resolved by
  // the caller, never a client-supplied id.
  async approveSupervisorOverride(id: string, medicineName: string, supervisorApprovedBy: string) {
    const row = await pharmacyDispenses.get(id)
    if (!row) return undefined
    const quantityModifications = row.quantityModifications.map((m) =>
      m.medicineName === medicineName ? { ...m, supervisorApprovedBy, requiresSupervisorOverride: false } : m
    )
    return pharmacyDispenses.patch(id, { quantityModifications, updatedAt: isoNow() })
  },

  _table: pharmacyDispenses,
}
