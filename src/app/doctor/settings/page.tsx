"use client"

import { Stethoscope, Plane, Clock, PenLine, CheckCircle2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { useAuthStore } from "@/store/useAuthStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const CARD = "rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5"
const field = "w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20"
const label = "block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5"

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between w-full">
      <span className="text-[13.5px] font-medium text-slate-700">{label}</span>
      <span className={cn("h-6 w-11 rounded-full transition-colors relative flex-shrink-0", on ? "bg-[var(--color-primary)]" : "bg-slate-200")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  )
}

export default function DoctorSettings() {
  const t = useTranslations('doctor')
  const p = useDoctorProfileStore()
  const currentUser = useAuthStore(s => s.currentUser)

  return (
    <div className="max-w-3xl mx-auto pb-10 space-y-4">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('settings.title')}</h1>
        <p className="text-[13px] text-slate-500 mt-1">{t('settings.meta', { name: currentUser?.name ?? '', id: currentUser?.id ?? '', specialization: currentUser?.specialization ?? t('settings.physician') })}</p>
      </div>

      {/* Availability */}
      <div className={CARD}>
        <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2"><Stethoscope className="h-4.5 w-4.5 text-[var(--color-accent)]" /> {t('settings.availability')}</h3>
        <div className="space-y-3">
          <Toggle on={p.availableForOPD} onClick={() => p.setProfile({ availableForOPD: !p.availableForOPD })} label={t('settings.acceptOpd')} />
          <Toggle on={p.availableForOnline} onClick={() => p.setProfile({ availableForOnline: !p.availableForOnline })} label={t('settings.acceptOnline')} />
          <div className="h-px bg-slate-100" />
          <Toggle on={p.onLeave} onClick={() => p.setProfile({ onLeave: !p.onLeave })} label={t('settings.onLeave')} />
          {p.onLeave && (
            <div className="flex items-center gap-2 pl-1">
              <Plane className="h-4 w-4 text-amber-500" />
              <label className="text-[12.5px] text-slate-500">{t('settings.until')}</label>
              <input type="date" value={p.leaveUntil} onChange={e => p.setProfile({ leaveUntil: e.target.value })} className="h-9 rounded-lg border border-slate-200 px-2.5 text-[13px] text-slate-700 outline-none" />
            </div>
          )}
        </div>
      </div>

      {/* Consultation hours */}
      <div className={CARD}>
        <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2"><Clock className="h-4.5 w-4.5 text-[var(--color-accent)]" /> {t('settings.hours')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>{t('settings.start')}</label><input type="time" value={p.hoursStart} onChange={e => p.setProfile({ hoursStart: e.target.value })} className={field} /></div>
          <div><label className={label}>{t('settings.end')}</label><input type="time" value={p.hoursEnd} onChange={e => p.setProfile({ hoursEnd: e.target.value })} className={field} /></div>
        </div>
      </div>

      {/* e-Signature */}
      <div className={CARD}>
        <h3 className="text-[15px] font-bold text-slate-900 mb-4 flex items-center gap-2"><PenLine className="h-4.5 w-4.5 text-[var(--color-accent)]" /> {t('settings.eSignature')}</h3>
        <input value={p.signature} onChange={e => p.setProfile({ signature: e.target.value })} className={field} placeholder={t('settings.signaturePlaceholder')} />
        <div className="mt-3 rounded-xl bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t('settings.signaturePreview')}</p>
          <p className="text-[16px] text-slate-800" style={{ fontFamily: 'cursive' }}>{p.signature || '—'}</p>
        </div>
      </div>

      <button onClick={() => toast.success(t('settings.savedToast'))} className="w-full h-12 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition">
        <CheckCircle2 className="h-5 w-5" /> {t('settings.saveSettings')}
      </button>
      <p className="text-[11.5px] text-slate-400 text-center">{t('settings.saveHint')}</p>
    </div>
  )
}
