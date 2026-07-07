"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Activity, ArrowRight, ShieldCheck, Clock, HeartPulse } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { registerPatientFromIntake } from "@/lib/intake/register"
import { NeonBadge } from "@/components/ui/neon-badge"
import {
  initialForm, visibleSteps, canContinue, triageScore,
  SYMPTOMS, type IntakeForm, type StepId,
} from "@/lib/intake/data"
import { IntakeShell } from "./IntakeShell"
import { IntakeAppShell } from "./IntakeAppShell"
import { ChoiceStep } from "./ChoiceStep"
import { AadhaarScanStep } from "./CaptureSteps"
import { VoiceAssistantFlow } from "./VoiceAssistantFlow"
import { AboutStep, ReportsStep, FamilyStep } from "./FieldSteps"
import { SlotStep, PaymentStep } from "./ConsultSteps"
import { ReviewStep, SuccessStep } from "./ReviewSuccess"
import { DurationStep } from "./DurationStep"
import { DepartmentStep } from "./DepartmentStep"

export function IntakeFlow() {
  const t = useTranslations("intake")
  const { patients, addPatient, generateFamilyToken } = usePatientStore()

  const [form, setForm] = useState<IntakeForm>(initialForm)
  const [current, setCurrent] = useState<StepId>('welcome')
  const [history, setHistory] = useState<StepId[]>([])
  const [returnToReview, setReturnToReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<number | null>(null)
  const [familyToken, setFamilyToken] = useState<string | null>(null)
  const [estWait, setEstWait] = useState(0)
  const [uhid, setUhid] = useState<string | null>(null)

  const update = (patch: Partial<IntakeForm>) => setForm(f => {
    const clean: Partial<IntakeForm> = {}
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v
    return { ...f, ...clean }
  })

  const visible = visibleSteps(form)
  const progressSteps: StepId[] = visible.filter(id => id !== 'welcome' && id !== 'success')
  const isSubmitStep = current === 'payment'

  const milestoneFor = (id: StepId): string => {
    switch (id) {
      case 'aadhaar': case 'voice': return t('milestone.identity')
      case 'about': return t('milestone.aboutYou')
      case 'symptoms': case 'symptomDuration': case 'department': return t('milestone.symptoms')
      case 'slot': case 'reports': case 'family': return t('milestone.appointment')
      case 'review': case 'payment': return t('milestone.confirm')
      default: return ''
    }
  }

  const stepSummary = (id: StepId): string => {
    switch (id) {
      case 'aadhaar': return form.abhaId ? `ABHA ${form.abhaId}` : 'Aadhaar scanned'
      case 'voice': return 'Described symptoms'
      case 'about': return [form.name, form.age && `${form.age}y`, form.gender].filter(Boolean).join(' · ')
      case 'symptoms': return form.symptoms.join(', ') || '—'
      case 'symptomDuration': { const ds = Object.values(form.symptomDurations); return ds.length ? ds.join(', ') : '—' }
      case 'department': return form.departments.join(', ') || '—'
      case 'slot': return [form.slotDate, form.slotTime, form.slotDoctor].filter(Boolean).join(' · ')
      case 'reports': return form.hasReports ? 'Bringing old reports' : 'No old reports'
      case 'family': return form.familyPhone ? `Live status → ${form.familyPhone}` : 'Not sharing'
      case 'review': return 'Details reviewed'
      case 'payment':
        return form.payer === 'self' ? `Self-pay${form.payMethod ? ' · ' + form.payMethod : ''}`
          : form.payer === 'cashless' ? `Insurance${form.insurer ? ' · ' + form.insurer : ''}`
          : form.payer === 'govtScheme' ? (form.schemeName || 'Govt scheme') : '—'
      default: return ''
    }
  }

  // Completed progress steps, in the order they were visited.
  const doneSteps = history
    .filter((id): id is StepId => id !== 'welcome' && progressSteps.includes(id))
    .map(id => ({ id, title: t(`stepTitle.${id}`), milestone: milestoneFor(id), summary: stepSummary(id) }))

  const jumpToStep = (id: string) => {
    const target = id as StepId
    const idx = history.indexOf(target)
    if (idx === -1) return
    setReturnToReview(false)
    setHistory(history.slice(0, idx))
    setCurrent(target)
  }

  const goNext = () => {
    if (returnToReview) { setReturnToReview(false); setHistory(h => [...h, current]); setCurrent('review'); return }
    const idx = visible.indexOf(current)
    const next = visible[idx + 1]
    if (!next) return
    setHistory(h => [...h, current]); setCurrent(next)
  }

  const goBack = () => {
    if (history.length === 0) return
    setCurrent(history[history.length - 1])
    setHistory(history.slice(0, -1))
    setReturnToReview(false)
  }

  const editFromReview = (id: StepId) => { setReturnToReview(true); setHistory(h => [...h, 'review']); setCurrent(id) }

  const handleSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 1600))
    const res = await registerPatientFromIntake(form, { patients, addPatient, generateFamilyToken })
    setToken(res.token); setFamilyToken(res.familyToken); setEstWait(res.estWait); setUhid(res.uhid ?? null)
    setSubmitting(false); setCurrent('success')
  }

  // ── Main Content Renderer ───────────────────────────────────────────────
  const renderContent = () => {
    if (current === 'welcome') {
      return (
        <div className="flex flex-col flex-1 justify-center px-8 relative h-full">
          {/* Ambient medical gradient */}
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 h-80 w-80 rounded-full opacity-60 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(238,107,38,0.22), transparent 70%)' }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-12 h-80 w-80 rounded-full opacity-50 blur-3xl" style={{ background: 'radial-gradient(circle, rgba(238,107,38,0.12), transparent 70%)' }} />

          <div className="relative z-10 flex flex-col items-center justify-center text-center -mt-12">
            <div className="h-24 w-24 rounded-[32px] flex items-center justify-center shadow-[0_16px_40px_rgba(238,107,38,0.35)]" style={{ background: 'radial-gradient(circle at 32% 28%, #FBD5BC 0%, #F7B98E 40%, #EE6B26 100%)' }}>
              <HeartPulse className="h-11 w-11 text-white" aria-hidden="true" />
            </div>
            <h1 className="text-[32px] font-bold text-slate-900 tracking-tight leading-tight mt-8 whitespace-pre-line">{t('welcome.title')}</h1>
            <p className="text-[16.5px] text-slate-500 mt-4 max-w-[310px] leading-relaxed">{t('welcome.subtitle')}</p>

            <div className="flex items-center gap-2 mt-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(238,107,38,0.08)] px-3 py-1.5 text-[13px] font-semibold text-[#B84A16]"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> {t('welcome.badgePrivate')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-600"><Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t('welcome.badgeTime')}</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 pt-4 bg-gradient-to-t from-[color:var(--color-background)] via-[color:var(--color-background)] to-transparent z-20">
            <div className="shadow-2xl rounded-2xl pointer-events-auto">
              <button
                onClick={goNext}
                className="w-full h-14 rounded-2xl font-semibold text-[17px] text-[#0D2032] bg-[#EE6B26] hover:bg-[#C2481A] transition-all shadow-[0_10px_24px_rgba(238,107,38,0.3)] active:scale-[0.98] flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] focus-visible:ring-offset-2 cursor-pointer"
              >
                {t('welcome.start')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-center text-[13px] text-slate-400 mt-4">{t('welcome.footer')}</p>
          </div>
        </div>
      )
    }

    if (current === 'voice') {
      return <VoiceAssistantFlow form={form} update={update} onExitToForm={(method) => {
        update({ method })
        setHistory(h => [...h, 'voice'])
        setCurrent(method === 'aadhaar' ? 'aadhaar' : 'about')
      }} />
    }

    if (current === 'success') {
      return <SuccessStep form={form} token={token ?? 1} familyToken={familyToken} wait={estWait} uhid={uhid ?? undefined} />
    }

    // ── Step body ───────────────────────────────────────────────────────
    const triage = triageScore(form.symptoms, form.symptomDurations)
    const renderBody = () => {
      switch (current) {
        case 'aadhaar': return <AadhaarScanStep form={form} update={update} />
        case 'about': return <AboutStep form={form} update={update} />
        case 'symptoms': {
          const aiBar = form.symptoms.length > 0 ? (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-[14px] bg-white border border-[rgba(238,107,38,0.15)] shadow-[0_2px_12px_rgba(5,150,105,0.12)]">
              <span className="flex items-center gap-2.5">
                <span className="h-8 w-8 rounded-full bg-[rgba(238,107,38,0.07)] flex items-center justify-center border border-[rgba(238,107,38,0.15)]"><Activity className="h-4 w-4 text-[#B84A16]" aria-hidden="true" /></span>
                <span className="text-[13px] font-bold text-slate-900">{t('symptomsUi.aiAssessment')}</span>
              </span>
              <NeonBadge variant={triage.variant} dot pulse className="px-3 py-1">{t(`triage.${triage.level}`)}</NeonBadge>
            </div>
          ) : null
          // Symptoms drive the AI *recommendations* shown on the Department step,
          // but must NOT pre-select any department — the patient taps to choose.
          return <ChoiceStep fill columns={2} compact options={SYMPTOMS.map(s => ({ value: s, label: t(`symptom.${s}`) }))} value={form.symptoms} onChange={v => update({ symptoms: v })} multi otherEnabled otherPlaceholder={t('symptomsUi.otherPlaceholder')} footer={aiBar} />
        }
        case 'symptomDuration': return <DurationStep symptoms={form.symptoms} durations={form.symptomDurations} onChange={d => update({ symptomDurations: d })} />
        case 'department': return <DepartmentStep form={form} update={update} />
        case 'slot': return <SlotStep form={form} update={update} />
        case 'reports': return <ReportsStep form={form} update={update} />
        case 'family': return <FamilyStep form={form} update={update} />
        case 'review': return <ReviewStep form={form} onEdit={editFromReview} />
        case 'payment': return <PaymentStep form={form} update={update} />
        default: return null
      }
    }

    return (
      <IntakeShell
        doneSteps={doneSteps}
        current={{
          id: current,
          title: t(`stepTitle.${current}`),
          milestone: milestoneFor(current),
          stepNumber: progressSteps.indexOf(current) + 1,
          totalSteps: progressSteps.length,
        }}
        onEditStep={jumpToStep}
        onBack={history.length > 0 ? goBack : undefined}
        ctaLabel={isSubmitStep ? (form.payer === 'cashless' ? t('cta.confirmBooking') : t('cta.payConfirm')) : t('cta.continue')}
        onCta={isSubmitStep ? handleSubmit : goNext}
        ctaDisabled={!canContinue(current, form)}
        ctaLoading={submitting}
      >
        {renderBody()}
      </IntakeShell>
    )
  }

  const isFormStep = !['welcome', 'voice', 'success'].includes(current)
  const stepNumber = isFormStep ? progressSteps.indexOf(current) + 1 : undefined
  const totalSteps = isFormStep ? progressSteps.length : undefined
  const showBack = history.length > 0 && current !== 'success' && current !== 'welcome'
  
  const headerTitle = current === 'welcome' || current === 'success'
    ? <Image src="/Agentix logo-health.svg" alt="Agentix HIMS" width={180} height={36} className="h-9 w-auto" priority />
    : current === 'voice' ? t('shell.headerVoice')
    : t('shell.headerCheckin')

  return (
    <IntakeAppShell
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      onBack={showBack ? goBack : undefined}
      headerTitle={headerTitle}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="h-full w-full flex flex-col flex-1"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </IntakeAppShell>
  )
}

