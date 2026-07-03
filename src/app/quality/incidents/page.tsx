"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { useQualityStore, type IncidentType, type IncidentSeverity } from "@/store/useQualityStore"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Plus, X, CheckCircle, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NeonBadge } from "@/components/ui/neon-badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit, notifyAndAuditMany } from "@/lib/notifyAndAudit"
import { useTranslations } from "next-intl"

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  Low:      'bg-green-50 text-green-700 border-green-200',
  Medium:   'bg-amber-50 text-amber-700 border-amber-200',
  High:     'bg-primary-soft text-accent border-primary/20',
  Critical: 'bg-red-50 text-red-700 border-red-200',
}

const INCIDENT_TYPES: IncidentType[] = [
  'Fall', 'Medication Error', 'Healthcare-Associated Infection', 'Equipment Failure', 'Near Miss', 'Other',
]
const SEVERITIES: IncidentSeverity[] = ['Low', 'Medium', 'High', 'Critical']

const emptyForm = {
  type: 'Fall' as IncidentType,
  severity: 'Medium' as IncidentSeverity,
  ward: '',
  patientId: '',
  description: '',
  staffInvolved: '',
  correctiveAction: '',
  resolveNote: '',
}

export default function IncidentsPage() {
  const t = useTranslations('quality')
  const { incidents, addIncident, resolveIncident } = useQualityStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<'All' | 'Open' | IncidentSeverity>('All')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState('')

  const filtered = incidents.filter(i => {
    if (filter === 'All') return true
    if (filter === 'Open') return i.status !== 'Resolved'
    return i.severity === filter
  })

  const handleAdd = () => {
    if (!form.ward.trim() || !form.description.trim()) {
      toast.error(t('incidents.validationError'))
      return
    }
    addIncident({
      type: form.type,
      severity: form.severity,
      ward: form.ward,
      patientId: form.patientId || undefined,
      description: form.description,
      staffInvolved: form.staffInvolved || 'Unknown',
      correctiveAction: form.correctiveAction || undefined,
      reportedBy: 'Quality Team',
    })
    // M11-G — critical severity auto-escalates to Quality Head + Admin.
    if (form.severity === 'Critical' || form.severity === 'High') {
      notifyAndAuditMany(['admin', 'audit_officer'], {
        type: 'critical_value', priority: form.severity === 'Critical' ? 'critical' : 'high',
        title: `${form.severity} incident · ${form.ward}`,
        body: `${form.type} reported by Quality Team: ${form.description.slice(0, 140)}${form.description.length > 140 ? '…' : ''}`,
        audit: { action: 'incident_reported', resource: 'quality_incident', detail: `${form.severity} severity ${form.type} in ${form.ward}`, userName: 'Quality Team' },
      })
      toast.success(t('incidents.escalatedToast', { severity: form.severity }))
    } else {
      toast.success(t('incidents.loggedToast'))
    }
    setForm(emptyForm)
    setShowForm(false)
  }

  // M11-G — pre-fill a CAPA (Corrective + Preventive Action) template
  // so the resolver doesn't start from a blank box.
  function capaTemplate(): string {
    return [
      'CAPA — Corrective & Preventive Action',
      '',
      'Immediate corrective action taken:',
      '- ',
      '',
      'Root cause analysis:',
      '- ',
      '',
      'Preventive action (to avoid recurrence):',
      '- ',
      '',
      'Owner: ',
      'Review date: ',
    ].join('\n')
  }

  const handleResolve = (id: string) => {
    const inc = incidents.find(i => i.id === id)
    resolveIncident(id, resolveNote || 'Resolved')
    if (inc) {
      notifyAndAudit({
        to: 'admin', type: 'system', priority: 'low',
        title: `Incident resolved · ${inc.ward}`,
        body: `${inc.type} (${inc.severity}) in ${inc.ward} marked resolved.`,
        audit: { action: 'incident_resolved', resource: 'quality_incident', resourceId: id, detail: `Resolved: ${resolveNote || 'Resolved'}`, userName: 'Quality Team' },
      })
    }
    toast.success(t('incidents.resolvedToast'))
    setResolvingId(null)
    setResolveNote('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('incidents.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('incidents.summary', { open: incidents.filter(i => i.status !== 'Resolved').length, total: incidents.length })}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm
            ? <><X className="h-4 w-4 mr-1.5" /> {t('incidents.cancel')}</>
            : <><Plus className="h-4 w-4 mr-1.5" /> {t('incidents.logIncident')}</>
          }
        </Button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
          >
            <Card className="p-5 border-red-200 bg-red-50/20">
              <h3 className="text-sm font-bold text-slate-900 mb-4">{t('incidents.logNewIncident')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.type')}</label>
                  <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as IncidentType }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {INCIDENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.severity')}</label>
                  <Select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as IncidentSeverity }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                    {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.wardLocation')}</label>
                  <input value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={t('incidents.wardPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.patientIdOptional')}</label>
                  <input value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={t('incidents.patientIdPlaceholder')} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.description')}</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    placeholder={t('incidents.descriptionPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.staffInvolved')}</label>
                  <input value={form.staffInvolved} onChange={e => setForm(f => ({ ...f, staffInvolved: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={t('incidents.staffPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('incidents.correctiveAction')}</label>
                  <input value={form.correctiveAction} onChange={e => setForm(f => ({ ...f, correctiveAction: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder={t('incidents.correctiveActionPlaceholder')} />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={handleAdd} className="flex-1">{t('incidents.logIncident')}</Button>
                <Button variant="secondary" onClick={() => setShowForm(false)}>{t('incidents.cancel')}</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Open', ...SEVERITIES] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("text-sm font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer",
              filter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}>
            {f === 'All' ? t('incidents.filterAll') : f === 'Open' ? t('incidents.filterOpen') : f}
          </button>
        ))}
      </div>

      {/* Incident List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">{t('incidents.noMatch')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((incident, i) => (
            <motion.div key={incident.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={cn("p-5",
                incident.severity === 'Critical' && incident.status !== 'Resolved' ? "border-red-300 bg-red-50/20" :
                incident.severity === 'High' && incident.status !== 'Resolved' ? "border-primary/20" : ""
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border", SEVERITY_COLOR[incident.severity])}>
                        {incident.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-600">{incident.type}</span>
                      <NeonBadge variant={incident.status === 'Resolved' ? 'success' : incident.status === 'Under Review' ? 'warning' : 'danger'}>
                        {incident.status}
                      </NeonBadge>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{incident.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                      <span>{incident.ward}</span>
                      {incident.patientId && <span>{incident.patientId}</span>}
                      <span>{new Date(incident.reportedAt).toLocaleDateString('en-IN')}</span>
                      {incident.staffInvolved && <span>{t('incidents.staffLabel', { staff: incident.staffInvolved })}</span>}
                    </div>
                    {incident.correctiveAction && (
                      <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded-lg px-2 py-1">
                        <span className="font-semibold">{t('incidents.actionLabel')}</span> {incident.correctiveAction}
                      </p>
                    )}
                    {/* Resolve inline form with CAPA template */}
                    <AnimatePresence>
                      {resolvingId === incident.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                          <div className="flex items-center gap-2 mb-1.5">
                            <button onClick={() => setResolveNote(capaTemplate())}
                              className="text-[10.5px] font-semibold text-[var(--color-accent)] bg-[rgba(238,107,38,0.07)] hover:bg-[rgba(238,107,38,0.14)] border border-[rgba(238,107,38,0.20)] px-2 py-0.5 rounded cursor-pointer">
                              {t('incidents.insertCapa')}
                            </button>
                            <span className="text-[10px] text-slate-400">{t('incidents.capaHint')}</span>
                          </div>
                          <div className="flex gap-2">
                            <textarea
                              value={resolveNote}
                              onChange={e => setResolveNote(e.target.value)}
                              placeholder={t('incidents.resolvePlaceholder')}
                              rows={resolveNote.includes('\n') ? 8 : 1}
                              className="flex-1 rounded-lg border border-green-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                            />
                            <button onClick={() => handleResolve(incident.id)}
                              className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                              {t('incidents.confirm')}
                            </button>
                            <button onClick={() => setResolvingId(null)}
                              className="px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {incident.status !== 'Resolved' && resolvingId !== incident.id && (
                    <button
                      onClick={() => setResolvingId(incident.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold transition-colors cursor-pointer border border-green-200 flex-shrink-0"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> {t('incidents.resolve')}
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
