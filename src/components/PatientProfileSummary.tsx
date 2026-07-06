"use client"

import { usePatientProfileStore } from "@/store/usePatientProfileStore"
import { ShieldAlert, Droplet, HeartPulse, Phone, Pill, UserCheck } from "lucide-react"

// Read-only summary of the nurse-completed clinical profile, surfaced in the
// doctor's consult (and reusable elsewhere). Allergies lead, for safety.
export function PatientProfileSummary({ patientId }: { patientId: string }) {
  const profile = usePatientProfileStore(s => s.profiles[patientId])

  if (!profile?.completedAt) {
    return (
      <div className="p-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-[12.5px] text-slate-400 flex items-center gap-2">
        <UserCheck className="h-4 w-4" /> Patient profile pending — completed by nursing at the first vitals check.
      </div>
    )
  }
  const p = profile
  const Row = ({ icon: Icon, tint, label, value, danger }: { icon: React.ElementType; tint: string; label: string; value: string; danger?: boolean }) => (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${tint}`} />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-[13px] font-semibold ${danger ? "text-red-600" : "text-slate-800"}`}>{value || "—"}</p>
      </div>
    </div>
  )

  return (
    <div className="p-5 rounded-2xl bg-white" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Patient profile</h3>
        <span className="text-[10.5px] text-slate-400">by {p.completedBy}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Row icon={ShieldAlert} tint="text-red-500" label="Allergies" danger={!p.noKnownAllergies && p.allergies.length > 0} value={p.noKnownAllergies ? "No known allergies" : p.allergies.join(", ")} />
        <Row icon={HeartPulse} tint="text-[var(--color-accent)]" label="Conditions" value={p.chronicConditions.join(", ")} />
        <Row icon={Droplet} tint="text-red-500" label="Blood group" value={p.bloodGroup ?? ""} />
        <Row icon={Pill} tint="text-[var(--color-accent)]" label="Current meds" value={p.currentMedications.join(", ")} />
        <Row icon={Phone} tint="text-slate-400" label="Emergency" value={p.emergencyName ? `${p.emergencyName}${p.emergencyRelation ? ` (${p.emergencyRelation})` : ""} · ${p.emergencyPhone ?? ""}` : ""} />
        <Row icon={UserCheck} tint="text-slate-400" label="Lifestyle" value={[p.smoking && `Smoking: ${p.smoking}`, p.alcohol && `Alcohol: ${p.alcohol}`].filter(Boolean).join(" · ")} />
      </div>
    </div>
  )
}
