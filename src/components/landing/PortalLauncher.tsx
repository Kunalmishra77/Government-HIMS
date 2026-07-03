"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, Stethoscope, Users, Shield, QrCode, FlaskConical, Pill,
  ArrowRight, LayoutDashboard, Ambulance, Microscope, ScanLine, FileText,
  Package, ClipboardList, Droplets, Utensils, Trash2, Truck, ShieldCheck,
  BedDouble, CreditCard, Scissors, Heart, ShoppingCart, MessageSquarePlus,
  Building2,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuthStore, type Role } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"

type RoleCard = { role: Role; label: string; desc: string; icon: React.ElementType; href: string }

const allRoleGroups: { id: string; label: string; roles: RoleCard[] }[] = [
  { id: "clinical", label: "Clinical", roles: [
    { role: "doctor",    label: "Doctor",          desc: "AI pre-briefs, e-prescriptions, queue",      icon: Stethoscope, href: "/doctor/dashboard" },
    { role: "nurse",     label: "Nurse",           desc: "Ward monitoring, vitals, MAR, handover",     icon: Activity,    href: "/nurse/dashboard" },
    { role: "pharmacy",  label: "Pharmacy",        desc: "Prescriptions, dispensing, narcotics log",   icon: Pill,        href: "/pharmacy/dashboard" },
    { role: "lab",       label: "Laboratory",      desc: "Sample tracking, AI anomaly, reflex tests",  icon: Microscope,  href: "/lab/dashboard" },
    { role: "radiology", label: "Radiology",       desc: "AI triage, RIS command center, DICOM",       icon: ScanLine,    href: "/radiology/dashboard" },
    { role: "emergency", label: "Emergency",       desc: "ER triage, trauma tracking, sepsis alerts",  icon: Ambulance,   href: "/emergency/dashboard" },
  ] },
  { id: "operations", label: "Operations", roles: [
    { role: "reception",   label: "Reception",         desc: "OPD queue, registration, kiosk",         icon: LayoutDashboard, href: "/reception/dashboard" },
    { role: "bed_manager", label: "Admission / Beds",  desc: "Bed allocation, forecast, census",       icon: BedDouble,       href: "/admission/dashboard" },
    { role: "discharge",   label: "Discharge",         desc: "5-pillar clearance, discharge summary",  icon: ClipboardList,   href: "/discharge/dashboard" },
    { role: "ot",          label: "Operation Theater", desc: "OT scheduling, WHO checklist, briefing", icon: Scissors,        href: "/ot/dashboard" },
  ] },
  { id: "finance", label: "Finance", roles: [
    { role: "billing",   label: "Billing",         desc: "Invoices, packages, refunds, discounts", icon: CreditCard, href: "/billing/dashboard" },
    { role: "insurance", label: "Insurance / TPA", desc: "Claims, pre-auth, AI approval scoring",  icon: FileText,   href: "/insurance/dashboard" },
  ] },
  { id: "management", label: "Management", roles: [
    { role: "admin",           label: "Admin",            desc: "Analytics, staff, operations overview",            icon: Shield,       href: "/admin/dashboard" },
    { role: "hr",              label: "HR / HRMS",        desc: "Employees, leave, attendance, hiring, appraisals", icon: Users,        href: "/hr/dashboard" },
    { role: "quality",         label: "Quality",          desc: "NABH compliance, audits, incidents",               icon: Heart,        href: "/quality/dashboard" },
    { role: "vendor_manager",  label: "Vendor Management",    desc: "Vendors, contracts, POs, payments, AI insights",            icon: ShoppingCart,      href: "/vendor-manager/dashboard" },
    { role: "feedback_analyst", label: "Patient Feedback",     desc: "Satisfaction analytics, AI insights, response dashboard",   icon: MessageSquarePlus, href: "/feedback/dashboard" },
    { role: "housekeeping",    label: "Housekeeping",     desc: "Ward cleanliness, bed turnover tasks",             icon: Package,      href: "/housekeeping/dashboard" },
    { role: "inventory",       label: "Inventory",        desc: "Assets, stock levels, procurement",                icon: FlaskConical, href: "/inventory/dashboard" },
  ] },
  { id: "support", label: "Support Services", roles: [
    { role: "blood_bank",    label: "Blood Bank",         desc: "Inventory, cross-match, AI demand forecast",   icon: Droplets,    href: "/bloodbank/dashboard" },
    { role: "cssd",          label: "CSSD",               desc: "Sterilization cycles, instrument tracking",    icon: Package,     href: "/cssd/dashboard" },
    { role: "dietary",       label: "Dietary",            desc: "Diet plans, meal orders, AI nutrition",        icon: Utensils,    href: "/dietary/dashboard" },
    { role: "bmw",           label: "Bio-Medical Waste",  desc: "Waste categories, disposal logs, compliance",  icon: Trash2,      href: "/bmw/dashboard" },
    { role: "mortuary",      label: "Mortuary",           desc: "Deceased records, MLC clearance",              icon: FileText,    href: "/mortuary/dashboard" },
    { role: "ambulance",     label: "Ambulance",          desc: "Fleet management, dispatch, trip log",         icon: Truck,       href: "/ambulance/dashboard" },
    { role: "audit_officer", label: "Audit / Compliance", desc: "Audit trail, compliance reports, NABH prep",   icon: ShieldCheck, href: "/audit/dashboard" },
  ] },
  { id: "patient", label: "Patient", roles: [
    { role: "patient", label: "Patient Portal", desc: "Track queue, view records, billing, appointments", icon: Users, href: "/patient/dashboard" },
  ] },
  { id: "government", label: "Government", roles: [
    { role: "cmo",       label: "CMO — Bhopal",      desc: "District health cockpit · 142 facilities · alerts, beds, ambulance",     icon: Building2, href: "/cmo" },
    { role: "secretary", label: "PS Health · MP",    desc: "State command · 52 districts · district ranking, Cabinet, NITI Aayog", icon: Building2, href: "/secretary" },
  ] },
]

const BRAND_COLOR = "var(--color-primary)"
const BRAND_SOFT = "rgba(238,107,38,0.08)"

export function PortalLauncher() {
  const t = useTranslations("landing.launcher")
  const { setRole } = useAuthStore()
  const router = useRouter()
  const [selectedHref, setSelectedHref] = React.useState<string | null>(null)
  const [loadingHref, setLoadingHref]   = React.useState<string | null>(null)
  const [activeTab, setActiveTab] = React.useState("clinical")

  const handleLogin = (role: Role, href: string) => {
    setSelectedHref(href); setLoadingHref(href); setRole(role); router.push(href)
  }
  const activeGroup = allRoleGroups.find(g => g.id === activeTab) ?? allRoleGroups[0]
  const totalRoles = allRoleGroups.reduce((n, g) => n + g.roles.length, 0)

  return (
    <section id="launcher" className="scroll-mt-20 py-20 lg:py-28 bg-[#F6F9FC] border-t border-[#EAECF2]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">{t("eyebrow")}</p>
          <h2 className="text-[28px] lg:text-[34px] font-bold text-[#101828] tracking-tight mt-2">{t("title")}</h2>
          <p className="text-[14.5px] text-[#667085] mt-2">{t("subtitle", { count: totalRoles })}</p>
          <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full mt-4" style={{ background: "var(--color-warning-bg)", border: "1px solid rgba(217,119,6,0.20)" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[12px] font-semibold text-[#B45309]">{t("demo")}</span>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
          {allRoleGroups.map(group => {
            const active = activeTab === group.id
            return (
              <button key={group.id} onClick={() => setActiveTab(group.id)}
                className={cn("flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer whitespace-nowrap border",
                  active ? "bg-[#0D2032] text-white border-[#0D2032]" : "bg-white text-[#475467] border-[#EAECF2] hover:border-[#D0D5DD] hover:text-[#101828]")}>
                {group.label}
                <span className={cn("text-[11px] font-bold", active ? "text-white/70" : "text-[#98A2B3]")}>{group.roles.length}</span>
              </button>
            )
          })}
        </div>

        {/* Role cards */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGroup.roles.map(({ role, label, desc, icon: Icon, href }) => {
              const isSelected = selectedHref === href
              const isLoading  = loadingHref  === href
              return (
                <button key={href} onClick={() => handleLogin(role, href)} disabled={!!loadingHref}
                  className={cn("group flex items-start gap-3 p-4 rounded-2xl text-left cursor-pointer w-full bg-white border transition-all duration-200",
                    isSelected ? "border-[var(--color-primary)] shadow-[0_0_0_1px_var(--color-primary),0_8px_24px_rgba(238,107,38,0.12)]"
                      : "border-[#EAECF2] hover:border-[#D0D5DD] hover:shadow-[0_6px_18px_rgba(16,24,40,0.08)] hover:-translate-y-0.5",
                    loadingHref && !isLoading ? "opacity-60" : "")}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND_SOFT, color: BRAND_COLOR }}>
                    {isLoading ? (
                      <svg className="animate-spin h-5 w-5" style={{ color: BRAND_COLOR }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#101828] text-[14px] leading-tight">{label}</p>
                    <p className="text-[11.5px] text-[#667085] mt-1 leading-relaxed">{desc}</p>
                  </div>
                  <ArrowRight className={cn("h-4 w-4 flex-shrink-0 mt-0.5 transition-all duration-200", isSelected ? "text-[var(--color-accent)]" : "text-[#CBD2DC] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5")} />
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>

        {/* Patient check-in */}
        <div className="mt-6 flex justify-center">
          <button onClick={() => router.push("/checkin")}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl font-semibold text-sm text-[#344054] bg-white border border-[#EAECF2] hover:border-[#D0D5DD] hover:bg-white cursor-pointer transition-colors">
            <QrCode className="h-4 w-4 text-[var(--color-accent)]" />
            {t("checkinButton")}
          </button>
        </div>
      </div>
    </section>
  )
}
