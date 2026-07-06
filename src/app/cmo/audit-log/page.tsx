"use client"
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useCmoAuditStore } from '@/store/useCmoAuditStore'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'

export default function CmoAuditLogPage() {
  const t = useTranslations('cmo')
  const { entries, loaded, fetchAuditLog } = useCmoAuditStore()
  const [dateFilter, setDateFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => { if (!loaded) fetchAuditLog(50) }, [loaded, fetchAuditLog])

  const filtered = useMemo(() => entries
    .filter(e => !userFilter || e.user.toLowerCase().includes(userFilter.toLowerCase()))
    .filter(e => !actionFilter || e.action.toLowerCase().includes(actionFilter.toLowerCase()))
  , [entries, userFilter, actionFilter])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <CmoPageHeader title={t('auditLog.title')}
        actions={
          <button onClick={() => { console.info('[CMO Demo] Export audit log'); toast.success(t('auditLog.exportQueued')) }}
            className="text-[12px] font-semibold px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">
            {t('auditLog.exportCsv')}
          </button>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={userFilter} onChange={e => setUserFilter(e.target.value)} placeholder={t('auditLog.filterUser')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25 w-48" />
        <input value={actionFilter} onChange={e => setActionFilter(e.target.value)} placeholder={t('auditLog.filterAction')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25 w-48" />
        <span className="text-[11px] text-slate-500 self-center ml-auto">{t('auditLog.entries', { count: filtered.length })}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
              <th className="px-3 py-2.5 text-left font-medium">{t('auditLog.colTimestamp')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('auditLog.colUser')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('auditLog.colAction')}</th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">{t('auditLog.colTarget')}</th>
              <th className="px-3 py-2.5 text-left font-medium hidden xl:table-cell">{t('auditLog.colDetails')}</th>
              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">{t('auditLog.colIp')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-slate-500">{new Date(e.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-3 py-2 font-semibold text-slate-800">{e.user}</td>
                <td className="px-3 py-2 text-slate-700">{e.action}</td>
                <td className="px-3 py-2 text-slate-600 hidden lg:table-cell max-w-[200px] truncate">{e.target}</td>
                <td className="px-3 py-2 text-slate-500 hidden xl:table-cell max-w-[200px] truncate">{e.details}</td>
                <td className="px-3 py-2 font-mono text-slate-400 hidden md:table-cell">{e.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
