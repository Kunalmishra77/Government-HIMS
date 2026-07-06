"use client"

import { Select } from "@/components/ui/Select"
import { useState } from "react"
import { useInsuranceStore } from "@/store/useInsuranceStore"
import { usePatientStore } from "@/store/usePatientStore"
import { useBillingStore } from "@/store/useBillingStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { ShieldCheck, IndianRupee, FileText, CheckCircle, AlertTriangle, Sparkles, X, ChevronRight, ArrowRight, Send, Activity, Hourglass, User, ShieldAlert, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { motion, AnimatePresence } from "framer-motion"
import { LiveCashlessMonitor } from "@/components/insurance/LiveCashlessMonitor"
import Link from "next/link"
import { cn } from "@/lib/utils"

const INSURERS = [
  'Star Health Insurance', 'HDFC Ergo Health', 'Niva Bupa Health',
  'Care Health Insurance', 'Max Bupa Health', 'United India Insurance',
  'New India Assurance', 'National Insurance', 'Oriental Insurance',
]

type VerifyResult = {
  valid: boolean
  insurer: string
  accepted: boolean
  preAuthLimit: number
  remaining: number
  aiProbability: number
  covered: string[]
  notCovered: string[]
}

function mockVerify(cardNumber: string, insurer: string): VerifyResult {
  const prefix = cardNumber.replace(/\D/g, '').slice(0, 2)
  const valid = cardNumber.replace(/\D/g, '').length >= 8
  const acceptedInsuers = ['Star Health Insurance', 'HDFC Ergo Health', 'Niva Bupa Health', 'Care Health Insurance', 'Max Bupa Health']
  const accepted = acceptedInsuers.includes(insurer)
  const probability = accepted && valid ? Math.floor(65 + parseInt(prefix || '10') % 30) : 35

  return {
    valid, insurer, accepted,
    preAuthLimit: 500000,
    remaining: 320000,
    aiProbability: valid ? probability : 10,
    covered: ['General Medicine', 'Cardiology', 'Orthopedics', 'Emergency', 'Surgery', 'ICU'],
    notCovered: ['Cosmetic procedures', 'Dental', 'Optical', 'OPD Outpatient (basic)'],
  }
}

function VerificationPanel() {
  const [cardNumber, setCardNumber] = useState('')
  const [insurer, setInsurer] = useState(INSURERS[0])
  const [patientName, setPatientName] = useState('')
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'result'>('idle')
  const [result, setResult] = useState<VerifyResult | null>(null)

  const handleVerify = async () => {
    if (!cardNumber.trim()) return
    setVerifyState('verifying')
    await new Promise(r => setTimeout(r, 1600))
    setResult(mockVerify(cardNumber, insurer))
    setVerifyState('result')
  }

  const reset = () => { setVerifyState('idle'); setResult(null); setCardNumber(''); setPatientName('') }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[rgba(238,107,38,0.07)]/80 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Insurance Card Verification</h2>
            <p className="text-xs text-slate-500">AI-powered coverage check & hospital acceptance</p>
          </div>
        </div>
        {verifyState === 'result' && (
          <button onClick={reset} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {verifyState !== 'result' ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Card Number *</label>
                <input
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  placeholder="e.g. SH12345678"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Insurer</label>
                <Select
                  value={insurer}
                  onChange={e => setInsurer(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]"
                >
                  {INSURERS.map(i => <option key={i}>{i}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Patient Name (optional)</label>
                <input
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]"
                />
              </div>
            </div>
            <button
              onClick={handleVerify}
              disabled={!cardNumber.trim() || verifyState === 'verifying'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {verifyState === 'verifying' ? (
                <><Sparkles className="h-4 w-4 animate-pulse" /> AI Verifying...</>
              ) : (
                <><ShieldCheck className="h-4 w-4" /> Verify Coverage <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          </motion.div>
        ) : result && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={`rounded-xl p-5 ${result.valid && result.accepted ? 'bg-green-50/70' : result.valid ? 'bg-amber-50/70' : 'bg-red-50/70'}`}>
              {/* Status header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-white shadow-sm`}>
                    {result.valid && result.accepted
                      ? <CheckCircle className="h-5 w-5 text-green-600" />
                      : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{result.insurer}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      Card {result.valid ? 'Valid' : 'Invalid'} ·
                      <span className={result.accepted ? ' text-green-600' : ' text-red-600'}>
                        {result.accepted ? ' ✓ Accepted by Agentix HIMS' : ' ✗ Not accepted at this hospital'}
                      </span>
                    </p>
                  </div>
                </div>
                <NeonBadge variant={result.valid && result.accepted ? 'success' : result.valid ? 'warning' : 'danger'}>
                  {result.valid && result.accepted ? 'Verified' : result.valid ? 'Partial' : 'Invalid'}
                </NeonBadge>
              </div>

              {result.valid && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Pre-Auth Limit</p>
                    <p className="text-lg font-black text-slate-900">₹{(result.preAuthLimit / 100000).toFixed(1)}L</p>
                  </div>
                  <div className="bg-white/80 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Remaining Balance</p>
                    <p className="text-lg font-black text-slate-900">₹{(result.remaining / 100000).toFixed(1)}L</p>
                  </div>
                </div>
              )}

              {/* AI probability */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-[var(--color-accent)]" /> AI Approval Probability
                  </p>
                  <span className={`text-sm font-black ${result.aiProbability > 75 ? 'text-green-700' : result.aiProbability > 50 ? 'text-amber-700' : 'text-red-700'}`}>
                    {result.aiProbability}%
                  </span>
                </div>
                <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.aiProbability}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full ${result.aiProbability > 75 ? 'bg-green-500' : result.aiProbability > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                </div>
              </div>

              {/* Coverage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-1.5">✓ Covered</p>
                  {result.covered.map(c => <p key={c} className="text-xs text-slate-700 font-medium">{c}</p>)}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1.5">✗ Not Covered</p>
                  {result.notCovered.map(c => <p key={c} className="text-xs text-slate-500">{c}</p>)}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

export default function InsuranceDashboard() {
  const { totalClaimsValue, pendingApprovals, claims } = useInsuranceStore()
  const patients = usePatientStore(s => s.patients)
  const bills = useBillingStore(s => s.bills)
  const inpatients = useInpatientStore(s => s.inpatients)

  // M13.6 — pipeline counts for the cashless-case lifecycle strip.
  // Sources: walk-in flag (usePatientStore.insurer), inpatient cashless billing,
  // and existing claims (mapped to lifecycle stages).
  const cashlessWalkIns = patients.filter(p => !!p.insurer).length
  const cashlessInpatients = inpatients.filter(ip => {
    const b = bills.find(b => b.patientId === ip.patientId)
    return b?.payerType?.toLowerCase().includes('cashless')
  }).length
  const preAuthPending = claims.filter(c => c.status === 'Pending Pre-Auth' || (c.status === 'In Process' && c.submissionStatus !== 'submitted')).length
  const preAuthApproved = claims.filter(c => c.status === 'Approved' && c.submissionStatus !== 'submitted').length
  const claimSubmitted = claims.filter(c => c.submissionStatus === 'submitted' && c.status !== 'Approved').length
  const settled = claims.filter(c => c.status === 'Approved' && (c.approvedAmount ?? 0) > 0 && c.submissionStatus === 'submitted').length
  const denied = claims.filter(c => c.status === 'Rejected').length

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">TPA & Insurance Desk</h1>
          <p className="text-sm text-slate-500">Cashless workflows and AI claim optimization</p>
        </div>
      </div>

      {/* M13.6 — Cashless claim-lifecycle pipeline strip.
          Seven stages mirror what an insurance coordinator actually tracks:
          Cashless registered → Pre-auth pending → Approved → Claim submitted →
          Settled, plus the two exception tiles (Query / Denied) on the right. */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--color-accent)]" />Cashless claim lifecycle
          </h2>
          <Link href="/insurance/claims" className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
            All claims <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 items-stretch">
          {[
            { label: 'Cashless',     sub: 'Registered (intake)',  count: cashlessWalkIns + cashlessInpatients, color: 'border-amber-200 bg-amber-50',     icon: User,         fg: 'text-amber-700',   href: '/insurance/dashboard#monitor', cta: 'Monitor' },
            { label: 'Pre-auth',     sub: 'Pending insurer',      count: preAuthPending,                       color: 'border-primary/20 bg-primary-soft',   icon: Hourglass,    fg: 'text-accent',  href: '/insurance/preauth',           cta: 'Draft' },
            { label: 'Approved',     sub: 'In stay · claim soon', count: preAuthApproved,                      color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',       icon: ShieldCheck,  fg: 'text-[var(--color-accent)]',    href: '/insurance/claims',            cta: 'Submit' },
            { label: 'Submitted',    sub: 'Awaiting settlement',  count: claimSubmitted,                       color: 'border-[rgba(238,107,38,0.20)] bg-[rgba(238,107,38,0.07)]',   icon: Send,         fg: 'text-[var(--color-accent)]',  href: '/insurance/claims',            cta: 'Track' },
            { label: 'Settled',      sub: 'Paid by insurer',      count: settled,                              color: 'border-emerald-200 bg-emerald-50', icon: CheckCircle2, fg: 'text-emerald-700', href: '/insurance/claims',            cta: 'Reconcile' },
            { label: 'Query',        sub: 'Insurer queries',      count: claims.filter(c => c.aiDenialRisk && c.aiDenialRisk.score >= 70 && c.status === 'In Process').length, color: 'border-red-200 bg-red-50', icon: AlertTriangle, fg: 'text-red-700', href: '/insurance/claims', cta: 'Reply' },
            { label: 'Denied',       sub: 'Claim rejected',       count: denied,                               color: 'border-slate-200 bg-slate-50',     icon: ShieldAlert,  fg: 'text-slate-600',   href: '/insurance/claims',            cta: 'Appeal' },
          ].map((s, i, arr) => (
            <Link key={s.label} href={s.href}
              className={cn("relative rounded-xl border p-3 hover:shadow-md transition flex flex-col gap-1 cursor-pointer group", s.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <s.icon className={cn("h-4 w-4 flex-shrink-0", s.fg)} />
                  <p className={cn("text-xs font-bold truncate", s.fg)}>{s.label}</p>
                </div>
                {i < arr.length - 1 && <ChevronRight className="absolute -right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 hidden lg:block" />}
              </div>
              <p className={cn("text-2xl font-bold leading-none", s.fg)}>{s.count}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.sub}</p>
              <p className={cn("text-[10px] font-bold mt-1 inline-flex items-center gap-0.5 group-hover:underline", s.fg)}>
                {s.cta} <ArrowRight className="h-2.5 w-2.5" />
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* M13.6 — Live cashless monitor.
          Cross-store aggregation of every cashless case with current stage,
          aging vs SLA, and the action that should happen next. Anchored at
          #monitor for the pipeline-strip "Monitor" links. */}
      <div id="monitor">
        <LiveCashlessMonitor />
      </div>

      {/* Health Card Verification */}
      <VerificationPanel />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Claims Value',    value: `₹${(totalClaimsValue / 100000).toFixed(2)}L`, icon: IndianRupee, cardBg: 'bg-[rgba(238,107,38,0.07)]/70',   ib: 'text-[var(--color-accent)]',   lb: 'text-[var(--color-primary-dark)]/60' },
          { label: 'Pending Pre-Auth',      value: pendingApprovals,                               icon: FileText,    cardBg: 'bg-amber-50/70',  ib: 'text-amber-600',  lb: 'text-amber-800/60' },
          { label: 'Active Cashless Patients', value: claims.filter(c => c.status !== 'Approved' && c.status !== 'Rejected').length, icon: ShieldCheck, cardBg: 'bg-[rgba(238,107,38,0.07)]/70', ib: 'text-[var(--color-accent)]', lb: 'text-[var(--color-primary-dark)]/60' },
        ].map(({ label, value, icon: Icon, cardBg, ib, lb }) => (
          <div key={label} className={`rounded-xl ${cardBg} p-4 flex items-center gap-4`}>
            <div className="p-3 rounded-xl bg-white shadow-sm flex-shrink-0">
              <Icon className={`h-5 w-5 ${ib}`} />
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${lb}`}>{label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Active Claims Pipeline</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Claim ID</th>
                <th className="px-6 py-4 font-semibold">Patient & Provider</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">AI Approval Prob.</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map(claim => (
                <tr key={claim.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{claim.id}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{claim.patientName}</p>
                    <p className="text-xs text-slate-500">{claim.provider}</p>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">₹{claim.amount.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      claim.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      claim.status === 'Pending Pre-Auth' ? 'bg-amber-50 text-amber-800' :
                      claim.status === 'Rejected' ? 'bg-red-50 text-red-800' :
                      'bg-[rgba(238,107,38,0.07)] text-[var(--color-primary-dark)]'
                    }`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {claim.aiProbability && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-24">
                          <div
                            className={`h-full ${claim.aiProbability > 80 ? 'bg-green-500' : claim.aiProbability > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${claim.aiProbability}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500">{claim.aiProbability}%</span>
                        {claim.aiProbability < 50 && (
                          <span title="AI flagged: low approval probability">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold rounded-md transition-colors cursor-pointer">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
