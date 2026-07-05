"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useInpatientStore, latestVitalsRecord } from "@/store/useInpatientStore"
import { useNursingStore } from "@/store/useNursingStore"
import { news2FromRecord } from "@/lib/vitals"
import { buildMar, slotStatus, type MarStatus } from "@/lib/mar"
import { fluidBalance, ivStatus } from "@/lib/fluids"
import { newsTrendVitals, trendArrow } from "@/lib/escalation"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { deriveUhid } from "@/lib/uhid"
import { news2Token, news2ScoreToken } from "@/lib/statusColors"
import { ArrowLeft, Pill, Droplets, FileText, ClipboardList, HeartPulse } from "lucide-react"
import { useTranslations } from "next-intl"

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
// MAR slot status → semantic ink (inline, not a raw-palette colour map).
const statusInk: Record<MarStatus, string> = {
  given: "text-success-strong", held: "text-urgent", missed: "text-danger", due: "text-brand-amber-strong",
  scheduled: "text-foreground-placeholder", running: "text-accent", prn: "text-accent",
}

export default function NursePatientDetail() {
  const t = useTranslations('nurse')
  const params = useParams<{ id: string }>()
  const id = params?.id
  const inpatients = useInpatientStore(s => s.inpatients)
  const tasks = useNursingStore(s => s.tasks)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { const d = new Date(); setNow(d.getHours() * 60 + d.getMinutes()) }, [])
  const nowMin = now ?? -1

  const ip = inpatients.find(i => i.patientId === id)
  if (!ip) {
    return (
      <div className="space-y-4">
        <Link href="/nurse/patients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-lighter hover:text-foreground-muted"><ArrowLeft className="h-4 w-4" /> {t('patientDetail.allPatients')}</Link>
        <div className="py-16 text-center text-foreground-placeholder">{t('patientDetail.notFound')}</div>
      </div>
    )
  }

  const rec = latestVitalsRecord(ip)
  const news = rec ? news2FromRecord(rec) : undefined
  const trend = newsTrendVitals(ip)
  const vitalsDesc = (ip.vitals ?? []).slice().sort((a, b) => b.at.localeCompare(a.at))
  const mar = buildMar([ip])
  const bal = fluidBalance(ip.io)
  const patientTasks = tasks.filter(t => t.patientId === ip.patientId)
  const notes = [...ip.events].reverse().filter(e => e.type === "note" || e.type === "condition_change" || e.type === "round").slice(0, 8)

  return (
    <div className="space-y-5">
      <Link href="/nurse/patients" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-lighter hover:text-foreground-muted"><ArrowLeft className="h-4 w-4" /> {t('patientDetail.allPatients')}</Link>

      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{ip.name}</h1>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">{deriveUhid(ip.patientId)}</span>
            </div>
            <p className="text-sm text-foreground-lighter mt-0.5">{t('patientDetail.meta', { id: ip.patientId, age: ip.age, gender: ip.gender, ward: ip.ward, bed: ip.bed })}</p>
            <p className="text-sm text-foreground-muted mt-1">{ip.diagnosis}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <NeonBadge variant={ip.condition === "Critical" ? "danger" : ip.condition === "Serious" ? "warning" : "success"}>{ip.condition}</NeonBadge>
            {news && <NeonBadge variant={news2Token(news.band).variant}>NEWS {news.score} {trend.length > 1 ? trendArrow(trend) : ""}</NeonBadge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          {(ip.allergies ?? []).map(a => <span key={a} className="px-2 py-0.5 rounded-full bg-danger-bg text-danger border border-danger/25 font-semibold">{a}</span>)}
          {(ip.comorbidities ?? []).map(c => <span key={c} className="chip chip-neutral">{c}</span>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Vitals trend */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><HeartPulse className="h-4 w-4 text-success-strong" /><h2 className="t-title text-foreground">{t('patientDetail.vitalsTrend')}</h2>
            {news && <span className="ml-auto text-[11px] font-semibold text-foreground-lighter">{t('patientDetail.newsTrend', { trend: trend.map(x => x.score).join(" → ") })}</span>}</div>
          <div className="space-y-2">
            {vitalsDesc.length === 0 && <p className="text-xs text-foreground-placeholder">{t('patientDetail.noVitals')}</p>}
            {vitalsDesc.map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs border-b border-border-light pb-1.5">
                <span className="text-foreground-placeholder">{fmt(v.at)}</span>
                <span className="font-semibold text-foreground-muted">HR {v.hr ?? "—"} · {v.systolicBP ?? "—"}/{v.diastolicBP ?? "—"} · RR {v.rr ?? "—"} · SpO₂ {v.spo2 ?? "—"}% · {v.temp ?? "—"}°F</span>
                <NeonBadge variant={news2ScoreToken(news2FromRecord(v).score).variant}>{news2FromRecord(v).score}</NeonBadge>
              </div>
            ))}
          </div>
        </Card>

        {/* MAR */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><Pill className="h-4 w-4 text-accent" /><h2 className="t-title text-foreground">{t('patientDetail.medicationToday')}</h2></div>
          <div className="space-y-1.5">
            {mar.length === 0 && <p className="text-xs text-foreground-placeholder">{t('patientDetail.noMedications')}</p>}
            {mar.map(slot => {
              const st = slotStatus(slot, ip.mar, nowMin).status
              return (
                <div key={slot.key} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground-muted">{slot.medName} {slot.dose} · {slot.slot}</span>
                  <span className={`font-bold ${statusInk[st]}`}>{t.has(`medication.${st}`) ? t(`medication.${st}`) : st}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Intake / Output */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><Droplets className="h-4 w-4 text-accent" /><h2 className="t-title text-foreground">{t('patientDetail.fluidBalance')}</h2></div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-surface-sunken rounded-lg p-2 text-center"><p className="t-overline text-foreground-placeholder">{t('patientDetail.intake')}</p><p className="text-sm font-bold tabular-nums text-accent">{bal.intake} mL</p></div>
            <div className="bg-surface-sunken rounded-lg p-2 text-center"><p className="t-overline text-foreground-placeholder">{t('patientDetail.output')}</p><p className="text-sm font-bold tabular-nums text-brand-amber-strong">{bal.output} mL</p></div>
            <div className="bg-surface-sunken rounded-lg p-2 text-center"><p className="t-overline text-foreground-placeholder">{t('patientDetail.net')}</p><p className={`text-sm font-bold tabular-nums ${bal.net < 0 ? "text-danger" : "text-success-strong"}`}>{bal.net > 0 ? "+" : ""}{bal.net} mL</p></div>
          </div>
          {(ip.ivLines ?? []).map(l => {
            const s = ivStatus(l)
            return <p key={l.id} className="text-xs text-foreground-muted">• {l.fluid} — {l.rate}{now != null && s.remaining != null && l.status === "Running" ? ` · ${s.remaining} mL left` : ` · ${l.status}`}</p>
          })}
        </Card>

        {/* Nursing tasks */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><ClipboardList className="h-4 w-4 text-brand-amber-strong" /><h2 className="t-title text-foreground">{t('patientDetail.tasks')}</h2></div>
          <div className="space-y-1.5">
            {patientTasks.length === 0 && <p className="text-xs text-foreground-placeholder">{t('patientDetail.noTasks')}</p>}
            {patientTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <span className={t.done ? "text-foreground-placeholder line-through" : "text-foreground-muted font-medium"}>{t.title}</span>
                <span className={`font-bold ${t.priority === "High" ? "text-danger" : t.priority === "Medium" ? "text-brand-amber-strong" : "text-foreground-placeholder"}`}>{t.priority}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Nursing notes / recent timeline */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3"><FileText className="h-4 w-4 text-foreground-lighter" /><h2 className="t-title text-foreground">{t('patientDetail.recentNotes')}</h2></div>
        <div className="space-y-2.5">
          {notes.map(e => (
            <div key={e.id} className="flex gap-3 text-xs">
              <span className="text-foreground-placeholder w-28 flex-shrink-0">{fmt(e.at)}</span>
              <div><span className="font-bold text-foreground">{e.title}</span>{e.detail ? <span className="text-foreground-muted"> — {e.detail}</span> : null}<span className="text-foreground-placeholder"> · {e.actor}</span></div>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-foreground-placeholder">{t('patientDetail.noNotes')}</p>}
        </div>
      </Card>
    </div>
  )
}
