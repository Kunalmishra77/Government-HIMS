"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import { Search, User, Clock, ShieldCheck, ChevronRight, FileText, AlertCircle, CheckCircle, Star } from "lucide-react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import { cn } from "@/lib/utils"
import Link from "next/link"

const DOCTORS = [
  {
    id: 'D1', name: 'Dr. Priya Nair', specialty: 'General Medicine', experience: 14,
    nextSlot: 'Today 10:30 AM', fee: 600, rating: 4.8, reviews: 312, available: true,
    keywords: ['fever', 'cold', 'cough', 'fatigue', 'headache', 'general', 'diabetes', 'hypertension'],
  },
  {
    id: 'D2', name: 'Dr. Rohan Mehta', specialty: 'Cardiology', experience: 18,
    nextSlot: 'Tomorrow 11:00 AM', fee: 1200, rating: 4.9, reviews: 218, available: true,
    keywords: ['chest pain', 'heart', 'palpitation', 'breathlessness', 'bp', 'hypertension', 'ecg'],
  },
  {
    id: 'D3', name: 'Dr. Kiran Joshi', specialty: 'Orthopedics', experience: 12,
    nextSlot: 'Today 02:00 PM', fee: 900, rating: 4.7, reviews: 189, available: true,
    keywords: ['knee pain', 'back pain', 'joint', 'fracture', 'bone', 'spine', 'arthritis'],
  },
  {
    id: 'D4', name: 'Dr. Ananya Bose', specialty: 'Dermatology', experience: 9,
    nextSlot: 'Today 04:00 PM', fee: 800, rating: 4.6, reviews: 145, available: true,
    keywords: ['skin', 'rash', 'acne', 'allergy', 'eczema', 'psoriasis', 'hair loss'],
  },
  {
    id: 'D5', name: 'Dr. Sanjay Mehta', specialty: 'Gastroenterology', experience: 16,
    nextSlot: 'Tomorrow 09:00 AM', fee: 1000, rating: 4.8, reviews: 174, available: true,
    keywords: ['stomach', 'abdomen', 'gastric', 'acidity', 'loose motions', 'vomiting', 'liver', 'jaundice'],
  },
  {
    id: 'D6', name: 'Dr. Vikram Rathore', specialty: 'Neurology', experience: 20,
    nextSlot: 'Tomorrow 10:30 AM', fee: 1400, rating: 4.9, reviews: 203, available: false,
    keywords: ['headache', 'migraine', 'seizure', 'stroke', 'nerve', 'numbness', 'memory'],
  },
]

const SYMPTOM_MAP: Record<string, string[]> = {
  'chest pain': ['Cardiology'],
  'heart': ['Cardiology'],
  'breathlessness': ['Cardiology'],
  'palpitation': ['Cardiology'],
  'knee': ['Orthopedics'],
  'joint': ['Orthopedics'],
  'back pain': ['Orthopedics'],
  'bone': ['Orthopedics'],
  'skin': ['Dermatology'],
  'rash': ['Dermatology'],
  'acne': ['Dermatology'],
  'stomach': ['Gastroenterology'],
  'abdomen': ['Gastroenterology'],
  'vomiting': ['Gastroenterology'],
  'headache': ['Neurology', 'General Medicine'],
  'migraine': ['Neurology'],
  'seizure': ['Neurology'],
  'fever': ['General Medicine'],
  'cough': ['General Medicine'],
  'cold': ['General Medicine'],
}

const INSURERS = [
  { name: 'Star Health Insurance', cashless: true },
  { name: 'HDFC Ergo Health', cashless: true },
  { name: 'Niva Bupa Health', cashless: true },
  { name: 'Care Health Insurance', cashless: true },
  { name: 'Max Bupa Health', cashless: false },
  { name: 'United India Insurance', cashless: false },
  { name: 'New India Assurance', cashless: false },
  { name: 'Oriental Insurance', cashless: true },
]

const DOCS_BY_TYPE: Record<string, string[]> = {
  'OPD Self-Pay': ['photoIdFull', 'prevPrescriptionOptional'],
  'IPD Self-Pay': ['photoId', 'recentBloodReports', 'prevPrescription', 'priorImaging'],
  'Cashless Insurance': ['insuranceCard', 'policyDocument', 'photoId', 'referralLetter', 'prevDischargeSummary'],
  'Corporate / TPA': ['corporateCard', 'employeeId', 'photoId', 'preAuthLetter'],
}

export default function DiscoveryPage() {
  const t = useTranslations('discovery')
  const specialtyLabel = (s: string) => (t.has(`specialty.${s}`) ? t(`specialty.${s}`) : s)
  const visitTypeLabel = (vt: string) => (t.has(`visitType.${vt}`) ? t(`visitType.${vt}`) : vt)
  const docLabel = (d: string) => (t.has(`docs.${d}`) ? t(`docs.${d}`) : d)
  const [query, setQuery] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null)
  const [selectedInsurer, setSelectedInsurer] = useState('')
  const [selectedVisitType, setSelectedVisitType] = useState('OPD Self-Pay')
  const [activeTab, setActiveTab] = useState<'search' | 'eligibility' | 'documents'>('search')

  const specialtyMatches = (() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const specialties = new Set<string>()
    Object.entries(SYMPTOM_MAP).forEach(([keyword, specs]) => {
      if (q.includes(keyword)) specs.forEach(s => specialties.add(s))
    })
    return Array.from(specialties)
  })()

  const filteredDoctors = DOCTORS.filter(doc => {
    if (selectedSpecialty) return doc.specialty === selectedSpecialty
    if (!query.trim()) return true
    const q = query.toLowerCase()
    const matchKeyword = doc.keywords.some(k => q.includes(k) || k.includes(q))
    const matchName = doc.name.toLowerCase().includes(q)
    const matchSpec = doc.specialty.toLowerCase().includes(q)
    return matchKeyword || matchName || matchSpec
  })

  const specialties = Array.from(new Set(DOCTORS.map(d => d.specialty)))
  const insuerer = INSURERS.find(i => i.name === selectedInsurer)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white py-10 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-1">
            <p className="text-[#F58C4E] text-sm font-semibold">{t('brand')}</p>
            <LocaleToggle />
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('hero.title')}</h1>
          <p className="text-[#F58C4E] text-sm mb-6">{t('hero.subtitle')}</p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedSpecialty(null) }}
              placeholder={t('hero.searchPlaceholder')}
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-primary/25 shadow-lg"
            />
          </div>
          {/* Smart specialty suggestion */}
          <AnimatePresence>
            {specialtyMatches.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[#F58C4E] text-xs font-semibold">{t('hero.suggested')}</span>
                {specialtyMatches.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSelectedSpecialty(s); setActiveTab('search') }}
                    className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-full cursor-pointer transition-colors"
                  >
                    {specialtyLabel(s)} →
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Tab nav */}
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1">
          {(['search', 'eligibility', 'documents'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all cursor-pointer",
                activeTab === tab ? "bg-[var(--color-primary)] text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </div>

        {/* Doctor Search Tab */}
        {activeTab === 'search' && (
          <div className="space-y-4">
            {/* Specialty pills */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedSpecialty(null)}
                className={cn("text-sm font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-all",
                  !selectedSpecialty ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {t('search.all')}
              </button>
              {specialties.map(s => (
                <button
                  key={s}
                  onClick={() => setSelectedSpecialty(s)}
                  className={cn("text-sm font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-all",
                    selectedSpecialty === s ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {specialtyLabel(s)}
                </button>
              ))}
            </div>

            {/* Doctor cards */}
            <div className="space-y-3">
              {filteredDoctors.map((doc, i) => (
                <motion.div key={doc.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-[rgba(238,107,38,0.20)] transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-surface-sunken border border-[rgba(238,107,38,0.15)] flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-[var(--color-accent)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900">{doc.name}</p>
                            <p className="text-sm text-slate-500 mt-0.5">{specialtyLabel(doc.specialty)} · {t('search.yrsExp', { years: doc.experience })}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                              <span className="text-xs font-bold text-slate-700">{doc.rating}</span>
                              <span className="text-xs text-slate-400">{t('search.reviews', { count: doc.reviews })}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-slate-900">₹{doc.fee}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{t('search.perVisit')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-green-500" />
                            <span className={cn("text-xs font-semibold", doc.available ? "text-green-600" : "text-slate-500")}>
                              {doc.available ? doc.nextSlot : t('search.fullyBooked')}
                            </span>
                          </div>
                          <Link href="/patient/appointments">
                            <button className="text-xs font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-4 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1">
                              {t('search.book')} <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredDoctors.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">{t('search.emptyTitle')}</p>
                  <p className="text-sm mt-1">{t('search.emptySubtitle')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Eligibility Tab */}
        {activeTab === 'eligibility' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">{t('eligibility.providerLabel')}</label>
              <Select
                value={selectedInsurer}
                onChange={e => setSelectedInsurer(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
              >
                <option value="">{t('eligibility.selectPlaceholder')}</option>
                {INSURERS.map(i => <option key={i.name}>{i.name}</option>)}
              </Select>
            </div>

            <AnimatePresence>
              {selectedInsurer && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  {insuerer?.cashless ? (
                    <div className="flex items-start gap-3 p-5 bg-green-50 border border-green-200 rounded-2xl">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-bold text-green-900">{t('eligibility.cashlessTitle')}</p>
                        <p className="text-sm text-green-700 mt-1">
                          {t('eligibility.cashlessBody', { insurer: insuerer.name })}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-green-800">
                          <li>{t('eligibility.cashlessPoint1')}</li>
                          <li>{t('eligibility.cashlessPoint2')}</li>
                          <li>{t('eligibility.cashlessPoint3')}</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900">{t('eligibility.noCashlessTitle')}</p>
                        <p className="text-sm text-amber-700 mt-1">
                          {t('eligibility.noCashlessBody', { insurer: insuerer?.name ?? '' })}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-amber-800">
                          <li>{t('eligibility.noCashlessPoint1')}</li>
                          <li>{t('eligibility.noCashlessPoint2')}</li>
                          <li>{t('eligibility.noCashlessPoint3')}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 p-4 bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
                      <p className="text-sm font-bold text-[var(--color-primary-dark)]">{t('eligibility.helpdeskTitle')}</p>
                    </div>
                    <p className="text-xs text-[var(--color-accent)]">{t('eligibility.helpdeskBody')}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Document Checklist Tab */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-slate-700 block mb-2">{t('documents.visitTypeLabel')}</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(DOCS_BY_TYPE).map(vt => (
                  <button
                    key={vt}
                    onClick={() => setSelectedVisitType(vt)}
                    className={cn("text-sm font-semibold px-3 py-3 rounded-xl border cursor-pointer transition-all text-left",
                      selectedVisitType === vt ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {visitTypeLabel(vt)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-[var(--color-accent)]" />
                <h3 className="font-bold text-slate-900">{t('documents.heading', { visitType: visitTypeLabel(selectedVisitType) })}</h3>
              </div>
              <ul className="space-y-3">
                {DOCS_BY_TYPE[selectedVisitType].map((doc, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.20)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-[var(--color-accent)]">{i + 1}</span>
                    </div>
                    <span className="text-sm text-slate-700">{docLabel(doc)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-bold mb-1">{t('documents.tipTitle')}</p>
              <p>{t('documents.tipBody')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
