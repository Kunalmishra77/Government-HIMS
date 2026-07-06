"use client"

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { Sparkles, ArrowRight, ChevronDown, ShieldCheck, Cpu, Building2, Network } from "lucide-react"
import { useRef } from "react"
import { useTranslations } from "next-intl"
import { HeroSignIn } from "./HeroSignIn"

const scrollTo = (id: string) => document.querySelector(id)?.scrollIntoView({ behavior: "smooth" })

const PILLARS = [
  { icon: Cpu, key: "pillarAiNative" },
  { icon: Building2, key: "pillarEnterprise" },
  { icon: Network, key: "pillarUnified" },
] as const

export function LandingHero() {
  const t = useTranslations("landing")
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const glowY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120])

  return (
    <section ref={ref} id="home" className="relative overflow-hidden scroll-mt-16">
      {/* soft light glow / grid backdrop */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <motion.div style={{ y: glowY }} className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full">
          <div className="w-full h-full" style={{ background: "radial-gradient(closest-side, rgba(13,32,50,0.06), transparent)" }} />
        </motion.div>
        <div className="absolute top-40 -right-24 w-[360px] h-[360px] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(238,107,38,0.06), transparent)" }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)", backgroundSize: "44px 44px", maskImage: "radial-gradient(closest-side at 50% 30%, black, transparent)" }} />
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-10 pt-14 lg:pt-20 pb-16 grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] gap-10 lg:gap-12 items-center">
        {/* Copy */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-accent)] bg-[var(--color-primary)]/[0.07] border border-[var(--color-primary)]/15">
            <Sparkles className="h-3.5 w-3.5" /> {t("hero.badge")}
          </span>
          <h1 className="text-[40px] sm:text-[52px] lg:text-[58px] font-bold leading-[1.05] tracking-tight text-[#0B1220] mt-5">
            {t("hero.titleLine1")}<br />
            <span className="relative whitespace-nowrap">{t("hero.titleEmphasis")}
              <span className="absolute left-0 -bottom-1 h-[6px] w-full rounded-full" style={{ background: "linear-gradient(90deg,#EE6B26,#C2481A)" }} /></span>
          </h1>
          <p className="text-[16px] lg:text-[17.5px] leading-relaxed text-[#475467] mt-5 max-w-xl">
            {t("hero.subtitle")}
          </p>

          {/* three core pillars */}
          <div className="flex flex-wrap items-center gap-2 mt-6">
            {PILLARS.map(({ icon: Icon, key }) => (
              <span key={key} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-[#EAECF2] text-[12.5px] font-semibold text-[#344054]">
                <Icon className="h-3.5 w-3.5 text-[var(--color-accent)]" />{t(`hero.${key}`)}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-7">
            <button onClick={() => scrollTo("#launcher")}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer shadow-[0_8px_24px_rgba(238,107,38,0.18)]">
              {t("cta.launchConsole")} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => scrollTo("#product")}
              className="inline-flex items-center gap-2 h-12 px-5 rounded-xl text-[15px] font-semibold text-[#344054] bg-white border border-[#EAECF2] hover:border-[#D0D5DD] transition-colors cursor-pointer">
              {t("hero.ctaSecondary")} <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-7 text-[12.5px] font-semibold text-[#667085]">
            {["NABH-ready", "ABDM / DISHA", "ISO 27001", "HL7 / FHIR"].map(t => (
              <span key={t} className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent)]" />{t}</span>
            ))}
          </div>
        </motion.div>

        {/* Sign-in */}
        <div className="space-y-5">
          <HeroSignIn />
        </div>
      </div>
    </section>
  )
}
