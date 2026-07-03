"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  Activity, BarChart3, Bell, Calendar, ClipboardList, ClipboardCheck,
  FileText, Home, LogOut, Settings, Users, Stethoscope,
  LayoutDashboard, Receipt, UserCog, Workflow, Bot,
  FlaskConical, Pill, Search, PanelLeftClose, PanelLeft,
  Package, CheckCircle, ShieldCheck, Microscope, ScanLine, Ambulance, X,
  BedDouble, Scissors, CreditCard, Trash2, HeartPulse,
  Droplets, Utensils, Truck, Heart, BookOpen, AlertTriangle, ShieldAlert,
  Sparkles, ChevronRight, MessageSquare, MessageSquarePlus, Video, Siren, Menu, ShoppingCart, Send,
  List, Star, Building2, ArrowLeftRight, MapPin, Baby, Bug,
  Droplet, Cpu, SlidersHorizontal, RefreshCw, UserPlus,
} from "lucide-react"
import { useAuthStore, type Role } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { Avatar } from "@/components/ui/avatar"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import { CommandPalette, CommandPaletteTrigger } from "@/components/layout/CommandPalette"
import { CriticalValueBanner } from "@/components/clinical/CriticalValueBanner"
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: React.ElementType }

const PATIENT_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.care', items: [
    { href: '/patient/dashboard',    label: 'item.patient_dashboard',    icon: Home },
    { href: '/patient/ai-care',      label: 'item.patient_ai_care',      icon: Sparkles },
    { href: '/patient/health-story', label: 'item.patient_health_story', icon: Activity },
  ] },
  { header: 'section.consultations', items: [
    { href: '/patient/consultations', label: 'item.patient_consultations', icon: Calendar },
    { href: '/patient/orders',        label: 'item.patient_orders',        icon: ClipboardList },
  ] },
  { header: 'section.hospital_services', items: [
    { href: '/patient/emergency',  label: 'item.patient_emergency',   icon: Siren },
    { href: '/patient/ipd',        label: 'item.patient_ipd',         icon: BedDouble },
    { href: '/patient/discharge',  label: 'item.patient_discharge',   icon: CheckCircle },
    { href: '/patient/pharmacy',   label: 'item.patient_pharmacy',    icon: Pill },
    { href: '/patient/pathology',  label: 'item.patient_pathology',   icon: FlaskConical },
    { href: '/patient/radiology',  label: 'item.patient_radiology',   icon: ScanLine },
    { href: '/patient/blood-bank', label: 'item.patient_blood_bank',  icon: Droplets },
    { href: '/patient/ambulance',  label: 'item.patient_ambulance',   icon: Truck },
  ] },
  { header: 'section.records_billing', items: [
    { href: '/patient/downloads', label: 'item.patient_downloads', icon: FileText },
    { href: '/patient/billing',   label: 'item.patient_billing',   icon: Receipt },
    { href: '/patient/insurance', label: 'item.patient_insurance', icon: ShieldCheck },
  ] },
  { header: 'section.experience', items: [
    { href: '/patient/feedback', label: 'item.patient_feedback', icon: MessageSquarePlus },
  ] },
  { header: 'section.account', items: [
    { href: '/patient/followup', label: 'item.patient_followup', icon: HeartPulse },
    { href: '/patient/profile',  label: 'item.patient_profile',  icon: UserCog },
    { href: '/patient/help',     label: 'item.patient_help',     icon: AlertTriangle },
  ] },
]

// Reception = front-desk command center. Owns the front-desk workflow;
// surfaces read-only "visibility" windows into other modules; shared utilities.
const RECEPTION_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.front_desk', items: [
    { href: '/reception/dashboard',    label: 'item.reception_dashboard',    icon: Home },
    { href: '/reception/opd',          label: 'item.reception_opd',          icon: LayoutDashboard },
    { href: '/reception/register',     label: 'item.reception_register',     icon: UserPlus },
    { href: '/reception/journey',      label: 'item.reception_journey',      icon: Activity },
    { href: '/reception/queue',        label: 'item.reception_queue',        icon: Activity },
    { href: '/reception/appointments', label: 'item.reception_appointments', icon: Calendar },
    { href: '/reception/patients',     label: 'item.reception_patients',     icon: Users },
    { href: '/reception/referrals',    label: 'item.reception_referrals',    icon: Send },
  ] },
  { header: 'section.coordination', items: [
    { href: '/reception/beds',        label: 'item.reception_beds',        icon: BedDouble },
    { href: '/reception/billing',     label: 'item.reception_billing',     icon: CreditCard },
    { href: '/reception/tpa',         label: 'item.reception_tpa',         icon: ShieldCheck },
    { href: '/reception/diagnostics', label: 'item.reception_diagnostics', icon: FlaskConical },
    { href: '/reception/ambulance',   label: 'item.reception_ambulance',   icon: Truck },
  ] },
  { header: 'section.utilities', items: [
    { href: '/reception/messages',  label: 'item.reception_messages',  icon: MessageSquare },
    { href: '/reception/downloads', label: 'item.reception_downloads', icon: FileText },
    { href: '/reception/reports',   label: 'item.reception_reports',   icon: BarChart3 },
    { href: '/checkin',             label: 'item.reception_checkin',   icon: ScanLine },
    { href: '/reception/setup',     label: 'item.reception_setup',     icon: Settings },
  ] },
]

const DOCTOR_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.clinical', items: [
    { href: '/doctor/dashboard',   label: 'item.doctor_dashboard',   icon: Stethoscope },
    { href: '/doctor/online',      label: 'item.doctor_online',      icon: Video },
    { href: '/doctor/ipd',         label: 'item.doctor_ipd',         icon: HeartPulse },
    { href: '/doctor/emergencies', label: 'item.doctor_emergencies', icon: Siren },
  ] },
  { header: 'patients', items: [
    { href: '/doctor/records',     label: 'item.doctor_records',      icon: ClipboardList },
    { href: '/doctor/ai-assistant',label: 'item.doctor_ai_assistant', icon: Sparkles },
  ] },
  { header: 'section.workspace', items: [
    { href: '/doctor/schedule',    label: 'item.doctor_schedule', icon: Calendar },
    { href: '/doctor/inbox',       label: 'item.doctor_inbox',    icon: MessageSquare },
  ] },
  { header: 'section.insights', items: [
    { href: '/doctor/analytics',   label: 'item.doctor_analytics',  icon: BarChart3 },
    { href: '/doctor/beds',        label: 'item.doctor_beds',       icon: BedDouble },
    { href: '/doctor/registries',  label: 'item.doctor_registries', icon: Users },
  ] },
]

const PHARMACY_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.fulfilment', items: [
    { href: '/pharmacy/dashboard', label: 'item.pharmacy_dashboard', icon: LayoutDashboard },
    { href: '/pharmacy/queue',     label: 'item.pharmacy_queue',     icon: ClipboardList },
  ] },
  { header: 'section.stock_compliance', items: [
    { href: '/pharmacy/inventory', label: 'item.pharmacy_inventory', icon: Package },
    { href: '/pharmacy/master',    label: 'item.pharmacy_master',    icon: BookOpen },
    { href: '/pharmacy/narcotics', label: 'item.pharmacy_narcotics', icon: AlertTriangle },
  ] },
  { header: 'section.utilities', items: [
    { href: '/pharmacy/messages',  label: 'item.pharmacy_messages',  icon: MessageSquare },
  ] },
]

// Enterprise RIS — grouped sidebar (Command / Workflow / Reports).
const RADIOLOGY_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.command', items: [
    { href: '/radiology/dashboard',   label: 'item.radiology_dashboard',   icon: LayoutDashboard },
    { href: '/radiology/ai-command',  label: 'item.radiology_ai_command',  icon: Sparkles },
    { href: '/radiology/critical',    label: 'item.radiology_critical',    icon: Siren },
    { href: '/radiology/analytics',   label: 'item.radiology_analytics',   icon: BarChart3 },
  ] },
  { header: 'section.workflow', items: [
    { href: '/radiology/orders',      label: 'item.radiology_orders',       icon: ClipboardCheck },
    { href: '/radiology/schedule',    label: 'item.radiology_schedule',     icon: Activity },
    { href: '/radiology/arrival',     label: 'item.radiology_arrival',      icon: ScanLine },
    { href: '/radiology/inbox',       label: 'item.radiology_inbox',        icon: ClipboardList },
    { href: '/radiology/bench',       label: 'item.radiology_bench',        icon: ScanLine },
    { href: '/radiology/reading',     label: 'item.radiology_reading',      icon: FileText },
    { href: '/radiology/verification',label: 'item.radiology_verification', icon: ShieldCheck },
  ] },
  { header: 'section.reports', items: [
    { href: '/radiology/viewer',      label: 'item.radiology_viewer',       icon: Microscope },
    { href: '/radiology/templates',   label: 'item.radiology_templates',    icon: BookOpen },
    { href: '/radiology/distribution',label: 'item.radiology_distribution', icon: Send },
  ] },
]

const CMO_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.daily', items: [
    { href: '/cmo',           label: 'item.cmo_home',      icon: Home },
    { href: '/cmo/alerts',    label: 'item.cmo_alerts',    icon: AlertTriangle },
    { href: '/cmo/approvals', label: 'item.cmo_approvals', icon: ClipboardCheck },
  ] },
  { header: 'section.operations', items: [
    { href: '/cmo/facilities', label: 'item.cmo_facilities', icon: Building2 },
    { href: '/cmo/beds',       label: 'item.cmo_beds',       icon: BedDouble },
    { href: '/cmo/ambulance',  label: 'item.cmo_ambulance',  icon: Ambulance },
    { href: '/cmo/emergency',  label: 'item.cmo_emergency',  icon: Siren },
  ] },
  { header: 'section.workforce', items: [
    { href: '/cmo/staff',    label: 'item.cmo_staff',    icon: Users },
    { href: '/cmo/postings', label: 'item.cmo_postings', icon: ArrowLeftRight },
  ] },
  { header: 'section.public_health', items: [
    { href: '/cmo/surveillance',     label: 'item.cmo_surveillance',     icon: Activity },
    { href: '/cmo/mch',              label: 'item.cmo_mch',              icon: HeartPulse },
    { href: '/cmo/disease-programs', label: 'item.cmo_disease_programs', icon: Stethoscope },
  ] },
  { header: 'section.schemes_supply', items: [
    { href: '/cmo/schemes',   label: 'item.cmo_schemes',   icon: ShieldCheck },
    { href: '/cmo/supply',    label: 'item.cmo_supply',    icon: Pill },
    { href: '/cmo/equipment', label: 'item.cmo_equipment', icon: Settings },
  ] },
  { header: 'section.quality', items: [
    { href: '/cmo/quality',    label: 'item.cmo_quality',    icon: Star },
    { href: '/cmo/grievances', label: 'item.cmo_grievances', icon: MessageSquare },
  ] },
  { header: 'section.field_reports', items: [
    { href: '/cmo/field-visits', label: 'item.cmo_field_visits', icon: MapPin },
    { href: '/cmo/reports',      label: 'item.cmo_reports',      icon: FileText },
  ] },
  { header: 'section.comms_ai', items: [
    { href: '/cmo/communication', label: 'item.cmo_communication', icon: MessageSquarePlus },
    { href: '/cmo/ai-assistants', label: 'item.cmo_ai_assistants', icon: Sparkles },
  ] },
  { header: 'section.admin', items: [
    { href: '/cmo/settings',  label: 'item.cmo_settings',  icon: Settings },
    { href: '/cmo/audit-log', label: 'item.cmo_audit_log', icon: ClipboardList },
    { href: '/cmo/profile',   label: 'item.cmo_profile',   icon: UserCog },
  ] },
]

const SECRETARY_SECTIONS: { header: string; items: NavItem[] }[] = [
  { header: 'section.daily', items: [
    { href: '/secretary',           label: 'item.secretary_home',      icon: Home },
    { href: '/secretary/alerts',    label: 'item.secretary_alerts',    icon: AlertTriangle },
    { href: '/secretary/approvals', label: 'item.secretary_approvals', icon: ClipboardCheck },
  ] },
  { header: 'section.state_command', items: [
    { href: '/secretary/ranking',      label: 'item.secretary_ranking',      icon: BarChart3 },
    { href: '/secretary/mobilization', label: 'item.secretary_mobilization', icon: ArrowLeftRight },
    { href: '/secretary/beds',         label: 'item.secretary_beds',         icon: BedDouble },
    { href: '/secretary/emergency',    label: 'item.secretary_emergency',    icon: Siren },
  ] },
  { header: 'section.network', items: [
    { href: '/secretary/districts', label: 'item.secretary_districts', icon: Building2 },
    { href: '/secretary/dme',       label: 'item.secretary_dme',       icon: Stethoscope },
    { href: '/secretary/ayush',     label: 'item.secretary_ayush',     icon: HeartPulse },
  ] },
  { header: 'section.public_health', items: [
    { href: '/secretary/surveillance',     label: 'item.secretary_surveillance',     icon: Activity },
    { href: '/secretary/mch',              label: 'item.secretary_mch',              icon: Baby },
    { href: '/secretary/disease-programs', label: 'item.secretary_disease_programs', icon: Bug },
  ] },
  { header: 'section.schemes_funds', items: [
    { href: '/secretary/schemes', label: 'item.secretary_schemes', icon: ShieldCheck },
    { href: '/secretary/fraud',   label: 'item.secretary_fraud',   icon: ShieldAlert },
  ] },
  { header: 'section.workforce_supply', items: [
    { href: '/secretary/workforce', label: 'item.secretary_workforce', icon: Users },
    { href: '/secretary/supply',    label: 'item.secretary_supply',    icon: Pill },
  ] },
  { header: 'section.quality_compliance', items: [
    { href: '/secretary/quality',   label: 'item.secretary_quality',   icon: Star },
    { href: '/secretary/cag-audit', label: 'item.secretary_cag_audit', icon: FileText },
  ] },
  { header: 'section.reports', items: [
    { href: '/secretary/reports',   label: 'item.secretary_reports',   icon: ClipboardList },
    { href: '/secretary/niti-abdm', label: 'item.secretary_niti_abdm', icon: BarChart3 },
  ] },
  { header: 'section.policy_centre', items: [
    { href: '/secretary/cabinet',       label: 'item.secretary_cabinet', icon: BookOpen },
    { href: '/secretary/centre',        label: 'item.secretary_centre',  icon: Building2 },
  ] },
  { header: 'section.comms_ai', items: [
    { href: '/secretary/communication', label: 'item.secretary_communication', icon: MessageSquarePlus },
    { href: '/secretary/ai-assistants', label: 'item.secretary_ai_assistants', icon: Sparkles },
  ] },
  { header: 'section.admin', items: [
    { href: '/secretary/settings',  label: 'item.secretary_settings',  icon: Settings },
    { href: '/secretary/audit-log', label: 'item.secretary_audit_log', icon: ClipboardList },
    { href: '/secretary/profile',   label: 'item.secretary_profile',   icon: UserCog },
  ] },
]

const navByRole: Record<Role, NavItem[]> = {
  patient: PATIENT_SECTIONS.flatMap(s => s.items),
  doctor: DOCTOR_SECTIONS.flatMap(s => s.items),
  reception: RECEPTION_SECTIONS.flatMap(s => s.items),
  pharmacy: PHARMACY_SECTIONS.flatMap(s => s.items),
  admin: [
    { href: '/admin/assistant',       label: 'item.admin_assistant',       icon: Sparkles },
    { href: '/admin/command-center',  label: 'item.admin_command_center',  icon: Activity },
    { href: '/admin/dashboard',       label: 'item.admin_dashboard',       icon: LayoutDashboard },
    { href: '/admin/users',           label: 'item.admin_users',           icon: UserCog },
    { href: '/admin/credentials',     label: 'item.admin_credentials',     icon: ShieldCheck },
    { href: '/admin/operations',      label: 'item.admin_operations',      icon: Workflow },
    { href: '/admin/analytics',       label: 'item.admin_analytics',       icon: BarChart3 },
    { href: '/admin/roster',          label: 'item.admin_roster',          icon: Calendar },
    { href: '/admin/duty',            label: 'item.admin_duty',            icon: ClipboardList },
    { href: '/admin/hours',           label: 'item.admin_hours',           icon: Activity },
    { href: '/admin/on-call',         label: 'item.admin_on_call',         icon: Bell },
    { href: '/admin/coverage',        label: 'item.admin_coverage',        icon: ShieldCheck },
    { href: '/admin/staffing',        label: 'item.admin_staffing',        icon: Users },
    { href: '/admin/doctor-activity', label: 'item.admin_doctor_activity', icon: Stethoscope },
    { href: '/admin/finance',         label: 'item.admin_finance',         icon: CreditCard },
    { href: '/admin/payroll',         label: 'item.admin_payroll',         icon: Receipt },
    { href: '/admin/vendors',         label: 'item.admin_vendors',         icon: Truck },
    { href: '/admin/disputes',        label: 'item.admin_disputes',        icon: ShieldAlert },
    { href: '/admin/compliance',      label: 'item.admin_compliance',      icon: ShieldCheck },
    { href: '/admin/statutory',       label: 'item.admin_statutory',       icon: Calendar },
    { href: '/admin/disha',           label: 'item.admin_disha',           icon: ShieldCheck },
    { href: '/quality/dashboard',     label: 'item.admin_quality',         icon: ShieldCheck },
    { href: '/quality/nabh',          label: 'item.admin_nabh',            icon: ShieldCheck },
    { href: '/admin/ai-performance',  label: 'item.admin_ai_performance',  icon: Sparkles },
  ],
  hr: [
    { href: '/hr/dashboard',     label: 'item.hr_dashboard',   icon: LayoutDashboard },
    { href: '/hr/employees',     label: 'item.hr_employees',   icon: Users },
    { href: '/hr/leave',         label: 'item.hr_leave',       icon: Calendar },
    { href: '/hr/attendance',    label: 'item.hr_attendance',  icon: Activity },
    { href: '/hr/recruitment',   label: 'item.hr_recruitment', icon: Workflow },
    { href: '/hr/onboarding',    label: 'item.hr_onboarding',  icon: ClipboardCheck },
    { href: '/hr/appraisals',    label: 'item.hr_appraisals',  icon: BarChart3 },
  ],
  nurse: [
    { href: '/nurse/dashboard',       label: 'item.nurse_dashboard',       icon: LayoutDashboard },
    { href: '/nurse/vitals-requests', label: 'item.nurse_vitals_requests', icon: HeartPulse },
    { href: '/nurse/orders',          label: 'item.nurse_orders',          icon: ClipboardCheck },
    { href: '/nurse/patients',        label: 'item.nurse_patients',        icon: Users },
    { href: '/nurse/rounds',     label: 'item.nurse_rounds',        icon: Stethoscope },
    { href: '/nurse/tasks',      label: 'item.nurse_tasks',         icon: ClipboardList },
    { href: '/nurse/medication', label: 'item.nurse_medication',    icon: Pill },
    { href: '/nurse/fluid-balance', label: 'item.nurse_fluid_balance', icon: Droplets },
    { href: '/nurse/handover',   label: 'item.nurse_handover',      icon: FileText },
    { href: '/nurse/ai-assistant', label: 'item.nurse_ai_assistant', icon: Sparkles },
    { href: '/nurse/messages',   label: 'item.nurse_messages',      icon: MessageSquare },
  ],
  emergency: [
    { href: '/emergency/triage',    label: 'item.emergency_triage',    icon: Ambulance },
    { href: '/emergency/floor',     label: 'item.emergency_floor',     icon: Activity },
    { href: '/emergency/dashboard', label: 'item.emergency_dashboard', icon: LayoutDashboard },
  ],
  lab: [
    { href: '/lab/dashboard',       label: 'item.lab_dashboard',      icon: LayoutDashboard },
    { href: '/lab/phlebotomy',      label: 'item.lab_phlebotomy',     icon: Droplet },
    { href: '/lab/inbox',           label: 'item.lab_inbox',          icon: ClipboardList },
    { href: '/lab/analyzer-feed',   label: 'item.lab_analyzer_feed',  icon: Cpu },
    { href: '/lab/verify',          label: 'item.lab_verify',         icon: ClipboardCheck },
    { href: '/lab/benches',         label: 'item.lab_benches',        icon: Microscope },
    { href: '/lab/microbiology',    label: 'item.lab_microbiology',   icon: Bug },
    { href: '/lab/qc',              label: 'item.lab_qc',             icon: SlidersHorizontal },
    { href: '/lab/reflex',          label: 'item.lab_reflex',         icon: RefreshCw },
  ],
  radiology: RADIOLOGY_SECTIONS.flatMap(s => s.items),
  insurance: [
    { href: '/insurance/dashboard', label: 'item.insurance_dashboard', icon: LayoutDashboard },
    { href: '/insurance/pipeline',  label: 'item.insurance_pipeline',  icon: Workflow },
    { href: '/insurance/claims',    label: 'item.insurance_claims',    icon: FileText },
    { href: '/insurance/preauth',   label: 'item.insurance_preauth',   icon: ShieldCheck },
    { href: '/insurance/documents', label: 'item.insurance_documents', icon: Package },
  ],
  inventory: [
    { href: '/inventory/dashboard', label: 'item.inventory_dashboard', icon: LayoutDashboard },
    { href: '/inventory/stock',     label: 'item.inventory_stock',     icon: Package },
    { href: '/inventory/requests',  label: 'item.inventory_requests',  icon: ShoppingCart },
  ],
  bed_manager: [
    { href: '/admission/dashboard', label: 'item.bed_manager_dashboard', icon: BedDouble },
    { href: '/admission/beds',      label: 'item.bed_manager_beds',      icon: LayoutDashboard },
    { href: '/admission/forecast',  label: 'item.bed_manager_forecast',  icon: BarChart3 },
  ],
  discharge: [
    { href: '/discharge/dashboard', label: 'item.discharge_dashboard', icon: CheckCircle },
  ],
  billing: [
    { href: '/billing/dashboard',   label: 'item.billing_dashboard', icon: CreditCard },
    { href: '/billing/packages',    label: 'item.billing_packages',  icon: Package },
    { href: '/billing/refunds',     label: 'item.billing_refunds',   icon: Receipt },
    { href: '/billing/discounts',   label: 'item.billing_discounts', icon: Heart },
  ],
  ot: [
    { href: '/ot/dashboard',    label: 'item.ot_dashboard',  icon: Scissors },
    { href: '/ot/schedule',     label: 'item.ot_schedule',   icon: Calendar },
    { href: '/ot/checklist',    label: 'item.ot_checklist',  icon: ClipboardList },
  ],
  housekeeping: [
    { href: '/housekeeping/dashboard', label: 'item.housekeeping_dashboard', icon: Trash2 },
  ],
  quality: [
    { href: '/quality/dashboard',  label: 'item.quality_dashboard', icon: ShieldCheck },
    { href: '/quality/incidents',  label: 'item.quality_incidents', icon: Activity },
    { href: '/quality/nabh',       label: 'item.quality_nabh',      icon: ShieldCheck },
  ],
  feedback_analyst: [
    { href: '/feedback/dashboard',   label: 'item.feedback_dashboard',   icon: Star },
    { href: '/feedback/responses',   label: 'item.feedback_responses',   icon: List },
    { href: '/feedback/ai-insights', label: 'item.feedback_ai_insights', icon: Sparkles },
  ],
  blood_bank: [
    { href: '/bloodbank/dashboard',  label: 'item.bloodbank_dashboard', icon: Droplets },
    { href: '/bloodbank/inventory',  label: 'item.bloodbank_inventory', icon: Package },
    { href: '/bloodbank/requests',   label: 'item.bloodbank_requests',  icon: ClipboardList },
    { href: '/bloodbank/donors',     label: 'item.bloodbank_donors',    icon: Heart },
  ],
  cssd: [
    { href: '/cssd/dashboard',    label: 'item.cssd_dashboard',    icon: LayoutDashboard },
    { href: '/cssd/cycles',       label: 'item.cssd_cycles',       icon: Activity },
    { href: '/cssd/instruments',  label: 'item.cssd_instruments',  icon: Package },
  ],
  dietary: [
    { href: '/dietary/dashboard', label: 'item.dietary_dashboard', icon: Utensils },
    { href: '/dietary/plans',     label: 'item.dietary_plans',     icon: BookOpen },
    { href: '/dietary/orders',    label: 'item.dietary_orders',    icon: ClipboardList },
  ],
  bmw: [
    { href: '/bmw/dashboard', label: 'item.bmw_dashboard', icon: AlertTriangle },
    { href: '/bmw/log',       label: 'item.bmw_log',       icon: FileText },
    { href: '/bmw/reports',   label: 'item.bmw_reports',   icon: BarChart3 },
  ],
  mortuary: [
    { href: '/mortuary/dashboard',   label: 'item.mortuary_dashboard',   icon: LayoutDashboard },
    { href: '/mortuary/records',     label: 'item.mortuary_records',     icon: FileText },
    { href: '/mortuary/clearances',  label: 'item.mortuary_clearances',  icon: CheckCircle },
  ],
  ambulance: [
    { href: '/ambulance/dashboard', label: 'item.ambulance_dashboard', icon: Truck },
    { href: '/ambulance/dispatch',  label: 'item.ambulance_dispatch',  icon: Activity },
    { href: '/ambulance/log',       label: 'item.ambulance_log',       icon: FileText },
  ],
  audit_officer: [
    { href: '/audit/dashboard', label: 'item.audit_dashboard', icon: ShieldCheck },
    { href: '/audit/log',       label: 'item.audit_log',       icon: FileText },
    { href: '/audit/reports',   label: 'item.audit_reports',   icon: BarChart3 },
  ],
  vendor_manager: [
    { href: '/vendor-manager/dashboard',       label: 'item.vendor_manager_dashboard',        icon: LayoutDashboard },
    { href: '/vendor-manager/vendors',          label: 'item.vendor_manager_vendors',         icon: Truck },
    { href: '/vendor-manager/contracts',        label: 'item.vendor_manager_contracts',       icon: FileText },
    { href: '/vendor-manager/purchase-orders',  label: 'item.vendor_manager_purchase_orders', icon: ShoppingCart },
    { href: '/vendor-manager/payments',         label: 'item.vendor_manager_payments',        icon: CreditCard },
    { href: '/vendor-manager/performance',      label: 'item.vendor_manager_performance',     icon: BarChart3 },
    { href: '/vendor-manager/ai-insights',      label: 'item.vendor_manager_ai_insights',     icon: Sparkles },
  ],
  cmo:       CMO_SECTIONS.flatMap(s => s.items),
  secretary: SECRETARY_SECTIONS.flatMap(s => s.items),
}

// Single disciplined deep-blue identity shared by every portal (uniform per design
// direction). Roles are distinguished by label + icon only — never by color.
const ROLE_LABELS: Record<Role, string> = {
  patient: 'role.patient',      doctor: 'role.doctor',       reception: 'role.reception',
  admin: 'role.admin',          nurse: 'role.nurse',         emergency: 'role.emergency',
  lab: 'role.lab',              radiology: 'role.radiology', insurance: 'role.insurance',
  inventory: 'role.inventory',  pharmacy: 'role.pharmacy',   bed_manager: 'role.bed_manager',
  discharge: 'role.discharge',  billing: 'role.billing',     ot: 'role.ot',
  housekeeping: 'role.housekeeping', quality: 'role.quality', blood_bank: 'role.blood_bank',
  cssd: 'role.cssd',            dietary: 'role.dietary',     bmw: 'role.bmw',
  mortuary: 'role.mortuary',    ambulance: 'role.ambulance', audit_officer: 'role.audit_officer',
  hr: 'role.hr',                vendor_manager: 'role.vendor_manager',
  feedback_analyst: 'role.feedback_analyst',
  cmo:       'role.cmo',
  secretary: 'role.secretary',
}

// Roles whose sidebar is rendered as grouped sections (with headers) instead of a flat list.
const sectionsByRole: Partial<Record<Role, { header: string; items: NavItem[] }[]>> = {
  patient: PATIENT_SECTIONS,
  reception: RECEPTION_SECTIONS,
  doctor: DOCTOR_SECTIONS,
  pharmacy: PHARMACY_SECTIONS,
  radiology: RADIOLOGY_SECTIONS,
  cmo:       CMO_SECTIONS,
  secretary: SECRETARY_SECTIONS,
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser, activeRole, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('nav')
  const nav = navByRole[activeRole] ?? []
  const roleLabel = t(ROLE_LABELS[activeRole])
  const [collapsed, setCollapsed] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // Close the mobile sidebar drawer on navigation.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Wired header search + bell (M16).
  const allPatients = usePatientStore(s => s.patients)
  const allInpatients = useInpatientStore(s => s.inpatients)
  const notifications = useNotificationStore(s => s.notifications)
  const markNotifRead = useNotificationStore(s => s.markRead)
  const markAllRead = useNotificationStore(s => s.markAllRead)
  const dismissNotif = useNotificationStore(s => s.dismiss)

  const roleNotifs = notifications.filter(n => activeRole === 'admin' || !n.targetRole || n.targetRole === activeRole)
  const unreadCount = roleNotifs.filter(n => !n.read).length

  // Where clicking a notification takes the user. Prefers an explicit deep-link,
  // then a keyword/type match for the active role, then the role's home page so
  // a click always lands somewhere actionable.
  const notifHref = (n: typeof notifications[number]): string | null => {
    if (n.link) return n.link
    const t = `${n.type} ${n.title} ${n.body}`.toLowerCase()
    if (activeRole === 'doctor') {
      if (/discharge|round|ipd|inpatient|admit/.test(t)) return '/doctor/ipd'
      if (/radiolog|x-ray|ct |mri|scan|lab|result|critical|report/.test(t)) return '/doctor/inbox'
      if (/appointment|consult|opd/.test(t)) return '/doctor/dashboard'
    }
    if (activeRole === 'discharge' && /discharge|clearance|exit/.test(t)) return '/discharge/dashboard'
    if (activeRole === 'bed_manager' && /bed|admission|discharge/.test(t)) return '/admission/dashboard'
    if (activeRole === 'radiology' && /radiolog|x-ray|scan|study|report/.test(t)) return '/radiology/inbox'
    if (activeRole === 'lab' && /lab|result|sample|critical/.test(t)) return '/lab/inbox'
    if (activeRole === 'pharmacy' && /pharmac|medicine|rx|prescription|dispense/.test(t)) return '/pharmacy/queue'
    return nav[0]?.href ?? null
  }

  const handleNotifClick = (n: typeof notifications[number]) => {
    markNotifRead(n.id)
    setNotifOpen(false)
    const href = notifHref(n)
    if (href) router.push(href)
  }

  const q = query.trim().toLowerCase()
  const searchResults = q.length >= 1 ? (() => {
    const ipIds = new Set(allInpatients.map(i => i.patientId))
    const out: { id: string; name: string; sub: string; admitted: boolean }[] = []
    allInpatients.forEach(i => { if (i.name.toLowerCase().includes(q) || i.patientId.toLowerCase().includes(q)) out.push({ id: i.patientId, name: i.name, sub: `Admitted · ${i.ward} ${i.bed}`, admitted: true }) })
    allPatients.forEach(p => { if (!out.some(m => m.id === p.id) && (p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))) out.push({ id: p.id, name: p.name, sub: `${p.id} · ${p.department}`, admitted: ipIds.has(p.id) }) })
    return out.slice(0, 6)
  })() : []

  const PATIENTS_ROUTE: Partial<Record<Role, string>> = { reception: '/reception/patients', nurse: '/nurse/patients', admin: '/admin/users' }
  const gotoPatient = (m: { id: string; admitted: boolean }) => {
    setQuery('')
    if (activeRole === 'doctor') { router.push(m.admitted ? `/doctor/ipd/${m.id}` : '/doctor/records'); return }
    const dest = PATIENTS_ROUTE[activeRole]; if (dest) router.push(dest)
  }

  // Page-enter animation is attached only after mount so the server render and
  // the first client render emit identical (un-transformed) markup — avoids the
  // framer-motion `initial` transform causing a hydration attribute mismatch.
  useEffect(() => { setMounted(true) }, [])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

  const renderItem = (item: NavItem) => {
    // Exact match wins; prefix match only when no more-specific nav item also matches,
    // preventing the root route (/secretary) from staying active on every sub-page.
    const isActive =
      pathname === item.href ||
      (pathname.startsWith(item.href + '/') &&
        !nav.some(other => other.href !== item.href && pathname.startsWith(other.href)))
    const Icon = item.icon
    const label = t(item.label)
    return (
      <Link key={item.href} href={item.href}>
        <div
          title={collapsed ? label : undefined}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 cursor-pointer relative group",
            isActive
              ? "font-semibold bg-accent-soft text-accent"
              : "font-medium text-foreground-lighter hover:text-foreground"
          )}
        >
          {isActive && <motion.div layoutId="active-nav-pill" className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />}
          {!isActive && <div className="absolute inset-0 rounded-xl bg-surface-sunken opacity-0 group-hover:opacity-100 transition-opacity duration-150" />}
          <Icon className={cn("h-[18px] w-[18px] flex-shrink-0 relative z-10 transition-colors", isActive && "text-accent")} aria-hidden="true" />
          {!collapsed && <span className="flex-1 truncate relative z-10">{label}</span>}
          {isActive && !collapsed && <ChevronRight className="h-3.5 w-3.5 relative z-10 opacity-50 text-accent" />}
        </div>
      </Link>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main-content" className="skip-link">{t('chrome.skipToContent')}</a>

      {/* Mobile drawer backdrop */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-foreground/40 backdrop-blur-[2px] z-40" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      {/* ── Sidebar ──────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 264 }}
        transition={transition}
        className={cn(
          "flex-shrink-0 flex flex-col bg-surface border-r border-border z-20 relative overflow-hidden",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-64 max-lg:shadow-lg transition-transform",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
        aria-label={t('chrome.mainSidebar')}
      >
        {/* Brand Header */}
        <div className="h-[68px] flex items-center px-4 flex-shrink-0 border-b border-border-light">
          <div className="flex items-center overflow-hidden whitespace-nowrap w-full pl-2">
            <img src="/Agentix logo-health.svg" alt="Agentix HIMS" className={cn("w-auto object-contain", collapsed ? "h-8" : "h-10")} />
          </div>
        </div>

        {/* Navigation */}
        <nav aria-label={t('chrome.mainNavigation')} className="flex-1 px-2.5 py-4 overflow-y-auto">
          {sectionsByRole[activeRole] ? (
            sectionsByRole[activeRole]!.map(section => (
              <div key={section.header} className="mb-1">
                {!collapsed && <p className="px-3 pt-3 pb-1 t-overline text-foreground-placeholder">{t(section.header)}</p>}
                <div className="space-y-0.5">{section.items.map(renderItem)}</div>
              </div>
            ))
          ) : (
            <div className="space-y-0.5">{nav.map(renderItem)}</div>
          )}
        </nav>

        {/* Bottom: Role Switcher + User */}
        <div className="px-2.5 pb-4 flex flex-col gap-2 pt-3 border-t border-border-light">
          {/* AI Status Chip */}
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-soft border border-primary/15">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
              <span className="text-[11px] font-semibold text-accent">{t('chrome.aiActive')}</span>
              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-success" />
            </div>
          )}

          {/* User Row */}
          <div className={cn("flex items-center", collapsed ? "justify-center flex-col gap-2" : "gap-3 px-1")}>
            <Avatar name={currentUser?.name ?? t('chrome.userFallback')} size="sm" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{currentUser?.name}</p>
                <p className="text-[11px] font-medium text-foreground-placeholder truncate">{currentUser?.id}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              aria-label={t('chrome.logout')}
              title={t('chrome.logout')}
              className="tap p-1.5 rounded-lg transition-colors flex-shrink-0 cursor-pointer text-foreground-placeholder hover:text-danger hover:bg-danger-bg"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* ── Main Area ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header — z-30 keeps its dropdowns (notifications, search) above the
            page content in <main> (z-10) and the sidebar (z-20); equal z-index
            previously let <main> paint over the open notification panel. */}
        <header className="h-[68px] flex-shrink-0 flex items-center justify-between px-4 sm:px-6 bg-surface border-b border-border relative z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={t('chrome.openMenu')}
              className="lg:hidden tap p-2 -ml-2 rounded-xl transition-colors cursor-pointer text-foreground-lighter hover:bg-surface-sunken hover:text-foreground"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? t('chrome.expandSidebar') : t('chrome.collapseSidebar')}
              className="hidden lg:block p-2 -ml-2 rounded-xl transition-colors cursor-pointer text-foreground-placeholder hover:text-foreground hover:bg-surface-sunken"
            >
              {collapsed
                ? <PanelLeft className="h-5 w-5" aria-hidden="true" />
                : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
              }
            </button>
            <div>
              <h1 className="t-title text-foreground">
                {pathname.startsWith('/doctor/settings')
                  ? t('chrome.profileSettings')
                  : (() => { const active = nav.find(n => pathname.startsWith(n.href)); return active ? t(active.label) : t('chrome.defaultTitle') })()}
              </h1>
              <nav aria-label={t('chrome.breadcrumb')}>
                <ol className="flex items-center gap-1 text-xs font-medium text-foreground-placeholder">
                  <li>{roleLabel}</li>
                  {nav.find(n => pathname.startsWith(n.href)) && (
                    <>
                      <li aria-hidden="true">/</li>
                      <li aria-current="page" className="font-semibold text-accent">
                        {t(nav.find(n => pathname.startsWith(n.href))!.label)}
                      </li>
                    </>
                  )}
                </ol>
              </nav>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Mobile search — below md the desktop bar is hidden. For admin this
                routes to the AI assistant (the single admin search engine); for
                everyone else it opens the universal command palette. */}
            <button
              type="button"
              onClick={() => {
                if (activeRole === 'admin') { router.push('/admin/assistant'); return }
                if (typeof window === "undefined") return
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }))
              }}
              aria-label={activeRole === 'admin' ? t('chrome.askAi') : t('chrome.search')}
              className="md:hidden tap inline-flex items-center justify-center p-2 rounded-xl text-foreground-muted hover:bg-surface-sunken transition-colors cursor-pointer"
            >
              {activeRole === 'admin' ? <Sparkles className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
            </button>

            {/* M2 — Command palette trigger (Cmd/Ctrl+K). Hidden for admin, whose
                single search surface is the AI assistant. */}
            {activeRole !== 'admin' && <CommandPaletteTrigger className="hidden lg:inline-flex" />}

            {/* Admin — single AI search engine entry (replaces patient search) */}
            {activeRole === 'admin' ? (
              <button
                type="button"
                onClick={() => router.push('/admin/assistant')}
                className="hidden md:inline-flex items-center gap-2 h-9 w-64 px-3 rounded-xl text-[13px] font-medium text-foreground-lighter bg-surface-sunken border border-border hover:border-primary hover:text-accent transition-colors cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-accent flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{t('chrome.askAiPlaceholder')}</span>
              </button>
            ) : (
            /* Global Search */
            <div className="relative hidden md:block w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-placeholder z-10" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && searchResults[0]) gotoPatient(searchResults[0]); if (e.key === 'Escape') setQuery('') }}
                onBlur={() => setTimeout(() => setQuery(''), 150)}
                placeholder={activeRole === 'patient' ? t('chrome.searchRecordsPlaceholder') : t('chrome.searchPatientsPlaceholder')}
                aria-label={t('chrome.search')}
                className="w-full h-9 pl-9 pr-4 rounded-xl text-sm text-foreground placeholder:text-foreground-placeholder bg-surface-sunken border border-border hover:border-border-hover focus:border-primary focus:bg-surface transition-colors"
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-11 w-72 bg-surface border border-border rounded-2xl z-50 overflow-hidden py-1.5 shadow-dropdown">
                  {searchResults.map(m => (
                    <button key={m.id} onMouseDown={e => e.preventDefault()} onClick={() => gotoPatient(m)}
                      className="w-full text-left px-3.5 py-2 hover:bg-surface-sunken flex items-center justify-between gap-2 transition-colors">
                      <span className="min-w-0"><span className="block text-[13px] font-semibold text-foreground truncate">{m.name}</span><span className="block text-[11px] text-foreground-placeholder truncate">{m.sub}</span></span>
                      {m.admitted && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-danger-bg text-danger-strong flex-shrink-0">IPD</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label={t('chrome.notifications')}
                aria-expanded={notifOpen}
                className="tap relative p-2 rounded-xl transition-colors cursor-pointer bg-surface-sunken border border-border text-foreground-lighter shadow-xs hover:bg-surface hover:text-foreground"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-surface" aria-label={t('chrome.unreadNotifications', { count: unreadCount })}>{unreadCount}</span>}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-72 bg-surface border border-border rounded-2xl z-50 overflow-hidden shadow-dropdown"
                  >
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light">
                      <p className="text-sm font-bold text-foreground flex-1">{t('chrome.notifications')}{unreadCount > 0 ? ` · ${unreadCount}` : ''}</p>
                      {unreadCount > 0 ? (
                        <button onClick={() => activeRole && markAllRead(activeRole)} className="text-[10.5px] font-semibold text-accent px-2 py-1 rounded-md hover:bg-accent-soft cursor-pointer transition-colors">
                          {t('chrome.markAllRead')}
                        </button>
                      ) : null}
                      <button onClick={() => setNotifOpen(false)} aria-label={t('chrome.close')} className="p-1 rounded-lg hover:bg-surface-sunken cursor-pointer">
                        <X className="h-4 w-4 text-foreground-placeholder" />
                      </button>
                    </div>
                    {roleNotifs.length === 0 ? (
                      <div className="p-6 text-center text-sm text-foreground-lighter">{t('chrome.allCaughtUp')}</div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        {roleNotifs.slice(0, 12).map(n => (
                          <div key={n.id}
                            className={cn("w-full text-left px-4 py-2.5 border-b border-border-light last:border-0 hover:bg-surface-sunken flex items-start gap-2.5 group cursor-pointer transition-colors", !n.read && "bg-accent-soft/50")}
                            onClick={() => handleNotifClick(n)}>
                            {!n.read ? <span className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", n.priority === 'critical' ? "bg-danger" : n.priority === 'high' ? "bg-warning" : "bg-primary")} /> : <span className="w-2 flex-shrink-0" />}
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12.5px] font-semibold text-foreground truncate">{n.title}</span>
                              <span className="block text-[11.5px] text-foreground-lighter line-clamp-2">{n.body}</span>
                              {n.patientName ? <span className="block text-[10px] font-mono text-foreground-placeholder mt-0.5">{n.patientName}</span> : null}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); dismissNotif(n.id) }}
                              aria-label={t('chrome.dismiss')}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-danger-bg text-foreground-placeholder hover:text-danger flex-shrink-0">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <LocaleToggle />

            <Link href={activeRole === 'patient' ? '/patient/settings' : activeRole === 'reception' ? '/reception/setup' : activeRole === 'doctor' ? '/doctor/settings' : '/admin/analytics'}>
              <button
                aria-label={t('chrome.settingsLabel')}
                className="tap p-2 rounded-xl transition-colors cursor-pointer bg-surface-sunken border border-border text-foreground-lighter shadow-xs hover:bg-surface hover:text-foreground"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6 relative z-10">
          {/* M4-W1 — Closed-loop critical-value banner. Visible only when
              an unack'd lab_critical_callback exists, and only on the
              roles that own the loop (doctor, nurse). */}
          {(activeRole === 'doctor' || activeRole === 'nurse') ? (
            <div className="max-w-7xl mx-auto mb-3">
              <CriticalValueBanner role={activeRole === 'doctor' ? 'doctor' : 'nurse'} />
            </div>
          ) : null}

          {mounted ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' as const }}
                className="h-full max-w-7xl mx-auto"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="h-full max-w-7xl mx-auto">{children}</div>
          )}
        </main>
      </div>
      {/* M2 — Command palette: Cmd/Ctrl+K from anywhere in the app. */}
      <CommandPalette />
    </div>
  )
}
