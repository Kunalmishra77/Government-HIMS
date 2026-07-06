"use client"

import { useState } from "react"
import {
  Search, FileText, FlaskConical, Pill, Receipt, ShieldCheck,
  Download, Share2, FileDown,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { printableHtml } from "@/lib/fileIO"

function downloadDoc(d: { name: string; category: string; date: string; size: string; amount?: string }) {
  const html = `
    <div class="info-row">
      <div class="info-item"><span class="info-label">Document</span><span class="info-value">${d.name}</span></div>
      <div class="info-item"><span class="info-label">Category</span><span class="info-value">${d.category}</span></div>
      <div class="info-item"><span class="info-label">Date</span><span class="info-value">${d.date}</span></div>
      ${d.amount ? `<div class="info-item"><span class="info-label">Amount</span><span class="info-value">${d.amount}</span></div>` : ''}
    </div>
    <p class="muted">This is a system-generated document from Agentix HIMS.</p>`
  printableHtml(d.name, html)
}

function shareDoc(name: string) {
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/patient/downloads?doc=${encodeURIComponent(name)}`
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(link).catch(() => { /* ignore */ })
  }
  toast.success(`Share link for ${name} copied to clipboard`)
}

type Category = 'Lab Reports' | 'Prescriptions' | 'Invoices' | 'Summaries' | 'Insurance'

type Doc = {
  id: string
  name: string
  category: Category
  date: string // ISO
  size: string
  amount?: string
}

const DOCS: Doc[] = [
  { id: 'd1', name: 'CBC Report', category: 'Lab Reports', date: '2026-05-22', size: '240 KB' },
  { id: 'd2', name: 'Chest X-ray Report', category: 'Lab Reports', date: '2026-05-18', size: '1.4 MB' },
  { id: 'd3', name: 'e-Prescription — Dr. Priya Nair', category: 'Prescriptions', date: '2026-05-22', size: '88 KB' },
  { id: 'd4', name: 'e-Prescription — Dr. Anil Mehta', category: 'Prescriptions', date: '2026-04-30', size: '92 KB' },
  { id: 'd5', name: 'Invoice INV-2026-001', category: 'Invoices', date: '2026-05-22', size: '120 KB', amount: '₹645' },
  { id: 'd6', name: 'Discharge Summary', category: 'Summaries', date: '2026-03-12', size: '310 KB' },
  { id: 'd7', name: 'Visit Summary — OPD', category: 'Summaries', date: '2026-05-22', size: '64 KB' },
  { id: 'd8', name: 'Insurance Pre-auth Letter', category: 'Insurance', date: '2026-05-20', size: '156 KB' },
  { id: 'd9', name: 'Policy Copy — Star Health', category: 'Insurance', date: '2026-01-08', size: '420 KB' },
]

const FILTERS = ['All', 'Lab Reports', 'Prescriptions', 'Invoices', 'Summaries', 'Insurance'] as const
type Filter = typeof FILTERS[number]

const CATEGORY_STYLE: Record<Category, { Icon: typeof FileText; tint: string; fg: string }> = {
  'Lab Reports':   { Icon: FlaskConical, tint: 'bg-[rgba(238,107,38,0.07)]',  fg: 'text-[var(--color-accent)]' },
  'Prescriptions': { Icon: Pill,         tint: 'bg-[rgba(238,107,38,0.07)]',    fg: 'text-[var(--color-accent)]' },
  'Invoices':      { Icon: Receipt,      tint: 'bg-amber-50',   fg: 'text-amber-600' },
  'Summaries':     { Icon: FileText,     tint: 'bg-[rgba(238,107,38,0.07)]',    fg: 'text-[var(--color-accent)]' },
  'Insurance':     { Icon: ShieldCheck,  tint: 'bg-[rgba(238,107,38,0.07)]',    fg: 'text-[var(--color-accent)]' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DownloadsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const visible = DOCS.filter(d => {
    const matchesFilter = filter === 'All' || d.category === filter
    const matchesQuery = d.name.toLowerCase().includes(query.trim().toLowerCase())
    return matchesFilter && matchesQuery
  })

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5">
      <div>
        <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">Download Center</h1>
        <p className="text-[13px] text-slate-500 mt-1">All your documents in one place</p>
      </div>

      {/* Search + filters card */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <div className="relative">
          <Search className="h-4.5 w-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-2xl bg-slate-50 border border-slate-100 pl-11 pr-4 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[rgba(238,107,38,0.20)] focus:bg-white transition-colors"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full transition-colors active:scale-95",
                filter === f ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_8px_28px_rgba(15,23,42,0.05)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-slate-900">Documents</h3>
          <span className="text-[12px] font-semibold text-slate-400">{visible.length} {visible.length === 1 ? 'file' : 'files'}</span>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-8 flex flex-col items-center text-center">
            <span className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3"><FileDown className="h-6 w-6 text-slate-400" /></span>
            <p className="text-[14px] font-semibold text-slate-700">No documents found</p>
            <p className="text-[12.5px] text-slate-500 mt-0.5">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(d => {
              const { Icon, tint, fg } = CATEGORY_STYLE[d.category]
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                  <span className={cn("h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0", tint)}>
                    <Icon className={cn("h-5.5 w-5.5", fg)} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">{d.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[12px] text-slate-500">
                      <span className={cn("font-semibold px-2 py-0.5 rounded-full", tint, fg)}>{d.category}</span>
                      <span>{formatDate(d.date)}</span>
                      <span className="text-slate-300">·</span>
                      <span>{d.size}</span>
                      {d.amount && (<><span className="text-slate-300">·</span><span className="font-semibold text-slate-700">{d.amount}</span></>)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => shareDoc(d.name)}
                      aria-label={`Share ${d.name}`}
                      className="h-9 w-9 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center hover:text-slate-700 hover:border-slate-300 active:scale-95 transition cursor-pointer"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => downloadDoc(d)}
                      aria-label={`Download ${d.name}`}
                      className="h-9 px-3 rounded-xl bg-[var(--color-primary)] text-white text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[var(--color-primary-dark)] active:scale-95 transition cursor-pointer"
                    >
                      <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-2 text-[12.5px] text-slate-500">
        <ShieldCheck className="h-4 w-4 text-slate-400" /> All documents are stored securely and signed with your patient ID. Shared links expire after 24 hours.
      </div>
    </div>
  )
}
