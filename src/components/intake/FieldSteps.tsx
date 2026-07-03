"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import { User, Phone, AlertTriangle, CreditCard, Camera, CheckCircle, QrCode } from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { ChoiceStep } from "./ChoiceStep"
import { INSURERS, type IntakeForm, type Gender } from "@/lib/intake/data"
import { cn } from "@/lib/utils"

type Update = (patch: Partial<IntakeForm>) => void

/** Name + mobile + age + gender on a single compact screen (no scroll, no autofocus). */
export function AboutStep({ form, update }: { form: IntakeForm; update: Update }) {
  const t = useTranslations("intake")
  const patients = usePatientStore(s => s.patients)
  const phone = form.phone.replace(/\D/g, '')
  const name = form.name.trim().toLowerCase()
  const duplicate = (phone.length < 6 && name.length < 3) ? null : (patients.find(p => {
    const pPhone = p.phone.replace(/\D/g, '')
    if (phone.length === 10 && pPhone === phone) return true
    if (phone.length >= 6 && pPhone.startsWith(phone.slice(0, 6)) && name.length >= 3) {
      return p.name.toLowerCase().includes(name.split(' ')[0])
    }
    return false
  }) ?? null)

  const rowCls = "flex items-center gap-3.5 px-4 h-[56px]"
  const inputCls = "intake-input w-full h-full bg-transparent border-none text-slate-900 text-[17px] font-medium placeholder:text-slate-400 placeholder:font-normal focus:outline-none"

  return (
    <div className="space-y-6 pt-2">
      <div className="bg-white rounded-[22px] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 divide-y divide-slate-100 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#EE6B26] transition-shadow">
        <label className={rowCls}>
          <User className="h-5.5 w-5.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input className={inputCls} placeholder={t('about.fullName')} aria-label={t('about.fullName')} value={form.name} onChange={e => update({ name: e.target.value })} />
        </label>
        <label className={rowCls}>
          <Phone className="h-5.5 w-5.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input className={inputCls} placeholder={t('about.mobile')} aria-label={t('about.mobile')} type="tel" inputMode="tel" maxLength={10} value={form.phone} onChange={e => update({ phone: e.target.value })} />
        </label>
        <label className={rowCls}>
          <span className="text-[13px] font-bold w-[22px] text-center flex-shrink-0 text-slate-400" aria-hidden="true">{t('about.ageShort')}</span>
          <input className={inputCls} placeholder={t('about.age')} aria-label={t('about.age')} type="text" inputMode="numeric" maxLength={3} value={form.age} onChange={e => update({ age: e.target.value.replace(/\D/g, '') })} />
        </label>
      </div>

      <div>
        <p className="text-[13px] uppercase text-slate-400 font-semibold ml-2 mb-2.5 tracking-wide">{t('about.genderLabel')}</p>
        <div className="flex bg-slate-100/80 p-1 rounded-[16px] w-full" role="group" aria-label={t('about.genderLabel')}>
          {(['Male', 'Female', 'Other'] as Gender[]).map(g => {
            const sel = form.gender === g
            return (
              <button
                key={g}
                onClick={() => update({ gender: g })}
                aria-pressed={sel}
                className={cn(
                  "flex-1 h-11 rounded-[12px] text-[15px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] relative",
                  sel ? "text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] bg-white" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <span className="relative z-10">{t(`gender.${g}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {duplicate && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-[14px]">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-bold text-amber-900">{t('about.duplicateTitle', { name: duplicate.name })}</p>
              <p className="text-[12px] text-amber-700 mt-0.5">{t('about.duplicateSub', { id: duplicate.id })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function InsuranceStep({ form, update }: { form: IntakeForm; update: Update }) {
  return (
    <div className="h-full flex flex-col pt-2">
      <div className="flex-shrink-0">
        <div className="bg-white rounded-[22px] shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100 flex items-center gap-3.5 px-4 h-[56px] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[#EE6B26] transition-shadow">
          <CreditCard className="h-5.5 w-5.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <input className="intake-input w-full h-full bg-transparent border-none text-slate-900 text-[17px] font-medium placeholder:text-slate-400 placeholder:font-normal focus:outline-none" placeholder="Health / Insurance card no." aria-label="Insurance card number" value={form.insuranceCardNo} onChange={e => update({ insuranceCardNo: e.target.value })} />
        </div>
        <p className="text-[13px] uppercase text-slate-400 font-semibold ml-2 mt-5 mb-2.5 tracking-wide">Your insurer <span className="text-amber-600 normal-case font-medium">· required</span></p>
      </div>
      <div className="flex-1 min-h-0">
        <ChoiceStep fill options={INSURERS.map(i => ({ value: i, label: i }))} value={form.insurer ? [form.insurer] : []} onChange={v => update({ insurer: v[0] ?? '' })} multi={false} otherEnabled otherPlaceholder="Insurer name…" />
      </div>
    </div>
  )
}

export function ReportsStep({ form, update }: { form: IntakeForm; update: Update }) {
  const t = useTranslations("intake")
  return (
    <div className="space-y-4 pt-2">
      <button
        onClick={() => update({ hasReports: !form.hasReports })}
        aria-pressed={form.hasReports}
        className={cn(
          "w-full flex items-center gap-4 px-5 py-5 rounded-[24px] border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]",
          form.hasReports ? "bg-[#EE6B26] border-[#EE6B26] text-[#0D2032] shadow-[0_8px_24px_rgba(238,107,38,0.3)] scale-[0.99]" : "bg-white border-slate-200 text-slate-900 shadow-[0_2px_12px_rgba(0,0,0,0.03)] active:scale-[0.98]"
        )}
      >
        <span className={cn("h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors", form.hasReports ? "bg-white/20" : "bg-slate-100")}>
          {form.hasReports ? <CheckCircle className="h-6 w-6 text-white" aria-hidden="true" /> : <Camera className="h-6 w-6 text-slate-500" aria-hidden="true" />}
        </span>
        <span className="text-[17px] font-semibold text-left leading-tight">{form.hasReports ? t('reports.yesActive') : t('reports.yes')}</span>
      </button>
      <p className="text-[14px] text-slate-400 text-center">{t('reports.optional')}</p>
    </div>
  )
}

export function FamilyStep({ form, update }: { form: IntakeForm; update: Update }) {
  const t = useTranslations("intake")
  return (
    <div className="space-y-4 pt-2">
      <div className="bg-white rounded-[24px] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100">
        <button onClick={() => update({ dishaConsent: !form.dishaConsent })} aria-pressed={form.dishaConsent} className="w-full flex items-center justify-between px-5 py-4 focus:outline-none active:bg-slate-50 transition-colors">
          <span className="flex items-center gap-4">
            <span className={cn("h-11 w-11 rounded-full flex items-center justify-center flex-shrink-0 transition-colors", form.dishaConsent ? "bg-[rgba(238,107,38,0.12)]" : "bg-slate-100")}>
              <QrCode className={cn("h-6 w-6", form.dishaConsent ? "text-[#B84A16]" : "text-slate-500")} aria-hidden="true" />
            </span>
            <span className="text-left">
              <span className="block text-[17px] font-semibold text-slate-900 leading-tight">{t('family.share')}</span>
              <span className="block text-[13.5px] text-slate-400 mt-1">{t('family.disha')}</span>
            </span>
          </span>
          <span className={cn("h-[30px] w-[50px] rounded-full transition-colors flex-shrink-0 flex items-center px-0.5", form.dishaConsent ? "bg-[#34C759]" : "bg-slate-200")}>
            <span className={cn("block h-[26px] w-[26px] rounded-full bg-white shadow-sm transition-transform", form.dishaConsent ? "translate-x-[20px]" : "translate-x-0")} />
          </span>
        </button>
        <AnimatePresence>
          {form.dishaConsent && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="overflow-hidden border-t border-slate-100">
              <div className="px-5 py-4 flex items-center gap-3.5">
                <Phone className="h-5.5 w-5.5 text-slate-400 flex-shrink-0" aria-hidden="true" />
                <input className="intake-input w-full bg-transparent border-none text-slate-900 text-[17px] font-medium placeholder:text-slate-400 placeholder:font-normal focus:outline-none" placeholder={t('family.phone')} type="tel" inputMode="tel" maxLength={10} aria-label={t('family.phone')} value={form.familyPhone} onChange={e => update({ familyPhone: e.target.value })} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-[14px] text-slate-400 text-center">{t('family.optional')}</p>
    </div>
  )
}
