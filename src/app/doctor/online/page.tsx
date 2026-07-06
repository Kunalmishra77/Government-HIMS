"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Video, Clock, Stethoscope, Sparkles, AlertTriangle } from "lucide-react"
import { usePatientStore, type Patient } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useDoctorProfileStore } from "@/store/useDoctorProfileStore"
import { ONLINE_CONSULTS } from "@/data/onlineConsults"
import { cn } from "@/lib/utils"

const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
const TRIAGE_TINT: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700', High: 'bg-accent-soft text-accent', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-slate-100 text-slate-500',
}

// Short AI pre-brief per row — grounded in the recorded complaint/history.
function briefKeyFor(p: Patient): string {
  const t = [...p.symptoms, ...p.history].join(' ').toLowerCase()
  if (/chest|breath|palpitation/.test(t)) return 'briefCardiac'
  if (/fever|cough|cold|throat/.test(t)) return 'briefFebrile'
  if (/diabet|sugar/.test(t)) return 'briefDiabetic'
  if (/bp|hypertens|pressure/.test(t)) return 'briefBp'
  if (/stomach|abdom|loose|vomit|nausea/.test(t)) return 'briefGi'
  if (/joint|swelling|pain/.test(t)) return 'briefMsk'
  return 'briefRoutine'
}

export default function OnlineConsultation() {
  const t = useTranslations('doctor')
  const router = useRouter()
  const patients = usePatientStore(s => s.patients)
  const appointments = usePatientStore(s => s.appointments)
  const currentUser = useAuthStore(s => s.currentUser)
  const startOnlineConsult = useConsultationStore(s => s.startOnlineConsult)
  const today = new Date().toISOString().slice(0, 10)

  const liveExtra = appointments
    .filter(a => a.mode === 'online' && a.doctorName === currentUser?.name && a.date >= today && a.status !== 'cancelled')
    .map(a => {
      const p = patients.find(x => x.id === a.patientId)
      if (!p) return null
      return { ...p, slot: a.time, reason: a.specialty } as Patient & { slot: string; reason: string }
    })
    .filter(Boolean) as (Patient & { slot: string; reason: string })[]

  const queue = [...liveExtra, ...ONLINE_CONSULTS]
  const start = (p: Patient) => { startOnlineConsult(p); router.push('/doctor/dashboard') }

  const { onLeave, availableForOnline, leaveUntil } = useDoctorProfileStore()
  const blocked = onLeave || !availableForOnline

  return (
    <div className="max-w-6xl mx-auto pb-8">
      <div className="mb-4">
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('online.title')}</h1>
        <p className="text-[13px] text-slate-500 mt-1">{t('online.subtitle', { count: queue.length })}</p>
      </div>

      {blocked && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-900 leading-relaxed">
            {onLeave
              ? t.rich('online.onLeaveBlocked', {
                  b: (c) => <b>{c}</b>,
                  leaveUntil: leaveUntil ? t('online.onLeaveUntil', { date: new Date(leaveUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }) : '',
                })
              : t.rich('online.notAcceptingBlocked', { b: (c) => <b>{c}</b> })}
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] p-4 mb-5 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-[var(--color-accent)] flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-[var(--color-primary-dark)] leading-relaxed">
          {t.rich('online.workspaceInfo', { b: (c) => <b>{c}</b> })}
        </p>
      </div>

      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {[t('online.colPatient'), t('online.colReason'), t('online.colSlot'), t('online.colWait'), t('online.colHistory'), t('online.colVitals'), t('online.colAiBrief'), t('online.colPriority'), ''].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map(p => {
                const hist = p.history.filter(h => !/no significant|no known/i.test(h))
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-[rgba(238,107,38,0.10)]/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] text-white flex items-center justify-center font-bold text-[12.5px] flex-shrink-0">{initials(p.name)}</span>
                        <div className="min-w-0"><p className="text-[13.5px] font-bold text-slate-900 truncate">{p.name}</p><p className="text-[11.5px] text-slate-400">{p.age}y · {p.gender}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-slate-600 max-w-[180px] truncate">{p.reason}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1 text-[12px] text-slate-500"><Clock className="h-3 w-3" /> {p.slot}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap text-[12.5px] text-slate-500">~{p.estimatedWait}m</td>{/* wait */}
                    <td className="px-4 py-3 max-w-[170px]">
                      <div className="flex flex-wrap gap-1">{hist.length ? hist.map(h => <span key={h} className="text-[10.5px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{h}</span>) : <span className="text-slate-300 text-[12px]">—</span>}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[11.5px] text-slate-500">{p.vitals ? `${p.vitals.bp} · SpO₂ ${p.vitals.spo2}` : <span className="text-amber-500">{t('online.vitalsPending')}</span>}</td>
                    <td className="px-4 py-3 max-w-[180px]"><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] px-2 py-0.5 rounded-full"><Sparkles className="h-3 w-3" /> <span className="truncate">{t(`online.${briefKeyFor(p)}`)}</span></span></td>
                    <td className="px-4 py-3">{p.triageLevel && <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", TRIAGE_TINT[p.triageLevel])}>{p.triageLevel}</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => start(p)} className="inline-flex items-center justify-center gap-1.5 px-3 h-9 bg-[var(--color-primary)] text-white text-[12px] font-bold rounded-lg hover:bg-[var(--color-primary-dark)] transition active:scale-95 whitespace-nowrap"><Video className="h-3.5 w-3.5" /> {t('online.startButton')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-slate-400 mt-4 flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> {t('online.footer')}</p>
    </div>
  )
}
