"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { Bed, User, Clock, CheckCircle2, Wrench } from "lucide-react"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useHousekeepingStore } from "@/store/useHousekeepingStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Bed as BedType } from "@/store/useAdmissionStore"
import { BedHoverCard } from "@/components/admission/BedHoverCard"
import { BedFreeingForecast } from "@/components/admission/BedFreeingForecast"

const WARD_ORDER = ['ICU', 'General Ward', 'Semi-Private', 'Private Room', 'Day Care']

const BED_STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Available: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', dot: 'bg-green-500' },
  Occupied: { bg: 'bg-[rgba(238,107,38,0.07)]', border: 'border-[rgba(238,107,38,0.20)]', text: 'text-[var(--color-primary-dark)]', dot: 'bg-[rgba(238,107,38,0.07)]0' },
  Cleaning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  Reserved: { bg: 'bg-[rgba(238,107,38,0.07)]', border: 'border-[rgba(238,107,38,0.20)]', text: 'text-[var(--color-primary-dark)]', dot: 'bg-[rgba(238,107,38,0.07)]0' },
  Maintenance: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', dot: 'bg-red-500' },
}

function BedCard({ bed, side = 'right' }: { bed: BedType; side?: 'left' | 'right' }) {
  const t = useTranslations('admission')
  const { markBedForCleaning, confirmBedReady } = useAdmissionStore()
  const { addTask } = useHousekeepingStore()
  const style = BED_STATUS_STYLE[bed.status]

  const handleMarkCleaning = () => {
    markBedForCleaning(bed.id)
    addTask({
      bedId: bed.id,
      bedNumber: bed.bedNumber,
      ward: bed.ward,
      priority: 'High',
      reason: 'Discharge',
      status: 'Pending',
    })
    notifyAndAudit({
      to: 'housekeeping', type: 'system', priority: 'high',
      title: t('beds.cleaningRequiredTitle', { bedNumber: bed.bedNumber }),
      body: t('beds.cleaningRequiredBody', { bedNumber: bed.bedNumber, ward: bed.ward }),
      audit: { action: 'housekeeping_bed_turned', resource: 'bed', resourceId: bed.id, detail: `Bed ${bed.bedNumber} → cleaning`, userName: t('beds.auditDeskUser') },
    })
    toast.success(t('beds.queuedForCleaning', { bedNumber: bed.bedNumber }))
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className={cn("group relative rounded-xl border p-3.5 flex flex-col gap-2", style.bg, style.border)}
    >
      <BedHoverCard bed={bed} side={side} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">{bed.bedNumber}</span>
          <span className={cn("h-2 w-2 rounded-full", style.dot)} />
        </div>
        <NeonBadge
          variant={
            bed.status === 'Available' ? 'success' :
            bed.status === 'Occupied' ? 'blue' :
            bed.status === 'Cleaning' ? 'warning' :
            bed.status === 'Maintenance' ? 'danger' : 'muted'
          }
          className="text-[10px] px-1.5"
        >
          {t.has(`bedStatus.${bed.status}`) ? t(`bedStatus.${bed.status}`) : bed.status}
        </NeonBadge>
      </div>

      <p className="text-xs text-slate-500 font-medium">{t('beds.floor', { floor: bed.floor })}</p>

      {bed.status === 'Occupied' && bed.occupantName && (
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span className="text-xs font-semibold text-[var(--color-primary-dark)] truncate">{bed.occupantName}</span>
        </div>
      )}

      {bed.status === 'Cleaning' && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-yellow-600" />
          <span className="text-xs text-yellow-800">{t('beds.beingCleaned')}</span>
        </div>
      )}

      {bed.lastCleaned && bed.status === 'Available' && (
        <p className="text-[10px] text-slate-400">{t('beds.cleaned', { time: new Date(bed.lastCleaned).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })}</p>
      )}

      <div className="flex gap-1.5 mt-1">
        {bed.status === 'Occupied' && (
          <button
            onClick={handleMarkCleaning}
            className="text-[10px] font-semibold px-2 py-1 rounded bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-200 transition-colors cursor-pointer"
          >
            {t('beds.markForCleaning')}
          </button>
        )}
        {bed.status === 'Cleaning' && (
          <button
            onClick={() => {
              confirmBedReady(bed.id)
              notifyAndAudit({
                to: 'bed_manager', type: 'system', priority: 'medium',
                title: t('beds.bedReadyTitle', { bedNumber: bed.bedNumber }),
                body: t('beds.bedReadyBody', { bedNumber: bed.bedNumber, ward: bed.ward }),
                audit: { action: 'housekeeping_bed_turned', resource: 'bed', resourceId: bed.id, detail: `Bed ready ${bed.bedNumber}`, userName: t('beds.auditHousekeepingUser') },
              })
              toast.success(t('beds.markedReady', { bedNumber: bed.bedNumber }))
            }}
            className="text-[10px] font-semibold px-2 py-1 rounded bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors cursor-pointer"
          >
            {t('beds.markReady')}
          </button>
        )}
      </div>
    </motion.div>
  )
}

export default function BedBoardPage() {
  const t = useTranslations('admission')
  const { beds } = useAdmissionStore()
  const [filterWard, setFilterWard] = useState<string>('All')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const wardLabel = (w: string) => w === 'All' ? t('filters.all') : (t.has(`wards.${w}`) ? t(`wards.${w}`) : w)
  const statusLabel = (s: string) => s === 'All' ? t('filters.all') : (t.has(`bedStatus.${s}`) ? t(`bedStatus.${s}`) : s)

  const filtered = beds.filter(b =>
    (filterWard === 'All' || b.ward === filterWard) &&
    (filterStatus === 'All' || b.status === filterStatus)
  )

  const stats = {
    total: beds.length,
    available: beds.filter(b => b.status === 'Available').length,
    occupied: beds.filter(b => b.status === 'Occupied').length,
    cleaning: beds.filter(b => b.status === 'Cleaning').length,
  }

  const grouped = WARD_ORDER.reduce((acc, ward) => {
    const wardBeds = filtered.filter(b => b.ward === ward)
    if (wardBeds.length > 0) acc[ward] = wardBeds
    return acc
  }, {} as Record<string, typeof beds>)

  return (
    <div className="space-y-6">
      {/* M13.5 — AI bed-freeing forecast at the top so the bed manager sees
          incoming capacity before drilling into the per-ward grid below. */}
      <BedFreeingForecast />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">{t('stats.totalBeds')}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{stats.available}</p>
          <p className="text-xs font-semibold text-green-600 mt-1">{t('stats.available')}</p>
        </div>
        <div className="bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[var(--color-accent)]">{stats.occupied}</p>
          <p className="text-xs font-semibold text-[var(--color-accent)] mt-1">{t('stats.occupied', { percent: Math.round(stats.occupied / stats.total * 100) })}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{stats.cleaning}</p>
          <p className="text-xs font-semibold text-yellow-600 mt-1">{t('stats.beingCleaned')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-2">
          {['All', ...WARD_ORDER].map(ward => (
            <button
              key={ward}
              onClick={() => setFilterWard(ward)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                filterWard === ward ? "bg-[var(--color-primary)] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {wardLabel(ward)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {['All', 'Available', 'Occupied', 'Cleaning'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                filterStatus === status ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Bed Grid by Ward */}
      {Object.entries(grouped).map(([ward, wardBeds]) => (
        <div key={ward} className="bg-white border shadow-sm rounded-xl">
          {/* No `overflow-hidden` on this card — it would clip the bed hover cards. */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bed className="h-5 w-5 text-slate-500" />
              <h3 className="font-bold text-slate-900">{wardLabel(ward)}</h3>
              <NeonBadge variant="muted" className="text-[10px]">{t('beds.bedsCount', { count: wardBeds.length })}</NeonBadge>
              <NeonBadge variant="success" className="text-[10px]">{t('beds.availableCount', { count: wardBeds.filter(b => b.status === 'Available').length })}</NeonBadge>
            </div>
            <span className="text-sm font-semibold text-slate-500">
              {t('beds.percentOccupied', { percent: Math.round(wardBeds.filter(b => b.status === 'Occupied').length / wardBeds.length * 100) })}
            </span>
          </div>
          <div className="p-4 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
            {/* Flip the wide hover panel to the left for right-most columns (lg:8-col,
                desktop-first) so it stays within the viewport. */}
            {wardBeds.map((bed, idx) => <BedCard key={bed.id} bed={bed} side={(idx % 8) >= 5 ? 'left' : 'right'} />)}
          </div>
        </div>
      ))}
    </div>
  )
}
