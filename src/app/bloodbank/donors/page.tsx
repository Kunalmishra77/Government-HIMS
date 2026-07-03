"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import { Heart, Plus, Search, CheckCircle, XCircle, Clock, AlertTriangle, Sparkles, ChevronRight, Droplets, User, Phone, Calendar, Activity } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

interface Donor {
  id: string
  name: string
  bloodGroup: BloodGroup
  age: number
  phone: string
  lastDonation: string | null
  totalDonations: number
  eligible: boolean
  ineligibleReason?: string
  nextEligible?: string
}

const DONORS: Donor[] = [
  { id: 'DN-001', name: 'Arjun Mehta', bloodGroup: 'O+', age: 34, phone: '+91 98765 43210', lastDonation: '2026-02-10', totalDonations: 6, eligible: true },
  { id: 'DN-002', name: 'Priya Sharma', bloodGroup: 'O+', age: 28, phone: '+91 87654 32109', lastDonation: '2026-04-20', totalDonations: 3, eligible: false, ineligibleReason: 'Recent donation (< 90 days)', nextEligible: '2026-07-20' },
  { id: 'DN-003', name: 'Ramesh Kumar', bloodGroup: 'A+', age: 45, phone: '+91 76543 21098', lastDonation: '2025-11-15', totalDonations: 12, eligible: true },
  { id: 'DN-004', name: 'Kavitha Nair', bloodGroup: 'B+', age: 31, phone: '+91 65432 10987', lastDonation: '2026-03-01', totalDonations: 4, eligible: false, ineligibleReason: 'Recent donation (< 90 days)', nextEligible: '2026-06-01' },
  { id: 'DN-005', name: 'Suresh Pillai', bloodGroup: 'AB+', age: 38, phone: '+91 54321 09876', lastDonation: '2025-10-20', totalDonations: 8, eligible: true },
  { id: 'DN-006', name: 'Meena Iyer', bloodGroup: 'O-', age: 26, phone: '+91 43210 98765', lastDonation: '2026-01-05', totalDonations: 2, eligible: true },
  { id: 'DN-007', name: 'Vikram Singh', bloodGroup: 'A-', age: 52, phone: '+91 32109 87654', lastDonation: '2026-04-01', totalDonations: 18, eligible: false, ineligibleReason: 'Medical deferral — hypertension check', nextEligible: '2026-05-20' },
  { id: 'DN-008', name: 'Asha Patel', bloodGroup: 'B-', age: 29, phone: '+91 21098 76543', lastDonation: null, totalDonations: 0, eligible: true },
]

const BLOOD_GROUP_COLORS: Record<BloodGroup, { bg: string; text: string; shadow: string }> = {
  'O+': { bg: 'linear-gradient(135deg, #DC2626, #EF4444)', text: '#fff', shadow: '0 4px 12px rgba(220,38,38,0.35)' },
  'O-': { bg: 'linear-gradient(135deg, #9D174D, #EC4899)', text: '#fff', shadow: '0 4px 12px rgba(157,23,77,0.35)' },
  'A+': { bg: 'linear-gradient(135deg, #D97706, #F59E0B)', text: '#fff', shadow: '0 4px 12px rgba(217,119,6,0.35)' },
  'A-': { bg: 'linear-gradient(135deg, #B45309, #D97706)', text: '#fff', shadow: '0 4px 12px rgba(180,83,9,0.35)' },
  'B+': { bg: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))', text: '#fff', shadow: '0 4px 12px rgba(238,107,38,0.35)' },
  'B-': { bg: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))', text: '#fff', shadow: '0 4px 12px rgba(29,78,216,0.35)' },
  'AB+': { bg: 'linear-gradient(135deg, #059669, #10B981)', text: '#fff', shadow: '0 4px 12px rgba(5,150,105,0.35)' },
  'AB-': { bg: 'linear-gradient(135deg, #065F46, #059669)', text: '#fff', shadow: '0 4px 12px rgba(6,95,70,0.35)' },
}

const AI_FORECAST = [
  { group: 'O+', forecast: 'High', trend: '+28%', reason: 'Upcoming elective surgeries + trauma season', urgent: true },
  { group: 'AB-', forecast: 'Critical', trend: '+45%', reason: 'Universal plasma demand spike forecast', urgent: true },
  { group: 'B+', forecast: 'Moderate', trend: '+12%', reason: 'Scheduled orthopaedic procedures this week', urgent: false },
]

const BLANK_FORM = { name: '', bloodGroup: 'O+' as BloodGroup, age: '', phone: '' }

const FORECAST_LABEL_KEYS: Record<string, string> = { High: 'forecastHigh', Critical: 'forecastCritical', Moderate: 'forecastModerate' }
const FORECAST_REASON_KEYS: Record<string, string> = {
  'O+': 'reasonOPlus',
  'AB-': 'reasonABMinus',
  'B+': 'reasonBPlus',
}
const INELIGIBLE_REASON_KEYS: Record<string, string> = {
  'Recent donation (< 90 days)': 'ineligibleRecent',
  'Medical deferral — hypertension check': 'ineligibleMedical',
}

export default function DonorsPage() {
  const t = useTranslations('bloodbank')
  const [donors, setDonors] = useState<Donor[]>(DONORS)
  const [search, setSearch] = useState('')
  const [filterEligible, setFilterEligible] = useState<'all' | 'eligible' | 'ineligible'>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  const filtered = donors.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.bloodGroup.includes(search.toUpperCase())
    const matchEligible = filterEligible === 'all' || (filterEligible === 'eligible' ? d.eligible : !d.eligible)
    return matchSearch && matchEligible
  })

  const eligible = donors.filter(d => d.eligible).length
  const totalDonations = donors.reduce((a, d) => a + d.totalDonations, 0)

  function registerDonor() {
    if (!form.name || !form.age || !form.phone) {
      toast.error(t('donors.fillRequired'))
      return
    }
    const newDonor: Donor = {
      id: `DN-${String(donors.length + 1).padStart(3, '0')}`,
      name: form.name,
      bloodGroup: form.bloodGroup,
      age: Number(form.age),
      phone: form.phone,
      lastDonation: null,
      totalDonations: 0,
      eligible: true,
    }
    setDonors(prev => [newDonor, ...prev])
    setForm(BLANK_FORM)
    setShowForm(false)
    toast.success(t('donors.registerSuccess', { name: form.name }))
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('donors.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('donors.subtitle', { total: donors.length, eligible })}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', boxShadow: '0 4px 16px rgba(220,38,38,0.3)' }}
        >
          <Plus className="h-4 w-4" /> {t('donors.registerDonor')}
        </button>
      </div>

      {/* AI Demand Forecast */}
      <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, #FFF7ED, #FEF3C7)', boxShadow: '0 2px 12px rgba(217,119,6,0.12)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', color: '#fff' }}>
            <Sparkles className="h-3 w-3" /> {t('donors.aiDemandForecast')}
          </div>
          <span className="text-xs text-amber-700 font-medium">{t('donors.forecastConfidence')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {AI_FORECAST.map(f => (
            <div key={f.group} className="flex items-start gap-3 p-3 rounded-xl bg-white/80" style={{ boxShadow: '0 1px 6px rgba(15,23,42,0.06)' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: BLOOD_GROUP_COLORS[f.group as BloodGroup]?.bg, boxShadow: BLOOD_GROUP_COLORS[f.group as BloodGroup]?.shadow }}>
                {f.group}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {FORECAST_LABEL_KEYS[f.forecast] ? t(`donors.${FORECAST_LABEL_KEYS[f.forecast]}`) : f.forecast}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">{f.trend}</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">{FORECAST_REASON_KEYS[f.group] ? t(`donors.${FORECAST_REASON_KEYS[f.group]}`) : f.reason}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-amber-700 mt-3 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {t('donors.forecastOutreach')}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('donors.totalDonors'), value: donors.length, icon: User, gradient: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-light))', shadow: 'rgba(238,107,38,0.25)' },
          { label: t('donors.eligibleNow'), value: eligible, icon: CheckCircle, gradient: 'linear-gradient(135deg, #059669, #10B981)', shadow: 'rgba(5,150,105,0.3)' },
          { label: t('donors.totalDonations'), value: totalDonations, icon: Droplets, gradient: 'linear-gradient(135deg, #DC2626, #EF4444)', shadow: 'rgba(220,38,38,0.3)' },
          { label: t('donors.deferred'), value: donors.filter(d => !d.eligible).length, icon: Clock, gradient: 'linear-gradient(135deg, #D97706, #F59E0B)', shadow: 'rgba(217,119,6,0.3)' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.gradient, boxShadow: `0 4px 12px ${stat.shadow}` }}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('donors.searchPlaceholder')}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-slate-700 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)' }}
          />
        </div>
        {(['all', 'eligible', 'ineligible'] as const).map(f => (
          <button key={f} onClick={() => setFilterEligible(f)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all capitalize"
            style={filterEligible === f
              ? { background: 'linear-gradient(135deg, #0F172A, #16324A)', color: '#fff', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }
              : { background: '#fff', color: '#64748B', boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }
            }
          >
            {f === 'all' ? t('donors.allDonors') : f === 'eligible' ? t('donors.eligible') : t('donors.deferred')}
          </button>
        ))}
      </div>

      {/* Donor Table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06), 0 8px 32px rgba(15,23,42,0.06)' }}>
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-sm font-bold text-slate-700">{t('donors.donorsShown', { count: filtered.length })}</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {filtered.map((donor, i) => (
            <motion.div
              key={donor.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors group cursor-pointer"
            >
              {/* Blood Group Badge */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                style={{ background: BLOOD_GROUP_COLORS[donor.bloodGroup].bg, boxShadow: BLOOD_GROUP_COLORS[donor.bloodGroup].shadow }}>
                {donor.bloodGroup}
              </div>

              {/* Donor Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-900 text-sm">{donor.name}</p>
                  <span className="text-xs text-slate-400">{donor.id}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <User className="h-3 w-3" /> {t('donors.ageYears', { age: donor.age })}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Phone className="h-3 w-3" /> {donor.phone}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" /> {donor.lastDonation ? t('donors.lastDonation', { date: donor.lastDonation }) : t('donors.neverDonated')}
                  </span>
                </div>
              </div>

              {/* Donations Count */}
              <div className="text-center flex-shrink-0 hidden sm:block">
                <p className="text-lg font-black text-slate-900">{donor.totalDonations}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{t('donors.donations')}</p>
              </div>

              {/* Eligibility */}
              <div className="flex-shrink-0 text-right">
                {donor.eligible ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: 'linear-gradient(135deg, #D1FAE5, #ECFDF5)', color: '#065F46' }}>
                    <CheckCircle className="h-3.5 w-3.5" /> {t('donors.eligible')}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                      <Clock className="h-3.5 w-3.5" /> {t('donors.deferred')}
                    </div>
                    {donor.ineligibleReason && (
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[140px] text-right">{INELIGIBLE_REASON_KEYS[donor.ineligibleReason] ? t(`donors.${INELIGIBLE_REASON_KEYS[donor.ineligibleReason]}`) : donor.ineligibleReason}</p>
                    )}
                    {donor.nextEligible && (
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 text-right">{t('donors.nextEligible', { date: donor.nextEligible })}</p>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Heart className="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">{t('donors.noMatch')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Register Donor Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-md"
              style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{t('donors.registerNewDonor')}</h3>
                  <p className="text-xs text-slate-500">{t('donors.fillEligibility')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">{t('donors.fullName')}</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={t('donors.fullNamePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-300" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">{t('donors.bloodGroupLabel')}</label>
                    <Select value={form.bloodGroup} onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value as BloodGroup }))}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/30 cursor-pointer">
                      {(['O+','O-','A+','A-','B+','B-','AB+','AB-'] as BloodGroup[]).map(g => <option key={g}>{g}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">{t('donors.ageLabel')}</label>
                    <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      type="number" min={18} max={65} placeholder={t('donors.agePlaceholder')}
                      className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">{t('donors.phoneLabel')}</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder={t('donors.phonePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-800 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50">
                  <Activity className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{t('donors.eligibilityNote')}</p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
                  {t('donors.cancel')}
                </button>
                <button onClick={registerDonor}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #DC2626, #EF4444)', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}>
                  {t('donors.registerDonor')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
