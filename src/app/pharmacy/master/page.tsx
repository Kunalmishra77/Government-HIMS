"use client"

import { useState } from "react"
import { useDrugMasterStore } from "@/store/useDrugMasterStore"
import { Search, Pill, Sparkles, RefreshCw, Lock, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const SCHEDULE_STYLE: Record<string, string> = {
  X: "bg-red-100 text-red-700", H1: "bg-accent-soft text-accent",
  H: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]", G: "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]", OTC: "bg-green-100 text-green-700",
}

export default function DrugMaster() {
  const t = useTranslations("pharmacy")
  const drugs = useDrugMasterStore(s => s.drugs)
  const search = useDrugMasterStore(s => s.search)
  const [query, setQuery] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState(t("master.lastSyncedDefault"))

  const results = query ? search(query) : drugs

  const resync = () => {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setLastSynced(t("master.justNow"))
      toast.success(t("master.resyncDone", { count: drugs.length }))
    }, 1100)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            {t("master.title")}
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center gap-1"><Sparkles className="h-3 w-3" /> {t("master.aiGenerated")}</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">{t("master.subtitle")}</p>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"><Lock className="h-3 w-3" /> {t("master.readOnly")}</span>
      </div>

      {/* AI status banner */}
      <div className="rounded-2xl p-4 flex items-center gap-4 flex-wrap" style={{ background: "var(--color-surface-sunken)" }}>
        <div className="p-3 rounded-xl bg-white shadow-sm"><Sparkles className="h-5 w-5 text-[var(--color-accent)]" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">{t("master.maintainedByAi")}</p>
          <p className="text-xs text-slate-500">{t("master.catalogStatus", { count: drugs.length, lastSynced })}</p>
        </div>
        <button onClick={resync} disabled={syncing}
          className="flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-xl cursor-pointer disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,var(--color-primary-dark),var(--color-primary))", boxShadow: "0 2px 8px rgba(238,107,38,0.25)" }}>
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? t("master.resyncing") : t("master.resync")}
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("master.searchPlaceholder")}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/25" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {results.map((drug) => (
          <div key={drug.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900">{drug.genericName}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${SCHEDULE_STYLE[drug.schedule] ?? "bg-slate-100 text-slate-600"}`}>{t("master.schedule", { schedule: drug.schedule })}</span>
                  {drug.requiresDualSignature && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{t("master.dualSig")}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{drug.brandNames.join(", ")}</p>
                <p className="text-xs text-slate-600 mt-1 capitalize">{drug.form} · {drug.strength}{drug.atcCode && <span className="text-slate-400"> · {t("master.atc", { code: drug.atcCode })}</span>}{drug.maxDailyDoseMg && <span className="text-slate-400"> · {t("master.maxDose", { dose: drug.maxDailyDoseMg })}</span>}</p>
              </div>
              <Pill className="h-5 w-5 text-slate-300 flex-shrink-0" />
            </div>
            {drug.contraindications.length > 0 && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /><span><span className="font-bold">{t("master.contraindicated")}</span> {drug.contraindications.join(", ")}</span>
              </div>
            )}
            {drug.interactions.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <span className="font-bold">{t("master.interactions")}</span> {drug.interactions.join(", ")}
              </div>
            )}
            {drug.allergyClasses.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500"><span className="font-semibold">{t("master.class")}</span> {drug.allergyClasses.join(", ")}</p>
            )}
          </div>
        ))}
        {results.length === 0 && <p className="text-sm text-slate-400">{t("master.noMatch", { query })}</p>}
      </div>
    </div>
  )
}
