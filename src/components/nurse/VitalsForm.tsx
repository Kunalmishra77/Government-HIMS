"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { X, HeartPulse } from "lucide-react"
import { useVitalsDraft } from "./useVitalsDraft"
import { VitalsFields, VitalsAiPanel } from "./VitalsFields"
import { VitalsHistory } from "./VitalsHistory"
import type { VitalsRecord } from "@/store/useInpatientStore"

export function VitalsForm({ title, subtitle, priorRecords = [], history = [], onClose, onSave }: {
  title: string
  subtitle?: string
  priorRecords?: VitalsRecord[]   // oldest→newest, used to carry forward stable values
  history?: VitalsRecord[]        // full prior-visit history to display alongside entry
  onClose: () => void
  onSave: (rec: Omit<VitalsRecord, "id" | "at">) => void
}) {
  const api = useVitalsDraft(priorRecords)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!api.anyEntered) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 250))
    onSave(api.draft)
    setSaving(false)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="vitals-modal-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
              <HeartPulse className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 id="vitals-modal-title" className="text-base font-bold text-slate-900">Record Vitals</h2>
              <p className="text-sm text-slate-500 font-medium">{title}{subtitle ? ` · ${subtitle}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5">
          <div className="space-y-5">
            <VitalsFields api={api} />
            <VitalsAiPanel news={api.news} anomalies={api.anomalies} />
          </div>
          <div className="lg:border-l lg:border-slate-100 lg:pl-5">
            <VitalsHistory records={history} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !api.anyEntered}
            className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50">
            {saving ? "Saving…" : "Save Vitals"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
