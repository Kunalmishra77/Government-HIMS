"use client"
import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CmoPageHeader } from '@/components/cmo/layout/CmoPageHeader'
import { cn } from '@/lib/utils'

const TAB_KEYS = ['communication.tabBroadcast', 'communication.tabVideo', 'communication.tabEscalate']

const RECIPIENT_OPTIONS: { value: string; key: string }[] = [
  { value: 'All BMOs', key: 'communication.recipientOptions.allBmos' },
  { value: 'All PHC MOs', key: 'communication.recipientOptions.allPhcMos' },
  { value: 'All CHC In-charges', key: 'communication.recipientOptions.allChcIncharges' },
  { value: 'All Facility Staff', key: 'communication.recipientOptions.allFacilityStaff' },
  { value: 'Custom list', key: 'communication.recipientOptions.customList' },
]

const ESCALATION_OPTIONS: { value: string; key: string }[] = [
  { value: 'PS Health', key: 'communication.escalationRecipients.psHealth' },
  { value: 'Mission Director NHM', key: 'communication.escalationRecipients.missionDirector' },
  { value: 'Director Health Services', key: 'communication.escalationRecipients.directorHealth' },
  { value: 'State Surveillance Officer', key: 'communication.escalationRecipients.stateSurveillance' },
]

export default function CmoCommunicationPage() {
  const t = useTranslations('cmo')
  const [tab, setTab] = useState(0)
  const [broadcast, setBroadcast] = useState({ recipients: 'All BMOs', message: '' })
  const [escalation, setEscalation] = useState({ issue: '', recipient: 'PS Health', data: '' })

  const recipientLabel = (v: string) => RECIPIENT_OPTIONS.find(o => o.value === v)?.key
  const escalationLabel = (v: string) => ESCALATION_OPTIONS.find(o => o.value === v)?.key

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <CmoPageHeader title={t('communication.title')} />
      <div className="flex gap-1 border-b border-slate-200">
        {TAB_KEYS.map((tabKey, i) => (
          <button key={tabKey} onClick={() => setTab(i)}
            className={cn('text-[12px] font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors',
              tab === i ? 'border-border text-accent' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t(tabKey)}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-[13px] font-bold text-slate-900">{t('communication.broadcastMessage')}</p>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1 block">{t('communication.recipients')}</label>
              <select value={broadcast.recipients} onChange={e => setBroadcast(b => ({...b, recipients: e.target.value}))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
                {RECIPIENT_OPTIONS.map(r => <option key={r.value} value={r.value}>{t(r.key)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 font-medium mb-1 block">{t('communication.message')}</label>
              <textarea value={broadcast.message} onChange={e => setBroadcast(b => ({...b, message: e.target.value}))}
                placeholder={t('communication.broadcastPlaceholder')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25 h-28" />
            </div>
            <button disabled={!broadcast.message.trim()}
              onClick={() => { const rk = recipientLabel(broadcast.recipients); setBroadcast(b => ({...b, message: ''})); toast.success(t('communication.broadcastSent', { recipients: rk ? t(rk) : broadcast.recipients })) }}
              className="text-[12px] font-semibold px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary-light disabled:opacity-40">
              {t('communication.sendBroadcast')}
            </button>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <button onClick={() => toast.success(t('communication.videoStarted'))}
            className="text-[13px] font-semibold px-6 py-3 bg-secondary text-white rounded-xl hover:bg-secondary-light w-full">
            {t('communication.startVideo')}
          </button>
          <div className="space-y-2">
            <p className="text-[12px] font-semibold text-slate-700">{t('communication.scheduledConferences')}</p>
            {[
              { title: t('communication.conferences.weeklyBmo'), time: 'Mon 10:00', participants: 12 },
              { title: t('communication.conferences.stateMission'), time: 'Thu 15:00', participants: 28 },
            ].map((vc, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-lg text-[12px]">
                <span className="font-semibold text-slate-900 flex-1">{vc.title}</span>
                <span className="text-slate-500">{vc.time}</span>
                <span className="text-slate-400">{t('communication.participants', { count: vc.participants })}</span>
                <button onClick={() => toast.success(t('communication.joining'))} className="text-[10px] font-semibold px-2 py-1 bg-secondary text-white rounded">{t('communication.join')}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <p className="text-[13px] font-bold text-slate-900">{t('communication.escalateToState')}</p>
          <div className="space-y-3">
            <textarea value={escalation.issue} onChange={e => setEscalation(es => ({...es, issue: e.target.value}))}
              placeholder={t('communication.escalatePlaceholder')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/25 h-24" />
            <select value={escalation.recipient} onChange={e => setEscalation(es => ({...es, recipient: e.target.value}))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[12px] bg-white focus:outline-none">
              {ESCALATION_OPTIONS.map(r => <option key={r.value} value={r.value}>{t(r.key)}</option>)}
            </select>
            <button disabled={!escalation.issue.trim()}
              onClick={() => { const ek = escalationLabel(escalation.recipient); const rl = ek ? t(ek) : escalation.recipient; setEscalation(es => ({...es, issue: ''})); toast.success(t('communication.escalationSent', { recipient: rl, id: Date.now().toString().slice(-4) })) }}
              className="text-[12px] font-semibold px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40">
              {t('communication.sendEscalation', { recipient: (() => { const ek = escalationLabel(escalation.recipient); return ek ? t(ek) : escalation.recipient })() })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
