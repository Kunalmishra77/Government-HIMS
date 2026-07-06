"use client"

import { useLabStore } from "@/store/useLabStore"
import { useRadiologyStore } from "@/store/useRadiologyStore"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { useBloodBankStore } from "@/store/useBloodBankStore"
import { VisibilityHeader, STAT_CARD } from "@/components/reception/VisibilityHeader"
import { FlaskConical, ScanLine, Pill, Droplets, CheckCircle2, Clock } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const pill = (ready: boolean) => ready ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'

export default function ReceptionDiagnostics() {
  const t = useTranslations('reception')
  const samples = useLabStore(s => s.samples)
  const scans = useRadiologyStore(s => s.scans)
  const prescriptions = usePharmacyStore(s => s.prescriptions)
  const crossMatch = useBloodBankStore(s => s.crossMatchRequests)

  const labReady = samples.filter(s => s.status === 'Completed').length
  const radReady = scans.filter(s => s.status === 'Ready for Review' || s.status === 'Reported').length
  const rxReady = prescriptions.filter(p => p.status === 'ready').length
  const bbReady = crossMatch.filter(c => c.status === 'compatible' || c.status === 'issued').length

  const tiles = [
    { label: t('diagnostics.tileLabReady'), value: labReady, icon: FlaskConical, tint: 'bg-rose-50 text-rose-600' },
    { label: t('diagnostics.tileScansReady'), value: radReady, icon: ScanLine, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('diagnostics.tileMedicinesReady'), value: rxReady, icon: Pill, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
    { label: t('diagnostics.tileBloodReady'), value: bbReady, icon: Droplets, tint: 'bg-red-50 text-red-600' },
  ]

  return (
    <div className="pb-6">
      <VisibilityHeader title={t('diagnostics.title')} subtitle={t('diagnostics.subtitle')} owner={t('diagnostics.owner')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {tiles.map(t => (
          <div key={t.label} className={STAT_CARD}>
            <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", t.tint)}><t.icon className="h-4.5 w-4.5" /></span>
            <p className="text-[22px] font-bold text-slate-900 mt-2.5 leading-none tabular-nums">{t.value}</p>
            <p className="text-[12px] font-semibold text-slate-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ServiceCard title={t('diagnostics.cardPathology')} emptyText={t('diagnostics.nothingInProgress')} Icon={FlaskConical} tint="bg-rose-50 text-rose-600"
          items={samples.map(s => ({ id: s.id, name: s.patientName, detail: s.testName, status: s.status, ready: s.status === 'Completed' }))} />
        <ServiceCard title={t('diagnostics.cardRadiology')} emptyText={t('diagnostics.nothingInProgress')} Icon={ScanLine} tint="bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]"
          items={scans.map(s => ({ id: s.id, name: s.patientName, detail: s.scanType, status: s.status, ready: s.status === 'Ready for Review' || s.status === 'Reported' }))} />
        <ServiceCard title={t('diagnostics.cardPharmacy')} emptyText={t('diagnostics.nothingInProgress')} Icon={Pill} tint="bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]"
          items={prescriptions.map(p => ({ id: p.id, name: p.patientName, detail: t(p.medicines.length !== 1 ? 'diagnostics.itemCountPlural' : 'diagnostics.itemCount', { count: p.medicines.length }), status: p.status, ready: p.status === 'ready' }))} />
        <ServiceCard title={t('diagnostics.cardBloodBank')} emptyText={t('diagnostics.nothingInProgress')} Icon={Droplets} tint="bg-red-50 text-red-600"
          items={crossMatch.map(c => ({ id: c.id, name: c.patientName, detail: `${c.bloodGroup} · ${c.component} ×${c.units}`, status: c.status, ready: c.status === 'compatible' || c.status === 'issued' }))} />
      </div>
    </div>
  )
}

function ServiceCard({ title, emptyText, Icon, tint, items }: {
  title: string; emptyText: string; Icon: React.ElementType; tint: string
  items: { id: string; name: string; detail: string; status: string; ready: boolean }[]
}) {
  return (
    <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center", tint)}><Icon className="h-4.5 w-4.5" /></span>
        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
        <span className="ml-auto text-[12px] font-semibold text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-slate-400 bg-slate-50 rounded-xl p-3">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-slate-900 truncate">{it.name}</p>
                <p className="text-[11.5px] text-slate-500 truncate">{it.detail}</p>
              </div>
              <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0 capitalize", pill(it.ready))}>
                {it.ready ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{it.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
