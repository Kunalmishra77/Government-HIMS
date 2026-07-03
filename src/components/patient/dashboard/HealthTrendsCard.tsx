"use client"

import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts"
import { TrendingUp, HeartPulse, Wallet } from "lucide-react"

const BP = [
  { m: 'Dec', v: 142 }, { m: 'Jan', v: 138 }, { m: 'Feb', v: 134 },
  { m: 'Mar', v: 132 }, { m: 'Apr', v: 130 }, { m: 'May', v: 130 },
]

const STATS = [
  { icon: TrendingUp, tint: 'text-emerald-600 bg-emerald-50', label: 'Health score', value: '78', delta: '↑ 6' },
  { icon: HeartPulse, tint: 'text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)]', label: 'Avg BP', value: '130/85', delta: '↓ improving' },
  { icon: Wallet, tint: 'text-amber-600 bg-amber-50', label: 'Spent (yr)', value: '₹4,280', delta: '3 visits' },
]

export function HealthTrendsCard() {
  return (
    <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-slate-900">Your trends</h3>
        <span className="text-[11px] font-semibold text-slate-400">last 6 months</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {STATS.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-2xl bg-slate-50 p-3">
              <span className={`inline-flex h-7 w-7 rounded-lg items-center justify-center ${s.tint} mb-1.5`}><Icon className="h-4 w-4" /></span>
              <p className="text-[16px] font-bold text-slate-900 leading-none">{s.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{s.label}</p>
              <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">{s.delta}</p>
            </div>
          )
        })}
      </div>

      <div>
        <p className="text-[12px] font-semibold text-slate-400 mb-1">Blood pressure (systolic)</p>
        <div style={{ height: 110 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={BP} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="bpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="v" name="Systolic" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#bpFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
