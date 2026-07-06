"use client"

/* Quick Actions — secondary actions moved off the main dashboard into a
 * right-side drawer so the home screen stays clean and focused. The trigger
 * button lives in the dashboard header; the drawer reuses the shared SideDrawer
 * primitive. */

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  LayoutGrid, Salad, MessageSquareText, FileText, CalendarPlus, Video, CreditCard,
  HeartPulse, ChevronRight, type LucideIcon,
} from "lucide-react"
import { SideDrawer } from "@/components/ui/SideDrawer"

const ACTIONS: { icon: LucideIcon; label: string; sub: string; href: string }[] = [
  { icon: Salad, label: "Diet plan", sub: "Personalized nutrition", href: "/patient/followup" },
  { icon: MessageSquareText, label: "Ask AI", sub: "Health companion", href: "/patient/assistant" },
  { icon: FileText, label: "My reports", sub: "Results & documents", href: "/patient/records" },
  { icon: CalendarPlus, label: "Book visit", sub: "AI-suggested slot", href: "/patient/appointments" },
  { icon: Video, label: "Teleconsultation", sub: "Video visit", href: "/patient/teleconsult" },
  { icon: CreditCard, label: "Pay bill", sub: "View & settle dues", href: "/patient/billing" },
  { icon: HeartPulse, label: "Follow-up care", sub: "Plan your next steps", href: "/patient/followup" },
]

export function QuickActionsDrawer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open quick actions"
        className="u-press inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 t-label text-foreground-muted shadow-sm transition-colors hover:bg-surface-sunken"
      >
        <LayoutGrid className="h-4 w-4 text-accent" aria-hidden="true" />
        <span className="hidden sm:inline">Quick actions</span>
      </button>

      <SideDrawer
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="Quick actions"
        description="Everything you might need, one tap away"
        icon={LayoutGrid}
        width="sm"
      >
        <ul className="p-3">
          {ACTIONS.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => go(a.href)}
                className="u-row flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left"
              >
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <a.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block t-body font-semibold text-foreground">{a.label}</span>
                  <span className="block t-caption text-foreground-lighter">{a.sub}</span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-foreground-placeholder" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </SideDrawer>
    </>
  )
}
