"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Award, Plus, Star, Check } from "lucide-react"
import { useHRStore } from "@/store/useHRStore"
import { useHrmsStore, type Review, type ReviewStatus } from "@/store/useHrmsStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_STYLE: Record<ReviewStatus, string> = {
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  acknowledged: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function HrAppraisals() {
  const t = useTranslations('hr')
  const staff = useHRStore(s => s.staff)
  const { cycles, reviews, upsertReview, setReviewStatus } = useHrmsStore()
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '')
  const [form, setForm] = useState<{ staffId: string; goals: string; strengths: string; rating: number } | null>(null)

  const cycleReviews = reviews.filter(r => r.cycleId === cycleId)
  const avg = cycleReviews.length ? (cycleReviews.reduce((n, r) => n + r.rating, 0) / cycleReviews.length).toFixed(1) : '—'

  const saveReview = () => {
    if (!form || !cycleId) return
    const member = staff.find(s => s.id === form.staffId)
    if (!member) { toast.error(t('appraisals.selectEmployeeError')); return }
    upsertReview({ cycleId, staffId: member.id, staffName: member.name, reviewer: 'Anita Rao', goals: form.goals, strengths: form.strengths, rating: form.rating })
    toast.success(t('appraisals.savedToast', { name: member.name }))
    setForm(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Award className="h-6 w-6 text-rose-600" /> {t('appraisals.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('appraisals.subtitle', { count: cycleReviews.length, avg })}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={cycleId} onChange={e => setCycleId(e.target.value)} className="h-10 px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setForm({ staffId: '', goals: '', strengths: '', rating: 3 })} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">
            <Plus className="h-4 w-4" /> {t('appraisals.newReview')}
          </button>
        </div>
      </div>

      {form && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('common.employee')}</label>
              <select value={form.staffId} onChange={e => setForm(f => f && ({ ...f, staffId: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                <option value="">{t('common.select')}</option>
                {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name} · {s.department}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('appraisals.rating')}</label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setForm(f => f && ({ ...f, rating: n }))} className="cursor-pointer">
                    <Star className={cn("h-6 w-6", n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('appraisals.goals')}</label>
            <textarea value={form.goals} onChange={e => setForm(f => f && ({ ...f, goals: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">{t('appraisals.strengths')}</label>
            <textarea value={form.strengths} onChange={e => setForm(f => f && ({ ...f, strengths: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setForm(null)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">{t('common.cancel')}</button>
            <button onClick={saveReview} className="h-9 px-4 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer">{t('appraisals.saveReview')}</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {cycleReviews.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t('appraisals.noReviews')}</p>}
          {cycleReviews.map((r: Review) => (
            <div key={r.id} className="px-5 py-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{r.staffName} <span className="text-[11px] font-normal text-slate-400">· {t('appraisals.reviewedBy', { name: r.reviewer })}</span></p>
                <p className="text-[11px] text-amber-500">{'★'.repeat(r.rating)}<span className="text-slate-300">{'★'.repeat(5 - r.rating)}</span></p>
                {r.goals && <p className="text-[11px] text-slate-500 mt-0.5"><b>{t('appraisals.goalsLabel')}</b> {r.goals}</p>}
                {r.strengths && <p className="text-[11px] text-slate-500"><b>{t('appraisals.notesLabel')}</b> {r.strengths}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLE[r.status])}>{t(`reviewStatus.${r.status}`)}</span>
                {r.status === 'draft' && <button onClick={() => { setReviewStatus(r.id, 'submitted'); toast.success(t('appraisals.submittedToast')) }} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer">{t('appraisals.submit')}</button>}
                {r.status === 'submitted' && <button onClick={() => { setReviewStatus(r.id, 'acknowledged'); toast.success(t('appraisals.acknowledgedToast')) }} className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"><Check className="h-3 w-3" /> {t('appraisals.acknowledge')}</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
