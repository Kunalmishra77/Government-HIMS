"use client"

import { ArrowRight, QrCode } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Reveal } from "./Reveal"
import { PHOTOS } from "@/lib/photos"

const scrollTo = (id: string) => document.querySelector(id)?.scrollIntoView({ behavior: "smooth" })

export function FinalCta() {
  const router = useRouter()
  const t = useTranslations("landing")
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] px-8 lg:px-16 py-14 lg:py-20 text-center">
            {/* Human-centred photography, tinted by a deep teal overlay for AA-contrast text. */}
            <Image
              src={PHOTOS.careTeam.src}
              alt={PHOTOS.careTeam.alt}
              fill
              sizes="100vw"
              className="object-cover"
              priority={false}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(150deg,rgba(6,49,59,0.93) 0%,rgba(12,83,102,0.88) 55%,rgba(5,42,51,0.95) 100%)" }} />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
              style={{ background: "radial-gradient(closest-side, rgba(238,107,38,0.28), transparent)" }} />
            <div className="relative text-center">
              <h2 className="text-[30px] lg:text-[44px] font-bold tracking-tight leading-[1.1]" style={{ color: "#FFFFFF" }}>
                {t("finalCta.title")}
              </h2>
              <p className="text-[15.5px] text-white/60 mt-4 max-w-xl mx-auto">
                {t("finalCta.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => scrollTo("#launcher")}
                  className="inline-flex items-center gap-2 h-12 px-7 rounded-xl text-[15px] font-semibold text-[#0B1A36] bg-white hover:bg-white/90 transition-colors cursor-pointer">
                  {t("cta.launchConsole")} <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => router.push("/checkin")}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-[15px] font-semibold text-white bg-white/10 border border-white/15 hover:bg-white/15 transition-colors cursor-pointer">
                  <QrCode className="h-4 w-4" /> {t("cta.patientCheckIn")}
                </button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
