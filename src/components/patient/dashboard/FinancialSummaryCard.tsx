"use client"

/* Financial Summary — a single, clear picture of the patient's healthcare
 * spend for this episode: total billed, what they've paid, what's outstanding,
 * and how their private insurance and Ayushman Bharat (PM-JAY) cover offsets
 * the bill — including the remaining PM-JAY balance. From usePatientFinanceStore. */

import { useRouter } from "next/navigation"
import { Wallet, CreditCard, ShieldCheck, HeartHandshake, ArrowRight } from "lucide-react"
import {
  usePatientFinanceStore, outstanding, ayushmanRemaining,
} from "@/store/usePatientFinanceStore"

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`

function Stat({ label, value, accent }: { label: string; value: string; accent?: "danger" | "default" }) {
  return (
    <div className="rounded-2xl bg-surface-sunken px-4 py-3">
      <p className="t-overline text-foreground-lighter">{label}</p>
      <p className={`t-kpi mt-1 ${accent === "danger" ? "text-danger" : "text-foreground"}`}>{value}</p>
    </div>
  )
}

function CoverageRow({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="inline-flex items-center gap-2 t-body text-foreground-muted">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        {label}
      </span>
      <span className="t-body t-numeric font-semibold text-foreground">{value}</span>
    </div>
  )
}

export function FinancialSummaryCard() {
  const router = useRouter()
  const f = usePatientFinanceStore()
  const due = outstanding(f)
  const ayushmanLeft = ayushmanRemaining(f)
  const ayushmanPct = Math.min(100, Math.round((f.ayushmanUsed / f.ayushmanLimit) * 100))

  return (
    <section className="hms-card p-5 sm:p-6" aria-label="Financial summary">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
          <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <h3 className="t-h3 text-foreground">Financial summary</h3>
      </header>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Total" value={inr(f.totalExpenses)} />
        <Stat label="Paid" value={inr(f.amountPaid)} />
        <Stat label="Outstanding" value={inr(due)} accent={due > 0 ? "danger" : "default"} />
      </div>

      <div className="mt-4 divide-y divide-border border-y border-border">
        <CoverageRow icon={ShieldCheck} label={`Insurance${f.insurer ? ` · ${f.insurer}` : ""}`} value={inr(f.insuranceCovered)} />
        <CoverageRow icon={HeartHandshake} label="Ayushman Bharat used" value={inr(f.ayushmanUsed)} />
      </div>

      {/* Ayushman (PM-JAY) eligible-limit usage. */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="t-caption font-semibold text-foreground-muted">Ayushman balance remaining</span>
          <span className="t-caption t-numeric font-semibold text-success">{inr(ayushmanLeft)} of {inr(f.ayushmanLimit)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={ayushmanPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-success" style={{ width: `${ayushmanPct}%` }} />
        </div>
        <p className="t-caption mt-1 text-foreground-lighter">{ayushmanPct}% of your annual PM-JAY limit used</p>
      </div>

      {due > 0 && (
        <button
          type="button"
          onClick={() => router.push("/patient/billing")}
          className="u-press mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 t-label text-[#0D2032] transition-colors hover:bg-primary-dark"
        >
          <CreditCard className="h-4 w-4" /> Pay {inr(due)} now <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </section>
  )
}
