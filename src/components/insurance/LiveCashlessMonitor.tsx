"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ShieldCheck, ShieldAlert, Activity, Clock, AlertTriangle, ArrowRight,
  CheckCircle2, FileText, Send, Hourglass, IndianRupee, User, Bed,
} from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { cn } from "@/lib/utils"
import Link from "next/link"

// Aggregate every cashless case in the hospital and its claim lifecycle stage.
//
// Sources:
//   1. usePatientStore.patients[].insurer  (cashless walk-ins from /reception/opd)
//   2. useBillingStore.bills[].payerType containing 'cashless'
//   3. useInpatientStore.inpatients (cross-ref by bill / patient)
//   4. useInsuranceStore.claims      (claim record per cashless case, when one exists)
//
// Lifecycle stages (canonical):
//   1. registered        — patient flagged cashless at intake, no claim yet
//   2. pre_auth_pending  — claim drafted (status === 'Pending Pre-Auth')
//   3. pre_auth_approved — pre-auth approved by insurer (status === 'Approved')
//                          and submissionStatus !== 'submitted' (still in stay)
//   4. claim_submitted   — final claim submitted to TPA (submissionStatus === 'submitted')
//   5. settled           — paid by insurer (approvedAmount > 0 and discharge done)
//   6. denied            — status === 'Rejected'
//   7. queried           — In Process + has aiDenialRisk > 70

export type CashlessStage =
  | 'registered' | 'pre_auth_pending' | 'pre_auth_approved'
  | 'claim_submitted' | 'settled' | 'denied' | 'queried'

interface CashlessCase {
  patientId: string
  patientName: string
  insurer: string
  policyNumber?: string
  stage: CashlessStage
  amount?: number             // claim amount or estimated cost
  approvedAmount?: number
  claimId?: string
  tpaRef?: string
  denialRisk?: number          // 0-100
  diagnosis?: string
  wardBed?: string
  enteredStageAt: string       // ISO timestamp — used for aging
  source: 'walk_in' | 'admitted' | 'claim_only'
}

const STAGE_META: Record<CashlessStage, {
  label: string; tint: string; icon: React.ElementType; order: number; sub: string
}> = {
  registered:        { label: 'Registered',       tint: 'border-amber-200 bg-amber-50 text-amber-700',       icon: User,        order: 1, sub: 'Awaiting pre-auth draft' },
  pre_auth_pending:  { label: 'Pre-auth pending', tint: 'border-primary/20 bg-primary-soft text-accent',    icon: Hourglass,   order: 2, sub: 'Drafted, awaiting insurer' },
  pre_auth_approved: { label: 'Pre-auth approved',tint: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',          icon: ShieldCheck, order: 3, sub: 'In stay · final claim pending' },
  claim_submitted:   { label: 'Claim submitted',  tint: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',    icon: Send,        order: 4, sub: 'Awaiting settlement' },
  queried:           { label: 'Query',            tint: 'border-red-200 bg-red-50 text-red-700',             icon: AlertTriangle,order: 5,sub: 'Insurer needs reply' },
  settled:           { label: 'Settled',          tint: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2, order: 6, sub: 'Paid by insurer' },
  denied:            { label: 'Denied',           tint: 'border-slate-300 bg-slate-100 text-slate-700',      icon: ShieldAlert, order: 7, sub: 'Claim rejected' },
}

function hoursAgo(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3600000)
}

function fmtAge(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${Math.round(h)}h`
  const d = Math.floor(h / 24)
  return `${d}d ${Math.round(h % 24)}h`
}

// SLA thresholds (hours) — over these, the case is "stale" and flagged amber.
const SLA_HOURS: Partial<Record<CashlessStage, number>> = {
  registered:        2,    // should draft pre-auth within 2h of intake
  pre_auth_pending:  8,    // insurer SLA is typically 4-6h, hard breach at 8h
  pre_auth_approved: 72,   // ALOS-like — claim shouldn't be stuck pre-discharge >3d
  claim_submitted:   168,  // 7 days for settlement is the IRDAI target
  queried:           24,   // we should reply to a query within 1 day
}

function buildCases(opts: {
  patients: ReturnType<typeof usePatientStore.getState>['patients']
  inpatients: ReturnType<typeof useInpatientStore.getState>['inpatients']
  bills: ReturnType<typeof useBillingStore.getState>['bills']
  claims: ReturnType<typeof useInsuranceStore.getState>['claims']
}): CashlessCase[] {
  const { patients, inpatients, bills, claims } = opts
  const out = new Map<string, CashlessCase>()

  // Pass 1: cashless walk-ins flagged at intake (no claim yet).
  for (const p of patients) {
    if (!p.insurer) continue
    out.set(p.id, {
      patientId: p.id,
      patientName: p.name,
      insurer: p.insurer,
      stage: 'registered',
      diagnosis: p.symptoms[0],
      enteredStageAt: new Date().toISOString(),  // approximate — no enteredStageAt persisted yet
      source: 'walk_in',
    })
  }

  // Pass 2: inpatients with cashless billing.
  for (const ip of inpatients) {
    const bill = bills.find(b => b.patientId === ip.patientId)
    const cashless = bill?.payerType?.toLowerCase().includes('cashless')
    if (!cashless) continue
    const existing = out.get(ip.patientId)
    out.set(ip.patientId, {
      patientId: ip.patientId,
      patientName: ip.name,
      insurer: existing?.insurer ?? bill?.payerType?.replace(/^Cashless \(|\)$/g, '').trim() ?? 'Cashless',
      stage: existing?.stage ?? 'registered',
      diagnosis: ip.diagnosis,
      wardBed: `${ip.ward} · Bed ${ip.bed}`,
      enteredStageAt: existing?.enteredStageAt ?? ip.admittedAt,
      source: 'admitted',
    })
  }

  // Pass 3: claims — these win over walk-ins / admissions for stage info.
  for (const c of claims) {
    const key = c.patientId ?? `claim:${c.id}`
    const existing = out.get(key)
    const baseTime = c.submittedAt ?? new Date().toISOString()

    // Map claim status → cashless stage.
    let stage: CashlessStage = existing?.stage ?? 'registered'
    if (c.status === 'Rejected') stage = 'denied'
    else if (c.aiDenialRisk && c.aiDenialRisk.score >= 70 && c.status === 'In Process') stage = 'queried'
    else if (c.submissionStatus === 'submitted' && c.status === 'Approved' && (c.approvedAmount ?? 0) > 0) stage = 'settled'
    else if (c.submissionStatus === 'submitted') stage = 'claim_submitted'
    else if (c.status === 'Approved') stage = 'pre_auth_approved'
    else if (c.status === 'In Process' || c.status === 'Pending Pre-Auth') stage = 'pre_auth_pending'

    out.set(key, {
      patientId: c.patientId ?? key,
      patientName: c.patientName,
      insurer: c.provider,
      policyNumber: c.policyNumber,
      stage,
      amount: c.amount,
      approvedAmount: c.approvedAmount,
      claimId: c.id,
      tpaRef: c.tpaReferenceId,
      denialRisk: c.aiDenialRisk?.score,
      diagnosis: existing?.diagnosis ?? c.diagnosis,
      wardBed: existing?.wardBed,
      enteredStageAt: baseTime,
      source: existing?.source ?? 'claim_only',
    })
  }

  return Array.from(out.values()).sort((a, b) => {
    // Stale first by SLA breach, then by oldest in current stage.
    const aSlaH = SLA_HOURS[a.stage] ?? Infinity
    const bSlaH = SLA_HOURS[b.stage] ?? Infinity
    const aBreach = hoursAgo(a.enteredStageAt) > aSlaH
    const bBreach = hoursAgo(b.enteredStageAt) > bSlaH
    if (aBreach !== bBreach) return aBreach ? -1 : 1
    return STAGE_META[a.stage].order - STAGE_META[b.stage].order
  })
}

// ── Component ──────────────────────────────────────────────────────────

export function LiveCashlessMonitor() {
  const patients = usePatientStore(s => s.patients)
  const inpatients = useInpatientStore(s => s.inpatients)
  const bills = useBillingStore(s => s.bills)
  const claims = useInsuranceStore(s => s.claims)

  const cases = useMemo(() => buildCases({ patients, inpatients, bills, claims }),
    [patients, inpatients, bills, claims])

  const [stageFilter, setStageFilter] = useState<'all' | CashlessStage>('all')

  const filtered = stageFilter === 'all' ? cases : cases.filter(c => c.stage === stageFilter)

  // Aggregate counts per stage for the filter chips.
  const counts: Record<CashlessStage, number> = {
    registered: 0, pre_auth_pending: 0, pre_auth_approved: 0,
    claim_submitted: 0, queried: 0, settled: 0, denied: 0,
  }
  for (const c of cases) counts[c.stage]++

  const breachCount = cases.filter(c => {
    const sla = SLA_HOURS[c.stage]
    return sla != null && hoursAgo(c.enteredStageAt) > sla
  }).length

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="text-sm font-bold text-slate-900">Live cashless monitor</h2>
          <span className="text-[11px] font-bold text-slate-500">{cases.length} active</span>
          {breachCount > 0 && (
            <span className="text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />{breachCount} SLA breach
            </span>
          )}
        </div>
        <Link href="/insurance/claims" className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
          Open claims <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stage filter chips */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setStageFilter('all')}
          className={cn("text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer",
            stageFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
          All <span className="text-slate-400 font-bold">{cases.length}</span>
        </button>
        {(Object.keys(STAGE_META) as CashlessStage[]).sort((a, b) => STAGE_META[a].order - STAGE_META[b].order).map(s => {
          const meta = STAGE_META[s]
          const Icon = meta.icon
          return (
            <button key={s} onClick={() => setStageFilter(s)}
              className={cn("text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1",
                stageFilter === s ? meta.tint + ' ring-1 ring-current' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')}>
              <Icon className="h-2.5 w-2.5" />
              {meta.label} <span className="text-slate-400">{counts[s]}</span>
            </button>
          )
        })}
      </div>

      {/* Cases list */}
      <div className="divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">No cashless cases in this view</p>
            <p className="text-xs text-slate-400 mt-0.5">Cases appear here automatically when reception flags an insurance walk-in or admits a cashless patient.</p>
          </div>
        ) : filtered.map((c, i) => {
          const meta = STAGE_META[c.stage]
          const Icon = meta.icon
          const hrsInStage = hoursAgo(c.enteredStageAt)
          const sla = SLA_HOURS[c.stage]
          const stale = sla != null && hrsInStage > sla
          const due = sla != null && hrsInStage > sla * 0.75 && !stale
          return (
            <motion.div key={`${c.patientId}-${i}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="px-4 py-3 hover:bg-slate-50/60 flex items-start gap-3 flex-wrap">
              <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 border", meta.tint)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-900">{c.patientName}</p>
                  <span className="text-[11px] font-bold text-slate-400">{c.patientId}</span>
                  <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border", meta.tint)}>{meta.label}</span>
                  {c.claimId && <span className="text-[10px] text-slate-500 font-mono">{c.claimId}</span>}
                  {c.tpaRef && <span className="text-[10px] text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] px-1.5 py-0.5 rounded">TPA {c.tpaRef}</span>}
                  {c.denialRisk != null && c.denialRisk >= 60 && (
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" />Risk {c.denialRisk}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  <ShieldCheck className="inline h-3 w-3 text-[var(--color-accent)] mr-1" />
                  <b>{c.insurer}</b>
                  {c.policyNumber && <span className="text-slate-400 font-mono"> · {c.policyNumber}</span>}
                </p>
                {c.diagnosis && (
                  <p className="text-[11.5px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5 flex-shrink-0" />{c.diagnosis}
                  </p>
                )}
                {c.wardBed && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Bed className="h-2.5 w-2.5 flex-shrink-0" />{c.wardBed}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                {c.amount != null && (
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-0.5">
                    <IndianRupee className="h-3 w-3" />{c.amount.toLocaleString('en-IN')}
                  </p>
                )}
                {c.approvedAmount != null && c.approvedAmount > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700">
                    Approved ₹{c.approvedAmount.toLocaleString('en-IN')}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <Clock className={cn("h-3 w-3", stale ? 'text-red-600' : due ? 'text-amber-600' : 'text-slate-400')} />
                  <span className={cn("text-[11px] font-bold", stale ? 'text-red-700' : due ? 'text-amber-700' : 'text-slate-500')}>
                    {fmtAge(hrsInStage)} in stage
                  </span>
                </div>
                {sla != null && (
                  <p className={cn("text-[10px]", stale ? 'text-red-600 font-bold' : 'text-slate-400')}>
                    SLA {fmtAge(sla)}{stale ? ' · breached' : ''}
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
