// Central radiology study catalog. Drives ordering, modality routing,
// structured report templates, expected TAT and contrast/safety prompts.

export type Modality = 'XR' | 'CT' | 'MRI' | 'US' | 'MAMMO' | 'NM'
export type ReportTemplate = 'general' | 'bi_rads' | 'lung_rads' | 'pi_rads' | 'ti_rads' | 'us_abdo' | 'us_obs'
// Enterprise triage scale. The original three (Routine/Urgent/STAT) are preserved
// for full backward-compatibility; Trauma/Stroke/Critical extend it for the RIS
// command-center workflows. All existing data and code keep working unchanged.
export type Priority = 'Routine' | 'Urgent' | 'STAT' | 'Trauma' | 'Stroke' | 'Critical'

// Display + scheduling metadata for each priority. `rank` sorts worklists
// (higher = more urgent); `sla` multiplies the catalog TAT (lower = tighter).
export const PRIORITY_META: Record<Priority, { label: string; rank: number; sla: number; badge: string; dot: string }> = {
  Routine:  { label: 'Routine',  rank: 0, sla: 1.0,  badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  Urgent:   { label: 'Urgent',   rank: 1, sla: 0.6,  badge: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-500' },
  STAT:     { label: 'STAT',     rank: 2, sla: 0.4,  badge: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-500' },
  Trauma:   { label: 'Trauma',   rank: 3, sla: 0.3,  badge: 'bg-red-100 text-red-800 border-red-300',       dot: 'bg-red-600' },
  Stroke:   { label: 'Stroke',   rank: 4, sla: 0.2,  badge: 'bg-red-600 text-white border-red-700',         dot: 'bg-white' },
  Critical: { label: 'Critical', rank: 5, sla: 0.15, badge: 'bg-red-700 text-white border-red-800',         dot: 'bg-white' },
}

export const PRIORITIES = Object.keys(PRIORITY_META) as Priority[]
export const priorityRank = (p: Priority): number => PRIORITY_META[p]?.rank ?? 0

export type CatalogEntry = {
  code: string
  name: string
  modality: Modality
  bodyPart: string
  defaultPriority: Priority
  expectedTATmin: number
  template: ReportTemplate
  contrast?: boolean        // requires IV contrast → screening required
  radiationDose?: 'low' | 'moderate' | 'high'
  preparation?: string
}

export const RADIOLOGY_CATALOG: Record<string, CatalogEntry> = {
  XR_CHEST: {
    code: 'XR_CHEST', name: 'X-Ray Chest (PA/Lateral)', modality: 'XR', bodyPart: 'Chest',
    defaultPriority: 'Routine', expectedTATmin: 30, template: 'general', radiationDose: 'low',
  },
  XR_ABDO: {
    code: 'XR_ABDO', name: 'X-Ray Abdomen (Erect/Supine)', modality: 'XR', bodyPart: 'Abdomen',
    defaultPriority: 'Routine', expectedTATmin: 30, template: 'general', radiationDose: 'low',
  },
  XR_SPINE: {
    code: 'XR_SPINE', name: 'X-Ray Lumbar Spine (AP/Lat)', modality: 'XR', bodyPart: 'Lumbar Spine',
    defaultPriority: 'Routine', expectedTATmin: 30, template: 'general', radiationDose: 'low',
  },
  XR_EXTREMITY: {
    code: 'XR_EXTREMITY', name: 'X-Ray Extremity', modality: 'XR', bodyPart: 'Extremity',
    defaultPriority: 'Routine', expectedTATmin: 30, template: 'general', radiationDose: 'low',
  },
  CT_HEAD: {
    code: 'CT_HEAD', name: 'CT Head (Non-contrast)', modality: 'CT', bodyPart: 'Head',
    defaultPriority: 'Urgent', expectedTATmin: 45, template: 'general', radiationDose: 'moderate',
  },
  CT_HEAD_C: {
    code: 'CT_HEAD_C', name: 'CT Head with Contrast', modality: 'CT', bodyPart: 'Head',
    defaultPriority: 'Urgent', expectedTATmin: 60, template: 'general',
    contrast: true, radiationDose: 'moderate',
    preparation: 'Check eGFR; review allergies and metformin status.',
  },
  CT_CHEST: {
    code: 'CT_CHEST', name: 'CT Chest', modality: 'CT', bodyPart: 'Chest',
    defaultPriority: 'Routine', expectedTATmin: 60, template: 'lung_rads',
    contrast: true, radiationDose: 'moderate',
    preparation: 'IV access · contrast clearance · breath-hold instructions.',
  },
  CT_ABDOMEN: {
    code: 'CT_ABDOMEN', name: 'CT Abdomen-Pelvis with Contrast', modality: 'CT', bodyPart: 'Abdomen-Pelvis',
    defaultPriority: 'Routine', expectedTATmin: 90, template: 'general',
    contrast: true, radiationDose: 'high',
    preparation: '6h fasting · IV access · contrast clearance.',
  },
  MRI_BRAIN: {
    code: 'MRI_BRAIN', name: 'MRI Brain', modality: 'MRI', bodyPart: 'Brain',
    defaultPriority: 'Routine', expectedTATmin: 120, template: 'general',
    preparation: 'Metal screening · claustrophobia check · 30–45 min sequence.',
  },
  MRI_SPINE: {
    code: 'MRI_SPINE', name: 'MRI Lumbar Spine', modality: 'MRI', bodyPart: 'Lumbar Spine',
    defaultPriority: 'Routine', expectedTATmin: 120, template: 'general',
    preparation: 'Metal screening · ~30 min sequence.',
  },
  MRI_PROSTATE: {
    code: 'MRI_PROSTATE', name: 'MRI Prostate (Multiparametric)', modality: 'MRI', bodyPart: 'Prostate',
    defaultPriority: 'Routine', expectedTATmin: 180, template: 'pi_rads',
    contrast: true, preparation: 'Bowel prep · anti-peristaltic · ~45–60 min.',
  },
  US_ABDO: {
    code: 'US_ABDO', name: 'Ultrasound Abdomen', modality: 'US', bodyPart: 'Abdomen',
    defaultPriority: 'Routine', expectedTATmin: 45, template: 'us_abdo',
    preparation: '6h fasting recommended.',
  },
  US_OBS: {
    code: 'US_OBS', name: 'Ultrasound Obstetric (Anomaly Scan)', modality: 'US', bodyPart: 'Uterus / Fetus',
    defaultPriority: 'Routine', expectedTATmin: 45, template: 'us_obs',
    preparation: 'Full bladder · gestational age sheet.',
  },
  US_THYROID: {
    code: 'US_THYROID', name: 'Ultrasound Thyroid', modality: 'US', bodyPart: 'Thyroid',
    defaultPriority: 'Routine', expectedTATmin: 30, template: 'ti_rads',
  },
  MAMMO_SCREEN: {
    code: 'MAMMO_SCREEN', name: 'Mammography (Bilateral Screening)', modality: 'MAMMO', bodyPart: 'Breasts',
    defaultPriority: 'Routine', expectedTATmin: 60, template: 'bi_rads', radiationDose: 'low',
  },
  US_KUB: {
    code: 'US_KUB', name: 'Ultrasound KUB', modality: 'US', bodyPart: 'Kidneys–Ureter–Bladder',
    defaultPriority: 'Routine', expectedTATmin: 30, template: 'us_abdo',
    preparation: 'Full bladder.',
  },
  ECHO: {
    code: 'ECHO', name: 'Echocardiography (2D + Colour Doppler)', modality: 'US', bodyPart: 'Heart',
    defaultPriority: 'Urgent', expectedTATmin: 40, template: 'general',
    preparation: 'Left lateral decubitus · ECG leads for gating.',
  },
  CT_ANGIO_PULM: {
    code: 'CT_ANGIO_PULM', name: 'CT Pulmonary Angiography', modality: 'CT', bodyPart: 'Chest',
    defaultPriority: 'STAT', expectedTATmin: 60, template: 'general',
    contrast: true, radiationDose: 'high',
    preparation: 'IV access (18G) · eGFR · timing bolus.',
  },
}

export const RADIOLOGY_CODES = Object.keys(RADIOLOGY_CATALOG)

export const getRadiologyCatalog = (code: string): CatalogEntry | undefined => RADIOLOGY_CATALOG[code]

// Default skeleton for the structured report editor, per template.
export type ReportSection = { key: string; label: string; placeholder?: string; required?: boolean }

export const TEMPLATE_SECTIONS: Record<ReportTemplate, ReportSection[]> = {
  general: [
    { key: 'history',    label: 'Clinical history',  placeholder: 'Indication / referring clinical context' },
    { key: 'technique',  label: 'Technique',         placeholder: 'Modality details, contrast, sequences' },
    { key: 'findings',   label: 'Findings',          placeholder: 'Systematic findings', required: true },
    { key: 'impression', label: 'Impression',        placeholder: 'Final summary', required: true },
  ],
  lung_rads: [
    { key: 'history',    label: 'Clinical history' },
    { key: 'technique',  label: 'Technique',         placeholder: 'Low-dose CT chest' },
    { key: 'findings',   label: 'Findings',          placeholder: 'Nodules, infiltrates, mediastinum, pleura' },
    { key: 'lungrads',   label: 'Lung-RADS category', placeholder: '1 / 2 / 3 / 4A / 4B / 4X', required: true },
    { key: 'impression', label: 'Impression', required: true },
  ],
  bi_rads: [
    { key: 'history',    label: 'Clinical history' },
    { key: 'technique',  label: 'Technique',         placeholder: 'CC/MLO views, tomosynthesis' },
    { key: 'findings',   label: 'Findings',          placeholder: 'Density, masses, calcifications, asymmetries' },
    { key: 'birads',     label: 'BI-RADS category',  placeholder: '0 / 1 / 2 / 3 / 4A / 4B / 4C / 5 / 6', required: true },
    { key: 'impression', label: 'Impression', required: true },
  ],
  pi_rads: [
    { key: 'history',    label: 'Clinical history',  placeholder: 'PSA, DRE, prior imaging' },
    { key: 'technique',  label: 'Technique',         placeholder: 'Multiparametric (T2, DWI, DCE)' },
    { key: 'findings',   label: 'Findings',          placeholder: 'Peripheral zone, transition zone, capsule, seminal vesicles' },
    { key: 'pirads',     label: 'PI-RADS v2.1',      placeholder: '1 / 2 / 3 / 4 / 5', required: true },
    { key: 'impression', label: 'Impression', required: true },
  ],
  ti_rads: [
    { key: 'history',    label: 'Clinical history' },
    { key: 'findings',   label: 'Findings',          placeholder: 'Composition, echogenicity, shape, margin, echogenic foci' },
    { key: 'tirads',     label: 'ACR TI-RADS',       placeholder: 'TR1 / TR2 / TR3 / TR4 / TR5', required: true },
    { key: 'impression', label: 'Impression', required: true },
  ],
  us_abdo: [
    { key: 'history',    label: 'Clinical history' },
    { key: 'technique',  label: 'Technique',         placeholder: 'Grayscale ± colour Doppler' },
    { key: 'findings',   label: 'Findings',          placeholder: 'Liver, GB, biliary, pancreas, kidneys, spleen' },
    { key: 'impression', label: 'Impression', required: true },
  ],
  us_obs: [
    { key: 'history',    label: 'Clinical history',  placeholder: 'GA by LMP, prior scans' },
    { key: 'biometry',   label: 'Biometry',          placeholder: 'BPD, HC, AC, FL · EFW' },
    { key: 'anomaly',    label: 'Anatomic survey' },
    { key: 'placenta',   label: 'Placenta / liquor' },
    { key: 'impression', label: 'Impression', required: true },
  ],
}
