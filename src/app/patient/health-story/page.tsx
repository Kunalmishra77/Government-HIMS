"use client"

import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { Sparkles, Activity, CheckCircle, UserPlus, Stethoscope, FlaskConical, Pill, CalendarCheck } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { PatientJourneyFlow } from "@/components/clinical/PatientJourneyFlow"
import { cn } from "@/lib/utils"

const BP_TREND = [
  { m: 'Dec', sys: 142, dia: 92 }, { m: 'Jan', sys: 138, dia: 90 },
  { m: 'Feb', sys: 134, dia: 88 }, { m: 'Mar', sys: 132, dia: 86 },
  { m: 'Apr', sys: 130, dia: 85 }, { m: 'May', sys: 130, dia: 85 },
]

const HEALTH_SCORE = 78

const TIMELINE = [
  { icon: UserPlus, tint: 'bg-surface-sunken text-accent', title: 'Registered at Agentix HIMS', sub: 'Permanent UHID issued · Dec 2025' },
  { icon: Stethoscope, tint: 'bg-primary-soft text-accent', title: 'OPD consultation — General Medicine', sub: 'Dr. Priya Nair · Jan 2026' },
  { icon: FlaskConical, tint: 'bg-primary-soft text-accent', title: 'Lab investigations', sub: 'CBC · Lipid profile · Feb 2026' },
  { icon: Pill, tint: 'bg-amber-50 text-amber-600', title: 'Prescription updated', sub: 'Antihypertensive started · Mar 2026' },
  { icon: CalendarCheck, tint: 'bg-green-50 text-green-600', title: 'Follow-up visit', sub: 'Blood pressure controlled · May 2026' },
]

function ScoreRing({ value }: { value: number }) {
  const r = 52, c = 2 * Math.PI * r, off = c - (value / 100) * c
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E2E8F0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#g)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10B981" /><stop offset="100%" stopColor="var(--color-primary)" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-bold text-slate-900 leading-none">{value}</span>
        <span className="text-[11px] font-semibold text-slate-400">/ 100</span>
      </div>
    </div>
  )
}

export default function HealthStoryPage() {
  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">My Health Story</h1>
        <p className="text-[13px] text-slate-500 mt-1">An AI-curated view of your health over time</p>
      </div>

      {/* AI summary + health score */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 rounded-3xl bg-surface-sunken border border-[rgba(238,107,38,0.15)] p-5">
          <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4.5 w-4.5 text-[var(--color-accent)]" /><span className="text-[13px] font-bold text-slate-900">AI summary of your health</span></div>
          <p className="text-[14px] text-slate-700 leading-relaxed">
            Over the last 6 months your <b>blood pressure has steadily improved</b> (from 142/92 to 130/85) — your medication and lifestyle changes are working. Your <b>diabetes is borderline</b> and due for a 3-month check. Today&apos;s visit is for new chest symptoms, being treated as high priority. Keep up the BP routine and book your diabetes follow-up.
          </p>
        </div>
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5 flex flex-col items-center justify-center">
          <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-2">Health score</span>
          <ScoreRing value={HEALTH_SCORE} />
          <span className="text-[12px] text-emerald-600 font-semibold mt-2">↑ 6 since last visit</span>
        </div>
      </div>

      {/* BP trend */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
        <div className="flex items-center gap-2 mb-4"><Activity className="h-4.5 w-4.5 text-[var(--color-accent)]" /><h3 className="text-[15px] font-bold text-slate-900">Blood pressure trend</h3></div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={BP_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="m" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={[60, 160]} />
              <Tooltip />
              <Line type="monotone" dataKey="sys" name="Systolic" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="dia" name="Diastolic" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* timeline */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-4">Timeline</h3>
        <div className="space-y-1">
          {TIMELINE.map((t, i) => {
            const Icon = t.icon
            return (
              <div key={i} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0", t.tint)}><Icon className="h-4.5 w-4.5" /></div>
                  {i < TIMELINE.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1" />}
                </div>
                <div className="pb-4">
                  <p className="text-[14px] font-semibold text-slate-900">{t.title}</p>
                  <p className="text-[12.5px] text-slate-500">{t.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-slate-400 pt-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Complete record · DISHA-secured</div>
      </div>
    </div>
  )
}
