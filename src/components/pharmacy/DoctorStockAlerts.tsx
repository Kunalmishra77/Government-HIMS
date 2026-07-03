"use client"

import { useMemo } from "react"
import { usePharmacyStore } from "@/store/usePharmacyStore"
import { PackageX, ExternalLink, CheckCircle2, ShoppingCart } from "lucide-react"
import { toast } from "sonner"

// Out-of-stock medicines this doctor prescribed. The doctor can record advice to
// buy a drug outside — written to the shared pharmacy store so the patient and
// pharmacy panels reflect it too.
export function DoctorStockAlerts({ doctorName }: { doctorName?: string }) {
  const prescriptions = usePharmacyStore(s => s.prescriptions)
  const setMedicineSupply = usePharmacyStore(s => s.setMedicineSupply)

  const alerts = useMemo(() => {
    const out: { rxId: string; patient: string; med: string; supply: string }[] = []
    prescriptions.forEach(p => {
      if (doctorName && p.doctorName !== doctorName) return
      if (p.status === "collected") return
      p.medicines.forEach(m => {
        if (m.inStock === false) out.push({ rxId: p.id, patient: p.patientName, med: m.name, supply: m.supply ?? "pharmacy" })
      })
    })
    return out
  }, [prescriptions, doctorName])

  if (alerts.length === 0) return null

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <PackageX className="h-4 w-4 text-red-600" />
        <h3 className="text-sm font-bold text-red-800">Pharmacy stock alerts</h3>
        <span className="text-[11px] text-red-500">{alerts.length} of your prescribed drug(s) not stocked</span>
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={i} className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-white px-3 py-2 ring-1 ring-red-100">
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-slate-800">{a.med}</span>
              <span className="text-slate-400"> · for {a.patient}</span>
            </div>
            {a.supply === "advised_outside" ? (
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Advised — buy outside</span>
            ) : a.supply === "order_raised" ? (
              <span className="text-[11px] font-bold text-[var(--color-accent)] flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />Pharmacy is procuring</span>
            ) : (
              <button onClick={() => { setMedicineSupply(a.rxId, a.med, "advised_outside"); toast.success(`Advised ${a.patient} to buy ${a.med} outside — recorded`) }}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg cursor-pointer"><ExternalLink className="h-3 w-3" />Advise buy outside</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
