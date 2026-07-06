"use client"

import { Select } from "@/components/ui/Select"
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

const STORE_KEY = 'reception-setup'
import { Settings, Building2, Volume2, MessageSquare, Save } from "lucide-react"
import { cn } from "@/lib/utils"

const CARD = "rounded-2xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06),0_4px_16px_rgba(15,23,42,0.04)] p-5"
const DEPTS = ['General Medicine', 'Cardiology', 'Orthopaedics', 'Gynaecology', 'ENT', 'Ophthalmology', 'Dermatology', 'Paediatrics']

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-pressed={on} className={cn("h-6 w-11 rounded-full transition-colors flex-shrink-0 relative", on ? "bg-[var(--color-primary)]" : "bg-slate-200")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  )
}
function Row({ icon: Icon, title, desc, on, onToggle }: { icon: React.ElementType; title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="h-9 w-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center flex-shrink-0"><Icon className="h-4.5 w-4.5" /></span>
      <div className="flex-1 min-w-0"><p className="text-[13.5px] font-semibold text-slate-900">{title}</p><p className="text-[12px] text-slate-500">{desc}</p></div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  )
}

export default function ReceptionSetup() {
  const t = useTranslations('reception')
  const [counter, setCounter] = useState('Counter 1')
  const [dept, setDept] = useState('General Medicine')
  const [autoAnnounce, setAutoAnnounce] = useState(true)
  const [printToken, setPrintToken] = useState(true)
  const [whatsapp, setWhatsapp] = useState(true)
  const [sms, setSms] = useState(false)
  const [aiTriage, setAiTriage] = useState(true)

  // Load saved preferences after mount (localStorage is client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (typeof s.counter === 'string') setCounter(s.counter)
      if (typeof s.dept === 'string') setDept(s.dept)
      if (typeof s.autoAnnounce === 'boolean') setAutoAnnounce(s.autoAnnounce)
      if (typeof s.printToken === 'boolean') setPrintToken(s.printToken)
      if (typeof s.whatsapp === 'boolean') setWhatsapp(s.whatsapp)
      if (typeof s.sms === 'boolean') setSms(s.sms)
      if (typeof s.aiTriage === 'boolean') setAiTriage(s.aiTriage)
    } catch { /* ignore corrupt prefs */ }
  }, [])

  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ counter, dept, autoAnnounce, printToken, whatsapp, sms, aiTriage })) } catch { /* ignore */ }
    toast.success(t('setup.preferencesSavedToast'))
  }

  return (
    <div className="max-w-2xl mx-auto pb-6">
      <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">{t('setup.title')}</h1>
      <p className="text-[13px] text-slate-500 mt-0.5 mb-4">{t('setup.subtitle')}</p>

      <div className="space-y-4">
        <div className={CARD}>
          <h3 className="text-[15px] font-bold text-slate-900 mb-3 flex items-center gap-2"><Building2 className="h-4.5 w-4.5 text-[var(--color-accent)]" /> {t('setup.thisCounter')}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">{t('setup.counterName')}</label>
              <input value={counter} onChange={e => setCounter(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">{t('setup.defaultDepartment')}</label>
              <Select value={dept} onChange={e => setDept(e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20">
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
          </div>
        </div>

        <div className={CARD}>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1 flex items-center gap-2"><Volume2 className="h-4.5 w-4.5 text-[var(--color-accent)]" /> {t('setup.queueAndAnnouncements')}</h3>
          <div className="divide-y divide-slate-50">
            <Row icon={Volume2} title={t('setup.autoAnnounceTitle')} desc={t('setup.autoAnnounceDesc')} on={autoAnnounce} onToggle={() => setAutoAnnounce(v => !v)} />
            <Row icon={Settings} title={t('setup.printTokenTitle')} desc={t('setup.printTokenDesc')} on={printToken} onToggle={() => setPrintToken(v => !v)} />
            <Row icon={Settings} title={t('setup.aiTriageTitle')} desc={t('setup.aiTriageDesc')} on={aiTriage} onToggle={() => setAiTriage(v => !v)} />
          </div>
        </div>

        <div className={CARD}>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1 flex items-center gap-2"><MessageSquare className="h-4.5 w-4.5 text-green-600" /> {t('setup.patientCommunication')}</h3>
          <div className="divide-y divide-slate-50">
            <Row icon={MessageSquare} title={t('setup.whatsappTitle')} desc={t('setup.whatsappDesc')} on={whatsapp} onToggle={() => setWhatsapp(v => !v)} />
            <Row icon={MessageSquare} title={t('setup.smsTitle')} desc={t('setup.smsDesc')} on={sms} onToggle={() => setSms(v => !v)} />
          </div>
        </div>

        <button onClick={save} className="w-full h-11 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition">
          <Save className="h-4.5 w-4.5" /> {t('setup.savePreferences')}
        </button>
      </div>
    </div>
  )
}
