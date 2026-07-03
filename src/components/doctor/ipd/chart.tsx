"use client"

import { useState } from "react"
import { AnimatePresence } from "framer-motion"
import {
  Stethoscope, Pill, FlaskConical, Scissors, ShieldCheck, GitBranch, Activity,
  Plus, Ban, CheckCircle2, Clock, Utensils, AlertTriangle,
} from "lucide-react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"
import { useInpatientStore, lastRound, type Inpatient, type IpdEventType } from "@/store/useInpatientStore"
import { EVENT_META, SEVERITY_DOT, fmtTime, CONDITION_TINT } from "@/lib/ipdFormat"
import { newsTrend } from "@/lib/earlyWarning"
import { SurgeryPanel, DischargePanel, RoundModal, Section } from "./panels"
import { IpdActionModal, type IpdModalKind } from "./ipdModals"
import { cn } from "@/lib/utils"

const card = "rounded-2xl bg-white border border-slate-100 p-4"

// ── Overview ──────────────────────────────────────────────────────
export function OverviewTab({ ip, insight }: { ip: Inpatient; insight?: string | null }) {
  const last = lastRound(ip)
  const v = last?.vitals
  const trend = newsTrend(ip)
  return (
    <div className="space-y-4">
      {insight && (
        <div className="rounded-2xl border border-[rgba(238,107,38,0.20)] bg-surface p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)] mb-1">AI insight</p>
          <p className="text-[13.5px] text-[var(--color-primary-dark)] leading-relaxed">{insight}</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Current status</p>
          <div className="flex items-center gap-2 mb-2"><span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", CONDITION_TINT[ip.condition])}>{ip.condition}</span><span className="text-[12.5px] text-slate-500">{ip.diagnosis}</span></div>
          {v ? <p className="text-[12px] text-slate-500">Last vitals · BP {v.bp} · {v.pulse} · {v.temp} · SpO₂ {v.spo2}</p> : <p className="text-[12px] text-amber-600">Vitals pending</p>}
        </div>
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Active problems</p>
          <div className="flex flex-wrap gap-1.5">
            {(ip.comorbidities ?? []).map(c => <span key={c} className="text-[12px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{c}</span>)}
            {!ip.comorbidities?.length && <span className="text-[12.5px] text-slate-400">None recorded</span>}
          </div>
        </div>
      </div>
      {trend.length > 1 && (
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Early-warning (NEWS) trend · latest {trend[trend.length - 1].score}*</p>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -22, bottom: 0 }}>
              <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(4, max + 1)]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
              <XAxis dataKey="at" tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={24} />
              <Tooltip labelFormatter={(d) => fmtTime(d as string)} formatter={(val) => [`NEWS ${val}`, '']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10.5px] text-slate-400 mt-1">*Partial NEWS from captured vitals (RR + consciousness now recorded on rounds).</p>
        </div>
      )}
      {last && (
        <div className={card}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Last round · {fmtTime(last.doneAt)}</p>
          <p className="text-[13px] text-slate-700">{last.note}</p>
          {last.plan && <p className="text-[12px] text-slate-500 mt-1">Plan: {last.plan}</p>}
        </div>
      )}
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────
const FILTERS: { key: string; label: string; types: IpdEventType[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'clinical', label: 'Rounds & notes', types: ['round', 'note', 'condition_change'] },
  { key: 'meds', label: 'Medications', types: ['med_start', 'med_stop', 'med_change'] },
  { key: 'orders', label: 'Tests', types: ['test_order', 'test_result'] },
  { key: 'proc', label: 'Procedure & transfers', types: ['surgery_status', 'ot_booking', 'icu_transfer', 'referral'] },
]
export function TimelineTab({ ip }: { ip: Inpatient }) {
  const [filter, setFilter] = useState('all')
  const types = FILTERS.find(f => f.key === filter)?.types ?? []
  const events = [...ip.events].reverse().filter(e => !types.length || types.includes(e.type))
  return (
    <div>
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-4">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={cn("px-3 py-1.5 rounded-lg text-[12px] font-semibold transition", filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>{f.label}</button>
        ))}
      </div>
      <div className="relative pl-5">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-200" />
        <div className="space-y-3">
          {events.map(e => (
            <div key={e.id} className="relative">
              <span className={cn("absolute -left-[15px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white", SEVERITY_DOT[e.severity ?? 'info'])} />
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", EVENT_META[e.type].color)}>{EVENT_META[e.type].label}</span>
                <span className="text-[11px] text-slate-400">{fmtTime(e.at)} · {e.actor}</span>
              </div>
              <p className="text-[13px] font-semibold text-slate-800">{e.title}</p>
              {e.detail && <p className="text-[12px] text-slate-500">{e.detail}</p>}
            </div>
          ))}
          {!events.length && <p className="text-[12.5px] text-slate-400">No events in this filter.</p>}
        </div>
      </div>
    </div>
  )
}

// ── Rounds ────────────────────────────────────────────────────────
export function RoundsTab({ ip }: { ip: Inpatient }) {
  const [round, setRound] = useState(false)
  const completed = ip.rounds.filter(r => r.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  return (
    <div>
      <button onClick={() => setRound(true)} className="mb-4 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13px] font-bold flex items-center gap-1.5"><Stethoscope className="h-4 w-4" /> Start round</button>
      <div className="space-y-2">
        {completed.map(r => (
          <div key={r.id} className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between"><p className="text-[12.5px] font-bold text-slate-900">{r.doctor}</p><span className="text-[11px] text-slate-400">{fmtTime(r.doneAt)}</span></div>
            <p className="text-[12.5px] text-slate-600 mt-0.5">{r.note}</p>
            {r.plan && <p className="text-[11.5px] text-slate-500 mt-0.5">Plan: {r.plan}</p>}
            {r.vitals && <p className="text-[11px] text-slate-400 mt-1">BP {r.vitals.bp} · {r.vitals.pulse} · {r.vitals.temp} · SpO₂ {r.vitals.spo2}</p>}
          </div>
        ))}
        {!completed.length && <p className="text-[12.5px] text-slate-400">No rounds recorded yet.</p>}
      </div>
      <AnimatePresence>{round && <RoundModal ip={ip} onClose={() => setRound(false)} />}</AnimatePresence>
    </div>
  )
}

// ── Medications ───────────────────────────────────────────────────
export function MedsTab({ ip }: { ip: Inpatient }) {
  const [modal, setModal] = useState<IpdModalKind>(null)
  const active = ip.meds.filter(m => m.status === 'active')
  const stopped = ip.meds.filter(m => m.status === 'stopped')
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setModal('add_med')} className="h-9 px-3.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-bold flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add medication</button>
        {active.length > 0 && <button onClick={() => setModal('stop_med')} className="h-9 px-3.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[12.5px] font-bold flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Stop medication</button>}
      </div>
      <Section icon={Pill} title={`Active (${active.length})`}>
        <div className="space-y-1.5">
          {active.map((m, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-[13px] font-semibold text-slate-800">{m.name} {m.dose}</span>
              <span className="text-[11.5px] text-slate-500">{m.freq} · {m.route}</span>
            </div>
          ))}
          {!active.length && <p className="text-[12.5px] text-slate-400">No active medications.</p>}
        </div>
      </Section>
      {stopped.length > 0 && (
        <Section icon={Ban} title={`Discontinued (${stopped.length})`}>
          <div className="space-y-1.5">
            {stopped.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50/60 px-3 py-2">
                <span className="text-[13px] font-medium text-slate-400 line-through">{m.name} {m.dose}</span>
                <span className="text-[11px] text-slate-400">{m.stopReason ?? 'stopped'}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      <AnimatePresence>{modal && <IpdActionModal kind={modal} patient={ip} onClose={() => setModal(null)} />}</AnimatePresence>
    </div>
  )
}

// ── Orders & Results ──────────────────────────────────────────────
export function OrdersTab({ ip }: { ip: Inpatient }) {
  const acknowledgeTest = useInpatientStore(s => s.acknowledgeTest)
  const [modal, setModal] = useState<IpdModalKind>(null)
  return (
    <div className="space-y-4">
      <button onClick={() => setModal('order_test')} className="h-9 px-3.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-bold flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Order test</button>
      <div className="space-y-2">
        {ip.tests.map(t => (
          <div key={t.id} className={cn("rounded-xl p-3", t.critical ? "bg-red-50 border border-red-200" : "bg-slate-50")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5">{t.critical && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}{t.name}</span>
              <span className={cn("text-[10.5px] font-bold px-2 py-0.5 rounded-full", t.status === 'Ready' ? 'bg-green-100 text-green-700' : t.status === 'Acknowledged' ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-700')}>{t.status}</span>
            </div>
            {t.result && <p className="text-[12px] text-slate-600 mt-1">Result: {t.result}</p>}
            {t.status === 'Ready' && (
              <button onClick={() => acknowledgeTest(ip.patientId, t.id)} className="mt-2 text-[11.5px] font-bold text-[var(--color-accent)] flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge / sign-off</button>
            )}
          </div>
        ))}
        {!ip.tests.length && <p className="text-[12.5px] text-slate-400">No investigations ordered.</p>}
      </div>
      <AnimatePresence>{modal && <IpdActionModal kind={modal} patient={ip} onClose={() => setModal(null)} />}</AnimatePresence>
    </div>
  )
}

// ── Procedure / Surgery ───────────────────────────────────────────
export function ProcedureTab({ ip }: { ip: Inpatient }) {
  return (
    <div className="space-y-4">
      <Section icon={Scissors} title="Surgery / Procedure"><SurgeryPanel ip={ip} /></Section>
      {ip.otBooking && (
        <div className="rounded-xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-3 text-[12.5px] text-[var(--color-primary-dark)]">
          OT booked — {ip.otBooking.procedure} · {ip.otBooking.surgeon} · {ip.otBooking.ot} · {new Date(ip.otBooking.scheduledAt).toLocaleString('en-IN')} ({ip.otBooking.status})
        </div>
      )}
    </div>
  )
}

// ── Referrals & Transfers ─────────────────────────────────────────
export function ReferralsTab({ ip }: { ip: Inpatient }) {
  const [modal, setModal] = useState<IpdModalKind>(null)
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setModal('refer')} className="h-9 px-3.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[12.5px] font-bold flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Refer</button>
        <button onClick={() => setModal('icu')} className="h-9 px-3.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[12.5px] font-bold flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Request ICU</button>
      </div>
      <Section icon={GitBranch} title={`Referrals (${ip.referrals?.length ?? 0})`}>
        <div className="space-y-1.5">
          {(ip.referrals ?? []).map(r => (
            <div key={r.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-slate-800">{r.specialty}{r.toDoctor ? ` · ${r.toDoctor}` : ''}</span>{r.urgent && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">Urgent</span>}</div>
              <p className="text-[12px] text-slate-500">{r.reason}</p>
            </div>
          ))}
          {!ip.referrals?.length && <p className="text-[12.5px] text-slate-400">No referrals.</p>}
        </div>
      </Section>
      {ip.icuTransfer && (
        <Section icon={Activity} title="ICU transfer">
          <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-[12.5px] text-rose-900">
            {ip.icuTransfer.reason} — <b>{ip.icuTransfer.urgency}</b> · status: {ip.icuTransfer.status.replace('_', ' ')}
          </div>
        </Section>
      )}
      <AnimatePresence>{modal && <IpdActionModal kind={modal} patient={ip} onClose={() => setModal(null)} />}</AnimatePresence>
    </div>
  )
}

// ── Discharge ─────────────────────────────────────────────────────
export function DischargeTab({ ip }: { ip: Inpatient }) {
  return <Section icon={ShieldCheck} title="Discharge"><DischargePanel ip={ip} /></Section>
}

// ── Diet (small, used inside Overview rail or as needed) ──────────
export function DietBadge({ ip }: { ip: Inpatient }) {
  if (!ip.diet) return null
  return <span className="inline-flex items-center gap-1 text-[12px] text-slate-600"><Utensils className="h-3.5 w-3.5 text-slate-400" /> {ip.diet}</span>
}
