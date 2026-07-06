// Central laboratory catalog. Drives ordering, specimen routing, bench
// assignment, result entry forms, auto-flagging against reference ranges, and
// TAT clocks. Codes are stable IDs; names are user-facing.
//
// i18n: This is a plain data module (no React hooks), so the English `name`
// and `analyte` strings below stay as the canonical values. Components that
// display them should localize at render time via the `labs` namespace:
//   const t = useTranslations('labs')
//   t(`test.${entry.code}`)            // localized test name
//   t(`analyte.${a.analyte}`)          // localized analyte name
// Both keys are guaranteed to exist for every catalog entry/analyte here.
// See messages/{en,hi}/labs.json.

export type Bench = 'HEMA' | 'BIOCHEM' | 'IMMUNO' | 'URINE' | 'MICRO' | 'HISTO'
export type SpecimenType = 'EDTA' | 'serum' | 'urine_cup' | 'blood_culture' | 'swab' | 'sputum' | 'tissue'
export type Priority = 'STAT' | 'Urgent' | 'Routine'

export type AnalyteSpec = {
  analyte: string
  unit: string
  refLow?: number
  refHigh?: number
  critLow?: number
  critHigh?: number
  isText?: boolean   // qualitative analyte (e.g. urine appearance)
}

export type CatalogEntry = {
  code: string
  name: string
  bench: Bench
  specimen: SpecimenType
  container: string
  defaultPriority: Priority
  expectedTATmin?: number   // non-micro tests
  expectedDays?: number     // micro tests
  analyzer?: string         // for QC mapping
  micro?: boolean
  analytes: AnalyteSpec[]   // empty for micro entries
}

export const LAB_CATALOG: Record<string, CatalogEntry> = {
  CBC: {
    code: 'CBC', name: 'Complete Blood Count', bench: 'HEMA', specimen: 'EDTA',
    container: 'Purple-top EDTA tube', defaultPriority: 'Routine',
    expectedTATmin: 60, analyzer: 'Sysmex XN-550',
    analytes: [
      { analyte: 'Haemoglobin',  unit: 'g/dL',    refLow: 13.0, refHigh: 17.0, critLow: 7.0,  critHigh: 20.0 },
      { analyte: 'WBC count',    unit: '/µL',     refLow: 4000, refHigh: 11000, critLow: 1500, critHigh: 30000 },
      { analyte: 'Platelets',    unit: '×10³/µL', refLow: 150,  refHigh: 410,   critLow: 30,   critHigh: 1000 },
      { analyte: 'RBC count',    unit: 'M/µL',    refLow: 4.5,  refHigh: 5.5 },
      { analyte: 'Haematocrit',  unit: '%',       refLow: 38,   refHigh: 50 },
      { analyte: 'MCV',          unit: 'fL',      refLow: 80,   refHigh: 100 },
      { analyte: 'Neutrophils',  unit: '%',       refLow: 40,   refHigh: 75 },
    ],
  },
  LFT: {
    code: 'LFT', name: 'Liver Function Test', bench: 'BIOCHEM', specimen: 'serum',
    container: 'Yellow-top SST', defaultPriority: 'Routine',
    expectedTATmin: 90, analyzer: 'Roche c311',
    analytes: [
      { analyte: 'Total bilirubin',  unit: 'mg/dL', refLow: 0.2, refHigh: 1.2, critHigh: 12 },
      { analyte: 'Direct bilirubin', unit: 'mg/dL', refLow: 0.0, refHigh: 0.3 },
      { analyte: 'AST (SGOT)',       unit: 'U/L',   refLow: 5,   refHigh: 40,  critHigh: 1000 },
      { analyte: 'ALT (SGPT)',       unit: 'U/L',   refLow: 7,   refHigh: 56,  critHigh: 1000 },
      { analyte: 'ALP',              unit: 'U/L',   refLow: 44,  refHigh: 147 },
      { analyte: 'Albumin',          unit: 'g/dL',  refLow: 3.5, refHigh: 5.0 },
    ],
  },
  RFT: {
    code: 'RFT', name: 'Renal Function Test', bench: 'BIOCHEM', specimen: 'serum',
    container: 'Yellow-top SST', defaultPriority: 'Routine',
    expectedTATmin: 60, analyzer: 'Roche c311',
    analytes: [
      { analyte: 'Urea',       unit: 'mg/dL',  refLow: 7,   refHigh: 20,  critHigh: 200 },
      { analyte: 'Creatinine', unit: 'mg/dL',  refLow: 0.6, refHigh: 1.3, critHigh: 10 },
      { analyte: 'Sodium',     unit: 'mmol/L', refLow: 135, refHigh: 145, critLow: 120, critHigh: 160 },
      { analyte: 'Potassium',  unit: 'mmol/L', refLow: 3.5, refHigh: 5.1, critLow: 2.5, critHigh: 6.5 },
      { analyte: 'Chloride',   unit: 'mmol/L', refLow: 98,  refHigh: 107 },
    ],
  },
  LIPID: {
    code: 'LIPID', name: 'Lipid Profile', bench: 'BIOCHEM', specimen: 'serum',
    container: 'Yellow-top SST', defaultPriority: 'Routine',
    expectedTATmin: 90, analyzer: 'Roche c311',
    analytes: [
      { analyte: 'Total cholesterol', unit: 'mg/dL', refLow: 0,  refHigh: 200 },
      { analyte: 'LDL',               unit: 'mg/dL', refLow: 0,  refHigh: 100 },
      { analyte: 'HDL',               unit: 'mg/dL', refLow: 40, refHigh: 60 },
      { analyte: 'Triglycerides',     unit: 'mg/dL', refLow: 0,  refHigh: 150 },
    ],
  },
  HBA1C: {
    code: 'HBA1C', name: 'HbA1c', bench: 'BIOCHEM', specimen: 'EDTA',
    container: 'Purple-top EDTA tube', defaultPriority: 'Routine',
    expectedTATmin: 120, analyzer: 'Roche c311',
    analytes: [
      { analyte: 'HbA1c', unit: '%', refLow: 4.0, refHigh: 5.6 },
    ],
  },
  TSH: {
    code: 'TSH', name: 'Thyroid Profile (TSH)', bench: 'IMMUNO', specimen: 'serum',
    container: 'Yellow-top SST', defaultPriority: 'Routine',
    expectedTATmin: 180, analyzer: 'Abbott i1000SR',
    analytes: [
      { analyte: 'TSH',     unit: 'µIU/mL', refLow: 0.4, refHigh: 4.0 },
      { analyte: 'Free T4', unit: 'ng/dL',  refLow: 0.8, refHigh: 1.8 },
      { analyte: 'Free T3', unit: 'pg/mL',  refLow: 2.3, refHigh: 4.2 },
    ],
  },
  TROPI: {
    code: 'TROPI', name: 'Troponin I', bench: 'IMMUNO', specimen: 'serum',
    container: 'Yellow-top SST', defaultPriority: 'STAT',
    expectedTATmin: 60, analyzer: 'Abbott i1000SR',
    analytes: [
      { analyte: 'Troponin I', unit: 'ng/mL', refLow: 0, refHigh: 0.04, critHigh: 0.5 },
    ],
  },
  CRP: {
    code: 'CRP', name: 'C-Reactive Protein', bench: 'BIOCHEM', specimen: 'serum',
    container: 'Yellow-top SST', defaultPriority: 'Urgent',
    expectedTATmin: 60, analyzer: 'Roche c311',
    analytes: [
      { analyte: 'CRP', unit: 'mg/L', refLow: 0, refHigh: 5, critHigh: 100 },
    ],
  },
  URINE_R: {
    code: 'URINE_R', name: 'Urine Routine & Microscopy', bench: 'URINE', specimen: 'urine_cup',
    container: 'Sterile urine cup', defaultPriority: 'Routine',
    expectedTATmin: 45, analyzer: 'Sysmex UN-2000',
    analytes: [
      { analyte: 'Appearance',       unit: '',     isText: true },
      { analyte: 'pH',               unit: '',     refLow: 5.0,   refHigh: 8.0 },
      { analyte: 'Specific gravity', unit: '',     refLow: 1.003, refHigh: 1.030 },
      { analyte: 'Protein',          unit: '',     isText: true },
      { analyte: 'Glucose',          unit: '',     isText: true },
      { analyte: 'WBC',              unit: '/HPF', refLow: 0,     refHigh: 5,   critHigh: 100 },
      { analyte: 'RBC',              unit: '/HPF', refLow: 0,     refHigh: 2 },
    ],
  },
  GLUC: {
    code: 'GLUC', name: 'Blood Glucose (FBS)', bench: 'BIOCHEM', specimen: 'serum',
    container: 'Grey-top fluoride tube', defaultPriority: 'Routine',
    expectedTATmin: 30, analyzer: 'Roche c311',
    analytes: [
      { analyte: 'Glucose (Fasting)', unit: 'mg/dL', refLow: 70, refHigh: 100, critLow: 40, critHigh: 400 },
    ],
  },
  CULT_BLOOD: {
    code: 'CULT_BLOOD', name: 'Blood Culture', bench: 'MICRO', specimen: 'blood_culture',
    container: 'BacT/ALERT bottle', defaultPriority: 'Urgent',
    expectedDays: 3, micro: true, analytes: [],
  },
  CULT_URINE: {
    code: 'CULT_URINE', name: 'Urine Culture', bench: 'MICRO', specimen: 'urine_cup',
    container: 'Sterile urine cup', defaultPriority: 'Routine',
    expectedDays: 2, micro: true, analytes: [],
  },
  CULT_WOUND: {
    code: 'CULT_WOUND', name: 'Wound Culture', bench: 'MICRO', specimen: 'swab',
    container: 'Stuart transport swab', defaultPriority: 'Routine',
    expectedDays: 3, micro: true, analytes: [],
  },
}

export const CODES = Object.keys(LAB_CATALOG)

export const getCatalog = (code: string): CatalogEntry | undefined => LAB_CATALOG[code]

export function computeFlag(value: number | string, spec: AnalyteSpec): 'N' | 'H' | 'L' | 'CH' | 'CL' {
  if (typeof value !== 'number' || isNaN(value)) return 'N'
  if (spec.critHigh !== undefined && value >= spec.critHigh) return 'CH'
  if (spec.critLow !== undefined && value <= spec.critLow) return 'CL'
  if (spec.refHigh !== undefined && value > spec.refHigh) return 'H'
  if (spec.refLow !== undefined && value < spec.refLow) return 'L'
  return 'N'
}
