"use client"

import { Heart, ShieldCheck, CheckCircle, Zap, ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { Reveal } from "./Reveal"
import Link from "next/link"

const STEPS = [
  {
    n: "01",
    title: "Patient selects Govt Scheme at kiosk",
    body: "At the self-check-in kiosk, the patient taps 'Govt Scheme' on the payment screen — no staff intervention needed.",
  },
  {
    n: "02",
    title: "One ID is all it takes",
    body: "Enter ABHA ID or Ayushman Card / Family ID — not both. Verification runs against NHA in under a minute.",
  },
  {
    n: "03",
    title: "Eligibility confirmed, pre-auth generated",
    body: "Scheme name, coverage cap, and pre-auth reference number appear instantly. Submitted to NHA automatically.",
  },
  {
    n: "04",
    title: "Cashless from first step to discharge",
    body: "The patient proceeds without paying. Billing, admission, and discharge screens all reflect the scheme — zero re-entry.",
  },
]

const STATS = [
  { value: "₹5,00,000", label: "Family coverage / year under AB-PMJAY & CMHIS-UP" },
  { value: "< 60 s", label: "Eligibility check at the check-in kiosk" },
  { value: "2 schemes", label: "AB-PMJAY + CMHIS-UP supported out of the box" },
  { value: "Zero", label: "Manual NHA data entry required from your staff" },
]

export function AyushmanSection() {
  const t = useTranslations("landing.ayushman")
  return (
    <section
      id="ayushman"
      className="scroll-mt-20 py-20 lg:py-28 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg,#F0FDF9 0%,#FFFFFF 45%,#F6F9FC 100%)" }}
    >
      {/* Decorative blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-[520px] w-[520px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle,#16A34A 0%,transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full opacity-[0.06]"
        style={{ background: "radial-gradient(circle,var(--color-primary) 0%,transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-5 lg:px-10">
        {/* Header */}
        <Reveal className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-green-700">
              {t("eyebrow")}
            </p>
          </div>
          <h2 className="text-[30px] lg:text-[38px] font-bold text-[#101828] tracking-tight mt-3 leading-tight">
            {t("titleLine1")}<br className="hidden lg:block" /> {t("titleLine2")}
          </h2>
          <p className="text-[15.5px] text-[#475467] mt-3 leading-relaxed">
            {t("subtitle")}
          </p>
        </Reveal>

        {/* Cards + steps grid */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left: card mockups */}
          <div className="space-y-4">
            <Reveal>
              {/* ABHA card */}
              <div
                className="relative rounded-3xl overflow-hidden p-7 shadow-[0_8px_32px_rgba(238,107,38,0.18)]"
                style={{ background: "linear-gradient(135deg,#C2481A 0%,var(--color-primary) 45%,var(--color-primary) 100%)" }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundImage: "radial-gradient(ellipse at 90% 10%,rgba(255,255,255,0.12) 0%,transparent 55%)" }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Ministry of Health &amp; Family Welfare</p>
                      <p className="text-[18px] font-bold text-white mt-0.5">Ayushman Bharat Health Account</p>
                    </div>
                    <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                      <Heart className="h-5.5 w-5.5 text-white" style={{ width: "22px", height: "22px" }} />
                    </div>
                  </div>
                  <div className="mt-7">
                    <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">ABHA Number</p>
                    <p
                      className="text-[23px] font-mono font-bold text-white tracking-[0.1em] mt-1"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      14 · XXXX · XXXX · XXXX
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary-light flex-shrink-0" />
                      <p className="text-[12px] text-primary-light font-semibold">Digital health identity · ABDM registered</p>
                    </div>
                    <Zap className="h-4 w-4 text-white/30" />
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              {/* Ayushman Bharat card */}
              <div
                className="relative rounded-3xl overflow-hidden p-7 shadow-[0_8px_32px_rgba(22,101,52,0.20)]"
                style={{ background: "linear-gradient(135deg,#14532D 0%,#166534 50%,#16A34A 100%)" }}
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ backgroundImage: "radial-gradient(ellipse at 15% 85%,rgba(255,255,255,0.10) 0%,transparent 55%)" }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Pradhan Mantri Jan Arogya Yojana</p>
                      <p className="text-[18px] font-bold text-white mt-0.5">Ayushman Bharat Card</p>
                    </div>
                    <div className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">Coverage</p>
                      <p className="text-[28px] font-bold text-white leading-none mt-1">₹5 L</p>
                      <p className="text-[11px] text-white/55 mt-0.5">per family · per year</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold">Accepted schemes</p>
                      <div className="mt-2 space-y-1">
                        <span className="block text-[12px] font-bold text-white">AB-PMJAY (National)</span>
                        <span className="block text-[12px] font-bold text-green-200">CMHIS-UP (State)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-300 flex-shrink-0" />
                    <p className="text-[12px] text-green-200 font-semibold">Accepted at check-in · pre-auth auto-submitted to NHA</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: steps */}
          <Reveal delay={0.1}>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)] mb-6">How it works</p>
            <div className="space-y-0">
              {STEPS.map((s, i) => (
                <div key={s.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-9 w-9 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-black text-[var(--color-accent)]">{s.n}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-px flex-1 min-h-[28px] bg-gradient-to-b from-[var(--color-primary)]/25 to-[var(--color-primary)]/05 mt-1.5 mb-1.5" />
                    )}
                  </div>
                  <div className={i < STEPS.length - 1 ? "pb-6" : ""}>
                    <p className="text-[15px] font-bold text-[#101828] mt-1">{s.title}</p>
                    <p className="text-[13.5px] text-[#475467] mt-1 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA hint */}
            <Link
              href="/abha"
              className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] group hover:underline cursor-pointer"
            >
              <span>Try the ABDM Sandbox &amp; Consent flow</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <br />
          </Reveal>
        </div>

        {/* Stats row */}
        <Reveal delay={0.08}>
          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#EAECF2] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <p className="text-[24px] lg:text-[28px] font-bold tracking-tight text-[var(--color-accent)]">{s.value}</p>
                <p className="text-[12.5px] text-[#475467] mt-1.5 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
