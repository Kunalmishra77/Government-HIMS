'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Siren, AlertTriangle, CheckCircle, Radio, MapPin, Phone, X } from 'lucide-react'

const PROTOCOL_META = [
  { id: 'ep1', nameKey: 'emergency.protoOutbreak', hi: 'बीमारी प्रकोप प्रतिक्रिया', stepsKey: 'emergency.protoOutbreakSteps' },
  { id: 'ep2', nameKey: 'emergency.protoMci', hi: 'सामूहिक हताहत', stepsKey: 'emergency.protoMciSteps' },
  { id: 'ep3', nameKey: 'emergency.protoDisaster', hi: 'प्राकृतिक आपदा', stepsKey: 'emergency.protoDisasterSteps' },
]

const CONTACTS = [
  { name: 'MoHFW Emergency Cell', phone: '011-23061703', type: 'GOI' },
  { name: 'NCDC Surveillance', phone: '011-23921401', type: 'GOI' },
  { name: 'State Control Room', phone: '0755-2441666', type: 'State' },
  { name: 'AIIMS Bhopal', phone: '0755-4293101', type: 'Hospital' },
  { name: 'GMCH Indore', phone: '0731-2535900', type: 'Hospital' },
  { name: 'GRMC Gwalior', phone: '0751-2323812', type: 'Hospital' },
]

export default function EmergencyPage() {
  const t = useTranslations('secretary')
  const [activated, setActivated] = useState(false)
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const proto = PROTOCOL_META.find(p => p.id === selectedProtocol)

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{t('emergency.title')}</h1>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-0.5">{t('emergency.subtitle')}</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 ${activated ? 'bg-rose-50 text-rose-700 border-rose-400 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-300'}`}>
          <Siren className="h-4 w-4" /> {activated ? t('emergency.statusActive') : t('emergency.statusNormal')}
        </div>
      </div>

      {/* Activation banner */}
      {activated && (
        <div className="bg-rose-600 text-white rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Siren className="h-6 w-6 animate-bounce" />
            <div>
              <p className="text-lg font-black">{t('emergency.bannerTitle')}</p>
              <p className="text-sm opacity-80">{t('emergency.bannerActivatedBy', { time: new Date().toLocaleString('en-IN') })}</p>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setActivated(false)} className="px-4 py-2 bg-white text-rose-700 text-sm font-bold rounded-lg hover:bg-rose-50">
              {t('emergency.deactivate')}
            </button>
            <button className="px-4 py-2 bg-rose-800 text-white text-sm font-medium rounded-lg hover:bg-rose-900">
              {t('emergency.notifyAll')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Protocols */}
        <div>
          <h2 className="text-base font-bold text-[var(--color-foreground)] mb-3">{t('emergency.protocolsTitle')}</h2>
          <div className="space-y-3">
            {PROTOCOL_META.map(p => (
              <div key={p.id} className={`bg-white border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${selectedProtocol === p.id ? 'border-[var(--color-primary)] shadow-md' : 'border-[var(--color-border)]'}`}
                onClick={() => setSelectedProtocol(selectedProtocol === p.id ? null : p.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-foreground)]">{t(p.nameKey)}</p>
                    <p className="text-xs text-[var(--color-foreground-lighter)]" style={{ fontFamily: 'Noto Sans Devanagari' }}>{p.hi}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setSelectedProtocol(p.id); setConfirmOpen(true) }}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700">
                    {t('emergency.activate')}
                  </button>
                </div>
                {selectedProtocol === p.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-foreground-muted)] mb-2">{t('emergency.protocolSteps')}</p>
                    {(t.raw(p.stepsKey) as string[]).map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--color-foreground)] mb-1.5">
                        <span className="flex-shrink-0 h-4 w-4 rounded-full bg-[var(--color-primary)] text-white text-[10px] flex items-center justify-center mt-0.5">{i + 1}</span>{s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Emergency contacts */}
        <div>
          <h2 className="text-base font-bold text-[var(--color-foreground)] mb-3">{t('emergency.contactsTitle')}</h2>
          <div className="space-y-2">
            {CONTACTS.map(c => (
              <div key={c.name} className="flex items-center justify-between bg-white border border-[var(--color-border)] rounded-xl px-4 py-3" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div>
                  <p className="text-sm font-medium text-[var(--color-foreground)]">{c.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.type === 'GOI' ? 'bg-surface-sunken text-accent' : c.type === 'State' ? 'bg-accent-soft text-accent' : 'bg-accent-soft text-accent'}`}>{c.type}</span>
                </div>
                <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-[var(--color-accent)] text-sm font-medium hover:underline">
                  <Phone className="h-4 w-4" />{c.phone}
                </a>
              </div>
            ))}
          </div>
          {!activated && (
            <button onClick={() => setConfirmOpen(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition-colors">
              <Siren className="h-5 w-5" /> {t('emergency.declare')}
            </button>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-100 rounded-xl"><AlertTriangle className="h-5 w-5 text-rose-600" /></div>
              <h3 className="text-base font-bold text-[var(--color-foreground)]">{t('emergency.confirmTitle')}</h3>
            </div>
            <p className="text-sm text-[var(--color-foreground-muted)] mb-4">
              {proto ? t('emergency.confirmProtocol', { name: t(proto.nameKey) }) : t('emergency.confirmDeclare')}
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setActivated(true); setConfirmOpen(false) }}
                className="flex-1 py-2.5 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700">{t('emergency.confirm')}</button>
              <button onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 border border-[var(--color-border)] text-sm rounded-xl">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
