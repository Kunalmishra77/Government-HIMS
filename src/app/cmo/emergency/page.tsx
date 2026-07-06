"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { cn } from '@/lib/utils'

type MCIType = 'rta' | 'disaster' | 'outbreak' | null

export default function CmoEmergencyPage() {
  const t = useTranslations('cmo')
  const CASUALTY_LEVELS = [t('emergency.casualtyLevels.p1'), t('emergency.casualtyLevels.p2'), t('emergency.casualtyLevels.p3'), t('emergency.casualtyLevels.p4')]
  const [active, setActive] = useState<MCIType>(null)
  const [surgeActivated, setSurgeActivated] = useState(false)
  const [surgeBeds, setSurgeBeds] = useState(0)
  const [casualties, setCasualties] = useState<{name:string;triage:string}[]>([])
  const [form, setForm] = useState({ name: '', triage: CASUALTY_LEVELS[0] })
  const [staffAck, setStaffAck] = useState(0)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CmoPageHeader title={t('emergency.title')} subtitle={t('emergency.subtitle')} />

      {!active ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-6">
          <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">🚨</span>
          </div>
          <div>
            <p className="text-[18px] font-bold text-slate-900">{t('emergency.noActive')}</p>
            <p className="text-[13px] text-slate-500 mt-1">{t('emergency.noActiveHint')}</p>
          </div>
          <div className="flex gap-4 justify-center flex-wrap">
            {[
              { type: 'rta' as MCIType, label: t('emergency.rtaLabel'), desc: t('emergency.rtaDesc') },
              { type: 'disaster' as MCIType, label: t('emergency.disasterLabel'), desc: t('emergency.disasterDesc') },
              { type: 'outbreak' as MCIType, label: t('emergency.outbreakLabel'), desc: t('emergency.outbreakDesc') },
            ].map(opt => (
              <button key={opt.type} onClick={() => { setActive(opt.type); toast.success(t('emergency.modeActivated', { label: opt.label })) }}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-red-200 hover:border-red-500 hover:bg-red-50 transition-all w-48">
                <span className="text-[20px]">{opt.label}</span>
                <span className="text-[11px] text-slate-500">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-red-600 text-white rounded-xl px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold">{t('emergency.mciModeActive', { type: active.toUpperCase() })}</p>
              <p className="text-red-200 text-[12px]">{t('emergency.activatedAt', { time: new Date().toLocaleTimeString('en-IN') })}</p>
            </div>
            <button onClick={() => { setActive(null); setSurgeBeds(0); setCasualties([]) }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white text-red-700 hover:bg-red-50">
              {t('emergency.deactivate')}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: t('emergency.bedsAvailable'), value: `${247 + surgeBeds}` },
              { label: t('emergency.surgeBedsActivated'), value: surgeBeds.toString() },
              { label: t('emergency.otsAvailable'), value: '3 of 5' },
              { label: t('emergency.surgeonsOnCall'), value: '4' },
              { label: t('emergency.ventilatorsFree'), value: '11' },
              { label: t('emergency.bloodONeg'), value: '89 units' },
            ].map(item => (
              <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-3">
                <p className="text-[11px] text-slate-500">{item.label}</p>
                <p className="text-[22px] font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setSurgeBeds(s => s + 50); toast.success(t('emergency.surgeBedsToast')) }}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
              {t('emergency.activateSurgeBeds')}
            </button>
            <button onClick={() => { setStaffAck(s => s + 3); toast.success(t('emergency.surgeonsPagedToast')) }}
              className="text-[12px] font-semibold px-4 py-2 rounded-lg bg-secondary text-white hover:bg-secondary-light">
              {t('emergency.pageAllSurgeons', { ack: staffAck > 0 ? `(${staffAck} ack)` : '' })}
            </button>
          </div>

          {/* Casualty intake */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[13px] font-bold text-slate-900 mb-3">{t('emergency.triageBoard')}</p>
            <div className="flex gap-2 mb-4">
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder={t('emergency.patientNameId')}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-red-400" />
              <select value={form.triage} onChange={e => setForm(f => ({...f, triage: e.target.value}))}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-[12px] bg-white focus:outline-none">
                {CASUALTY_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
              <button onClick={() => { if(form.name) { setCasualties(c => [...c, form]); setForm({name:'', triage: CASUALTY_LEVELS[0]}); toast.success(t('emergency.casualtyLogged')) }}}
                className="text-[11px] font-semibold px-3 py-1.5 bg-red-600 text-white rounded-lg">{t('emergency.log')}</button>
            </div>
            <div className="space-y-1">
              {casualties.map((c, i) => (
                <div key={i} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-[12px]',
                  c.triage.startsWith('P1') ? 'bg-red-50 text-red-800' :
                  c.triage.startsWith('P2') ? 'bg-amber-50 text-amber-800' :
                  c.triage.startsWith('P3') ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600')}>
                  <span className="font-bold">{c.triage.split(' — ')[0]}</span>
                  <span>{c.name}</span>
                </div>
              ))}
              {casualties.length === 0 && <p className="text-[12px] text-slate-400 py-2 text-center">{t('emergency.noCasualties')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
