"use client"

import { Phone, Ambulance, MapPin, MessageSquareText, ChevronDown, Siren } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const CONTACTS = [
  { icon: Phone, label: 'Hospital reception', value: '+91 80 1234 5678', tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  { icon: MessageSquareText, label: 'WhatsApp help desk', value: '+91 98765 00000', tint: 'bg-green-50 text-green-600' },
  { icon: MapPin, label: 'Directions', value: 'Agentix HIMS, MG Road', tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
]

const FAQ = [
  { q: 'How do I know when it’s my turn?', a: 'Your dashboard updates live and you’ll get a notification (and WhatsApp) the moment you’re called — with the exact room.' },
  { q: 'Can my family see my status?', a: 'Yes, if you’ve given consent. They get a private link showing non-clinical status only — no diagnoses or results.' },
  { q: 'Is the AI making decisions about me?', a: 'No. AI only assists — every clinical decision is made and approved by your doctor. See “AI in my Care” for full transparency.' },
]

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Help &amp; Emergency</h1>
        <p className="text-[13px] text-slate-500 mt-1">Get help fast — anytime during your care</p>
      </div>

      {/* Emergency */}
      <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_10px_30px_rgba(239,68,68,0.3)]">
        <div className="flex items-center gap-2 mb-1"><Siren className="h-5 w-5" /><span className="text-[13px] font-bold uppercase tracking-wider text-white/80">Emergency</span></div>
        <p className="text-[15px] text-white/90 mb-4">If this is a medical emergency, get help immediately.</p>
        <div className="flex gap-3">
          <a href="tel:102" className="flex-1 bg-white text-red-600 font-bold text-[15px] rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"><Phone className="h-5 w-5" /> Call 102</a>
          <button className="flex-1 bg-white/15 text-white font-bold text-[15px] rounded-2xl py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"><Ambulance className="h-5 w-5" /> Request ambulance</button>
        </div>
      </div>

      {/* Contacts */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3">Contact us</h3>
        <div className="space-y-2">
          {CONTACTS.map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", c.tint)}><Icon className="h-5 w-5" /></span>
                <div className="flex-1"><p className="text-[14px] font-semibold text-slate-900">{c.label}</p><p className="text-[13px] text-slate-500">{c.value}</p></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-2">Common questions</h3>
        <div className="divide-y divide-slate-100">
          {FAQ.map((f, i) => (
            <div key={i} className="py-3">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between text-left">
                <span className="text-[14px] font-semibold text-slate-900 pr-4">{f.q}</span>
                <ChevronDown className={cn("h-4.5 w-4.5 text-slate-400 flex-shrink-0 transition-transform", open === i && "rotate-180")} />
              </button>
              {open === i && <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
