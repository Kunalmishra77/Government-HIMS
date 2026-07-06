"use client"

/* Prescriptions & Medicines — the patient's latest prescription, their active
 * medicines with a morning/afternoon/night schedule, refill status, pharmacy
 * fulfilment status, and one-tap download/print of the e-prescription.
 * Derived from the doctor's orders (usePatientOrdersStore) + the patient's
 * profile (usePatientMe). Weaves a contextual refill nudge inline. */

import { useMemo } from "react"
import {
  Pill, Sun, CloudSun, Moon, Download, Printer, Truck, AlertTriangle, Clock,
  CircleCheck, Bell, RefreshCw,
} from "lucide-react"
import { usePatientOrdersStore, acceptedItems, type OrderItem } from "@/store/usePatientOrdersStore"
import { useAuditStore } from "@/store/useAuditStore"
import { usePatientMe } from "@/lib/usePatientMe"
import { cn } from "@/lib/utils"

interface Med {
  item: OrderItem
  morning: number
  afternoon: number
  night: number
  days?: number
}

function parse(item: OrderItem): Med {
  const dose = item.detail.match(/(\d)-(\d)-(\d)/)
  const days = item.detail.match(/(\d+)\s*days/)
  return {
    item,
    morning: dose ? +dose[1] : 0,
    afternoon: dose ? +dose[2] : 0,
    night: dose ? +dose[3] : 0,
    days: days ? +days[1] : undefined,
  }
}

function SlotDot({ icon: Icon, on, label }: { icon: typeof Sun; on: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-lg",
        on ? "bg-accent-soft text-accent" : "bg-surface-sunken text-foreground-placeholder",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  )
}

export function PrescriptionsCard() {
  const { me } = usePatientMe()
  const items = usePatientOrdersStore((s) => s.items)
  const doctor = usePatientOrdersStore((s) => s.doctor)
  const received = usePatientOrdersStore((s) => s.received)
  const receivedAt = usePatientOrdersStore((s) => s.receivedAt)
  const paid = usePatientOrdersStore((s) => s.paid)
  const log = useAuditStore((s) => s.log)

  const meds = useMemo(() => acceptedItems(items).filter((i) => i.kind === "medicine").map(parse), [items])
  const refillSoon = meds.filter((m) => (m.days ?? 99) <= 10)

  const rxDate = receivedAt
    ? new Date(receivedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Today"

  const pharmacy = !received
    ? { label: "Awaiting consultation", cls: "chip-neutral", icon: Clock }
    : !paid
      ? { label: "Awaiting payment", cls: "chip-warning", icon: AlertTriangle }
      : { label: "Order placed · preparing", cls: "chip-success", icon: Truck }

  function downloadRx() {
    const lines = [
      "Agentix HIMS — e-Prescription",
      "================================",
      `Patient: ${me?.name ?? "Patient"}${me?.uhid ? ` (UHID ${me.uhid})` : ""}`,
      `Prescribed by: ${doctor}`,
      `Date: ${rxDate}`,
      "",
      "Medicines:",
      ...meds.map((m) => `  • ${m.item.name} — ${m.item.detail}`),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `e-prescription-${me?.uhid ?? "patient"}.txt`
    a.click()
    URL.revokeObjectURL(url)
    log({
      action: "patient_download", resource: "e_prescription", resourceId: me?.id ?? "anon",
      detail: `Patient downloaded e-prescription (${meds.length} medicines).`,
      userId: me?.id ?? "patient", userName: me?.name ?? "Patient",
    })
  }

  return (
    <section className="hms-card p-5 sm:p-6" aria-label="Prescriptions and medicines">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <Pill className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="t-h3 text-foreground">Prescriptions &amp; medicines</h3>
            <p className="t-caption text-foreground-lighter">Latest · {doctor} · {rxDate}</p>
          </div>
        </div>
        <span className={cn("chip", pharmacy.cls)}>
          <pharmacy.icon className="h-3.5 w-3.5" /> {pharmacy.label}
        </span>
      </header>

      {refillSoon.length > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-accent-soft px-4 py-2.5">
          <Bell className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
          <p className="t-caption text-foreground-muted">
            <span className="font-semibold text-foreground">{refillSoon[0].item.name}</span> is running low — pre-order so the pharmacy has it ready.
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {meds.map((m) => (
          <li key={m.item.id} className="flex items-center gap-3 rounded-2xl border border-border px-3.5 py-3">
            <div className="min-w-0 flex-1">
              <p className="t-body font-semibold text-foreground truncate">{m.item.name}</p>
              <p className="t-caption text-foreground-lighter truncate">{m.item.detail}</p>
            </div>
            <div className="flex items-center gap-1.5" aria-label="Daily schedule">
              <SlotDot icon={Sun} on={m.morning > 0} label="Morning" />
              <SlotDot icon={CloudSun} on={m.afternoon > 0} label="Afternoon" />
              <SlotDot icon={Moon} on={m.night > 0} label="Night" />
            </div>
            <span className={cn("chip", (m.days ?? 99) <= 10 ? "chip-warning" : "chip-success")}>
              {(m.days ?? 99) <= 10
                ? <><RefreshCw className="h-3.5 w-3.5" /> Refill soon</>
                : <><CircleCheck className="h-3.5 w-3.5" /> On track</>}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={downloadRx}
          className="u-press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 t-label text-[#0D2032] transition-colors hover:bg-primary-dark"
        >
          <Download className="h-4 w-4" /> Download e-Rx
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="u-press inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 t-label text-foreground-muted transition-colors hover:bg-surface-sunken"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
    </section>
  )
}
