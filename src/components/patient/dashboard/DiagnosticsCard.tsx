"use client"

/* Diagnostics & Reports — the patient's laboratory tests and radiology scans in
 * one place: what's pending, what's completed, and the verified reports they can
 * view, download or share without leaving the dashboard. From
 * usePatientDiagnosticsStore. Weaves a "report ready" nudge inline. */

import { useRouter } from "next/navigation"
import {
  FlaskConical, ScanLine, Eye, Download, Share2, CheckCircle2, Bell, type LucideIcon,
} from "lucide-react"
import {
  usePatientDiagnosticsStore, byKind, pendingItems, completedItems,
  STATUS_LABEL, type DiagnosticItem, type DiagnosticKind, type DiagnosticStatus,
} from "@/store/usePatientDiagnosticsStore"
import { useAuditStore } from "@/store/useAuditStore"
import { usePatientMe } from "@/lib/usePatientMe"
import { cn } from "@/lib/utils"

const STATUS_CHIP: Record<DiagnosticStatus, string> = {
  completed: "chip-success",
  processing: "chip-info",
  sample_collected: "chip-accent",
  ordered: "chip-neutral",
}

function Group({
  kind, icon: Icon, title, items, onAction,
}: {
  kind: DiagnosticKind
  icon: LucideIcon
  title: string
  items: DiagnosticItem[]
  onAction: (action: "view" | "download" | "share", item: DiagnosticItem) => void
}) {
  const group = byKind(items, kind)
  if (group.length === 0) return null
  const done = completedItems(group).length
  const pending = pendingItems(group).length

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <h4 className="t-title text-foreground">{title}</h4>
        <span className="t-caption text-foreground-lighter">{done} done · {pending} pending</span>
      </div>
      <ul className="space-y-1.5">
        {group.map((d) => (
          <li key={d.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="t-body font-semibold text-foreground truncate">{d.name}</p>
                <span className={cn("chip flex-shrink-0", STATUS_CHIP[d.status])}>
                  {d.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {STATUS_LABEL[d.status]}
                </span>
              </div>
              {d.summary && <p className="t-caption mt-0.5 text-foreground-muted truncate">{d.summary}</p>}
            </div>
            {d.reportAvailable && (
              <div className="flex flex-shrink-0 items-center gap-1">
                <button type="button" onClick={() => onAction("view", d)} aria-label={`View ${d.name} report`} title="View"
                  className="u-press grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-accent-soft text-accent transition-colors hover:bg-primary hover:text-[#0D2032]">
                  <Eye className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onAction("download", d)} aria-label={`Download ${d.name} report`} title="Download"
                  className="u-press grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-sunken">
                  <Download className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onAction("share", d)} aria-label={`Share ${d.name} report`} title="Share"
                  className="u-press grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-border text-foreground-muted transition-colors hover:bg-surface-sunken">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DiagnosticsCard() {
  const router = useRouter()
  const { me } = usePatientMe()
  const items = usePatientDiagnosticsStore((s) => s.items)
  const log = useAuditStore((s) => s.log)

  const ready = items.filter((d) => d.reportAvailable)

  function onAction(action: "view" | "download" | "share", item: DiagnosticItem) {
    log({
      action: `patient_report_${action}`, resource: "diagnostic_report", resourceId: item.id,
      detail: `Patient ${action}ed report: ${item.name}.`,
      userId: me?.id ?? "patient", userName: me?.name ?? "Patient",
    })
    if (action === "view") {
      router.push(item.reportUrl ?? "/patient/records")
    } else if (action === "download") {
      const text = `Agentix HIMS — ${item.name}\n${"=".repeat(28)}\nStatus: ${STATUS_LABEL[item.status]}\n${item.summary ?? ""}`
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${item.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } else if (typeof navigator !== "undefined") {
      const shareText = `My ${item.name} report from Agentix HIMS`
      if (navigator.share) navigator.share({ title: item.name, text: shareText })
      else navigator.clipboard?.writeText(shareText)
    }
  }

  return (
    <section className="hms-card p-4 sm:p-5" aria-label="Diagnostics and reports">
      <header className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="t-title text-foreground">Diagnostics &amp; reports</h3>
        {ready.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 t-caption font-semibold text-accent">
            <Bell className="h-3.5 w-3.5" aria-hidden="true" /> {ready.length} ready
          </span>
        )}
      </header>

      <div className="space-y-3">
        <Group kind="lab" icon={FlaskConical} title="Laboratory" items={items} onAction={onAction} />
        <Group kind="radiology" icon={ScanLine} title="Radiology" items={items} onAction={onAction} />
      </div>
    </section>
  )
}
