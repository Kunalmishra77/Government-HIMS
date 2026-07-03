"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { CheckCircle2, Clock, Utensils, AlertTriangle, ShieldCheck } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { useDietaryStore } from "@/store/useDietaryStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function DietaryOrdersPage() {
  const t = useTranslations('dietary')
  const currentUser = useAuthStore(s => s.currentUser)
  const mealOrders  = useDietaryStore(s => s.mealOrders)
  const dietPlans   = useDietaryStore(s => s.dietPlans)
  const serveMeal   = useDietaryStore(s => s.serveMeal)
  const detect      = useDietaryStore(s => s.detectAllergyConflict)

  const [tab, setTab] = useState<'scheduled' | 'delivered'>('scheduled')
  const { confirm, view: dialogView } = useDialogs()

  const conflictByOrder = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const p of dietPlans) {
      const c = detect(p.id)
      if (c.conflict) {
        const ords = mealOrders.filter(o => o.dietPlanId === p.id)
        ords.forEach(o => {
          const has = c.reasons.filter(r => r.toLowerCase().startsWith(o.mealType.toLowerCase()))
          if (has.length) map.set(o.id, has)
        })
      }
    }
    return map
  }, [dietPlans, mealOrders, detect])

  const filtered = mealOrders.filter(o => tab === 'scheduled' ? o.status !== 'delivered' : o.status === 'delivered')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  const onServe = async (orderId: string) => {
    const conf = conflictByOrder.get(orderId)
    if (conf && conf.length > 0) {
      const proceed = await confirm({
        title: t('orders.conflictTitle'),
        body: t('orders.conflictBody', { reasons: conf.join(' · ') }),
        tone: 'danger',
        confirmLabel: t('orders.serveAnyway'),
      })
      if (!proceed) return
    }
    const order = mealOrders.find(o => o.id === orderId)
    serveMeal(orderId, currentUser?.name ?? 'Dietary Tech')
    if (order) {
      notifyAndAudit({
        to: 'nurse', type: 'system', priority: 'low',
        title: t('orders.mealDeliveredTitle', { patient: order.patientName }),
        body: t('orders.mealDeliveredBody', { mealType: order.mealType, patient: order.patientName, bed: order.bedNumber }),
        patientName: order.patientName,
        audit: { action: 'dietary_meal_served', resource: 'meal_order', resourceId: orderId, detail: `${order.mealType} delivered to ${order.patientName}`, userName: currentUser?.name ?? 'Dietary Tech' },
      })
    }
    toast.success(t('orders.mealDeliveredToast'))
  }

  return (
    <div className="space-y-5 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Utensils className="h-6 w-6 text-green-700" />{t('orders.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('orders.subtitle')}</p>
      </div>

      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 w-fit">
        {(['scheduled', 'delivered'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer capitalize',
              tab === tabKey ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            {tabKey === 'scheduled' ? t('orders.tabScheduled') : t('orders.tabDelivered')} <span className="text-slate-400">
              {mealOrders.filter(o => tabKey === 'scheduled' ? o.status !== 'delivered' : o.status === 'delivered').length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-500">{t('orders.emptyQueue')}</p>
          </div>
        )}
        {filtered.map(o => {
          const conf = conflictByOrder.get(o.id)
          const plan = dietPlans.find(p => p.id === o.dietPlanId)
          return (
            <motion.div key={o.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className={cn("bg-white rounded-xl border p-4",
                conf && conf.length > 0 ? "border-red-200" : "border-slate-200")}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    {o.patientName} <span className="text-xs font-bold text-slate-400">{o.patientId} · {o.bedNumber}</span>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700">{o.mealType}</span>
                    {plan && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]">{plan.dietType}</span>
                    )}
                    {o.status === 'delivered' && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{t('orders.delivered')}</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{o.items.join(' · ')}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <Clock className="inline h-3 w-3 mr-1" />{t('orders.scheduledAt', { time: fmt(o.scheduledAt) })}
                    {o.deliveredAt ? t('orders.deliveredAt', { time: fmt(o.deliveredAt) }) : ''}
                  </p>
                  {plan && plan.allergyFlags.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />{t('orders.flags', { flags: plan.allergyFlags.join(', ') })}
                    </p>
                  )}
                  {conf && conf.length > 0 && (
                    <div className="mt-1.5 rounded-lg bg-red-50 border border-red-200 p-2 text-[11px] text-red-700">
                      <p className="font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{t('orders.allergyConflict')}</p>
                      {conf.map((r, i) => <p key={i}>· {r}</p>)}
                    </div>
                  )}
                </div>
                {o.status === 'delivered'
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  : (
                    <button onClick={() => onServe(o.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                      <ShieldCheck className="h-3.5 w-3.5" />{t('orders.serve')}
                    </button>
                  )}
              </div>
            </motion.div>
          )
        })}
      </div>
      {dialogView}
    </div>
  )
}
