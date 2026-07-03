"use client"
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const EQUIPMENT = [
  { name: 'Oxygen plant', facility: 'CH Kolar', status: 'Down', lastService: '2026-03-10', vendor: 'MedTech', amcExpiry: '2026-09-30', downtimeHrs: 18 },
  { name: 'ICU ventilator (3)', facility: 'Hamidia DH', status: 'Operational', lastService: '2026-05-20', vendor: 'Philips Health', amcExpiry: '2026-07-15', downtimeHrs: 0 },
  { name: 'X-ray machine', facility: 'CHC Berasia', status: 'Operational', lastService: '2026-04-01', vendor: 'Siemens', amcExpiry: '2026-08-31', downtimeHrs: 0 },
  { name: 'ECG machine', facility: 'PHC Phanda', status: 'Down', lastService: '2026-01-15', vendor: 'BPL Medical', amcExpiry: '2027-01-15', downtimeHrs: 72 },
  { name: 'Autoclave', facility: 'CHC Phanda', status: 'Operational', lastService: '2026-06-01', vendor: 'AMS Sterilizers', amcExpiry: '2026-12-31', downtimeHrs: 0 },
  { name: 'Dialysis machine', facility: 'Hamidia DH', status: 'Operational', lastService: '2026-05-01', vendor: 'Fresenius', amcExpiry: '2026-10-31', downtimeHrs: 0 },
  { name: 'Ultrasound', facility: 'CH Bairagarh', status: 'Operational', lastService: '2026-04-15', vendor: 'GE Healthcare', amcExpiry: '2026-07-01', downtimeHrs: 0 },
  { name: 'Pulse oximeters (20)', facility: 'Multiple PHCs', status: 'Operational', lastService: '2025-12-01', vendor: 'Nellcor', amcExpiry: '2025-12-01', downtimeHrs: 0 },
]

export default function CmoEquipmentPage() {
  const t = useTranslations('cmo')
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('equipment.title')} />
      <div className="grid grid-cols-4 gap-3">
        <MetricTile label={t('equipment.totalEquipment')} value="247" />
        <MetricTile label={t('equipment.operational')} value="231 (93%)" variant="success" />
        <MetricTile label={t('equipment.down')} value="16" variant="critical" />
        <MetricTile label={t('equipment.amcExpiring')} value="12" variant="warning" />
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-[12px]">
          <thead><tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
            <th className="px-4 py-2.5 text-left font-medium">{t('equipment.colEquipment')}</th>
            <th className="px-3 py-2.5 text-left font-medium">{t('equipment.colFacility')}</th>
            <th className="px-3 py-2.5 text-center font-medium">{t('equipment.colStatus')}</th>
            <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">{t('equipment.colVendor')}</th>
            <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">{t('equipment.colExpiry')}</th>
            <th className="px-3 py-2.5 text-right font-medium hidden md:table-cell">{t('equipment.colDowntime')}</th>
            <th className="px-3 py-2.5"></th>
          </tr></thead>
          <tbody>
            {EQUIPMENT.map((eq, i) => {
              const amcSoon = new Date(eq.amcExpiry) < new Date(Date.now() + 30 * 24 * 3600000)
              return (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{eq.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{eq.facility}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      eq.status === 'Down' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700')}>
                      {eq.status === 'Down' ? t('equipment.statusDown') : t('equipment.statusOperational')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 hidden lg:table-cell">{eq.vendor}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell">
                    <span className={cn(amcSoon ? 'text-red-600 font-semibold' : 'text-slate-600')}>{eq.amcExpiry}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right hidden md:table-cell">
                    <span className={eq.downtimeHrs > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>{eq.downtimeHrs || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => toast.success(t('equipment.escalationRaised', { name: eq.name }))}
                      className="text-[10px] font-semibold px-2 py-1 border border-slate-300 rounded hover:bg-slate-50">
                      {t('equipment.escalate')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
