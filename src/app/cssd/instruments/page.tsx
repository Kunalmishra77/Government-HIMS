"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useCSSDStore, type InstrumentStatus, type Instrument } from "@/store/useCSSDStore"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle2, Droplets, Activity, Box } from "lucide-react"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

const TRANSITIONS: Record<InstrumentStatus, { next: InstrumentStatus; labelKey: string; icon: React.ElementType; tone: string }[]> = {
  dirty:        [{ next: 'clean',      labelKey: 'markCleaned',  icon: Droplets,     tone: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]' }],
  clean:        [{ next: 'sterilizing', labelKey: 'sendToCycle', icon: Activity,     tone: 'bg-amber-600 hover:bg-amber-700' }],
  sterilizing:  [],   // status flips automatically on completeCycle
  ready:        [{ next: 'in_use',     labelKey: 'issueToOt',    icon: Box,          tone: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]' }],
  in_use:       [{ next: 'dirty',      labelKey: 'returnedDirty', icon: CheckCircle2, tone: 'bg-slate-600 hover:bg-slate-700' }],
}

export default function CSSDInstruments() {
  const t = useTranslations("cssd.instruments")
  const { instruments, updateInstrument } = useCSSDStore()
  const [filter, setFilter] = useState<'all' | InstrumentStatus>('all')

  const shown = filter === 'all' ? instruments : instruments.filter((i) => i.status === filter)
  const counts = instruments.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] ?? 0) + 1
    return acc
  }, {} as Record<InstrumentStatus, number>)

  function advance(i: Instrument, next: InstrumentStatus, label: string) {
    updateInstrument(i.id, { status: next, lastSterilizedAt: next === 'ready' ? new Date().toISOString() : i.lastSterilizedAt })
    if (next === 'ready') {
      notifyAndAudit({
        to: 'ot', type: 'system', priority: 'medium',
        title: t('notifyReadyTitle', { name: i.name }),
        body: t('notifyReadyBody', { name: i.name, category: i.category }),
        audit: { action: 'cssd_cycle_passed', resource: 'instrument', resourceId: i.id, detail: t('notifyReadyDetail', { name: i.name }), userName: 'CSSD' },
      })
    }
    toast.success(t('toastAdvanced', { name: i.name, label: label.toLowerCase() }))
  }

  return (
    <div className="space-y-5 pt-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('title')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(['all','dirty','clean','sterilizing','ready','in_use'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} cursor-pointer`}>
              {f === 'all' ? t('filterAll') : t.has(`instStatus.${f}`) ? t(`instStatus.${f}`) : f.toUpperCase().replace('_',' ')} {f !== 'all' ? `· ${counts[f] ?? 0}` : `· ${instruments.length}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((ins) => (
          <div key={ins.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{ins.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ins.category}</p>
              </div>
              <Badge variant={ins.status === 'ready' ? 'success' : ins.status === 'in_use' ? 'primary' : ins.status === 'sterilizing' ? 'warning' : 'danger'}>
                {t.has(`instStatus.${ins.status}`) ? t(`instStatus.${ins.status}`) : ins.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <p>{t('quantity')} <span className="font-semibold">{ins.quantity}</span></p>
              {ins.lastSterilizedAt && <p>{t('lastSterilized')} <span className="font-semibold">{new Date(ins.lastSterilizedAt).toLocaleString()}</span></p>}
              {ins.assignedOT && <p>{t('assignedTo')} <span className="font-semibold text-[var(--color-accent)]">{ins.assignedOT}</span></p>}
            </div>
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {TRANSITIONS[ins.status].map((tr) => {
                const trLabel = t(tr.labelKey)
                return (
                  <button key={tr.labelKey} onClick={() => advance(ins, tr.next, trLabel)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-white ${tr.tone} cursor-pointer`}>
                    <tr.icon className="h-3 w-3" /> {trLabel}
                  </button>
                )
              })}
              {ins.status === 'sterilizing' && <span className="text-[10.5px] text-slate-400 italic">{t('autoFlips')}</span>}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="col-span-full p-6 text-center text-sm text-slate-400 bg-slate-50 rounded-xl">
            {t('emptyFilter', { status: filter === 'all' ? t('filterAll') : t.has(`instStatus.${filter}`) ? t(`instStatus.${filter}`) : filter.toUpperCase().replace('_',' ') })}
          </div>
        )}
      </div>
    </div>
  )
}
