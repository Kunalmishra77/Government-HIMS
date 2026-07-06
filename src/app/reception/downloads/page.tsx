"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Search, FileText, Receipt, ClipboardList, ShieldCheck, Ticket, Download, Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { printableHtml, downloadText } from "@/lib/fileIO"

const CAT_KEY: Record<string, string> = {
  'Forms': 'catForms', 'Receipts': 'catReceipts', 'Token slips': 'catTokenSlips', 'Reports': 'catReports', 'Insurance': 'catInsurance', 'All': 'filterAll',
}

type Cat = 'Forms' | 'Receipts' | 'Token slips' | 'Reports' | 'Insurance'
type Doc = { id: string; name: string; cat: Cat; meta: string }

const DOCS: Doc[] = [
  { id: 'd1', name: 'New patient registration form', cat: 'Forms', meta: 'PDF · template' },
  { id: 'd2', name: 'OPD consent form', cat: 'Forms', meta: 'PDF · template' },
  { id: 'd3', name: 'OPD receipt — Meera Pillai', cat: 'Receipts', meta: 'Today · ₹600' },
  { id: 'd4', name: 'OPD receipt — Aarav Sharma', cat: 'Receipts', meta: 'Today · ₹500' },
  { id: 'd5', name: 'Token slip — #4 Kiran Patil', cat: 'Token slips', meta: 'Today · General Medicine' },
  { id: 'd6', name: 'Daily collection report', cat: 'Reports', meta: 'Today · auto-generated' },
  { id: 'd7', name: 'Footfall summary', cat: 'Reports', meta: 'Today · auto-generated' },
  { id: 'd8', name: 'Insurance pre-auth form', cat: 'Insurance', meta: 'PDF · template' },
  { id: 'd9', name: 'Cashless claim checklist', cat: 'Insurance', meta: 'PDF · template' },
]
const FILTERS = ['All', 'Forms', 'Receipts', 'Token slips', 'Reports', 'Insurance'] as const
const STYLE: Record<Cat, { Icon: typeof FileText; tint: string }> = {
  'Forms': { Icon: ClipboardList, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  'Receipts': { Icon: Receipt, tint: 'bg-amber-50 text-amber-600' },
  'Token slips': { Icon: Ticket, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  'Reports': { Icon: FileText, tint: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]' },
  'Insurance': { Icon: ShieldCheck, tint: 'bg-rose-50 text-rose-600' },
}

export default function ReceptionDownloads() {
  const t = useTranslations('reception')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<typeof FILTERS[number]>('All')
  const visible = DOCS.filter(d => (filter === 'All' || d.cat === filter) && d.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto pb-6">
      <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('downloads.title')}</h1>
      <p className="text-[13px] text-slate-500 mt-0.5 mb-4">{t('downloads.subtitle')}</p>

      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5 mb-4">
        <div className="relative">
          <Search className="h-4.5 w-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('downloads.searchPlaceholder')}
            className="w-full rounded-2xl bg-slate-50 border border-slate-100 pl-11 pr-4 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[rgba(238,107,38,0.20)] focus:bg-white transition" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full transition", filter === f ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{t(`downloads.${CAT_KEY[f]}`)}</button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-slate-900">{t('downloads.documents')}</h3>
          <span className="text-[12px] font-semibold text-slate-400">{t('downloads.filesCount', { count: visible.length })}</span>
        </div>
        {visible.length === 0 ? (
          <p className="text-[13px] text-slate-400 bg-slate-50 rounded-xl p-4 text-center">{t('downloads.noDocuments')}</p>
        ) : (
          <div className="space-y-2">
            {visible.map(d => {
              const { Icon, tint } = STYLE[d.cat]
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                  <span className={cn("h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0", tint)}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">{d.name}</p>
                    <p className="text-[12px] text-slate-500"><span className={cn("font-semibold px-2 py-0.5 rounded-full mr-1.5", tint)}>{t(`downloads.${CAT_KEY[d.cat]}`)}</span>{d.meta}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => printableHtml(d.name, `<div class="info-row"><div class="info-item"><span class="info-label">${t('downloads.slipDocument')}</span><span class="info-value">${d.name}</span></div><div class="info-item"><span class="info-label">${t('downloads.slipType')}</span><span class="info-value">${t(`downloads.${CAT_KEY[d.cat]}`)}</span></div><div class="info-item"><span class="info-label">${t('downloads.slipDate')}</span><span class="info-value">${new Date().toLocaleDateString('en-IN')}</span></div></div><p class="muted">${t('downloads.slipSystemGenerated')}</p>`)}
                      aria-label={t('downloads.print')} className="h-9 w-9 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:text-slate-700 active:scale-95 transition cursor-pointer"><Printer className="h-4 w-4" /></button>
                    <button onClick={() => downloadText(`${d.name}.txt`, `Agentix HIMS · ${d.name}\nType: ${d.cat}\nGenerated: ${new Date().toLocaleString('en-IN')}\n\nMeta: ${d.meta}\n\n(Demo download · Phase-1 mock)`)}
                      aria-label={t('downloads.download')} className="h-9 px-3 rounded-xl bg-[var(--color-primary)] text-white text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[var(--color-primary-dark)] active:scale-95 transition cursor-pointer"><Download className="h-4 w-4" /> <span className="hidden sm:inline">{t('downloads.download')}</span></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
