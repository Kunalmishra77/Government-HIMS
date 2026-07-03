"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientLiveStore, stagesFor } from "@/store/usePatientLiveStore"
import { usePatientOrdersStore } from "@/store/usePatientOrdersStore"
import { PatientProfileCard } from "@/components/patient/dashboard/PatientProfileCard"
import { AiHealthSummaryCard } from "@/components/patient/dashboard/AiHealthSummaryCard"
import { HealthTrendsCard } from "@/components/patient/dashboard/HealthTrendsCard"
import { LiveVisitStatusCard } from "@/components/patient/dashboard/LiveVisitStatusCard"
import { LiveActivityTimeline } from "@/components/patient/dashboard/LiveActivityTimeline"
import { FamilyTrackingCard } from "@/components/patient/dashboard/FamilyTrackingCard"
import { FamilyInviteCard } from "@/components/patient/dashboard/FamilyInviteCard"
import { PrescriptionsCard } from "@/components/patient/dashboard/PrescriptionsCard"
import { FinancialSummaryCard } from "@/components/patient/dashboard/FinancialSummaryCard"
import { DiagnosticsCard } from "@/components/patient/dashboard/DiagnosticsCard"
import { QuickActionsDrawer } from "@/components/patient/dashboard/QuickActionsDrawer"
import { AiCompanionFab } from "@/components/patient/dashboard/AiCompanionFab"
import { DemoControls } from "@/components/patient/dashboard/DemoControls"
import { StatusPill } from "@/components/ui/StatusPill"
import { ArrowRight } from "lucide-react"

export default function PatientDashboard() {
  const t = useTranslations('patient')
  const currentUser = useAuthStore(s => s.currentUser)
  const stage = usePatientLiveStore(s => s.stage)
  const mode = usePatientLiveStore(s => s.mode)
  const prevStage = useRef(stage)

  // Journey advancement is driven by the DemoControls presenter panel
  // (auto-plays by default; pause to narrate and step through stages).

  // Notify when called to a station — and when the doctor's orders arrive.
  useEffect(() => {
    if (stage !== prevStage.current) {
      const meta = stagesFor(mode).find(s => s.key === stage)
      if (meta?.isCall) toast.success(t('dashboard.toastYourTurn', { stage: meta.label }), { description: meta.action })
      else if (stage === 'done') toast.success(mode === 'video' ? t('dashboard.toastConsultComplete') : t('dashboard.toastVisitComplete'), { description: t('dashboard.toastSummaryReady') })

      // Doctor's orders land in real time the moment the prescription is issued.
      if (stage === 'pharmacy' || stage === 'prescription') {
        const orders = usePatientOrdersStore.getState()
        if (!orders.received) {
          orders.receiveOrders()
          const tests = orders.items.filter(i => i.kind === 'test').length
          const meds = orders.items.filter(i => i.kind === 'medicine').length
          toast.message(t('dashboard.toastNewOrders', { doctor: orders.doctor }), {
            description: t('dashboard.toastNewOrdersBody', { tests, meds }),
          })
        }
      }
      prevStage.current = stage
    }
  }, [stage, mode])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening')
  const first = (currentUser?.name ?? 'there').split(' ')[0]

  // Patient-centred: answer "what's happening to me / what's next" above the fold.
  const stageMeta = stagesFor(mode).find(s => s.key === stage)
  const isDone = stage === 'done'

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-overline text-foreground-lighter">{greeting}</p>
          <h2 className="t-h1 text-foreground mt-0.5">{t('dashboard.heading', { name: first })}</h2>

          {/* Reassurance strip — where you are now + the one thing to do next. */}
          {stageMeta && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StatusPill
                status={isDone ? 'done' : stageMeta.isCall ? 'urgent' : 'info'}
                label={isDone ? t('dashboard.visitComplete') : t('dashboard.now', { stage: stageMeta.label })}
                size="md"
              />
              {!isDone && stageMeta.action && (
                <span className="inline-flex items-center gap-1.5 t-body text-foreground-muted">
                  <ArrowRight className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  {stageMeta.action}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <QuickActionsDrawer />
        </div>
      </div>

      {/* Hierarchy — most critical info first:
          Profile → Your health → Live status → Prescriptions + Diagnostics,
          then secondary: Trends + Financial → Family, with the activity log last. */}
      <div className="space-y-5">
        {/* 1 — Patient profile (primary identity card). */}
        <PatientProfileCard />

        {/* 2 — "Your health" AI insight band. */}
        <AiHealthSummaryCard />

        {/* 3 — Live visit status. */}
        <LiveVisitStatusCard />

        {/* 4 & 5 — Prescriptions & medicines + Diagnostics & reports (top priority pair, equal height). */}
        <div className="grid gap-5 lg:grid-cols-2 items-stretch">
          <PrescriptionsCard />
          <DiagnosticsCard />
        </div>

        {/* 6 — Your trends + Financial summary (secondary). */}
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <HealthTrendsCard />
          <FinancialSummaryCard />
        </div>

        {/* 7 — Family tracking (secondary). */}
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <FamilyTrackingCard />
          <FamilyInviteCard />
        </div>

        {/* 8 — Live activity timeline (historical log, lowest priority). */}
        <LiveActivityTimeline />
      </div>

      {/* Quick Actions live in the header drawer; AI companion is a floating assistant. */}
      <AiCompanionFab />
      <DemoControls />
    </div>
  )
}
