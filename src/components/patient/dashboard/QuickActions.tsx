"use client"

import { useRouter } from "next/navigation"
import { CalendarPlus, Video, CreditCard, FileText, Salad, MessageSquareText } from "lucide-react"

const ACTIONS = [
  { icon: CalendarPlus, label: "Book visit", sub: "AI best slot", href: "/patient/appointments", tint: "from-[var(--color-primary)] to-[var(--color-primary-dark)]" },
  { icon: Video, label: "Teleconsult", sub: "Video visit", href: "/patient/teleconsult", tint: "from-[var(--color-primary)] to-[var(--color-primary-light)]" },
  { icon: CreditCard, label: "Pay bill", sub: "View dues", href: "/patient/billing", tint: "from-amber-500 to-primary" },
  { icon: FileText, label: "My reports", sub: "Results & docs", href: "/patient/records", tint: "from-[var(--color-primary)] to-[var(--color-primary-light)]" },
  { icon: Salad, label: "Diet plan", sub: "Personalized", href: "/patient/followup", tint: "from-green-500 to-emerald-500" },
  { icon: MessageSquareText, label: "Ask AI", sub: "Health companion", href: "/patient/assistant", tint: "from-[var(--color-primary)] to-[var(--color-primary-light)]" },
]

export function QuickActions() {
  const router = useRouter()
  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
      <h3 className="text-[15px] font-bold text-slate-900 mb-3">Quick actions</h3>
      <div className="grid grid-cols-3 gap-2.5">
        {ACTIONS.map(a => {
          const Icon = a.icon
          return (
            <button key={a.label} onClick={() => router.push(a.href)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
              <span className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${a.tint} flex items-center justify-center`}><Icon className="h-5 w-5 text-white" /></span>
              <span className="text-center leading-tight">
                <span className="block text-[12.5px] font-semibold text-slate-900">{a.label}</span>
                <span className="block text-[10.5px] text-slate-400">{a.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
