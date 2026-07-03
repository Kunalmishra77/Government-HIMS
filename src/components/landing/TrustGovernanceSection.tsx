"use client"

import { Lock, FileCheck2, ShieldCheck, ScrollText, UserCog, BrainCircuit } from "lucide-react"
import { useTranslations } from "next-intl"
import { Reveal } from "./Reveal"

const PILLARS = [
  { icon: Lock, title: "Security by design", points: ["Role-based access control across 24 roles", "Encryption in transit & at rest", "Session & device governance"] },
  { icon: ScrollText, title: "Complete audit trail", points: ["Every clinical & admin action logged", "Tamper-evident, exportable records", "Who did what, when — provable"] },
  { icon: FileCheck2, title: "Compliance & data protection", points: ["NABH-ready documentation & cockpits", "ABDM / DISHA & DPDP aligned", "Consent + data-subject controls"] },
  { icon: BrainCircuit, title: "Governed AI", points: ["Human-in-the-loop on every suggestion", "Confidence scores + clinical disclaimers", "Model accountability & feedback loop"] },
]

export function TrustGovernanceSection() {
  const t = useTranslations("landing.trust")
  return (
    <section id="security" className="scroll-mt-20 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <Reveal className="max-w-2xl mx-auto text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">{t("eyebrow")}</p>
          <h2 className="text-[30px] lg:text-[38px] font-bold text-[#101828] tracking-tight mt-2">{t("title")}</h2>
          <p className="text-[15.5px] text-[#475467] mt-3">{t("subtitle")}</p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {PILLARS.map(({ icon: Icon, title, points }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="rounded-3xl border border-[#EAECF2] bg-white p-5 h-full">
                <span className="h-11 w-11 rounded-2xl flex items-center justify-center bg-[var(--color-primary)]/[0.10] text-[var(--color-accent)]"><Icon className="h-5 w-5" /></span>
                <h3 className="text-[15.5px] font-bold text-[#101828] mt-3.5">{title}</h3>
                <ul className="mt-2.5 space-y-1.5">
                  {points.map(p => (
                    <li key={p} className="flex items-start gap-2 text-[12.5px] text-[#475467]">
                      <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" /><span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
