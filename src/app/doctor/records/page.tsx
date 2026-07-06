"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, X, Stethoscope, Droplet, Phone, Activity, Video, Building2,
  FileText, Pill, ArrowRight, Users as UsersIcon, BedDouble,
} from "lucide-react"
import { usePatientStore, type Patient, type QueueStatus } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { ONLINE_CONSULTS } from "@/data/onlineConsults"
import { cn } from "@/lib/utils"

type Mode = 'in_person' | 'online'
type Row = Patient & { mode: Mode }

const STATUS_TINT: Record<QueueStatus, string> = {
  waiting: 'bg-amber-50 text-amber-700', vitals: 'bg-surface-sunken text-accent', consulting: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  pharmacy: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', billing: 'bg-primary-soft text-accent', done: 'bg-green-50 text-green-700',
}
const TRIAGE_TINT: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700', High: 'bg-accent-soft text-accent', Medium: 'bg-amber-100 text-amber-700', Low: 'bg-slate-100 text-slate-500',
}
const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

export default function DoctorRecords() {
  const t = useTranslations('doctor')
  const router = useRouter()
  const { patients, visits } = usePatientStore()
  const inpatients = useInpatientStore(s => s.inpatients)
  const currentUser = useAuthStore(s => s.currentUser)
  const setCurrentPatient = useConsultationStore(s => s.setCurrentPatient)
  const startOnlineConsult = useConsultationStore(s => s.startOnlineConsult)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | Mode>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const doctorName = currentUser?.name
  const admittedIds = useMemo(() => new Set(inpatients.map(i => i.patientId)), [inpatients])

  // Doctor-scoped: a doctor only sees their own patients (in-person + online).
  const rows: Row[] = useMemo(() => {
    const inPerson: Row[] = patients.filter(p => p.doctor === doctorName).map(p => ({ ...p, mode: 'in_person' }))
    const online: Row[] = ONLINE_CONSULTS.filter(p => p.doctor === doctorName).map(p => ({ ...p, mode: 'online' }))
    return [...inPerson, ...online]
  }, [patients, doctorName])

  const counts = { all: rows.length, in_person: rows.filter(r => r.mode === 'in_person').length, online: rows.filter(r => r.mode === 'online').length }
  const filtered = rows.filter(r => {
    if (tab !== 'all' && r.mode !== tab) return false
    const q = search.trim().toLowerCase()
    return !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.phone.includes(q)
  })
  const selected = rows.find(r => r.id === selectedId) ?? null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openConsult = (r: Row) => {
    if (r.mode === 'online') startOnlineConsult(r); else setCurrentPatient(r)
    router.push('/doctor/dashboard')
  }

  const TABS: { key: 'all' | Mode; label: string }[] = [
    { key: 'all', label: t('records.tabAll') }, { key: 'in_person', label: t('records.tabInPerson') }, { key: 'online', label: t('records.tabOnline') },
  ]

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('records.title')}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{t('records.subtitle')}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('records.searchPlaceholder')}
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[rgba(238,107,38,0.30)] focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-4">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition", tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {key === 'online' && <Video className="h-3.5 w-3.5" />}{key === 'in_person' && <Building2 className="h-3.5 w-3.5" />}
            {label} <span className={cn("text-[11px] font-bold px-1.5 rounded-full", tab === key ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-slate-200 text-slate-500")}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-12 flex flex-col items-center text-center">
          <span className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><UsersIcon className="h-6 w-6 text-slate-400" /></span>
          <p className="text-[14px] font-semibold text-slate-700">{t('records.noPatients')}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {[t('records.colPatient'), t('records.colAgeSex'), t('records.colType'), t('records.colStatus'), t('records.colChiefComplaint'), t('records.colPriority')].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)}
                    className="border-b border-slate-50 last:border-0 hover:bg-[rgba(238,107,38,0.10)]/40 cursor-pointer transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={cn("h-9 w-9 rounded-xl text-white flex items-center justify-center font-bold text-[12.5px] flex-shrink-0", r.mode === 'online' ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)]" : "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)]")}>{initials(r.name)}</span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-slate-900 truncate flex items-center gap-1.5">
                            {r.name}
                            {admittedIds.has(r.id) && <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-0.5"><BedDouble className="h-2.5 w-2.5" /> {t('records.admitted')}</span>}
                          </p>
                          <p className="text-[11.5px] text-slate-400">{r.id} · {r.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">{r.age}y · {r.gender}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full", r.mode === 'online' ? "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]" : "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]")}>
                        {r.mode === 'online' ? <><Video className="h-3 w-3" /> {t('common.onlineLabel')}</> : <><Building2 className="h-3 w-3" /> {t('common.inPersonLabel')}</>}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full capitalize", STATUS_TINT[r.queueStatus])}>{r.queueStatus}</span></td>
                    <td className="px-4 py-3 text-[12.5px] text-slate-600 max-w-[260px] truncate">{r.symptoms.join(', ') || '—'}</td>
                    <td className="px-4 py-3">{r.triageLevel && <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", TRIAGE_TINT[r.triageLevel])}>{r.triageLevel}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSelectedId(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl overflow-y-auto" role="dialog" aria-modal="true" aria-label={t('records.patientRecord')}>
              <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
                <div className="flex items-center gap-3">
                  <span className={cn("h-12 w-12 rounded-2xl text-white flex items-center justify-center font-bold text-[16px]", selected.mode === 'online' ? "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)]" : "bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)]")}>{initials(selected.name)}</span>
                  <div>
                    <p className="text-[17px] font-bold text-slate-900 leading-tight">{selected.name}</p>
                    <p className="text-[12.5px] text-slate-500">{selected.id} · {selected.age}y · {selected.gender} · <span className={cn("font-semibold", selected.mode === 'online' ? "text-[var(--color-accent)]" : "text-[var(--color-accent)]")}>{selected.mode === 'online' ? t('common.onlineLabel') : t('common.inPersonLabel')}</span></p>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4.5 w-4.5 text-slate-500" /></button>
              </div>

              <div className="p-5 space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full capitalize", STATUS_TINT[selected.queueStatus])}>{selected.queueStatus}</span>
                  {admittedIds.has(selected.id) && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1"><BedDouble className="h-3 w-3" /> Admitted</span>}
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"><Droplet className="h-3 w-3 text-red-400" /> {selected.bloodGroup}</span>
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {selected.phone}</span>
                </div>

                <Section title={t('records.sectionVitals')}>
                  {selected.vitals ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[[t('records.vitalBp'), selected.vitals.bp], [t('records.vitalTemp'), selected.vitals.temp], ['SpO₂', selected.vitals.spo2], [t('records.vitalPulse'), selected.vitals.pulse], [t('records.vitalWeight'), selected.vitals.weight]].map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10.5px] font-semibold text-slate-400">{k}</p><p className="text-[13px] font-bold text-slate-900">{v}</p></div>
                      ))}
                    </div>
                  ) : <p className="text-[12.5px] text-amber-600 flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> {t('records.vitalsNotRecorded')}</p>}
                </Section>

                <Section title={t('records.sectionChiefComplaint')}>
                  {selected.symptoms.length ? <div className="flex flex-wrap gap-1.5">{selected.symptoms.map(s => <span key={s} className="text-[12px] font-medium bg-primary-soft text-accent px-2.5 py-1 rounded-full">{s}</span>)}</div> : <p className="text-[12.5px] text-slate-400">{t('records.noneRecorded')}</p>}
                </Section>
                {selected.history.length > 0 && (
                  <Section title={t('records.sectionMedicalHistory')}>
                    <div className="flex flex-wrap gap-1.5">{selected.history.map(h => <span key={h} className="text-[12px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{h}</span>)}</div>
                  </Section>
                )}

                <Section title={t('records.sectionPastVisits')}>
                  {visits.filter(v => v.patientId === selected.id).length ? (
                    <div className="space-y-2">
                      {visits.filter(v => v.patientId === selected.id).map(v => (
                        <div key={v.id} className="rounded-xl bg-slate-50 p-3">
                          <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-slate-900">{v.diagnosis}</p><span className="text-[11px] text-slate-400">{new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                          <p className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1"><Pill className="h-3 w-3" /> {v.prescriptions.map(p => p.medicine).join(', ') || '—'}</p>
                          {v.notes && <p className="text-[11.5px] text-slate-500 mt-1">{v.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-[12.5px] text-slate-400 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {t('records.noPriorVisits')}</p>}
                </Section>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4">
                <button onClick={() => openConsult(selected)} className="w-full h-11 rounded-xl bg-[var(--color-primary)] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 hover:bg-[var(--color-primary-dark)] transition">
                  {selected.mode === 'online' ? <Video className="h-4.5 w-4.5" /> : <Stethoscope className="h-4.5 w-4.5" />} {t('records.openConsultation')} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</p>
      {children}
    </div>
  )
}
