"use client"
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useCmoBedsStore } from '@/store/useCmoBedsStore'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile }    from '@/components/shared/MetricTile'
import { DrillCard }     from '@/components/shared/DrillCard'
import { Bot, RefreshCw, X } from 'lucide-react'
import type { WardType, Bed } from '@/types/cmo'
import { cn } from '@/lib/utils'
const WARD_TYPES: WardType[] = ['General', 'ICU', 'NICU', 'Ventilator', 'Isolation', 'Pediatric', 'Maternity']

function pct(used: number, total: number) { return total === 0 ? 0 : Math.round((used / total) * 100) }

function CellColor(used: number, total: number): { bg: string; text: string; ring?: string } {
  if (total === 0) return { bg: 'bg-slate-100', text: 'text-slate-400' }
  const p = pct(used, total)
  if (p >= 95) return { bg: 'bg-red-600', text: 'text-white', ring: 'ring-2 ring-red-300' }
  if (p >= 85) return { bg: 'bg-red-100', text: 'text-red-800' }
  if (p >= 70) return { bg: 'bg-amber-100', text: 'text-amber-800' }
  return { bg: 'bg-emerald-50', text: 'text-emerald-800' }
}

const BED_STATUS_STYLES: Record<Bed['status'], { bg: string }> = {
  free:             { bg: 'bg-emerald-400' },
  occupied:         { bg: 'bg-red-400' },
  cleaning:         { bg: 'bg-amber-300' },
  reserved:         { bg: 'bg-surface-sunken' },
  'out-of-service': { bg: 'bg-slate-300' },
}

export default function CmoBedsPage() {
  const t = useTranslations('cmo')
  const { bedNetwork, loaded, fetchBedNetwork, reserveBed, tick } = useCmoBedsStore()

  const [drillFacId, setDrillFacId]     = useState<string | null>(null)
  const [drillWard, setDrillWard]       = useState<WardType | null>(null)
  const [selectedBed, setSelectedBed]   = useState<Bed | null>(null)
  const [reservePatient, setReservePatient] = useState('')
  const [showAiDrill, setShowAiDrill]   = useState(false)
  const [aiDismissed, setAiDismissed]   = useState(false)

  useEffect(() => { if (!loaded) fetchBedNetwork() }, [loaded, fetchBedNetwork])

  const drillFac      = bedNetwork?.perFacility.find(f => f.facilityId === drillFacId)
  const drillWardData = drillFac && drillWard ? drillFac.wards[drillWard] : null

  const hamICU = bedNetwork?.perFacility.find(f => f.facilityId === 'fac_dh_hamidia')?.wards.ICU
  const showAiBanner = !aiDismissed && bedNetwork?.aiSuggestion && hamICU && pct(hamICU.used, hamICU.total) >= 90

  return (
    <div className="max-w-5xl mx-auto space-y-5 cmo-fade-up">
      <CmoPageHeader
        title={t('beds.title')}
        titleHindi={t('beds.titleHindi')}
        subtitle={t('beds.subtitle')}
        actions={
          <button onClick={() => fetchBedNetwork()}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-[rgba(238,107,38,0.18)] hover:text-[var(--color-accent)] hover:bg-[var(--color-primary-soft)] transition-all">
            <RefreshCw size={12} /> {t('common.refresh')}
          </button>
        }
      />

      {/* Summary strip */}
      {bedNetwork && (
        <div className="grid grid-cols-5 gap-3">
          <MetricTile label={t('beds.totalBeds')}  value={bedNetwork.totalBeds.toLocaleString('en-IN')} />
          <MetricTile label={t('beds.occupied')}    value={`${bedNetwork.occupied.toLocaleString('en-IN')} (${pct(bedNetwork.occupied, bedNetwork.totalBeds)}%)`}
            variant={pct(bedNetwork.occupied, bedNetwork.totalBeds) > 85 ? 'warning' : 'default'} />
          <MetricTile label={t('beds.icu')}         value={`${bedNetwork.byType.ICU.used}/${bedNetwork.byType.ICU.total}`}
            variant={pct(bedNetwork.byType.ICU.used, bedNetwork.byType.ICU.total) >= 90 ? 'critical' : 'default'} />
          <MetricTile label={t('beds.ventilators')} value={`${bedNetwork.byType.Ventilator.used}/${bedNetwork.byType.Ventilator.total}`} />
          <MetricTile label={t('beds.isolation')}   value={`${bedNetwork.byType.Isolation.used}/${bedNetwork.byType.Isolation.total}`} />
        </div>
      )}

      {/* AI banner */}
      {showAiBanner && bedNetwork?.aiSuggestion && (
        <div
          className="relative flex items-start gap-4 px-5 py-4 rounded-2xl border"
          style={{ background: 'linear-gradient(135deg,var(--color-primary-soft),#F6F9FC)', borderColor: 'rgba(238,107,38,0.18)' }}
        >
          <div className="h-9 w-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-bold text-[var(--color-foreground)]"
               style={{ fontFamily: 'var(--font-heading)' }}>
              {t('beds.aiSuggestionTitle', { facility: bedNetwork.aiSuggestion.from })}
            </p>
            <p className="text-[12px] text-[var(--color-foreground-muted)] mt-0.5">{bedNetwork.aiSuggestion.reason}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setShowAiDrill(true)}
              className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity">
              {t('beds.reviewSuggestion')}
            </button>
            <button onClick={() => setAiDismissed(true)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-[rgba(238,107,38,0.18)] text-[var(--color-accent)] hover:bg-[var(--color-primary-soft)]">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Matrix */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden"
           style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-[var(--color-foreground)]"
               style={{ fontFamily: 'var(--font-heading)' }}>{t('beds.matrixTitle')}</p>
            <p className="text-[11px] text-[var(--color-foreground-lighter)] mt-0.5">{t('beds.matrixSubtitle')}</p>
          </div>
          <div className="flex gap-3 text-[10px] font-medium text-[var(--color-foreground-lighter)]">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-50 border border-emerald-200" />&lt;70%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" />70–84%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100 border border-red-200" />85–94%</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-600" />≥95%</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
                <th className="px-4 py-2.5 text-left font-semibold text-[var(--color-foreground-lighter)] min-w-[160px]">{t('beds.colFacility')}</th>
                {WARD_TYPES.map(w => (
                  <th key={w} className="px-2 py-2.5 text-center font-semibold text-[var(--color-foreground-lighter)] min-w-[80px]">{t(`beds.wards.${w}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bedNetwork?.perFacility.map((fac, fi) => (
                <tr key={fac.facilityId}
                    className={cn('border-b border-[var(--color-border)] last:border-0 transition-colors', fi % 2 === 1 ? 'bg-[var(--color-surface-raised)]' : 'bg-[var(--color-surface)]')}>
                  <td className="px-4 py-2.5 font-semibold text-[var(--color-foreground)] text-[12px]">{fac.facilityName}</td>
                  {WARD_TYPES.map(w => {
                    const ward = fac.wards[w]
                    const colors = CellColor(ward.used, ward.total)
                    return (
                      <td key={w} className="px-1.5 py-2">
                        <button
                          onClick={() => { setDrillFacId(fac.facilityId); setDrillWard(w); setSelectedBed(null) }}
                          className={cn(
                            'w-full rounded-lg px-2 py-1.5 font-bold transition-all hover:scale-105 hover:shadow-sm',
                            colors.bg, colors.text, colors.ring,
                          )}
                        >
                          {ward.used}/{ward.total}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent transfers */}
      {bedNetwork?.recentTransfers && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden"
             style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <p className="text-[13px] font-bold text-[var(--color-foreground)]"
               style={{ fontFamily: 'var(--font-heading)' }}>{t('beds.recentTransfers')}</p>
          </div>
          {bedNetwork.recentTransfers.map((t, i) => (
            <div key={t.id} className={cn('flex items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] last:border-0 text-[12px]',
              i % 2 === 1 ? 'bg-[var(--color-surface-raised)]' : '')}>
              <span className="font-semibold text-[var(--color-foreground)] min-w-[100px]">{t.patientName}</span>
              <span className="text-[var(--color-foreground-lighter)] flex-1">{t.from} → {t.to}</span>
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                t.status === 'completed' ? 'bg-[var(--color-success-bg)] text-[#065F46] border border-[border-green-200]'
                                         : 'bg-[var(--color-warning-bg)] text-[#92400E] border border-[border-amber-200]')}>
                {t.status}
              </span>
              <span className="text-[var(--color-foreground-lighter)] tabular-nums">
                {new Date(t.transferredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bed drill card */}
      <DrillCard
        open={!!(drillFacId && drillWard)} onClose={() => { setDrillFacId(null); setDrillWard(null); setSelectedBed(null) }}
        title={`${drillFac?.facilityName ?? ''} — ${drillWard ? t(`beds.wards.${drillWard}`) : ''}`}
        subtitle={drillWardData ? t('beds.occupiedPct', { used: drillWardData.used, total: drillWardData.total, pct: pct(drillWardData.used, drillWardData.total) }) : ''}
        width="wide"
      >
        {drillWardData && (
          <div className="space-y-4">
            {/* Bed grid */}
            <div className="flex flex-wrap gap-2">
              {drillWardData.beds.map(bed => {
                const s = BED_STATUS_STYLES[bed.status]
                const isSelected = selectedBed?.id === bed.id
                return (
                  <button key={bed.id} onClick={() => setSelectedBed(bed)}
                    className={cn(
                      'h-11 w-14 rounded-xl text-white text-[10px] font-bold border-2 transition-all hover:scale-105',
                      s.bg,
                      isSelected ? 'border-[var(--color-foreground)] ring-2 ring-[var(--color-foreground)]/20 scale-105' : 'border-transparent',
                    )}>
                    {bed.number}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-3 flex-wrap text-[10.5px] font-medium">
              {Object.entries(BED_STATUS_STYLES).map(([status, s]) => (
                <span key={status} className="flex items-center gap-1.5 text-[var(--color-foreground-muted)]">
                  <span className={cn('h-3 w-3 rounded-md', s.bg)} />
                  {t(`beds.bedStatus.${status}`)}
                </span>
              ))}
            </div>

            {/* Selected bed detail */}
            {selectedBed && (
              <div className="bg-[var(--color-surface-raised)] rounded-xl border border-[var(--color-border)] p-4 space-y-2 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[var(--color-foreground)]" style={{ fontFamily: 'var(--font-heading)' }}>
                    {t('beds.bed', { number: selectedBed.number })}
                  </p>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', BED_STATUS_STYLES[selectedBed.status].bg, 'text-white')}>
                    {t(`beds.bedStatus.${selectedBed.status}`)}
                  </span>
                </div>
                {selectedBed.patientName && (
                  <p className="text-[var(--color-foreground-muted)]">{t('beds.patient')} <strong>{selectedBed.patientName}</strong></p>
                )}
                {selectedBed.admittedAt && (
                  <p className="text-[var(--color-foreground-lighter)]">{t('beds.admitted')} {new Date(selectedBed.admittedAt).toLocaleString('en-IN')}</p>
                )}
                {selectedBed.status === 'free' && (
                  <div className="flex gap-2 pt-2">
                    <input value={reservePatient} onChange={e => setReservePatient(e.target.value)}
                      placeholder={t('beds.reservePlaceholder')}
                      className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-foreground-lighter)]" />
                    <button
                      disabled={!reservePatient.trim()}
                      onClick={async () => {
                        if (drillFacId && drillWard) {
                          await reserveBed(drillFacId, drillWard, selectedBed.id, reservePatient)
                          setReservePatient(''); setSelectedBed(null)
                          toast.success(t('beds.bedReservedAudit'))
                        }
                      }}
                      className="text-[11.5px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white disabled:opacity-40 hover:opacity-90 whitespace-nowrap">
                      {t('beds.reserve')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DrillCard>

      {/* AI Suggestion DrillCard */}
      <DrillCard open={showAiDrill} onClose={() => setShowAiDrill(false)}
        title={t('beds.aiTransferTitle')} subtitle={t('beds.aiTransferSubtitle')}
        footer={
          <>
            <button onClick={() => { setShowAiDrill(false); toast.success(t('beds.transferApprovedAudit')) }}
              className="flex-1 text-[12.5px] font-semibold py-2.5 rounded-xl bg-[var(--color-primary)] text-white hover:opacity-90">
              {t('beds.approveTransfers')}
            </button>
            <button onClick={() => { setShowAiDrill(false); setAiDismissed(true) }}
              className="text-[12.5px] font-semibold px-4 py-2.5 rounded-xl border border-[var(--color-border)] hover:bg-slate-50">
              {t('common.dismiss')}
            </button>
          </>
        }
      >
        {bedNetwork?.aiSuggestion && (
          <div className="space-y-4 text-[12.5px]">
            <div className="bg-[var(--color-primary-soft)] border border-[rgba(238,107,38,0.18)] rounded-xl p-4">
              <p className="font-bold text-[var(--color-foreground)]"
                 style={{ fontFamily: 'var(--font-heading)' }}>
                {bedNetwork.aiSuggestion.from} → {bedNetwork.aiSuggestion.to}
              </p>
              <p className="text-[var(--color-foreground-muted)] mt-1 leading-relaxed">{bedNetwork.aiSuggestion.reason}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold text-[var(--color-foreground-lighter)] uppercase tracking-wide mb-2">
                {t('beds.proposedPatients', { count: bedNetwork.aiSuggestion.patients })}
              </p>
              <div className="space-y-2">
                {[t('beds.proposedPatient1'), t('beds.proposedPatient2'), t('beds.proposedPatient3')].map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[var(--color-foreground-muted)] bg-[var(--color-surface-raised)] rounded-lg px-3 py-2.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />{p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DrillCard>
    </div>
  )
}
