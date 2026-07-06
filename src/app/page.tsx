"use client"

import { LandingNav } from "@/components/landing/LandingNav"
import { LandingHero } from "@/components/landing/LandingHero"
import { PortalLauncher } from "@/components/landing/PortalLauncher"
import { TrustStrip } from "@/components/landing/TrustStrip"
import { ModulesBento } from "@/components/landing/ModulesBento"
import { AyushmanSection } from "@/components/landing/AyushmanSection"
import { ProductShowcase } from "@/components/landing/ProductShowcase"
import { TrustGovernanceSection } from "@/components/landing/TrustGovernanceSection"
import { OutcomesMetrics } from "@/components/landing/OutcomesMetrics"
import { FinalCta } from "@/components/landing/FinalCta"
import { LandingFooter } from "@/components/landing/LandingFooter"

// Agentix HIMS — world-class enterprise healthcare landing.
// Premium AI-native story: Hero (live command center) → Launch Console →
// Modules → Govt schemes → live Product Showcase → Trust →
// Outcomes → CTA. The role-selection gateway lives in <PortalLauncher/>.
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <LandingNav />
      <main>
        <LandingHero />
        <PortalLauncher />
        <TrustStrip />
        <ModulesBento />
        <AyushmanSection />
        <ProductShowcase />
        <TrustGovernanceSection />
        <OutcomesMetrics />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
