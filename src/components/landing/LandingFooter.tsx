"use client"

import { useTranslations } from "next-intl"

const COLUMNS = [
  { titleKey: "colPlatform", linkKeys: ["linkClinical", "linkOperations", "linkFinance", "linkSupport"] },
  { titleKey: "colIntelligence", linkKeys: ["linkAiRadiology", "linkCriticalSla", "linkPredictiveOps", "linkOpsAssistant"] },
  { titleKey: "colTrust", linkKeys: ["linkSecurity", "linkNabh", "linkDisha", "linkAiGovernance"] },
] as const

export function LandingFooter() {
  const t = useTranslations("landing.footer")
  return (
    <footer className="bg-white border-t border-[#EAECF2]">
      <div className="max-w-7xl mx-auto px-5 lg:px-10 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
          <div>
            <div className="flex items-center">
              <img src="/Agentix logo-health.svg" alt="Agentix HIMS" className="h-10 w-auto object-contain" />
            </div>
            <p className="text-[13px] text-[#667085] mt-4 max-w-xs leading-relaxed">
              {t("tagline")}
            </p>
          </div>
          {COLUMNS.map(col => (
            <div key={col.titleKey}>
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">{t(col.titleKey)}</p>
              <ul className="mt-3 space-y-2">
                {col.linkKeys.map(k => (
                  <li key={k}><span className="text-[13px] text-[#475467] hover:text-[#101828] transition-colors cursor-pointer">{t(k)}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-[#EAECF2] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[#98A2B3]">{t("copyright")}</p>
          <div className="flex items-center gap-4 text-[12px] font-medium text-[#667085]">
            <span className="cursor-pointer hover:text-[#101828]">{t("privacy")}</span>
            <span className="cursor-pointer hover:text-[#101828]">{t("terms")}</span>
            <span className="cursor-pointer hover:text-[#101828]">{t("dpdp")}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
