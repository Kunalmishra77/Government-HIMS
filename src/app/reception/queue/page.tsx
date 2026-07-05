"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Maximize2, Minimize2, Clock, Users, Volume2, DoorOpen } from "lucide-react"
import { useTranslations } from "next-intl"
import { usePatientStore, type Patient } from "@/store/usePatientStore"
import { OPD_ROOMS, OPD_DEPARTMENTS, doctorsForDept } from "@/lib/opd"
import { cn } from "@/lib/utils"
import { deriveUhid } from "@/lib/uhid"

const TRIAGE_GRADIENTS: Record<string, string> = {
  Critical: "linear-gradient(135deg,#DC2626,#B91C1C)",
  High: "linear-gradient(135deg,#EA580C,#DC2626)",
  Medium: "linear-gradient(135deg,#D97706,#B45309)",
  Low: "linear-gradient(135deg,#16A34A,var(--color-primary-dark))",
}
const TRIAGE_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }

function RoomCard({ doctor, room, department, patients }: { doctor: string; room: string; department: string; patients: Patient[] }) {
  const t = useTranslations('reception')
  const mine = patients.filter(p => p.doctor === doctor)
  const nowServing = mine.find(p => p.queueStatus === "consulting")
  const waiting = mine.filter(p => ["waiting", "vitals"].includes(p.queueStatus))
    .sort((a, b) => (TRIAGE_RANK[a.triageLevel ?? "Low"] - TRIAGE_RANK[b.triageLevel ?? "Low"]) || a.token - b.token)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: nowServing ? "linear-gradient(135deg,#1E1B4B,#312E81)" : "#F8FAFC" }}>
        <div className="min-w-0">
          <p className={cn("text-sm font-bold truncate", nowServing ? "text-white" : "text-slate-700")}>{room} · {doctor}</p>
          <p className={cn("text-[11px] truncate", nowServing ? "text-white/60" : "text-slate-400")}>{department}</p>
        </div>
        <DoorOpen className={cn("h-4 w-4 flex-shrink-0", nowServing ? "text-white/70" : "text-slate-300")} />
      </div>

      <div className="p-4">
        {nowServing ? (
          <div className="flex items-center gap-3 mb-3">
            <div className="h-14 w-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 text-white" style={{ background: TRIAGE_GRADIENTS[nowServing.triageLevel ?? "Low"] }}>
              <span className="text-[8px] font-bold uppercase opacity-80">{t('queue.token')}</span>
              <span className="text-xl font-black leading-none">{nowServing.token}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[rgba(8,145,178,0.07)]0 animate-pulse" /> {t('queue.nowServing')}</p>
              <p className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">{nowServing.name}<span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5">{nowServing.uhid ?? deriveUhid(nowServing.id)}</span></p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-3"><Volume2 className="h-4 w-4" /> {t('queue.availableCallingNext')}</div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-500">{t('queue.waitingCount', { count: waiting.length })}</span>
          <div className="flex items-center gap-1">
            {waiting.slice(0, 4).map(p => (
              <span key={p.id} className="h-6 min-w-6 px-1 rounded-lg text-[11px] font-bold text-white flex items-center justify-center" style={{ background: TRIAGE_GRADIENTS[p.triageLevel ?? "Low"] }}>{p.token}</span>
            ))}
            {waiting.length > 4 && <span className="text-[11px] text-slate-400">+{waiting.length - 4}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function QueueBoardPage() {
  const t = useTranslations('reception')
  const { patients } = usePatientStore()
  const [kioskMode, setKioskMode] = useState(false)
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const todayISO = new Date().toISOString().slice(0, 10)
  const todays = patients.filter(p => (p.registeredDate ?? todayISO) === todayISO)
  const openRooms = OPD_ROOMS.filter(r => todays.some(p => p.doctor === r.doctor && p.queueStatus === "consulting")).length
  const waitingCount = todays.filter(p => ["waiting", "vitals"].includes(p.queueStatus)).length
  const activeDepts = OPD_DEPARTMENTS.filter(d => doctorsForDept(d).some(r => todays.some(p => p.doctor === r.doctor && ["waiting", "vitals", "consulting"].includes(p.queueStatus))))

  return (
    <div className={cn("min-h-full transition-all", kioskMode ? "p-8" : "space-y-5")}>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: "#16A34A", boxShadow: "0 0 8px rgba(22,163,74,0.6)" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#16A34A" }}>{t('queue.liveBoard', { rooms: OPD_ROOMS.length })}</span>
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">{t('queue.opdDisplay')}</h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              <Clock className="h-4 w-4 text-[#94A3B8]" />
              <span className="text-base font-bold font-mono tracking-widest text-[#0F172A]">{time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
            <button onClick={() => setKioskMode(k => !k)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer bg-white text-[#64748B]" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              {kioskMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />} {kioskMode ? t('queue.exitKiosk') : t('queue.kioskMode')}
            </button>
          </div>
        </motion.div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: DoorOpen, label: t('queue.opdsConsulting'), value: t('queue.roomsValue', { open: openRooms, total: OPD_ROOMS.length }), gradient: "linear-gradient(135deg,var(--color-primary),var(--color-primary))" },
            { icon: Users, label: t('queue.waitingAcrossOpds'), value: t('queue.patientsValue', { count: waitingCount }), gradient: "linear-gradient(135deg,#F59E0B,#EA580C)" },
            { icon: Volume2, label: t('queue.departmentsActive'), value: `${activeDepts.length}`, gradient: "linear-gradient(135deg,var(--color-primary),var(--color-primary))" },
          ].map(({ icon: Icon, label, value, gradient }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white" style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)" }}>
              <div className="h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: gradient }}><Icon className="h-6 w-6 text-white" /></div>
              <div className="min-w-0"><p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">{label}</p><p className="text-lg font-bold text-[#0F172A] tracking-tight truncate mt-1">{value}</p></div>
            </motion.div>
          ))}
        </div>

        {/* Per-department room grids */}
        {OPD_DEPARTMENTS.map(dept => (
          <div key={dept}>
            <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">{dept}<span className="text-[11px] font-medium text-slate-400">{t(doctorsForDept(dept).length > 1 ? 'queue.opdCountPlural' : 'queue.opdCount', { count: doctorsForDept(dept).length })}</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctorsForDept(dept).map(r => <RoomCard key={r.doctor} doctor={r.doctor} room={r.room} department={r.department} patients={todays} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
