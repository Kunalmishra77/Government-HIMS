"use client"

import { motion } from "framer-motion"
import { X, HeartPulse } from "lucide-react"
import { VitalsHistory } from "./VitalsHistory"
import type { VitalsRecord } from "@/store/useInpatientStore"

/** Read-only modal to review a patient's recorded OPD vitals (Done tab). */
export function VitalsHistoryModal({ title, subtitle, records, onClose }: {
  title: string
  subtitle?: string
  records: VitalsRecord[]
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="vitals-history-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
              <HeartPulse className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 id="vitals-history-title" className="text-base font-bold text-slate-900">Recorded vitals</h2>
              <p className="text-sm text-slate-500 font-medium">{title}{subtitle ? ` · ${subtitle}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          <VitalsHistory records={records} />
        </div>
      </motion.div>
    </motion.div>
  )
}
