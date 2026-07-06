"use client"

import { useMemo, useState } from "react"
import {
  Droplet, CheckCircle, Clock, FlaskConical, PackageCheck,
  HeartHandshake, CalendarCheck, ShieldCheck, AlertCircle,
} from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { useBloodBankStore, type CrossMatchRequest } from "@/store/useBloodBankStore"
import { cn } from "@/lib/utils"

const PIPELINE = ['Requested', 'Cross-match', 'Reserved', 'Issued'] as const

function pipelineStage(status: CrossMatchRequest['status']): number {
  if (status === 'pending') return 0
  if (status === 'compatible') return 2
  if (status === 'issued') return 3
  return 0
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function PatientBloodBankPage() {
  const currentUser = useAuthStore(s => s.currentUser)
  const requests    = useBloodBankStore(s => s.crossMatchRequests)
  const units       = useBloodBankStore(s => s.units)
  const [registered, setRegistered] = useState(false)

  const myReqs = useMemo(() => {
    const id = (currentUser?.id ?? '').toLowerCase()
    const name = (currentUser?.name ?? '').toLowerCase()
    return requests.filter(r =>
      (id && r.patientId.toLowerCase() === id) ||
      (name && r.patientName.toLowerCase() === name)
    ).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  }, [requests, currentUser])

  const myBloodGroup = myReqs[0]?.bloodGroup ?? 'O+'
  const issuedRecord = myReqs.find(r => r.status === 'issued')
  const activeRecord = myReqs.find(r => r.status !== 'issued')
  const featured = activeRecord ?? issuedRecord
  const stage = featured ? pipelineStage(featured.status) : -1

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Blood Bank</h1>
        <p className="text-[13px] text-slate-500 mt-1">Your blood group, transfusion record, donation</p>
      </div>

      {/* Blood group card */}
      <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-red-500 to-rose-600 shadow-[0_10px_30px_rgba(239,68,68,0.3)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Droplet className="h-5 w-5" /><span className="text-[13px] font-bold uppercase tracking-wider text-white/80">Your blood group</span></div>
          <span className="text-[13px] font-semibold text-white/90">{currentUser?.id ?? 'PT-20394'}</span>
        </div>
        <div className="flex items-end justify-between mt-4">
          <div>
            <p className="text-[44px] leading-none font-bold">{myBloodGroup}</p>
            <p className="text-[13px] text-white/70 mt-1">From last cross-match record</p>
          </div>
        </div>
      </div>

      {/* Featured cross-match (active or most-recent issued) */}
      {featured ? (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
            <h3 className="text-[15px] font-bold text-slate-900">
              {featured.status === 'issued' ? 'Recent transfusion' : 'Active cross-match'}
            </h3>
            <span className={cn(
              "text-[12px] font-bold px-2.5 py-1 rounded-full",
              featured.status === 'issued' ? 'bg-emerald-50 text-emerald-700'
              : featured.status === 'compatible' ? 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]'
              : 'bg-amber-50 text-amber-700',
            )}>
              {featured.id} · {featured.bloodGroup} {featured.component}
            </span>
          </div>
          <p className="text-[12.5px] text-slate-500 mb-4">Requested by {featured.requestedBy} · {fmt(featured.requestedAt)}</p>

          <div className="flex gap-3 mb-5">
            <div className="flex-1 rounded-2xl bg-slate-50 p-3.5">
              <p className="text-[12px] text-slate-400 font-semibold">Units</p>
              <p className="text-[20px] font-bold text-slate-900">{featured.units} <span className="text-[12px] font-medium text-slate-400">unit(s) · {featured.bloodGroup}</span></p>
            </div>
            <div className="flex-1 rounded-2xl bg-slate-50 p-3.5">
              <p className="text-[12px] text-slate-400 font-semibold">Reserved</p>
              <p className="text-[15px] font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                <CheckCircle className="h-4.5 w-4.5" /> {(featured.reservedUnitIds ?? []).length}/{featured.units}
              </p>
            </div>
          </div>

          {/* Pipeline */}
          <div className="flex items-center">
            {PIPELINE.map((label, i) => {
              const Icon = i === 0 ? CheckCircle : i === 1 ? FlaskConical : i === 2 ? ShieldCheck : PackageCheck
              const done = i <= stage
              const current = i === stage
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={cn("h-9 w-9 rounded-full flex items-center justify-center",
                      done ? "bg-red-600 text-white" : "bg-slate-100 text-slate-400")}>
                      {current ? <Clock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={cn("text-[11px] font-semibold text-center", done ? "text-red-600" : "text-slate-400")}>{label}</span>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-1 -mt-4 rounded", i < stage ? "bg-red-600" : "bg-slate-200")} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Status helper text */}
          <p className="text-[13px] text-slate-500 mt-4 bg-slate-50 rounded-xl p-3">
            {featured.status === 'pending' && 'Your request has reached the blood bank — cross-matching has not started yet.'}
            {featured.status === 'compatible' && 'Cross-matching done. Units reserved and awaiting bedside-check and issue.'}
            {featured.status === 'issued' && (
              <>Issued by <b className="text-slate-700">{featured.issuedBy}</b>
              {featured.issuedAt ? ` on ${fmt(featured.issuedAt)}` : ''} · audit logged for traceability.</>
            )}
          </p>

          {/* Show specific bags after issued for transparency */}
          {featured.status === 'issued' && featured.issuedUnitIds && featured.issuedUnitIds.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {featured.issuedUnitIds.map(uid => {
                const u = units.find(x => x.id === uid)
                if (!u) return null
                return (
                  <div key={uid} className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-[12px] text-emerald-800">
                    Bag <b>{u.bagNumber}</b> · {u.bloodGroup} {u.component} · donor {u.donorId}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5 text-center">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-800">No blood requests on record</p>
          <p className="text-xs text-slate-500 mt-1">If your doctor orders blood, you&apos;ll see status here in real time.</p>
        </div>
      )}

      {/* Past records */}
      {myReqs.length > 1 && (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
          <h3 className="text-[14px] font-bold text-slate-900 mb-3">Previous requests</h3>
          <div className="space-y-2">
            {myReqs.filter(r => r.id !== featured?.id).map(r => (
              <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 text-[12.5px]">
                <div>
                  <p className="font-bold text-slate-800">{r.bloodGroup} {r.component} · {r.units} unit(s)</p>
                  <p className="text-[11px] text-slate-500">{r.requestedBy} · {fmt(r.requestedAt)}</p>
                </div>
                <span className="text-[11px] font-bold uppercase">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Become a donor */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><HeartHandshake className="h-4.5 w-4.5 text-red-500" /> Become a donor</h3>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
            <span className="h-10 w-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0"><ShieldCheck className="h-5 w-5" /></span>
            <div className="flex-1"><p className="text-[14px] font-semibold text-slate-900">Eligibility</p><p className="text-[12.5px] text-slate-500">Eligible — age & weight criteria met</p></div>
            <span className="text-[12px] font-semibold text-green-600">Eligible</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
            <span className="h-10 w-10 rounded-2xl bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] flex items-center justify-center flex-shrink-0"><CalendarCheck className="h-5 w-5" /></span>
            <div className="flex-1"><p className="text-[14px] font-semibold text-slate-900">Last donation</p><p className="text-[12.5px] text-slate-500">12 Jan 2026 · next eligible now</p></div>
          </div>
        </div>
        <button
          onClick={() => setRegistered(true)}
          disabled={registered}
          className={cn("w-full font-bold text-[15px] rounded-xl py-3 flex items-center justify-center gap-2 transition-transform", registered ? "bg-green-100 text-green-700" : "bg-[var(--color-primary)] text-white active:scale-[0.97]")}
        >
          {registered ? <><CheckCircle className="h-5 w-5" /> Registered as donor</> : <><HeartHandshake className="h-5 w-5" /> Register as a donor</>}
        </button>
      </div>
    </div>
  )
}
