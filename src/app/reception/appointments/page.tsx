"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar, Plus, X, Video, Building2, Clock, Stethoscope, RotateCcw,
  CheckCircle, Ban, ArrowRight, User,
} from "lucide-react"
import { usePatientStore, type Appointment } from "@/store/usePatientStore"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { DataTablePro, type ProColumn } from "@/components/ui/DataTablePro"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { Avatar } from "@/components/ui/avatar"

const APPT_STATUS_TOKEN: Record<string, Status> = { upcoming: 'pending', confirmed: 'stable', cancelled: 'neutral' }
const APPT_STATUS_KEY: Record<string, string> = { upcoming: 'statusUpcoming', confirmed: 'statusConfirmed', cancelled: 'statusCancelled' }

const DOCTORS = [
  { name: 'Dr. Priya Nair', specialty: 'General Medicine' },
  { name: 'Dr. Rohan Mehta', specialty: 'Cardiology' },
  { name: 'Dr. Ananya Iyer', specialty: 'Dermatology' },
  { name: 'Dr. Vikram Rao', specialty: 'ENT' },
  { name: 'Dr. Meena Shah', specialty: 'Gynaecology' },
]
const SLOTS = ['09:30 AM', '11:00 AM', '12:30 PM', '02:15 PM', '04:00 PM', '06:30 PM']
const MODES = [['all', 'All'], ['online', 'Online'], ['in_person', 'In-person']] as const
const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

type Draft = { patientName: string; doctorIdx: number; mode: 'online' | 'in_person'; date: string; time: string }

export default function ReceptionAppointments() {
  const t = useTranslations('reception')
  const { patients, appointments, bookAppointment, updateAppointment, cancelAppointment } = usePatientStore()
  const [modeFilter, setModeFilter] = useState<typeof MODES[number][0]>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'confirmed' | 'cancelled'>('all')
  const [showModal, setShowModal] = useState(false)
  const [rescheduleId, setRescheduleId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ patientName: '', doctorIdx: 0, mode: 'in_person', date: todayISO(), time: SLOTS[1] })

  const nameFor = (a: Appointment) => a.patientName ?? patients.find(p => p.id === a.patientId)?.name ?? a.patientId

  const rows = appointments
    .filter(a => (modeFilter === 'all' || (a.mode ?? 'in_person') === modeFilter) && (statusFilter === 'all' || a.status === statusFilter))
    .sort((a, b) => (a.status === 'cancelled' ? 1 : 0) - (b.status === 'cancelled' ? 1 : 0) || a.date.localeCompare(b.date))

  const counts = {
    today: appointments.filter(a => a.date === todayISO() && a.status !== 'cancelled').length,
    online: appointments.filter(a => a.mode === 'online' && a.status !== 'cancelled').length,
    upcoming: appointments.filter(a => a.status === 'upcoming').length,
  }

  const openNew = () => { setRescheduleId(null); setDraft({ patientName: '', doctorIdx: 0, mode: 'in_person', date: todayISO(), time: SLOTS[1] }); setShowModal(true) }
  const openReschedule = (a: Appointment) => {
    setRescheduleId(a.id)
    setDraft({
      patientName: nameFor(a),
      doctorIdx: Math.max(0, DOCTORS.findIndex(d => d.name === a.doctorName)),
      mode: a.mode ?? 'in_person',
      date: a.date, time: SLOTS.includes(a.time) ? a.time : SLOTS[1],
    })
    setShowModal(true)
  }

  const submit = () => {
    if (!draft.patientName.trim()) { toast.error(t('appointments.enterPatientName')); return }
    const doc = DOCTORS[draft.doctorIdx]
    if (rescheduleId) {
      updateAppointment(rescheduleId, { patientName: draft.patientName.trim(), doctorName: doc.name, specialty: doc.specialty, mode: draft.mode, date: draft.date, time: draft.time })
      toast.success(t('appointments.rescheduledToast'), { description: t('appointments.rescheduledDesc', { name: draft.patientName, date: fmtDate(draft.date), time: draft.time }) })
    } else {
      const match = patients.find(p => p.name.toLowerCase() === draft.patientName.trim().toLowerCase())
      const isToday = draft.date === todayISO()
      const isInPerson = draft.mode === 'in_person'
      bookAppointment({
        patientId: match?.id ?? `WALKIN-${Date.now()}`, patientName: draft.patientName.trim(),
        doctorName: doc.name, specialty: doc.specialty, mode: draft.mode, date: draft.date, time: draft.time, status: 'upcoming',
      })
      if (isToday && isInPerson) {
        toast.success(t('appointments.bookedQueuedToast'), {
          description: t('appointments.bookedQueuedDesc', { name: draft.patientName, doctor: doc.name, time: draft.time }),
        })
      } else {
        toast.success(t('appointments.bookedToast'), { description: t('appointments.bookedDesc', { name: draft.patientName, doctor: doc.name, date: fmtDate(draft.date), time: draft.time }) })
      }
    }
    setShowModal(false)
  }

  const columns: ProColumn<Appointment>[] = [
    {
      key: 'patient', label: t('appointments.colPatient'), primary: true, sortable: true, lockedVisible: true,
      sortAccessor: a => nameFor(a),
      render: a => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={nameFor(a)} size="sm" />
          <p className="font-bold text-foreground truncate">{nameFor(a)}</p>
        </div>
      ),
    },
    {
      key: 'doctorName', label: t('appointments.colDoctor'), sortable: true,
      render: a => (
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 font-semibold text-foreground-muted truncate"><Stethoscope className="h-3.5 w-3.5 text-foreground-lighter" />{a.doctorName}</p>
          <p className="t-caption text-foreground-lighter">{a.specialty}</p>
        </div>
      ),
    },
    { key: 'date', label: t('appointments.colDate'), sortable: true, sortAccessor: a => a.date, render: a => <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-foreground-lighter" />{fmtDate(a.date)}</span> },
    { key: 'time', label: t('appointments.colTime'), render: a => <span className="inline-flex items-center gap-1.5 text-foreground-muted"><Clock className="h-3.5 w-3.5 text-foreground-lighter" />{a.time}</span> },
    {
      key: 'mode', label: t('appointments.colMode'), sortable: true, sortAccessor: a => a.mode ?? 'in_person',
      render: a => a.mode === 'online'
        ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-accent)]"><Video className="h-3.5 w-3.5" /> {t('appointments.online')}</span>
        : <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground-muted"><Building2 className="h-3.5 w-3.5" /> {t('appointments.inPerson')}</span>,
    },
    { key: 'status', label: t('appointments.colStatus'), sortable: true, render: a => <StatusPill status={APPT_STATUS_TOKEN[a.status]} label={t(`appointments.${APPT_STATUS_KEY[a.status]}`)} dense /> },
    {
      key: 'actions', label: '', align: 'right', lockedVisible: true,
      render: a => {
        if (a.status === 'cancelled') return <span className="text-foreground-placeholder text-[12px]">—</span>
        const online = a.mode === 'online'
        const isToday = a.date === todayISO()
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
            {online && isToday && (a.status === 'confirmed' || a.status === 'upcoming') && (
              <button onClick={() => toast.success(t('appointments.launchingVideo'), { description: nameFor(a) })} className="text-[12px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition cursor-pointer"><Video className="h-3.5 w-3.5" /> {t('appointments.join')}</button>
            )}
            {a.status === 'upcoming' && (
              <button onClick={() => { updateAppointment(a.id, { status: 'confirmed' }); toast.success(t('appointments.confirmedToast')) }} className="text-[12px] font-bold text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition cursor-pointer"><CheckCircle className="h-3.5 w-3.5" /> {t('appointments.confirm')}</button>
            )}
            <button onClick={() => openReschedule(a)} aria-label={t('appointments.reschedule')} className="text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-lg transition cursor-pointer"><RotateCcw className="h-3.5 w-3.5" /></button>
            <button onClick={() => { cancelAppointment(a.id); toast(t('appointments.cancelledToast')) }} aria-label={t('appointments.cancel')} className="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition cursor-pointer"><Ban className="h-3.5 w-3.5" /></button>
          </div>
        )
      },
    },
  ]

  const chips: { label: string; onRemove?: () => void }[] = []
  if (modeFilter !== 'all') chips.push({ label: modeFilter === 'online' ? t('appointments.online') : t('appointments.inPerson'), onRemove: () => setModeFilter('all') })
  if (statusFilter !== 'all') chips.push({ label: t(`appointments.${APPT_STATUS_KEY[statusFilter]}`), onRemove: () => setStatusFilter('all') })
  const clearAll = () => { setModeFilter('all'); setStatusFilter('all') }

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('appointments.pageTitle')}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{t('appointments.pageSubtitle', { today: counts.today, online: counts.online, upcoming: counts.upcoming })}</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-[13.5px] font-bold shadow-sm active:scale-[0.98] transition">
          <Plus className="h-4 w-4" /> {t('appointments.bookAppointment')}
        </button>
      </div>

      <DataTablePro
        title={t('appointments.tableTitle')}
        itemNoun={t('appointments.itemNoun')}
        columns={columns}
        data={rows}
        keyField="id"
        searchKeys={['patientName', 'doctorName', 'specialty']}
        searchPlaceholder={t('appointments.searchPlaceholder')}
        filterChips={chips}
        onClearFilters={chips.length ? clearAll : undefined}
        toolbarLeft={
          <>
            <Select value={modeFilter} onChange={e => setModeFilter(e.target.value as typeof MODES[number][0])} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20">
              {MODES.map(([key, label]) => <option key={key} value={key}>{label === 'All' ? t('appointments.allModes') : key === 'online' ? t('appointments.online') : t('appointments.inPerson')}</option>)}
            </Select>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20">
              {(['all', 'upcoming', 'confirmed', 'cancelled'] as const).map(s => <option key={s} value={s}>{s === 'all' ? t('appointments.allStatuses') : t(`appointments.${APPT_STATUS_KEY[s]}`)}</option>)}
            </Select>
          </>
        }
        emptyState={
          <div className="flex flex-col items-center text-center py-6">
            <span className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><Calendar className="h-6 w-6 text-slate-400" /></span>
            <p className="text-[14px] font-semibold text-slate-700">{t('appointments.emptyTitle')}</p>
            <p className="text-[12.5px] text-slate-500 mt-0.5">{t('appointments.emptySubtitle')}</p>
          </div>
        }
      />

      {/* Booking / reschedule modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto"
              onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-900">{rescheduleId ? t('appointments.modalReschedule') : t('appointments.modalBook')}</h2>
                <button onClick={() => setShowModal(false)} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="h-4 w-4 text-slate-500" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('appointments.labelPatientName')}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input list="rc-patient-list" value={draft.patientName} onChange={e => setDraft(d => ({ ...d, patientName: e.target.value }))} placeholder={t('appointments.patientNamePlaceholder')}
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-[rgba(238,107,38,0.30)]" />
                    <datalist id="rc-patient-list">{patients.map(p => <option key={p.id} value={p.name} />)}</datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('appointments.labelMode')}</label>
                  <div className="flex gap-2">
                    {([['in_person', t('appointments.inPerson'), Building2], ['online', t('appointments.online'), Video]] as const).map(([key, label, Icon]) => (
                      <button key={key} onClick={() => setDraft(d => ({ ...d, mode: key }))}
                        className={cn("flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition", draft.mode === key ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                        <Icon className="h-4 w-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('appointments.labelDoctor')}</label>
                  <Select value={draft.doctorIdx} onChange={e => setDraft(d => ({ ...d, doctorIdx: parseInt(e.target.value) }))}
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20">
                    {DOCTORS.map((d, i) => <option key={d.name} value={i}>{d.name} · {d.specialty}</option>)}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('appointments.labelDate')}</label>
                    <input type="date" value={draft.date} min={todayISO()} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('appointments.labelTime')}</label>
                    <Select value={draft.time} onChange={e => setDraft(d => ({ ...d, time: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20">
                      {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 font-bold text-[13.5px] hover:bg-slate-50 transition">{t('common.cancel')}</button>
                <button onClick={submit} className="flex-1 h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 transition">
                  {rescheduleId ? t('appointments.saveChanges') : t('appointments.book')} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
