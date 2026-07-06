"use client"

import { AlertTriangle, Lock } from "lucide-react"
import { useNarcoticsStore } from "@/store/useNarcoticsStore"
import { useTranslations } from "next-intl"

export default function NarcoticsLog() {
  const t = useTranslations("pharmacy")
  const NARCOTICS_LOG = useNarcoticsStore(s => s.log)
  const columns = [
    t("narcotics.columns.dateTime"), t("narcotics.columns.drug"), t("narcotics.columns.batch"),
    t("narcotics.columns.patient"), t("narcotics.columns.dose"), t("narcotics.columns.prescriber"),
    t("narcotics.columns.dispenser"), t("narcotics.columns.secondSign"), t("narcotics.columns.stock"),
  ]
  return (
    <div className="space-y-6 pt-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t("narcotics.title")}</h2>
        <p className="text-slate-500 text-sm mt-1">{t("narcotics.subtitle")}</p>
      </div>

      <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
        <Lock className="h-5 w-5 flex-shrink-0" />
        <p><span className="font-bold">{t("narcotics.controlledLabel")}</span> {t("narcotics.controlledDetail")}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{columns.map((h) => (
              <th key={h} scope="col" className="text-left px-3 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {NARCOTICS_LOG.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{entry.date} {entry.time}</td>
                <td className="px-3 py-3 font-bold text-red-700">{entry.drug}</td>
                <td className="px-3 py-3 text-xs font-mono text-slate-500">{entry.batchNo}</td>
                <td className="px-3 py-3 font-semibold">{entry.patient}</td>
                <td className="px-3 py-3">{entry.dose}</td>
                <td className="px-3 py-3 text-xs">{entry.prescriber}</td>
                <td className="px-3 py-3 text-xs">{entry.dispenser}</td>
                <td className="px-3 py-3 text-xs text-green-700 font-semibold">✅ {entry.secondSignatory}</td>
                <td className="px-3 py-3 font-bold">{entry.runningStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {t("narcotics.footer")}
      </div>
    </div>
  )
}
