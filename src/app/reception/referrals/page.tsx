"use client"

import { useMemo } from "react"
import { Send, CheckCircle2, ArrowRight, Stethoscope, AlertTriangle, Inbox } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/button"
import { useConsultationStore } from "@/store/useConsultationStore"
import { usePatientStore } from "@/store/usePatientStore"
import { firstDoctorOf } from "@/lib/opd"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { cn } from "@/lib/utils"

export default function ReceptionReferralsPage() {
  const t = useTranslations('reception')
  const timeAgo = (iso?: string) => {
    if (!iso) return ""
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return t('referrals.justNow')
    if (mins < 60) return t('referrals.minsAgo', { mins })
    return t('referrals.hoursAgo', { hours: Math.round(mins / 60) })
  }
  const referrals = useConsultationStore((s) => s.referrals)
  const acceptReferral = useConsultationStore((s) => s.acceptReferral)
  const patients = usePatientStore((s) => s.patients)
  const reassignPatient = usePatientStore((s) => s.reassignPatient)
  const updateStatus = usePatientStore((s) => s.updateStatus)

  // Only referrals that carry patient linkage can be routed from this desk.
  const { pending, accepted } = useMemo(() => {
    const linked = referrals.filter((r) => r.patientId)
    return {
      pending: linked.filter((r) => r.status !== "accepted").sort((a, b) => Number(b.urgent) - Number(a.urgent)),
      accepted: linked.filter((r) => r.status === "accepted").sort((a, b) => (b.acceptedAt ?? "").localeCompare(a.acceptedAt ?? "")),
    }
  }, [referrals])

  const onAccept = (referralId: string, patientId: string, patientName: string, specialty: string) => {
    const doctor = firstDoctorOf(specialty)
    reassignPatient(patientId, { department: specialty, doctor })
    updateStatus(patientId, "waiting")
    acceptReferral(referralId)
    notifyAndAudit({
      to: "reception", type: "appointment", priority: "medium",
      title: t('referrals.referralAcceptedTitle', { name: patientName }),
      body: t('referrals.referralAcceptedBody', { name: patientName, specialty, doctor }),
      patientName,
      audit: { action: "reception_registered", resource: "referral", resourceId: patientId, detail: `Referral accepted · ${patientName} → ${specialty}`, userName: "Reception" },
    })
    toast.success(t('referrals.requeuedToast', { name: patientName, specialty }), { description: t('referrals.assignedTo', { doctor }) })
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <PageHeader
        title={t('referrals.title')}
        subtitle={t('referrals.subtitle')}
      />

      {/* Pending */}
      <section className="space-y-2 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Inbox className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="text-sm font-bold text-slate-700">{t('referrals.pending')}</h2>
          <span className="text-[11px] font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.10)] rounded-full px-2 py-0.5">{pending.length}</span>
        </div>

        {pending.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
            <Inbox className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-semibold">{t('referrals.noPending')}</p>
          </div>
        )}

        {pending.map((r) => {
          const patient = patients.find((p) => p.id === r.patientId)
          return (
            <div key={r.id} className={cn("rounded-2xl bg-white ring-1 p-4", r.urgent ? "ring-red-200" : "ring-slate-200/70")}>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{r.patientName}</span>
                    {r.urgent && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
                        <AlertTriangle className="h-3 w-3" /> {t('referrals.urgent')}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{timeAgo(r.orderedAt)}</span>
                  </div>
                  <p className="text-[12.5px] text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                    <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                    {r.fromDepartment ?? "OPD"} <ArrowRight className="h-3 w-3 text-slate-400" /> <b className="text-[var(--color-accent)]">{r.specialty}</b>
                  </p>
                  {r.notes && <p className="text-[12px] text-slate-500 mt-1">{r.notes}</p>}
                  {!patient && <p className="text-[11px] text-amber-600 mt-1">{t('referrals.notInQueue')}</p>}
                </div>
                <Button onClick={() => onAccept(r.id, r.patientId!, r.patientName ?? t('referrals.patientFallback'), r.specialty)} className="h-10 rounded-xl gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> {t('referrals.acceptRequeue')}
                </Button>
              </div>
            </div>
          )
        })}
      </section>

      {/* Accepted */}
      {accepted.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-700">{t('referrals.accepted')}</h2>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">{accepted.length}</span>
          </div>
          {accepted.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white ring-1 ring-slate-200/70 p-3.5 flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-slate-800 text-[13px]">{r.patientName}</span>
                <span className="text-[12px] text-slate-500"> → {r.specialty}</span>
              </div>
              <span className="text-[11px] text-slate-400">{timeAgo(r.acceptedAt)}</span>
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 flex items-center gap-2 rounded-xl bg-[rgba(238,107,38,0.05)] border border-[rgba(238,107,38,0.15)] px-3 py-2.5 text-[12px] text-[var(--color-primary-dark)]">
        <Send className="h-3.5 w-3.5 flex-shrink-0" />
        {t('referrals.footerNote')}
      </div>
    </div>
  )
}
