"use client"

import Link from "next/link"
import { useWard } from "@/lib/useWard"
import { useShiftStore } from "@/store/useShiftStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { Bed, AlertCircle, ChevronRight } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { deriveUhid } from "@/lib/uhid"
import { EmptyState } from "@/components/ui/EmptyState"
import { news2Token } from "@/lib/statusColors"
import { Card } from "@/components/ui/card"
import { useTranslations } from "next-intl"

export default function NursePatientsPage() {
  const t = useTranslations('nurse')
  const { patients } = useWard()
  const activeWard = useShiftStore(s => s.activeWard)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="t-body text-foreground-lighter">{t('patients.subtitle', { ward: activeWard })}</p>
        <WardSwitcher />
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={Bed}
          title={t('patients.noPatients', { ward: activeWard })}
          description={t('patients.noPatientsDesc')}
          size="sm"
        />
      ) : (
        <div className="space-y-3">
          {patients.map(patient => (
            <Link key={patient.id} href={`/nurse/patients/${patient.id}`} className="block">
            <Card className="p-5 u-lift cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-success-bg border border-success/20 flex items-center justify-center flex-shrink-0">
                    <Bed className="h-6 w-6 text-success-strong" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{patient.name}</h3>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">{deriveUhid(patient.id)}</span>
                      <NeonBadge
                        variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'}
                      >
                        {patient.condition}
                      </NeonBadge>
                      {patient.news && (
                        <NeonBadge variant={news2Token(patient.news.band).variant}>NEWS {patient.news.score}</NeonBadge>
                      )}
                    </div>
                    <p className="text-sm text-foreground-lighter mt-0.5 flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5" /> {patient.bedNumber}
                    </p>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-4 gap-6 text-center">
                  {[
                    { label: 'HR',   value: `${patient.vitals.hr} bpm`, abnormal: patient.vitals.hr > 100 },
                    { label: 'BP',   value: patient.vitals.bp,           abnormal: false },
                    { label: 'SpO2', value: `${patient.vitals.spo2}%`,   abnormal: patient.vitals.spo2 < 95 },
                    { label: 'Temp', value: `${patient.vitals.temp}°F`,  abnormal: patient.vitals.temp > 100 },
                  ].map(({ label, value, abnormal }) => (
                    <div key={label}>
                      <p className="t-overline text-foreground-lighter">{label}</p>
                      <p className={`text-sm font-bold mt-0.5 tabular-nums ${abnormal ? 'text-danger' : 'text-foreground'}`}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-foreground-lighter">{t('patients.lastChecked')}</p>
                  <p className="text-sm font-bold text-foreground">{patient.lastChecked}</p>
                  {patient.aiAlert && (
                    <div className="flex items-center gap-1 mt-1 text-xs font-bold text-danger">
                      <AlertCircle className="h-3 w-3" /> {patient.aiAlert}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-foreground-placeholder ml-2 flex-shrink-0" />
              </div>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
