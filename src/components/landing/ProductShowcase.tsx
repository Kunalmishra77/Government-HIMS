"use client"

import React from "react"
import {
  Shield, Stethoscope, Users, IndianRupee, BedDouble, Boxes, ArrowRight,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useLiveHospitalStats } from "./useLiveHospitalStats"
import { Reveal } from "./Reveal"

/* ── small building blocks ────────────────────────────────────────── */
function Tile({ icon: Icon, label, value, accent = "var(--color-primary)" }: { icon: React.ElementType; label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#EAECF2] bg-white p-3.5">
      <span className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}14`, color: accent }}><Icon className="h-4 w-4" /></span>
      <p className="text-[22px] font-bold text-[#101828] mt-2 leading-none tabular-nums">{value}</p>
      <p className="text-[11px] font-medium text-[#667085] mt-1">{label}</p>
    </div>
  )
}

/* ── frame ────────────────────────────────────────────────────────── */
function BrowserFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#EAECF2] bg-[#F8FAFC] shadow-[0_24px_60px_rgba(16,24,40,0.10)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAECF2] bg-white">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </span>
        <span className="ml-3 text-[11.5px] font-semibold text-[#667085]">{title}</span>
      </div>
      <div className="p-4 lg:p-5">{children}</div>
    </div>
  )
}

/* ── section ──────────────────────────────────────────────────────── */
export function ProductShowcase() {
  const t = useTranslations("landing.product")
  const s = useLiveHospitalStats()

  return (
    <section id="product" className="scroll-mt-20 py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <Reveal className="max-w-2xl mx-auto text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">{t("eyebrow")}</p>
          <h2 className="text-[30px] lg:text-[38px] font-bold text-[#101828] tracking-tight mt-2">{t("title")}</h2>
          <p className="text-[15.5px] text-[#475467] mt-3">{t("subtitle")}</p>
        </Reveal>

        {/* Dashboard */}
        <Reveal className="mt-8">
          <div className="relative">
            {/* soft glow */}
            <div className="absolute -inset-4 -z-10 rounded-[2rem] opacity-60" style={{ background: "radial-gradient(closest-side, rgba(238,107,38,0.06), transparent)" }} />
            <BrowserFrame title="agentix · command dashboard">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Tile icon={Users} label="Live patients" value={s.livePatients} />
                <Tile icon={IndianRupee} label="Revenue today" value={`₹${(s.revenueToday / 100000).toFixed(2)}L`} accent="var(--color-success)" />
                <Tile icon={Stethoscope} label="Active staff" value={s.activeStaff} accent="var(--color-info)" />
                <Tile icon={Boxes} label="Inventory value" value={`₹${(s.inventoryValue / 10000000).toFixed(2)} Cr`} accent="var(--color-primary-light)" />
                <Tile icon={BedDouble} label="Beds available" value={s.bedsAvailable} accent="var(--color-primary-light)" />
                <Tile icon={Shield} label="ABHA IDs created" value={s.abhaCreated} accent="var(--color-info)" />
              </div>
            </BrowserFrame>
          </div>
        </Reveal>

        <Reveal className="mt-6">
          <button onClick={() => document.querySelector("#launcher")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl text-[14px] font-semibold text-[var(--color-accent)] bg-[var(--color-primary)]/[0.07] border border-[var(--color-primary)]/15 hover:bg-[var(--color-primary)]/[0.12] transition-colors cursor-pointer">
            Explore any console live <ArrowRight className="h-4 w-4" />
          </button>
        </Reveal>
      </div>
    </section>
  )
}
