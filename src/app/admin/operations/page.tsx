"use client"

import { usePatientStore } from "@/store/usePatientStore"
import { useNotificationStore, type NotificationChannel } from "@/store/useNotificationStore"
import { CHANNEL_EVENT_LABELS, CHANNEL_LABELS, CHANNEL_COLORS } from "@/services/notification-dispatcher"
import { PatientCard } from "@/components/features/PatientCard"
import { Bell, MessageCircle, Smartphone, Mail, MonitorSmartphone, Radio } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PredictiveOpsCockpit } from "@/components/admin/PredictiveOpsCockpit"

const ALL_CHANNELS: NotificationChannel[] = ['in_app', 'push', 'whatsapp', 'sms', 'email']

const CHANNEL_ICONS: Record<NotificationChannel, React.ElementType> = {
  in_app:   MonitorSmartphone,
  push:     Bell,
  whatsapp: MessageCircle,
  sms:      Smartphone,
  email:    Mail,
}

export default function AdminOperations() {
  const t = useTranslations('admin')
  const { patients } = usePatientStore()
  const { channelConfig, updateChannelConfig } = useNotificationStore()

  const toggleChannel = (eventType: string, channel: NotificationChannel) => {
    const current = channelConfig[eventType] ?? []
    const isActive = current.includes(channel)
    if (isActive && current.length === 1) {
      toast.error(t('operations.oneChannelRequired'))
      return
    }
    const next = isActive ? current.filter(c => c !== channel) : [...current, channel]
    updateChannelConfig(eventType, next)
    toast.success(t(isActive ? 'operations.channelDisabled' : 'operations.channelEnabled', { channel: CHANNEL_LABELS[channel], event: CHANNEL_EVENT_LABELS[eventType] }))
  }

  return (
    <div className="space-y-8 pt-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t('operations.title')}</h2>
        <p className="text-slate-500 text-sm mt-1">{t('operations.subtitle')}</p>
      </div>

      {/* M4-W3 — S7: Predictive Operations Cockpit. Forward-looking forecasts
          over current store state. Each card carries reasoning + HITL action. */}
      <PredictiveOpsCockpit />

      {/* Notification Channel Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <Radio className="h-5 w-5 text-[var(--color-accent)]" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{t('operations.channelConfig')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t('operations.channelConfigDesc')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-56">{t('operations.event')}</th>
                {ALL_CHANNELS.map(ch => {
                  const Icon = CHANNEL_ICONS[ch]
                  return (
                    <th key={ch} className="px-3 py-3 text-center">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full", CHANNEL_COLORS[ch])}>
                        <Icon className="h-3 w-3" />
                        {CHANNEL_LABELS[ch]}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(CHANNEL_EVENT_LABELS).map(([eventType, label]) => {
                const active = channelConfig[eventType] ?? []
                return (
                  <tr key={eventType} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-800 text-sm">{label}</td>
                    {ALL_CHANNELS.map(ch => {
                      const isActive = active.includes(ch)
                      const Icon = CHANNEL_ICONS[ch]
                      return (
                        <td key={ch} className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggleChannel(eventType, ch)}
                            title={t(isActive ? 'operations.disableFor' : 'operations.enableFor', { channel: CHANNEL_LABELS[ch], event: label })}
                            className={cn(
                              "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer",
                              isActive
                                ? cn("shadow-sm", CHANNEL_COLORS[ch])
                                : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 font-semibold">
          {t('operations.dispatchNote')}
        </div>
      </div>

      {/* Real-time patient activity */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">{t('operations.activePatients')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {patients.map((p, i) => <PatientCard key={p.id} patient={p} delay={i * 0.05} />)}
        </div>
      </div>
    </div>
  )
}
