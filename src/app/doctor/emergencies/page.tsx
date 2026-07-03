"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Siren, BedDouble, AlertTriangle, ArrowRight, Activity, Stethoscope } from "lucide-react"
import { useAdmissionStore, type AdmissionRequest, type Bed } from "@/store/useAdmissionStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useConsultationStore } from "@/store/useConsultationStore"
import { type Patient } from "@/store/usePatientStore"
import { cn } from "@/lib/utils"

const TRIAGE_TINT: Record<string, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200', High: 'bg-primary-soft text-accent border-primary/20',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200', Low: 'bg-green-50 text-green-700 border-green-200',
}

export default function DoctorEmergencies() {
  const t = useTranslations('doctor')
  const router = useRouter()
  const admissionRequests = useAdmissionStore(s => s.admissionRequests)
  const beds = useAdmissionStore(s => s.beds)
  const currentUser = useAuthStore(s => s.currentUser)
  const setCurrentPatient = useConsultationStore(s => s.setCurrentPatient)

  const docName = currentUser?.name ?? 'Dr. Priya Nair'

  const reqToPatient = (r: AdmissionRequest): Patient => ({
    id: r.patientId, name: r.patientName, age: r.patientAge, gender: (r.patientGender as Patient['gender']) ?? 'Male',
    phone: '—', bloodGroup: '—', token: 0, queueStatus: 'consulting', estimatedWait: 0, doctor: docName, department: r.department,
    vitals: null, symptoms: [r.diagnosis, r.reason].filter(Boolean), history: r.bundle?.comorbidities ? r.bundle.comorbidities.split(',').map(s => s.trim()) : [],
    registeredAt: '', triageLevel: (r.triageLevel as Patient['triageLevel']) ?? 'High',
  })

  const bedToPatient = (b: Bed): Patient => ({
    id: b.occupantId ?? b.id, name: b.occupantName ?? 'Admitted patient', age: 0, gender: (b.gender === 'Any' ? 'Male' : b.gender) ?? 'Male',
    phone: '—', bloodGroup: '—', token: 0, queueStatus: 'consulting', estimatedWait: 0, doctor: docName, department: b.ward,
    vitals: null, symptoms: [`Admitted · ${b.ward} · Bed ${b.bedNumber}`], history: [], registeredAt: '', triageLevel: b.ward === 'ICU' ? 'High' : 'Medium',
  })

  const attend = (p: Patient) => { setCurrentPatient(p); router.push('/doctor/dashboard') }

  const emergencyReqs = admissionRequests.filter(r => (r.triageLevel === 'Critical' || r.bundle?.urgency === 'Emergency') && r.status !== 'Admitted' && r.status !== 'Cancelled')
  const urgentReqs = admissionRequests.filter(r => r.triageLevel === 'High' && r.bundle?.urgency !== 'Emergency' && r.status !== 'Cancelled')
  const admitted = beds.filter(b => b.status === 'Occupied')

  return (
    <div className="max-w-4xl mx-auto pb-8 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight flex items-center gap-2"><Siren className="h-6 w-6 text-red-500" /> {t('emergencies.title')}</h1>
        <p className="text-[13px] text-slate-500 mt-1">{t('emergencies.subtitle')}</p>
      </div>

      {/* Emergency / critical */}
      <div className="rounded-2xl bg-red-50/50 border border-red-100 p-5">
        <h3 className="text-[15px] font-bold text-red-900 mb-3 flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-red-500" /> {t('emergencies.emergencyCritical')}</h3>
        {emergencyReqs.length === 0 ? (
          <p className="text-[13px] text-slate-500 bg-white rounded-xl p-3">{t('emergencies.noEmergencies')}</p>
        ) : (
          <div className="space-y-2.5">
            {emergencyReqs.map(r => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-xl bg-white border border-red-200 p-3.5">
                <span className="h-11 w-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0"><Siren className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14.5px] font-bold text-slate-900">{r.patientName}</p>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", TRIAGE_TINT[r.triageLevel ?? 'High'])}>{r.triageLevel}</span>
                    {r.bundle?.urgency === 'Emergency' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">{t('emergencies.emergencyBadge')}</span>}
                  </div>
                  <p className="text-[12.5px] text-slate-600 truncate">{r.diagnosis} · {r.admissionType} · {t('emergencies.requestedBy', { name: r.requestedBy })}</p>
                </div>
                <button onClick={() => attend(reqToPatient(r))} className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[12.5px] font-bold flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition">
                  {t('emergencies.attendNow')} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Urgent admissions */}
      {urgentReqs.length > 0 && (
        <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
          <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Activity className="h-4.5 w-4.5 text-accent" /> {t('emergencies.urgentAdmissions')}</h3>
          <div className="space-y-2.5">
            {urgentReqs.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
                <span className="h-10 w-10 rounded-2xl bg-primary-soft text-accent flex items-center justify-center flex-shrink-0"><AlertTriangle className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-slate-900">{r.patientName} <span className={cn("ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border", TRIAGE_TINT[r.triageLevel ?? 'High'])}>{r.triageLevel}</span></p>
                  <p className="text-[12px] text-slate-500 truncate">{r.diagnosis} · {r.admissionType}</p>
                </div>
                <button onClick={() => attend(reqToPatient(r))} className="h-9 px-4 rounded-xl bg-primary hover:bg-primary text-white text-[12.5px] font-bold flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition">
                  {t('emergencies.attend')} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admitted patients */}
      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
        <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><BedDouble className="h-4.5 w-4.5 text-slate-400" /> {t('emergencies.admittedPatients', { count: admitted.length })}</h3>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {admitted.map(b => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className={cn("h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0", b.ward === 'ICU' ? "bg-red-50 text-red-600" : "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]")}><BedDouble className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-slate-900 truncate">{b.occupantName}</p>
                <p className="text-[11.5px] text-slate-500">{b.ward} · Bed {b.bedNumber}</p>
              </div>
              <button onClick={() => attend(bedToPatient(b))} className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-[12px] font-bold flex items-center gap-1 flex-shrink-0 active:scale-95 transition">
                <Stethoscope className="h-3.5 w-3.5" /> {t('emergencies.attend')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
