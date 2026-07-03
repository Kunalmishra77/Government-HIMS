"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Workflow, Briefcase, ArrowRight } from "lucide-react"
import { useHrmsStore, APPLICANT_STAGES, type ApplicantStage } from "@/store/useHrmsStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STAGE_STYLE: Record<ApplicantStage, string> = {
  Applied: 'border-slate-200 bg-slate-50',
  Screening: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/60',
  Interview: 'border-primary/20 bg-[rgba(238,107,38,0.07)]/60',
  Offer: 'border-amber-200 bg-amber-50/60',
  Hired: 'border-emerald-200 bg-emerald-50/60',
  Rejected: 'border-red-200 bg-red-50/60',
}

export default function HrRecruitment() {
  const t = useTranslations('hr')
  const { openings, applicants, moveApplicant, startOnboarding } = useHrmsStore()

  const move = (id: string, stage: ApplicantStage) => {
    const a = applicants.find(x => x.id === id)
    moveApplicant(id, stage)
    if (stage === 'Hired' && a) {
      const opening = openings.find(o => o.id === a.openingId)
      startOnboarding({ staffId: `NEW-${a.id}`, name: a.name, role: opening?.title ?? 'New hire' })
      toast.success(t('recruitment.hiredToast', { name: a.name }))
    } else {
      toast(t('recruitment.movedToast', { stage: t(`stage.${stage}`) }))
    }
  }

  const openPositions = openings.filter(o => o.status === 'Open').reduce((n, o) => n + o.openings, 0)
  const inPipeline = applicants.filter(a => a.stage !== 'Hired' && a.stage !== 'Rejected').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Workflow className="h-6 w-6 text-[var(--color-accent)]" /> {t('recruitment.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('recruitment.subtitle', { open: openPositions, pipeline: inPipeline })}</p>
        </div>
        <Link href="/hr/onboarding" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)]">{t('recruitment.onboarding')} <ArrowRight className="h-4 w-4" /></Link>
      </div>

      {/* Openings */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100"><h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Briefcase className="h-4 w-4 text-slate-500" /> {t('recruitment.jobOpenings')}</h2></div>
        <div className="divide-y divide-slate-50">
          {openings.map(o => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{o.title}</p>
                <p className="text-[11px] text-slate-500">{t('recruitment.openingsCount', { department: o.department, type: o.type, count: o.openings })}</p>
              </div>
              <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                o.status === 'Open' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : o.status === 'On hold' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>{t(`openingStatus.${o.status}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {APPLICANT_STAGES.map(stage => {
          const items = applicants.filter(a => a.stage === stage)
          return (
            <div key={stage} className={cn("rounded-2xl border p-3 min-h-[120px]", STAGE_STYLE[stage])}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{t(`stage.${stage}`)}</p>
                <span className="text-[11px] font-bold text-slate-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(a => {
                  const idx = APPLICANT_STAGES.indexOf(a.stage)
                  const next = idx >= 0 && idx < 4 ? APPLICANT_STAGES[idx + 1] : null
                  return (
                    <div key={a.id} className="rounded-xl bg-white border border-slate-200 p-2.5 shadow-sm">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{a.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{openings.find(o => o.id === a.openingId)?.title ?? '—'}</p>
                      {a.rating ? <p className="text-[10px] text-amber-600 mt-0.5">{'★'.repeat(a.rating)}</p> : null}
                      {stage !== 'Hired' && stage !== 'Rejected' && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {next && <button onClick={() => move(a.id, next)} className="flex-1 text-[10px] font-bold px-1.5 py-1 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">{t('recruitment.moveNext', { stage: t(`stage.${next}`) })}</button>}
                          <button onClick={() => move(a.id, 'Rejected')} className="text-[10px] font-semibold px-1.5 py-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer">{t('common.reject')}</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {items.length === 0 && <p className="text-[10.5px] text-slate-400 italic">—</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
