"use client"

import { Select } from "@/components/ui/Select"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useBMWStore, type WasteCategory } from "@/store/useBMWStore"
import { AlertTriangle, CheckCircle2, Scale, Trash2, Plus, Truck, X, Upload, Sparkles } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/PageHeader"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const CATEGORY_COLORS: Record<string, string> = {
  Yellow:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  Red:      'bg-red-100    text-red-800    border-red-200',
  Blue:     'bg-[rgba(238,107,38,0.12)]   text-[var(--color-primary-dark)]   border-[rgba(238,107,38,0.20)]',
  Black:    'bg-slate-200  text-slate-800  border-slate-300',
  White:    'bg-slate-50   text-slate-700  border-slate-200',
  Cytotoxic:'bg-[rgba(238,107,38,0.12)] text-[var(--color-primary-dark)] border-[rgba(238,107,38,0.20)]',
}

const STATUS_BADGE: Record<string, { variant: "success" | "warning" | "danger" }> = {
  disposed:      { variant: "success" },
  pending:       { variant: "warning" },
  collected:     { variant: "warning" },
  treated:       { variant: "warning" },
  non_compliant: { variant: "danger" },
}

const statusKey = (s: string) => (s === 'non_compliant' ? 'nonCompliant' : s)

const WARDS = ['General Ward', 'ICU', 'OT', 'Cardiac Care', 'Emergency', 'Pharmacy', 'CSSD', 'Laboratory'] as const
const CATEGORIES: WasteCategory[] = ['Yellow', 'Red', 'Blue', 'Black', 'White', 'Cytotoxic']

function CollectModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('bmw')
  const collectBag = useBMWStore((s) => s.collectBag)
  const [ward, setWard] = useState<string>('General Ward')
  const [category, setCategory] = useState<WasteCategory>('Yellow')
  const [weight, setWeight] = useState('')
  const [bags, setBags] = useState('1')

  const submit = () => {
    const w = parseFloat(weight); const b = parseInt(bags)
    if (!w || w <= 0 || !b || b < 1) return
    collectBag({ ward, category, weightKg: w, bagCount: b, collectedBy: 'BW-1501', collectedByName: 'Ganesh Rao' })
    notifyAndAudit({
      to: 'bmw', type: 'system', priority: 'low',
      title: `Waste collected · ${ward}`,
      body: `${w} kg of ${category} waste (${b} bags) collected from ${ward}.`,
      audit: { action: 'bmw_waste_collected', resource: 'waste_log', detail: `${ward} · ${category} · ${w}kg`, userName: 'Ganesh Rao' },
    })
    toast.success(t('toast.loggedWaste', { weight: w, category, ward }))
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{t('collectModal.heading')}</h2>
          <button onClick={onClose} aria-label={t('collectModal.close')} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('collectModal.ward')}</label>
              <Select value={ward} onChange={e => setWard(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('collectModal.category')}</label>
              <Select value={category} onChange={e => setCategory(e.target.value as WasteCategory)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('collectModal.weightKg')}</label>
              <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('collectModal.bags')}</label>
              <input type="number" min={1} value={bags} onChange={e => setBags(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">{t('collectModal.cancel')}</button>
          <button onClick={submit} className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold cursor-pointer">{t('collectModal.logCollection')}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function HandoverModal({ logId, onClose }: { logId: string; onClose: () => void }) {
  const t = useTranslations('bmw')
  const handoverToVendor = useBMWStore((s) => s.handoverToVendor)
  const [vendor, setVendor] = useState('BMW-VENDOR-01')
  const [manifest, setManifest] = useState(`MF-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*99).toString().padStart(2,'0')}`)
  const [cert, setCert] = useState<File | null>(null)

  const submit = () => {
    if (!vendor) return
    handoverToVendor(logId, vendor, 'Ganesh Rao')
    notifyAndAudit({
      to: 'admin', type: 'system', priority: 'medium',
      title: `BMW handover · ${manifest}`,
      body: `Manifest ${manifest} handed to ${vendor}${cert ? ' · cert: ' + cert.name : ''}.`,
      audit: { action: 'bmw_handover_to_vendor', resource: 'waste_log', resourceId: logId, detail: `Handed to ${vendor} · manifest ${manifest}${cert ? ' · cert ' + cert.name : ''}`, userName: 'Ganesh Rao' },
    })
    toast.success(t('toast.handedOverAdmin', { vendor }))
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{t('handoverModal.heading')}</h2>
          <button onClick={onClose} aria-label={t('handoverModal.close')} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('handoverModal.vendor')}</label>
            <input value={vendor} onChange={e => setVendor(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('handoverModal.manifest')}</label>
            <input value={manifest} onChange={e => setManifest(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('handoverModal.disposalCert')}</label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:bg-slate-50">
              <Upload className="h-4 w-4 text-slate-400" />
              <span className="text-[12px] text-slate-600 truncate">{cert?.name ?? t('handoverModal.dropCertHere')}</span>
              <input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => setCert(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">{t('handoverModal.cancel')}</button>
          <button onClick={submit} className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold cursor-pointer">{t('handoverModal.handOver')}</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function BMWDashboard() {
  const t = useTranslations('bmw')
  const { wasteLogs, todaySummary, markTreated, updateLog } = useBMWStore()
  const summary       = todaySummary()
  const totalKg       = Object.values(summary).reduce((a, b) => a + b, 0)
  const pending       = wasteLogs.filter((l) => l.status === 'pending').length
  const nonCompliant  = wasteLogs.filter((l) => l.status === 'non_compliant').length
  const disposed      = wasteLogs.filter((l) => l.status === 'disposed').length

  const [collectOpen, setCollectOpen] = useState(false)
  const [handingOver, setHandingOver] = useState<string | null>(null)

  function treat(id: string, name: string) {
    markTreated(id)
    notifyAndAudit({
      to: 'admin', type: 'system', priority: 'low',
      title: `Waste treated · ${name}`,
      body: `${name} waste treated and ready for vendor handover.`,
      audit: { action: 'waste_log', resource: 'waste_log', resourceId: id, detail: `Waste ${id} treated`, userName: 'Ganesh Rao' },
    })
    toast.success(t('toast.wasteTreated'))
  }
  function flagNonCompliant(id: string, reason: string) {
    updateLog(id, { status: 'non_compliant' })
    notifyAndAuditMany_BMW(id, reason)
    toast.error(t('toast.flaggedNonCompliant'))
  }
  function notifyAndAuditMany_BMW(id: string, reason: string) {
    notifyAndAudit({ to: 'admin', type: 'system', priority: 'high', title: `Non-compliant waste · ${id}`, body: `Waste record ${id} flagged non-compliant. Reason: ${reason}.`, audit: { action: 'waste_log', resource: 'waste_log', resourceId: id, detail: `Non-compliant: ${reason}`, userName: 'Ganesh Rao' } })
    notifyAndAudit({ to: 'quality', type: 'system', priority: 'high', title: `Non-compliant waste · ${id}`, body: `Waste record ${id} flagged non-compliant. Reason: ${reason}.`, audit: { action: 'waste_log', resource: 'waste_log', resourceId: id, detail: `Non-compliant: ${reason}`, userName: 'Ganesh Rao' } })
  }

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title={t('dashboard.title')}
          subtitle={t('dashboard.subtitle')}
        />
        <button onClick={() => setCollectOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold cursor-pointer">
          <Plus className="h-4 w-4" /> {t('dashboard.logCollection')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('dashboard.totalToday')}    value={totalKg.toFixed(1)}  icon={Scale}        color="slate"  delay={0} />
        <StatCard label={t('dashboard.pendingCollection')}  value={pending}             icon={AlertTriangle} color="amber"  delay={0.05} />
        <StatCard label={t('dashboard.nonCompliant')}       value={nonCompliant}        icon={AlertTriangle} color="red"    delay={0.1} />
        <StatCard label={t('dashboard.disposedToday')}      value={disposed}            icon={CheckCircle2}  color="green"  delay={0.15} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4">{t('dashboard.todaysWasteByCategory')}</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.entries(summary).map(([cat, kg], i) => (
            <motion.div key={cat}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
              className={`p-3 rounded-xl border text-center ${CATEGORY_COLORS[cat] ?? 'bg-slate-50 border-slate-200'}`}
            >
              <p className="text-xs font-bold">{cat}</p>
              <p className="text-xl font-black mt-1">{kg.toFixed(1)}</p>
              <p className="text-[10px] mt-0.5">{t('dashboard.kg')}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-slate-500" /> {t('dashboard.wasteLogToday')}
        </h3>
        <div className="space-y-2">
          {wasteLogs.slice(0, 8).map((log, i) => {
            const sb = STATUS_BADGE[log.status] ?? { variant: "warning" as const }
            return (
              <motion.div key={log.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-white hover:border-slate-300 transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {log.status === 'disposed'      && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                  {log.status === 'non_compliant' && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  {(log.status === 'pending' || log.status === 'collected' || log.status === 'treated') && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{log.ward} — {log.category}</p>
                    <p className="text-xs text-slate-500 truncate">{log.weightKg}kg · {log.bagCount} bags · {new Date(log.collectedAt).toLocaleTimeString()}</p>
                  </div>
                </div>
                <Badge variant={sb.variant}>{(t.has(`status.${statusKey(log.status)}`) ? t(`status.${statusKey(log.status)}`) : log.status).toUpperCase()}</Badge>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {log.status === 'collected' && (
                    <button onClick={() => treat(log.id, log.ward + ' ' + log.category)} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] hover:bg-[rgba(238,107,38,0.20)] cursor-pointer">
                      <Sparkles className="inline h-3 w-3 mr-0.5" /> {t('dashboard.treat')}
                    </button>
                  )}
                  {log.status === 'treated' && (
                    <button onClick={() => setHandingOver(log.id)} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer">
                      <Truck className="inline h-3 w-3 mr-0.5" /> {t('dashboard.handOver')}
                    </button>
                  )}
                  {(log.status === 'pending' || log.status === 'collected' || log.status === 'treated') && (
                    <button onClick={() => flagNonCompliant(log.id, 'Manual flag')} title={t('dashboard.flagNonCompliant')} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer">
                      {t('dashboard.flag')}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {collectOpen && <CollectModal onClose={() => setCollectOpen(false)} />}
        {handingOver && <HandoverModal logId={handingOver} onClose={() => setHandingOver(null)} />}
      </AnimatePresence>
    </div>
  )
}
