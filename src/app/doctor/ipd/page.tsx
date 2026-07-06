"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { AnimatePresence } from "framer-motion"
import { HeartPulse, Stethoscope, AlarmClock, FileSignature, CheckCircle, Clock, Send } from "lucide-react"
import { useInpatientStore, nextRound, isRoundDue, type Inpatient, type Condition } from "@/store/useInpatientStore"
import { useConsentStore } from "@/store/useConsentStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { ipdInsights } from "@/lib/earlyWarning"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { InpatientRow } from "@/components/doctor/ipd/InpatientRow"
import { QuickPeekDrawer } from "@/components/doctor/ipd/QuickPeekDrawer"
import { IpdActionModal, type IpdModalKind } from "@/components/doctor/ipd/ipdModals"
import { type IpdAction } from "@/components/doctor/ipd/ActionsMenu"
import { RoundModal } from "@/components/doctor/ipd/panels"
import { ClientOnly } from "@/components/ClientOnly"
import { CompactHeader } from "@/components/ui/CompactHeader"
import { CompactKPI, CompactKPIStrip } from "@/components/ui/CompactKPI"
import { EarlyWarningBanner } from "@/components/clinical/EarlyWarningBanner"
import { VoiceScribeButton } from "@/components/clinical/VoiceScribeButton"
import { CareTeamPresenceCard } from "@/components/clinical/CareTeamPresenceCard"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { ConsentRequestModal } from "@/components/ipd/ConsentRequestModal"
import { useAuthStore } from "@/store/useAuthStore"

// ── Consent status badge ──────────────────────────────────────────────────────
function ConsentStatusBadge({ status }: { status: string }) {
  const t = useTranslations('doctor')
  if (status === 'signed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <CheckCircle className="h-2.5 w-2.5" /> {t('ipd.consentSigned')}
    </span>
  )
  if (status === 'viewed' || status === 'sent') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">
      <Clock className="h-2.5 w-2.5" /> {status === 'viewed' ? t('ipd.linkOpened') : t('ipd.linkSent')}
    </span>
  )
  if (status === 'expired') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <Clock className="h-2.5 w-2.5" /> {t('ipd.linkExpired')}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <FileSignature className="h-2.5 w-2.5" /> {t('ipd.awaitingConsent')}
    </span>
  )
}

const CONDITION_TINT: Record<Condition, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200', Serious: 'bg-primary-soft text-accent border-primary/20',
  Stable: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]', Improving: 'bg-green-50 text-green-700 border-green-200',
  'Discharge-ready': 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
}
type DueLabel =
  | { key: 'noRoundScheduled'; due: false }
  | { key: 'roundDueNow'; due: true }
  | { key: 'roundDueAgo'; hours: number; due: true }
  | { key: 'nextRoundHrs'; hours: number; mins: number; due: false }
  | { key: 'nextRoundMins'; mins: number; due: false }
function dueLabel(ip: Inpatient): DueLabel {
  const n = nextRound(ip)
  if (!n) return { key: 'noRoundScheduled', due: false }
  const mins = Math.round((new Date(n.scheduledAt).getTime() - Date.now()) / 60000)
  if (mins <= 0) return mins < -60 ? { key: 'roundDueAgo', hours: Math.round(-mins / 60), due: true } : { key: 'roundDueNow', due: true }
  return mins >= 60 ? { key: 'nextRoundHrs', hours: Math.floor(mins / 60), mins: mins % 60, due: false } : { key: 'nextRoundMins', mins, due: false }
}

export default function DoctorIpd() {
  const t = useTranslations('doctor')
  const dueText = (ip: Inpatient): string => {
    const d = dueLabel(ip)
    if (d.key === 'roundDueAgo') return t('ipd.roundDueAgo', { hours: d.hours })
    if (d.key === 'nextRoundHrs') return t('ipd.nextRoundHrs', { hours: d.hours, mins: d.mins })
    if (d.key === 'nextRoundMins') return t('ipd.nextRoundMins', { mins: d.mins })
    return t(`ipd.${d.key}`)
  }
  const router = useRouter()
  const inpatients = useInpatientStore(s => s.inpatients)
  const initiateDischarge = useInpatientStore(s => s.initiateDischarge)
  const consentRecords    = useConsentStore(s => s.records)
  const expireStale       = useConsentStore(s => s.expireStale)
  const currentUser       = useAuthStore(s => s.currentUser)

  const [roundFor, setRoundFor] = useState<Inpatient | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ kind: IpdModalKind; id: string } | null>(null)
  const [consentModal, setConsentModal] = useState<Inpatient | null>(null)

  const byId = (id: string | null | undefined) => inpatients.find(i => i.patientId === id) ?? null
  const peek = byId(peekId)
  const modalPatient = byId(modal?.id)

  const active = inpatients.filter(i => i.stage !== 'discharged')
  const due = active.filter(isRoundDue)

  // Rehydrate consent store + expire stale requests
  useEffect(() => {
    useConsentStore.persist.rehydrate()
    const t = setTimeout(() => expireStale(), 200)
    return () => clearTimeout(t)
  }, [expireStale])

  // Bug C fix — pull in real ipd_stays rows (e.g. a patient admitted today via
  // the real admission flow) that aren't already in the local seed/mock list.
  // Without this, a genuinely-newly-admitted real patient is unreachable from
  // this ward list no matter what — see useInpatientStore.ts's hydrateReal().
  useEffect(() => {
    void useInpatientStore.getState().hydrateReal()
  }, [])

  // Early-warning: push high-risk / overdue-round patients into the inbox (once,
  // after store rehydration; deduped by patient + title so reloads don't pile up).
  useEffect(() => {
    const timer = setTimeout(() => {
      const store = useNotificationStore.getState()
      inpatients.filter(i => i.stage !== 'discharged').forEach(ip => {
        const ins = ipdInsights(ip)
        const overdue = isRoundDue(ip)
        if (ins.risk !== 'high' && !overdue) return
        const title = ins.risk === 'high' ? t('ipd.deteriorationRisk') : t('ipd.roundOverdue')
        if (store.notifications.some(n => n.patientName === ip.name && n.title === title)) return
        store.add({ type: 'system', priority: ins.risk === 'high' ? 'critical' : 'high', title, body: `${ip.name} (${ip.ward} · ${ip.bed}) — ${ins.flag}`, channels: ['in_app'], targetRole: 'doctor', patientName: ip.name })
      })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAction = (id: string, a: IpdAction) => {
    setPeekId(null)
    if (a === 'round') { setRoundFor(byId(id)); return }
    if (a === 'chart') { router.push(`/doctor/ipd/${id}`); return }
    if (a === 'discharge') {
      const ip = byId(id)
      if (ip && !ip.discharge && ip.stage !== 'discharged') {
        initiateDischarge(id)
        // Notify discharge desk so they pick up the case.
        notifyAndAudit({
          to: 'discharge', type: 'discharge_initiated', priority: 'high',
          title: `Discharge initiated · ${ip.name}`,
          body: `${ip.name} (${ip.ward} · ${ip.bed}) — doctor has started discharge. Begin 5-pillar clearance.`,
          patientName: ip.name,
          audit: { action: 'admission_discharge', resource: 'inpatient', resourceId: id, detail: `Doctor initiated discharge for ${ip.name}`, userName: 'Doctor' },
        })
      }
      router.push(`/doctor/ipd/${id}`)
      toast.success('Discharge started · Discharge desk notified')
      return
    }
    setModal({ kind: a as IpdModalKind, id })
  }

  // ── M2: compact KPI tallies (computed from `active`) ──
  const criticalCount = active.filter((ip) => ip.condition === 'Critical').length
  const dischargeReady = active.filter((ip) => ip.condition === 'Discharge-ready').length

  return (
    <div className="pb-6">
      {/* M2 — Compact header: title row, KPI strip, single primary action */}
      <CompactHeader
        title="IPD / Inpatients"
        subtitle={`${active.length} admitted · rounds auto-scheduled by acuity (Critical 4h · Stable 12h)`}
        side={
          <CompactKPIStrip>
            <CompactKPI label="Rounds due"      value={due.length}      tone={due.length > 0 ? 'warn' : 'neutral'} />
            <CompactKPI label="Critical"        value={criticalCount}    tone={criticalCount > 0 ? 'danger' : 'neutral'} />
            <CompactKPI label="Discharge ready" value={dischargeReady}   tone={dischargeReady > 0 ? 'ok' : 'neutral'} />
          </CompactKPIStrip>
        }
      />

      <ClientOnly fallback={<div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-12 flex items-center justify-center"><div className="h-7 w-7 rounded-full border-4 border-primary/20 border-t-primary animate-spin" role="status" aria-label="Loading inpatients" /></div>}>

      {/* M4-W1 — S2: NEWS2 ambient watcher. Renders a banner per inpatient
          whose most-recent vital crosses the NEWS2 threshold. Silent below. */}
      <div className="space-y-2 mb-4">
        {active.map((ip) => {
          const v = (ip.vitals ?? []).slice().sort((a, b) => b.at.localeCompare(a.at))[0]
          if (!v) return null
          return (
            <EarlyWarningBanner
              key={'ew-' + ip.patientId}
              patientId={ip.patientId}
              patientName={ip.name}
              vitals={{ hr: v.hr, rr: v.rr, sbp: v.systolicBP, dbp: v.diastolicBP, temp: v.temp, spo2: v.spo2 }}
              onEscalate={() => router.push(`/doctor/ipd/${ip.patientId}`)}
            />
          )
        })}
      </div>

      {/* M4-W6 — S14: Care-Team Presence + Live Handover. */}
      <div className="mb-4">
        <CareTeamPresenceCard ward="Cardiac Care" department="Cardiology" />
      </div>

      {/* M4-W2 — S5: Voice Scribe quick action. Captures a progress note via
          speech, structures it into SOAP, audited on accept. */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide">Quick note</span>
        <VoiceScribeButton
          surface="ipd_progress"
          patientId={active[0]?.patientId}
          patientName={active[0]?.name}
          context={{ diagnosis: active[0]?.diagnosis, vitals: active[0]?.vitals?.[0] ? `HR ${active[0].vitals[0].hr}, BP ${active[0].vitals[0].systolicBP}/${active[0].vitals[0].diastolicBP}, T ${active[0].vitals[0].temp}` : undefined }}
          onAccept={(soap) => toast.success('Progress note saved to chart', { description: soap.split('\n')[0] })}
        />
        <span className="text-[11px] text-slate-400">Speak naturally — AI structures into SOAP for review</span>
      </div>

      {/* Rounds due */}
      <div className="rounded-2xl bg-amber-50/50 border border-amber-100 p-4 mb-5">
        <h3 className="text-[14px] font-bold text-amber-900 mb-2.5 flex items-center gap-2"><AlarmClock className="h-4.5 w-4.5 text-amber-500" /> Rounds due {due.length > 0 && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">{due.length}</span>}</h3>
        {due.length === 0 ? (
          <p className="text-[13px] text-slate-500 bg-white rounded-xl p-3">No rounds due right now — all caught up.</p>
        ) : (
          <div className="space-y-2">
            {due.map(ip => (
              <div key={ip.patientId} className="flex items-center gap-3 rounded-xl bg-white border border-amber-200 p-3">
                <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", ip.condition === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600')}><HeartPulse className="h-4.5 w-4.5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-bold text-slate-900 truncate">{ip.name} <span className={cn("ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border", CONDITION_TINT[ip.condition])}>{ip.condition}</span></p>
                  <p className="text-[11.5px] text-slate-500 truncate">{ip.ward} · Bed {ip.bed} · {dueText(ip)}</p>
                </div>
                <button onClick={() => setRoundFor(ip)} className="h-9 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-bold flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition">
                  <Stethoscope className="h-3.5 w-3.5" /> Start round
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Consent-pending banner */}
      {(() => {
        const consentPending = active.filter(ip => ip.surgery && !ip.surgery.consentSigned && ip.surgery.status === 'consent_pending')
        if (consentPending.length === 0) return null
        return (
          <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-4 mb-5 space-y-2">
            <h3 className="text-[14px] font-bold text-amber-900 flex items-center gap-2">
              <FileSignature className="h-4 w-4 text-amber-600" />
              Consent Pending
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">{consentPending.length}</span>
            </h3>
            {consentPending.map(ip => {
              const latest = consentRecords
                .filter(r => r.patientId === ip.patientId)
                .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0]
              return (
                <div key={ip.patientId} className="flex items-center gap-3 rounded-xl bg-white border border-amber-200 p-3">
                  <span className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <FileSignature className="h-4 w-4 text-amber-600" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-bold text-slate-900 truncate">
                      {ip.name}
                      <span className="ml-2"><ConsentStatusBadge status={latest?.status ?? 'pending'} /></span>
                    </p>
                    <p className="text-[11.5px] text-slate-500 truncate">{ip.surgery?.procedure} · {ip.ward} · Bed {ip.bed}</p>
                  </div>
                  {latest?.status !== 'signed' && (
                    <button
                      onClick={() => setConsentModal(ip)}
                      className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[12.5px] font-bold flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {latest ? 'Resend' : 'Send Consent'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Inpatient list — one row per patient, actions in the kebab menu */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {['Patient', 'Bed / Ward', 'Condition', 'Stage', 'Next round', 'AI flag', ''].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map(ip => {
                const ins = ipdInsights(ip)
                return <InpatientRow key={ip.patientId} ip={ip} aiFlag={{ text: ins.flag, tone: ins.risk }} onPeek={() => setPeekId(ip.patientId)} onAction={(a) => handleAction(ip.patientId, a)} />
              })}
            </tbody>
          </table>
        </div>
        {active.length === 0 && <p className="text-[13px] text-slate-400 p-8 text-center">No admitted patients.</p>}
      </div>
      </ClientOnly>

      {/* Quick-peek drawer (glance) */}
      <AnimatePresence>
        {peek && <QuickPeekDrawer ip={peek} aiInsight={`${ipdInsights(peek).flag}. ${ipdInsights(peek).actions[0]}`} onClose={() => setPeekId(null)} onRound={() => { setPeekId(null); setRoundFor(peek) }} onOpenChart={() => { setPeekId(null); router.push(`/doctor/ipd/${peek.patientId}`) }} />}
      </AnimatePresence>

      {/* Action modals (add/stop med, order test, refer, ICU, OT, diet) */}
      <AnimatePresence>
        {modal && modalPatient && <IpdActionModal kind={modal.kind} patient={modalPatient} onClose={() => setModal(null)} />}
      </AnimatePresence>

      {/* Round modal */}
      <AnimatePresence>{roundFor && <RoundModal ip={roundFor} onClose={() => setRoundFor(null)} />}</AnimatePresence>

      {/* Consent request modal */}
      {consentModal && (
        <ConsentRequestModal
          patientId={consentModal.patientId}
          patientName={consentModal.name}
          procedureName={consentModal.surgery?.procedure ?? 'Procedure'}
          requestedBy={currentUser?.name ?? consentModal.admittingDoctor}
          onClose={() => setConsentModal(null)}
        />
      )}
    </div>
  )
}
