"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { usePatientStore } from "@/store/usePatientStore"
import { useFollowupStore } from "@/store/useFollowupStore"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { cn } from "@/lib/utils"
import {
  Pill, Calendar, Stethoscope, FileText, AlertTriangle,
  Download, CheckCircle, Salad, ClipboardList, ShieldCheck,
} from "lucide-react"

const TABS = ['Visit History', 'Discharge Summary'] as const
type Tab = typeof TABS[number]

function DischargeSummaryTab() {
  const { patients } = useFollowupStore()
  const record = patients[0]

  if (!record) {
    return (
      <div className="text-center py-16 text-slate-400">
        <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold">No discharge record found</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-slate-900">{record.diagnosis}</h3>
              <NeonBadge variant={record.riskLevel === 'High' ? 'danger' : record.riskLevel === 'Medium' ? 'warning' : 'success'}>
                {record.riskLevel} Risk
              </NeonBadge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Discharged {new Date(record.dischargedOn).toLocaleDateString('en-IN')}</span>
              <span className="flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5" />{record.attendingDoctor}</span>
            </div>
          </div>
          {record.claimDocumentsReady && (
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] text-[var(--color-accent)] text-xs font-bold border border-[rgba(238,107,38,0.20)] transition-colors cursor-pointer flex-shrink-0">
              <Download className="h-3.5 w-3.5" /> Download Claim Docs
            </button>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-700 bg-slate-50 rounded-lg px-4 py-3 leading-relaxed">
          {record.dischargeSummary}
        </p>
      </Card>

      {/* Medications */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Pill className="h-4 w-4 text-[var(--color-accent)]" />
          <h4 className="text-sm font-bold text-slate-900">Discharge Medications</h4>
        </div>
        <div className="space-y-2">
          {record.medications.map((med, i) => (
            <div key={i} className="flex items-center gap-3 bg-[rgba(238,107,38,0.07)] rounded-lg px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--color-primary-dark)]">{med.name}</p>
                <p className="text-xs text-[var(--color-accent)] mt-0.5">{med.dose} · {med.frequency} · {med.duration}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-[var(--color-primary-light)] flex-shrink-0" />
            </div>
          ))}
        </div>
      </Card>

      {/* Red Flag Symptoms */}
      <Card className="p-5 border-red-200 bg-red-50/10">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <h4 className="text-sm font-bold text-slate-900">When to Seek Immediate Care</h4>
          <span className="text-xs text-red-600 font-semibold">Call 102 / Rush to Emergency</span>
        </div>
        <div className="space-y-2">
          {record.redFlagSymptoms.map((symptom, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-red-800">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              {symptom}
            </div>
          ))}
        </div>
      </Card>

      {/* Diet & Lifestyle */}
      <Card className="p-5 border-green-200 bg-green-50/10">
        <div className="flex items-center gap-2 mb-3">
          <Salad className="h-4 w-4 text-green-600" />
          <h4 className="text-sm font-bold text-slate-900">Diet & Lifestyle Advice</h4>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{record.dietaryAdvice}</p>
      </Card>

      {/* Follow-up */}
      {record.followUpBooked && record.followUpDate && (
        <Card className="p-5 border-amber-200 bg-amber-50/20">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-bold text-slate-900">Follow-up Appointment</h4>
          </div>
          <p className="text-sm text-slate-700 mt-2">
            Scheduled with <span className="font-semibold">{record.attendingDoctor}</span> on{' '}
            <span className="font-semibold">{new Date(record.followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </p>
        </Card>
      )}

      {/* Claim documents not ready */}
      {!record.claimDocumentsReady && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Claim documents are being prepared. They will be available for download within 48 hours.
        </div>
      )}
    </div>
  )
}

export default function PatientRecords() {
  const { visits } = usePatientStore()
  const [activeTab, setActiveTab] = useState<Tab>('Visit History')
  const myVisits = visits.filter(v => v.patientId === 'PT-20392')

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">My Medical Records</h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "text-xs font-semibold px-4 py-1.5 rounded-lg transition-all cursor-pointer",
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab === 'Discharge Summary'
                ? <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{tab}</span>
                : tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'Visit History' ? (
          <motion.div key="visits" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
            {myVisits.length === 0 ? (
              <p className="text-slate-500 text-sm">No records found.</p>
            ) : (
              myVisits.map((visit, i) => (
                <motion.div
                  key={visit.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base">{visit.diagnosis}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-500"><Calendar className="h-3.5 w-3.5" />{visit.date}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-500"><Stethoscope className="h-3.5 w-3.5" />{visit.doctor}</span>
                      </div>
                    </div>
                    <Badge variant="muted">Visit #{visit.id}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 bg-slate-100 rounded-lg p-3">{visit.notes}</p>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Prescribed Medicines</p>
                    <div className="grid grid-cols-1 gap-2">
                      {visit.prescriptions.map((p, j) => (
                        <div key={j} className="flex items-center gap-3 bg-[rgba(238,107,38,0.07)] rounded-lg px-3 py-2">
                          <Pill className="h-4 w-4 text-[var(--color-accent)] flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-primary-dark)]">{p.medicine}</p>
                            <p className="text-xs text-[var(--color-accent)]">{p.dosage} · {p.duration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div key="discharge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DischargeSummaryTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
