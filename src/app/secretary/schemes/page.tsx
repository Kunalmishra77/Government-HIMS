'use client'

import { useTranslations } from 'next-intl'
import { ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react'

const PMJAY_DISTRICTS = [
  { name: 'Bhopal', claims: 4821, amount: 8.2, fraudFlags: 3 },
  { name: 'Indore', claims: 5240, amount: 9.1, fraudFlags: 8 },
  { name: 'Gwalior', claims: 3180, amount: 5.8, fraudFlags: 2 },
  { name: 'Jabalpur', claims: 2940, amount: 5.2, fraudFlags: 5 },
  { name: 'Rewa', claims: 1820, amount: 3.1, fraudFlags: 1 },
]

const STATE_SCHEMES = [
  { name: 'Mukhyamantri Bal Hriday Upachar Yojana', hi: 'मुख्यमंत्री बाल हृदय उपचार योजना', beneficiaries: 4820, amount: '₹28.4 Cr', status: 'Active' },
  { name: 'Sanjeevani Sahayata Kosh', hi: 'संजीवनी सहायता कोष', beneficiaries: 12300, amount: '₹45.2 Cr', status: 'Active' },
  { name: 'Deen Dayal Antyodaya Upchaar Yojana', hi: 'दीन दयाल अंत्योदय उपचार योजना', beneficiaries: 89000, amount: '₹180 Cr', status: 'Active' },
  { name: 'JSY (Janani Suraksha Yojana)', hi: 'जननी सुरक्षा योजना', beneficiaries: 312000, amount: '₹94.6 Cr', status: 'Active' },
]

export default function SchemesPage() {
  const t = useTranslations('secretary')
  const totalClaims = PMJAY_DISTRICTS.reduce((s, d) => s + d.claims, 0)
  const totalAmount = PMJAY_DISTRICTS.reduce((s, d) => s + d.amount, 0)
  const totalFraud = PMJAY_DISTRICTS.reduce((s, d) => s + d.fraudFlags, 0)

  return (
    <div className="p-6 space-y-5 max-w-screen-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('schemes.title')}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('schemes.subtitle')}</p>
      </div>

      {/* PM-JAY KPIs */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-3">{t('schemes.pmjayTitle')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('schemes.kpiClaimsToday'), value: totalClaims.toLocaleString(), sub: t('schemes.kpiClaimsTodaySub') },
            { label: t('schemes.kpiAmountToday'), value: `₹${totalAmount.toFixed(1)} Cr`, sub: t('schemes.kpiAmountTodaySub') },
            { label: t('schemes.kpiFraudFlags'), value: String(totalFraud), sub: t('schemes.kpiFraudFlagsSub'), warn: true },
            { label: t('schemes.kpiRejection'), value: '6.2%', sub: t('schemes.kpiRejectionSub') },
          ].map(k => (
            <div key={k.label} className="bg-white border border-[var(--color-border)] rounded-xl p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
              <p className="text-xs text-[var(--color-foreground-muted)]">{k.label}</p>
              <p className={`text-2xl font-bold mt-1 ${k.warn ? 'text-amber-600' : 'text-[var(--color-foreground)]'}`}>{k.value}</p>
              <p className="text-xs text-[var(--color-foreground-lighter)]">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[var(--color-border)] rounded-2xl overflow-auto" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">{t('schemes.districtSnapshot')}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-foreground-muted)]">{t('common.district')}</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-foreground-muted)]">{t('schemes.colClaims')}</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-foreground-muted)]">{t('schemes.colAmount')}</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-foreground-muted)]">{t('schemes.colFraudFlags')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {PMJAY_DISTRICTS.map(d => (
              <tr key={d.name} className="hover:bg-[var(--color-surface-raised)]">
                <td className="px-5 py-3 font-medium text-[var(--color-foreground)]">{d.name}</td>
                <td className="px-5 py-3 text-right text-[var(--color-foreground)]">{d.claims.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-bold text-[var(--color-foreground)]">₹{d.amount.toFixed(1)}</td>
                <td className={`px-5 py-3 text-right font-bold ${d.fraudFlags > 4 ? 'text-rose-600' : d.fraudFlags > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{d.fraudFlags}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* State schemes */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-3">{t('schemes.stateSchemes')}</h2>
        <div className="space-y-3">
          {STATE_SCHEMES.map(s => (
            <div key={s.name} className="bg-white border border-[var(--color-border)] rounded-xl p-4 flex items-center justify-between" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div>
                <p className="text-sm font-medium text-[var(--color-foreground)]">{s.name}</p>
                <p className="text-[10px] text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{s.hi}</p>
                <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">{t('schemes.beneficiaries', { count: s.beneficiaries.toLocaleString() })}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--color-foreground)]">{s.amount}</p>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
