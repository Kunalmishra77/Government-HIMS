"use client"
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { cn } from '@/lib/utils'

const REPORTS = [
  { nameKey: 'hmis', frequency: 'Monthly', lastSubmitted: '2026-05-31', nextDue: '2026-06-30', status: 'due-soon' },
  { nameKey: 'ihip', frequency: 'Weekly', lastSubmitted: '2026-06-16', nextDue: '2026-06-23', status: 'due-today' },
  { nameKey: 'rch', frequency: 'Monthly', lastSubmitted: '2026-06-01', nextDue: '2026-07-01', status: 'submitted' },
  { nameKey: 'uwin', frequency: 'Weekly', lastSubmitted: '2026-06-17', nextDue: '2026-06-24', status: 'submitted' },
  { nameKey: 'nikshay', frequency: 'Monthly', lastSubmitted: '2026-06-01', nextDue: '2026-07-01', status: 'submitted' },
  { nameKey: 'pmjay', frequency: 'Monthly', lastSubmitted: '2026-06-01', nextDue: '2026-07-01', status: 'submitted' },
]

const STATUS_STYLES: Record<string, string> = {
  'due-today':  'bg-red-100 text-red-700',
  'due-soon':   'bg-amber-100 text-amber-700',
  'submitted':  'bg-green-100 text-green-700',
}

export default function CmoReportsPage() {
  const t = useTranslations('cmo')
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <CmoPageHeader title={t('reports.title')}
        actions={
          <button onClick={() => toast.success(t('reports.briefGenerated'))}
            className="text-[12px] font-semibold px-3 py-1.5 bg-secondary text-white rounded-lg hover:bg-secondary-light">
            {t('reports.generateBrief')}
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {REPORTS.map((r, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-50 last:border-0">
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-slate-900">{t(`reports.reportNames.${r.nameKey}`)}</p>
              <p className="text-[11px] text-slate-500">{t('reports.dueLast', { due: r.nextDue, last: r.lastSubmitted })}</p>
            </div>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', STATUS_STYLES[r.status])}>
              {r.status === 'due-today' ? t('reports.dueToday') : r.status === 'due-soon' ? t('reports.dueSoon') : t('reports.submitted')}
            </span>
            <div className="flex gap-2">
              <button onClick={() => toast.success(t('reports.draftOpened'))}
                className="text-[11px] font-medium px-2 py-1 border border-slate-300 rounded hover:bg-slate-50">
                {t('reports.viewDraft')}
              </button>
              {r.status !== 'submitted' && (
                <button onClick={() => toast.success(t('reports.signedSubmitted', { name: t(`reports.reportNames.${r.nameKey}`) }))}
                  className="text-[11px] font-semibold px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                  {t('reports.signSubmit')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-[13px] font-bold text-slate-900 mb-3">{t('reports.customReportBuilder')}</p>
        <div className="flex gap-3">
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
            <option>{t('reports.builderReports.opd')}</option><option>{t('reports.builderReports.ipd')}</option><option>{t('reports.builderReports.drug')}</option><option>{t('reports.builderReports.attendance')}</option>
          </select>
          <select className="border border-slate-200 rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
            <option>{t('reports.builderBlocks.all')}</option><option>{t('reports.builderBlocks.bhopalUrban')}</option><option>{t('reports.builderBlocks.berasia')}</option>
          </select>
          <button onClick={() => toast.success(t('reports.reportGenerating'))}
            className="text-[12px] font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
            {t('reports.generatePdf')}
          </button>
        </div>
      </div>
    </div>
  )
}
