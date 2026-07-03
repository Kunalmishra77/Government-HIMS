"use client"

import { Sparkles } from "lucide-react"

export function ComingSoon({ title, note, Icon }: { title: string; note: string; Icon: React.ElementType }) {
  return (
    <div className="max-w-3xl mx-auto pb-10">
      <h1 className="text-[24px] font-bold text-slate-900 tracking-tight mb-5">{title}</h1>
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-10 text-center">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
          <Icon className="h-8 w-8 text-white" />
        </div>
        <p className="text-[17px] font-bold text-slate-900">{title}</p>
        <p className="text-[14px] text-slate-500 mt-1 max-w-sm mx-auto">{note}</p>
        <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-semibold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] px-3 py-1.5 rounded-full">
          <Sparkles className="h-3.5 w-3.5" /> Being built next
        </span>
      </div>
    </div>
  )
}
