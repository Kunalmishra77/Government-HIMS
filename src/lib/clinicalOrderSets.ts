/* Agentix HIMS — Clinical order sets (Track A · reduce journey friction)
 *
 * One-click protocol bundles for the doctor console. Selecting a set stages a
 * diagnosis + labs + imaging + medications (+ optional admission) into the
 * consultation workspace, which the doctor then REVIEWS and sends through the
 * existing safety-gated "Send" actions. This collapses the most repetitive,
 * multi-screen part of an encounter into a single review step — without
 * bypassing any clinical safety check (allergy/interaction rules still run on
 * send, and nothing is dispatched until the doctor confirms).
 *
 * Bundles reference the real catalogs (`labCatalog`, `radiologyCatalog`) so
 * codes/names never drift. Pure + dependency-free → trivially testable.
 *
 * i18n: Plain data module (no React hooks). The English `label`,
 * `presentation`, `diagnosis`, admission `reason`, and med `instructions`
 * below stay as canonical values. Components localize at render time via the
 * `orderSets` namespace, keyed by set `id`:
 *   const t = useTranslations('orderSets')
 *   t(`${def.id}.label`)              // localized card title
 *   t(`${def.id}.presentation`)       // localized one-line hint
 *   t(`${def.id}.diagnosis`)          // localized working diagnosis
 *   t(`${def.id}.admissionReason`)    // when def.admission is present
 *   t(`${def.id}.med.<slug>`)         // per-med instruction (see JSON keys)
 * Drug names, dosages and durations are clinical/proper-noun values and are
 * intentionally NOT translated. See messages/{en,hi}/orderSets.json.
 */

import { LAB_CATALOG } from './labCatalog'
import { RADIOLOGY_CATALOG, type Modality } from './radiologyCatalog'
import type {
  Prescription,
  LabOrder,
  RadiologyOrder,
  AdmissionOrder,
} from '@/store/useConsultationStore'

export type OrderSetCategory =
  | 'Cardiac' | 'Infection' | 'Respiratory' | 'Metabolic' | 'Neuro' | 'Abdominal'

export interface OrderSetDef {
  id: string
  label: string
  category: OrderSetCategory
  /** When to reach for this set — shown as a one-line hint. */
  presentation: string
  /** Working diagnosis pre-filled (doctor can edit). */
  diagnosis: string
  /** Lab catalog codes (see `labCatalog`). */
  labCodes: string[]
  /** Radiology catalog codes (see `radiologyCatalog`). */
  imagingCodes: string[]
  meds: { medicine: string; dosage: string; duration: string; instructions?: string }[]
  /** If present, also stages an admission request. */
  admission?: { admissionType: AdmissionOrder['admissionType']; reason: string }
  /** Urgent sets escalate lab/imaging priority. */
  urgent?: boolean
}

// Radiology modality → the doctor-console scanType union.
const MODALITY_TO_SCAN: Record<Modality, RadiologyOrder['scanType']> = {
  XR: 'X-Ray',
  CT: 'CT Scan',
  MRI: 'MRI',
  US: 'Ultrasound',
  MAMMO: 'X-Ray',
  NM: 'CT Scan',
}

export const ORDER_SETS: OrderSetDef[] = [
  {
    id: 'acs',
    label: 'Chest pain — suspected ACS',
    category: 'Cardiac',
    presentation: 'Acute chest pain, suspected acute coronary syndrome',
    diagnosis: 'Acute coronary syndrome — to evaluate',
    labCodes: ['TROPI', 'CBC', 'RFT', 'LIPID'],
    imagingCodes: ['XR_CHEST'],
    meds: [
      { medicine: 'Aspirin', dosage: '300 mg', duration: 'stat then 75 mg OD', instructions: 'Loading dose, chew' },
      { medicine: 'Atorvastatin', dosage: '80 mg', duration: 'OD', instructions: 'High-intensity statin' },
      { medicine: 'Clopidogrel', dosage: '300 mg', duration: 'stat then 75 mg OD', instructions: 'Loading dose' },
    ],
    admission: { admissionType: 'ICU', reason: 'Suspected ACS — cardiac monitoring' },
    urgent: true,
  },
  {
    id: 'sepsis',
    label: 'Fever — suspected sepsis',
    category: 'Infection',
    presentation: 'Fever with hypotension / suspected sepsis (Sepsis-6)',
    diagnosis: 'Sepsis — source to be identified',
    labCodes: ['CBC', 'CRP', 'RFT', 'LFT', 'GLUC'],
    imagingCodes: ['XR_CHEST'],
    meds: [
      { medicine: 'Ceftriaxone', dosage: '2 g IV', duration: 'OD', instructions: 'After blood cultures' },
      { medicine: 'Paracetamol', dosage: '1 g IV', duration: 'QDS PRN', instructions: 'For fever' },
      { medicine: 'IV Fluids (Ringer Lactate)', dosage: '30 ml/kg', duration: 'bolus', instructions: 'Per Sepsis-6' },
    ],
    admission: { admissionType: 'ICU', reason: 'Sepsis — resuscitation & monitoring' },
    urgent: true,
  },
  {
    id: 'cap',
    label: 'Pneumonia — admit',
    category: 'Respiratory',
    presentation: 'Community-acquired pneumonia requiring admission',
    diagnosis: 'Community-acquired pneumonia',
    labCodes: ['CBC', 'CRP', 'RFT'],
    imagingCodes: ['XR_CHEST'],
    meds: [
      { medicine: 'Co-amoxiclav (Augmentin)', dosage: '1.2 g IV', duration: 'TDS', instructions: '' },
      { medicine: 'Azithromycin', dosage: '500 mg', duration: 'OD x3 days', instructions: 'Atypical cover' },
      { medicine: 'Paracetamol', dosage: '650 mg', duration: 'QDS PRN', instructions: 'For fever' },
    ],
    admission: { admissionType: 'General Ward', reason: 'Pneumonia — IV antibiotics & oxygen' },
    urgent: true,
  },
  {
    id: 'stroke',
    label: 'Suspected acute stroke',
    category: 'Neuro',
    presentation: 'Acute focal neuro deficit — stroke pathway',
    diagnosis: 'Acute cerebrovascular event — to evaluate',
    labCodes: ['CBC', 'GLUC', 'RFT'],
    imagingCodes: ['CT_HEAD'],
    meds: [
      { medicine: 'IV Fluids (Normal Saline)', dosage: 'maintenance', duration: 'continuous', instructions: 'Avoid dextrose' },
    ],
    admission: { admissionType: 'ICU', reason: 'Acute stroke — thrombolysis window assessment' },
    urgent: true,
  },
  {
    id: 'acute_abdomen',
    label: 'Acute abdominal pain',
    category: 'Abdominal',
    presentation: 'Undifferentiated acute abdomen',
    diagnosis: 'Acute abdomen — to evaluate',
    labCodes: ['CBC', 'LFT', 'RFT', 'CRP'],
    imagingCodes: ['US_ABDO'],
    meds: [
      { medicine: 'Paracetamol', dosage: '1 g IV', duration: 'QDS PRN', instructions: 'Analgesia' },
      { medicine: 'Pantoprazole', dosage: '40 mg IV', duration: 'OD', instructions: '' },
    ],
    urgent: true,
  },
  {
    id: 'dm_followup',
    label: 'Type-2 diabetes — follow-up',
    category: 'Metabolic',
    presentation: 'Routine OPD diabetes review',
    diagnosis: 'Type-2 diabetes mellitus — follow-up',
    labCodes: ['HBA1C', 'GLUC', 'LIPID', 'RFT'],
    imagingCodes: [],
    meds: [
      { medicine: 'Metformin', dosage: '500 mg', duration: 'BD', instructions: 'After meals' },
    ],
  },
]

export interface MaterializedOrderSet {
  def: OrderSetDef
  diagnosis: string
  prescriptions: Omit<Prescription, 'id'>[]
  labs: Omit<LabOrder, 'id' | 'orderedAt' | 'sentToLab'>[]
  imaging: Omit<RadiologyOrder, 'id' | 'orderedAt' | 'sentToRadiology'>[]
  admission?: { admissionType: AdmissionOrder['admissionType']; reason: string; bedTypePreference: string }
}

/** Expand an order-set definition into staged consultation entries. */
export function materializeOrderSet(def: OrderSetDef): MaterializedOrderSet {
  const labPriority: LabOrder['priority'] = def.urgent ? 'Urgent' : 'Routine'
  const imgPriority: RadiologyOrder['priority'] = def.urgent ? 'Urgent' : 'Routine'

  const labs = def.labCodes
    .map((code) => LAB_CATALOG[code])
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({ testName: e.name, priority: labPriority }))

  const imaging = def.imagingCodes
    .map((code) => RADIOLOGY_CATALOG[code])
    .filter((e): e is NonNullable<typeof e> => !!e)
    .map((e) => ({ scanType: MODALITY_TO_SCAN[e.modality], bodyPart: e.bodyPart, priority: imgPriority }))

  return {
    def,
    diagnosis: def.diagnosis,
    prescriptions: def.meds.map((m) => ({
      medicine: m.medicine,
      dosage: m.dosage,
      duration: m.duration,
      instructions: m.instructions || undefined,
    })),
    labs,
    imaging,
    admission: def.admission
      ? { ...def.admission, bedTypePreference: def.admission.admissionType }
      : undefined,
  }
}

export function getOrderSet(id: string): OrderSetDef | undefined {
  return ORDER_SETS.find((s) => s.id === id)
}
