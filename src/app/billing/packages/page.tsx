"use client"

/* M10-E — Package master: add, edit, and apply packages to a bill.
 *
 * Phase-1 mock: state lives in localStorage. The "Apply to Bill" CTA
 * prompts for a patient/bill id and emits a notifyAndAudit handoff to
 * the billing desk + patient (so it surfaces in the bell).
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X, Save, Receipt } from "lucide-react"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

interface BillingPackage {
  id: string
  name: string
  category: string
  price: number
  includes: string[]
}

const SEED: BillingPackage[] = [
  { id: 'PKG-001', name: 'Maternity Package — Normal Delivery', category: 'Obstetrics',      price:  35000, includes: ['Delivery room', 'Paediatrician visit', 'Nursing care 3 days', 'Basic labs', 'Meals'] },
  { id: 'PKG-002', name: 'Maternity Package — C-Section',        category: 'Obstetrics',      price:  65000, includes: ['OT charges', 'Anaesthesia', 'Surgeon fee', 'Nursing care 5 days', 'Basic labs', 'Meals'] },
  { id: 'PKG-003', name: 'Cardiac Care Package — CABG',           category: 'Cardiology',      price: 320000, includes: ['Surgery', 'ICU 2 days', 'Ward 5 days', 'Implants', 'Cardiac monitoring', 'Physio'] },
  { id: 'PKG-004', name: 'Knee Replacement Package',              category: 'Orthopaedics',    price: 185000, includes: ['Surgery', 'Implant (cemented TKR)', 'Anaesthesia', 'Ward 4 days', 'Physio 5 sessions'] },
  { id: 'PKG-005', name: 'Laparoscopic Cholecystectomy',          category: 'General Surgery', price:  55000, includes: ['OT charges', 'Anaesthesia', 'Ward 2 days', 'Basic labs', 'Meals'] },
]

const LS = 'agentix.billing.packages'

function loadPackages(): BillingPackage[] {
  if (typeof window === 'undefined') return SEED
  try {
    const stored = JSON.parse(localStorage.getItem(LS) ?? 'null')
    return Array.isArray(stored) && stored.length ? stored as BillingPackage[] : SEED
  } catch { return SEED }
}
function savePackages(p: BillingPackage[]) {
  try { localStorage.setItem(LS, JSON.stringify(p)) } catch { /* ignore */ }
}

function PackageFormModal({ initial, onClose, onSave }: { initial: BillingPackage | null; onClose: () => void; onSave: (p: BillingPackage) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'General Surgery')
  const [price, setPrice] = useState(String(initial?.price ?? ''))
  const [includes, setIncludes] = useState((initial?.includes ?? []).join('\n'))

  function submit() {
    if (!name.trim() || !price || isNaN(parseInt(price))) { toast.error('Name + price required'); return }
    const pkg: BillingPackage = {
      id: initial?.id ?? `PKG-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim(),
      category: category.trim(),
      price: parseInt(price),
      includes: includes.split('\n').map(s => s.trim()).filter(Boolean),
    }
    onSave(pkg)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900">{initial ? 'Edit package' : 'New package'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Package name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Price (₹) *</label>
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Includes (one per line)</label>
            <textarea value={includes} onChange={e => setIncludes(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button onClick={submit} className="flex-1 h-10 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function BillingPackages() {
  const [packages, setPackages] = useState<BillingPackage[]>(SEED)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<BillingPackage | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => { setPackages(loadPackages()); setLoaded(true) }, [])

  function persist(next: BillingPackage[]) { setPackages(next); savePackages(next) }
  function save(pkg: BillingPackage) {
    if (editing) persist(packages.map(p => p.id === pkg.id ? pkg : p))
    else persist([pkg, ...packages])
    toast.success(`Package "${pkg.name}" saved`)
    setEditing(null); setCreating(false)
  }
  function applyToBill(pkg: BillingPackage) {
    const patient = typeof window !== 'undefined' ? window.prompt(`Apply "${pkg.name}" (₹${pkg.price.toLocaleString('en-IN')}) to which patient / bill id?`) : null
    if (!patient || patient.trim().length < 2) return
    notifyAndAudit({
      to: 'billing', type: 'system', priority: 'medium',
      title: `Package applied · ${pkg.name}`,
      body: `${pkg.name} (₹${pkg.price.toLocaleString('en-IN')}) applied to ${patient.trim()}. Adjust bill accordingly.`,
      patientName: patient.trim(),
      audit: { action: 'finance_invoice_received', resource: 'billing_package', resourceId: pkg.id, detail: `Applied ${pkg.name} to ${patient.trim()}`, userName: 'Billing desk' },
    })
    toast.success(`Applied to ${patient.trim()} · billing desk notified`)
  }

  if (!loaded) return null

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Package Pricing</h2>
          <p className="text-slate-500 text-sm mt-1">{packages.length} bundled packages — all-inclusive pricing</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer">
          <Plus className="h-4 w-4" /> New Package
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-bold px-2 py-0.5 bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] rounded-full border border-[rgba(238,107,38,0.20)]">{pkg.category}</span>
              <button onClick={() => setEditing(pkg)} className="text-[10.5px] font-semibold text-slate-500 hover:text-[var(--color-accent)] cursor-pointer">Edit</button>
            </div>
            <p className="font-bold text-slate-900 leading-tight mb-2">{pkg.name}</p>
            <p className="text-2xl font-black text-[var(--color-accent)] mb-3">₹{pkg.price.toLocaleString('en-IN')}</p>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Includes</p>
              <ul className="space-y-1">
                {pkg.includes.map((item, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => applyToBill(pkg)}
              className="mt-4 w-full py-2 text-sm font-semibold border border-[rgba(238,107,38,0.20)] text-[var(--color-accent)] rounded-xl hover:bg-[rgba(238,107,38,0.10)] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <Receipt className="h-4 w-4" /> Apply to Bill
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {(creating || editing) && (
          <PackageFormModal initial={editing} onClose={() => { setCreating(false); setEditing(null) }} onSave={save} />
        )}
      </AnimatePresence>
    </div>
  )
}
