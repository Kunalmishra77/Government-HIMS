"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { MetricTile } from '@/components/shared/MetricTile'
import { cn } from '@/lib/utils'

const STAFF = [
  { name: 'Dr. Priya Mishra', role: 'MO', facility: 'PHC Phanda', block: 'Phanda', attendance: 'present', opd: 847, complaints: 0 },
  { name: 'Dr. Amit Verma', role: 'MO', facility: 'PHC Kolar', block: 'Kolar', attendance: 'awol', opd: 320, complaints: 1 },
  { name: 'Dr. Sunita Rao', role: 'MO', facility: 'CHC Berasia', block: 'Berasia', attendance: 'awol', opd: 1240, complaints: 0 },
  { name: 'Nurse Kavita', role: 'Staff Nurse', facility: 'Hamidia DH', block: 'Bhopal Urban', attendance: 'present', opd: 0, complaints: 0 },
  { name: 'Dr. Ravi Kumar', role: 'MO', facility: 'PHC Bairagarh', block: 'Bairagarh', attendance: 'leave', opd: 0, complaints: 0 },
  { name: 'Dr. Alka Jain', role: 'MO', facility: 'CHC Phanda', block: 'Phanda', attendance: 'awol', opd: 654, complaints: 0 },
  { name: 'Nurse Geeta', role: 'ANM', facility: 'PHC Lalghati', block: 'Bhopal Urban', attendance: 'present', opd: 0, complaints: 1 },
  { name: 'Dr. Mahesh Singh', role: 'Specialist', facility: 'CH Kolar', block: 'Kolar', attendance: 'present', opd: 412, complaints: 0 },
  { name: 'Dr. Seema Tiwari', role: 'MO', facility: 'PHC Karond', block: 'Bhopal Urban', attendance: 'absent', opd: 0, complaints: 0 },
  { name: 'Nurse Rekha', role: 'Staff Nurse', facility: 'CHC Berasia', block: 'Berasia', attendance: 'present', opd: 0, complaints: 0 },
]

const ATT_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent:  'bg-red-100 text-red-700',
  awol:    'bg-red-600 text-white',
  leave:   'bg-surface-sunken text-accent',
}

const AWOL = STAFF.filter(s => s.attendance === 'awol')

export default function CmoStaffPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState('all')
  const tabs = ['all', 'doctors', 'nurses', 'paramedics', 'admin', 'asha']

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('staff.title')} subtitle={t('staff.subtitle')} />

      <div className="grid grid-cols-5 gap-3">
        <MetricTile label={t('staff.totalStaff')} value="2,847" />
        <MetricTile label={t('staff.presentToday')} value="2,431" hint="85.4%" variant="success" />
        <MetricTile label={t('staff.awol')} value={AWOL.length} variant="critical" />
        <MetricTile label={t('staff.onLeave')} value="197" />
        <MetricTile label={t('staff.vacancies')} value="207" hint={t('staff.vacanciesHint')} variant="warning" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors',
              tab === tb ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t(`staff.tabs.${tb}`)}
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th className="px-4 py-2.5 text-left font-medium">{t('staff.colName')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('staff.colRole')}</th>
              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">{t('staff.colFacility')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('staff.colAttendance')}</th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">{t('staff.colOpd')}</th>
            </tr></thead>
            <tbody>
              {STAFF.map((s, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{s.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{s.role}</td>
                  <td className="px-3 py-2.5 text-slate-600 hidden md:table-cell">{s.facility}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', ATT_COLORS[s.attendance])}>
                      {s.attendance.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 hidden lg:table-cell">{s.opd || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AWOL sidebar */}
        <div className="w-56 flex-shrink-0 hidden lg:block">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-[12px] font-bold text-red-900 mb-2">{t('staff.awolCount', { count: AWOL.length })}</p>
            {AWOL.map((s, i) => (
              <div key={i} className="flex items-center justify-between mb-2 pb-2 border-b border-red-100 last:border-0">
                <div>
                  <p className="text-[11px] font-semibold text-red-900">{s.name}</p>
                  <p className="text-[10px] text-red-700">{s.facility}</p>
                </div>
                <button onClick={() => toast.success(t('staff.explanationDemanded', { name: s.name }))}
                  className="text-[9px] font-semibold px-2 py-1 bg-red-600 text-white rounded">
                  {t('staff.demandExplanation')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
