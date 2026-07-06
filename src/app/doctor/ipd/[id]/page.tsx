"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Droplet, AlertTriangle, ShieldAlert, BedDouble, CalendarClock } from "lucide-react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { CONDITION_TINT, STAGE_LABEL, fmtDay } from "@/lib/ipdFormat"
import { ipdInsights } from "@/lib/earlyWarning"
import {
  OverviewTab, TimelineTab, RoundsTab, MedsTab, OrdersTab, ProcedureTab, ReferralsTab, DischargeTab, DietBadge,
} from "@/components/doctor/ipd/chart"
import { ERHandoverPanel } from "@/components/doctor/ipd/ERHandoverPanel"
import { cn } from "@/lib/utils"

const TABS = ['Overview', 'Timeline', 'Rounds', 'Medications', 'Orders & Results', 'Procedure', 'Referrals', 'Discharge'] as const
type Tab = typeof TABS[number]
const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

export default function InpatientChart() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const ip = useInpatientStore(s => s.inpatients.find(p => p.patientId === id))
  const [tab, setTab] = useState<Tab>('Overview')
  const [mounted, setMounted] = useState(false)

  // The chart renders client-store data with absolute timestamps; defer to after
  // mount so the server pass and first client render match (no hydration drift).
  useEffect(() => { setMounted(true) }, [])

  // Bug C fix — a doctor can land directly on a specific patient's chart (e.g.
  // via a notification link) without visiting the ward list first; hydrate
  // real ipd_stays rows here too so a direct deep-link still finds a
  // genuinely-newly-admitted real patient.
  useEffect(() => {
    void useInpatientStore.getState().hydrateReal()
  }, [])
  if (!mounted) return (
    <div className="h-full flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-4 border-[rgba(8,145,178,0.20)] border-t-blue-600 animate-spin" role="status" aria-label="Loading chart" />
    </div>
  )

  if (!ip) return (
    <div className="p-8 text-slate-500">
      Patient not found. <button onClick={() => router.push('/doctor/ipd')} className="text-[var(--color-primary)] font-semibold">Back to IPD</button>
    </div>
  )

  const ins = ipdInsights(ip)
  const overviewInsight = `${ins.flag} — NEWS ${ins.news.score}${ins.news.partial ? '*' : ''}. Suggested: ${ins.actions[0]}`

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0">
      {/* Summary rail */}
      <aside className="lg:w-72 flex-shrink-0 rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5 overflow-y-auto">
        <button onClick={() => router.push('/doctor/ipd')} className="text-[12.5px] font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> All inpatients</button>
        <div className="flex items-center gap-3 mb-4">
          <span className={cn("h-12 w-12 rounded-2xl text-white flex items-center justify-center font-bold text-[16px]", ip.condition === 'Critical' ? 'bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)]')}>{initials(ip.name)}</span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-slate-900 leading-tight truncate">{ip.name}</p>
            <p className="text-[12.5px] text-slate-500">{ip.patientId} · {ip.age}y · {ip.gender}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", CONDITION_TINT[ip.condition])}>{ip.condition}</span>
          <span className="text-[11px] font-semibold text-slate-500">{STAGE_LABEL[ip.stage]}</span>
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", ins.risk === 'high' ? 'bg-red-100 text-red-700' : ins.risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')} title="Early-warning score (partial — RR/consciousness not captured)">NEWS {ins.news.score}{ins.news.partial ? '*' : ''}</span>
        </div>

        <Field icon={BedDouble} label="Location" value={`${ip.ward} · Bed ${ip.bed}`} />
        <Field icon={CalendarClock} label="Admitted" value={`${fmtDay(ip.admittedAt)}${ip.expectedDischarge ? ` · exp. discharge ${ip.expectedDischarge}` : ''}`} />
        <Field icon={ShieldAlert} label="Code status" value={ip.codeStatus ?? 'Full code'} />

        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1.5 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Allergies</p>
          <div className="flex flex-wrap gap-1.5">
            {(ip.allergies ?? ['No known drug allergies']).map(a => <span key={a} className="text-[12px] font-medium bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full">{a}</span>)}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1"><Droplet className="h-3 w-3 text-red-400" /> Comorbidities</p>
          <div className="flex flex-wrap gap-1.5">
            {(ip.comorbidities ?? []).map(c => <span key={c} className="text-[12px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{c}</span>)}
            {!ip.comorbidities?.length && <span className="text-[12px] text-slate-400">None</span>}
          </div>
        </div>
        <div className="mt-4"><DietBadge ip={ip} /></div>

        {/* M13.11 — ER handover summary on the chart sidebar. Self-hides
            when patient didn't come through ER (admit-from-OPD path). */}
        <div className="mt-4">
          <ERHandoverPanel patientId={ip.patientId} />
        </div>
      </aside>

      {/* Tabbed chart */}
      <section className="flex-1 min-w-0 flex flex-col rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn("px-3 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition", t === tab ? "bg-[rgba(8,145,178,0.07)] text-[var(--color-primary)]" : "text-slate-500 hover:text-slate-700")}>{t}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'Overview' && <OverviewTab ip={ip} insight={overviewInsight} />}
          {tab === 'Timeline' && <TimelineTab ip={ip} />}
          {tab === 'Rounds' && <RoundsTab ip={ip} />}
          {tab === 'Medications' && <MedsTab ip={ip} />}
          {tab === 'Orders & Results' && <OrdersTab ip={ip} />}
          {tab === 'Procedure' && <ProcedureTab ip={ip} />}
          {tab === 'Referrals' && <ReferralsTab ip={ip} />}
          {tab === 'Discharge' && <DischargeTab ip={ip} />}
        </div>
      </section>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 mb-2.5">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="text-[12.5px] text-slate-700">{value}</p></div>
    </div>
  )
}
