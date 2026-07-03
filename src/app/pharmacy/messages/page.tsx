"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { StaffMessages } from "@/components/messaging/StaffMessages"
import { useTranslations } from "next-intl"

export default function PharmacyMessages() {
  const t = useTranslations("pharmacy")
  const meId = useAuthStore(s => s.currentUser?.id ?? "PH-301")
  return (
    <div className="pb-6 h-full flex flex-col min-h-0">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t("messages.title")}</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">{t("messages.subtitle")}</p>
      </div>
      <div className="flex-1 min-h-0"><StaffMessages meId={meId} /></div>
    </div>
  )
}
