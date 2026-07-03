"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { BedDouble, MapPin, Phone, AlertTriangle, CheckCircle2, ArrowRight, Building2 } from "lucide-react"
import {
  useAdmissionStore, OTHER_BRANCHES, CURRENT_BRANCH, WARD_ORDER,
  type Branch, type BranchWard,
} from "@/store/useAdmissionStore"
import { cn } from "@/lib/utils"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"

function tone(available: number, total: number) {
  if (total === 0) return { bar: 'bg-slate-300', text: 'text-slate-400', chip: 'bg-slate-100 text-slate-500' }
  if (available === 0) return { bar: 'bg-red-500', text: 'text-red-600', chip: 'bg-red-50 text-red-600' }
  if (available <= Math.max(1, Math.round(total * 0.2))) return { bar: 'bg-amber-500', text: 'text-amber-600', chip: 'bg-amber-50 text-amber-700' }
  return { bar: 'bg-green-500', text: 'text-green-600', chip: 'bg-green-50 text-green-700' }
}

export default function DoctorBeds() {
  const t = useTranslations('doctor')
  const beds = useAdmissionStore(s => s.beds)
  const [branchId, setBranchId] = useState(CURRENT_BRANCH.id)

  // Live ward availability for THIS branch, derived from the shared bed board.
  const currentWards: BranchWard[] = WARD_ORDER.map(w => {
    const inWard = beds.filter(b => b.ward === w)
    return { ward: w, total: inWard.length, available: inWard.filter(b => b.status === 'Available').length }
  }).filter(x => x.total > 0)

  const branches: Branch[] = [
    { ...CURRENT_BRANCH, wards: currentWards },
    ...OTHER_BRANCHES,
  ]
  const selected = branches.find(b => b.id === branchId) ?? branches[0]
  const isCurrent = selected.id === CURRENT_BRANCH.id

  const totalFree = selected.wards.reduce((s, w) => s + w.available, 0)
  const totalBeds = selected.wards.reduce((s, w) => s + w.total, 0)
  const fullWards = currentWards.filter(w => w.available === 0)

  // For a full ward at the current branch, which other branch has beds?
  const alternativeFor = (ward: string) =>
    OTHER_BRANCHES
      .map(b => ({ name: b.location, distanceKm: b.distanceKm, available: b.wards.find(w => w.ward === ward)?.available ?? 0 }))
      .filter(b => b.available > 0)
      .sort((a, b) => a.distanceKm - b.distanceKm)

  return (
    <div className="pb-6">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('beds.title')}</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">{t('beds.subtitle')}</p>
      </div>

      {/* Branch selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {branches.map(b => {
          const free = b.wards.reduce((s, w) => s + w.available, 0)
          const active = b.id === branchId
          return (
            <button key={b.id} onClick={() => setBranchId(b.id)}
              className={cn("flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-left transition", active ? "border-[rgba(238,107,38,0.30)] bg-[rgba(238,107,38,0.07)]/60 ring-1 ring-primary/25" : "border-slate-200 bg-white hover:bg-slate-50")}>
              <span className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", active ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-500")}><Building2 className="h-4.5 w-4.5" /></span>
              <div>
                <p className="text-[13px] font-bold text-slate-900 leading-tight">{b.location}{b.id === CURRENT_BRANCH.id && <span className="ml-1.5 text-[10px] font-bold text-[var(--color-accent)]">{t('beds.thisBranch')}</span>}</p>
                <p className="text-[11px] text-slate-500">{b.distanceKm === 0 ? t('beds.currentLocation') : t('beds.kmAway', { km: b.distanceKm })} · {t('beds.free', { count: free })}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Full-ward fallback banner (only for current branch) */}
      {isCurrent && fullWards.length > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[13.5px] font-bold text-amber-900">{fullWards.length > 1 ? t('beds.wardFullPlural', { wards: fullWards.map(w => w.ward).join(', ') }) : t('beds.wardFullSingle', { wards: fullWards.map(w => w.ward).join(', ') })}</p>
              <div className="mt-2 space-y-1.5">
                {fullWards.map(w => {
                  const alts = alternativeFor(w.ward)
                  return (
                    <p key={w.ward} className="text-[12.5px] text-amber-800">
                      <b>{w.ward}:</b> {alts.length ? alts.map(a => t('beds.altFree', { count: a.available, name: a.name, km: a.distanceKm })).join(' · ') : t('beds.noAlternatives')}
                    </p>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected branch summary + ward cards */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BedDouble className="h-4.5 w-4.5 text-slate-400" />
            <h3 className="text-[15px] font-bold text-slate-900">{selected.name}</h3>
            {isCurrent && <span className="flex items-center gap-1 text-[11px] font-bold text-green-600"><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> {t('beds.live')}</span>}
          </div>
          <span className={cn("text-[12px] font-bold px-2.5 py-1 rounded-full", totalFree > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>{t('beds.freeOfTotal', { free: totalFree, total: totalBeds })}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {selected.wards.map(w => {
            const tn = tone(w.available, w.total)
            return (
              <div key={w.ward} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-[12px] font-bold text-slate-700">{w.ward}</p>
                <p className={cn("text-[24px] font-bold leading-none mt-2 tabular-nums", tn.text)}>{w.available}<span className="text-[13px] font-medium text-slate-400"> / {w.total}</span></p>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{t('beds.bedsFree')}</p>
                <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mt-2.5">
                  <div className={cn("h-full rounded-full", tn.bar)} style={{ width: `${w.total ? (w.available / w.total) * 100 : 0}%` }} />
                </div>
                {w.available === 0 && <span className="inline-block mt-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600">{t('beds.full')}</span>}
              </div>
            )
          })}
        </div>
        {!isCurrent && (
          <button onClick={() => {
              notifyAndAuditMany(['bed_manager', 'admin'], {
                type: 'system', priority: 'high',
                title: t('beds.transferSentTitle', { location: selected.location }),
                body: t('beds.transferSentBody', { location: selected.location }),
                audit: { action: 'admission_transfer', resource: 'transfer_request', detail: t('beds.transferAuditDetail', { location: selected.location }), userName: 'Doctor' },
              })
              toast.success(t('beds.bedRequestSent', { location: selected.location }), { description: t('beds.bedRequestDesc') })
            }}
            className="mt-4 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13px] font-bold flex items-center gap-2 transition active:scale-[0.98] cursor-pointer">
            <Phone className="h-4 w-4" /> {t('beds.requestTransfer', { location: selected.location })}
          </button>
        )}
      </div>

      {/* Cross-branch comparison matrix */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3">{t('beds.availAcrossBranches')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2 pr-3">{t('beds.colWard')}</th>
                {branches.map(b => (
                  <th key={b.id} className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-2 px-2">
                    {b.location}{b.id === CURRENT_BRANCH.id && ' ·'}
                    {b.id === CURRENT_BRANCH.id && <span className="text-[var(--color-accent)]">{t('beds.here')}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WARD_ORDER.map(ward => (
                <tr key={ward} className="border-t border-slate-100">
                  <td className="text-[13px] font-semibold text-slate-700 py-2.5 pr-3">{ward}</td>
                  {branches.map(b => {
                    const w = b.wards.find(x => x.ward === ward)
                    if (!w) return <td key={b.id} className="text-center text-slate-300 text-[12px]">—</td>
                    const t = tone(w.available, w.total)
                    return (
                      <td key={b.id} className="py-2.5 px-2 text-center">
                        <span className={cn("inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-lg", t.chip)}>
                          {w.available === 0 ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {w.available}/{w.total}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11.5px] text-slate-400 mt-3 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {t('beds.syncNote')}</p>
      </div>
    </div>
  )
}
