"use client"

import { Clock, Sparkles } from "lucide-react"
import { nextRound, type Inpatient } from "@/store/useInpatientStore"
import { CONDITION_TINT, STAGE_LABEL } from "@/lib/ipdFormat"
import { ActionsMenu, type IpdAction } from "./ActionsMenu"
import { cn } from "@/lib/utils"

const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

function admittedSince(iso: string): string {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}

export function dueChip(ip: Inpatient): { text: string; due: boolean } {
  const n = nextRound(ip)
  if (!n) return { text: 'No round', due: false }
  const mins = Math.round((new Date(n.scheduledAt).getTime() - Date.now()) / 60000)
  if (mins <= 0) return { text: mins < -60 ? `due ${Math.round(-mins / 60)}h ago` : 'DUE now', due: true }
  return { text: mins >= 60 ? `in ~${Math.floor(mins / 60)}h ${mins % 60}m` : `in ~${mins}m`, due: false }
}

export function InpatientRow({ ip, aiFlag, onPeek, onAction }: {
  ip: Inpatient
  aiFlag?: { text: string; tone: 'low' | 'medium' | 'high' } | null
  onPeek: () => void
  onAction: (a: IpdAction) => void
}) {
  const dl = dueChip(ip)
  return (
    <tr onClick={onPeek} className="border-b border-slate-50 last:border-0 hover:bg-[rgba(238,107,38,0.10)]/40 cursor-pointer transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn("h-9 w-9 rounded-xl text-white flex items-center justify-center font-bold text-[12.5px] flex-shrink-0",
            ip.condition === 'Critical' ? 'bg-gradient-to-br from-red-500 to-rose-600' : ip.ward === 'ICU' ? 'bg-gradient-to-br from-rose-500 to-primary' : 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)]')}>{initials(ip.name)}</span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-slate-900 truncate">{ip.name} <span className="text-[11.5px] font-medium text-slate-400">· {ip.age}y</span></p>
            <p className="text-[11.5px] text-slate-400 truncate">{ip.patientId} · admitted {admittedSince(ip.admittedAt)} ago</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-[12.5px] text-slate-600">{ip.ward}<span className="text-slate-400"> · {ip.bed}</span></td>
      <td className="px-4 py-3"><span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", CONDITION_TINT[ip.condition])}>{ip.condition}</span></td>
      <td className="px-4 py-3 whitespace-nowrap text-[12px] text-slate-500">{STAGE_LABEL[ip.stage]}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={cn("inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full", dl.due ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>
          <Clock className="h-3 w-3" /> {dl.text}
        </span>
      </td>
      <td className="px-4 py-3 max-w-[200px]">
        {aiFlag ? (
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
            aiFlag.tone === 'high' ? "bg-red-50 text-red-700" : aiFlag.tone === 'medium' ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
            <Sparkles className="h-3 w-3" /> <span className="truncate">{aiFlag.text}</span>
          </span>
        ) : <span className="text-slate-300 text-[12px]">—</span>}
      </td>
      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
        <ActionsMenu onAction={onAction} />
      </td>
    </tr>
  )
}
