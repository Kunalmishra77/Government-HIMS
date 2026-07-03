"use client"
import { Select } from "@/components/ui/Select"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Clock, CheckCircle2, AlertCircle, User } from "lucide-react"
import { useHousekeepingStore } from "@/store/useHousekeepingStore"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { NeonBadge } from "@/components/ui/neon-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"

const PRIORITY_STYLE: Record<string, string> = {
  Urgent: "bg-red-50 border-red-200",
  High: "bg-primary-soft border-primary/20",
  Routine: "bg-slate-50 border-slate-200",
}
const PRIORITY_BADGE: Record<string, "danger" | "warning" | "muted"> = {
  Urgent: "danger",
  High: "warning",
  Routine: "muted",
}

export default function HousekeepingDashboard() {
  const t = useTranslations('housekeeping')
  const { tasks, staff, assignTask, startTask, completeTask, verifyTask } = useHousekeepingStore()
  const { confirmBedReady } = useAdmissionStore()
  const [filter, setFilter] = useState<string>('All')

  const priorityLabel = (p: string) => {
    const k = `priority${p.replace(/\s/g, '')}`
    return t.has(k) ? t(k) : p
  }
  const statusLabel = (s: string) => {
    const k = `status${s.replace(/\s/g, '')}`
    return t.has(k) ? t(k) : s
  }
  const filterLabel = (s: string) => {
    const k = `filter${s.replace(/\s/g, '')}`
    return t.has(k) ? t(k) : s
  }

  const filtered = tasks.filter(t => filter === 'All' || t.status === filter)
  const pending = tasks.filter(t => t.status === 'Pending').length
  const inProgress = tasks.filter(t => t.status === 'In Progress').length
  const done = tasks.filter(t => t.status === 'Done').length
  const verified = tasks.filter(t => t.status === 'Verified').length

  const elapsed = (dateStr?: string) => {
    if (!dateStr) return '—'
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
  }

  const handleVerify = (taskId: string, bedId: string) => {
    const task = tasks.find(t => t.id === taskId)
    verifyTask(taskId, 'Head Nurse')
    confirmBedReady(bedId)
    const bedLabel = task?.bedNumber ?? bedId
    notifyAndAuditMany(['bed_manager', 'admin'], {
      type: 'system', priority: 'medium',
      title: t('bedReadyTitle', { bed: bedLabel }),
      body: t('bedReadyBody', { bed: bedLabel, ward: task?.ward ?? '—' }),
      audit: { action: 'housekeeping_bed_turned', resource: 'housekeeping_task', resourceId: taskId, detail: `Bed ${bedLabel} verified ready`, userName: 'Head Nurse' },
    })
    toast.success(t('toastBedVerified', { bed: bedLabel }))
  }

  // M12-A — SLA timer: any task pending more than 2h without start.
  const SLA_MIN = 120
  const isSlaBreached = (task: typeof tasks[number]) => {
    if (task.status !== 'Pending' && task.status !== 'In Progress') return false
    const base = new Date(task.requestedAt).getTime()
    return (Date.now() - base) > SLA_MIN * 60 * 1000
  }
  const slaBreachCount = tasks.filter(isSlaBreached).length

  // Bulk reset: mark all pending tasks for next shift (status stays Pending).
  function bulkResetForNextShift() {
    const count = tasks.filter(x => x.status === 'Pending').length
    if (count === 0) { toast(t('toastNoPendingReset')); return }
    notifyAndAudit({
      to: 'housekeeping', type: 'system', priority: 'low',
      title: t('rolledTitle'),
      body: t('rolledBody', { count }),
      audit: { action: 'housekeeping_room_cleaned', resource: 'housekeeping_task', detail: `Bulk-reset ${count} pending tasks`, userName: 'Housekeeping lead' },
    })
    toast.success(t('toastCarriedNextShift', { count }))
  }

  return (
    <div className="space-y-6">
      {/* M12-A header bar — SLA badge + bulk reset */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('taskSummary', { count: tasks.length, breaches: slaBreachCount })}</p>
        </div>
        <button onClick={bulkResetForNextShift}
          className="text-[11.5px] font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl cursor-pointer">
          {t('carryToNextShift')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: t('statPending'), value: pending, color: "text-accent", bg: "bg-primary-soft border-primary/20" },
          { label: t('statInProgress'), value: inProgress, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
          { label: t('statDoneUnverified'), value: done, color: "text-[var(--color-accent)]", bg: "bg-[rgba(238,107,38,0.07)] border-[rgba(238,107,38,0.20)]" },
          { label: t('statVerified'), value: verified, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("rounded-xl border p-5", bg)}>
            <p className={cn("text-3xl font-bold", color)}>{value}</p>
            <p className="text-sm font-semibold text-slate-600 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Task list */}
        <div className="col-span-2 bg-white border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">{t('cleaningQueue')}</h2>
            <div className="flex gap-2">
              {['All', 'Pending', 'In Progress', 'Done', 'Verified'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors",
                    filter === s ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {filterLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            <AnimatePresence>
              {filtered.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={cn("p-4", PRIORITY_STYLE[task.priority])}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-bold text-slate-900">{t('bed', { number: task.bedNumber })}</span>
                        <NeonBadge variant={PRIORITY_BADGE[task.priority]} className="text-[10px]">{priorityLabel(task.priority)}</NeonBadge>
                        <span className="text-xs text-slate-500">{task.ward}</span>
                        <NeonBadge
                          variant={task.status === 'Verified' ? 'success' : task.status === 'In Progress' ? 'warning' : task.status === 'Done' ? 'blue' : 'muted'}
                          className="text-[10px]"
                        >
                          {statusLabel(task.status)}
                        </NeonBadge>
                        {isSlaBreached(task) && (
                          <NeonBadge variant="danger" className="text-[10px]">{t('slaBadge', { mins: Math.round((Date.now() - new Date(task.requestedAt).getTime()) / 60000) })}</NeonBadge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mb-1">{t('reasonClean', { reason: task.reason })}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t('requestedAgo', { time: elapsed(task.requestedAt) })}</span>
                        {task.startedAt && <span>{t('startedAgo', { time: elapsed(task.startedAt) })}</span>}
                        {task.assignedTo && <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.assignedTo}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {task.status === 'Pending' && !task.assignedTo && (
                        <Select
                          onChange={e => {
                            if (!e.target.value) return
                            assignTask(task.id, e.target.value)
                            notifyAndAudit({
                              to: 'housekeeping', type: 'system', priority: 'low',
                              title: t('newTaskTitle', { bed: task.bedNumber }),
                              body: t('newTaskBody', { staff: e.target.value, bed: task.bedNumber, ward: task.ward, reason: task.reason }),
                              audit: { action: 'housekeeping_room_cleaned', resource: 'housekeeping_task', resourceId: task.id, detail: `Assigned to ${e.target.value}`, userName: 'Housekeeping lead' },
                            })
                            toast.success(t('toastAssigned', { staff: e.target.value }))
                          }}
                          defaultValue=""
                          className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 bg-white focus:outline-none cursor-pointer"
                        >
                          <option value="" disabled>{t('assignStaff')}</option>
                          {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </Select>
                      )}
                      {task.status === 'Pending' && task.assignedTo && (
                        <Button size="sm" variant="secondary" onClick={() => { startTask(task.id); toast.info(t('toastCleaningStarted', { bed: task.bedNumber })) }}>
                          {t('start')}
                        </Button>
                      )}
                      {task.status === 'In Progress' && (
                        <label className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] text-[var(--color-accent)] text-[11px] font-semibold cursor-pointer border border-[rgba(238,107,38,0.20)]">
                          📷 {t('photoAndDone')}
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              completeTask(task.id)
                              toast.success(f ? t('toastMarkedDonePhoto', { bed: task.bedNumber }) : t('toastMarkedDone', { bed: task.bedNumber }))
                              e.currentTarget.value = ''
                            }} />
                        </label>
                      )}
                      {task.status === 'Done' && (
                        <Button size="sm" variant="primary" onClick={() => handleVerify(task.id, task.bedId)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t('verify')}
                        </Button>
                      )}
                      {task.status === 'Verified' && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-lg border border-green-200">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t('doneLabel')}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">{t('noTasksInView')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Staff Status */}
        <div className="bg-white border shadow-sm rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">{t('housekeepingStaff')}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {staff.map(member => {
              const currentTask = member.currentTaskId ? tasks.find(t => t.id === member.currentTaskId) : null
              return (
                <div key={member.id} className="p-4 flex items-center gap-3">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
                    currentTask ? "bg-yellow-500" : "bg-green-500"
                  )}>
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{member.name}</p>
                    {currentTask ? (
                      <p className="text-xs text-yellow-700 font-medium">{t('cleaningBed', { number: currentTask.bedNumber })}</p>
                    ) : (
                      <p className="text-xs text-green-700 font-medium">{t('available')}</p>
                    )}
                  </div>
                  <NeonBadge variant={currentTask ? "warning" : "success"} className="text-[10px]">
                    {currentTask ? t('busy') : t('free')}
                  </NeonBadge>
                </div>
              )
            })}
          </div>

          {pending > 0 && (
            <div className="p-4 border-t border-slate-100 bg-primary-soft">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-accent" />
                <p className="text-xs font-semibold text-accent">{t('awaitingAssignment', { count: pending })}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
