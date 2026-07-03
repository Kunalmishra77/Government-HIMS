"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Clock, Stethoscope, Plus, ChevronLeft, ChevronRight, X, CheckCircle, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePatientStore } from "@/store/usePatientStore"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { NeonBadge } from "@/components/ui/neon-badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const DOCTORS = [
  {
    id: 'D1', name: 'Dr. Priya Nair', specialty: 'General Medicine',
    fee: 600, nextAvailable: 'Today',
    slots: { 0: ['09:00 AM', '09:30 AM', '10:30 AM'], 1: ['11:00 AM', '11:30 AM', '02:00 PM'], 2: ['09:00 AM', '10:00 AM', '04:00 PM'] },
  },
  {
    id: 'D2', name: 'Dr. Rohan Mehta', specialty: 'Cardiology',
    fee: 1200, nextAvailable: 'Tomorrow',
    slots: { 0: ['10:00 AM', '11:00 AM'], 1: ['09:30 AM', '10:30 AM', '03:00 PM'], 2: ['10:00 AM', '11:30 AM'] },
  },
  {
    id: 'D3', name: 'Dr. Kiran Joshi', specialty: 'Orthopedics',
    fee: 900, nextAvailable: 'Today',
    slots: { 0: ['09:00 AM', '10:00 AM', '11:00 AM'], 1: ['02:00 PM', '03:00 PM'], 2: ['09:30 AM', '10:30 AM', '11:30 AM'] },
  },
  {
    id: 'D4', name: 'Dr. Ananya Bose', specialty: 'Dermatology',
    fee: 800, nextAvailable: 'Today',
    slots: { 0: ['11:00 AM', '11:30 AM', '04:00 PM'], 1: ['09:00 AM', '10:00 AM', '03:30 PM'], 2: ['10:30 AM', '04:30 PM'] },
  },
  {
    id: 'D5', name: 'Dr. Sanjay Mehta', specialty: 'Gastroenterology',
    fee: 1000, nextAvailable: 'Tomorrow',
    slots: { 0: ['10:00 AM', '11:30 AM'], 1: ['09:00 AM', '10:30 AM', '02:30 PM'], 2: ['11:00 AM', '02:00 PM'] },
  },
]

const SPECIALTIES = ['All', ...Array.from(new Set(DOCTORS.map(d => d.specialty)))]

function MiniCalendar({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const [viewDate, setViewDate] = useState(new Date())
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const monthName = viewDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
          <ChevronLeft className="h-4 w-4 text-slate-600" />
        </button>
        <p className="text-sm font-bold text-slate-900">{monthName}</p>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
          <ChevronRight className="h-4 w-4 text-slate-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-[11px] font-bold text-slate-400 py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const date = new Date(year, month, day)
          date.setHours(0, 0, 0, 0)
          const isPast = date < today
          const isSelected = selected.toDateString() === date.toDateString()
          const isToday = today.toDateString() === date.toDateString()
          return (
            <button
              key={i}
              disabled={isPast}
              onClick={() => onSelect(date)}
              className={cn(
                "w-8 h-8 mx-auto rounded-full text-xs font-medium transition-all cursor-pointer",
                isPast ? "text-slate-300 cursor-not-allowed" :
                isSelected ? "bg-[var(--color-primary)] text-white font-bold" :
                isToday ? "text-[var(--color-accent)] font-bold ring-1 ring-primary/25" :
                "text-slate-700 hover:bg-slate-100"
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function PatientAppointments() {
  const t = useTranslations('patient')
  const { appointments, bookAppointment, cancelAppointment } = usePatientStore()
  const [mode, setMode] = useState<'list' | 'book'>('list')
  const [step, setStep] = useState<'doctor' | 'date' | 'confirm'>('doctor')
  const [specialty, setSpecialty] = useState('All')
  const [selectedDoctor, setSelectedDoctor] = useState<typeof DOCTORS[0] | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const filteredDoctors = DOCTORS.filter(d => specialty === 'All' || d.specialty === specialty)

  const dateOffset = Math.min(
    Math.floor((selectedDate.getTime() - new Date().setHours(0,0,0,0)) / 86400000),
    2
  )
  const availableSlots: string[] = selectedDoctor
    ? (selectedDoctor.slots as Record<number, string[]>)[dateOffset] ?? []
    : []

  const handleBook = () => {
    if (!selectedDoctor || !selectedSlot) return
    bookAppointment({
      patientId: 'PT-20391',
      patientName: 'Kiran Patil',
      doctorName: selectedDoctor.name,
      specialty: selectedDoctor.specialty,
      date: selectedDate.toISOString().slice(0, 10),
      time: selectedSlot,
      mode: 'in_person',
      status: 'upcoming',
    })
    notifyAndAuditMany(['reception', 'doctor'], {
      type: 'appointment', priority: 'medium',
      title: t('appointments.notifBookedTitle'),
      body: `Patient booked with ${selectedDoctor.name} (${selectedDoctor.specialty}) on ${selectedDate.toLocaleDateString('en-IN')} at ${selectedSlot}.`,
      patientName: 'Kiran Patil',
      audit: { action: 'reception_registered', resource: 'appointment', detail: `Patient self-booked appointment with ${selectedDoctor.name} on ${selectedDate.toISOString().slice(0,10)} at ${selectedSlot}`, userName: 'Patient' },
    })
    toast.success(t('appointments.toastBooked', { doctor: selectedDoctor.name, date: selectedDate.toLocaleDateString('en-IN'), time: selectedSlot }))
    setMode('list')
    setStep('doctor')
    setSelectedDoctor(null)
    setSelectedSlot(null)
  }

  const active = appointments.filter(a => a.status !== 'cancelled')
  const cancelled = appointments.filter(a => a.status === 'cancelled')

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">{t('appointments.title')}</h2>
        <Button onClick={() => { setMode(mode === 'book' ? 'list' : 'book'); setStep('doctor') }}>
          {mode === 'book' ? <><X className="h-4 w-4 mr-1.5" /> {t('appointments.cancel')}</> : <><Plus className="h-4 w-4 mr-1.5" /> {t('appointments.bookNew')}</>}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {/* Booking Flow */}
        {mode === 'book' && (
          <motion.div key="book" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {['doctor', 'date', 'confirm'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
                    step === s ? "bg-[var(--color-primary)] text-white" :
                    ['doctor', 'date', 'confirm'].indexOf(step) > i ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"
                  )}>
                    {['doctor', 'date', 'confirm'].indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  <span className={cn("text-xs font-semibold capitalize", step === s ? "text-slate-900" : "text-slate-400")}>{t(`appointments.step${s.charAt(0).toUpperCase() + s.slice(1)}`)}</span>
                  {i < 2 && <div className="h-px w-6 bg-slate-200" />}
                </div>
              ))}
            </div>

            {/* Step 1: Doctor Selection */}
            {step === 'doctor' && (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {SPECIALTIES.map(s => (
                    <button key={s} onClick={() => setSpecialty(s)}
                      className={cn("text-sm font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer",
                        specialty === s ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}>
                      {s === 'All' ? t('appointments.specialtyAll') : s}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {filteredDoctors.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => { setSelectedDoctor(doc); setStep('date') }}
                      className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-[rgba(238,107,38,0.30)] hover:bg-[rgba(238,107,38,0.10)]/20 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] flex items-center justify-center">
                            <User className="h-5 w-5 text-[var(--color-accent)]" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{doc.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{doc.specialty}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">₹{doc.fee}</p>
                          <p className="text-[11px] text-green-600 font-semibold mt-0.5">{t('appointments.next', { when: doc.nextAvailable === 'Today' ? t('consultations.dayToday') : doc.nextAvailable === 'Tomorrow' ? t('consultations.dayTomorrow') : doc.nextAvailable })}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Date & Slot */}
            {step === 'date' && selectedDoctor && (
              <div className="space-y-4">
                <button onClick={() => setStep('doctor')} className="flex items-center gap-1 text-sm text-[var(--color-accent)] font-semibold cursor-pointer hover:underline">
                  <ChevronLeft className="h-4 w-4" /> {t('appointments.changeDoctor')}
                </button>
                <div className="bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl p-3 flex items-center gap-3">
                  <User className="h-5 w-5 text-[var(--color-accent)] flex-shrink-0" />
                  <div>
                    <p className="font-bold text-[var(--color-primary-dark)] text-sm">{selectedDoctor.name}</p>
                    <p className="text-xs text-[var(--color-accent)]">{selectedDoctor.specialty} · ₹{selectedDoctor.fee}</p>
                  </div>
                </div>
                <MiniCalendar selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null) }} />
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-2">
                    {t('appointments.availableSlots', { date: selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) })}
                  </p>
                  {availableSlots.length === 0 ? (
                    <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">{t('appointments.noSlots')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn("px-4 py-2 rounded-xl border text-sm font-semibold transition-all cursor-pointer",
                            selectedSlot === slot ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white border-slate-200 text-slate-700 hover:border-[rgba(238,107,38,0.30)]"
                          )}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  disabled={!selectedSlot}
                  onClick={() => setStep('confirm')}
                  className="w-full"
                >
                  {t('appointments.continue')}
                </Button>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 'confirm' && selectedDoctor && selectedSlot && (
              <div className="space-y-4">
                <button onClick={() => setStep('date')} className="flex items-center gap-1 text-sm text-[var(--color-accent)] font-semibold cursor-pointer hover:underline">
                  <ChevronLeft className="h-4 w-4" /> {t('appointments.changeSlot')}
                </button>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h3 className="font-bold text-slate-900">{t('appointments.bookingSummary')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Stethoscope className="h-4 w-4 text-slate-400" />
                      <span>{selectedDoctor.name} — {selectedDoctor.specialty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>{selectedSlot}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-semibold text-slate-600">{t('appointments.consultationFee')}</span>
                    <span className="text-sm font-bold text-slate-900">₹{selectedDoctor.fee}</span>
                  </div>
                </div>
                <Button onClick={handleBook} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-1.5" /> {t('appointments.confirmAppointment')}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Appointment List */}
        {mode === 'list' && (
          <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {active.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold">{t('appointments.noUpcoming')}</p>
                <p className="text-sm mt-1">{t('appointments.bookFirst')}</p>
              </div>
            )}
            {active.map((appt, i) => (
              <motion.div key={appt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <NeonBadge variant={appt.status === 'confirmed' ? 'success' : 'blue'}>
                          {appt.status === 'confirmed' ? t('appointments.confirmed') : t('appointments.upcoming')}
                        </NeonBadge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-[var(--color-accent)]" />
                        <span className="font-semibold text-slate-900">
                          {new Date(appt.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {appt.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Stethoscope className="h-4 w-4" />
                        <span>{appt.doctorName} — {appt.specialty}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        cancelAppointment(appt.id)
                        notifyAndAuditMany(['reception', 'doctor'], {
                          type: 'appointment', priority: 'medium',
                          title: `Appointment cancelled · ${appt.doctorName}`,
                          body: `Patient cancelled the appointment with ${appt.doctorName} (${appt.specialty}) on ${appt.date} at ${appt.time}.`,
                          patientName: 'Kiran Patil',
                          audit: { action: 'reception_registered', resource: 'appointment', resourceId: appt.id, detail: `Patient cancelled appointment`, userName: 'Kiran Patil' },
                        })
                        toast.success(t('appointments.toastCancelled'))
                      }}
                      className="text-xs font-semibold text-red-500 hover:text-red-700 cursor-pointer px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      {t('appointments.cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {cancelled.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('appointments.cancelledHeading')}</p>
                {cancelled.map(appt => (
                  <div key={appt.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 opacity-60">
                    <p className="text-sm font-semibold text-slate-600 line-through">{appt.doctorName} — {appt.time}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(appt.date).toLocaleDateString('en-IN')}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
