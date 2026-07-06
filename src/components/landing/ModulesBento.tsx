"use client"

import {
  Stethoscope, Activity, Pill, Microscope, ScanLine, Ambulance, LayoutDashboard, BedDouble,
  ClipboardList, Scissors, CreditCard, FileText, Shield, Heart, Package, Droplets, Utensils,
  Trash2, Truck, ShieldCheck, Users,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Reveal } from "./Reveal"

const GROUPS = [
  { label: "Clinical", color: "var(--color-primary)", items: [
    { icon: Stethoscope, name: "Doctor / OPD" }, { icon: Activity, name: "Nursing" }, { icon: Pill, name: "Pharmacy" },
    { icon: Microscope, name: "Laboratory" }, { icon: ScanLine, name: "Radiology / RIS" }, { icon: Ambulance, name: "Emergency" },
  ] },
  { label: "Operations", color: "var(--color-primary)", items: [
    { icon: LayoutDashboard, name: "Reception / OPD" }, { icon: BedDouble, name: "Admissions & Beds" },
    { icon: ClipboardList, name: "Discharge" }, { icon: Scissors, name: "Operation Theater" },
  ] },
  { label: "Finance", color: "var(--color-primary-light)", items: [
    { icon: CreditCard, name: "Billing" }, { icon: FileText, name: "Insurance / TPA" },
  ] },
  { label: "Management & Support", color: "var(--color-primary)", items: [
    { icon: Shield, name: "Admin / COO" }, { icon: Heart, name: "Quality / NABH" }, { icon: Package, name: "Inventory & CSSD" },
    { icon: Droplets, name: "Blood Bank" }, { icon: Utensils, name: "Dietary" }, { icon: Trash2, name: "Bio-Medical Waste" },
    { icon: Truck, name: "Ambulance" }, { icon: ShieldCheck, name: "Audit & Compliance" }, { icon: Users, name: "Patient Portal" },
  ] },
]

export function ModulesBento() {
  const t = useTranslations("landing.modules")
  return (
    <section id="platform" className="scroll-mt-20 py-20 lg:py-28 bg-white border-y border-[#EAECF2]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <Reveal className="max-w-2xl mx-auto text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">{t("eyebrow")}</p>
          <h2 className="text-[30px] lg:text-[38px] font-bold text-[#101828] tracking-tight mt-2">{t("title")}</h2>
          <p className="text-[15.5px] text-[#475467] mt-3">{t("subtitle")}</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
          {GROUPS.map((g, gi) => (
            <Reveal key={g.label} delay={gi * 0.05}>
              <div className="rounded-3xl border border-[#EAECF2] bg-[#FBFCFE] p-6 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475467]">{g.label}</h3>
                  <span className="text-[12px] font-semibold text-[#98A2B3]">{g.items.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {g.items.map(({ icon: Icon, name }) => (
                    <div key={name} className="flex items-center gap-2.5 rounded-xl bg-white border border-[#EAECF2] px-3 py-2.5">
                      <span className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${g.color}12`, color: g.color }}><Icon className="h-4 w-4" /></span>
                      <span className="text-[12.5px] font-semibold text-[#344054] truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
