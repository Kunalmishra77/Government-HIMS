"use client"

/* CommandPalette — universal search + intent-driven navigation.
 *
 * Press ⌘K / Ctrl+K anywhere in the app. Searches across:
 *   - Patients (by name / HN)         → opens their record in the role context
 *   - Routes  (every page in this role's nav + safe cross-role jumps)
 *   - Staff   (admin / clinical surfaces only)
 *   - Intents ("schedule MRI for Anil", "discharge ready", "show denial-risk
 *              claims") — keyword-matched stubs that route to the right
 *              surface; the actual AI parsing is Phase 2.
 *
 * Mounted in AppShell — every staff role + patient portal gets the same
 * trigger. Existing top-bar Search remains; this is additive.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import {
  Search, X, ArrowRight, User, FileText, LayoutDashboard, Sparkles,
  Pill, FlaskConical, ScanLine, Stethoscope, Bed, ShieldCheck, Receipt,
  Activity, Users, Wallet, Truck,
} from "lucide-react"
import { useAuthStore, type Role } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { cn } from "@/lib/utils"
import { KbdHint } from "@/components/ui/KbdHint"
import { parseIntent } from "@/lib/aiCopilot"
import { CopilotPreviewCard } from "@/components/clinical/CopilotPreviewCard"

type CommandKind = "route" | "patient" | "intent" | "staff"
type CommandItem = {
  id: string
  kind: CommandKind
  label: string
  detail?: string
  hint?: string
  icon: React.ElementType
  go: () => void
  keywords?: string
}

// Top-level routes that EVERY role can deep-link to from the palette.
const UNIVERSAL_ROUTES: { label: string; href: string; icon: React.ElementType; roles?: Role[] | "*" }[] = [
  { label: "Demo settings · reset data", href: "/admin/settings", icon: ShieldCheck, roles: ["admin"] },
  { label: "Audit trail",       href: "/audit/log",            icon: ShieldCheck, roles: ["admin", "audit_officer"] },
  { label: "Compliance cockpit", href: "/admin/compliance",     icon: ShieldCheck, roles: ["admin", "audit_officer", "quality"] },
  { label: "DISHA / DPDP",       href: "/admin/disha",          icon: ShieldCheck, roles: ["admin", "audit_officer"] },
  { label: "Hospital P&L",       href: "/admin/finance",        icon: Wallet,      roles: ["admin"] },
  { label: "Refund queue",        href: "/billing/refunds",      icon: Receipt,     roles: ["admin", "billing"] },
  { label: "Insurance claims",    href: "/insurance/dashboard",  icon: ShieldCheck, roles: ["admin", "billing", "insurance"] },
  { label: "Bed map",              href: "/admission/beds",       icon: Bed,         roles: ["admin", "bed_manager", "nurse", "doctor"] },
  { label: "Doctor OPD",           href: "/doctor/dashboard",     icon: Stethoscope, roles: ["doctor"] },
  { label: "Doctor IPD",           href: "/doctor/ipd",           icon: Stethoscope, roles: ["doctor"] },
  { label: "Lab dashboard",        href: "/lab/dashboard",        icon: FlaskConical, roles: ["lab", "admin"] },
  { label: "Lab · Phlebotomy bench", href: "/lab/phlebotomy",      icon: FlaskConical, roles: ["lab", "admin"] },
  { label: "Lab · Analyzer feed",  href: "/lab/analyzer-feed",    icon: FlaskConical, roles: ["lab", "admin"] },
  { label: "Lab · Pathologist verify", href: "/lab/verify",         icon: ShieldCheck,  roles: ["lab", "admin"] },
  { label: "Lab · Manual entries (fallback)", href: "/lab/benches", icon: FlaskConical, roles: ["lab", "admin"] },
  { label: "Pharmacy queue",       href: "/pharmacy/queue",       icon: Pill,        roles: ["pharmacy", "admin"] },
  { label: "Radiology inbox",      href: "/radiology/inbox",      icon: ScanLine,    roles: ["radiology", "admin"] },
  { label: "Radiology · Scheduling", href: "/radiology/schedule", icon: ScanLine,    roles: ["radiology", "admin"] },
  { label: "Radiology · Arrival desk", href: "/radiology/arrival", icon: ScanLine,   roles: ["radiology", "admin"] },
  { label: "ER triage",            href: "/emergency/triage",     icon: Activity,    roles: ["emergency", "admin"] },
  { label: "Staff directory",      href: "/admin/users",          icon: Users,       roles: ["admin", "doctor", "nurse", "pharmacy", "lab", "radiology", "emergency", "reception", "bed_manager", "discharge", "ot", "billing", "insurance", "quality", "audit_officer"] },
  { label: "Reception OPD",        href: "/reception/opd",        icon: User,        roles: ["reception", "admin"] },
  { label: "Discharge desk",       href: "/discharge/dashboard",  icon: LayoutDashboard, roles: ["discharge", "admin"] },
  { label: "OT live",              href: "/ot/dashboard",         icon: Activity,    roles: ["ot", "admin"] },
  { label: "Ambulance dispatch",   href: "/ambulance/dispatch",   icon: Truck,       roles: ["ambulance", "admin"] },
]

// Intent stubs — match a keyword + route. Phase-2 will parse free text via
// the AI gateway; for now the keyword route is enough to demo intent nav.
const INTENTS: { label: string; href: string; keywords: string }[] = [
  { label: "Schedule a follow-up appointment",   href: "/reception/appointments", keywords: "schedule appointment book follow-up" },
  { label: "Order labs for Anil",                 href: "/doctor/ipd",              keywords: "order labs cbc crp anil" },
  { label: "Check denial-risk claims",             href: "/insurance/dashboard",     keywords: "denial risk insurance claim ai" },
  { label: "Open refund queue (2-step approver)", href: "/billing/refunds",         keywords: "refund approve 2-step approver gate" },
  { label: "NABH evidence cockpit",               href: "/admin/compliance",        keywords: "nabh compliance evidence cockpit" },
  { label: "Bed-demand forecast",                  href: "/admission/forecast",      keywords: "bed forecast demand admission" },
  { label: "Audit trail filtered by Anil",         href: "/audit/log",                keywords: "anil verma audit trail journey" },
  { label: "Patient self check-in (kiosk)",         href: "/checkin",                  keywords: "checkin kiosk self-service patient" },
  { label: "Drug-safety: penicillin allergy",      href: "/doctor/ipd",               keywords: "drug safety penicillin allergy augmentin" },
  { label: "OT WHO checklist (Anil)",              href: "/ot/checklist",             keywords: "ot who checklist sign-in time-out anil" },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [cursor, setCursor] = useState(0)
  const router = useRouter()
  const activeRole = useAuthStore((s) => s.activeRole)
  const patients = usePatientStore((s) => s.patients)
  const inpatients = useInpatientStore((s) => s.inpatients)

  // ── Global keyboard shortcut: ⌘K / Ctrl+K, plus Esc to close ────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Build the unified command index every time the inputs change.
  const items = useMemo<CommandItem[]>(() => {
    const out: CommandItem[] = []

    // Routes (filter by active role; admin sees all)
    for (const r of UNIVERSAL_ROUTES) {
      const allowed = r.roles === "*" || (activeRole && (r.roles ?? []).includes(activeRole)) || activeRole === "admin"
      if (!allowed) continue
      out.push({
        id: `route:${r.href}`,
        kind: "route",
        label: r.label,
        detail: r.href,
        icon: r.icon,
        go: () => router.push(r.href),
      })
    }

    // Patients (Zustand registry + Inpatient store, dedup by id)
    const seen = new Set<string>()
    for (const p of patients ?? []) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      out.push({
        id: `patient:${p.id}`,
        kind: "patient",
        label: p.name,
        detail: `${p.id} · ${p.age}y · ${p.department || p.queueStatus || ''} · journey →`,
        keywords: `${p.id} ${p.phone || ''} ${p.department || ''} journey`,
        icon: User,
        go: () => router.push(`/journey/${p.id}`),
      })
    }
    for (const ip of inpatients ?? []) {
      if (seen.has(ip.patientId)) continue
      seen.add(ip.patientId)
      out.push({
        id: `inpatient:${ip.patientId}`,
        kind: "patient",
        label: ip.name,
        detail: `${ip.patientId} · ${ip.ward} ${ip.bed} · ${ip.diagnosis} · journey →`,
        keywords: `${ip.patientId} ${ip.ward} ${ip.bed} ${ip.diagnosis} journey`,
        icon: User,
        go: () => router.push(`/journey/${ip.patientId}`),
      })
    }

    // Intent stubs
    for (const i of INTENTS) {
      out.push({
        id: `intent:${i.label}`,
        kind: "intent",
        label: i.label,
        detail: i.href,
        keywords: i.keywords,
        icon: Sparkles,
        go: () => router.push(i.href),
      })
    }

    return out
  }, [activeRole, patients, inpatients, router])

  const q = query.trim().toLowerCase()
  const filtered = q.length === 0
    ? items.slice(0, 24)
    : items.filter((it) => {
        const hay = `${it.label} ${it.detail ?? ""} ${it.keywords ?? ""}`.toLowerCase()
        return q.split(/\s+/).every((token) => hay.includes(token))
      }).slice(0, 30)

  // ── S4 — Natural-language Copilot intent ────────────────────────────────
  // Trigger when the user types something verb-like or longer than two words
  // AND we haven't already found a direct exact match in the top result.
  const showCopilot = useMemo(() => {
    if (q.length < 6) return false
    const tokens = q.split(/\s+/)
    if (tokens.length < 3) return false
    return /\b(schedule|book|order|draft|prepare|discharge|show|find|search|summari[sz]e|recap)\b/i.test(q)
  }, [q])
  const intent = useMemo(() => {
    if (!showCopilot) return null
    const registry = [
      ...(patients ?? []).map((p) => ({ id: p.id, name: p.name })),
      ...(inpatients ?? []).map((ip) => ({ id: ip.patientId, name: ip.name })),
    ]
    return parseIntent(query.trim(), { patients: registry })
  }, [showCopilot, query, patients, inpatients])

  function acceptCopilot() {
    if (!intent?.destination) return
    router.push(intent.destination.route)
    setOpen(false)
    setQuery("")
  }

  useEffect(() => { setCursor(0) }, [query, open])

  function selectAt(idx: number) {
    const item = filtered[idx]
    if (!item) return
    item.go()
    setOpen(false)
    setQuery("")
  }

  if (typeof document === "undefined") return null
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh] bg-slate-950/40 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-[min(680px,100%)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)) }
              else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
              else if (e.key === "Enter")   { e.preventDefault(); selectAt(cursor) }
            }}
            placeholder="Search patients, routes, or type an intent (e.g. 'show denial-risk claims')…"
            className="flex-1 bg-transparent outline-none text-[14px] text-slate-900 placeholder:text-slate-400"
            aria-label="Search the hospital"
          />
          <KbdHint keys={['Esc']} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {intent ? (
            <CopilotPreviewCard
              intent={intent}
              onAccept={acceptCopilot}
              onReject={() => setQuery("")}
            />
          ) : null}

          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400">
              <p className="text-[13px] font-medium text-slate-500">No matches</p>
              <p className="text-[11px] mt-1">Try a patient name, a page name, or "show denial-risk claims".</p>
            </div>
          ) : null}

          {filtered.map((it, i) => {
            const Icon = it.icon
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => selectAt(i)}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  "w-full px-4 py-2 flex items-center gap-3 text-left transition-colors",
                  cursor === i ? "bg-primary-soft" : "hover:bg-surface-sunken",
                )}
              >
                <span className={cn(
                  "h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0",
                  it.kind === "patient" ? "bg-accent-soft text-[var(--color-accent)]"
                : it.kind === "intent"  ? "bg-amber-100 text-amber-700"
                : it.kind === "staff"   ? "bg-emerald-100 text-emerald-700"
                                         : "bg-accent-soft text-[var(--color-accent)]"
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 truncate">{it.label}</p>
                  {it.detail ? <p className="text-[11px] text-slate-400 truncate">{it.detail}</p> : null}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 flex-shrink-0">
                  {it.kind}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              </button>
            )
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1"><KbdHint keys={['↑']} /><KbdHint keys={['↓']} /> navigate</span>
            <span className="inline-flex items-center gap-1"><KbdHint keys={['↵']} /> open</span>
            <span className="inline-flex items-center gap-1"><KbdHint keys={['Esc']} /> close</span>
          </div>
          <span className="text-[10px] text-slate-400">{filtered.length} of {items.length}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Inline trigger button — drop into the top bar to show the shortcut. */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window === "undefined") return
        const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
        window.dispatchEvent(event)
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors",
        className,
      )}
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden md:inline">Search anything…</span>
      <span className="hidden md:inline">·</span>
      <KbdHint keys={'K'} />
    </button>
  )
}
