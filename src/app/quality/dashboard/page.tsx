"use client"

import { useQualityStore } from "@/store/useQualityStore"
import { motion } from "framer-motion"
import { ShieldCheck, AlertTriangle, CheckCircle, TrendingDown, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

const SEVERITY_COLOR: Record<string, string> = {
  Low:      'bg-green-50 text-green-700 border-green-200',
  Medium:   'bg-amber-50 text-amber-700 border-amber-200',
  High:     'bg-primary-soft text-accent border-primary/20',
  Critical: 'bg-red-50 text-red-700 border-red-200',
}

export default function QualityDashboard() {
  const t = useTranslations('quality')
  const { incidents, auditTasks, qualityMetrics, completeAuditTask } = useQualityStore()

  const openIncidents = incidents.filter(i => i.status !== 'Resolved')
  const criticalIncidents = incidents.filter(i => i.severity === 'Critical' && i.status !== 'Resolved')
  const completedAudits = auditTasks.filter(t => t.status === 'Completed').length
  const auditRate = Math.round((completedAudits / auditTasks.length) * 100)

  return (
    <div className="space-y-6">
      {criticalIncidents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-300"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900">{t('dashboard.criticalAlert', { count: criticalIncidents.length })}</p>
          </div>
          <Link href="/quality/incidents">
            <button className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg cursor-pointer">{t('dashboard.review')}</button>
          </Link>
        </motion.div>
      )}

      {/* QI Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'fallsThisMonth', label: t('dashboard.metrics.fallsThisMonth'), value: qualityMetrics.fallsThisMonth, target: 5, atRisk: qualityMetrics.fallsThisMonth > 5 },
          { key: 'medicationErrors', label: t('dashboard.metrics.medicationErrors'), value: qualityMetrics.medicationErrors, target: 3, atRisk: qualityMetrics.medicationErrors >= 3 },
          { key: 'haiCount', label: t('dashboard.metrics.haiCount'), value: qualityMetrics.haiCount, target: 3, atRisk: qualityMetrics.haiCount >= 3 },
          { key: 'avgLOS', label: t('dashboard.metrics.avgLOS'), value: qualityMetrics.avgLOS, target: 5, atRisk: qualityMetrics.avgLOS > 5 },
        ].map(({ key, label, value, target, atRisk }) => (
          <Card key={key} className={cn("p-4 border-t-4", atRisk ? "border-t-red-500" : "border-t-green-500")}>
            <div className="flex items-center justify-between mb-2">
              {atRisk ? <AlertTriangle className="h-5 w-5 text-red-500" /> : <ShieldCheck className="h-5 w-5 text-green-500" />}
              {atRisk ? <NeonBadge variant="danger">{t('dashboard.atRisk')}</NeonBadge> : <NeonBadge variant="success">{t('dashboard.onTrack')}</NeonBadge>}
            </div>
            <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">{label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('dashboard.target', { target })}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Open Incidents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.openIncidents')}</h2>
            <Link href="/quality/incidents">
              <button className="text-sm font-bold text-[var(--color-accent)] flex items-center gap-1 cursor-pointer hover:underline">
                {t('dashboard.all')} <ChevronRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
          <div className="space-y-3">
            {openIncidents.slice(0, 5).map((incident, i) => (
              <motion.div key={incident.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={cn("p-4", incident.severity === 'Critical' ? "border-red-200 bg-red-50/30" : incident.severity === 'High' ? "border-primary/20" : "")}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", SEVERITY_COLOR[incident.severity])}>
                      {incident.severity}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">{incident.type}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{incident.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {incident.ward} · {new Date(incident.reportedAt).toLocaleDateString('en-IN')}
                  </p>
                </Card>
              </motion.div>
            ))}
            {openIncidents.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">{t('dashboard.noOpenIncidents')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Audit Checklist */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.auditChecklist')}</h2>
            <div className="text-sm font-bold text-slate-500">{t('dashboard.percentComplete', { rate: auditRate })}</div>
          </div>
          <Card className="p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-slate-700">{t('dashboard.compliance')}</span>
              <span className={cn("text-sm font-bold", auditRate >= 80 ? "text-green-600" : "text-amber-600")}>{auditRate}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", auditRate >= 80 ? "bg-green-500" : "bg-amber-500")} style={{ width: `${auditRate}%` }} />
            </div>
          </Card>
          <div className="space-y-2">
            {auditTasks.map(task => (
              <div key={task.id} className={cn("flex items-center gap-3 p-3 rounded-xl border",
                task.status === 'Completed' ? "bg-green-50 border-green-200" :
                task.status === 'Overdue' ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
              )}>
                <button
                  onClick={() => { if (task.status !== 'Completed') { completeAuditTask(task.id, 'Quality Team'); toast.success(t('dashboard.auditCompleted', { title: task.title })) } }}
                  className="flex-shrink-0 cursor-pointer"
                >
                  {task.status === 'Completed'
                    ? <CheckCircle className="h-5 w-5 text-green-600" />
                    : <div className={cn("h-5 w-5 rounded-full border-2", task.status === 'Overdue' ? "border-red-400" : "border-slate-300")} />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate", task.status === 'Completed' ? "text-green-800 line-through" : task.status === 'Overdue' ? "text-red-800" : "text-slate-900")}>
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-400">{task.frequency} · {task.department}</p>
                </div>
                {task.status === 'Overdue' && <NeonBadge variant="danger">{t('dashboard.overdue')}</NeonBadge>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly QI */}
      <Card className="p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4">{t('dashboard.monthlyQI')}</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'readmissionRate', label: t('dashboard.qi.readmissionRate'), value: `${qualityMetrics.readmissionRate}%`, target: '< 8%', good: qualityMetrics.readmissionRate < 8 },
            { key: 'patientSatisfaction', label: t('dashboard.qi.patientSatisfaction'), value: `${qualityMetrics.patientSatisfaction}%`, target: '> 85%', good: qualityMetrics.patientSatisfaction >= 85 },
            { key: 'auditCompletion', label: t('dashboard.qi.auditCompletion'), value: `${qualityMetrics.auditCompletionPct}%`, target: '≥ 90%', good: qualityMetrics.auditCompletionPct >= 90 },
          ].map(({ key, label, value, target, good }) => (
            <div key={key} className={cn("p-4 rounded-xl border", good ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200")}>
              <p className={cn("text-2xl font-bold", good ? "text-green-700" : "text-amber-700")}>{value}</p>
              <p className="text-xs font-bold text-slate-600 mt-1">{label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('dashboard.targetValue', { target })}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
