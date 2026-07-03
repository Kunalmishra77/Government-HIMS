"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { QrCode, ShieldCheck, LogIn } from "lucide-react"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import { cn } from "@/lib/utils"

const NAV_HEIGHT = 64 // h-16

const LINKS = [
  { key: "home",     href: "#home" },
  { key: "platform", href: "#platform" },
  { key: "product",  href: "#product" },
  { key: "security", href: "#security" },
  { key: "outcomes", href: "#outcomes" },
]

function scrollToSection(href: string) {
  if (href === "#home") {
    window.scrollTo({ top: 0, behavior: "smooth" })
    return
  }
  const el = document.querySelector(href) as HTMLElement | null
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
}

function getActiveHref(): string {
  let active = "#home"
  for (const { href } of LINKS) {
    const el = document.querySelector(href) as HTMLElement | null
    if (!el) continue
    const top = el.getBoundingClientRect().top
    if (top <= NAV_HEIGHT + 16) active = href
  }
  return active
}

export function LandingNav() {
  const router = useRouter()
  const t = useTranslations("landing")
  const [scrolled, setScrolled]     = useState(false)
  const [activeHref, setActiveHref] = useState("#home")

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
      setActiveHref(getActiveHref())
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const handleNav = (href: string) => {
    scrollToSection(href)
    // Optimistically set active; scroll listener will correct if needed
    setActiveHref(href)
  }

  return (
    <header className={cn("sticky top-0 z-50 transition-all duration-200",
      scrolled ? "bg-white/90 backdrop-blur-md border-b border-[#EAECF2] shadow-sm" : "bg-transparent")}>
      <div className="max-w-7xl mx-auto h-16 px-5 lg:px-10 flex items-center justify-between">

        {/* Logo — click scrolls to top */}
        <button onClick={() => handleNav("#home")} className="flex items-center cursor-pointer">
          <img src="/Agentix logo-health.svg" alt="Agentix HIMS" className="h-9 w-auto object-contain" />
        </button>

        {/* Nav links */}
        <nav className="hidden lg:flex items-center gap-1">
          {LINKS.map(({ key, href }) => (
            <button
              key={href}
              onClick={() => handleNav(href)}
              className={cn(
                "px-3.5 py-2 rounded-lg text-[13.5px] font-semibold transition-all duration-150 cursor-pointer select-none",
                activeHref === href
                  ? "text-[var(--color-accent)] bg-[var(--color-primary)]/[0.08]"
                  : "text-[#475467] hover:text-[#101828] hover:bg-[#F8FAFC]",
              )}
            >
              {t(`nav.${key}`)}
            </button>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/abha")}
            className="hidden md:inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-semibold text-[#344054] bg-white border border-[#EAECF2] hover:border-[#D0D5DD] transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4 text-green-600" /> {t("cta.abdmSandbox")}
          </button>
          <button
            onClick={() => router.push("/checkin")}
            className="hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-semibold text-[#344054] bg-white border border-[#EAECF2] hover:border-[#D0D5DD] transition-colors cursor-pointer"
          >
            <QrCode className="h-4 w-4 text-[var(--color-accent)]" /> {t("cta.patientCheckIn")}
          </button>
          <button
            onClick={() => scrollToSection("#signin")}
            className="hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-semibold text-[#344054] bg-white border border-[#EAECF2] hover:border-[#D0D5DD] transition-colors cursor-pointer"
          >
            <LogIn className="h-4 w-4 text-[var(--color-accent)]" /> {t("cta.login")}
          </button>
          <button
            onClick={() => scrollToSection("#launcher")}
            className="inline-flex items-center h-9 px-4 rounded-full text-[13px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer"
          >
            {t("cta.launchConsole")}
          </button>
          <LocaleToggle />
        </div>
      </div>
    </header>
  )
}
