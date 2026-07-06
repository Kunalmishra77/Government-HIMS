"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import { useBloodBankStore, type BloodGroup, type BloodComponent } from "@/store/useBloodBankStore"
import { Package, Plus, X, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { BadgeVariant } from "@/components/ui/badge"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const COMPONENTS: BloodComponent[] = ['Whole Blood', 'Packed RBC', 'Fresh Frozen Plasma', 'Platelets', 'Cryoprecipitate']
const DEFAULT_EXPIRY_DAYS: Record<BloodComponent, number> = {
  'Whole Blood': 35,
  'Packed RBC': 42,
  'Fresh Frozen Plasma': 365,
  'Platelets': 5,
  'Cryoprecipitate': 365,
}

function AddUnitModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('bloodbank')
  const addUnit = useBloodBankStore((s) => s.addUnit)
  const [group, setGroup] = useState<BloodGroup>('O+')
  const [component, setComponent] = useState<BloodComponent>('Packed RBC')
  const [bagNumber, setBagNumber] = useState(`BAG-${Math.floor(Math.random() * 9000) + 1000}`)
  const [donorId, setDonorId] = useState('')
  const [collectedOn, setCollectedOn] = useState(new Date().toISOString().slice(0, 10))

  const expiresOn = (() => {
    const d = new Date(collectedOn); d.setDate(d.getDate() + DEFAULT_EXPIRY_DAYS[component]); return d.toISOString().slice(0, 10)
  })()

  function submit() {
    if (!donorId.trim() || !bagNumber.trim()) { toast.error(t('inventory.bagAndDonorRequired')); return }
    const id = addUnit({ bloodGroup: group, component, bagNumber: bagNumber.trim(), donorId: donorId.trim(), collectedOn, expiresOn })
    notifyAndAudit({
      to: 'blood_bank', type: 'system', priority: 'low',
      title: t('inventory.newUnitTitle'),
      body: t('inventory.newUnitBody', { component, group, donorId, bagNumber, expiresOn }),
      audit: { action: 'blood_issue', resource: 'blood_unit', resourceId: id, detail: t('inventory.auditRegistered', { group, component, bagNumber }), userName: 'Blood bank tech' },
    })
    toast.success(t('inventory.bagRegistered', { bagNumber }))
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{t('inventory.registerNewUnit')}</h2>
          <button onClick={onClose} aria-label={t('inventory.close')} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('inventory.bloodGroup')}</label>
              <Select value={group} onChange={e => setGroup(e.target.value as BloodGroup)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('inventory.component')}</label>
              <Select value={component} onChange={e => setComponent(e.target.value as BloodComponent)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {COMPONENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('inventory.bagNumber')}</label>
              <input value={bagNumber} onChange={e => setBagNumber(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('inventory.donorId')}</label>
              <input value={donorId} onChange={e => setDonorId(e.target.value)} placeholder={t('inventory.donorIdPlaceholder')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('inventory.collectedOn')}</label>
              <input type="date" value={collectedOn} onChange={e => setCollectedOn(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('inventory.expires')}</label>
              <input type="date" value={expiresOn} disabled
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">{t('inventory.cancel')}</button>
          <button onClick={submit} className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-1.5">
            <Package className="h-3.5 w-3.5" /> {t('inventory.register')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function BloodBankInventory() {
  const t = useTranslations('bloodbank')
  const { units, discardUnit } = useBloodBankStore()
  const [adding, setAdding] = useState(false)

  const statusVariant = (s: string): BadgeVariant => {
    if (s === 'available') return 'success'
    if (s === 'reserved') return 'warning'
    if (s === 'issued') return 'primary'
    return 'danger'
  }

  function discard(unitId: string, bag: string) {
    const reason = typeof window !== 'undefined' ? window.prompt(t('inventory.discardPromptTitle', { bag })) : null
    if (!reason || reason.trim().length < 3) return
    discardUnit(unitId, reason.trim())
    notifyAndAudit({
      to: 'admin', type: 'system', priority: 'medium',
      title: t('inventory.discardTitle', { bag }),
      body: t('inventory.discardBody', { bag, reason: reason.trim() }),
      audit: { action: 'blood_issue', resource: 'blood_unit', resourceId: unitId, detail: t('inventory.auditDiscarded', { bag, reason: reason.trim() }), userName: 'Blood bank tech' },
    })
    toast.success(t('inventory.discardedToast', { bag }))
  }

  // M12-B — stock by group (KPIs)
  const available = units.filter(u => u.status === 'available')
  const byGroup = GROUPS.map(g => ({ group: g, count: available.filter(u => u.bloodGroup === g).length }))
  const lowStock = byGroup.filter(s => s.count < 2)

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('inventory.title')}</h2>
          <p className="text-slate-500 text-sm mt-1">{lowStock.length > 0
            ? t('inventory.summaryLow', { total: units.length, available: available.length, low: `${lowStock.length} ${lowStock.length === 1 ? t('inventory.groupSingular') : t('inventory.groupPlural')}` })
            : t('inventory.summaryOk', { total: units.length, available: available.length })}</p>
        </div>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer">
          <Plus className="h-4 w-4" /> {t('inventory.addUnit')}
        </button>
      </div>

      {/* Stock-by-group KPI strip */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {byGroup.map(s => (
          <div key={s.group} className={`rounded-xl p-2.5 text-center ring-1 ${s.count < 2 ? 'ring-rose-300 bg-rose-50' : 'ring-slate-200 bg-white'}`}>
            <p className="text-[18px] font-black text-slate-900">{s.count}</p>
            <p className={`text-[10.5px] font-bold ${s.count < 2 ? 'text-rose-700' : 'text-slate-500'}`}>{s.group}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[t('inventory.colBag'), t('inventory.colBloodGroup'), t('inventory.colComponent'), t('inventory.colCollected'), t('inventory.colExpires'), t('inventory.colStatus'), ''].map((h, hi) => (
                <th key={hi} scope="col" className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {units.map((u) => {
              const daysToExpiry = Math.round((new Date(u.expiresOn).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              const canDiscard = u.status !== 'issued' && u.status !== 'expired'
              return (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.bagNumber}</td>
                  <td className="px-4 py-3 font-bold text-red-700">{u.bloodGroup}</td>
                  <td className="px-4 py-3 text-slate-700">{u.component}</td>
                  <td className="px-4 py-3 text-slate-500">{u.collectedOn}</td>
                  <td className={`px-4 py-3 font-medium ${daysToExpiry < 7 ? 'text-red-600' : 'text-slate-600'}`}>
                    {u.expiresOn} {daysToExpiry < 7 && <span className="text-[10px] ml-1 bg-red-100 text-red-700 px-1 rounded">⚠ {t('inventory.daysBadge', { days: daysToExpiry })}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(u.status)}>{t.has(`inventory.status${u.status.charAt(0).toUpperCase() + u.status.slice(1)}`) ? t(`inventory.status${u.status.charAt(0).toUpperCase() + u.status.slice(1)}`) : u.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canDiscard && (
                      <button onClick={() => discard(u.id, u.bagNumber)}
                        title={t('inventory.discardTooltip')} className="text-[10.5px] font-bold text-rose-700 hover:bg-rose-50 px-2 py-1 rounded cursor-pointer inline-flex items-center gap-1">
                        <Trash2 className="h-3 w-3" /> {t('inventory.discard')}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {adding && <AddUnitModal onClose={() => setAdding(false)} />}
      </AnimatePresence>
    </div>
  )
}
