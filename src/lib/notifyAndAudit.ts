/* M6 — Notification + audit helper.
 *
 * Single typed call that (a) writes a notification to the target role's
 * inbox, and (b) emits an audit row in the same shape every existing W1-W6
 * surface uses. Use at every cross-role handoff site so the next role
 * actually sees the work AND the trail is preserved.
 *
 * Usage:
 *
 *   notifyAndAudit({
 *     to: 'nurse',
 *     type: 'bed_allocated',
 *     priority: 'high',
 *     title: 'New admission · Bed CCU-04',
 *     body: 'Kiran Patil assigned to CCU-04. Receive at the ward.',
 *     patientName: 'Kiran Patil',
 *     audit: {
 *       action: 'admission_admit',
 *       resource: 'admission',
 *       resourceId: 'ADM-001',
 *       detail: 'Bed CCU-04 allocated to PT-20394 by bed manager',
 *       userName: 'Aditi Verma',
 *     },
 *   })
 *
 * Phase-1 scope: routes to the in-app NotificationStore + AuditStore only.
 * Phase-2 fans out to WhatsApp / SMS / push via the existing channelConfig
 * + notification-dispatcher (already shipping templates per type).
 *
 * i18n: This helper is a plain (non-hook) util — the human-readable `title`
 * and `body` it stores are built by the CALLER, so localization happens at the
 * call site, not here. Localized message TEMPLATES (with ICU params like
 * {patientName}, {bed}, {test}) are provided per NotificationType in the
 * `notify` namespace, so callers can build title/body in the active locale:
 *   const t = useTranslations('notify')
 *   notifyAndAudit({
 *     to: 'nurse', type: 'bed_allocated', priority: 'high',
 *     title: t('bed_allocated.title', { bed }),
 *     body:  t('bed_allocated.body', { patientName, bed }),
 *     ...
 *   })
 * The `audit.detail` string is an internal trail (staff-facing log) and is
 * left in English. See messages/{en,hi}/notify.json.
 */

import { useNotificationStore, type NotificationType, type NotificationPriority, type NotificationChannel } from "@/store/useNotificationStore"
import { useAuditStore, type AuditAction } from "@/store/useAuditStore"
import type { Role } from "@/types/roles"

export interface NotifyAndAuditInput {
  to: Role                                // who should see this in their bell
  type: NotificationType                  // semantic — drives channel mapping (see useNotificationStore.channelConfig)
  priority?: NotificationPriority         // default 'medium'
  title: string
  body: string
  patientName?: string
  patientPhone?: string
  link?: string                           // deep-link opened when the notification is clicked
  channels?: NotificationChannel[]        // override (else uses channelConfig[type])
  audit: {
    action: AuditAction
    resource: string
    resourceId?: string
    detail?: string
    userId?: string                       // who took the action; default 'system'
    userName?: string                     // human-readable; default 'System'
  }
}

/** One-shot notification + audit. Safe to call from any onClick handler. */
export function notifyAndAudit(input: NotifyAndAuditInput): void {
  const notif = useNotificationStore.getState()
  const audit  = useAuditStore.getState()

  const channelConfig = notif.channelConfig?.[input.type] ?? ['in_app']
  notif.add({
    type: input.type,
    priority: input.priority ?? 'medium',
    title: input.title,
    body: input.body,
    targetRole: input.to,
    patientName: input.patientName,
    patientPhone: input.patientPhone,
    link: input.link,
    channels: input.channels ?? channelConfig,
  })

  audit.log({
    userId:   input.audit.userId   ?? 'system',
    userName: input.audit.userName ?? 'System',
    action:   input.audit.action,
    resource: input.audit.resource,
    resourceId: input.audit.resourceId,
    detail:   input.audit.detail,
  })
}

/** Notify multiple roles in one call — used for OT (anaesthetist + surgeon + nurse). */
export function notifyAndAuditMany(
  toRoles: Role[],
  rest: Omit<NotifyAndAuditInput, 'to'>,
): void {
  for (const role of toRoles) notifyAndAudit({ to: role, ...rest })
}
