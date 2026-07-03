"use client"

import { Select } from "@/components/ui/Select"
import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Volume2, ArrowRight, Phone, Calendar, Stethoscope, Activity,
  Clock, Droplet, ShieldCheck, ChevronRight, Users as UsersIcon,
} from "lucide-react"
import { usePatientStore, type Patient, type QueueStatus, type TriageLevel } from "@/store/usePatientStore"
import { useAuthStore } from "@/store/useAuthStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import type { Role } from "@/types/roles"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { PatientJourneyTimeline } from "@/components/clinical/PatientJourneyTimeline"
import { DataTablePro, type ProColumn } from "@/components/ui/DataTablePro"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { PatientAvatar } from "@/components/ui/PatientAvatar"

const STATUS_TOKEN: Record<QueueStatus, Status> = {
  waiting: 'pending', vitals: 'caution', consulting: 'info', pharmacy: 'info', billing: 'neutral', done: 'done',
}
const triageToken = (lvl?: TriageLevel): Status =>
  lvl === 'Critical' ? 'critical' : lvl === 'High' ? 'urgent' : lvl === 'Medium' ? 'caution' : 'stable'

const STATUS_KEY: Record<QueueStatus, string> = {
  waiting: 'statusWaiting', vitals: 'statusVitals', consulting: 'statusConsulting', pharmacy: 'statusPharmacy', billing: 'statusBilling', done: 'statusCompleted',
}
const STATUS_TINT: Record<QueueStatus, string> = {
  waiting: 'bg-amber-50 text-amber-700', vitals: 'bg-surface-sunken text-accent', consulting: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]',
  pharmacy: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]', billing: 'bg-primary-soft text-accent', done: 'bg-green-50 text-green-700',
}
const TRIAGE_TINT: Record<TriageLevel, string> = {
  Critical: 'bg-red-50 text-red-700', High: 'bg-primary-soft text-accent', Medium: 'bg-amber-50 text-amber-700', Low: 'bg-green-50 text-green-700',
}
const NEXT_STATUS: Partial<Record<QueueStatus, { next: QueueStatus; labelKey: string }>> = {
  waiting: { next: 'vitals', labelKey: 'nextSendToVitals' }, vitals: { next: 'consulting', labelKey: 'nextSendToDoctor' },
  consulting: { next: 'pharmacy', labelKey: 'nextSendToPharmacy' }, pharmacy: { next: 'billing', labelKey: 'nextSendToBilling' },
  billing: { next: 'done', labelKey: 'nextMarkDone' },
}
const DEPARTMENTS = ['All', 'General Medicine', 'Cardiology', 'Orthopaedics', 'Gynaecology', 'ENT', 'Ophthalmology', 'Dermatology', 'Paediatrics']
const TABS = ['Today', 'Yesterday', 'Upcoming', 'All'] as const
type Tab = typeof TABS[number]
const TAB_KEY: Record<Tab, string> = { Today: 'tabToday', Yesterday: 'tabYesterday', Upcoming: 'tabUpcoming', All: 'tabAll' }

const initials = (n: string) => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

const NOTIFY_ROLE_BY_NEXT: Partial<Record<QueueStatus, Role>> = {
  vitals: 'nurse', consulting: 'doctor', pharmacy: 'pharmacy', billing: 'billing',
}

export default function ReceptionPatients() {
  const t = useTranslations('reception')
  const { patients, visits, appointments, updateStatus } = usePatientStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const [tab, setTab] = useState<Tab>('Today')
  const [dept, setDept] = useState('All')
  const [triage, setTriage] = useState('All')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const todayISO = new Date().toISOString().slice(0, 10)
  const yesterdayISO = new Date(new Date().getTime() - 86400000).toISOString().slice(0, 10)
  const upcomingIds = useMemo(
    () => new Set(appointments.filter(a => a.status !== 'cancelled' && a.date > todayISO).map(a => a.patientId)),
    [appointments, todayISO],
  )

  const bucket = (t: Tab): Patient[] => {
    if (t === 'Today') return patients.filter(p => (p.registeredDate ?? todayISO) === todayISO)
    if (t === 'Yesterday') return patients.filter(p => p.registeredDate === yesterdayISO)
    if (t === 'Upcoming') return patients.filter(p => upcomingIds.has(p.id))
    return patients // All
  }

  const counts = Object.fromEntries(TABS.map(t => [t, bucket(t).length])) as Record<Tab, number>

  const rows = bucket(tab).filter(p => {
    const matchDept = dept === 'All' || p.department === dept
    const matchTriage = triage === 'All' || p.triageLevel === triage
    return matchDept && matchTriage
  })

  const selected = patients.find(p => p.id === selectedId) ?? null

  // Close the detail drawer on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const announce = (p: Patient) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(`Token number ${p.token}, ${p.name}, please proceed.`))
      }
    } catch { /* optional */ }
    toast.success(t('patients.announcedToast', { token: p.token }), { description: p.name })
  }

  const advance = (p: Patient) => {
    const n = NEXT_STATUS[p.queueStatus]
    if (!n) return
    updateStatus(p.id, n.next)
    const targetRole = NOTIFY_ROLE_BY_NEXT[n.next]
    const nextLabel = t(`patients.${STATUS_KEY[n.next]}`)
    if (targetRole) {
      notifyAndAudit({
        to: targetRole, type: 'system', priority: 'medium',
        title: t('patients.routedTitle', { name: p.name, status: nextLabel }),
        body: t('patients.routedBody', { name: p.name, id: p.id, token: p.token, from: t(`patients.${STATUS_KEY[p.queueStatus]}`), to: nextLabel, department: p.department }),
        patientName: p.name,
        audit: { action: 'reception_queue_advance', resource: 'patient_queue', resourceId: p.id, detail: `Queue advance ${p.queueStatus} → ${n.next}`, userName: currentUser?.name ?? 'Reception' },
      })
    }
    toast.success(t('patients.advancedToast', { name: p.name, status: nextLabel }))
  }

  const columns: ProColumn<Patient>[] = [
    {
      key: 'name', label: t('patients.colPatient'), primary: true, sortable: true, lockedVisible: true,
      render: p => (
        <div className="flex items-center gap-3 min-w-0">
          <PatientAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{p.name}</p>
            <p className="t-caption text-foreground-lighter">{p.id} · {p.age}y · {p.gender}</p>
          </div>
        </div>
      ),
    },
    { key: 'department', label: t('patients.colDepartment'), sortable: true },
    {
      key: 'queueStatus', label: t('patients.colStatus'), sortable: true,
      render: p => <StatusPill status={STATUS_TOKEN[p.queueStatus]} label={t(`patients.${STATUS_KEY[p.queueStatus]}`)} dense />,
    },
    {
      key: 'triageLevel', label: t('patients.colTriage'), sortable: true,
      render: p => p.triageLevel ? <StatusPill status={triageToken(p.triageLevel)} label={p.triageLevel} dense /> : <span className="text-foreground-placeholder">—</span>,
    },
    { key: 'token', label: t('patients.colToken'), sortable: true, sortAccessor: p => p.token, render: p => <span className="tabular-nums">#{p.token}</span> },
    { key: 'registeredAt', label: t('patients.colRegistered'), hideOnMobile: true, render: p => <span className="inline-flex items-center gap-1.5 text-foreground-lighter"><Clock className="h-3.5 w-3.5" />{p.registeredAt}</span> },
    { key: 'chevron', label: '', align: 'right', lockedVisible: true, render: () => <ChevronRight className="h-4 w-4 text-foreground-placeholder inline" /> },
  ]

  const chips: { label: string; onRemove?: () => void }[] = []
  if (tab !== 'All') chips.push({ label: t(`patients.${TAB_KEY[tab]}`) })
  if (dept !== 'All') chips.push({ label: dept, onRemove: () => setDept('All') })
  if (triage !== 'All') chips.push({ label: t('patients.acuityChip', { level: triage }), onRemove: () => setTriage('All') })
  const clearAll = () => { setDept('All'); setTriage('All'); setTab('All') }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('patients.pageTitle')}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{t('patients.pageSubtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-3">
        {TABS.map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition", tab === tb ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t(`patients.${TAB_KEY[tb]}`)} <span className={cn("text-[11px] font-bold px-1.5 rounded-full", tab === tb ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-slate-200 text-slate-500")}>{counts[tb]}</span>
          </button>
        ))}
      </div>

      <DataTablePro
        title={t('patients.tableTitle')}
        itemNoun={t('patients.itemNoun')}
        columns={columns}
        data={rows}
        keyField="id"
        onRowClick={p => setSelectedId(p.id)}
        searchKeys={['name', 'id', 'phone']}
        searchPlaceholder={t('patients.searchPlaceholder')}
        selectable
        filterChips={chips}
        onClearFilters={chips.length ? clearAll : undefined}
        bulkActions={(sel) => (
          <button onClick={() => { sel.forEach(announce) }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-dark)] cursor-pointer transition-colors">
            <Volume2 className="h-4 w-4" /> {t('patients.announce')}
          </button>
        )}
        toolbarLeft={
          <>
            <Select value={dept} onChange={e => setDept(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20">
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d === 'All' ? t('patients.allDepartments') : d}</option>)}
            </Select>
            <Select value={triage} onChange={e => setTriage(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20">
              {['All', 'Critical', 'High', 'Medium', 'Low'].map(lvl => <option key={lvl} value={lvl}>{lvl === 'All' ? t('patients.allAcuity') : lvl}</option>)}
            </Select>
          </>
        }
        emptyState={
          <div className="flex flex-col items-center text-center py-6">
            <span className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><UsersIcon className="h-6 w-6 text-slate-400" /></span>
            <p className="text-[14px] font-semibold text-slate-700">{t('patients.emptyTitle')}</p>
            <p className="text-[12.5px] text-slate-500 mt-0.5">{t('patients.emptySubtitle')}</p>
          </div>
        }
      />

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSelectedId(null)} />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl overflow-y-auto"
              role="dialog" aria-modal="true" aria-label={t('patients.patientDetails')}>
              <PatientDrawer patient={selected} visits={visits.filter(v => v.patientId === selected.id)}
                appointments={appointments.filter(a => a.patientId === selected.id)}
                onClose={() => setSelectedId(null)} onAnnounce={() => announce(selected)} onAdvance={() => advance(selected)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function PatientDrawer({ patient: p, visits, appointments, onClose, onAnnounce, onAdvance }: {
  patient: Patient
  visits: ReturnType<typeof usePatientStore.getState>['visits']
  appointments: ReturnType<typeof usePatientStore.getState>['appointments']
  onClose: () => void; onAnnounce: () => void; onAdvance: () => void
}) {
  const t = useTranslations('reception')
  const next = NEXT_STATUS[p.queueStatus]
  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
        <div className="flex items-center gap-3">
          {p.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.photoUrl} alt={p.name} className="h-12 w-12 rounded-2xl object-cover border border-slate-200" />
            : <span className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white flex items-center justify-center font-bold text-[16px]">{initials(p.name)}</span>}
          <div>
            <p className="text-[17px] font-bold text-slate-900 leading-tight">{p.name}</p>
            <p className="text-[12.5px] text-slate-500">{p.id} · {p.age}y · {p.gender}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label={t('patients.close')} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4.5 w-4.5 text-slate-500" /></button>
      </div>

      <div className="p-5 space-y-5">
        {/* Badges + token */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", STATUS_TINT[p.queueStatus])}>{t(`patients.${STATUS_KEY[p.queueStatus]}`)}</span>
          {p.triageLevel && <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider", TRIAGE_TINT[p.triageLevel])}>{p.triageLevel}</span>}
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{t('patients.tokenLabel', { token: p.token })}</span>
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"><Droplet className="h-3 w-3 text-red-400" /> {p.bloodGroup}</span>
        </div>

        {/* Quick facts */}
        <div className="grid grid-cols-2 gap-2.5">
          <Fact icon={Phone} label={t('patients.factPhone')} value={p.phone} />
          <Fact icon={Stethoscope} label={t('patients.factDoctor')} value={p.doctor} />
          <Fact icon={Clock} label={t('patients.factRegistered')} value={p.registeredAt} />
          <Fact icon={Calendar} label={t('patients.factDepartment')} value={p.department} />
        </div>

        {/* Vitals */}
        <Section title={t('patients.sectionVitals')}>
          {p.vitals ? (
            <div className="grid grid-cols-3 gap-2">
              {[[t('patients.vitalBp'), p.vitals.bp], [t('patients.vitalTemp'), p.vitals.temp], [t('patients.vitalSpo2'), p.vitals.spo2], [t('patients.vitalPulse'), p.vitals.pulse], [t('patients.vitalWeight'), p.vitals.weight]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10.5px] font-semibold text-slate-400">{k}</p><p className="text-[13px] font-bold text-slate-900">{v}</p></div>
              ))}
            </div>
          ) : <p className="text-[12.5px] text-amber-600 flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> {t('patients.vitalsNotRecorded')}</p>}
        </Section>

        {/* Symptoms + history */}
        <Section title={t('patients.sectionChiefComplaint')}>
          {p.symptoms.length ? <div className="flex flex-wrap gap-1.5">{p.symptoms.map(s => <span key={s} className="text-[12px] font-medium bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] px-2.5 py-1 rounded-full">{s}</span>)}</div> : <p className="text-[12.5px] text-slate-400">{t('patients.noneRecorded')}</p>}
        </Section>
        {p.history.length > 0 && (
          <Section title={t('patients.sectionMedicalHistory')}>
            <div className="flex flex-wrap gap-1.5">{p.history.map(h => <span key={h} className="text-[12px] font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{h}</span>)}</div>
          </Section>
        )}

        {/* Appointments */}
        {appointments.length > 0 && (
          <Section title={t('patients.sectionAppointments')}>
            <div className="space-y-2">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5">
                  <Calendar className="h-4 w-4 text-[var(--color-accent)] flex-shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-[12.5px] font-semibold text-slate-800 truncate">{a.doctorName} · {a.specialty}</p><p className="text-[11px] text-slate-500">{new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {a.time}</p></div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full capitalize", a.status === 'cancelled' ? 'bg-red-50 text-red-600' : a.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]')}>{a.status}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Past visits */}
        {visits.length > 0 && (
          <Section title={t('patients.sectionPastVisits')}>
            <div className="space-y-2">
              {visits.map(v => (
                <div key={v.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between"><p className="text-[13px] font-bold text-slate-900">{v.diagnosis}</p><span className="text-[11px] text-slate-400">{new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">{v.doctor} · {t(v.prescriptions.length !== 1 ? 'patients.medicineCountPlural' : 'patients.medicineCount', { count: v.prescriptions.length })}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Family tracking */}
        <Section title={t('patients.sectionFamilyTracking')}>
          {p.familyAccessToken ? (
            <p className="text-[12.5px] text-green-700 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {t('patients.familyLinkActive')}{p.dishaConsentGiven ? t('patients.dishaConsent') : ''}</p>
          ) : <p className="text-[12.5px] text-slate-400">{t('patients.noFamilyLink')}</p>}
        </Section>

        {/* Cross-department journey timeline */}
        <Section title={t('patients.sectionPatientJourney')}>
          <PatientJourneyTimeline patientId={p.id} patientName={p.name} variant="compact" />
          <a href={`/journey/${p.id}`} target="_blank" rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent)] hover:underline">
            {t('patients.openFullJourney')}
          </a>
        </Section>
      </div>

      {/* Sticky actions */}
      <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-2">
        <button onClick={onAnnounce} className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-700 font-bold text-[13.5px] flex items-center justify-center gap-2 hover:bg-slate-200 transition"><Volume2 className="h-4.5 w-4.5" /> {t('patients.announceAction')}</button>
        {next && <button onClick={onAdvance} className="flex-1 h-11 rounded-xl bg-[var(--color-primary)] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 hover:bg-[var(--color-primary-dark)] transition">{t(`patients.${next.labelKey}`)} <ArrowRight className="h-4 w-4" /></button>}
      </div>
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-slate-400 flex-shrink-0" />
      <div className="min-w-0"><p className="text-[10.5px] font-semibold text-slate-400">{label}</p><p className="text-[12.5px] font-bold text-slate-900 truncate">{value}</p></div>
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
