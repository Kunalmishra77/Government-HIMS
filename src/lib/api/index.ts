/* Agentix HIMS — Mock API public surface.
 *
 * Stores import from '@/lib/api' and call typed async methods. The
 * implementation lives in localStorage today; Phase-2 swaps to real REST
 * without changing this surface. See _seed.ts for the demo journey.
 */
export * from './_core'
export { AdmissionRequests, AdmissionRequestSchema } from './admission-requests'
export { Audit, AuditEntrySchema, installAuditBridge, onAudit } from './audit'
export { Beds, BedSchema, BedWard, BedStatus, BedGender } from './beds'
export { Bills, BillSchema, BillLineSchema, PaymentSchema } from './bills'
export { Appointments, AppointmentSchema } from './appointments'
export { DischargeApi, DischargeSchema } from './discharge'
export { Drugs, DrugSchema } from './drugs'
export { Emergency, ErCaseSchema } from './emergency'
export { Encounters, EncounterSchema } from './encounters'
// `./ipd` is NOT dead code — `_seed.ts` calls into it for demo seeding. Its
// underlying table names used to collide with Phase 7's real `beds`/
// `ipd_stays` tables until a fix renamed them to `legacy_*` (see
// `.superpowers/sdd/phase7-fix-legacy-ipd-collision-report.md`). Its
// `BedSchema`/`IpdStaySchema` type names still collide with Phase 7 Task 2's
// real `beds.ts`/`ipd-stays.ts` modules below, so only those colliding names
// are aliased here — the new, real schemas keep their canonical unaliased names.
export { Ipd, BedSchema as LegacyIpdBedSchema, IpdStaySchema as LegacyIpdStaySchema, VitalSchema, MarDoseSchema, WardSchema } from './ipd'
export {
  IpdStays, IpdStaySchema, IpdStage, IpdCondition, IpdDischargePillarKey,
} from './ipd-stays'
export { IpdVitals, IpdVitalSchema, IpdVitalActorSchema } from './ipd-vitals'
export { Lab, LabResultSchema } from './lab'
export { LabReflexSuggestions, LabReflexSuggestionSchema } from './lab-reflex-suggestions'
export { LabSpecimens, LabSpecimenSchema, LabSpecimenType } from './lab-specimens'
export { LabTests, LabTestSchema, LabTechSchema, LabAnalyteResultSchema, LabMicrobioResultSchema, LabRejectReason } from './lab-tests'
export { Orders, OrderSchema, OrderItemSchema } from './orders'
export { Patients, PatientSchema } from './patients'
export { Pharmacy, PharmacyClaimSchema, DispenseEventSchema, NarcoticLogSchema } from './pharmacy'
export {
  PharmacyDispenses, PharmacyDispenseSchema, PharmacistSchema, PharmacyMedicineSchema,
  QuantityModificationSchema, PharmRxSource, PharmPaymentMode, MedSupply, PrepStatus,
  ProcurementStatus, ModificationReason, PharmTriageLevel,
} from './pharmacy-dispenses'
export {
  PharmacyStock, StockItemSchema, PharmacyPurchaseOrders, PurchaseOrderSchema,
  PharmDrugSchedule, POKind, POStatus,
} from './pharmacy-inventory'
export { NarcoticsLog, NarcoticEntrySchema } from './narcotics'
export {
  NurseShiftAssignments, NurseShiftAssignmentSchema,
  ShiftHandovers, ShiftHandoverSchema, HandoverActorSchema,
} from './shift-handovers'
export { NurseTasks, NurseTaskSchema } from './nurse-tasks'
export { Prescriptions, PrescriptionSchema, RxLineSchema, SafetyEnvelopeSchema } from './prescriptions'
export { Radiology, RadStudySchema } from './radiology'
export {
  RadiologyStudies, RadiologyStudySchema, RadTechSchema, RadAttachmentSchema,
  RadAiFindingSchema, RadDoseRecordSchema, RadQualityFlagsSchema,
  RadDistributionEntrySchema, RadEscalationSchema, RadCallbackSchema,
} from './radiology-studies'
export { StaffApi, StaffSchema } from './staff'
export { VitalsReadings, VitalsReadingSchema } from './vitals-readings'
export { Visits, VisitSchema, VisitKind, VisitStatus } from './visits'

// Bootstrap helpers
export { ensureSeeded, reseed, runDemoSeed } from './_seed'
