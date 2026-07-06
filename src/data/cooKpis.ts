import type { LucideIcon } from 'lucide-react'
import {
  IndianRupee, Users, BedDouble, HeartPulse,
  Scissors, Stethoscope, FlaskConical, Pill, ShieldCheck, UserCog,
  GraduationCap, Cpu, ClipboardCheck, Sparkles,
} from 'lucide-react'

// Illustrative executive figures for the COO cockpit. Values are demo data for
// the UP HIMS showcase, structured so a live feed can replace them 1:1 later.

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info'

export interface Kpi {
  label: string
  value: string
  sub?: string
  trend?: { value: string; up: boolean }
  tone?: KpiTone
}

export interface KpiGroup {
  id: string
  title: string
  icon: LucideIcon
  kpis: Kpi[]
}

// The 20 cards the chairman keeps pinned. Larger, hero treatment.
export const CHAIRMAN_SCORECARDS: Kpi[] = [
  { label: 'Hospital Health Score', value: '88', sub: 'of 100', trend: { value: '+3', up: true }, tone: 'ok' },
  { label: 'Financial Health', value: 'A−', sub: 'stable outlook', tone: 'ok' },
  { label: 'Revenue Today', value: '₹12.4 L', trend: { value: '+8%', up: true }, tone: 'ok' },
  { label: 'Revenue MTD', value: '₹2.85 Cr', trend: { value: '+11%', up: true }, tone: 'ok' },
  { label: 'EBITDA', value: '21.8%', trend: { value: '+1.2pp', up: true }, tone: 'ok' },
  { label: 'Cash Collection', value: '₹1.92 Cr', sub: '67% of billing', tone: 'info' },
  { label: 'Bed Occupancy', value: '86.3%', trend: { value: '+2.1pp', up: true }, tone: 'ok' },
  { label: 'OPD Patients', value: '2,486', trend: { value: '+6%', up: true }, tone: 'info' },
  { label: 'IPD Admissions', value: '214', trend: { value: '+4%', up: true }, tone: 'info' },
  { label: 'Surgeries', value: '67', sub: 'this week', tone: 'info' },
  { label: 'ICU Occupancy', value: '91%', sub: '20 of 22 beds', tone: 'warn' },
  { label: 'ALOS', value: '4.8', sub: 'days', trend: { value: '−0.3', up: true }, tone: 'ok' },
  { label: 'Mortality Rate', value: '0.82%', trend: { value: '−0.05pp', up: true }, tone: 'ok' },
  { label: 'Patient Satisfaction', value: '94%', trend: { value: '+2pp', up: true }, tone: 'ok' },
  { label: 'Claim Approval', value: '93%', trend: { value: '+1pp', up: true }, tone: 'ok' },
  { label: 'Outstanding Claims', value: '₹8.4 Cr', sub: 'AR pending', tone: 'warn' },
  { label: 'NABH Compliance', value: '96%', sub: 'accredited', tone: 'ok' },
  { label: 'NMC Compliance', value: 'Compliant', sub: 'no open flags', tone: 'ok' },
  { label: 'Medical College Score', value: '82', sub: 'of 100', tone: 'info' },
  { label: 'Critical Alerts', value: '4', sub: 'need action', tone: 'danger' },
]

// Priority-1 executive strip.
export const EXECUTIVE_KPIS: Kpi[] = [
  { label: 'Total Revenue', value: '₹2.85 Cr', trend: { value: '+11%', up: true }, tone: 'ok' },
  { label: 'Net Profit', value: '₹58 L', trend: { value: '+9%', up: true }, tone: 'ok' },
  { label: 'EBITDA', value: '21.8%', trend: { value: '+1.2pp', up: true }, tone: 'ok' },
  { label: 'OPD Patients', value: '2,486', trend: { value: '+6%', up: true }, tone: 'info' },
  { label: 'IPD Admissions', value: '214', trend: { value: '+4%', up: true }, tone: 'info' },
  { label: 'Current Census', value: '1,726', sub: 'in-house now', tone: 'info' },
  { label: 'Bed Occupancy', value: '86.3%', trend: { value: '+2.1pp', up: true }, tone: 'ok' },
  { label: 'Discharges', value: '192', sub: 'today', tone: 'info' },
  { label: 'Emergency Visits', value: '384', trend: { value: '+12%', up: false }, tone: 'warn' },
  { label: 'Surgeries', value: '67', sub: 'this week', tone: 'info' },
  { label: 'OT Utilization', value: '82%', trend: { value: '+3pp', up: true }, tone: 'ok' },
  { label: 'ICU Occupancy', value: '91%', tone: 'warn' },
  { label: 'ALOS', value: '4.8 Days', trend: { value: '−0.3', up: true }, tone: 'ok' },
  { label: 'Mortality Rate', value: '0.82%', trend: { value: '−0.05pp', up: true }, tone: 'ok' },
  { label: 'Readmissions', value: '2.1%', trend: { value: '−0.2pp', up: true }, tone: 'ok' },
  { label: 'Patient Satisfaction', value: '94%', trend: { value: '+2pp', up: true }, tone: 'ok' },
  { label: 'Complaints', value: '18', sub: 'open', tone: 'warn' },
  { label: 'Claim Approval', value: '93%', trend: { value: '+1pp', up: true }, tone: 'ok' },
  { label: 'Outstanding Claims', value: '₹8.4 Cr', tone: 'warn' },
  { label: 'Cash Collection', value: '₹1.92 Cr', trend: { value: '+7%', up: true }, tone: 'ok' },
]

export const KPI_GROUPS: KpiGroup[] = [
  {
    id: 'financial', title: 'Financial', icon: IndianRupee,
    kpis: [
      { label: 'Gross Revenue', value: '₹3.12 Cr', trend: { value: '+10%', up: true }, tone: 'ok' },
      { label: 'Net Revenue', value: '₹2.85 Cr', trend: { value: '+11%', up: true }, tone: 'ok' },
      { label: 'EBITDA', value: '21.8%', tone: 'ok' },
      { label: 'Gross Margin', value: '38.4%', tone: 'ok' },
      { label: 'Net Margin', value: '20.3%', tone: 'ok' },
      { label: 'Cash Collection', value: '₹1.92 Cr', tone: 'info' },
      { label: 'Daily Billing', value: '₹12.4 L', tone: 'info' },
      { label: 'Monthly Billing', value: '₹3.12 Cr', tone: 'info' },
      { label: 'Pharmacy Revenue', value: '₹64 L', trend: { value: '+5%', up: true }, tone: 'ok' },
      { label: 'Lab Revenue', value: '₹41 L', trend: { value: '+7%', up: true }, tone: 'ok' },
      { label: 'Radiology Revenue', value: '₹33 L', tone: 'info' },
      { label: 'OT Revenue', value: '₹52 L', tone: 'info' },
      { label: 'ICU Revenue', value: '₹47 L', tone: 'info' },
      { label: 'OPD Revenue', value: '₹58 L', tone: 'info' },
      { label: 'IPD Revenue', value: '₹1.34 Cr', tone: 'info' },
      { label: 'Insurance Revenue', value: '₹1.72 Cr', tone: 'info' },
      { label: 'Corporate Revenue', value: '₹38 L', tone: 'info' },
      { label: 'AR Days', value: '46', sub: 'days', trend: { value: '−4', up: true }, tone: 'ok' },
      { label: 'Outstanding Dues', value: '₹8.4 Cr', tone: 'warn' },
      { label: 'Collection Rate', value: '67%', trend: { value: '+3pp', up: true }, tone: 'warn' },
    ],
  },
  {
    id: 'patient', title: 'Patient', icon: Users,
    kpis: [
      { label: 'OPD Patients', value: '2,486', trend: { value: '+6%', up: true }, tone: 'info' },
      { label: 'New Patients', value: '742', trend: { value: '+9%', up: true }, tone: 'ok' },
      { label: 'Repeat Patients', value: '1,744', tone: 'info' },
      { label: 'IPD Admissions', value: '214', tone: 'info' },
      { label: 'Discharges', value: '192', tone: 'info' },
      { label: 'Transfers', value: '11', tone: 'neutral' },
      { label: 'Emergency Visits', value: '384', trend: { value: '+12%', up: false }, tone: 'warn' },
      { label: 'Follow-ups', value: '618', tone: 'info' },
      { label: 'Waiting Time', value: '18 min', trend: { value: '−4', up: true }, tone: 'ok' },
      { label: 'No Show Rate', value: '6.2%', trend: { value: '−0.8pp', up: true }, tone: 'ok' },
      { label: 'Referral Patients', value: '128', tone: 'info' },
      { label: 'International Patients', value: '3', tone: 'neutral' },
    ],
  },
  {
    id: 'beds', title: 'Bed & Capacity', icon: BedDouble,
    kpis: [
      { label: 'Total Beds', value: '2,000', tone: 'neutral' },
      { label: 'Occupied Beds', value: '1,726', tone: 'info' },
      { label: 'Available Beds', value: '274', tone: 'ok' },
      { label: 'Bed Occupancy', value: '86.3%', tone: 'ok' },
      { label: 'ICU Occupancy', value: '91%', tone: 'warn' },
      { label: 'NICU Occupancy', value: '78%', tone: 'ok' },
      { label: 'HDU Occupancy', value: '84%', tone: 'ok' },
      { label: 'Emergency Beds', value: '22 / 30', tone: 'info' },
      { label: 'Isolation Beds', value: '9 / 16', tone: 'ok' },
      { label: 'Bed Turnover', value: '3.1', sub: 'per bed / mo', tone: 'info' },
      { label: 'ALOS', value: '4.8 Days', trend: { value: '−0.3', up: true }, tone: 'ok' },
      { label: 'Bed Turnaround', value: '2.4 hr', trend: { value: '−0.5', up: true }, tone: 'ok' },
    ],
  },
  {
    id: 'clinical', title: 'Clinical', icon: HeartPulse,
    kpis: [
      { label: 'Mortality Rate', value: '0.82%', tone: 'ok' },
      { label: 'Readmissions', value: '2.1%', tone: 'ok' },
      { label: 'Infection Rate', value: '1.4%', trend: { value: '+0.2pp', up: false }, tone: 'warn' },
      { label: 'SSI Rate', value: '0.9%', tone: 'ok' },
      { label: 'Patient Falls', value: '5', sub: 'this month', tone: 'warn' },
      { label: 'Medication Errors', value: '3', tone: 'warn' },
      { label: 'Pressure Injuries', value: '2', tone: 'warn' },
      { label: 'Code Blue', value: '7', sub: 'this month', tone: 'info' },
      { label: 'Sepsis Compliance', value: '92%', tone: 'ok' },
      { label: 'Antibiotic Compliance', value: '88%', tone: 'ok' },
      { label: 'Blood Usage', value: '214 units', tone: 'info' },
    ],
  },
  {
    id: 'surgery', title: 'Surgery', icon: Scissors,
    kpis: [
      { label: 'Total Surgeries', value: '67', tone: 'info' },
      { label: 'Major Cases', value: '41', tone: 'info' },
      { label: 'Minor Cases', value: '26', tone: 'info' },
      { label: 'Emergency OT', value: '9', tone: 'warn' },
      { label: 'OT Utilization', value: '82%', trend: { value: '+3pp', up: true }, tone: 'ok' },
      { label: 'Cancelled Cases', value: '4', trend: { value: '−2', up: true }, tone: 'ok' },
      { label: 'Delayed Cases', value: '6', tone: 'warn' },
      { label: 'OT Turnaround', value: '38 min', trend: { value: '−6', up: true }, tone: 'ok' },
    ],
  },
  {
    id: 'doctor', title: 'Doctor', icon: Stethoscope,
    kpis: [
      { label: 'Active Doctors', value: '142', tone: 'info' },
      { label: 'OPD / Doctor', value: '17.5', tone: 'info' },
      { label: 'Revenue / Doctor', value: '₹2.0 L', tone: 'ok' },
      { label: 'Surgery Count', value: '67', tone: 'info' },
      { label: 'Patient Rating', value: '4.6 / 5', tone: 'ok' },
      { label: 'Avg Consultation', value: '11 min', tone: 'ok' },
      { label: 'Referrals', value: '128', tone: 'info' },
      { label: 'Research Papers', value: '9', sub: 'this quarter', tone: 'info' },
    ],
  },
  {
    id: 'diagnostic', title: 'Diagnostic', icon: FlaskConical,
    kpis: [
      { label: 'Lab Tests', value: '4,318', tone: 'info' },
      { label: 'Pending Reports', value: '86', tone: 'warn' },
      { label: 'Lab TAT', value: '3.4 hr', trend: { value: '−0.6', up: true }, tone: 'ok' },
      { label: 'Critical Alerts', value: '12', tone: 'danger' },
      { label: 'Sample Rejections', value: '1.8%', tone: 'warn' },
      { label: 'CT Scans', value: '214', tone: 'info' },
      { label: 'MRI Scans', value: '96', tone: 'info' },
      { label: 'X-Rays', value: '638', tone: 'info' },
      { label: 'Ultrasounds', value: '412', tone: 'info' },
      { label: 'Report TAT', value: '5.2 hr', tone: 'ok' },
      { label: 'Machine Utilization', value: '79%', tone: 'ok' },
    ],
  },
  {
    id: 'pharmacy', title: 'Pharmacy', icon: Pill,
    kpis: [
      { label: 'Pharmacy Sales', value: '₹64 L', trend: { value: '+5%', up: true }, tone: 'ok' },
      { label: 'Stock Value', value: '₹2.1 Cr', tone: 'info' },
      { label: 'Near Expiry', value: '₹3.4 L', tone: 'warn' },
      { label: 'Expired Stock', value: '₹42 K', tone: 'danger' },
      { label: 'Stock Outs', value: '14', sub: 'SKUs', tone: 'warn' },
      { label: 'Fast Movers', value: '186', tone: 'info' },
      { label: 'Slow Movers', value: '72', tone: 'neutral' },
      { label: 'Inventory Days', value: '34', sub: 'days', tone: 'ok' },
    ],
  },
  {
    id: 'insurance', title: 'Insurance', icon: ShieldCheck,
    kpis: [
      { label: 'Claims Submitted', value: '1,284', tone: 'info' },
      { label: 'Claims Approved', value: '1,194', tone: 'ok' },
      { label: 'Claims Pending', value: '62', tone: 'warn' },
      { label: 'Claims Rejected', value: '28', tone: 'danger' },
      { label: 'Avg Claim', value: '₹42,600', tone: 'info' },
      { label: 'Approval Rate', value: '93%', trend: { value: '+1pp', up: true }, tone: 'ok' },
      { label: 'Rejection Rate', value: '2.2%', trend: { value: '−0.3pp', up: true }, tone: 'ok' },
      { label: 'Claim TAT', value: '11 days', trend: { value: '−2', up: true }, tone: 'ok' },
    ],
  },
  {
    id: 'hr', title: 'HR', icon: UserCog,
    kpis: [
      { label: 'Total Staff', value: '3,842', tone: 'info' },
      { label: 'Doctors', value: '142', tone: 'info' },
      { label: 'Nurses', value: '1,206', tone: 'info' },
      { label: 'Attrition', value: '8.4%', trend: { value: '+0.6pp', up: false }, tone: 'warn' },
      { label: 'Attendance', value: '94%', tone: 'ok' },
      { label: 'Vacancies', value: '118', tone: 'warn' },
      { label: 'New Joinees', value: '46', sub: 'this month', tone: 'ok' },
      { label: 'Training Hours', value: '1,240', tone: 'info' },
    ],
  },
  {
    id: 'college', title: 'Medical College', icon: GraduationCap,
    kpis: [
      { label: 'Student Strength', value: '1,050', tone: 'info' },
      { label: 'New Admissions', value: '250', tone: 'info' },
      { label: 'Faculty Count', value: '186', tone: 'info' },
      { label: 'Faculty Ratio', value: '1 : 5.6', tone: 'ok' },
      { label: 'Attendance', value: '89%', tone: 'ok' },
      { label: 'Exam Results', value: '91%', tone: 'ok' },
      { label: 'Pass Rate', value: '93%', tone: 'ok' },
      { label: 'Research Papers', value: '34', sub: 'YTD', tone: 'info' },
      { label: 'PG Seats', value: '210', tone: 'neutral' },
      { label: 'UG Seats', value: '150', tone: 'neutral' },
      { label: 'Interns', value: '148', tone: 'info' },
      { label: 'Residents', value: '312', tone: 'info' },
      { label: 'Clinical Exposure', value: '86%', tone: 'ok' },
      { label: 'NMC Compliance', value: 'Compliant', tone: 'ok' },
    ],
  },
  {
    id: 'equipment', title: 'Equipment', icon: Cpu,
    kpis: [
      { label: 'MRI Status', value: 'Online', tone: 'ok' },
      { label: 'CT Status', value: 'Online', tone: 'ok' },
      { label: 'Ventilators', value: '58 / 72', sub: 'in use', tone: 'warn' },
      { label: 'Equipment Uptime', value: '97.4%', tone: 'ok' },
      { label: 'Downtime', value: '2.6%', tone: 'warn' },
      { label: 'AMC Due', value: '7', sub: 'contracts', tone: 'warn' },
      { label: 'Calibration Due', value: '12', sub: 'devices', tone: 'warn' },
    ],
  },
  {
    id: 'compliance', title: 'Compliance', icon: ClipboardCheck,
    kpis: [
      { label: 'NABH Score', value: '96%', tone: 'ok' },
      { label: 'NMC Status', value: 'Compliant', tone: 'ok' },
      { label: 'Fire Compliance', value: 'Valid', tone: 'ok' },
      { label: 'License Status', value: 'Active', tone: 'ok' },
      { label: 'Legal Cases', value: '5', tone: 'warn' },
      { label: 'Audit Findings', value: '14', sub: '9 closed', tone: 'warn' },
    ],
  },
  {
    id: 'ai', title: 'AI Intelligence', icon: Sparkles,
    kpis: [
      { label: 'AI Health Score', value: '88', tone: 'ok' },
      { label: 'Revenue Forecast', value: '₹3.4 Cr', sub: 'next month', tone: 'info' },
      { label: 'Occupancy Forecast', value: '88%', sub: 'next week', tone: 'info' },
      { label: 'Risk Alerts', value: '9', tone: 'warn' },
      { label: 'Critical Alerts', value: '4', tone: 'danger' },
      { label: 'Growth Index', value: '112', trend: { value: '+4', up: true }, tone: 'ok' },
      { label: 'Efficiency Score', value: '84', tone: 'ok' },
      { label: 'Quality Score', value: '90', tone: 'ok' },
      { label: 'Financial Score', value: '86', tone: 'ok' },
      { label: 'Patient Risk', value: 'Low', tone: 'ok' },
      { label: 'Readmission Risk', value: 'Moderate', tone: 'warn' },
      { label: 'Infection Risk', value: 'Low', tone: 'ok' },
    ],
  },
]
