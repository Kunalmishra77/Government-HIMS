"use client"

import { Select } from "@/components/ui/Select"
import { useShiftStore, SHIFT_WINDOWS, WARDS, ALL_WARDS } from "@/store/useShiftStore"
import { Sun, Clock, MapPin, Layers } from "lucide-react"

// Compact ward switcher — reused across nurse pages so every view scopes to the
// same active ward.
export function WardSwitcher() {
  const activeWard = useShiftStore(s => s.activeWard)
  const setActiveWard = useShiftStore(s => s.setActiveWard)
  return (
    <div className="flex items-center gap-1.5">
      <Layers className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      <label htmlFor="ward-switcher" className="sr-only">Active ward</label>
      <Select id="ward-switcher" value={activeWard} onChange={e => setActiveWard(e.target.value)}
        className="h-9 px-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer">
        {[...WARDS, ALL_WARDS].map(w => <option key={w} value={w}>{w}</option>)}
      </Select>
    </div>
  )
}

// Shift header — who's on, which shift/window, assigned ward, responsibilities.
export function ShiftBanner() {
  const a = useShiftStore(s => s.myAssignment())
  const activeWard = useShiftStore(s => s.activeWard)
  if (!a) return null
  const coveringOther = activeWard !== a.ward && activeWard !== ALL_WARDS
  return (
    <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#0D2032,#16324A)", boxShadow: "0 8px 24px rgba(13,32,50,0.28)" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sun className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-bold">{a.shift} shift</span>
            <span className="text-white/70 text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {SHIFT_WINDOWS[a.shift]}</span>
            <span className="text-white/70 text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Assigned: {a.ward}</span>
          </div>
          <p className="text-lg font-bold mt-1">{a.nurseName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {a.responsibilities.map(r => (
              <span key={r} className="text-[11px] font-semibold bg-white/15 rounded-full px-2 py-0.5">{r}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[11px] font-semibold text-white/70">Viewing ward</span>
          <WardSwitcher />
          {coveringOther && <span className="text-[10px] font-semibold bg-white/20 rounded-full px-2 py-0.5">Cross-covering {activeWard}</span>}
        </div>
      </div>
    </div>
  )
}
