"use client"

import { Select } from "@/components/ui/Select"
import { useEffect, useState } from "react"
import { useInpatientStore, type Inpatient, type IoKind } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { fluidBalance, ivStatus, fluidAlerts } from "@/lib/fluids"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Droplets, Plus, Sparkles, Pause, CheckCircle2, Play } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const INTAKE_TYPES = ["IV fluids", "Oral", "NG feed", "Blood product"]
const OUTPUT_TYPES = ["Urine", "Drain", "Vomitus", "Stool", "NG aspirate"]

function IoCard({ ip, mounted }: { ip: Inpatient; mounted: boolean }) {
  const t = useTranslations('nurse')
  const addIo = useInpatientStore(s => s.addIo)
  const setIvStatus = useInpatientStore(s => s.setIvStatus)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<IoKind>("intake")
  const [type, setType] = useState(INTAKE_TYPES[0])
  const [vol, setVol] = useState("")

  const bal = fluidBalance(ip.io)
  const alerts = mounted ? fluidAlerts(ip) : []
  const ivs = ip.ivLines ?? []

  const submit = () => {
    const v = parseInt(vol)
    if (isNaN(v) || v <= 0) { toast(t('fluidBalance.enterVolume')); return }
    addIo(ip.patientId, { kind, type, volume: v, by: "Anjali Desai" })
    toast.success(t('fluidBalance.recorded', { kind: kind === "intake" ? t('fluidBalance.intake') : t('fluidBalance.output'), volume: v, name: ip.name }))
    setVol(""); setOpen(false)
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-foreground">{ip.name}</h3>
          <p className="text-xs text-foreground-lighter">{ip.ward} · {ip.bed}</p>
        </div>
        <div className="text-right">
          <p className="t-overline text-foreground-placeholder">{t('fluidBalance.netBalance', { hrs: bal.windowHrs })}</p>
          <p className={`text-lg font-bold tabular-nums ${bal.net < 0 ? "text-danger" : bal.net >= 1500 ? "text-brand-amber-strong" : "text-success-strong"}`}>
            {bal.net > 0 ? "+" : ""}{mounted ? bal.net : 0} mL
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
        {[
          { label: t('fluidBalance.intake'), value: `${bal.intake} mL`, cls: "text-accent" },
          { label: t('fluidBalance.output'), value: `${bal.output} mL`, cls: "text-brand-amber-strong" },
          { label: t('fluidBalance.net'), value: `${bal.net > 0 ? "+" : ""}${bal.net} mL`, cls: bal.net < 0 ? "text-danger" : "text-success-strong" },
        ].map(s => (
          <div key={s.label} className="bg-surface-sunken rounded-xl p-2.5 text-center">
            <p className="t-overline text-foreground-placeholder">{s.label}</p>
            <p className={`text-sm font-bold mt-0.5 tabular-nums ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* IV / infusions */}
      {ivs.length > 0 && (
        <div className="space-y-2 mb-3">
          {ivs.map(l => {
            const s = ivStatus(l)
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border-light bg-surface p-2.5">
                <Droplets className={`h-4 w-4 flex-shrink-0 ${l.status === "Running" ? "text-accent" : "text-foreground-placeholder"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{l.fluid}</p>
                  <p className="text-[11px] text-foreground-lighter">
                    {l.status !== "Running" ? `${l.rate} · ${l.status}` : mounted && s.remaining != null ? t('fluidBalance.remaining', { rate: l.rate, remaining: s.remaining ?? 0, minutes: s.minutesLeft ?? 0 }) : l.rate}
                  </p>
                </div>
                {mounted && s.endingSoon && l.status === "Running" && (
                  <NeonBadge variant="warning" className="flex-shrink-0">{t('fluidBalance.endingSoon')}</NeonBadge>
                )}
                {mounted && s.resiteDue && (
                  <NeonBadge variant="danger" className="flex-shrink-0">{t('fluidBalance.resiteDue')}</NeonBadge>
                )}
                {l.status === "Running" ? (
                  <button onClick={() => setIvStatus(ip.patientId, l.id, "Paused")} aria-label={t('fluidBalance.pauseInfusion')} className="p-1.5 rounded-lg hover:bg-surface-sunken text-foreground-placeholder cursor-pointer"><Pause className="h-3.5 w-3.5" /></button>
                ) : (
                  <button onClick={() => setIvStatus(ip.patientId, l.id, "Running")} aria-label={t('fluidBalance.resumeInfusion')} className="p-1.5 rounded-lg hover:bg-surface-sunken text-foreground-placeholder cursor-pointer"><Play className="h-3.5 w-3.5" /></button>
                )}
                <button onClick={() => setIvStatus(ip.patientId, l.id, "Completed")} aria-label={t('fluidBalance.completeInfusion')} className="p-1.5 rounded-lg hover:bg-success-bg text-foreground-placeholder hover:text-success-strong cursor-pointer"><CheckCircle2 className="h-3.5 w-3.5" /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* AI alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs font-semibold ${a.severity === "critical" ? "text-danger" : "text-brand-amber-strong"}`}>
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" /> {a.text}
            </div>
          ))}
        </div>
      )}

      {/* Quick add I/O */}
      {open ? (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-light">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {(["intake", "output"] as IoKind[]).map(k => (
              <button key={k} onClick={() => { setKind(k); setType(k === "intake" ? INTAKE_TYPES[0] : OUTPUT_TYPES[0]) }}
                className={`px-3 py-1.5 text-xs font-bold cursor-pointer transition-colors ${kind === k ? (k === "intake" ? "bg-primary text-[#0D2032]" : "bg-warning text-white") : "bg-surface text-foreground-lighter hover:text-foreground"}`}>
                {k === "intake" ? t('fluidBalance.intake') : t('fluidBalance.output')}
              </button>
            ))}
          </div>
          <Select value={type} onChange={e => setType(e.target.value)} className="h-9 px-2 rounded-lg border border-border text-xs font-semibold text-foreground bg-surface-sunken">
            {(kind === "intake" ? INTAKE_TYPES : OUTPUT_TYPES).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </Select>
          <input value={vol} onChange={e => setVol(e.target.value)} type="number" placeholder={t('fluidBalance.mlPlaceholder')} className="h-9 w-20 px-2 rounded-lg border border-border text-xs font-bold text-foreground bg-surface-sunken" />
          <button onClick={submit} className="u-press h-9 px-3 rounded-lg bg-success text-white text-xs font-bold cursor-pointer hover:bg-success-strong transition-colors">{t('common.add')}</button>
          <button onClick={() => setOpen(false)} className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-foreground-lighter cursor-pointer">{t('common.cancel')}</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-bold text-success-strong hover:text-success cursor-pointer pt-1">
          <Plus className="h-4 w-4" /> {t('fluidBalance.recordIo')}
        </button>
      )}
    </Card>
  )
}

export default function FluidBalancePage() {
  const t = useTranslations('nurse')
  const inpatients = useInpatientStore(s => s.inpatients)
  const activeWard = useShiftStore(s => s.activeWard)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const active = inpatients.filter(i => i.stage !== "discharged" && (activeWard === ALL_WARDS || i.ward === activeWard))
  const totalAlerts = mounted ? active.reduce((n, ip) => n + fluidAlerts(ip).length, 0) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="t-body text-foreground-lighter">{t('fluidBalance.subtitle', { ward: activeWard })}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <WardSwitcher />
          <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent-soft border border-primary/20 rounded-full px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {totalAlerts > 0 ? t('fluidBalance.monitoringAlerts', { count: totalAlerts }) : t('fluidBalance.monitoring')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {active.map(ip => <IoCard key={ip.patientId} ip={ip} mounted={mounted} />)}
      </div>
    </div>
  )
}
