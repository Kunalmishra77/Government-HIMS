"use client"

import { CheckCircle, AlertTriangle, Clock, Package, ShoppingCart, Bed, Activity, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useInpatientStore, type Inpatient } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { buildMar, slotStatus, type MarSlot, type MarStatus } from "@/lib/mar"
import { AdministerModal } from "@/components/nurse/AdministerModal"
import { NeonBadge } from "@/components/ui/neon-badge"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { useAuthStore } from "@/store/useAuthStore"
import { useTranslations } from "next-intl"

// MAR slot lifecycle → clinical status token (label resolved via i18n key).
const MAR_STATUS: Record<MarStatus, { status: Status; key: string }> = {
  given:     { status: "done",     key: "given" },
  held:      { status: "urgent",   key: "held" },
  missed:    { status: "critical", key: "missed" },
  due:       { status: "caution",  key: "due" },
  scheduled: { status: "pending",  key: "scheduled" },
  running:   { status: "info",     key: "running" },
  prn:       { status: "info",     key: "prn" },
}
const ORDER: Record<MarStatus, number> = { missed: 0, due: 1, prn: 2, running: 3, scheduled: 4, held: 5, given: 6 }

export default function MedicationMAR() {
  const t = useTranslations('nurse')
  const { prescriptions, requestProcurement } = usePharmacyStore()
  const allInpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const inpatients = allInpatients.filter(i => activeWard === ALL_WARDS || i.ward === activeWard)
  const administerMed = useInpatientStore(s => s.administerMed)
  const currentUser = useAuthStore(s => s.currentUser)
  const [activeTab, setActiveTab] = useState<'mar' | 'ipd'>('mar')
  const [admin, setAdmin] = useState<{ slot: MarSlot; ip: Inpatient } | null>(null)

  // Compute "now" only after mount to avoid SSR/client time mismatch.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()) }, [])
  const nowMin = now ?? -1

  const ipdPending = prescriptions.filter(p => p.procurementStatus === 'deferred_ipd')
  const ipdRequested = prescriptions.filter(p => p.procurementStatus === 'procurement_requested')

  const rows = useMemo(() => {
    const slots = buildMar(inpatients)
    return slots.map(slot => {
      const ip = inpatients.find(i => i.patientId === slot.patientId)!
      const { status, rec } = slotStatus(slot, ip.mar, nowMin)
      return { slot, ip, status, rec }
    }).sort((a, b) =>
      (ORDER[a.status] - ORDER[b.status]) ||
      a.slot.patientName.localeCompare(b.slot.patientName) ||
      ((a.slot.scheduledMin ?? 9999) - (b.slot.scheduledMin ?? 9999)),
    )
  }, [inpatients, nowMin])

  const missedCount = rows.filter(r => r.status === 'missed').length
  const dueCount = rows.filter(r => r.status === 'due').length

  const nurseName = currentUser?.name ?? 'Nurse'
  const doAdminister = (note?: string) => {
    if (!admin) return
    administerMed(admin.ip.patientId, { medName: admin.slot.medName, slot: admin.slot.slot, action: 'given', note })
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: note ? 'high' : 'low',
      title: t('medication.medGivenTitle', { med: admin.slot.medName, name: admin.slot.patientName }),
      body: t('medication.medGivenBody', { med: admin.slot.medName, dose: admin.slot.dose, route: admin.slot.route, name: admin.slot.patientName, ward: admin.slot.ward, bed: admin.slot.bed, slot: admin.slot.slot, nurse: nurseName, note: note ? ` — ${note}` : '' }),
      patientName: admin.slot.patientName,
      audit: { action: 'nurse_med_administered', resource: 'mar_slot', resourceId: `${admin.ip.patientId}:${admin.slot.medName}:${admin.slot.slot}`, detail: `${admin.slot.medName} given to ${admin.slot.patientName}${note ? ` · ${note}` : ''}`, userName: nurseName },
    })
    toast.success(note ? t('medication.medGivenToastOverride', { med: admin.slot.medName, name: admin.slot.patientName }) : t('medication.medGivenToast', { med: admin.slot.medName, name: admin.slot.patientName }))
  }
  const doHold = (note?: string) => {
    if (!admin) return
    administerMed(admin.ip.patientId, { medName: admin.slot.medName, slot: admin.slot.slot, action: 'held', note })
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'medium',
      title: t('medication.medHeldTitle', { med: admin.slot.medName, name: admin.slot.patientName }),
      body: t('medication.medHeldBody', { med: admin.slot.medName, name: admin.slot.patientName, ward: admin.slot.ward, bed: admin.slot.bed, slot: admin.slot.slot, nurse: nurseName, note: note ? ` — ${note}` : '' }),
      patientName: admin.slot.patientName,
      audit: { action: 'nurse_med_administered', resource: 'mar_slot', resourceId: `${admin.ip.patientId}:${admin.slot.medName}:${admin.slot.slot}`, detail: `${admin.slot.medName} held for ${admin.slot.patientName}${note ? ` · ${note}` : ''}`, userName: nurseName },
    })
    toast(t('medication.medHeldToast', { med: admin.slot.medName, name: admin.slot.patientName }))
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="t-body text-foreground-lighter">{t('medication.subtitle', { ward: activeWard })}</p>
        <WardSwitcher />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl w-fit bg-surface-sunken">
        {[
          { key: 'mar', label: t('medication.tabMar'), count: dueCount + missedCount },
          { key: 'ipd', label: t('medication.tabIpd'), count: ipdPending.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'mar' | 'ipd')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer",
              activeTab === tab.key ? 'bg-surface text-foreground shadow-xs' : 'text-foreground-lighter hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", activeTab === tab.key ? 'bg-warning-bg text-brand-amber-strong' : 'bg-surface-sunken text-foreground-lighter')}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'mar' && (
        <>
          {/* AI missed-dose alert */}
          {missedCount > 0 && (
            <div className="bg-danger-bg border border-danger/25 rounded-xl p-3 text-sm text-danger-strong font-semibold flex items-center gap-2" role="alert">
              <Sparkles className="h-4 w-4 flex-shrink-0 text-danger" />
              {t('medication.missedAlert', { count: missedCount, plural: missedCount > 1 ? 's' : '' })}
            </div>
          )}
          <div className="bg-warning-bg border border-warning/30 rounded-xl p-3 text-sm text-brand-amber-strong font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {t('medication.fiveRights')}
          </div>

          <div className="bg-surface rounded-xl border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-surface-sunken border-b border-border">
                <tr>{[t('medication.colPatient'), t('medication.colBed'), t('medication.colDrug'), t('medication.colRoute'), t('medication.colTime'), t('medication.colStatus'), t('medication.colBy'), t('medication.colAction')].map(h => (
                  <th key={h} scope="col" className="text-left px-4 py-3 t-overline text-foreground-lighter">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {rows.map(({ slot, ip, status, rec }) => {
                  const meta = MAR_STATUS[status]
                  const actionable = status === 'due' || status === 'missed' || status === 'prn'
                  return (
                    <tr key={slot.key} className="u-row">
                      <td className="px-4 py-3 font-semibold text-foreground">{slot.patientName}</td>
                      <td className="px-4 py-3 text-foreground-lighter whitespace-nowrap">{slot.ward} · {slot.bed}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{slot.medName} {slot.dose}</td>
                      <td className="px-4 py-3 text-foreground-lighter">{slot.route}</td>
                      <td className="px-4 py-3 text-foreground-lighter whitespace-nowrap">{slot.slot}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={meta.status} label={t(`medication.${meta.key}`)} />
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground-lighter whitespace-nowrap">
                        {rec ? `${rec.by} @ ${new Date(rec.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {actionable && (
                          <button onClick={() => setAdmin({ slot, ip })} className="u-press px-3 py-1.5 text-xs font-bold bg-success text-white rounded-lg hover:bg-success-strong cursor-pointer transition-colors">
                            {status === 'prn' ? t('medication.givePrn') : t('medication.administer')}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-2">
                    <EmptyState icon={Activity} title={t('medication.noOrders')} size="sm" />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'ipd' && (
        <div className="space-y-6">
          <div className="bg-accent-soft border border-primary/20 rounded-xl p-3 text-sm text-primary-dark font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 flex-shrink-0" />
            {t('medication.ipdHeld')}
          </div>

          {ipdRequested.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground-muted mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" /> {t('medication.requestedPreparing', { count: ipdRequested.length })}
              </h3>
              <div className="space-y-3">
                {ipdRequested.map(rx => (
                  <div key={rx.id} className="bg-warning-bg border border-warning/30 rounded-xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-foreground">{rx.patientName}</p>
                          {rx.wardBed && <span className="flex items-center gap-1 text-xs text-foreground-lighter"><Bed className="h-3 w-3" />{rx.wardBed}</span>}
                          <NeonBadge variant="warning">{t('medication.requested')}</NeonBadge>
                        </div>
                        <div className="space-y-1 mt-2">
                          {rx.medicines.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-foreground-muted">
                              <Package className="h-3 w-3 text-warning flex-shrink-0" />
                              {m.name} — {m.dosage}
                            </div>
                          ))}
                        </div>
                      </div>
                      <CheckCircle className="h-5 w-5 text-warning flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ipdPending.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground-muted mb-3 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-accent" /> {t('medication.pendingRequest', { count: ipdPending.length })}
              </h3>
              <div className="space-y-3">
                {ipdPending.map(rx => (
                  <div key={rx.id} className="bg-surface border border-primary/20 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-foreground">{rx.patientName}</p>
                          {rx.wardBed && <span className="flex items-center gap-1 text-xs text-foreground-lighter"><Bed className="h-3 w-3" />{rx.wardBed}</span>}
                          {rx.triageLevel && <NeonBadge variant={rx.triageLevel === 'Critical' ? 'danger' : rx.triageLevel === 'High' ? 'warning' : 'muted'}>{rx.triageLevel}</NeonBadge>}
                        </div>
                        <p className="text-xs text-foreground-placeholder mb-2">{rx.doctorName} · {rx.department}</p>
                        <div className="space-y-1">
                          {rx.medicines.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-foreground-muted">
                              <Package className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                              {m.name} — {m.dosage} · {m.frequency}
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          requestProcurement(rx.id)
                          toast.success(t('medication.procurementRequested', { name: rx.patientName }))
                        }}
                        className="u-press flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark rounded-xl shadow-xs cursor-pointer transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4" /> {t('medication.requestProcurement')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ipdPending.length === 0 && ipdRequested.length === 0 && (
            <EmptyState icon={CheckCircle} title={t('medication.noIpdItems')} size="sm" />
          )}
        </div>
      )}

      <AnimatePresence>
        {admin && (
          <AdministerModal
            slot={admin.slot}
            allergies={admin.ip.allergies}
            comorbidities={admin.ip.comorbidities}
            onClose={() => setAdmin(null)}
            onAdminister={doAdminister}
            onHold={doHold}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
