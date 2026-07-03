"use client"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import type { Patient, QueueStatus } from "@/store/usePatientStore"

const statusConfig: Record<QueueStatus, { label: string; color: string; bg: string; border: string }> = {
  waiting:    { label: 'Waiting',    color: 'text-accent', bg: 'bg-primary-soft', border: 'border-primary/20' },
  vitals:     { label: 'Vitals',     color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]', border: 'border-[rgba(238,107,38,0.20)]' },
  consulting: { label: 'Consulting', color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]', border: 'border-[rgba(238,107,38,0.20)]' },
  pharmacy:   { label: 'Pharmacy',   color: 'text-[var(--color-accent)]', bg: 'bg-[rgba(238,107,38,0.07)]', border: 'border-[rgba(238,107,38,0.20)]' },
  billing:    { label: 'Billing',    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  done:       { label: 'Done',       color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
}

interface PatientCardProps {
  patient: Patient; onClick?: () => void; selected?: boolean; compact?: boolean; delay?: number
}

export function PatientCard({ patient, onClick, selected, compact = false, delay = 0 }: PatientCardProps) {
  const sc = statusConfig[patient.queueStatus]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border p-4 cursor-pointer transition-all duration-200 group relative overflow-hidden",
        compact && "p-3",
        selected ? "border-[var(--color-primary)] shadow-md ring-1 ring-primary/25" : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      )}
    >
      {selected && <div className="absolute top-0 bottom-0 left-0 w-1 bg-[rgba(238,107,38,0.07)]0" />}
      
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <Avatar name={patient.name} size={compact ? "sm" : "md"} className={cn(selected && "ring-2 ring-offset-2 ring-primary/25")} />
          <span className="absolute -bottom-1 -right-1 text-[9px] font-bold rounded-md px-1.5 py-0.5 bg-slate-900 text-white shadow-sm border border-white">
            #{patient.token}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={cn("font-bold truncate", compact ? "text-sm text-slate-900" : "text-base text-slate-900")}>
              {patient.name}
            </p>
            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-md flex-shrink-0 border", sc.color, sc.bg, sc.border)}>
              {sc.label}
            </span>
          </div>
          
          <p className="text-xs font-medium text-slate-500 mb-1.5">
            {patient.id} • {patient.age}y • {patient.gender} • <span className="text-slate-700">{patient.department}</span>
          </p>
          
          {!compact && (
            <div className="flex flex-wrap gap-1 mb-2">
              {patient.symptoms.slice(0, 2).map((sym, i) => (
                <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {sym}
                </span>
              ))}
              {patient.symptoms.length > 2 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                  +{patient.symptoms.length - 2} more
                </span>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              In: {patient.registeredAt}
            </span>
            {patient.estimatedWait > 0 && (
              <span className="text-[10px] font-bold text-accent bg-primary-soft px-2 py-0.5 rounded uppercase tracking-wider">
                ~{patient.estimatedWait}m wait
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
