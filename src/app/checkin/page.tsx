"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import { ArrowRight, Clock, ShieldCheck, Sparkles, ScanLine, Camera } from "lucide-react"
import Image from "next/image"
import { QRCodeSVG } from "qrcode.react"
import { PHOTOS } from "@/lib/photos"

const stepKeys = ['stepScan', 'stepDetails', 'stepToken', 'stepTrack'] as const
const trustKeys = ['trustNabh', 'trustAbdm', 'trustDpdp'] as const

export default function CheckinPage() {
  const router = useRouter()
  const t = useTranslations("checkin")
  const [checkInUrl, setCheckInUrl] = useState('')

  useEffect(() => { setCheckInUrl(`${window.location.origin}/checkin/intake`) }, [])

  return (
    <div className="min-h-[100dvh] w-full bg-white grid grid-cols-1 lg:grid-cols-2">

      {/* ════ Left — emotional brand panel (warm photography) ════
          Desktop only. One value line + trust signals. No functional
          controls live here, so contrast risk is contained and the
          right column owns the single task. */}
      <aside className="relative hidden lg:block overflow-hidden">
        <Image src={PHOTOS.doctorPatient.src} alt={PHOTOS.doctorPatient.alt} fill sizes="50vw" className="object-cover" priority />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(185deg, rgba(11,18,32,0.28) 0%, rgba(11,18,32,0.22) 32%, rgba(11,18,32,0.78) 100%)" }}
        />
        <img
          src="/Agentix logo-health.svg"
          alt="Agentix HIMS"
          className="absolute top-10 left-10 xl:top-14 xl:left-14 h-11 w-auto object-contain brightness-0 invert"
        />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <p className="text-white font-bold tracking-tight text-[34px] xl:text-[40px] leading-[1.08] max-w-md whitespace-pre-line">
            {t('leftTitle')}
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75 max-w-md">
            {t('leftSubtitle')}
          </p>
          <ul className="mt-7 flex flex-wrap gap-2">
            {trustKeys.map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[12px] font-semibold text-white/90 backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ════ Right — the single task: check in ════ */}
      <main className="flex flex-col justify-center px-6 sm:px-10 lg:px-14 xl:px-20 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] mx-auto"
        >
          {/* Mobile brand */}
          <div className="flex items-center justify-between mb-8 lg:mb-0">
            <img src="/Agentix logo-health.svg" alt="Agentix HIMS" className="lg:hidden h-10 w-auto object-contain" />
            <div className="ml-auto"><LocaleToggle /></div>
          </div>

          <p className="t-overline text-foreground-lighter">{t('overline')}</p>
          <h1 className="t-h1 text-foreground mt-1.5">{t('title')}</h1>
          <p className="t-body-lg text-foreground-muted mt-2">
            {t('subtitle')}
          </p>

          {/* QR — the focal point */}
          <div className="mt-8 rounded-3xl border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_rgba(16,24,40,0.06)] p-7 flex flex-col items-center">
            <div className="rounded-2xl bg-white p-3 ring-1 ring-border">
              {checkInUrl ? (
                <QRCodeSVG value={checkInUrl} size={188} bgColor="transparent" fgColor="#101828" level="M" aria-label="Scan this code with your phone to begin check-in" />
              ) : (
                <div className="h-[188px] w-[188px] grid place-items-center">
                  <div className="h-9 w-9 rounded-full border-[3px] border-accent-soft border-t-accent animate-spin" role="status" aria-label="Loading QR code" />
                </div>
              )}
            </div>
            <p className="mt-4 inline-flex items-center gap-1.5 t-caption font-semibold text-foreground-muted">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" /> {t('scanHint')}
            </p>
          </div>

          {/* Single primary action */}
          <button
            onClick={() => router.push('/checkin/intake')}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 h-[52px] rounded-2xl font-semibold text-[15px] text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark transition-colors shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ScanLine className="h-5 w-5" aria-hidden="true" /> {t('startButton')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Quiet stepper — secondary, de-emphasised */}
          <ol className="mt-7 flex items-center justify-between" aria-label="How it works">
            {stepKeys.map((k, i) => (
              <li key={k} className="flex items-center gap-2 min-w-0">
                <span className="flex-shrink-0 h-6 w-6 rounded-full grid place-items-center text-[12px] font-bold bg-accent-soft text-accent tabular-nums">{i + 1}</span>
                <span className="t-caption font-semibold text-foreground-muted truncate">{t(k)}</span>
                {i < stepKeys.length - 1 && <span className="hidden sm:block w-4 h-px bg-border flex-shrink-0" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          {/* Quiet trust footer */}
          <div className="mt-7 pt-5 border-t border-border flex items-center gap-5 text-foreground-lighter">
            <span className="inline-flex items-center gap-1.5 t-caption font-semibold"><Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> {t('footerTriage')}</span>
            <span className="inline-flex items-center gap-1.5 t-caption font-semibold"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t('footerFast')}</span>
            <span className="inline-flex items-center gap-1.5 t-caption font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" /> {t('footerSecure')}</span>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
