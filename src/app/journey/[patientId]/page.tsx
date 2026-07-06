"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeft, User, Phone, Droplet, Calendar } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useERStore } from "@/store/useERStore"
import { PatientJourneyFlow } from "@/components/clinical/PatientJourneyFlow"
import { AppShell } from "@/components/layout/AppShell"

export default function PatientJourneyPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params)
  const router = useRouter()
  const t = useTranslations('journey')
  const patient = usePatientStore(s => s.patients.find(p => p.id === patientId))
  const inpatient = useInpatientStore(s => s.inpatients.find(i => i.patientId === patientId))
  const erRecord  = useERStore(s => s.patients.find(e => e.patientId === patientId))
  const name = patient?.name ?? inpatient?.name ?? erRecord?.name ?? t('unknownPatient')
  const age  = patient?.age  ?? inpatient?.age  ?? erRecord?.age
  const rawGender = patient?.gender ?? inpatient?.gender ?? (erRecord?.gender === 'M' ? 'Male' : erRecord?.gender === 'F' ? 'Female' : undefined)
  const gender = rawGender === 'Male' ? t('male') : rawGender === 'Female' ? t('female') : rawGender
  const bg   = patient?.bloodGroup
  const phone = patient?.phone

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm font-bold ink-muted hover:text-foreground cursor-pointer">
          <ArrowLeft className="h-4 w-4" />{t('back')}
        </button>

        <div className="hms-card p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl gradient-primary text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
              {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="t-h2 text-foreground">{name}</h1>
              <p className="t-body ink-muted mt-0.5">{patientId}</p>
              <div className="flex items-center gap-4 mt-3 t-caption ink-muted flex-wrap">
                {age && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{gender ? t('ageGender', { age, gender }) : t('ageYears', { age })}</span>}
                {bg && <span className="flex items-center gap-1"><Droplet className="h-3.5 w-3.5 text-[color:var(--color-danger)]" />{bg}</span>}
                {phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{phone}</span>}
                {inpatient && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t('admitted', { date: new Date(inpatient.admittedAt).toLocaleDateString('en-IN') })}</span>}
              </div>
            </div>
          </div>
        </div>

        <PatientJourneyFlow patientId={patientId} patientName={name} />
      </div>
    </AppShell>
  )
}
