"use client"

import { useState } from "react"
import { usePatientStore, type Patient } from "@/store/usePatientStore"
import { usePatientProfileStore, type PatientProfile } from "@/store/usePatientProfileStore"
import { VitalsForm } from "@/components/nurse/VitalsForm"
import { VitalsHistoryModal } from "@/components/nurse/VitalsHistoryModal"
import { FirstVisitWizard } from "@/components/nurse/FirstVisitWizard"
import { news2FromRecord } from "@/lib/vitals"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { EmptyState } from "@/components/ui/EmptyState"
import { Avatar } from "@/components/ui/avatar"
import { DataTablePro, type ProColumn } from "@/components/ui/DataTablePro"
import { AnimatePresence } from "framer-motion"
import { HeartPulse, Clock, Stethoscope, Sparkles, CheckCircle2, UserPlus, Eye } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

const NURSE = "Anjali Desai"

const TRIAGE_RANK: Record<string, number> = { Critical: 3, High: 2, Medium: 1, Low: 0 }

// Triage acuity → clinical status token (inline, not a colour map).
const triageStatus = (t?: string): Status =>
  t === "Critical" ? "critical" : t === "High" ? "urgent" : t === "Medium" ? "caution" : "neutral"

// NEWS band → semantic token treatment (colour always sits next to the score).
const newsBandCls: Record<string, string> = {
  low: "bg-success-bg text-success-strong border-success/25",
  medium: "bg-warning-bg text-brand-amber-strong border-warning/30",
  high: "bg-danger-bg text-danger border-danger/25",
}
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

export default function VitalsRequestsPage() {
  const t = useTranslations('nurse')
  const patients = usePatientStore(s => s.patients)
  const recordOpdVitals = usePatientStore(s => s.recordOpdVitals)
  const profiles = usePatientProfileStore(s => s.profiles)
  const saveProfile = usePatientProfileStore(s => s.saveProfile)
  const [editing, setEditing] = useState<Patient | null>(null)
  const [viewing, setViewing] = useState<Patient | null>(null)
  const [tab, setTab] = useState<"new" | "done">("new")
  const profileDone = (id: string) => !!profiles[id]?.completedAt
  // A patient with prior OPD vitals is a returning patient — go straight to the
  // vitals form (with history) rather than the first-visit profile wizard.
  const isReturning = (p: Patient) => profileDone(p.id) || !!p.opdVitalsHistory?.length

  const todayISO = new Date().toISOString().slice(0, 10)

  // New = patients reception sent for vitals, auto-prioritised by acuity then arrival order.
  const queue = patients
    .filter(p => p.queueStatus === "vitals")
    .sort((a, b) => (TRIAGE_RANK[b.triageLevel ?? "Low"] - TRIAGE_RANK[a.triageLevel ?? "Low"]) || (a.token - b.token))

  // Done = today's patients whose OPD vitals have been recorded, newest first.
  const doneList = patients
    .filter(p => (p.registeredDate ?? todayISO) === todayISO && !!p.opdVitals)
    .sort((a, b) => (b.opdVitals?.at ?? "").localeCompare(a.opdVitals?.at ?? ""))

  const advanceToast = (p: Patient, rec: Parameters<typeof recordOpdVitals>[1]) => {
    const news = news2FromRecord(rec)
    if (news.band === "high") toast.error(t('vitalsRequests.highToast', { name: p.name, score: news.score }))
    else if (news.band === "medium") toast.warning(t('vitalsRequests.mediumToast', { name: p.name, score: news.score }))
    else toast.success(t('vitalsRequests.routineToast', { name: p.name, score: news.score }))
  }

  // Returning patient: just record vitals.
  const handleSave = (p: Patient, rec: Parameters<typeof recordOpdVitals>[1]) => {
    recordOpdVitals(p.id, rec)
    advanceToast(p, rec)
  }

  // First visit: save the completed profile, then record vitals (advances to consulting).
  const handleComplete = (p: Patient, data: { profile: PatientProfile; vitals: Parameters<typeof recordOpdVitals>[1] }) => {
    saveProfile(p.id, data.profile, NURSE)
    recordOpdVitals(p.id, data.vitals)
    toast.success(t('vitalsRequests.profileCompleted', { name: p.name }))
    advanceToast(p, data.vitals)
  }

  const wizardInitial = (p: Patient): Partial<PatientProfile> => ({
    payerType: p.insurer ? "Insurance" : undefined, insurer: p.insurer,
  })

  const columns: ProColumn<Patient>[] = [
    {
      key: "token", label: t('vitalsRequests.colToken'), sortable: true, sortAccessor: p => p.token,
      render: p => (
        <span className="inline-flex h-8 min-w-8 px-2 items-center justify-center rounded-lg bg-success-bg border border-success/20 font-bold text-[13px] text-success-strong tabular-nums">#{p.token}</span>
      ),
    },
    {
      key: "name", label: t('vitalsRequests.colPatient'), primary: true, sortable: true, lockedVisible: true,
      render: p => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={p.name} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{p.name}</p>
            <p className="t-caption text-foreground-lighter">{t('vitalsRequests.years', { age: p.age, gender: p.gender })}</p>
          </div>
        </div>
      ),
    },
    {
      key: "triageLevel", label: t('vitalsRequests.colAcuity'), sortable: true, sortAccessor: p => TRIAGE_RANK[p.triageLevel ?? "Low"],
      render: p => <StatusPill status={triageStatus(p.triageLevel)} label={`${p.triageLevel ?? "Low"}`} dense />,
    },
    { key: "doctor", label: t('vitalsRequests.colDoctor'), sortable: true, render: p => <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 text-foreground-lighter" />{p.doctor}</span> },
    { key: "department", label: t('vitalsRequests.colDepartment'), sortable: true },
    { key: "registeredAt", label: t('vitalsRequests.colRegistered'), hideOnMobile: true, render: p => <span className="inline-flex items-center gap-1.5 text-foreground-lighter"><Clock className="h-3.5 w-3.5" />{p.registeredAt}</span> },
    {
      key: "action", label: "", align: "right", lockedVisible: true,
      render: p => (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(p) }}
          className="u-press inline-flex items-center gap-1.5 text-[13px] font-bold text-white bg-success hover:bg-success-strong px-3.5 py-2 rounded-lg shadow-xs cursor-pointer transition-colors">
          {isReturning(p) ? <><HeartPulse className="h-4 w-4" /> {t('vitalsRequests.record')}</> : <><UserPlus className="h-4 w-4" /> {t('vitalsRequests.profileAndVitals')}</>}
        </button>
      ),
    },
  ]

  const doneColumns: ProColumn<Patient>[] = [
    {
      key: "name", label: t('vitalsRequests.colPatient'), primary: true, sortable: true, lockedVisible: true,
      render: p => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={p.name} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{p.name}</p>
            <p className="t-caption text-foreground-lighter">{t('vitalsRequests.years', { age: p.age, gender: p.gender })}</p>
          </div>
        </div>
      ),
    },
    {
      key: "triageLevel", label: t('vitalsRequests.colAcuity'), sortable: true, sortAccessor: p => TRIAGE_RANK[p.triageLevel ?? "Low"],
      render: p => <StatusPill status={triageStatus(p.triageLevel)} label={`${p.triageLevel ?? "Low"}`} dense />,
    },
    { key: "doctor", label: t('vitalsRequests.colDoctor'), sortable: true, render: p => <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5 text-foreground-lighter" />{p.doctor}</span> },
    { key: "department", label: t('vitalsRequests.colDepartment'), sortable: true, hideOnMobile: true },
    {
      key: "recorded", label: t('vitalsRequests.colRecorded'), sortable: true, sortAccessor: p => p.opdVitals?.at ?? "",
      render: p => <span className="inline-flex items-center gap-1.5 text-foreground-lighter"><Clock className="h-3.5 w-3.5" />{p.opdVitals ? fmtTime(p.opdVitals.at) : "—"}</span>,
    },
    {
      key: "news", label: t('vitalsRequests.colNews'), sortable: true, sortAccessor: p => p.opdVitals ? news2FromRecord(p.opdVitals).score : -1,
      render: p => {
        if (!p.opdVitals) return <span className="text-foreground-placeholder">—</span>
        const n = news2FromRecord(p.opdVitals)
        return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold", newsBandCls[n.band])}>NEWS {n.score}</span>
      },
    },
    {
      key: "action", label: "", align: "right", lockedVisible: true,
      render: p => (
        <button
          onClick={(e) => { e.stopPropagation(); setViewing(p) }}
          className="u-press inline-flex items-center gap-1.5 text-[13px] font-bold text-foreground-muted bg-surface-sunken hover:bg-[#EAEEF3] px-3.5 py-2 rounded-lg cursor-pointer transition-colors">
          <Eye className="h-4 w-4" /> {t('vitalsRequests.view')}
        </button>
      ),
    },
  ]

  const TABS = [
    { id: "new" as const, label: t('vitalsRequests.tabNew'), count: queue.length },
    { id: "done" as const, label: t('vitalsRequests.tabDone'), count: doneList.length },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="t-body text-foreground-lighter">{t('vitalsRequests.subtitle')}</p>
        {tab === "new" && (
          <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent-soft border border-primary/20 rounded-full px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {t('vitalsRequests.autoPrioritised', { count: queue.length })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition cursor-pointer",
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
            <span className={cn("text-[11px] font-bold px-1.5 rounded-full", tab === t.id ? "bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)]" : "bg-slate-200 text-slate-500")}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "new" ? (
        <DataTablePro
          title={t('vitalsRequests.newVitals')}
          itemNoun="patients"
          columns={columns}
          data={queue}
          keyField="id"
          onRowClick={(p) => setEditing(p)}
          searchKeys={["name", "doctor", "department"]}
          searchPlaceholder={t('vitalsRequests.searchPatientDoctor')}
          initialPageSize={10}
          emptyState={
            <EmptyState
              icon={CheckCircle2}
              title={t('vitalsRequests.noRequests')}
              description={t('vitalsRequests.noRequestsDesc')}
              size="sm"
            />
          }
        />
      ) : (
        <DataTablePro
          title={t('vitalsRequests.vitalsDoneToday')}
          itemNoun="patients"
          columns={doneColumns}
          data={doneList}
          keyField="id"
          onRowClick={(p) => setViewing(p)}
          searchKeys={["name", "doctor", "department"]}
          searchPlaceholder={t('vitalsRequests.searchPatientDoctor')}
          initialPageSize={10}
          emptyState={
            <EmptyState
              icon={HeartPulse}
              title={t('vitalsRequests.noVitalsRecorded')}
              description={t('vitalsRequests.noVitalsRecordedDesc')}
              size="sm"
            />
          }
        />
      )}

      <AnimatePresence>
        {editing && (isReturning(editing) ? (
          <VitalsForm
            title={editing.name}
            subtitle={t('vitalsRequests.tokenSubtitle', { token: editing.token, department: editing.department })}
            priorRecords={editing.opdVitalsHistory ?? (editing.opdVitals ? [editing.opdVitals] : [])}
            history={editing.opdVitalsHistory ?? (editing.opdVitals ? [editing.opdVitals] : [])}
            onClose={() => setEditing(null)}
            onSave={(rec) => handleSave(editing, rec)}
          />
        ) : (
          <FirstVisitWizard
            title={editing.name}
            subtitle={t('vitalsRequests.tokenSubtitle', { token: editing.token, department: editing.department })}
            meta={{ age: editing.age, gender: editing.gender }}
            initial={wizardInitial(editing)}
            onClose={() => setEditing(null)}
            onComplete={(data) => handleComplete(editing, data)}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {viewing && (
          <VitalsHistoryModal
            title={viewing.name}
            subtitle={t('vitalsRequests.tokenSubtitle', { token: viewing.token, department: viewing.department })}
            records={viewing.opdVitalsHistory ?? (viewing.opdVitals ? [viewing.opdVitals] : [])}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
