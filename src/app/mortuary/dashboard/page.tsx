"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useMortuaryStore } from "@/store/useMortuaryStore"
import { AlertTriangle, CheckCircle2, Clock, LayoutGrid, FileText } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/PageHeader"

const CLEARANCE_BADGE: Record<string, { variant: "success" | "warning" | "danger" | "muted" }> = {
  cleared: { variant: "success" },
  pending: { variant: "warning" },
  mlc:     { variant: "danger" },
}

export default function MortuaryDashboard() {
  const t = useTranslations('mortuary')
  const { records, totalSlots, availableSlots } = useMortuaryStore()
  const occupied         = records.filter((r) => r.legalClearance !== 'released').length
  const pendingClearance = records.filter((r) => r.legalClearance === 'pending').length
  const mlcCases         = records.filter((r) => r.isMLC).length

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.occupiedOf', { total: totalSlots })} value={`${occupied}/${totalSlots}`} icon={LayoutGrid}    color="slate"  delay={0} />
        <StatCard label={t('dashboard.availableSlots')}                     value={availableSlots()}             icon={CheckCircle2}  color="green"  delay={0.05} />
        <StatCard label={t('dashboard.pendingClearance')}                   value={pendingClearance}             icon={Clock}         color="amber"  delay={0.1} />
        <StatCard label={t('dashboard.mlcCases')}                           value={mlcCases}                    icon={AlertTriangle} color="red"    delay={0.15} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500" /> {t('dashboard.currentRecords')}
        </h3>
        <div className="space-y-3">
          {records.filter((r) => r.legalClearance !== 'released').map((rec, i) => {
            const cb = CLEARANCE_BADGE[rec.legalClearance] ?? { variant: "muted" as const }
            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`p-4 rounded-xl border transition-colors ${rec.isMLC ? 'border-red-200 bg-red-50/50 hover:bg-red-50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-slate-900">{rec.patientName}</p>
                      {rec.isMLC && (
                        <Badge variant="danger" size="sm">{t('dashboard.mlcTag', { number: rec.mlcNumber ?? '' })}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{t('dashboard.ageGenderWardSlot', { age: rec.age, gender: rec.gender, ward: rec.ward, slot: rec.bodySlot })}</p>
                    <p className="text-xs text-slate-500">{t('dashboard.timeOfDeath', { time: new Date(rec.timeOfDeath).toLocaleString() })}</p>
                    <p className="text-xs text-slate-600 mt-1">{t('dashboard.causeCertifiedBy', { cause: rec.causeOfDeath, certifier: rec.certifiedBy })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {rec.legalClearance === 'cleared'
                      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                      : <Clock className="h-4 w-4 text-amber-500" />
                    }
                    <Badge variant={cb.variant}>{t.has(`clearance.${rec.legalClearance}`) ? t(`clearance.${rec.legalClearance}`) : rec.legalClearance.toUpperCase()}</Badge>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
