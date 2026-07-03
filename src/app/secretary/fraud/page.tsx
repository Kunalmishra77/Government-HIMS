'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldAlert, AlertTriangle, CheckCircle, X, Eye } from 'lucide-react'

const FRAUD_CASES = [
  { id: 'fr001', type: 'Duplicate claim', hospital: 'Apollo Bhopal', district: 'Bhopal', amount: 2.4, flaggedBy: 'AI — Claim pattern', date: '2024-06-22', status: 'under-review', riskScore: 92, detail: '3 duplicate PM-JAY claims for same patient on same day at different hospitals' },
  { id: 'fr002', type: 'Upcoding', hospital: 'Medicure Hospital', district: 'Indore', amount: 1.8, flaggedBy: 'AI — Procedure code anomaly', date: '2024-06-20', status: 'under-review', riskScore: 87, detail: 'Procedures coded at higher package level than supported by clinical records' },
  { id: 'fr003', type: 'Ghost beneficiary', hospital: 'City Care Clinic', district: 'Gwalior', amount: 0.9, flaggedBy: 'AI — ABHA mismatch', date: '2024-06-19', status: 'escalated', riskScore: 96, detail: 'Claims filed for beneficiary ABHA IDs with no HMIS visit record' },
  { id: 'fr004', type: 'Phantom surgery', hospital: 'Narmada Hospital', district: 'Jabalpur', amount: 3.2, flaggedBy: 'NHA audit', date: '2024-06-18', status: 'confirmed', riskScore: 99, detail: 'Empanelled hospital claims for 14 cardiac surgeries — no anaesthesia or OT logs found' },
  { id: 'fr005', type: 'Claim after death', hospital: 'Savita Hospital', district: 'Sagar', amount: 0.5, flaggedBy: 'AI — Date mismatch', date: '2024-06-17', status: 'resolved', riskScore: 100, detail: 'Claims submitted 3 days after beneficiary registered death in civil records' },
]

const STATUS_STYLES = {
  'under-review': 'bg-amber-100 text-amber-700',
  escalated: 'bg-accent-soft text-accent',
  confirmed: 'bg-rose-100 text-rose-700',
  resolved: 'bg-emerald-100 text-emerald-700',
}

export default function FraudPage() {
  const t = useTranslations('secretary')
  const [selected, setSelected] = useState<string | null>(null)
  const detail = FRAUD_CASES.find(f => f.id === selected)

  const totalAmount = FRAUD_CASES.reduce((s, f) => s + f.amount, 0)
  const confirmed = FRAUD_CASES.filter(f => f.status === 'confirmed').length
  const pending = FRAUD_CASES.filter(f => f.status === 'under-review' || f.status === 'escalated').length

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('fraud.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('fraud.subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('fraud.kpiFlaggedAmount'), value: `₹${totalAmount.toFixed(1)} Cr`, warn: true },
          { label: t('fraud.kpiPendingReview'), value: String(pending), warn: pending > 2 },
          { label: t('fraud.kpiConfirmedFraud'), value: String(confirmed), warn: confirmed > 0 },
          { label: t('fraud.kpiRecovered'), value: '₹1.2 Cr', warn: false },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-rose-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {FRAUD_CASES.map(f => (
          <div key={f.id} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex-shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black ${f.riskScore >= 95 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{f.riskScore}</div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[f.status as keyof typeof STATUS_STYLES]}`}>{f.status.replace('-', ' ')}</span>
                    <span className="text-[10px] text-[var(--color-foreground-lighter)]">{f.date}</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">{f.type} — {f.hospital}</p>
                  <p className="text-xs text-[var(--color-foreground-muted)]">{f.district} · {f.flaggedBy}</p>
                  <p className="text-xs text-rose-600 font-bold mt-0.5">{t('fraud.atRisk', { amount: f.amount.toFixed(1) })}</p>
                </div>
              </div>
              <button onClick={() => setSelected(selected === f.id ? null : f.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] border border-primary/20 rounded-lg hover:bg-primary-soft flex-shrink-0">
                <Eye className="h-3 w-3" /> {t('common.details')}
              </button>
            </div>
            {selected === f.id && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
                <p className="text-sm text-[var(--color-foreground)]">{f.detail}</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg">{t('fraud.escalateNha')}</button>
                  <button className="px-3 py-1.5 border border-[var(--color-border)] text-xs font-medium rounded-lg">{t('fraud.markFalsePositive')}</button>
                  <button className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg">{t('fraud.dempanel')}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
