"use client"

import { useState } from "react"
import { usePatientStore } from "@/store/usePatientStore"
import { Users, Search, Filter } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"

const TRIAGE_VARIANT: Record<string, 'danger' | 'warning' | 'muted' | 'success'> = {
  Critical: 'danger', High: 'warning', Medium: 'muted', Low: 'success',
}

const STATUS_VARIANT: Record<string, 'blue' | 'warning' | 'success' | 'muted' | 'teal'> = {
  waiting: 'muted', vitals: 'warning', consulting: 'blue',
  pharmacy: 'teal', billing: 'muted', done: 'success',
}

export default function AdminPatientsPage() {
  const t = useTranslations('admin')
  const { patients } = usePatientStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | string>('All')

  const filtered = patients.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || p.queueStatus === statusFilter
    return matchSearch && matchStatus
  })

  const statuses = ['All', 'waiting', 'vitals', 'consulting', 'pharmacy', 'billing', 'done'] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">{t('patients.title')}</h1>
          <p className="text-sm text-[#64748B] mt-1">{t('patients.registeredShown', { registered: patients.length, shown: filtered.length })}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(238,107,38,0.07)]/80">
          <Users className="h-4 w-4 text-[var(--color-accent)]" />
          <span className="text-sm font-bold text-[var(--color-accent)]">{t('patients.total', { count: patients.length })}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800/60 mb-1">{t('patients.activeQueue')}</p>
          <p className="text-xl font-black text-[#0F172A]">
            {patients.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)).length}
          </p>
        </div>
        <div className="rounded-xl bg-[rgba(238,107,38,0.07)]/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-dark)]/60 mb-1">{t('patients.pharmacyBilling')}</p>
          <p className="text-xl font-black text-[#0F172A]">
            {patients.filter(p => ['pharmacy', 'billing'].includes(p.queueStatus)).length}
          </p>
        </div>
        <div className="rounded-xl bg-green-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-800/60 mb-1">{t('patients.completed')}</p>
          <p className="text-xl font-black text-[#0F172A]">
            {patients.filter(p => p.queueStatus === 'done').length}
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={t('patients.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer capitalize whitespace-nowrap ${
                statusFilter === s ? 'bg-[var(--color-primary)] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s === 'All'
                ? t('patients.filterAll', { count: patients.length })
                : `${t.has(`patients.queueStatus.${s}`) ? t(`patients.queueStatus.${s}`) : s} (${patients.filter(p => p.queueStatus === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-semibold">{t('patients.noMatch')}</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th scope="col" className="px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">{t('patients.colToken')}</th>
                  <th scope="col" className="px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">{t('patients.colPatient')}</th>
                  <th scope="col" className="px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">{t('patients.colDepartment')}</th>
                  <th scope="col" className="px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">{t('patients.colTriage')}</th>
                  <th scope="col" className="px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider">{t('patients.colStatus')}</th>
                  <th scope="col" className="px-5 py-3.5 font-bold text-slate-500 text-xs uppercase tracking-wider text-right">{t('patients.colWait')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-white hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold text-[var(--color-accent)]">#{p.token}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.id}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-[#0F172A]">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.age}y · {p.gender} · {p.bloodGroup}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-700">{p.department}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.doctor}</p>
                    </td>
                    <td className="px-5 py-4">
                      {p.triageLevel ? (
                        <NeonBadge variant={TRIAGE_VARIANT[p.triageLevel] ?? 'muted'}>{t.has(`patients.triage.${p.triageLevel}`) ? t(`patients.triage.${p.triageLevel}`) : p.triageLevel}</NeonBadge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <NeonBadge variant={STATUS_VARIANT[p.queueStatus] ?? 'muted'} dot={p.queueStatus !== 'done'} pulse={['waiting','consulting'].includes(p.queueStatus)}>
                        {t.has(`patients.queueStatus.${p.queueStatus}`) ? t(`patients.queueStatus.${p.queueStatus}`) : p.queueStatus}
                      </NeonBadge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-bold text-slate-700">
                        {p.estimatedWait > 0 ? `${p.estimatedWait}m` : '—'}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t('patients.reg', { time: p.registeredAt })}</p>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
