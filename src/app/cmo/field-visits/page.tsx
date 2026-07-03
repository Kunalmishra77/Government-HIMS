"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { cn } from '@/lib/utils'

const VISITS = [
  { id: 'v1', facility: 'CHC Berasia', date: '2026-06-01', type: 'surprise', findings: '3 staff absent, drug store disorganised, maternity ward clean', followUp: ['Issue show cause to absent staff', 'Drug store audit scheduled'] },
  { id: 'v2', facility: 'PHC Phanda', date: '2026-05-18', type: 'scheduled', findings: 'ASHA workers absent, RDT kits expired', followUp: ['ASHA coordinator meeting', 'Replace RDT kits'] },
  { id: 'v3', facility: 'Hamidia DH', date: '2026-05-14', type: 'scheduled', findings: 'ICU at 94% capacity, O₂ monitoring inadequate, excellent nursing', followUp: ['O₂ monitoring SOP issued'] },
]

export default function CmoFieldVisitsPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState('my')
  const [showInspForm, setShowInspForm] = useState(false)
  const [formFacility, setFormFacility] = useState('')
  const [formFindings, setFormFindings] = useState('')

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <CmoPageHeader title={t('fieldVisits.title')}
        actions={
          <button onClick={() => setShowInspForm(s => !s)}
            className="text-[12px] font-semibold px-3 py-1.5 bg-secondary text-white rounded-lg hover:bg-secondary-light">
            {t('fieldVisits.startInspection')}
          </button>
        }
      />

      {showInspForm && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
          <p className="text-[13px] font-bold text-amber-900">{t('fieldVisits.surpriseInspection')}</p>
          <input value={formFacility} onChange={e => setFormFacility(e.target.value)} placeholder={t('fieldVisits.facilityNamePlaceholder')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25" />
          <textarea value={formFindings} onChange={e => setFormFindings(e.target.value)} placeholder={t('fieldVisits.findingsPlaceholder')}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25 h-20" />
          <div className="flex gap-2">
            <button onClick={() => { console.info('[CMO Demo] Capture photo'); toast.success(t('fieldVisits.photoCaptured')) }}
              className="text-[11px] font-semibold px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
              {t('fieldVisits.capturePhoto')}
            </button>
            <button
              disabled={!formFacility || !formFindings}
              onClick={() => { setShowInspForm(false); setFormFacility(''); setFormFindings(''); toast.success(t('fieldVisits.inspectionSubmitted')) }}
              className="text-[11px] font-semibold px-3 py-1.5 bg-green-600 text-white rounded-lg disabled:opacity-40">
              {t('fieldVisits.submitInspection')}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {['my', 'scheduled', 'surprise'].map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors',
              tab === tb ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {tb === 'my' ? t('fieldVisits.myVisits') : tb === 'scheduled' ? t('fieldVisits.scheduled') : t('fieldVisits.surprise')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {VISITS.filter(v => tab === 'my' || v.type === tab).map(v => (
          <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-slate-900">{v.facility}</p>
                <p className="text-[11px] text-slate-500">{v.date} · {t('fieldVisits.inspectionSuffix', { type: v.type })}</p>
                <p className="text-[12px] text-slate-700 mt-2">{v.findings}</p>
                <div className="mt-2 space-y-1">
                  {v.followUp.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="text-amber-500">→</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
