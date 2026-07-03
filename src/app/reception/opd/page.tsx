"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight, UserPlus, CheckCircle2, Volume2, Clock,
  Activity, Ambulance, ShieldCheck, Fingerprint, BadgeCheck, AlertTriangle,
} from "lucide-react"
import { usePatientStore, type Patient, type QueueStatus, type TriageLevel } from "@/store/usePatientStore"
import { computeQueueEta } from "@/lib/queueEta"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/Select"
import { SideDrawer } from "@/components/ui/SideDrawer"
import { DataTablePro, type ProColumn } from "@/components/ui/DataTablePro"
import { StatusPill, type Status } from "@/components/ui/StatusPill"
import { PatientAvatar } from "@/components/ui/PatientAvatar"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { AadhaarAbhaFlow, type AadhaarAbhaResult } from "@/components/reception/AadhaarAbhaFlow"

const STATUS_TOKEN: Record<QueueStatus, Status> = {
  waiting: 'pending', vitals: 'caution', consulting: 'info', pharmacy: 'info', billing: 'neutral', done: 'done',
}
const opdTriageToken = (lvl?: TriageLevel): Status =>
  lvl === 'Critical' ? 'critical' : lvl === 'High' ? 'urgent' : lvl === 'Medium' ? 'caution' : 'stable'

const NEXT_STATUS: Partial<Record<QueueStatus, QueueStatus>> = {
  waiting: 'vitals', vitals: 'consulting', consulting: 'pharmacy', pharmacy: 'billing', billing: 'done',
}
const NEXT_KEY: Partial<Record<QueueStatus, string>> = {
  waiting: 'nextSendToVitals', vitals: 'nextSendToDoctor', consulting: 'nextSendToPharmacy',
  pharmacy: 'nextSendToBilling', billing: 'nextMarkDone',
}

const STATUS_PILL: Record<QueueStatus, { key: string; cls: string }> = {
  waiting:    { key: 'statusWaiting',    cls: 'bg-slate-100 text-slate-600' },
  vitals:     { key: 'statusInVitals',  cls: 'bg-amber-100 text-amber-700' },
  consulting: { key: 'statusConsulting', cls: 'bg-surface-sunken text-accent' },
  pharmacy:   { key: 'statusPharmacy',   cls: 'bg-green-100 text-green-700' },
  billing:    { key: 'statusBilling',   cls: 'bg-amber-100 text-amber-700' },
  done:       { key: 'statusCompleted',  cls: 'bg-green-100 text-green-700' },
}

const SOURCE_META: Record<NonNullable<ReturnType<typeof sourceOf>>, { key: string; cls: string }> = {
  walk_in:     { key: 'sourceWalkIn',     cls: 'bg-slate-100 text-slate-600' },
  online:      { key: 'sourceOnline', cls: 'bg-[rgba(238,107,38,0.10)] text-[var(--color-primary-dark)]' },
  appointment: { key: 'sourceAppointment', cls: 'bg-accent-soft text-accent' },
}
function sourceOf(s?: 'walk_in' | 'online' | 'appointment') { return s ?? 'walk_in' }

const TRIAGE_RANK: Record<TriageLevel, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }

const STATUS_FILTERS = ['All', 'Waiting', 'Needs Aadhaar', 'In Vitals', 'In Care', 'Done'] as const
type StatusFilter = typeof STATUS_FILTERS[number]
const FILTER_KEY: Record<StatusFilter, string> = {
  'All': 'filterAll', 'Waiting': 'filterWaiting', 'Needs Aadhaar': 'filterNeedsAadhaar',
  'In Vitals': 'filterInVitals', 'In Care': 'filterInCare', 'Done': 'filterDone',
}
function matchesStatusFilter(status: QueueStatus, hasUhid: boolean, filter: StatusFilter): boolean {
  switch (filter) {
    case 'All':           return true
    case 'Waiting':       return status === 'waiting'
    case 'Needs Aadhaar': return status === 'waiting' && !hasUhid
    case 'In Vitals':     return status === 'vitals'
    case 'In Care':       return status === 'consulting' || status === 'pharmacy' || status === 'billing'
    case 'Done':          return status === 'done'
  }
}

export default function OpdQueuePage() {
  const t = useTranslations('reception')
  const router = useRouter()
  const { patients, updateStatus, sendToEmergency, linkPatientIdentity } = usePatientStore()
  const [filterTriage, setFilterTriage] = useState<string>("All")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All")
  const [cleared, setCleared] = useState<string[]>([])

  // Aadhaar-verification drawer for online patients lacking a hospital identity.
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [verifiedDone, setVerifiedDone] = useState(false)
  const verifyingPatient = patients.find(p => p.id === verifyingId)

  const todayISO = new Date().toISOString().slice(0, 10)

  const base = patients.filter(p => {
    const matchToday = (p.registeredDate ?? todayISO) === todayISO
    const matchTriage = filterTriage === 'All' || p.triageLevel === filterTriage
    const notCleared = !(p.queueStatus === 'done' && cleared.includes(p.id))
    return matchToday && matchTriage && notCleared
  })

  const rows = base
    .filter(p => matchesStatusFilter(p.queueStatus, !!p.uhid, statusFilter))
    .sort((a, b) => (TRIAGE_RANK[a.triageLevel ?? 'Low'] - TRIAGE_RANK[b.triageLevel ?? 'Low']) || a.token - b.token)

  const countFor = (f: StatusFilter) => base.filter(p => matchesStatusFilter(p.queueStatus, !!p.uhid, f)).length

  const handleAdvance = (id: string, currentStatus: QueueStatus) => {
    const next = NEXT_STATUS[currentStatus]
    if (!next) return
    updateStatus(id, next)
    toast.success(t('opd.movedToast', { status: t(`opd.${STATUS_PILL[next].key}`) }))
  }

  const announce = (token: number, name: string, room?: string) => {
    const msg = t('opd.announceMsg', { token, name, room: room ? t('opd.announceToScope', { room }) : '' })
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg))
      }
    } catch { /* speech optional */ }
    toast.success(t('opd.announcedToast', { token }), { description: name })
  }

  const escalate = (id: string, name: string, triageLevel?: TriageLevel) => {
    sendToEmergency(id)
    notifyAndAuditMany(['emergency', 'doctor', 'bed_manager'], {
      type: 'system', priority: 'critical',
      title: t('opd.emergencyTitle', { name }),
      body: t('opd.emergencyBody', { name, triage: triageLevel ?? 'High' }),
      patientName: name,
      audit: { action: 'reception_emergency_escalation', resource: 'patient', resourceId: id, detail: `Patient ${name} escalated to Emergency from reception`, userName: 'Reception' },
    })
    toast.error(t('opd.sentToEmergencyToast', { name }), { description: t('opd.acuityDesc', { triage: triageLevel ?? 'Low' }) })
  }

  const openVerify = (id: string) => { setVerifyingId(id); setVerifiedDone(false) }
  const closeVerify = () => { setVerifyingId(null); setVerifiedDone(false) }
  const handleVerified = (r: AadhaarAbhaResult) => {
    if (!verifyingId) return
    linkPatientIdentity(verifyingId, { uhid: r.uhid, abhaId: r.abhaId, aadhaarVerified: true })
    setVerifiedDone(true)
    toast.success(t('opd.identityLinkedToast'), { description: t('opd.identityLinkedDesc', { uhid: r.uhid }) })
  }

  const chips: { label: string; onRemove?: () => void }[] = []
  if (statusFilter !== 'All') chips.push({ label: t(`opd.${FILTER_KEY[statusFilter]}`), onRemove: () => setStatusFilter('All') })
  if (filterTriage !== 'All') chips.push({ label: t('opd.acuityChip', { level: filterTriage }), onRemove: () => setFilterTriage('All') })
  const clearAll = () => { setStatusFilter('All'); setFilterTriage('All') }

  const columns: ProColumn<Patient>[] = [
    { key: 'token', label: t('opd.colToken'), sortable: true, sortAccessor: p => p.token, render: p => <span className="tabular-nums font-bold">#{p.token}</span> },
    {
      key: 'name', label: t('opd.colPatient'), primary: true, sortable: true, lockedVisible: true,
      render: p => (
        <div className="flex items-center gap-3 min-w-0">
          <PatientAvatar name={p.name} photoUrl={p.photoUrl} size="sm" />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate flex items-center gap-1">
              {p.name}{p.phoneVerified && <ShieldCheck className="h-3 w-3 text-emerald-500" aria-label={t('opd.mobileVerified')} />}
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", SOURCE_META[sourceOf(p.source)].cls)}>{t(`opd.${SOURCE_META[sourceOf(p.source)].key}`)}</span>
            </p>
            <p className="t-caption text-foreground-lighter truncate">{p.department} · {p.age}y{p.symptoms.length > 0 ? ` · ${p.symptoms[0]}` : ''}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'identity', label: t('opd.colIdentity'),
      render: p => p.uhid
        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1"><BadgeCheck className="h-3.5 w-3.5" /> {p.uhid}</span>
        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"><AlertTriangle className="h-3.5 w-3.5" /> {t('opd.needsAadhaar')}</span>,
    },
    { key: 'triageLevel', label: t('opd.colAcuity'), sortable: true, sortAccessor: p => TRIAGE_RANK[p.triageLevel ?? 'Low'], render: p => p.triageLevel ? <StatusPill status={opdTriageToken(p.triageLevel)} label={p.triageLevel} dense /> : <span className="text-foreground-placeholder">—</span> },
    { key: 'queueStatus', label: t('opd.colStatus'), sortable: true, render: p => <StatusPill status={STATUS_TOKEN[p.queueStatus]} label={t(`opd.${STATUS_PILL[p.queueStatus].key}`)} dense /> },
    {
      key: 'wait', label: t('opd.colWait'), hideOnMobile: true,
      render: p => {
        const eta = computeQueueEta(p, patients)
        return (
          <div className="text-[11px] text-foreground-lighter leading-tight">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.registeredAt}</span>
            {p.queueStatus === 'waiting' && (eta.nextUp ? <span className="text-green-600 font-semibold">{t('opd.nextUp')}</span> : <span>{t('opd.etaAhead', { eta: eta.etaMin, ahead: eta.positionAhead })}</span>)}
            {p.vitals && <span className="flex items-center gap-1 text-green-600 font-semibold"><Activity className="h-3 w-3" /> {t('opd.vitalsDone')}</span>}
          </div>
        )
      },
    },
    {
      key: 'actions', label: '', align: 'right', lockedVisible: true,
      render: p => {
        const isWaiting = p.queueStatus === 'waiting'
        const hasUhid = !!p.uhid
        const canAnnounce = ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)
        const nextKey = NEXT_KEY[p.queueStatus]
        const nextLabel = nextKey ? t(`opd.${nextKey}`) : undefined
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
            {isWaiting && !hasUhid ? (
              <Button onClick={() => openVerify(p.id)} className="h-8 px-3 rounded-lg gap-1.5 text-[11.5px] bg-amber-500 hover:bg-amber-600 text-white"><Fingerprint className="h-3.5 w-3.5" /> {t('opd.aadhaar')}</Button>
            ) : isWaiting && hasUhid ? (
              <Button onClick={() => handleAdvance(p.id, 'waiting')} className="h-8 px-3 rounded-lg gap-1.5 text-[11.5px]"><Activity className="h-3.5 w-3.5" /> {t('opd.vitals')}</Button>
            ) : nextLabel ? (
              <button onClick={() => handleAdvance(p.id, p.queueStatus)} aria-label={nextLabel}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] transition-colors cursor-pointer px-2"><ArrowRight className="h-3.5 w-3.5" /> {nextLabel}</button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-green-600 px-2"><CheckCircle2 className="h-3.5 w-3.5" /> {t('opd.complete')}</span>
            )}
            {canAnnounce && (
              <button onClick={() => announce(p.token, p.name, p.queueStatus === 'consulting' ? t('opd.consultation') : undefined)}
                aria-label={t('opd.announceTokenAria', { token: p.token })} title={t('opd.announceTitle')}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.10)] transition cursor-pointer"><Volume2 className="h-4 w-4" /></button>
            )}
            {canAnnounce && (
              <button onClick={() => escalate(p.id, p.name, p.triageLevel)}
                aria-label={t('opd.sendToEmergencyAria', { name: p.name })} title={t('opd.sendToEmergencyTitle')}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-red-500 hover:text-white hover:bg-red-500 transition cursor-pointer"><Ambulance className="h-4 w-4" /></button>
            )}
            {p.queueStatus === 'done' && (
              <button onClick={() => setCleared(c => [...c, p.id])} className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition cursor-pointer px-1">{t('opd.clear')}</button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('opd.pageTitle')}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{t('opd.pageSubtitle')}</p>
        </div>
        <Button onClick={() => router.push('/reception/register')} size="lg"
          className="h-10 px-5 gap-2 font-bold shadow-sm hover:shadow-md transition-all rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white cursor-pointer">
          <UserPlus className="h-4 w-4" aria-hidden="true" /> {t('opd.registerWalkIn')}
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {STATUS_FILTERS.map(f => {
          const n = countFor(f)
          return (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn(
                "flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border",
                statusFilter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
                f === 'Needs Aadhaar' && statusFilter !== f && n > 0 && "border-amber-300 text-amber-700 bg-amber-50"
              )}>
              {f === 'Needs Aadhaar' && <Fingerprint className="h-3.5 w-3.5" />}
              {t(`opd.${FILTER_KEY[f]}`)}
              <span className={cn("text-[10.5px] font-bold px-1.5 py-0.5 rounded-full", statusFilter === f ? "bg-white/20" : "bg-slate-100 text-slate-500")}>{n}</span>
            </button>
          )
        })}
      </div>

      <DataTablePro
        title={t('opd.tableTitle')}
        itemNoun={t('opd.itemNoun')}
        columns={columns}
        data={rows}
        keyField="id"
        searchKeys={['name', 'id']}
        searchPlaceholder={t('opd.searchPlaceholder')}
        filterChips={chips}
        onClearFilters={chips.length ? clearAll : undefined}
        toolbarLeft={
          <Select value={filterTriage} onChange={e => setFilterTriage(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20">
            {['All', 'Critical', 'High', 'Medium', 'Low'].map(lvl => <option key={lvl} value={lvl}>{lvl === 'All' ? t('opd.allAcuity') : lvl}</option>)}
          </Select>
        }
        emptyState={<span className="t-body text-foreground-placeholder">{t('opd.emptyState')}</span>}
      />

      {/* Aadhaar verification drawer */}
      <SideDrawer
        open={!!verifyingId}
        onClose={closeVerify}
        title={t('opd.verifyDrawerTitle')}
        description={verifyingPatient ? t('opd.verifyDrawerDesc', { name: verifyingPatient.name, token: verifyingPatient.token }) : undefined}
        icon={Fingerprint}
        width="md"
        footer={verifiedDone ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={closeVerify} className="flex-1 rounded-xl">{t('common.done')}</Button>
            <Button onClick={() => { if (verifyingId) updateStatus(verifyingId, 'vitals'); closeVerify() }} className="flex-1 rounded-xl gap-1.5">
              <Activity className="h-4 w-4" /> {t('common.sendToVitals')}
            </Button>
          </div>
        ) : undefined}
      >
        {verifyingId && <AadhaarAbhaFlow key={verifyingId} onComplete={handleVerified} />}
      </SideDrawer>
    </div>
  )
}
