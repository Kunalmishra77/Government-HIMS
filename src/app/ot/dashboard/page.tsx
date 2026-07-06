"use client"

import { Select } from "@/components/ui/Select"
import { useState, useEffect } from "react"
import { useOTStore, type OTProcedure } from "@/store/useOTStore"
import { Clock, CheckCircle, AlertTriangle, ChevronRight, Activity, Pill, Droplets, FlaskConical, ScanLine, Droplet, ShieldAlert, FileText, Plus, Send, ChevronDown, ChevronUp, Calendar, Stethoscope, ClipboardCheck, Heart, Wind, LogOut, ArrowRight, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { toast } from "sonner"
import { OnShiftTeam } from "@/components/clinical/OnShiftTeam"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { useAuthStore } from "@/store/useAuthStore"
import type { Role } from "@/types/roles"
import { useTranslations } from "next-intl"

const REQ_TYPE_ICONS: Record<string, React.ElementType> = {
  radiology: ScanLine, blood: Droplet, pharmacy: Pill, equipment: FlaskConical,
}
const REQ_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  dispatched: 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  received: 'bg-green-50 text-green-700 border-green-200',
}

const PREOP_TO_ROLE: Record<'radiology' | 'blood' | 'pharmacy' | 'equipment', Role> = {
  radiology: 'radiology', blood: 'blood_bank', pharmacy: 'pharmacy', equipment: 'inventory',
}

function IPDBriefPanel({ proc }: { proc: OTProcedure }) {
  const t = useTranslations('ot')
  const { addPreOpRequirement } = useOTStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const [reqType, setReqType] = useState<'radiology' | 'blood' | 'pharmacy' | 'equipment'>('pharmacy')
  const [reqDesc, setReqDesc] = useState('')
  const brief = proc.ipdBrief
  if (!brief) return null

  const vitalsAbnormal = brief.vitals.hr > 100 || brief.vitals.spo2 < 95 || brief.vitals.temp > 100

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[var(--color-accent)]" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">{t('brief.heading')}</h4>
      </div>

      {/* Vitals */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: t('brief.hr'), value: t('brief.hrUnit', { value: brief.vitals.hr }), abnormal: brief.vitals.hr > 100 },
          { label: t('brief.bp'), value: brief.vitals.bp, abnormal: false },
          { label: t('brief.temp'), value: t('brief.tempUnit', { value: brief.vitals.temp }), abnormal: brief.vitals.temp > 100 },
          { label: t('brief.spo2'), value: t('brief.spo2Unit', { value: brief.vitals.spo2 }), abnormal: brief.vitals.spo2 < 95 },
        ].map(v => (
          <div key={v.label} className="text-center py-2 px-3 rounded-xl" style={{ background: v.abnormal ? '#FEF2F2' : '#F8FAFC' }}>
            <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#94A3B8' }}>{v.label}</p>
            <p className={cn("text-sm font-bold", v.abnormal ? "text-red-600" : "text-[#0F172A]")}>{v.value}</p>
          </div>
        ))}
      </div>
      {vitalsAbnormal && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-red-700">{t('brief.abnormalVitals')}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Medications + IVs */}
        <div>
          {brief.activeMedications.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Pill className="h-3 w-3" /> {t('brief.activeMeds')}</p>
              <div className="space-y-1">
                {brief.activeMedications.map((m, i) => (
                  <p key={i} className="text-xs text-slate-600 font-medium">• {m}</p>
                ))}
              </div>
            </div>
          )}
          {brief.ivDrips.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><Droplets className="h-3 w-3" /> {t('brief.ivDrips')}</p>
              <div className="space-y-1">
                {brief.ivDrips.map((d, i) => (
                  <p key={i} className="text-xs text-[var(--color-accent)] font-medium">• {d}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pending results + allergies */}
        <div>
          {brief.allergies && (
            <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-red-700">{t('brief.allergies')}</p>
                  <p className="text-xs text-red-800">{brief.allergies}</p>
                </div>
              </div>
            </div>
          )}
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 mb-0.5">{t('brief.bloodGroup')}</p>
            <p className="text-sm font-bold text-slate-900">{brief.bloodGroup}</p>
          </div>
          {(brief.pendingLabResults.length > 0 || brief.pendingRadiology.length > 0) && (
            <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-bold text-amber-700 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {t('brief.pending')}</p>
              {[...brief.pendingLabResults, ...brief.pendingRadiology].map((item, i) => (
                <p key={i} className="text-xs text-amber-800 font-medium">• {item}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nursing note */}
      {brief.lastNursingNote && (
        <div className="p-3 rounded-xl bg-[rgba(238,107,38,0.07)] border border-primary/20">
          <p className="text-[10px] font-bold text-[var(--color-accent)] mb-1">{t('brief.lastNursingNote')}</p>
          <p className="text-xs text-[var(--color-primary-dark)] font-medium italic">"{brief.lastNursingNote}"</p>
        </div>
      )}

      {/* Pre-Op Requirements */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1"><Send className="h-3 w-3" /> {t('brief.coordinateRequirements')}</p>
        {(proc.preOpRequirements ?? []).map(req => {
          const Icon = REQ_TYPE_ICONS[req.type] ?? FlaskConical
          return (
            <div key={req.id} className="flex items-center gap-2 py-1.5 text-xs">
              <Icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <span className="flex-1 text-slate-700 font-medium">{req.description}</span>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", REQ_STATUS_COLORS[req.status])}>{t.has(`reqStatus.${req.status}`) ? t(`reqStatus.${req.status}`) : req.status}</span>
            </div>
          )
        })}
        <div className="flex gap-2 mt-2">
          <Select
            value={reqType}
            onChange={e => setReqType(e.target.value as typeof reqType)}
            className="flex-shrink-0 rounded-lg px-2 py-1.5 text-xs text-slate-700 border border-slate-200 bg-slate-50 focus:outline-none"
          >
            <option value="pharmacy">{t('reqType.pharmacy')}</option>
            <option value="blood">{t('reqType.blood')}</option>
            <option value="radiology">{t('reqType.radiology')}</option>
            <option value="equipment">{t('reqType.equipment')}</option>
          </Select>
          <input
            type="text"
            value={reqDesc}
            onChange={e => setReqDesc(e.target.value)}
            placeholder={t('brief.describeRequirement')}
            className="flex-1 rounded-lg px-3 py-1.5 text-xs border border-slate-200 bg-slate-50 focus:outline-none"
          />
          <button
            onClick={() => {
              if (!reqDesc.trim()) return
              addPreOpRequirement(proc.id, { type: reqType, description: reqDesc })
              notifyAndAudit({
                to: PREOP_TO_ROLE[reqType], type: 'system', priority: 'high',
                title: t('brief.preOpTitle', { patient: proc.patientName }),
                body: t('brief.preOpBody', { desc: reqDesc, procedure: proc.procedureName, time: proc.scheduledTime, room: proc.otRoom, surgeon: proc.surgeon }),
                patientName: proc.patientName,
                audit: { action: 'ot_clearance_set', resource: 'ot_procedure', resourceId: proc.id, detail: t('brief.preOpDetail', { type: reqType, desc: reqDesc }), userName: currentUser?.name ?? 'OT Coordinator' },
              })
              toast.success(t('brief.requirementDispatched', { type: t(`reqType.${reqType}`) }))
              setReqDesc('')
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg cursor-pointer transition-all"
            style={{ background: 'linear-gradient(135deg,var(--color-primary),var(--color-primary))' }}
          >
            <Plus className="h-3.5 w-3.5" /> {t('brief.dispatch')}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  Scheduled:     'bg-slate-100 text-slate-700 border-slate-200',
  'Pre-Op':      'bg-amber-50 text-amber-700 border-amber-200',
  'In Progress': 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  Recovery:      'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  Completed:     'bg-green-50 text-green-700 border-green-200',
}

const ROOM_COLOR: Record<string, string> = {
  Available:   'bg-green-50 border-green-200 text-green-700',
  'In Use':    'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]',
  Cleaning:    'bg-amber-50 border-amber-200 text-amber-700',
  Maintenance: 'bg-red-50 border-red-200 text-red-700',
}

const STATUS_NEXT: Partial<Record<string, string>> = {
  Scheduled: 'Pre-Op', 'Pre-Op': 'In Progress', 'In Progress': 'Recovery', Recovery: 'Completed',
}

export default function OTDashboard() {
  const t = useTranslations('ot')
  const { procedures, otRooms, updateStatus } = useOTStore()
  const currentUser = useAuthStore(s => s.currentUser)
  const [now, setNow] = useState(Date.now())
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null)

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(iv)
  }, [])

  const inProgress = procedures.filter(p => p.status === 'In Progress')
  const preOp = procedures.filter(p => p.status === 'Pre-Op')
  const scheduled = procedures.filter(p => p.status === 'Scheduled')
  const recovery = procedures.filter(p => p.status === 'Recovery')
  const completed = procedures.filter(p => p.status === 'Completed')

  // M13.8 — PAC (Pre-Anesthesia Clinic) completion is derived. A scheduled
  // case is PAC-cleared when ASA + Mallampati + NPO-since are all set on the
  // anesthesia block. Without these, the case can't safely advance to Pre-Op.
  const isPACDone = (p: OTProcedure) =>
    !!p.anesthesia?.asa && !!p.anesthesia?.mallampati && !!p.anesthesia?.npoSince
  const pacPending = scheduled.filter(p => !isPACDone(p)).length
  const pacDone = scheduled.filter(isPACDone).length

  // Sign-In / Time-Out / Sign-Out completion counts for the WHO checklist.
  // (Used in the pipeline strip's WHO sub-tile.)
  const whoCompleted = (p: OTProcedure, phase: 'sign_in' | 'time_out' | 'sign_out') =>
    (p.whoChecklist ?? []).filter(i => i.phase === phase).every(i => i.checked)
  const whoOpen = procedures.filter(p =>
    p.status === 'Pre-Op' && !whoCompleted(p, 'sign_in')
  ).length

  const getElapsed = (startedAt?: string) =>
    startedAt ? Math.floor((now - new Date(startedAt).getTime()) / 60000) : 0

  const criticalIncomplete = procedures.filter(p =>
    p.status === 'Pre-Op' && p.checklist.some(c => c.critical && !c.checked)
  )

  return (
    <div className="space-y-6">
      {/* Critical pre-op warning */}
      {criticalIncomplete.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-300 shadow-sm"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900">
              {t('dashboard.criticalWarning', { count: criticalIncomplete.length })}
            </p>
            <p className="text-xs text-red-700 mt-0.5">{t('dashboard.criticalWarningSub')}</p>
          </div>
          <Link href="/ot/checklist">
            <button className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
              {t('dashboard.review')}
            </button>
          </Link>
        </motion.div>
      )}

      {/* M13.8 — OT patient journey pipeline.
          Seven stages mirror the WHO surgical safety pathway:
          Booked → PAC cleared → Pre-op holding → Sign-In/WHO → In progress →
          Sign-Out → Recovery (PACU) → Ward transferred. Each tile shows the
          live count + the action it gates. */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />{t('dashboard.journeyTitle')}
          </h2>
          <p className="text-[11px] text-slate-500">
            {t('dashboard.journeyFlow')}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-stretch">
          {[
            { key: 'scheduled',   label: t('dashboard.tileScheduled'),   sub: t('dashboard.tileScheduledSub', { count: pacPending }),  count: scheduled.length, color: 'border-amber-200 bg-amber-50',     icon: Calendar,         fg: 'text-amber-700',     href: '/ot/schedule',  cta: t('dashboard.tileScheduledCta') },
            { key: 'pacDone',     label: t('dashboard.tilePacDone'),     sub: t('dashboard.tilePacDoneSub'),       count: pacDone,          color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',       icon: Stethoscope,      fg: 'text-[var(--color-accent)]',      href: '/ot/checklist', cta: t('dashboard.tilePacDoneCta') },
            { key: 'preOp',       label: t('dashboard.tilePreOp'),       sub: t('dashboard.tilePreOpSub', { count: whoOpen }),  count: preOp.length,     color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',   icon: ClipboardCheck,   fg: 'text-[var(--color-accent)]',    href: '/ot/checklist', cta: t('dashboard.tilePreOpCta') },
            { key: 'inProgress',  label: t('dashboard.tileInProgress'),  sub: t('dashboard.tileInProgressSub'),     count: inProgress.length,color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',       icon: Heart,            fg: 'text-[var(--color-accent)]',      href: '/ot/checklist', cta: t('dashboard.tileInProgressCta') },
            { key: 'recovery',    label: t('dashboard.tileRecovery'),    sub: t('dashboard.tileRecoverySub'),         count: recovery.length,  color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',       icon: Wind,             fg: 'text-[var(--color-accent)]',      href: '/ot/checklist', cta: t('dashboard.tileRecoveryCta') },
            { key: 'completed',   label: t('dashboard.tileCompleted'),   sub: t('dashboard.tileCompletedSub'),           count: completed.length, color: 'border-emerald-200 bg-emerald-50', icon: LogOut,           fg: 'text-emerald-700',   href: '/ot/dashboard', cta: t('dashboard.tileCompletedCta') },
            { key: 'critical',    label: t('dashboard.tileCritical'),    sub: t('dashboard.tileCriticalSub'),          count: criticalIncomplete.length, color: criticalIncomplete.length > 0 ? 'border-red-300 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white', icon: AlertTriangle, fg: criticalIncomplete.length > 0 ? 'text-red-700' : 'text-slate-400', href: '/ot/checklist', cta: t('dashboard.tileCriticalCta') },
          ].map((s, i, arr) => (
            <Link key={s.key} href={s.href}
              className={cn("relative rounded-xl border p-3 hover:shadow-md transition flex flex-col gap-1 cursor-pointer group", s.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <s.icon className={cn("h-4 w-4 flex-shrink-0", s.fg)} />
                  <p className={cn("text-xs font-bold truncate", s.fg)}>{s.label}</p>
                </div>
                {i < arr.length - 1 && <ChevronRight className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 hidden lg:block" />}
              </div>
              <p className={cn("text-2xl font-bold leading-none", s.fg)}>{s.count}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
              <p className={cn("text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 group-hover:underline", s.fg)}>
                {s.cta} <ArrowRight className="h-2.5 w-2.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* M13.8 — PAC status strip for today's scheduled cases.
          A scheduled case can't safely advance to Pre-Op without an ASA grade,
          Mallampati airway grade, and NPO-since time on file. This strip
          surfaces every case in Scheduled state with PAC completion status
          and a one-click link into the checklist page to fix it. */}
      {scheduled.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />{t('dashboard.pacTitle')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t.rich('dashboard.pacSummary', {
                done: pacDone,
                pending: pacPending,
                b1: (chunks) => <b className="text-[var(--color-accent)]">{chunks}</b>,
                b2: (chunks) => <b className="text-amber-700">{chunks}</b>,
              })}
            </p>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {scheduled.map(p => {
              const done = isPACDone(p)
              const a = p.anesthesia
              return (
                <Link key={p.id} href="/ot/checklist"
                  className={cn("rounded-lg border p-3 flex items-start gap-2.5 hover:shadow-md transition cursor-pointer group",
                    done ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 border",
                    done ? 'border-emerald-300 bg-white text-emerald-600' : 'border-amber-300 bg-white text-amber-600')}>
                    {done ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {p.patientName} <span className="text-[11px] font-bold text-slate-400">{t('dashboard.patientMeta', { id: p.patientId, age: p.patientAge })}</span>
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {t('dashboard.caseMeta', { procedure: p.procedureName, time: p.scheduledTime, room: p.otRoom })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[11px]">
                      <span className={cn("font-bold px-1.5 py-0.5 rounded border", a?.asa ? 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]' : 'bg-white border-slate-200 text-slate-400')}>
                        ASA {a?.asa ?? '—'}
                      </span>
                      <span className={cn("font-bold px-1.5 py-0.5 rounded border", a?.mallampati ? 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]' : 'bg-white border-slate-200 text-slate-400')}>
                        M {a?.mallampati ?? '—'}
                      </span>
                      <span className={cn("font-bold px-1.5 py-0.5 rounded border", a?.npoSince ? 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]' : 'bg-white border-slate-200 text-slate-400')}>
                        NPO {a?.npoSince ? new Date(a.npoSince).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <span className={cn("font-bold px-1.5 py-0.5 rounded border", a?.technique ? 'bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)] text-[var(--color-accent)]' : 'bg-white border-slate-200 text-slate-400')}>
                        {a?.technique ?? t('dashboard.techniquePlaceholder')}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-slate-700 flex-shrink-0 mt-1" />
                </Link>
              )
            })}
          </ul>
        </div>
      )}

      {/* M4.5 — Live OT team */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <OnShiftTeam
          department="Operation Theater"
          date={new Date().toISOString().split('T')[0]!}
          shift={(() => {
            const h = new Date().getHours()
            if (h >= 6 && h < 14) return 'Morning'
            if (h >= 14 && h < 22) return 'Evening'
            return 'Night'
          })()}
          title={t('dashboard.otTeamTitle')}
          emptyMessage={t('dashboard.otTeamEmpty')}
          roles={['ot', 'doctor', 'nurse']}
          compact
        />
      </div>

      {/* OT Room Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">{t('dashboard.roomStatusHeading')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {otRooms.map(room => {
            const proc = room.currentProcedureId
              ? procedures.find(p => p.id === room.currentProcedureId)
              : null
            const elapsed = proc?.startedAt ? getElapsed(proc.startedAt) : 0
            const remaining = proc ? proc.durationMinutes - elapsed : 0
            return (
              <Card key={room.id} className={cn("p-4 border-2", ROOM_COLOR[room.status])}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{room.name}</h3>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", ROOM_COLOR[room.status])}>
                    {t.has(`room.${room.status}`) ? t(`room.${room.status}`) : room.status}
                  </span>
                </div>
                {proc ? (
                  <div>
                    <p className="text-xs font-semibold truncate">{proc.patientName}</p>
                    <p className="text-[11px] text-current opacity-70 truncate mt-0.5">{proc.procedureName}</p>
                    {proc.startedAt && (
                      <div className="flex items-center gap-1 mt-2 text-[11px] font-bold" suppressHydrationWarning>
                        <Clock className="h-3 w-3" />
                        {remaining > 0 ? t('dashboard.remaining', { mins: remaining }) : t('dashboard.overtime')}
                      </div>
                    )}
                  </div>
                ) : room.nextScheduledTime ? (
                  <p className="text-xs opacity-70">{t('dashboard.next', { time: room.nextScheduledTime })}</p>
                ) : (
                  <p className="text-xs opacity-70">{t('dashboard.noScheduled')}</p>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'In Progress', count: inProgress.length, color: 'border-t-slate-400' },
          { key: 'Pre-Op', count: preOp.length, color: 'border-t-amber-500' },
          { key: 'Scheduled', count: scheduled.length, color: 'border-t-slate-400' },
          { key: 'Completed', count: completed.length, color: 'border-t-green-500' },
        ].map(({ key, count, color }) => (
          <Card key={key} className={cn("p-4 text-center border-t-4", color)}>
            <h3 className="text-2xl font-bold text-slate-900">{count}</h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">{t.has(`status.${key}`) ? t(`status.${key}`) : key}</p>
          </Card>
        ))}
      </div>

      {/* Today's procedure timeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900">{t('dashboard.scheduleHeading')}</h2>
          <Link href="/ot/schedule">
            <button className="text-sm font-bold text-[var(--color-accent)] hover:text-[var(--color-accent)] flex items-center gap-1 cursor-pointer">
              {t('dashboard.fullSchedule')} <ChevronRight className="h-4 w-4" />
            </button>
          </Link>
        </div>
        <div className="space-y-3">
          {procedures.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)).map((proc, i) => {
            const elapsed = proc.startedAt ? getElapsed(proc.startedAt) : 0
            const checklistComplete = proc.checklist.every(c => !c.critical || c.checked)
            const next = STATUS_NEXT[proc.status]
            return (
              <motion.div key={proc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={cn("p-5",
                  proc.status === 'In Progress' ? "border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]/20" :
                  proc.status === 'Pre-Op' && !checklistComplete ? "border-amber-200 bg-amber-50/20" : ""
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="text-center flex-shrink-0 w-14">
                        <p className="text-lg font-bold text-slate-900">{proc.scheduledTime}</p>
                        <p className="text-[10px] text-slate-500">{proc.otRoom}</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 text-sm">{proc.patientName}</p>
                          <NeonBadge variant="muted">{proc.id}</NeonBadge>
                          {proc.bloodRequired && <NeonBadge variant="danger">{t('dashboard.bloodRequired')}</NeonBadge>}
                          {!checklistComplete && proc.status === 'Pre-Op' && (
                            <NeonBadge variant="warning" dot pulse>{t('dashboard.checklistIncomplete')}</NeonBadge>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 font-medium mt-0.5">{proc.procedureName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span>{proc.surgeon}</span>
                          <span>{t('dashboard.anaesLabel', { name: proc.anaesthetist })}</span>
                          <span>{t('dashboard.durationMins', { mins: proc.durationMinutes })}</span>
                        </div>
                        {proc.status === 'In Progress' && proc.startedAt && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-[var(--color-accent)]" suppressHydrationWarning>
                            <Clock className="h-3.5 w-3.5" />
                            {t('dashboard.elapsedRemaining', { elapsed, remaining: Math.max(proc.durationMinutes - elapsed, 0) })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {proc.ipdBrief && (
                        <button
                          onClick={() => setExpandedBriefId(expandedBriefId === proc.id ? null : proc.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border"
                          style={{
                            background: expandedBriefId === proc.id ? 'rgba(238,107,38,0.07)' : '#F8FAFC',
                            borderColor: expandedBriefId === proc.id ? '#64748D' : '#E2E8F0',
                            color: expandedBriefId === proc.id ? 'var(--color-primary)' : '#64748B',
                          }}
                        >
                          <Activity className="h-3 w-3" /> {t('dashboard.ipdBrief')}
                          {expandedBriefId === proc.id ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
                        </button>
                      )}
                      <span className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border", STATUS_COLOR[proc.status])}>
                        {t.has(`status.${proc.status}`) ? t(`status.${proc.status}`) : proc.status}
                      </span>
                      {next && (
                        <button
                          onClick={() => {
                            if (next === 'In Progress' && !checklistComplete) {
                              toast.error(t('dashboard.startBlocked'))
                              return
                            }
                            updateStatus(proc.id, next as typeof proc.status)
                            const priority = next === 'In Progress' ? 'critical' : 'high'
                            const nextLabel = t.has(`status.${next}`) ? t(`status.${next}`) : next
                            const fromLabel = t.has(`status.${proc.status}`) ? t(`status.${proc.status}`) : proc.status
                            notifyAndAuditMany(['ot', 'doctor', 'nurse'], {
                              type: 'system', priority,
                              title: t('dashboard.advanceTitle', { id: proc.id, next: nextLabel, patient: proc.patientName }),
                              body: t('dashboard.advanceBody', { procedure: proc.procedureName, room: proc.otRoom, next: nextLabel, surgeon: proc.surgeon, anaesthetist: proc.anaesthetist }),
                              patientName: proc.patientName,
                              audit: { action: 'ot_clearance_set', resource: 'ot_procedure', resourceId: proc.id, detail: t('dashboard.advanceDetail', { from: fromLabel, next: nextLabel }), userName: currentUser?.name ?? 'OT Coordinator' },
                            })
                            toast.success(t('dashboard.advanceToast', { id: proc.id, next: nextLabel }))
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                        >
                          → {t.has(`status.${next}`) ? t(`status.${next}`) : next}
                        </button>
                      )}
                      {proc.status === 'Pre-Op' && (
                        <Link href="/ot/checklist">
                          <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors cursor-pointer border border-amber-200">
                            {t('dashboard.checklist')}
                          </button>
                        </Link>
                      )}
                      {proc.status === 'Completed' && (
                        <div className="flex items-center gap-1 text-xs font-bold text-green-600">
                          <CheckCircle className="h-4 w-4" /> {t('dashboard.done')}
                        </div>
                      )}
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedBriefId === proc.id && proc.ipdBrief && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <IPDBriefPanel proc={proc} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
