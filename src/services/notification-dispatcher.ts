import type { Notification, NotificationChannel, ChannelConfigMap, DispatchRecord } from '@/store/useNotificationStore'

export interface DispatchResult {
  notificationId: string
  records: DispatchRecord[]
  skippedChannels: NotificationChannel[]
}

const WHATSAPP_TEMPLATES: Partial<Record<string, (n: Notification) => string>> = {
  bed_allocated: (n) =>
    `Dear ${n.patientName ?? 'Patient'}, your bed has been allocated at Agentix HIMS. Please proceed to the ward as directed. — Agentix HIMS`,
  ot_confirmed: (n) =>
    `Dear ${n.patientName ?? 'Patient'}, your surgery has been scheduled. Please follow pre-operative instructions. — Agentix HIMS`,
  medicines_ready: (n) =>
    `Dear ${n.patientName ?? 'Patient'}, your medicines are ready for collection at the ward pharmacy counter. — Agentix HIMS`,
  discharge_initiated: (n) =>
    `Dear ${n.patientName ?? 'Patient'}, your discharge process has been initiated. Please visit the billing counter with your documents. — Agentix HIMS`,
  discharge_ready: (n) =>
    `Dear ${n.patientName ?? 'Patient'}, your discharge summary is ready. Please collect it from the nurse's station. — Agentix HIMS`,
  followup_reminder: (n) =>
    `Dear ${n.patientName ?? 'Patient'}, this is a reminder for your follow-up visit at Agentix HIMS. ${n.body} — Agentix HIMS`,
}

const SMS_TEMPLATES: Partial<Record<string, (n: Notification) => string>> = {
  bed_allocated: (n) => `Agentix HIMS: Bed allocated for ${n.patientName ?? 'you'}. Proceed to ward.`,
  ot_confirmed: (n) => `Agentix HIMS: Surgery confirmed for ${n.patientName ?? 'you'}. Follow pre-op instructions.`,
  medicines_ready: (n) => `Agentix HIMS: Medicines ready for ${n.patientName ?? 'you'}. Collect from ward pharmacy.`,
  discharge_initiated: (n) => `Agentix HIMS: Discharge started for ${n.patientName ?? 'you'}. Visit billing counter.`,
  followup_reminder: (n) => `Agentix HIMS: Follow-up reminder — ${n.body}`,
}

function buildMessage(notification: Notification, channel: NotificationChannel): string {
  const templates = channel === 'whatsapp' ? WHATSAPP_TEMPLATES : SMS_TEMPLATES
  const builder = templates[notification.type]
  if (builder) return builder(notification)
  return channel === 'whatsapp'
    ? `Agentix HIMS: ${notification.title} — ${notification.body}`
    : `Agentix HIMS: ${notification.body}`
}

export function dispatchNotification(
  notification: Notification,
  channelConfig: ChannelConfigMap,
): DispatchResult {
  const configuredChannels = channelConfig[notification.type] ?? notification.channels
  const records: DispatchRecord[] = []
  const skipped: NotificationChannel[] = []

  for (const channel of configuredChannels) {
    if (channel === 'whatsapp' || channel === 'sms') {
      if (!notification.patientPhone) {
        skipped.push(channel)
        continue
      }
      const message = buildMessage(notification, channel)
      // In a real system: call WhatsApp Business API / SMS gateway here
      console.info(`[${channel.toUpperCase()} DISPATCH] To: ${notification.patientPhone}\n${message}`)
      records.push({ channel, sentAt: new Date().toISOString(), recipient: notification.patientPhone })
    } else if (channel === 'email') {
      records.push({ channel, sentAt: new Date().toISOString(), recipient: notification.targetUserId })
    } else {
      records.push({ channel, sentAt: new Date().toISOString() })
    }
  }

  return { notificationId: notification.id, records, skippedChannels: skipped }
}

export const CHANNEL_EVENT_LABELS: Record<string, string> = {
  bed_allocated:       'Bed Allocated',
  ot_confirmed:        'OT Time Confirmed',
  medicines_ready:     'Medicines Ready',
  discharge_initiated: 'Discharge Initiated',
  discharge_ready:     'Discharge Ready',
  followup_reminder:   'Follow-up Reminder',
  critical_value:      'Critical Lab Value',
  drug_interaction:    'Drug Interaction Alert',
  appointment:         'Appointment Reminder',
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  in_app:   'In-App',
  push:     'Push',
  sms:      'SMS',
  whatsapp: 'WhatsApp',
  email:    'Email',
}

export const CHANNEL_COLORS: Record<NotificationChannel, string> = {
  in_app:   'bg-slate-100 text-slate-700',
  push:     'bg-surface-sunken text-accent',
  sms:      'bg-amber-100 text-amber-700',
  whatsapp: 'bg-green-100 text-green-700',
  email:    'bg-accent-soft text-accent',
}
