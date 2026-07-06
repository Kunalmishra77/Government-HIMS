"use client"

import { useEffect, useMemo, useState } from "react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useShiftStore, SHIFT_WINDOWS, ALL_WARDS, type ShiftType } from "@/store/useShiftStore"
import { useAuditStore } from "@/store/useAuditStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { buildWardHandover, type WardHandover } from "@/lib/handover"
import { Sparkles, RefreshCw, CheckCircle2, ShieldCheck, Inbox, ArrowRightLeft, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StatusPill } from "@/components/ui/StatusPill"
import { NeonBadge } from "@/components/ui/neon-badge"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const NEXT_SHIFT: Record<ShiftType, ShiftType> = { Morning: "Evening", Evening: "Night", Night: "Morning" }
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

export default function NurseHandover() {
  const t = useTranslations('nurse')
  const inpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const assignments = useShiftStore(s => s.assignments)
  const currentNurseId = useShiftStore(s => s.currentNurseId)
  const nurseName = useShiftStore(s => s.currentNurseName)
  const handovers = useShiftStore(s => s.handovers)
  const signHandover = useShiftStore(s => s.signHandover)
  const receiveHandover = useShiftStore(s => s.receiveHandover)
  const log = useAuditStore(s => s.log)
  // Derive in-component (selectors must return cached snapshots — never call a
  // store method that builds a fresh array inside the selector).
  const myAssignment = useMemo(() => assignments.find(a => a.nurseId === currentNurseId), [assignments, currentNurseId])
  const pendingIncoming = useMemo(
    () => (myAssignment ? handovers.filter(h => h.status === "signed" && h.ward === myAssignment.ward && h.toShift === myAssignment.shift) : []),
    [handovers, myAssignment],
  )

  const shift = myAssignment?.shift ?? "Morning"
  const ward = activeWard === ALL_WARDS ? (myAssignment?.ward ?? "Cardiac Care") : activeWard
  const wardInpatients = inpatients.filter(i => i.stage !== "discharged" && i.ward === ward)

  const [ho, setHo] = useState<WardHandover | null>(null)
  const [addendum, setAddendum] = useState("")
  const build = () => { const d = new Date(); setHo(buildWardHandover(wardInpatients, d.getHours() * 60 + d.getMinutes())) }
  // Build client-side only (avoids SSR/client time mismatch). Rebuild on ward change.
  useEffect(() => { build() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeWard, inpatients])

  const wardLog = handovers.filter(h => h.ward === ward).sort((a, b) => b.signedAt.localeCompare(a.signedAt))

  const sign = () => {
    if (!ho) return
    const sbar = ho.patients.map(p => `${p.name} (${p.bed}) — S: ${p.situation} A: ${p.assessment} R: ${p.recommendation}`).join("\n") + (addendum.trim() ? `\nAddendum: ${addendum.trim()}` : "")
    signHandover({ ward, date: new Date().toISOString().slice(0, 10), fromShift: shift, toShift: NEXT_SHIFT[shift], fromNurse: nurseName, sbar, addendum: addendum.trim() || undefined, patientCount: ho.patients.length })
    log({ userId: "nurse_portal", userName: nurseName, action: "handover_signed", resource: "ward", resourceId: ward, detail: `${shift}→${NEXT_SHIFT[shift]} handover signed for ${ward} (${ho.patients.length} patients)` })
    toast.success(t('handover.signedToast', { next: NEXT_SHIFT[shift] }))
    setAddendum("")
  }
  const receive = (id: string, from: string) => {
    receiveHandover(id, nurseName)
    log({ userId: "nurse_portal", userName: nurseName, action: "handover_received", resource: "ward", resourceId: ward, detail: `Received ${from}'s handover for ${ward}` })
    toast.success(t('handover.receivedToast', { from }))
  }

  const urgentCount = ho?.patients.filter(p => p.urgent).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="t-body text-foreground-lighter">{t('handover.subtitle', { ward, shift, window: SHIFT_WINDOWS[shift] })}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <WardSwitcher />
          <button onClick={build} className="u-press flex items-center gap-1.5 text-sm font-bold text-accent bg-accent-soft border border-primary/20 hover:bg-accent-soft/70 px-3 py-2 rounded-xl cursor-pointer transition-colors">
            <RefreshCw className="h-4 w-4" /> {t('handover.regenerate')}
          </button>
        </div>
      </div>

      {/* Incoming — receive handover */}
      {pendingIncoming.length > 0 && (
        <Card className="p-5 border border-primary/20 bg-accent-soft/60">
          <div className="flex items-center gap-2 mb-3"><Inbox className="h-4 w-4 text-accent" /><h2 className="t-title text-primary-dark">{t('handover.incomingTitle')}</h2></div>
          {pendingIncoming.map(h => (
            <div key={h.id} className="rounded-xl bg-surface border border-primary/20 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                <p className="text-sm font-bold text-foreground flex items-center gap-2"><ArrowRightLeft className="h-3.5 w-3.5 text-accent" /> {t('handover.handoverRoute', { from: h.fromNurse, fromShift: h.fromShift, toShift: h.toShift })}</p>
                <span className="text-[11px] text-foreground-placeholder flex items-center gap-1"><Clock className="h-3 w-3" /> {t('handover.signedAt', { time: fmtTime(h.signedAt) })}</span>
              </div>
              <pre className="text-xs text-foreground-lighter whitespace-pre-wrap font-sans mb-3">{h.sbar}</pre>
              <button onClick={() => receive(h.id, h.fromNurse)} className="u-press flex items-center gap-1.5 text-sm font-bold text-[#0D2032] px-4 py-2 rounded-xl cursor-pointer bg-primary hover:bg-primary-dark transition-colors">
                <CheckCircle2 className="h-4 w-4" /> {t('handover.receiveAcknowledge')}
              </button>
            </div>
          ))}
        </Card>
      )}

      {/* Outgoing — AI-compiled SBAR + sign */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="t-title text-foreground">{t('handover.endOfShift')}</h2>
          <span className="ml-auto text-[11px] text-foreground-lighter">{urgentCount > 0 ? t('handover.patientsUrgent', { count: ho?.patients.length ?? 0, urgent: urgentCount, next: NEXT_SHIFT[shift] }) : t('handover.patientsNext', { count: ho?.patients.length ?? 0, next: NEXT_SHIFT[shift] })}</span>
        </div>
        <div className="space-y-2.5 mb-4">
          {(ho?.patients ?? []).map(p => (
            <div key={p.patientId} className={`p-3 rounded-xl border ${p.urgent ? "border-danger/25 bg-danger-bg/70" : "border-border bg-surface"}`}>
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <p className="font-bold text-foreground text-sm">{p.name} — {p.bed}</p>
                {p.urgent
                  ? <StatusPill status="critical" label={p.condition.toUpperCase()} dense />
                  : <span className="chip chip-neutral">{p.condition}</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-foreground-muted">
                <div><span className="font-bold text-foreground-lighter">S:</span> {p.situation}</div>
                <div><span className="font-bold text-foreground-lighter">A:</span> {p.assessment}</div>
                <div className="sm:col-span-2"><span className="font-bold text-success-strong">R:</span> {p.recommendation}</div>
              </div>
            </div>
          ))}
          {(ho?.patients.length ?? 0) === 0 && <p className="text-xs text-foreground-placeholder">{t('handover.noActivePatients', { ward })}</p>}
        </div>
        <textarea rows={2} value={addendum} onChange={e => setAddendum(e.target.value)} placeholder={t('handover.addendumPlaceholder')}
          className="w-full px-3 py-2 rounded-xl border border-border text-sm text-foreground focus:outline-none focus:border-primary bg-surface-sunken mb-3 transition-colors" />
        <button onClick={sign} className="u-press flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2 rounded-xl cursor-pointer bg-success hover:bg-success-strong transition-colors">
          <ShieldCheck className="h-4 w-4" /> {t('handover.signHandover', { next: NEXT_SHIFT[shift] })}
        </button>
      </Card>

      {/* Handover log — audit trail */}
      <Card className="p-5">
        <h2 className="t-title text-foreground mb-3">{t('handover.logTitle', { ward })}</h2>
        {wardLog.length === 0 ? <p className="text-xs text-foreground-placeholder">{t('handover.noHandovers')}</p> : (
          <div className="space-y-2">
            {wardLog.map(h => (
              <div key={h.id} className="flex items-center justify-between gap-3 text-xs border-b border-border-light pb-2 flex-wrap">
                <span className="font-semibold text-foreground-muted">{t('handover.logRoute', { from: h.fromNurse, fromShift: h.fromShift, to: h.toNurse ?? t('handover.logShift', { shift: h.toShift }) })}</span>
                <span className="text-foreground-placeholder">{h.receivedAt ? t('handover.logMetaReceived', { count: h.patientCount, signed: fmtTime(h.signedAt), received: fmtTime(h.receivedAt), by: h.receivedBy ?? "" }) : t('handover.logMeta', { count: h.patientCount, signed: fmtTime(h.signedAt) })}</span>
                <NeonBadge variant={h.status === "received" ? "success" : "warning"}>{h.status}</NeonBadge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
