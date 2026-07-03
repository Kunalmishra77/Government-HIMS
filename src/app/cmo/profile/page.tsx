"use client"
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useCmoSessionStore } from '@/store/useCmoSessionStore'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { HindiText } from '@/components/shared/HindiText'

export default function CmoProfilePage() {
  const t = useTranslations('cmo')
  const session = useCmoSessionStore(s => s.session)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <CmoPageHeader title={t('profile.title')} />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center text-white text-[22px] font-bold flex-shrink-0">
            {session?.avatarInitials ?? 'RS'}
          </div>
          <div>
            <p className="text-[18px] font-bold text-slate-900">{session?.name ?? 'Dr. Rajesh Sharma'}</p>
            <HindiText className="text-[13px] text-slate-500 block">{session?.nameHindi ?? 'डॉ. राजेश शर्मा'}</HindiText>
            <p className="text-[12px] text-slate-500 mt-0.5">{t('profile.designationDistrict', { designation: session?.designation ?? 'CMHO', district: session?.district ?? 'Bhopal' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[12px]">
          {[
            [t('profile.hprId'), 'HPR-MP-2023-00142'],
            [t('profile.joined'), session?.joinedDate ? new Date(session.joinedDate).toLocaleDateString('en-IN') : '15 Jan 2023'],
            [t('profile.district'), `${session?.district ?? 'Bhopal'} (${session?.districtHindi ?? 'भोपाल'})`],
            [t('profile.facilities'), t('profile.facilitiesValue', { count: session?.facilitiesCount ?? 142 })],
            [t('profile.population'), t('profile.populationValue', { lakhs: session?.populationLakhs ?? 38.4 })],
            [t('profile.contact'), '+91 98765 43210'],
            [t('profile.email'), 'rajesh.sharma@mp.gov.in'],
            [t('profile.permissionScope'), session?.permissionScope ?? 'District'],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-slate-500">{k}</p>
              <p className="font-semibold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-[13px] font-bold text-slate-900 mb-3">{t('profile.delegation')}</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] text-slate-700">{t('profile.currentDeputy')}<span className="font-semibold">Dr. Anita Sharma (Addl. CMO)</span></p>
            <p className="text-[11px] text-slate-500 mt-0.5">{t('profile.deputyActive')}</p>
          </div>
          <button onClick={() => toast.success(t('profile.deputyUpdated'))}
            className="text-[11px] font-semibold px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
            {t('profile.changeDeputy')}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-[13px] font-bold text-slate-900 mb-3">{t('profile.activitySummary')}</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[[t('profile.loginsThisMonth'), '23'], [t('profile.decisionsTaken'), '87'], [t('profile.avgResponseTime'), '1.4h']].map(([l, v]) => (
            <div key={l}>
              <p className="text-[22px] font-semibold text-accent">{v}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
