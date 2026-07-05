import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useNotificationStore, type NotificationChannel } from './useNotificationStore'
import {
  RADIOLOGY_CATALOG,
  TEMPLATE_SECTIONS,
  type Modality,
  type Priority,
} from '@/lib/radiologyCatalog'
import { deriveUhid } from '@/lib/uhid'

// ─── Domain types ─────────────────────────────────────────────────────────

export type RadSource = 'OPD' | 'IPD' | 'ICU' | 'OT' | 'ER'
export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Insurance' | 'Credit'
export type StudyStatus =
  | 'ordered' | 'scheduled' | 'arrived'
  | 'acquiring' | 'acquired'
  | 'reading' | 'reported'
  | 'verified' | 'released'
  | 'cancelled'

export type RadTech = { id: string; name: string }

export type Attachment = {
  id: string
  filename: string
  url?: string
  caption?: string
  uploadedBy: string
  uploadedAt: string
}

// Structured AI detection (simulated). Each finding carries a confidence tier
// and an optional heatmap region (normalised 0–1 box) for overlay rendering.
export type AiFinding = {
  id: string
  label: string
  category: 'normal' | 'actionable' | 'critical'
  confidence: number            // 0–1
  heatmap?: { x: number; y: number; w: number; h: number }
  birads?: string
  lungrads?: string
  pirads?: string
}

export type DoseRecord = { dlp?: number; ctdi?: number; mas?: number; kv?: number; recordedBy?: string; recordedAt?: string }
export type QualityFlags = { motion?: boolean; incompleteCoverage?: boolean; note?: string; assessedAt?: string }
export type DistributionEntry = { channel: NotificationChannel; to: string; sentAt: string; label?: string }
export type Escalation = { startedAt: string; level: number; acknowledgedAt?: string; acknowledgedBy?: string }
export type VerificationLevel = 'resident' | 'consultant'

export type RadiologyStudy = {
  id: string
  patientId: string
  patientName: string
  uhid: string
  department: string
  source: RadSource
  wardBed?: string
  doctorName: string
  paymentMode: PaymentMode
  clinicalQuestion?: string
  code: string
  name: string
  modality: Modality
  bodyPart: string
  priority: Priority
  contrastConsented?: boolean
  status: StudyStatus
  scheduledFor?: string
  arrivedAt?: string
  acquiringBy?: RadTech
  acquiredAt?: string
  attachments: Attachment[]
  readingBy?: RadTech
  reportSections: Record<string, string>
  aiPrelim?: string
  reportedAt?: string
  verifiedBy?: RadTech
  verifiedAt?: string
  releasedAt?: string
  callback?: { calledBy: string; calledAt: string; recipient: string }
  expectedTATmin: number
  orderedAt: string
  acknowledgedAt?: string
  cancelReason?: string

  // ── Enterprise RIS extensions (all optional, default-safe) ──
  noShowRisk?: number                  // 0–1 predicted no-show probability
  predictedDurationMin?: number        // AI scan-duration estimate
  doseRecord?: DoseRecord              // radiation dose tracking
  aiFindings?: AiFinding[]             // structured AI detections
  qualityFlags?: QualityFlags          // motion / completeness QA
  verificationLevel?: VerificationLevel
  residentReadBy?: RadTech
  escalation?: Escalation              // critical-result escalation ladder
  distribution?: DistributionEntry[]   // result delivery log
  comparisonPriorId?: string           // linked prior study for comparison
}

// Lab/Radiology roster — currentUser for the radiology role is Dr. Sameer Khan (RAD-304)
export const RAD_RAVI: RadTech = { id: 'RT-101', name: 'Ravi Sinha' }        // radiographer XR/CT
export const RAD_BABITA: RadTech = { id: 'RT-102', name: 'Babita Kaur' }     // radiographer MRI/US
export const RAD_DRKHAN: RadTech = { id: 'RAD-304', name: 'Dr. Sameer Khan' } // radiologist (default current user)
export const RAD_DRGUPTA: RadTech = { id: 'RD-202', name: 'Dr. Aisha Gupta' }  // verifier

// ─── Helpers ──────────────────────────────────────────────────────────────

let _studySeq = 0
let _attSeq = 0
const nextStudyId = () => `RS-${Date.now()}-${++_studySeq}`
const nextAttId = () => `ATT-${Date.now()}-${++_attSeq}`

function emptyReportSections(code: string): Record<string, string> {
  const cat = RADIOLOGY_CATALOG[code]
  if (!cat) return {}
  const tmpl = TEMPLATE_SECTIONS[cat.template]
  return Object.fromEntries(tmpl.map(s => [s.key, '']))
}

// ─── State ────────────────────────────────────────────────────────────────

interface State {
  studies: RadiologyStudy[]
  addOrder: (input: {
    patientId: string
    patientName: string
    uhid?: string
    department?: string
    source: RadSource
    wardBed?: string
    doctorName: string
    paymentMode: PaymentMode
    code: string
    clinicalQuestion?: string
    priority?: Priority
  }) => string
  schedule: (id: string, scheduledFor: string) => void
  markArrived: (id: string) => void
  claimAcquisition: (id: string, tech: RadTech) => void
  markAcquired: (id: string) => void
  attachImage: (id: string, file: { filename: string; url?: string; caption?: string; uploadedBy: string }) => void
  claimReading: (id: string, radiologist: RadTech) => void
  setAIPrelim: (id: string) => void
  updateReportSection: (id: string, sectionKey: string, value: string) => void
  submitReport: (id: string, radiologist: RadTech) => void
  verifyAndRelease: (id: string, verifier: RadTech) => void
  cancelStudy: (id: string, reason?: string) => void
  logCallback: (id: string, calledBy: string, recipient: string) => void
  ackResult: (id: string) => void
  setContrastConsented: (id: string, ok: boolean) => void

  // ── Enterprise RIS extensions (additive; never alter existing transitions) ──
  setNoShowRisk: (id: string, risk: number) => void
  setPredictedDuration: (id: string, minutes: number) => void
  recordDose: (id: string, dose: DoseRecord) => void
  setAIFindings: (id: string, findings: AiFinding[]) => void
  flagQuality: (id: string, flags: QualityFlags) => void
  residentSubmit: (id: string, resident: RadTech) => void      // reading → reported, tagged resident-level
  consultantVerify: (id: string, verifier: RadTech) => void    // reported → released, tagged consultant-level
  recordDistribution: (id: string, entry: DistributionEntry) => void
  startEscalation: (id: string) => void
  ackEscalation: (id: string, by: string) => void
  linkPrior: (id: string, priorId: string) => void
}

// ─── Seed ─────────────────────────────────────────────────────────────────

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()
const minsAhead = (m: number) => new Date(Date.now() + m * 60000).toISOString()

function seedStudy(p: {
  id: string
  patientId: string
  patientName: string
  uhid?: string
  department?: string
  source: RadSource
  wardBed?: string
  doctorName: string
  orderedMinAgo: number
  paymentMode: PaymentMode
  code: string
  clinicalQuestion?: string
  priority?: Priority
  status: StudyStatus
  scheduledFor?: string
  arrivedAt?: string
  acquiringBy?: RadTech
  acquiredAt?: string
  readingBy?: RadTech
  attachments?: Omit<Attachment, 'id'>[]
  reportSections?: Record<string, string>
  aiPrelim?: string
  reportedAt?: string
  verifiedBy?: RadTech
  verifiedAt?: string
  releasedAt?: string
  contrastConsented?: boolean
}): RadiologyStudy {
  const cat = RADIOLOGY_CATALOG[p.code]!
  return {
    id: p.id,
    patientId: p.patientId,
    patientName: p.patientName,
    uhid: p.uhid ?? deriveUhid(p.patientId),
    department: p.department ?? 'General Medicine',
    source: p.source,
    wardBed: p.wardBed,
    doctorName: p.doctorName,
    paymentMode: p.paymentMode,
    clinicalQuestion: p.clinicalQuestion,
    code: p.code,
    name: cat.name,
    modality: cat.modality,
    bodyPart: cat.bodyPart,
    priority: p.priority ?? cat.defaultPriority,
    contrastConsented: p.contrastConsented,
    status: p.status,
    scheduledFor: p.scheduledFor,
    arrivedAt: p.arrivedAt,
    acquiringBy: p.acquiringBy,
    acquiredAt: p.acquiredAt,
    attachments: (p.attachments ?? []).map(a => ({ ...a, id: `ATT-seed-${Math.random().toString(36).slice(2, 8)}` })),
    readingBy: p.readingBy,
    reportSections: p.reportSections ?? emptyReportSections(p.code),
    aiPrelim: p.aiPrelim,
    reportedAt: p.reportedAt,
    verifiedBy: p.verifiedBy,
    verifiedAt: p.verifiedAt,
    releasedAt: p.releasedAt,
    expectedTATmin: cat.expectedTATmin,
    orderedAt: minsAgo(p.orderedMinAgo),
  }
}

const SEED_STUDIES: RadiologyStudy[] = [
  // RS-101: Rahul Verma — XR Chest ordered, awaiting scheduling
  seedStudy({
    id: 'RS-101', patientId: 'PT-10232', patientName: 'Rahul Verma', source: 'OPD',
    department: 'Pulmonology',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 12, paymentMode: 'Cash',
    code: 'XR_CHEST', clinicalQuestion: 'Persistent cough, R/O pneumonia',
    status: 'ordered',
  }),

  // RS-102: Meera Pillai — US Abdomen, scheduled
  seedStudy({
    id: 'RS-102', patientId: 'PT-20391', patientName: 'Meera Pillai', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 40, paymentMode: 'UPI',
    code: 'US_ABDO', clinicalQuestion: 'RUQ pain · R/O cholelithiasis',
    status: 'scheduled', scheduledFor: minsAhead(45),
  }),

  // RS-103: Meena Devi — CT Chest, patient arrived, contrast consented
  seedStudy({
    id: 'RS-103', patientId: 'PT-10231', patientName: 'Meena Devi', source: 'IPD', wardBed: 'Ward A — 12',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 60, paymentMode: 'Insurance',
    code: 'CT_CHEST', clinicalQuestion: 'Persistent infiltrate · R/O malignancy',
    status: 'arrived', scheduledFor: minsAgo(15), arrivedAt: minsAgo(5),
    contrastConsented: true,
  }),

  // RS-104: Amit Singh — MRI Lumbar Spine, currently being acquired
  seedStudy({
    id: 'RS-104', patientId: 'PT-10230', patientName: 'Amit Singh', source: 'OPD',
    doctorName: 'Dr. Priya Menon', orderedMinAgo: 90, paymentMode: 'Cash',
    code: 'MRI_SPINE', clinicalQuestion: 'Sciatica, R/O disc herniation',
    status: 'acquiring', scheduledFor: minsAgo(30), arrivedAt: minsAgo(25),
    acquiringBy: RAD_BABITA,
  }),

  // RS-105: Karan Mehta — XR Chest acquired, awaiting reading
  seedStudy({
    id: 'RS-105', patientId: 'PT-10240', patientName: 'Karan Mehta', source: 'ER',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 55, paymentMode: 'Card',
    code: 'XR_CHEST', clinicalQuestion: 'Trauma · R/O pneumothorax',
    status: 'acquired', scheduledFor: minsAgo(45), arrivedAt: minsAgo(40),
    acquiringBy: RAD_RAVI, acquiredAt: minsAgo(10),
    attachments: [{ filename: 'XR-105-PA.jpg', caption: 'Chest PA', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(10) }],
    priority: 'STAT',
  }),

  // RS-106: Priya Sharma — Mammogram acquired, radiologist actively reading
  seedStudy({
    id: 'RS-106', patientId: 'PT-10241', patientName: 'Priya Sharma', source: 'OPD',
    doctorName: 'Dr. Aisha Khurana', orderedMinAgo: 120, paymentMode: 'Insurance',
    code: 'MAMMO_SCREEN', clinicalQuestion: 'Screening, family history',
    status: 'reading', scheduledFor: minsAgo(100), arrivedAt: minsAgo(95),
    acquiringBy: RAD_RAVI, acquiredAt: minsAgo(60),
    readingBy: RAD_DRKHAN,
    attachments: [
      { filename: 'MAMMO-106-RCC.dcm', caption: 'R CC', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(60) },
      { filename: 'MAMMO-106-LCC.dcm', caption: 'L CC', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(60) },
      { filename: 'MAMMO-106-RMLO.dcm', caption: 'R MLO', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(60) },
      { filename: 'MAMMO-106-LMLO.dcm', caption: 'L MLO', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(60) },
    ],
    reportSections: {
      history: 'Asymptomatic screening · strong family history (mother + sister)',
      technique: 'Standard CC and MLO views, both breasts.',
      findings: '',
      birads: '',
      impression: '',
    },
    aiPrelim: 'AI prelim: scattered fibroglandular density. No suspicious mass or pleomorphic calcifications. Consider BI-RADS 1 if confirmed on second read.',
  }),

  // RS-107: Raju Singh — XR Chest report submitted, pending verification
  seedStudy({
    id: 'RS-107', patientId: 'IP-3002', patientName: 'Raju Singh', source: 'IPD', wardBed: 'Ward B — 4',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 90, paymentMode: 'Insurance',
    code: 'XR_CHEST', clinicalQuestion: 'Follow-up post-pneumonia · resolution check',
    status: 'reported', scheduledFor: minsAgo(80), arrivedAt: minsAgo(75),
    acquiringBy: RAD_RAVI, acquiredAt: minsAgo(45),
    readingBy: RAD_DRKHAN, reportedAt: minsAgo(15),
    attachments: [{ filename: 'XR-107-PA.jpg', caption: 'Chest PA', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(45) }],
    reportSections: {
      history: 'Post-pneumonia follow-up · resolution check',
      technique: 'PA + lateral chest radiograph',
      findings: 'Right lower zone consolidation is resolving compared with prior. Cardiomediastinum normal. No pleural effusion. Bony thorax unremarkable.',
      impression: 'Resolving right lower zone consolidation — improving versus prior. No new findings.',
    },
    aiPrelim: 'AI prelim: resolving consolidation, right lower zone — improving vs prior.',
  }),

  // RS-109: Kiran Patil — XR Chest released for the default patient login
  seedStudy({
    id: 'RS-109', patientId: 'PT-20394', patientName: 'Kiran Patil', source: 'ER',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 60, paymentMode: 'Card',
    code: 'XR_CHEST', clinicalQuestion: 'Chest pain · R/O cardiomegaly / effusion',
    status: 'released',
    scheduledFor: minsAgo(55), arrivedAt: minsAgo(50),
    acquiringBy: RAD_RAVI, acquiredAt: minsAgo(35),
    readingBy: RAD_DRKHAN, reportedAt: minsAgo(20),
    verifiedBy: RAD_DRGUPTA, verifiedAt: minsAgo(10), releasedAt: minsAgo(10),
    attachments: [{ filename: 'XR-109-PA.jpg', caption: 'Chest PA', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(35) }],
    reportSections: {
      history: 'Acute chest pain · ER presentation · troponin pending. R/O cardiomegaly or pleural effusion.',
      technique: 'PA + lateral chest radiograph.',
      findings: 'Cardiomediastinum within normal limits. Lung fields clear. No pleural effusion. No pneumothorax. Bony thorax unremarkable.',
      impression: 'No acute cardiopulmonary findings. Cardiac silhouette normal. No effusion.',
    },
  }),

  // ── M13.2 — Fresh today's work covering ordered/scheduled stages ─────
  // RS-110: Rajesh Khanna — CT chest, just ordered (no slot yet)
  seedStudy({
    id: 'RS-110', patientId: 'PT-20401', patientName: 'Rajesh Khanna', source: 'OPD',
    department: 'Nephrology',
    doctorName: 'Dr. Rohan Mehta', orderedMinAgo: 7, paymentMode: 'Insurance',
    code: 'CT_CHEST', clinicalQuestion: 'CKD-III, breathlessness · R/O pulmonary oedema',
    priority: 'Urgent', status: 'ordered',
  }),
  // RS-111: Suresh Pillai — MRI knee, ordered routine
  seedStudy({
    id: 'RS-111', patientId: 'PT-20403', patientName: 'Suresh Pillai', source: 'OPD',
    department: 'Orthopaedics',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 22, paymentMode: 'Cash',
    code: 'MRI_SPINE', clinicalQuestion: 'Right knee pain · R/O meniscal tear',
    status: 'ordered',
  }),
  // RS-112: Mohan Iyengar — STAT US KUB, scheduled in 20m, prep counselled
  seedStudy({
    id: 'RS-112', patientId: 'PT-20407', patientName: 'Mohan Iyengar', source: 'OPD',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 15, paymentMode: 'Cash',
    code: 'US_ABDO', clinicalQuestion: 'Oliguria · R/O obstructive uropathy',
    priority: 'Urgent', status: 'scheduled', scheduledFor: minsAhead(20),
  }),
  // RS-113: Anil Kumar Verma — CT abdomen with contrast, patient arrived, consent given
  seedStudy({
    id: 'RS-113', patientId: 'PT-44012', patientName: 'Anil Kumar Verma', source: 'IPD', wardBed: 'Ward A — 5',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 50, paymentMode: 'Insurance',
    code: 'CT_CHEST', clinicalQuestion: 'IPD review · staging CT',
    status: 'arrived', scheduledFor: minsAgo(10), arrivedAt: minsAgo(2),
    contrastConsented: true,
  }),

  // RS-108: Sunita Devi — CT Head verified & released
  seedStudy({
    id: 'RS-108', patientId: 'PT-20444', patientName: 'Sunita Devi', source: 'ER',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 180, paymentMode: 'Insurance',
    code: 'CT_HEAD', clinicalQuestion: 'GCS drop · R/O intracranial bleed',
    status: 'released',
    scheduledFor: minsAgo(170), arrivedAt: minsAgo(165),
    acquiringBy: RAD_RAVI, acquiredAt: minsAgo(140),
    readingBy: RAD_DRKHAN, reportedAt: minsAgo(60),
    verifiedBy: RAD_DRGUPTA, verifiedAt: minsAgo(30), releasedAt: minsAgo(30),
    attachments: [{ filename: 'CT-108-axial.dcm', caption: 'Axial series', uploadedBy: RAD_RAVI.name, uploadedAt: minsAgo(140) }],
    reportSections: {
      history: 'Glasgow Coma Scale drop overnight. R/O acute intracranial haemorrhage.',
      technique: 'Non-contrast CT head, axial 5mm slices.',
      findings: 'No acute intracranial haemorrhage. No mass effect or midline shift. Grey-white differentiation preserved. Ventricles and cisterns normal in size and configuration. No skull fracture. Mucosal thickening, maxillary sinuses (incidental).',
      impression: 'No acute intracranial pathology. Incidental maxillary sinus mucosal thickening.',
    },
  }),

  // ── In Queue demo — freshly ordered studies across every modality ───────
  // RS-114: Kavya Rao — Obstetric anomaly scan
  seedStudy({
    id: 'RS-114', patientId: 'PT-20431', patientName: 'Kavya Rao', source: 'OPD',
    department: 'Obstetrics & Gynaecology',
    doctorName: 'Dr. Anjali Desai', orderedMinAgo: 9, paymentMode: 'UPI',
    code: 'US_OBS', clinicalQuestion: '20-week anomaly scan · G2P1',
    status: 'ordered',
  }),
  // RS-115: Imran Sheikh — STAT non-contrast head CT for suspected stroke
  seedStudy({
    id: 'RS-115', patientId: 'PT-20433', patientName: 'Imran Sheikh', source: 'ER',
    department: 'Neurology',
    doctorName: 'Dr. Rohan Mehta', orderedMinAgo: 3, paymentMode: 'Credit',
    code: 'CT_HEAD', clinicalQuestion: 'Acute onset left hemiparesis · R/O stroke',
    priority: 'Stroke', status: 'ordered',
  }),
  // RS-116: Lakshmi Nair — screening mammography
  seedStudy({
    id: 'RS-116', patientId: 'PT-20436', patientName: 'Lakshmi Nair', source: 'OPD',
    department: 'Breast Clinic',
    doctorName: 'Dr. Aisha Khurana', orderedMinAgo: 18, paymentMode: 'Insurance',
    code: 'MAMMO_SCREEN', clinicalQuestion: 'Screening · palpable lump upper outer quadrant',
    priority: 'Urgent', status: 'ordered',
  }),
  // RS-117: Rohit Das — echocardiography
  seedStudy({
    id: 'RS-117', patientId: 'PT-20438', patientName: 'Rohit Das', source: 'OPD',
    department: 'Cardiology',
    doctorName: 'Dr. Rohan Mehta', orderedMinAgo: 14, paymentMode: 'Cash',
    code: 'ECHO', clinicalQuestion: 'Exertional dyspnoea · assess LV function',
    priority: 'Urgent', status: 'ordered',
  }),
  // RS-118: Sneha Kulkarni — thyroid ultrasound
  seedStudy({
    id: 'RS-118', patientId: 'PT-20441', patientName: 'Sneha Kulkarni', source: 'OPD',
    department: 'Endocrinology',
    doctorName: 'Dr. Priya Nair', orderedMinAgo: 26, paymentMode: 'UPI',
    code: 'US_THYROID', clinicalQuestion: 'Solitary thyroid nodule · TI-RADS characterisation',
    status: 'ordered',
  }),
  // RS-119: Vijay Anand — STAT CT pulmonary angiography
  seedStudy({
    id: 'RS-119', patientId: 'PT-20443', patientName: 'Vijay Anand', source: 'ER',
    department: 'Emergency',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 5, paymentMode: 'Credit',
    code: 'CT_ANGIO_PULM', clinicalQuestion: 'Pleuritic chest pain, high Wells · R/O PE',
    priority: 'STAT', status: 'ordered',
  }),
  // RS-120: Pooja Reddy — US KUB
  seedStudy({
    id: 'RS-120', patientId: 'PT-20446', patientName: 'Pooja Reddy', source: 'OPD',
    department: 'Urology',
    doctorName: 'Dr. Meena Iyer', orderedMinAgo: 31, paymentMode: 'Cash',
    code: 'US_KUB', clinicalQuestion: 'Right flank pain · R/O renal calculus',
    status: 'ordered',
  }),
  // RS-121: Arjun Nair — extremity radiograph
  seedStudy({
    id: 'RS-121', patientId: 'PT-20448', patientName: 'Arjun Nair', source: 'OPD',
    department: 'Orthopaedics',
    doctorName: 'Dr. Vikram Rathore', orderedMinAgo: 11, paymentMode: 'UPI',
    code: 'XR_EXTREMITY', clinicalQuestion: 'Fall on outstretched hand · R/O distal radius fracture',
    status: 'ordered',
  }),
]

// ─── Store ────────────────────────────────────────────────────────────────

export const useRadiologyStudiesStore = create<State>()(persist((set, get) => ({
  studies: SEED_STUDIES,

  addOrder: (input) => {
    const cat = RADIOLOGY_CATALOG[input.code]
    if (!cat) return ''
    const id = nextStudyId()
    const study: RadiologyStudy = {
      id,
      patientId: input.patientId,
      patientName: input.patientName,
      uhid: input.uhid ?? deriveUhid(input.patientId),
      department: input.department ?? 'General Medicine',
      source: input.source,
      wardBed: input.wardBed,
      doctorName: input.doctorName,
      paymentMode: input.paymentMode,
      clinicalQuestion: input.clinicalQuestion,
      code: input.code,
      name: cat.name,
      modality: cat.modality,
      bodyPart: cat.bodyPart,
      priority: input.priority ?? cat.defaultPriority,
      status: 'ordered',
      attachments: [],
      reportSections: emptyReportSections(input.code),
      expectedTATmin: cat.expectedTATmin,
      orderedAt: new Date().toISOString(),
    }
    set(s => ({ studies: [study, ...s.studies] }))
    return id
  },

  schedule: (id, scheduledFor) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'ordered'
      ? { ...x, status: 'scheduled' as StudyStatus, scheduledFor }
      : x),
  })),

  markArrived: (id) => set(s => ({
    studies: s.studies.map(x => x.id === id && (x.status === 'scheduled' || x.status === 'ordered')
      ? { ...x, status: 'arrived' as StudyStatus, arrivedAt: new Date().toISOString() }
      : x),
  })),

  claimAcquisition: (id, tech) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'arrived'
      ? { ...x, status: 'acquiring' as StudyStatus, acquiringBy: tech }
      : x),
  })),

  markAcquired: (id) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'acquiring'
      ? { ...x, status: 'acquired' as StudyStatus, acquiredAt: new Date().toISOString() }
      : x),
  })),

  attachImage: (id, file) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, attachments: [...x.attachments, { ...file, id: nextAttId(), uploadedAt: new Date().toISOString() }] }
      : x),
  })),

  claimReading: (id, radiologist) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'acquired'
      ? { ...x, status: 'reading' as StudyStatus, readingBy: radiologist }
      : x),
  })),

  setAIPrelim: (id) => set(s => ({
    studies: s.studies.map(x => {
      if (x.id !== id) return x
      // Stub AI: choose a plausible finding by modality + body part
      const ai = AI_PRELIM_BY_CODE[x.code] ?? `AI prelim: no acute findings on initial review of ${x.name}.`
      return { ...x, aiPrelim: ai }
    }),
  })),

  updateReportSection: (id, key, value) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, reportSections: { ...x.reportSections, [key]: value } }
      : x),
  })),

  submitReport: (id, radiologist) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'reading'
      ? { ...x, status: 'reported' as StudyStatus, readingBy: radiologist, reportedAt: new Date().toISOString() }
      : x),
  })),

  verifyAndRelease: (id, verifier) => {
    let released: RadiologyStudy | undefined
    set(s => ({
      studies: s.studies.map(x => {
        if (x.id !== id || x.status !== 'reported') return x
        const updated: RadiologyStudy = {
          ...x,
          status: 'released',
          verifiedBy: verifier,
          verifiedAt: new Date().toISOString(),
          releasedAt: new Date().toISOString(),
        }
        released = updated
        return updated
      }),
    }))
    if (released) {
      const r = released
      const impression = r.reportSections.impression ?? ''
      const critical = isCriticalImpression(impression) ||
        Object.values(r.reportSections).some(v => isCriticalImpression(v))
      useNotificationStore.getState().add({
        type: 'lab_result', // reuse channel; UI styling diverges via patient/doctor surfacing
        priority: critical ? 'high' : 'medium',
        title: critical ? 'Critical radiology finding' : 'Radiology report ready',
        body: `${r.name} for ${r.patientName} — ${impression ? impression.slice(0, 120) : 'report verified'}`,
        targetRole: 'doctor',
        patientName: r.patientName,
        channels: ['in_app'],
      })
    }
  },

  cancelStudy: (id, reason) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, status: 'cancelled' as StudyStatus, cancelReason: reason }
      : x),
  })),

  logCallback: (id, calledBy, recipient) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, callback: { calledBy, recipient, calledAt: new Date().toISOString() } }
      : x),
  })),

  ackResult: (id) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, acknowledgedAt: new Date().toISOString() } : x),
  })),

  setContrastConsented: (id, ok) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, contrastConsented: ok } : x),
  })),

  // ── Enterprise RIS extensions ─────────────────────────────────────────────
  setNoShowRisk: (id, risk) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, noShowRisk: risk } : x),
  })),

  setPredictedDuration: (id, minutes) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, predictedDurationMin: minutes } : x),
  })),

  recordDose: (id, dose) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, doseRecord: { ...dose, recordedAt: new Date().toISOString() } }
      : x),
  })),

  setAIFindings: (id, findings) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, aiFindings: findings } : x),
  })),

  flagQuality: (id, flags) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, qualityFlags: { ...flags, assessedAt: new Date().toISOString() } }
      : x),
  })),

  // Resident first-read submit: same transition as submitReport (reading→reported)
  // but tags the verification level so the consultant queue knows it's a first read.
  residentSubmit: (id, resident) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.status === 'reading'
      ? { ...x, status: 'reported' as StudyStatus, readingBy: x.readingBy ?? resident, residentReadBy: resident, reportedAt: new Date().toISOString(), verificationLevel: 'resident' as VerificationLevel }
      : x),
  })),

  // Consultant sign-off: tags the level, then delegates to the existing
  // verifyAndRelease so the critical-finding notification path is unchanged.
  consultantVerify: (id, verifier) => {
    set(s => ({ studies: s.studies.map(x => x.id === id ? { ...x, verificationLevel: 'consultant' as VerificationLevel } : x) }))
    get().verifyAndRelease(id, verifier)
  },

  recordDistribution: (id, entry) => set(s => ({
    studies: s.studies.map(x => x.id === id
      ? { ...x, distribution: [...(x.distribution ?? []), entry] }
      : x),
  })),

  startEscalation: (id) => set(s => ({
    studies: s.studies.map(x => {
      if (x.id !== id) return x
      const level = (x.escalation?.level ?? 0) + 1
      return { ...x, escalation: { startedAt: x.escalation?.startedAt ?? new Date().toISOString(), level, acknowledgedAt: undefined } }
    }),
  })),

  ackEscalation: (id, by) => set(s => ({
    studies: s.studies.map(x => x.id === id && x.escalation
      ? { ...x, escalation: { ...x.escalation, acknowledgedAt: new Date().toISOString(), acknowledgedBy: by } }
      : x),
  })),

  linkPrior: (id, priorId) => set(s => ({
    studies: s.studies.map(x => x.id === id ? { ...x, comparisonPriorId: priorId } : x),
  })),
}),
  {
    name: 'agentix-radiologystudiesstore', version: 3,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
    migrate: (persisted: unknown, _fromVersion: number) => {
      const s = persisted as Partial<{ studies: RadiologyStudy[] }>
      const studies = Array.isArray(s?.studies) && s.studies.length > 0
        // Backfill uhid/department for studies persisted before v3 introduced them.
        ? s.studies.map(x => ({
            ...x,
            uhid: x.uhid ?? deriveUhid(x.patientId),
            department: x.department ?? 'General Medicine',
          }))
        : SEED_STUDIES
      return { studies }
    },
  },
))

// ─── AI prelim stubs (per code) ───────────────────────────────────────────

const AI_PRELIM_BY_CODE: Record<string, string> = {
  XR_CHEST: 'AI prelim: lung fields clear, cardiomediastinal silhouette unremarkable. Bony thorax intact. No effusion.',
  XR_ABDO: 'AI prelim: non-specific bowel gas pattern. No free air. No obvious obstruction.',
  XR_SPINE: 'AI prelim: vertebral alignment preserved. No acute fracture. Disc spaces grossly maintained.',
  XR_EXTREMITY: 'AI prelim: no displaced fracture or dislocation. Soft tissues unremarkable.',
  CT_HEAD: 'AI prelim: no acute intracranial haemorrhage or mass effect. Ventricles symmetric.',
  CT_HEAD_C: 'AI prelim: no enhancing intracranial lesion. Vessels patent on contrast windows.',
  CT_CHEST: 'AI prelim: small subpleural micronodules — Lung-RADS 2 likely. Recommend annual follow-up.',
  CT_ABDOMEN: 'AI prelim: solid abdominal viscera unremarkable. No free fluid. Appendix not clearly visualised.',
  MRI_BRAIN: 'AI prelim: no acute infarct on DWI. Few non-specific T2/FLAIR hyperintensities in subcortical white matter.',
  MRI_SPINE: 'AI prelim: mild L4-L5 disc bulge with possible right paracentral protrusion. Correlate with symptoms.',
  MRI_PROSTATE: 'AI prelim: focal left peripheral-zone lesion · PI-RADS 4 candidate. Targeted biopsy recommended.',
  US_ABDO: 'AI prelim: hepatic parenchyma normal. Gallbladder normal, no calculus. No hydronephrosis.',
  US_OBS: 'AI prelim: single live fetus consistent with gestational age. Anatomy unremarkable.',
  US_THYROID: 'AI prelim: heterogeneous parenchyma. One TR3 nodule, right lobe — short-interval follow-up.',
  MAMMO_SCREEN: 'AI prelim: scattered fibroglandular density. No discrete suspicious mass. Consider BI-RADS 1.',
}

function isCriticalImpression(text: string): boolean {
  if (!text) return false
  const t = text.toLowerCase()
  return /\b(haemorrhage|hemorrhage|bleed|pneumothorax|tamponade|stroke|infarct|acute occlusion|free air|peritonitis|pe\b|pulmonary embolism|bi-?rads (4|5|6)|lung-?rads (4|4a|4b|4x))\b/.test(t)
}

// ─── Back-compat flat view (legacy RadiologyScan) ─────────────────────────

export type FlatScan = {
  id: string
  patientName: string
  patientId?: string
  scanType: 'X-Ray' | 'MRI' | 'CT Scan' | 'Ultrasound'
  bodyPart?: string
  status: 'Scheduled' | 'In Progress' | 'Ready for Review' | 'Reported'
  time: string
  scheduledAt?: string
  expectedTAT?: number
  orderedBy?: string
  priority?: 'Routine' | 'Urgent'
  aiFinding?: string
  reportReady?: boolean
  reviewedAt?: string
}

const MODALITY_TO_SCANTYPE: Record<Modality, FlatScan['scanType']> = {
  XR: 'X-Ray', MRI: 'MRI', CT: 'CT Scan', US: 'Ultrasound',
  MAMMO: 'X-Ray', NM: 'X-Ray',
}
const STATUS_TO_FLAT: Record<StudyStatus, FlatScan['status']> = {
  ordered: 'Scheduled', scheduled: 'Scheduled',
  arrived: 'In Progress', acquiring: 'In Progress', acquired: 'In Progress',
  reading: 'Ready for Review', reported: 'Ready for Review',
  verified: 'Reported', released: 'Reported',
  cancelled: 'Reported',
}

export function flatScans(studies: RadiologyStudy[]): FlatScan[] {
  return studies
    .filter(s => s.status !== 'cancelled')
    .map(s => ({
      id: s.id,
      patientName: s.patientName,
      patientId: s.patientId,
      scanType: MODALITY_TO_SCANTYPE[s.modality],
      bodyPart: s.bodyPart,
      status: STATUS_TO_FLAT[s.status],
      time: new Date(s.orderedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      scheduledAt: s.scheduledFor ?? s.orderedAt,
      expectedTAT: s.expectedTATmin,
      orderedBy: s.doctorName,
      priority: s.priority === 'Routine' ? 'Routine' : 'Urgent',
      aiFinding: s.aiPrelim ?? s.reportSections.impression,
      reportReady: s.status === 'verified' || s.status === 'released' || s.status === 'reported',
      reviewedAt: s.acknowledgedAt,
    }))
}
