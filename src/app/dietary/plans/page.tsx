"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/store/useAuthStore"
import { useDietaryStore } from "@/store/useDietaryStore"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { suggestDietPlan } from "@/ai-services/diet-plan"
import type { AiEnvelope } from "@/types/ai"
import type { DietPlan } from "@/store/useDietaryStore"
import { Bot, Loader2, Pencil, Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

function DietPlanCard({ plan }: { plan: DietPlan }) {
  const t = useTranslations('dietary')
  const updatePlan = useDietaryStore(s => s.updatePlan)
  const [editing, setEditing] = useState(false)
  const [dietType, setDietType] = useState(plan.dietType)
  const [calorieTarget, setCalorieTarget] = useState(String(plan.calorieTarget ?? 1800))
  const [notes, setNotes] = useState(plan.notes ?? '')

  function save() {
    updatePlan(plan.id, { dietType, calorieTarget: parseInt(calorieTarget) || plan.calorieTarget, notes })
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'low',
      title: t('plans.planUpdatedTitle', { patient: plan.patientName }),
      body: t('plans.planUpdatedBody', { patient: plan.patientName, dietType, kcal: calorieTarget, notes: notes || '' }),
      patientName: plan.patientName,
      audit: { action: 'dietary_plan_assigned', resource: 'diet_plan', resourceId: plan.id, detail: `Updated to ${dietType} · ${calorieTarget} kcal`, userName: 'Dietitian' },
    })
    toast.success(t('plans.planUpdatedToast', { patient: plan.patientName }))
    setEditing(false)
  }
  function approve() {
    updatePlan(plan.id, { aiGenerated: false })
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'low',
      title: t('plans.planApprovedTitle', { patient: plan.patientName }),
      body: t('plans.planApprovedBody', { patient: plan.patientName }),
      patientName: plan.patientName,
      audit: { action: 'hitl_accept', resource: 'diet_plan', resourceId: plan.id, detail: `Plan approved`, userName: 'Dietitian' },
    })
    toast.success(t('plans.planApprovedToast'))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900">{plan.patientName}</p>
            {plan.aiGenerated && <Badge variant="primary" size="sm">{t('plans.aiAwaitingApproval')}</Badge>}
          </div>
          {editing ? (
            <div className="mt-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <input value={dietType} onChange={e => setDietType(e.target.value as typeof plan.dietType)} placeholder={t('plans.dietTypePlaceholder')}
                  className="h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
                <input value={calorieTarget} type="number" onChange={e => setCalorieTarget(e.target.value)} placeholder={t('plans.kcalPlaceholder')}
                  className="h-8 px-2 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)]" />
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('plans.notesPlaceholder')}
                className="w-full px-2 py-1.5 rounded-md ring-1 ring-slate-200 text-[12.5px] focus:outline-none focus:ring-[var(--color-primary-light)] resize-none" />
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 mt-0.5">{plan.dietType} · {plan.calorieTarget} kcal · {plan.ward} · {plan.bedNumber}</p>
              {plan.notes && <p className="text-xs text-slate-500 mt-1 italic">{plan.notes}</p>}
              {plan.allergyFlags && plan.allergyFlags.length > 0 ? (
                <p className="text-[11px] mt-1 text-rose-700 font-semibold">{t('plans.allergiesOnFile', { flags: plan.allergyFlags.join(', ') })}</p>
              ) : null}
            </>
          )}
          <p className="text-xs text-slate-400 mt-1">{t('plans.since', { date: plan.startDate })}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} aria-label={t('plans.cancel')} className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center cursor-pointer"><X className="h-3.5 w-3.5" /></button>
              <button onClick={save} aria-label={t('plans.save')} className="h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer"><Check className="h-3.5 w-3.5" /></button>
            </>
          ) : (
            <>
              {plan.aiGenerated && (
                <button onClick={approve} className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md cursor-pointer">{t('plans.approve')}</button>
              )}
              <button onClick={() => setEditing(true)} aria-label={t('plans.edit')} className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type DietPlanEnvelope = AiEnvelope<Omit<DietPlan, 'id' | 'ward' | 'bedNumber' | 'startDate'>>

export default function DietaryPlans() {
  const t = useTranslations('dietary')
  const { dietPlans, assignPlan } = useDietaryStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const [aiResult, setAiResult] = useState<DietPlanEnvelope | null>(null)
  const [loading, setLoading] = useState(false)

  const runAi = async () => {
    setLoading(true)
    const result = await suggestDietPlan('PT-20394')
    setAiResult(result)
    setLoading(false)
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('plans.title')}</h2>
          <p className="text-slate-500 text-sm mt-1">{t('plans.subtitle')}</p>
        </div>
        <button
          onClick={runAi}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          {t('plans.generateAiPlan')}
        </button>
      </div>

      {aiResult && (
        <HitlReviewCard
          envelope={aiResult}
          title={t('plans.aiSuggestedPlan')}
          featureId="diet-plan-suggest"
          renderContent={(data) => (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">{t('plans.patientLabel')}</span> {data.patientName}</p>
              <p><span className="font-semibold">{t('plans.dietTypeLabel')}</span> {data.dietType}</p>
              <p><span className="font-semibold">{t('plans.targetCaloriesLabel')}</span> {t('plans.kcalPerDay', { kcal: data.calorieTarget ?? 0 })}</p>
              {data.notes && <p className="text-slate-600 italic">{data.notes}</p>}
            </div>
          )}
          onAccept={(data) => assignPlan(
            { ...data, ward: 'General Ward', bedNumber: 'G-12', startDate: new Date().toISOString().split('T')[0]! },
            currentUser?.name ?? 'Dietitian',
          )}
          onReject={() => setAiResult(null)}
        />
      )}

      <div className="space-y-3">
        {dietPlans.map((plan) => (
          <DietPlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  )
}
