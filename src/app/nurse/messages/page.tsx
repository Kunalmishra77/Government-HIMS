"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { StaffMessages } from "@/components/messaging/StaffMessages"
import { ClientOnly } from "@/components/ClientOnly"
import { useTranslations } from "next-intl"

export default function NurseMessages() {
  const t = useTranslations('nurse')
  const meId = useAuthStore(s => s.currentUser?.id ?? 'NR-402')
  return (
    <div className="pb-2 h-full flex flex-col min-h-0">
      <p className="t-body text-foreground-lighter mb-4">{t('messages.subtitle')}</p>
      <ClientOnly fallback={<div className="flex-1 flex items-center justify-center"><div className="h-7 w-7 rounded-full border-4 border-primary/20 border-t-primary animate-spin" role="status" aria-label={t('messages.loading')} /></div>}>
        <StaffMessages meId={meId} />
      </ClientOnly>
    </div>
  )
}
