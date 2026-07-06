"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BadgeCheck, AlertTriangle, ShieldCheck, ShieldAlert, Calendar,
  Search, Filter, Mail, Bell, Download,
} from "lucide-react"
import { useHRStore, type Credential, type StaffMember } from "@/store/useHRStore"
import { useAuthStore } from "@/store/useAuthStore"
import { canDo } from "@/lib/permissions"
import { StaffProfileDrawer } from "@/components/admin/StaffProfileDrawer"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useDialogs } from "@/components/ui/ConfirmDialog"
import { useTranslations } from "next-intl"

const today = () => new Date().toISOString().split('T')[0]!
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

type CredentialRow = {
  staff: StaffMember
  credential: Credential
  daysUntilExpiry: number
  bucket: 'expired' | 'this_week' | 'this_month' | 'this_quarter' | 'valid'
}

const BUCKET_TINT: Record<CredentialRow['bucket'], string> = {
  expired:      'bg-red-50 text-red-700 ring-red-200 border-l-4 border-l-red-500',
  this_week:    'bg-primary-soft text-accent ring-primary/25 border-l-4 border-l-orange-500',
  this_month:   'bg-amber-50 text-amber-700 ring-amber-200 border-l-4 border-l-amber-500',
  this_quarter: 'bg-yellow-50 text-yellow-700 ring-yellow-200 border-l-4 border-l-yellow-400',
  valid:        'bg-emerald-50 text-emerald-700 ring-emerald-200 border-l-4 border-l-emerald-500',
}

const BUCKET_LABEL: Record<CredentialRow['bucket'], string> = {
  expired:      'Expired',
  this_week:    'This week',
  this_month:   'This month',
  this_quarter: 'This quarter',
  valid:        'Valid >90d',
}

function addOneYear(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00')
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().split('T')[0]!
  } catch { return iso }
}

function bucketize(days: number, isLifetime: boolean): CredentialRow['bucket'] {
  if (isLifetime) return 'valid'
  if (days < 0) return 'expired'
  if (days <= 7) return 'this_week'
  if (days <= 30) return 'this_month'
  if (days <= 90) return 'this_quarter'
  return 'valid'
}

export default function CredentialsPage() {
  const t = useTranslations('admin')
  const currentUser = useAuthStore(s => s.currentUser)
  const staff = useHRStore(s => s.staff)
  const [filter, setFilter] = useState<CredentialRow['bucket'] | 'all'>('all')
  const [search, setSearch] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState<Set<string>>(new Set())  // credentialId
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const canWrite = canDo(currentUser?.role, 'hr.credential.write')
  const renewCredential = useHRStore(s => s.renewCredential)
  const { prompt, view: dialogView } = useDialogs()
  const actorName = currentUser?.name ?? 'Administrator'

  const bucketLabel = (bucket: CredentialRow['bucket']) =>
    t.has(`credentials.bucket.${bucket}`) ? t(`credentials.bucket.${bucket}`) : BUCKET_LABEL[bucket]

  async function handleRenew(staffId: string, credentialId: string, label: string, currentExpiry: string, currentNumber: string) {
    const values = await prompt({
      title: t('credentials.renewTitle', { label }),
      body: t('credentials.renewBody'),
      confirmLabel: t('credentials.renewCredential'),
      fields: [
        { id: 'expiry', label: t('credentials.newExpiry'), placeholder: '2027-12-31',
          defaultValue: addOneYear(currentExpiry), required: true },
        { id: 'number', label: t('credentials.newNumber'),
          defaultValue: currentNumber },
      ],
    })
    if (!values) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.expiry)) {
      toast.error(t('credentials.dateFormat')); return
    }
    renewCredential(staffId, credentialId, {
      newExpiry: values.expiry,
      newNumber: values.number?.trim() || undefined,
    }, actorName)
    toast.success(t('credentials.renewed', { label }))
  }

  // ── Build rows from every credential of every active staff ────────────
  const allRows = useMemo<CredentialRow[]>(() => {
    const todayStr = today()
    const out: CredentialRow[] = []
    for (const member of staff) {
      if (member.status === 'terminated') continue
      for (const cred of member.credentials) {
        const isLifetime = cred.expiryDate.startsWith('2099')
        const days = isLifetime
          ? Number.MAX_SAFE_INTEGER
          : Math.round((new Date(cred.expiryDate + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
        out.push({
          staff: member, credential: cred,
          daysUntilExpiry: days,
          bucket: bucketize(days, isLifetime),
        })
      }
    }
    return out.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  }, [staff])

  const kpis = useMemo(() => ({
    expired:      allRows.filter(r => r.bucket === 'expired').length,
    this_week:    allRows.filter(r => r.bucket === 'this_week').length,
    this_month:   allRows.filter(r => r.bucket === 'this_month').length,
    this_quarter: allRows.filter(r => r.bucket === 'this_quarter').length,
    valid:        allRows.filter(r => r.bucket === 'valid').length,
  }), [allRows])

  const filtered = useMemo(() => allRows.filter(r => {
    if (filter !== 'all' && r.bucket !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return r.staff.name.toLowerCase().includes(s) ||
        r.staff.department.toLowerCase().includes(s) ||
        r.credential.label.toLowerCase().includes(s) ||
        r.credential.number.toLowerCase().includes(s) ||
        r.credential.type.toLowerCase().includes(s)
    }
    return true
  }), [allRows, filter, search])

  const toggleReminder = (credId: string, label: string, on: boolean) => {
    setReminderEnabled(prev => {
      const n = new Set(prev)
      if (on) n.add(credId); else n.delete(credId)
      return n
    })
    toast.success(t(on ? 'credentials.remindersEnabled' : 'credentials.remindersDisabled', { label }))
  }

  const sendBatchReminders = () => {
    const dueSoon = allRows.filter(r => r.bucket === 'this_week' || r.bucket === 'this_month')
    toast.success(t('credentials.remindersQueued', { count: dueSoon.length }))
  }

  const exportCSV = () => {
    const header = ['Staff', 'Staff ID', 'Department', 'Credential Type', 'Label', 'Number', 'Issued', 'Expires', 'Days Until Expiry', 'Bucket']
    const csv = [
      header.join(','),
      ...filtered.map(r => [
        `"${r.staff.name}"`, r.staff.id, `"${r.staff.department}"`,
        r.credential.type, `"${r.credential.label}"`, r.credential.number,
        r.credential.issuedDate,
        r.credential.expiryDate.startsWith('2099') ? 'Lifetime' : r.credential.expiryDate,
        r.daysUntilExpiry === Number.MAX_SAFE_INTEGER ? 'Lifetime' : r.daysUntilExpiry,
        BUCKET_LABEL[r.bucket],
      ].join(',')),
    ].join('\n')
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `credentials-${today()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('credentials.exported', { count: filtered.length }))
  }

  return (
    <div className="space-y-5 p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-emerald-600" />{t('credentials.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('credentials.subtitle', { count: staff.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={sendBatchReminders}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] text-[var(--color-accent)] cursor-pointer">
            <Bell className="h-3.5 w-3.5" />{t('credentials.sendReminders')}
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            <Download className="h-3.5 w-3.5" />{t('credentials.exportCsv')}
          </button>
        </div>
      </div>

      {/* KPI cards (clickable filter chips) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { key: 'expired',      labelKey: 'credentials.kpiExpired',   icon: ShieldAlert,   tint: 'bg-red-50 border-red-200 text-red-700',         num: 'text-red-600' },
          { key: 'this_week',    labelKey: 'credentials.kpiWeek',      icon: AlertTriangle, tint: 'bg-primary-soft border-primary/20 text-accent', num: 'text-accent' },
          { key: 'this_month',   labelKey: 'credentials.kpiMonth',     icon: Calendar,      tint: 'bg-amber-50 border-amber-200 text-amber-700',    num: 'text-amber-600' },
          { key: 'this_quarter', labelKey: 'credentials.kpiQuarter',   icon: Calendar,      tint: 'bg-yellow-50 border-yellow-200 text-yellow-700', num: 'text-yellow-600' },
          { key: 'valid',        labelKey: 'credentials.kpiValid',     icon: ShieldCheck,   tint: 'bg-emerald-50 border-emerald-200 text-emerald-700', num: 'text-emerald-600' },
        ] as const).map(({ key, labelKey, icon: Icon, tint, num }) => (
          <button key={key} onClick={() => setFilter(filter === key ? 'all' : key)}
            data-testid={`cred-kpi-${key}`}
            className={cn('rounded-xl border p-3 text-left cursor-pointer transition',
              filter === key ? 'ring-2 ring-primary/25 shadow-md' : '', tint)}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">{t(labelKey)}</span>
            </div>
            <p className={cn('text-2xl font-black', num)}>{kpis[key]}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('credentials.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25" />
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer">
            <Filter className="h-3.5 w-3.5" />{t('credentials.showingFilter', { label: bucketLabel(filter) })}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400 italic">
            {t('credentials.noMatch')}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((r, i) => (
              <motion.div key={r.credential.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                className={cn('px-4 py-3 hover:bg-slate-50 transition cursor-pointer', BUCKET_TINT[r.bucket])}
                onClick={() => setDrawerId(r.staff.id)}>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      {r.staff.name}
                      <span className="text-[10px] font-bold uppercase bg-white text-slate-600 px-1.5 py-0.5 rounded ring-1 ring-slate-200">
                        {r.credential.type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">{r.staff.id} · {r.staff.department}</span>
                    </p>
                    <p className="text-xs text-slate-700 mt-0.5">
                      {r.credential.label} · <span className="font-mono">{r.credential.number}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t('credentials.issued', { date: fmtDate(r.credential.issuedDate) })} · {t('credentials.expires')}{' '}
                      {r.credential.expiryDate.startsWith('2099') ? <b>{t('credentials.lifetime')}</b> : <b>{fmtDate(r.credential.expiryDate)}</b>}
                      {r.daysUntilExpiry !== Number.MAX_SAFE_INTEGER && (
                        <span className={cn('ml-2 font-bold',
                          r.bucket === 'expired' ? 'text-red-700'
                          : r.bucket === 'this_week' ? 'text-accent'
                          : r.bucket === 'this_month' ? 'text-amber-700' : 'text-slate-500')}>
                          ({r.daysUntilExpiry >= 0 ? t('credentials.daysLeft', { days: r.daysUntilExpiry }) : t('credentials.daysOverdue', { days: Math.abs(r.daysUntilExpiry) })})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
                      <input type="checkbox"
                        checked={reminderEnabled.has(r.credential.id)}
                        onChange={(e) => toggleReminder(r.credential.id, r.credential.label, e.target.checked)}
                        className="cursor-pointer" />
                      {t('credentials.reminders')}
                    </label>
                    {(r.bucket === 'expired' || r.bucket === 'this_week' || r.bucket === 'this_month') && canWrite && (
                      <button onClick={() => handleRenew(r.staff.id, r.credential.id, r.credential.label, r.credential.expiryDate, r.credential.number)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
                        <Mail className="h-3 w-3" />{t('credentials.renew')}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        {t('credentials.showingCount', { shown: filtered.length, total: allRows.length })} · <code>useHRStore.staff[].credentials</code>
      </p>

      {/* Profile drawer cross-link */}
      <StaffProfileDrawer staffId={drawerId} onClose={() => setDrawerId(null)} />
      {dialogView}
    </div>
  )
}
