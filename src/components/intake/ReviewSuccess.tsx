"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { AlertTriangle, Pencil, CheckCircle, QrCode, Share2, Video, CalendarDays, Clock, Building2, IdCard, Copy, Download, MessageCircle, MessageSquare, MapPin, Ticket } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { NeonBadge } from "@/components/ui/neon-badge"
import { effectiveTriage, consultFee, HOSPITAL, DURATION_OPTIONS, formatApptDate, type IntakeForm, type StepId } from "@/lib/intake/data"
import { speak, spokenTime } from "@/lib/voiceScribe"
import { cn } from "@/lib/utils"

function fmtDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date().toISOString().slice(0, 10)
  if (iso === today) return 'Today'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}


// ── Review ───────────────────────────────────────────────────────────
function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide">{label}</p>
        <button onClick={onEdit} className="text-[#B84A16] text-[12px] font-semibold flex items-center gap-1 active:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] rounded">
          <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
        </button>
      </div>
      {children}
    </div>
  )
}

export function ReviewStep({ form, onEdit }: { form: IntakeForm; onEdit: (id: StepId) => void }) {
  const triage = effectiveTriage(form)
  const isVideo = form.consultationType === 'video'
  const durationLabel = (s: string) => {
    const d = form.symptomDurations[s]
    return d ? DURATION_OPTIONS.find(o => o.value === d)?.label : undefined
  }
  return (
    <div className="h-full overflow-y-auto pr-1 space-y-2.5">
      <div className="bg-white rounded-[16px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-slate-100">
        <Row label="Patient" onEdit={() => onEdit('about')}>
          <p className="text-[15px] text-slate-900 font-medium">{form.name || '—'} <span className="text-slate-400 font-normal text-[13px]">· {form.age || '—'} yrs · {form.gender || '—'}</span></p>
          <p className="text-[13px] text-slate-500">{form.phone || '—'}</p>
        </Row>
        <div className="px-4 py-2.5">
          <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide mb-0.5">Consultation</p>
          <p className="text-[15px] text-slate-900 font-medium flex items-center gap-1.5">
            {isVideo ? <Video className="h-4 w-4 text-[#B84A16]" /> : <Building2 className="h-4 w-4 text-[#B84A16]" />}
            {isVideo ? 'Online video' : 'In-person visit'}
          </p>
          {isVideo && <p className="text-[13px] text-slate-500 mt-0.5">{form.slotDoctor} · {fmtDate(form.slotDate)} {form.slotTime}</p>}
        </div>
        <Row label="Symptoms" onEdit={() => onEdit('symptoms')}>
          {form.symptoms.length === 0
            ? <span className="text-slate-400 text-[14px]">—</span>
            : <div className="flex flex-wrap gap-1.5">
                {form.symptoms.map(s => {
                  const dur = durationLabel(s)
                  return (
                    <span key={s} className="flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded-md bg-slate-100 text-slate-700">
                      {s}
                      {dur && <span className="text-slate-400 font-normal">· {dur}</span>}
                    </span>
                  )
                })}
              </div>
          }
        </Row>
      </div>

      <div className={cn("flex items-center justify-between px-4 py-2.5 rounded-[14px]",
        triage.variant === 'danger' ? 'bg-red-50' : triage.variant === 'warning' ? 'bg-amber-50' : triage.variant === 'orange' ? 'bg-primary-soft' : 'bg-green-50')}>
        <span className="flex items-center gap-2.5">
          <AlertTriangle className={cn("h-5 w-5", triage.color)} aria-hidden="true" />
          <span className="text-[14px] font-bold text-slate-900">AI Priority Match</span>
        </span>
        <NeonBadge variant={triage.variant} dot pulse className="px-3 py-1">{triage.level}</NeonBadge>
      </div>

      {form.dishaConsent && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[rgba(238,107,38,0.07)] rounded-[14px]">
          <QrCode className="h-5 w-5 text-[#B84A16] flex-shrink-0" aria-hidden="true" />
          <p className="text-[13px] text-[#B84A16] font-medium truncate">Family link will be created{form.familyPhone ? ` · ${form.familyPhone}` : ''}</p>
        </div>
      )}
      <p className="text-[12.5px] text-slate-400 px-1">Next: confirm &amp; pay the consultation fee.</p>
    </div>
  )
}

// ── Success ──────────────────────────────────────────────────────────
export function SuccessStep({ form, token, familyToken, wait, uhid, patientId, announce, voice, lang = 'en' }: { form: IntakeForm; token: number; familyToken: string | null; wait: number; uhid?: string; patientId?: string; announce?: boolean; voice?: boolean; lang?: 'en' | 'hi' }) {
  const router = useRouter()
  const isVideo = form.consultationType === 'video'
  const triage = effectiveTriage(form)
  const dotColor = triage.variant === 'danger' ? '#DC2626' : triage.variant === 'warning' ? '#D97706' : triage.variant === 'orange' ? '#C2481A' : '#16A34A'
  const paidLabel = form.payer === 'cashless' ? `Cashless · ${form.insurer || 'insurance'}` : `Paid ₹${consultFee(form)}${form.payMethod === 'counter' ? ' · at counter' : ''}`
  const first = form.name ? form.name.split(' ')[0] : ''
  const firstComma = first ? `, ${first}` : ''   // for inline "All set, Name" copy
  const apptDateLabel = formatApptDate(form.apptDate, lang)
  const apptDateEn = formatApptDate(form.apptDate, 'en')

  useEffect(() => {
    if (!announce) return
    // Online check-in (voice): announce ONLY the appointment + token — no UHID and
    // no fee. The UHID is created at the hospital after Aadhaar verification.
    if (voice) {
      if (lang === 'hi') {
        const hon = first ? `${first} जी` : ''
        const when = `${apptDateLabel}${form.apptTime ? ` को ${spokenTime(form.apptTime, 'hi')}` : ''}`
        speak(`थैंक यू ${hon}। आपकी अपॉइंटमेंट ${when} के लिए बुक हो गई है, और आपका टोकन नंबर ${token} है। हॉस्पिटल आते समय अपना आधार कार्ड और आधार से जुड़ा मोबाइल नंबर साथ ले आइए, ताकि हम आपकी ABHA आईडी वेरिफ़ाई कर सकें, या ज़रूरत हो तो नई बनाकर आपका हॉस्पिटल UHID तैयार कर सकें। थैंक यू।`, 'hi')
      } else {
        const when = `${apptDateEn}${form.apptTime ? ` at ${spokenTime(form.apptTime, 'en')}` : ''}`
        speak(`Thank you${first ? `, ${first}` : ''}. Your appointment is booked for ${when}, and your token number is ${token}. When you visit, please bring your Aadhaar card and the mobile number linked to it, so we can verify your ABHA ID — or create a new one if needed — and generate your hospital UHID. Thank you.`)
      }
      return
    }
    // Typed/kiosk flow keeps the permanent-UHID announcement.
    if (uhid) {
      if (lang === 'hi') {
        speak(`आप रजिस्टर हो गए हैं${first ? `, ${first}` : ''}। आपका यू.एच.आई.डी. है ${uhid}, इसे संभालकर रखिए। आपका टोकन नंबर ${token} है।`, 'hi')
      } else {
        speak(`You are registered${first ? `, ${first}` : ''}. Your UHID is ${uhid.split('').join(' ')}. Please save it for future visits. Your token number is ${token}.`)
      }
    }
  }, [announce, uhid, token, first, voice, lang, apptDateLabel, apptDateEn, form.apptTime])

  // Online check-in slip: appointment + token only (no UHID, no fee — those come
  // later at the hospital after Aadhaar verification).
  const tokenSlip = [
    `${HOSPITAL.fullName}`,
    `Appointment Confirmed`,
    ``,
    `Patient: ${form.name}`,
    `Appointment: ${apptDateEn}${form.apptTime ? ` at ${form.apptTime}` : ''}`,
    `Token Number: ${token}`,
    ...(voice ? [] : [
      patientId ? `Patient ID: ${patientId}` : '',
      uhid ? `UHID: ${uhid}` : '',
      `Department: ${form.departments[0] ?? 'General Medicine'}`,
    ]),
    ``,
    `Please bring your Aadhaar card and the mobile number linked to your Aadhaar.`,
    ``,
    `${HOSPITAL.address}`,
    `${HOSPITAL.phone}`,
  ].filter(Boolean).join('\n')

  const downloadToken = () => {
    const blob = new Blob([tokenSlip], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `token-${token}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const shareToken = () => {
    if (navigator.share) navigator.share({ title: 'Appointment Token', text: tokenSlip }).catch(() => {})
    else navigator.clipboard?.writeText(tokenSlip)
  }

  return (
    <div className={cn("flex-1 min-h-0 px-6 flex flex-col items-center text-center", voice ? "overflow-y-auto justify-start py-6" : "justify-center overflow-y-auto pb-[max(2rem,env(safe-area-inset-bottom))] pt-6")}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
            className="h-[84px] w-[84px] rounded-full flex items-center justify-center bg-green-50 border-[7px] border-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" aria-hidden="true" />
          </motion.div>

          {isVideo ? (
            <>
              <h2 className="text-[30px] leading-tight font-bold text-slate-900 tracking-tight">Video consult booked</h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1 mb-5">All set{firstComma} — {paidLabel}</p>
              <div className="w-full bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 mb-5 text-left">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-2xl bg-[rgba(238,107,38,0.07)] flex items-center justify-center flex-shrink-0"><Video className="h-5.5 w-5.5 text-[#B84A16]" /></span>
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">{form.slotDoctor || 'Your doctor'}</p>
                    <p className="text-[13px] text-slate-500 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(form.slotDate)} · {form.slotTime}</p>
                  </div>
                </div>
                <p className="text-[12.5px] text-slate-400 mt-3">We&apos;ll notify you when your doctor is ready — join the call from your dashboard.</p>
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] font-bold uppercase tracking-wider text-green-600 mt-1">{lang === 'hi' ? 'अपॉइंटमेंट कन्फ़र्म' : 'Appointment Confirmed'}</p>
              <h2 className="text-[44px] leading-none font-bold text-slate-900 tracking-tight mt-1">#{token}</h2>
              <p className="text-[15px] font-medium text-slate-500 mt-1 mb-5">{voice ? `${lang === 'hi' ? 'टोकन' : 'Token'}${firstComma}` : `Check-in complete${firstComma} — ${paidLabel}`}</p>
              {!voice && (
                <div className="w-full bg-white rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] flex divide-x divide-slate-100 mb-5">
                  <div className="flex-1 px-3 py-3.5">
                    <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide mb-1">Priority</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: dotColor }} />
                      <p className={cn("text-[15px] font-bold", triage.color)}>{triage.level}</p>
                    </div>
                  </div>
                  <div className="flex-1 px-3 py-3.5">
                    <p className="text-[11px] uppercase text-slate-400 font-semibold tracking-wide mb-1">Est. wait</p>
                    <p className="text-[18px] font-bold text-slate-900">~{wait} <span className="text-[12px] text-slate-500 font-medium">min</span></p>
                  </div>
                </div>
              )}
            </>
          )}

          {uhid && !voice && (
            <div className="w-full bg-[#EE6B26] rounded-[20px] p-4 shadow-[0_8px_24px_rgba(238,107,38,0.3)] mb-5 flex items-center gap-3">
              <span className="h-11 w-11 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0"><IdCard className="h-6 w-6 text-white" aria-hidden="true" /></span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-white/70">Your permanent UHID</p>
                <p className="text-[20px] font-bold text-white tracking-tight">{uhid}</p>
              </div>
              <button onClick={() => navigator.clipboard?.writeText(uhid)} aria-label="Copy UHID" className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center active:scale-90 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <Copy className="h-4.5 w-4.5 text-white" aria-hidden="true" />
              </button>
            </div>
          )}

          {familyToken && (
            <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] mb-5 flex items-center gap-4">
              <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/family-track/${familyToken}`} size={84} level="M" className="rounded-md flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5"><QrCode className="h-4 w-4 text-[#B84A16]" /> Family tracking</p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Scan for live status. No medical data.</p>
                <button onClick={() => { const url = `${window.location.origin}/family-track/${familyToken}`; if (navigator.share) navigator.share({ title: 'Patient Status', url }); else navigator.clipboard.writeText(url) }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#B84A16] active:opacity-60">
                  <Share2 className="h-3.5 w-3.5" /> Share with family
                </button>
              </div>
            </div>
          )}

          {voice && (
            <>
              <div className="w-full bg-white rounded-[20px] p-4 shadow-[0_4px_16px_rgba(0,0,0,0.05)] mb-4 text-left divide-y divide-slate-100">
                <FinalRow icon={<IdCard className="h-4 w-4 text-[#B84A16]" />} label={lang === 'hi' ? 'मरीज़' : 'Patient'} value={form.name || '—'} />
                <FinalRow icon={<CalendarDays className="h-4 w-4 text-[#B84A16]" />} label={lang === 'hi' ? 'तारीख़' : 'Appointment Date'} value={apptDateEn} />
                <FinalRow icon={<Clock className="h-4 w-4 text-[#B84A16]" />} label={lang === 'hi' ? 'समय' : 'Appointment Time'} value={form.apptTime || '—'} />
                <FinalRow icon={<Ticket className="h-4 w-4 text-[#B84A16]" />} label={lang === 'hi' ? 'टोकन नंबर' : 'Token Number'} value={`#${token}`} />
                <FinalRow icon={<MapPin className="h-4 w-4 text-[#B84A16]" />} label={lang === 'hi' ? 'अस्पताल' : 'Hospital'} value={HOSPITAL.fullName} />
              </div>

              <div className="w-full flex gap-2.5 mb-4">
                <button onClick={downloadToken} className="flex-1 h-12 rounded-2xl font-semibold text-[14px] text-[#B84A16] bg-[rgba(238,107,38,0.08)] flex items-center justify-center gap-2 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]">
                  <Download className="h-4.5 w-4.5" aria-hidden="true" /> Download
                </button>
                <button onClick={shareToken} className="flex-1 h-12 rounded-2xl font-semibold text-[14px] text-[#B84A16] bg-[rgba(238,107,38,0.08)] flex items-center justify-center gap-2 active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]">
                  <Share2 className="h-4.5 w-4.5" aria-hidden="true" /> Share
                </button>
              </div>

              <div className="w-full bg-white rounded-[20px] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.05)] mb-4 flex flex-col gap-2 text-left">
                <p className="inline-flex items-center gap-2 text-[13px] text-slate-700"><MessageCircle className="h-4 w-4 text-green-600" aria-hidden="true" /> WhatsApp confirmation sent{form.phone ? ` to ${form.phone}` : ''}</p>
                <p className="inline-flex items-center gap-2 text-[13px] text-slate-700"><MessageSquare className="h-4 w-4 text-[#B84A16]" aria-hidden="true" /> SMS confirmation sent{form.phone ? ` to ${form.phone}` : ''}</p>
              </div>

              <div className="w-full bg-amber-50 rounded-[20px] p-4 mb-5 text-left flex items-start gap-3">
                <IdCard className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-[12.5px] text-amber-800 leading-snug">
                  Please carry your <span className="font-semibold">Aadhaar</span> or <span className="font-semibold">Ayushman</span> card when you visit, if you have one. If not, that’s absolutely fine — our staff will help you create or verify it during your visit.
                </p>
              </div>
            </>
          )}

          <button onClick={() => router.push('/patient/dashboard')} className="w-full h-14 rounded-2xl font-semibold text-[17px] text-[#0D2032] bg-[#EE6B26] hover:bg-[#C2481A] transition-all shadow-[0_4px_14px_rgba(238,107,38,0.25)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]">
            Go to My Dashboard
          </button>
    </div>
  )
}

function FinalRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-[12px] uppercase tracking-wide font-semibold text-slate-400">{icon}{label}</span>
      <span className="text-[14px] font-semibold text-slate-900 text-right truncate">{value}</span>
    </div>
  )
}
