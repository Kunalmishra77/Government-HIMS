"use client"

import { ShieldCheck, Activity, Lock, FileCheck2, Network } from "lucide-react"
import { useTranslations } from "next-intl"
import { Reveal } from "./Reveal"

const STANDARDS = [
  { icon: ShieldCheck, label: "NABH-ready" },
  { icon: FileCheck2, label: "ABDM / DISHA" },
  { icon: Lock, label: "ISO 27001" },
  { icon: Network, label: "HL7 / FHIR" },
  { icon: Activity, label: "DPDP compliant" },
]

export function TrustStrip() {
  const t = useTranslations("landing.trustStrip")
  return (
    <section className="border-y border-[#EAECF2] bg-white">
      <div className="max-w-7xl mx-auto px-5 lg:px-10 py-8">
        <Reveal>
          <p className="text-center text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#98A2B3]">
            {t("tagline")}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {STANDARDS.map(({ icon: Icon, label }) => (
              <div key={label} className="inline-flex items-center gap-2 text-[#475467]">
                <Icon className="h-4 w-4 text-[var(--color-accent)]" />
                <span className="text-[14px] font-bold tracking-tight">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
