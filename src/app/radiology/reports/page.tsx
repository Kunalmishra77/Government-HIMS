"use client"

import { useEffect, useMemo, useState } from "react"
import {
  FileText, Printer, BadgeCheck, Stethoscope, Building2, Clock, Search,
  ScanLine, AlertTriangle, CheckCircle2,
} from "lucide-react"
import { useRadiologyStudiesStore, type RadiologyStudy } from "@/store/useRadiologyStudiesStore"
import { openRadiologyReport } from "@/lib/radiologyReport"
import { PRIORITY_META, type Priority } from "@/lib/radiologyCatalog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const fmt = (iso?: string) => iso
  ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—'

const REPORTED: RadiologyStudy['status'][] = ['reported', 'verified', 'released']

export default function RadiologyReportsPage() {
  const studies = useRadiologyStudiesStore(s => s.studies)
  const [query, setQuery] = useState('')

  useEffect(() => {
    useRadiologyStudiesStore.persist.rehydrate()
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agentix-radiologystudiesstore' && e.newValue) useRadiologyStudiesStore.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const reports = useMemo(() => studies
    .filter(s => REPORTED.includes(s.status))
    .sort((a, b) => new Date(b.reportedAt ?? b.releasedAt ?? 0).getTime() - new Date(a.reportedAt ?? a.releasedAt ?? 0).getTime()),
    [studies])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return reports
    return reports.filter(s =>
      s.patientName.toLowerCase().includes(q) || s.uhid.toLowerCase().includes(q)
      || s.doctorName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
  }, [reports, query])

  const print = (s: RadiologyStudy) => {
    if (!openRadiologyReport(s)) toast.error('Pop-up blocked — allow pop-ups to print the report')
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="h-8 w-8 rounded-xl bg-primary-soft text-accent flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </span>
            Radiology Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">Finalised imaging reports — print-ready with key images and signature</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, UHID, scan…"
            className="h-9 w-64 max-w-full pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </div>

      <div className="space-y-3">
        {shown.map(s => {
          const prio = PRIORITY_META[s.priority as Priority]
          const critical = /\b(haemorrhage|hemorrhage|bleed|pneumothorax|embolism|stroke|infarct|bi-?rads (4|5|6))\b/i
            .test(s.reportSections['impression'] ?? '')
          const finalised = s.status === 'released' || s.status === 'verified'
          return (
            <div key={s.id} className={cn(
              "rounded-xl bg-white border p-4 flex items-start gap-3 flex-wrap transition-shadow hover:shadow-sm",
              critical ? "border-red-200 ring-1 ring-red-100" : "border-slate-200"
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-bold text-slate-900">{s.patientName}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                    <BadgeCheck className="h-3.5 w-3.5" /> {s.uhid}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-border bg-surface-sunken text-accent">{s.source}</span>
                  {critical && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" />Critical</span>}
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                    finalised ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {finalised ? <><CheckCircle2 className="h-2.5 w-2.5" />Final</> : 'Provisional'}
                  </span>
                </div>
                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[12px] text-slate-500 mt-1.5">
                  <span className="flex items-center gap-1"><ScanLine className="h-3.5 w-3.5 text-slate-400" />{s.name}</span>
                  <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 text-slate-400" />{s.doctorName}</span>
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-slate-400" />{s.department}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" />Reported {fmt(s.reportedAt ?? s.releasedAt)}</span>
                </div>
                {s.reportSections['impression'] && (
                  <p className="text-[12px] text-slate-600 mt-2 line-clamp-2"><span className="font-bold text-slate-500">Impression: </span>{s.reportSections['impression']}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <button
                  onClick={() => print(s)}
                  className="h-9 px-4 rounded-lg font-bold text-[13px] text-white bg-gradient-to-br from-primary to-primary-dark flex items-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> View / Print report
                </button>
                <span className="text-[11px] text-slate-400 font-medium">Report {s.id}-RPT</span>
              </div>
            </div>
          )
        })}

        {shown.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 flex flex-col items-center justify-center gap-3">
            <span className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-slate-300" />
            </span>
            <p className="text-sm font-semibold text-slate-400">
              {query ? 'No matching reports' : 'No reports yet — finalise a study in the Reading Room'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
