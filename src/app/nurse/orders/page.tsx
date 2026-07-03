"use client"

import { useMemo } from "react"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useShiftStore, ALL_WARDS } from "@/store/useShiftStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { WardSwitcher } from "@/components/nurse/ShiftBanner"
import { buildOrders, type NurseOrder, type OrderKind } from "@/lib/orders"

const NURSE = "N. Anjali Desai"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { motion, AnimatePresence } from "framer-motion"
import { FlaskConical, Pill, Droplets, Send, ArrowUpRight, Scissors, CheckCircle2, Sparkles, Clock, Stethoscope } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const KIND: Record<OrderKind, { icon: React.ElementType; tint: string }> = {
  test:     { icon: FlaskConical, tint: "bg-accent-soft text-accent border-primary/20" },
  med:      { icon: Pill,         tint: "bg-accent-soft text-accent border-primary/20" },
  iv:       { icon: Droplets,     tint: "bg-accent-soft text-accent border-primary/20" },
  referral: { icon: Send,         tint: "bg-accent-soft text-accent border-primary/20" },
  icu:      { icon: ArrowUpRight, tint: "bg-danger-bg text-danger border-danger/20" },
  ot:       { icon: Scissors,     tint: "bg-danger-bg text-danger border-danger/20" },
}
const urgencyVariant = (u: NurseOrder["urgency"]) =>
  u === "high" ? "danger" : u === "medium" ? "warning" : "muted"

const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(0, m)} min ago`
  const h = Math.round(m / 60)
  return `${h} hr${h > 1 ? "s" : ""} ago`
}

export default function NurseOrdersPage() {
  const t = useTranslations('nurse')
  const allInpatients = useInpatientStore(s => s.inpatients)
  const acknowledgeOrder = useInpatientStore(s => s.acknowledgeOrder)
  const activeWard = useShiftStore(s => s.activeWard)
  const addNotification = useNotificationStore(s => s.add)
  const inpatients = useMemo(() => allInpatients.filter(i => activeWard === ALL_WARDS || i.ward === activeWard), [allInpatients, activeWard])
  const orders = useMemo(() => buildOrders(inpatients), [inpatients])
  const highCount = orders.filter(o => o.urgency === "high").length

  // Mark done → log to the chart AND notify the doctor who ordered it.
  const action = (o: NurseOrder) => {
    acknowledgeOrder(o.patientId, { key: o.key, label: o.label })
    addNotification({
      type: "order_done", priority: "medium",
      title: t('orders.orderCompletedTitle', { label: o.label }),
      body: t('orders.orderCompletedBody', { label: o.label, name: o.patientName, ward: o.ward, bed: o.bed, nurse: NURSE }),
      targetRole: "doctor", patientName: o.patientName, channels: ["in_app"],
    })
    toast.success(t('orders.orderDoneToast', { label: o.label, by: o.requestedBy }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="t-body text-foreground-lighter">{t('orders.subtitle', { ward: activeWard })}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <WardSwitcher />
          <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent-soft border border-primary/20 rounded-full px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {highCount > 0 ? t('orders.aiPrioritisedHigh', { count: highCount }) : t('orders.aiPrioritised')}
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t('orders.allActioned')}
          description={t('orders.allActionedDesc')}
          size="sm"
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {orders.map(o => {
              const k = KIND[o.kind]
              const Icon = k.icon
              return (
                <motion.div key={o.key} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
                  <Card className="p-4 u-lift">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`h-11 w-11 rounded-2xl border flex items-center justify-center flex-shrink-0 ${k.tint}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="t-overline px-1.5 py-0.5 rounded bg-surface-sunken text-foreground-lighter">{o.kind}</span>
                            <h3 className="font-bold text-foreground">{o.label}</h3>
                            <NeonBadge variant={urgencyVariant(o.urgency)}>{o.urgency.toUpperCase()}</NeonBadge>
                          </div>
                          <p className="text-xs text-foreground-lighter mt-0.5 font-medium">
                            {o.patientName} · {o.ward} {o.bed}{o.detail ? ` · ${o.detail}` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap">
                            <span className="flex items-center gap-1 text-accent font-semibold"><Stethoscope className="h-3 w-3" /> {t('orders.orderedBy', { name: o.requestedBy })}</span>
                            <span className="flex items-center gap-1 text-foreground-placeholder"><Clock className="h-3 w-3" /> {timeAgo(o.at)}</span>
                            <span className="flex items-center gap-1 text-accent font-semibold"><Sparkles className="h-3 w-3" /> {o.aiReason}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => action(o)}
                        className="u-press flex flex-col items-center gap-0.5 text-sm font-bold text-white bg-success hover:bg-success-strong px-4 py-2 rounded-xl shadow-xs cursor-pointer transition-colors flex-shrink-0"
                      >
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {t('orders.markDone')}</span>
                        <span className="text-[9px] font-medium text-white/80">{t('orders.notifies', { name: o.requestedBy.replace(/^Dr\.?\s*/, "Dr. ") })}</span>
                      </button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
