"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useBloodBankStore } from "@/store/useBloodBankStore"
import { Droplets, AlertTriangle, Clock, CheckCircle, Package, Activity } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/PageHeader"
import { AiDisclaimer } from "@/components/ui/AiDisclaimer"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

const PIE_COLORS = ['#EF4444', '#EE6B26', 'var(--color-primary-light)', 'var(--color-primary)', '#EC4899', 'var(--color-primary)', '#10B981', '#F59E0B']

const GROUP_COLORS: Record<string, string> = {
  'O+': 'bg-red-100 text-red-700 border-red-200',
  'O-': 'bg-red-50 text-red-600 border-red-100',
  'A+': 'bg-accent-soft text-accent border-primary/20',
  'A-': 'bg-primary-soft text-accent border-primary/20',
  'B+': 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  'B-': 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.15)]',
  'AB+': 'bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] border-[rgba(238,107,38,0.20)]',
  'AB-': 'bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] border-[rgba(238,107,38,0.15)]',
}

export default function BloodBankDashboard() {
  const t = useTranslations('bloodbank')
  const { inventorySummary, crossMatchRequests, units } = useBloodBankStore()
  const summary = inventorySummary()
  const pendingRequests = crossMatchRequests.filter((r) => r.status === 'pending')
  const expiringUnits = units.filter((u) => {
    if (u.status !== 'available') return false
    const daysToExpiry = (new Date(u.expiresOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return daysToExpiry < 7
  })

  const pieData = BLOOD_GROUPS.map((bg, i) => ({ name: bg, value: summary[bg] ?? 0 })).filter(d => d.value > 0)

  return (
    <div className="space-y-6 pt-6">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
      />

      <AiDisclaimer />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.availableUnits')}    value={units.filter((u) => u.status === 'available').length} icon={Package}       color="blue"  delay={0} />
        <StatCard label={t('dashboard.pendingRequests')}   value={pendingRequests.length}                               icon={Activity}     color="amber" delay={0.05} />
        <StatCard label={t('dashboard.expiringIn7Days')} value={expiringUnits.length}                                icon={AlertTriangle} color="red"  delay={0.1} />
        <StatCard label={t('dashboard.groupsStocked')}     value={`${Object.values(summary).filter((v) => v > 0).length}/8`} icon={Droplets} color="slate" delay={0.15} />
      </div>

      {/* Recharts Donut Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Droplets className="h-4 w-4 text-red-500" /> {t('dashboard.distributionByGroup')}
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [t('dashboard.unitsTooltip', { count: v as number }), t('dashboard.available')]} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory by Blood Group */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Droplets className="h-4 w-4 text-red-500" /> {t('dashboard.inventoryByGroup')}
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {BLOOD_GROUPS.map((bg, i) => {
            const count = summary[bg] ?? 0
            const isLow = count <= 2
            return (
              <motion.div
                key={bg}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`flex flex-col items-center p-3 rounded-xl border ${GROUP_COLORS[bg] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}
              >
                <p className="text-lg font-black">{bg}</p>
                <p className={`text-2xl font-bold mt-1 ${isLow && count > 0 ? 'text-red-600' : ''}`}>{count}</p>
                {count === 0 && <Badge variant="danger" size="sm" className="mt-0.5">{t('dashboard.out')}</Badge>}
                {isLow && count > 0 && <Badge variant="warning" size="sm" dot pulse className="mt-0.5">{t('dashboard.low')}</Badge>}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Pending Cross-Match Requests */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" /> {t('dashboard.pendingCrossMatch')}
          {pendingRequests.length > 0 && <Badge variant="warning">{pendingRequests.length}</Badge>}
        </h3>
        {pendingRequests.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
            <p className="text-sm font-medium">{t('dashboard.noPendingRequests')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl hover:bg-white hover:border-amber-300 transition-colors"
              >
                <div>
                  <p className="font-bold text-slate-800 text-sm">{req.patientName}</p>
                  <p className="text-xs text-slate-500">{t('dashboard.unitsSummary', { group: req.bloodGroup, component: req.component, units: req.units })}</p>
                  <p className="text-xs text-slate-400">{t('dashboard.requestedByName', { name: req.requestedBy })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning" dot pulse>{req.status.toUpperCase()}</Badge>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
