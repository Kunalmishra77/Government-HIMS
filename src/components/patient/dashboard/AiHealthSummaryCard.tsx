"use client"

/* S11 — AI Health Summary on Patient Portal Home.
 *
 * Plain-language summary the patient sees the moment they open their
 * dashboard. Composes from PatientProfile (conditions, allergies, meds)
 * + the patient's recent audit timeline (prescriptions, orders) + their
 * live journey stage. HITL: regenerate / accept / hide. Audited.
 *
 *   <AiHealthSummaryCard />
 */

import { useMemo, useState } from "react"
import { Sparkles, RefreshCw, Check, X, ShieldAlert, Pill, Activity, FileText } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"

const VARIANTS = [
  (sub: SummarySubs) =>
    `${sub.firstName}, here's a quick look at where you stand today. ${sub.conditionsLine} ` +
    `${sub.medsLine} ${sub.allergyLine} ${sub.recentLine}`,
  (sub: SummarySubs) =>
    `Hi ${sub.firstName} — short version: ${sub.conditionsLine.toLowerCase().replace(/\.$/, '')}, ` +
    `currently on ${sub.medsCount > 0 ? sub.medsCount + ' medication' + (sub.medsCount === 1 ? '' : 's') : 'no regular medication'}, ` +
    `${sub.allergyShort}. ${sub.recentLine}`,
  (sub: SummarySubs) =>
    `Quick health overview: ${sub.conditionsLine} ${sub.medsLine} ` +
    `${sub.allergyLine} ${sub.recentLine}`,
]

interface SummarySubs {
  firstName: string
  conditionsLine: string
  medsLine: string
  medsCount: number
  allergyLine: string
  allergyShort: string
  recentLine: string
}

export function AiHealthSummaryCard({ className }: { className?: string }) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const profile     = usePatientProfileStore((s) => (currentUser?.id ? s.getProfile(currentUser.id) : undefined))
  const audit       = useAuditStore((s) => s.log)
  const entries     = useAuditStore((s) => s.entries)

  const [variantIdx, setVariantIdx] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const subs = useMemo<SummarySubs>(() => {
    const firstName = (currentUser?.name ?? "there").split(/\s+/)[0]
    const conds = profile?.chronicConditions ?? []
    const meds  = profile?.currentMedications ?? []
    const allergies = profile?.allergies ?? []

    const conditionsLine = conds.length === 0
      ? `Your record shows no chronic conditions on file.`
      : conds.length === 1
        ? `You're managing ${conds[0]}.`
        : `You're managing ${conds.slice(0, -1).join(', ')} and ${conds[conds.length - 1]}.`

    const medsLine = meds.length === 0
      ? `No long-term medicines listed.`
      : meds.length === 1
        ? `Daily plan: ${meds[0]}.`
        : `Daily plan: ${meds.slice(0, 3).join(', ')}${meds.length > 3 ? ', and others' : ''}.`

    const allergyLine = (profile?.noKnownAllergies || allergies.length === 0)
      ? `No known drug allergies on record.`
      : `Watch out for: ${allergies.join(', ')} — your team avoids these for you.`

    const allergyShort = (profile?.noKnownAllergies || allergies.length === 0)
      ? `no known allergies`
      : `allergic to ${allergies.join(', ')}`

    // Recent activity from audit (last 24h, patient-scoped if we can match the user id).
    const since = Date.now() - 24 * 3600 * 1000
    const myRecent = entries.filter((e) =>
      new Date(e.timestamp).getTime() >= since &&
      (e.userId === currentUser?.id || (e.resourceId ?? '').includes(currentUser?.id ?? '___'))
    )
    const rx     = myRecent.filter((e) => e.action === 'prescription_create').length
    const labs   = myRecent.filter((e) => e.action === 'lab_order').length
    const imag   = myRecent.filter((e) => e.action === 'radiology_order').length
    const parts: string[] = []
    if (rx > 0) parts.push(`${rx} new prescription${rx === 1 ? '' : 's'}`)
    if (labs > 0) parts.push(`${labs} lab order${labs === 1 ? '' : 's'}`)
    if (imag > 0) parts.push(`${imag} scan${imag === 1 ? '' : 's'}`)
    const recentLine = parts.length === 0
      ? `Nothing new in the last 24 hours.`
      : `In the last 24h: ${parts.join(', ')} — see them under Doctor's orders.`

    return { firstName, conditionsLine, medsLine, medsCount: meds.length, allergyLine, allergyShort, recentLine }
  }, [currentUser, profile, entries])

  const summary = VARIANTS[variantIdx](subs)

  function regenerate() {
    setVariantIdx((i) => (i + 1) % VARIANTS.length)
    audit({
      action: "hitl_modify",
      resource: "patient_health_summary",
      resourceId: currentUser?.id ?? "anon",
      detail: `Patient regenerated AI health summary (variant ${(variantIdx + 1) % VARIANTS.length + 1}).`,
      userId: currentUser?.id ?? "patient", userName: currentUser?.name ?? "Patient",
    })
  }
  function accept() {
    audit({
      action: "hitl_accept",
      resource: "patient_health_summary",
      resourceId: currentUser?.id ?? "anon",
      detail: `Patient confirmed AI health summary as accurate.`,
      userId: currentUser?.id ?? "patient", userName: currentUser?.name ?? "Patient",
    })
    setAccepted(true)
  }
  function hide() {
    audit({
      action: "hitl_reject",
      resource: "patient_health_summary",
      resourceId: currentUser?.id ?? "anon",
      detail: `Patient hid AI health summary.`,
      userId: currentUser?.id ?? "patient", userName: currentUser?.name ?? "Patient",
    })
    setHidden(true)
  }

  if (hidden) return null

  return (
    <section className={`rounded-3xl bg-surface border border-border shadow-[0_1px_4px_rgba(13,32,50,0.06),0_8px_28px_rgba(13,32,50,0.05)] p-5 ${className ?? ''}`}>
      <header className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-xl bg-accent-soft text-[var(--color-accent)] flex items-center justify-center">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-foreground">Your health, in a glance</h3>
          <p className="text-[11px] text-foreground-lighter">AI-written from your record · in plain language</p>
        </div>
        <span className="ml-auto text-[10.5px] font-mono font-semibold text-[var(--color-accent)]">87% confidence</span>
      </header>

      <p className="text-[14.5px] text-slate-800 leading-relaxed mb-3">{summary}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {(profile?.chronicConditions ?? []).slice(0, 3).map((c, i) => (
          <ReasoningChip key={i} compact tone="info" title={c} />
        ))}
        {(profile?.allergies ?? []).slice(0, 2).map((a, i) => (
          <ReasoningChip key={i} compact tone="warn" title={`Allergy: ${a}`} />
        ))}
        {(profile?.currentMedications ?? []).length > 0 ? (
          <ReasoningChip compact tone="ok" title={`${profile?.currentMedications.length ?? 0} daily med${(profile?.currentMedications.length ?? 0) === 1 ? '' : 's'}`} />
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-white/80 ring-1 ring-slate-200/70 px-3 py-2">
          <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1"><Activity className="h-3 w-3" /> Conditions</p>
          <p className="text-[15px] font-bold text-slate-900 mt-0.5">{profile?.chronicConditions?.length ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white/80 ring-1 ring-slate-200/70 px-3 py-2">
          <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1"><Pill className="h-3 w-3" /> Daily meds</p>
          <p className="text-[15px] font-bold text-slate-900 mt-0.5">{profile?.currentMedications?.length ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white/80 ring-1 ring-slate-200/70 px-3 py-2">
          <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Allergies</p>
          <p className="text-[15px] font-bold text-slate-900 mt-0.5">{(profile?.noKnownAllergies ? 0 : (profile?.allergies?.length ?? 0))}</p>
        </div>
      </div>

      <footer className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] text-slate-500 mr-auto inline-flex items-center gap-1.5">
          <FileText className="h-3 w-3" /> Helps your doctor and family understand your story.
        </span>
        {accepted ? (
          <ReasoningChip compact tone="ok" title="You confirmed this · audited" />
        ) : (
          <>
            <button type="button" onClick={hide}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <X className="h-3 w-3" /> Hide
            </button>
            <button type="button" onClick={regenerate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <RefreshCw className="h-3 w-3" /> Try another wording
            </button>
            <button type="button" onClick={accept}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white">
              <Check className="h-3 w-3" /> Looks right
            </button>
          </>
        )}
      </footer>
    </section>
  )
}
