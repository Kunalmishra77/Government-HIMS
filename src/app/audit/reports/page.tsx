"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck, FileText, ChevronDown, ChevronRight, Printer, Download,
  CheckCircle2, AlertCircle, ArrowRight,
} from "lucide-react"
import { useAuditStore, moduleOf, severityOf } from "@/store/useAuditStore"
import { NABH_CHAPTERS, buildNabhEvidence } from "@/lib/nabhEvidence"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const fmt = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function AuditReports() {
  const t = useTranslations('audit')
  const entries = useAuditStore(s => s.entries)
  const [openChapter, setOpenChapter] = useState<string | null>(NABH_CHAPTERS[0]?.chapter ?? null)

  const chapters = useMemo(() => buildNabhEvidence(entries), [entries])
  const readyCount = chapters.filter(c => c.ready).length

  const hitlTotal = entries.filter(e => e.action.startsWith('hitl_')).length
  const hitlAccept = entries.filter(e => e.action === 'hitl_accept').length
  const hitlRate = hitlTotal ? Math.round((hitlAccept / hitlTotal) * 100) : 0

  const sev = entries.reduce(
    (acc, e) => { acc[severityOf(e.action)]++; return acc },
    { info: 0, warning: 0, critical: 0 } as Record<'info' | 'warning' | 'critical', number>,
  )

  const exportEvidence = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      totals: { events: entries.length, hitlRate, severity: sev, chaptersReady: readyCount, chaptersTotal: chapters.length },
      chapters: chapters.map(c => ({
        chapter: c.chapter, title: c.title, count: c.count, ready: c.ready,
        events: c.events.map(e => ({
          id: e.id, at: e.timestamp, action: e.action, module: moduleOf(e.action), severity: severityOf(e.action),
          actor: { id: e.userId, name: e.userName }, resource: e.resource, resourceId: e.resourceId, detail: e.detail,
        })),
      })),
    }
    if (typeof window !== 'undefined') {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nabh-evidence-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
    toast.success(t('reportsPage.exportedToast', { count: entries.length, ready: readyCount, total: chapters.length }))
  }

  return (
    <div className="space-y-6 p-6 print:p-0">
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-[var(--color-accent)]" />{t('reportsPage.title')}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{t('reportsPage.subtitle', { count: entries.length })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => typeof window !== 'undefined' && window.print()}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl cursor-pointer">
            <Printer className="h-3.5 w-3.5" />{t('reportsPage.print')}
          </button>
          <button onClick={exportEvidence}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.12)] px-3 py-2 rounded-xl cursor-pointer">
            <Download className="h-3.5 w-3.5" />{t('reportsPage.exportJson')}
          </button>
        </div>
      </div>

      {/* Print-only cover header */}
      <div className="hidden print:block">
        <h1 className="text-3xl font-bold text-slate-900">{t('reportsPage.bundleTitle')}</h1>
        <p className="text-sm text-slate-600 mt-1">{t('reportsPage.generated', { when: new Date().toLocaleString('en-IN') })}</p>
        <hr className="my-4 border-slate-300" />
      </div>

      {/* Executive summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reportsPage.chaptersReady')}</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{readyCount}<span className="text-base text-slate-400 font-bold">/{chapters.length}</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reportsPage.totalEvents')}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{entries.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reportsPage.aiAcceptRate')}</p>
          <p className="text-2xl font-black text-[var(--color-accent)] mt-1">{hitlRate}<span className="text-base font-bold">%</span></p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('reportsPage.severityMix')}</p>
          <p className="text-xs font-bold text-slate-900 mt-1.5">
            <span className="text-red-600">{sev.critical}</span> {t('reportsPage.crit')} · <span className="text-amber-600">{sev.warning}</span> {t('reportsPage.warn')} · <span className="text-slate-500">{sev.info}</span> {t('reportsPage.info')}
          </p>
        </div>
      </div>

      {/* NABH chapter accordion — per-chapter evidence list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />{t('reportsPage.chapterEvidence')}
          </h3>
          <Link href="/quality/nabh" className="text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1">
            {t('reportsPage.openQualityCockpit')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {chapters.map((c) => {
            const open = openChapter === c.chapter
            return (
              <div key={c.chapter} className="print:break-inside-avoid">
                <button
                  onClick={() => setOpenChapter(open ? null : c.chapter)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 cursor-pointer print:cursor-default"
                >
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded ring-1 flex-shrink-0',
                    c.ready ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-500 ring-slate-200')}>
                    {c.chapter}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{c.blurb}</p>
                  </div>
                  <span className={cn('text-[11px] font-bold flex items-center gap-1 flex-shrink-0',
                    c.ready ? 'text-emerald-700' : 'text-slate-400')}>
                    {c.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {c.count} {c.count === 1 ? t('event') : t('events')}
                  </span>
                  {open
                    ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 print:hidden" />
                    : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0 print:hidden" />}
                </button>
                {(open || (typeof window !== 'undefined' && window.matchMedia?.('print').matches)) && (
                  <div className="px-4 pb-4 bg-slate-50/40 print:bg-white">
                    {c.events.length === 0 ? (
                      <p className="text-xs text-slate-400 italic px-2 py-3">
                        {t('reportsPage.noQualifyingEvents')} <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{c.actions.join(', ')}</code>
                      </p>
                    ) : (
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            <th className="px-2 py-1.5 w-32">{t('reportsPage.colWhen')}</th>
                            <th className="px-2 py-1.5 w-44">{t('reportsPage.colAction')}</th>
                            <th className="px-2 py-1.5 w-36">{t('reportsPage.colActor')}</th>
                            <th className="px-2 py-1.5">{t('reportsPage.colEvidence')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {c.events.map(e => {
                            const s = severityOf(e.action)
                            return (
                              <tr key={e.id} className="align-top">
                                <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmt(e.timestamp)}</td>
                                <td className="px-2 py-1.5">
                                  <span className="font-bold text-slate-800">{e.action.replace(/_/g, ' ')}</span>
                                  {s !== 'info' && (
                                    <span className={cn('ml-1.5 text-[9px] font-bold uppercase px-1 py-0.5 rounded',
                                      s === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{t(`severity.${s}`)}</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  <p className="font-semibold text-slate-700">{e.userName}</p>
                                  <p className="text-[10px] text-slate-400">{e.userId}</p>
                                </td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  <p>{e.detail ?? <span className="italic text-slate-400">{t('reportsPage.noDetail')}</span>}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    {e.resource}{e.resourceId ? ` · ${e.resourceId}` : ''}
                                  </p>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center print:mt-6">
        {t('reportsPage.footer')}
      </p>
    </div>
  )
}
