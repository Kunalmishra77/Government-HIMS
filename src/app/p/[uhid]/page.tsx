"use client"

// M13.11 — Public family tracking page.
//
// The SMS sent to the attendant from the ER registration form points here:
//   https://agentix.in/p/<uhid>
// Anyone with the link can see live status (no login required, like Apollo /
// Manipal patient-tracking pages). Polls every 10 seconds to feel real-time;
// shows the same journey data the staff portal aggregates, in WhatsApp-style
// chat-bubble format with patient-friendly language.

import { use, useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import {
  Heart, Clock, Phone, Hospital, AlertTriangle, CheckCircle2,
  ClipboardList, Bed, Stethoscope, FlaskConical, ScanLine,
  ShieldCheck, LogOut, Building2, Activity, Ambulance, MessageCircle,
  Lock,
} from "lucide-react"
import { usePatientStore } from "@/store/usePatientStore"
import { useInpatientStore } from "@/store/useInpatientStore"
import { useERStore } from "@/store/useERStore"
import { useFamilyTokenStore } from "@/store/useFamilyTokenStore"
import { validateFamilyToken } from "@/lib/familyToken"
import { aggregateJourney, DEPT_COLOR, type Department, type JourneyEvent } from "@/lib/journeyAggregator"
import { cn } from "@/lib/utils"

const DEPT_ICON: Record<Department, React.ElementType> = {
  Reception: ClipboardList, Emergency: AlertTriangle, Nursing: Activity, Doctor: Stethoscope,
  Lab: FlaskConical, Radiology: ScanLine, Pharmacy: Heart, OT: Building2,
  IPD: Bed, Discharge: LogOut, Billing: Heart, Insurance: ShieldCheck,
}

// Patient-friendly language. Hides clinical jargon ("ESI 2", "qSOFA+") and
// rewrites titles to be reassuring without lying. Critical events still
// surface as red banners with "call us immediately" guidance.
type Translate = ReturnType<typeof useTranslations>

const PUBLIC_REWRITE: Array<[RegExp, string]> = [
  [/^Registered/, "rewrite.registered"],
  [/^ER arrival/, "rewrite.erArrival"],
  [/^Triaged ESI \d/, "rewrite.triaged"],
  [/^Claimed by/, "rewrite.claimed"],
  [/^ER vitals/, "rewrite.erVitals"],
  [/^OPD vitals recorded/, "rewrite.opdVitals"],
  [/^Disposition · Admit/, "rewrite.admit"],
  [/^Disposition · Discharge/, "rewrite.discharge"],
  [/^Disposition · Transfer/, "rewrite.transfer"],
  [/^Lab ordered/, "rewrite.labOrdered"],
  [/^Specimen collected/, "rewrite.specimenCollected"],
  [/^.* released/, "rewrite.released"],
  [/^Imaging ordered/, "rewrite.imagingOrdered"],
  [/^Study acquired/, "rewrite.studyAcquired"],
  [/^Report verified/, "rewrite.reportVerified"],
  [/^OT booked/, "rewrite.otBooked"],
  [/^Surgery started/, "rewrite.surgeryStarted"],
  [/^Surgery completed/, "rewrite.surgeryCompleted"],
  [/^Discharge initiated/, "rewrite.dischargeInitiated"],
  [/^Exit clearance issued/, "rewrite.exitClearance"],
  [/^Claim/, "rewrite.claim"],
]
function publicTitle(t: Translate, title: string): string {
  for (const [re, key] of PUBLIC_REWRITE) if (re.test(title)) return t(key)
  return title
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
const fmtDate = (t: Translate, iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return t('date.today')
  if (d.toDateString() === new Date(today.getTime() - 86400000).toDateString()) return t('date.yesterday')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function groupByDate(t: Translate, events: JourneyEvent[]): { date: string; events: JourneyEvent[] }[] {
  const groups = new Map<string, JourneyEvent[]>()
  for (const e of events) {
    const key = new Date(e.at).toDateString()
    const cur = groups.get(key) ?? []
    cur.push(e)
    groups.set(key, cur)
  }
  return Array.from(groups.entries()).map(([_, list]) => ({
    date: list[0] ? fmtDate(t, list[0].at) : '',
    events: list,
  }))
}

// Centered card shell shared by every gate/loading state.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">{children}</div>
    </div>
  )
}

function LoadingShell() {
  const t = useTranslations('p')
  return (
    <Shell>
      <Hospital className="h-12 w-12 text-emerald-600 mx-auto mb-3 motion-safe:animate-pulse" aria-hidden="true" />
      <p className="text-sm text-slate-500">{t('loading')}</p>
    </Shell>
  )
}

// useSearchParams() must sit inside a Suspense boundary.
export default function FamilyTrackPage({ params }: { params: Promise<{ uhid: string }> }) {
  return (
    <Suspense fallback={<LoadingShell />}>
      <FamilyTrackInner params={params} />
    </Suspense>
  )
}

function FamilyTrackInner({ params }: { params: Promise<{ uhid: string }> }) {
  const t = useTranslations('p')
  const { uhid } = use(params)
  // Up-case so /p/pt-44012 and /p/PT-44012 both work — matches SMS-link behavior.
  const upUhid = uhid.toUpperCase()
  const router = useRouter()
  // Access token from the SMS link (?t=…). Validated before any PHI renders.
  const token = useSearchParams().get('t')

  // Live polling — re-aggregate every 10s so newly logged events appear.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(iv)
  }, [])

  const revoked = useFamilyTokenStore(s => s.revoked)
  const activeRecord = useFamilyTokenStore(s => s.records[upUhid])
  const validation = useMemo(
    () => validateFamilyToken(token, upUhid, { revoked }),
    [token, upUhid, revoked],
  )

  // Open a staff-issued link in place (the "resend secure link" affordance):
  // navigates to the same page with the active, consented token attached.
  const openWithToken = (t: string) => router.replace(`/p/${uhid}?t=${t}`)
  const consentAndOpen = () => {
    const fam = useFamilyTokenStore.getState()
    const name = validation.payload?.name ?? activeRecord?.name ?? t('patientFallback')
    const famToken = fam.grantConsent(upUhid) ?? fam.issue(upUhid, name, { consent: true })
    openWithToken(famToken)
  }

  const patient    = usePatientStore(s => s.patients.find(p => p.id === upUhid))
  const inpatient  = useInpatientStore(s => s.inpatients.find(i => i.patientId === upUhid))
  const erRecord   = useERStore(s => s.patients.find(e => e.patientId === upUhid))

  const name = patient?.name ?? inpatient?.name ?? erRecord?.name ?? t('patientFallback')
  const age  = patient?.age  ?? inpatient?.age  ?? erRecord?.age
  const phone = patient?.phone

  const events = useMemo(
    () => aggregateJourney(upUhid, name),
    // tick is intentionally in the dep array — it forces re-aggregation every 10s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upUhid, name, tick],
  )

  const grouped = useMemo(() => groupByDate(t, events), [t, events])
  const lastEvent = events[events.length - 1]
  const currentLocation = useMemo(() => {
    if (inpatient && inpatient.stage !== 'discharged') return t('location.bed', { ward: inpatient.ward, bed: inpatient.bed })
    if (erRecord && erRecord.phase !== 'disposed') return t('location.emergency', { area: erRecord.area ?? t('location.triage') })
    if (patient && patient.queueStatus !== 'done') return t('location.opd', { department: patient.department })
    return t('location.visitComplete')
  }, [t, inpatient, erRecord, patient])

  const criticalEvent = useMemo(
    () => events.find(e => e.severity === 'critical' && Date.now() - new Date(e.at).getTime() < 4 * 3600000),
    [events],
  )

  // ── Access gate ─────────────────────────────────────────────────────────
  // Validate the link's token BEFORE revealing any patient data — the UHID
  // alone is not a credential. (Frontend pattern; a real backend enforces the
  // same payload via HMAC + a route handler.)
  if (!validation.ok) {
    // A staff-issued, consented, still-valid link exists in this session —
    // offer to open it (the "resend secure link" affordance). Validity
    // (signature, expiry, consent, revocation) is checked via the lib.
    const fallback = activeRecord
      && validateFamilyToken(activeRecord.token, upUhid, { revoked }).ok
      ? activeRecord
      : undefined

    if (validation.reason === 'no-consent') {
      return (
        <Shell>
          <ShieldCheck className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900">{t('consent.title')}</h1>
          <p className="text-sm text-slate-500 mt-2">
            {t.rich('consent.body', {
              name: validation.payload?.name ?? t('consent.thisPatient'),
              b: (chunks) => <span className="font-bold">{chunks}</span>,
            })}
          </p>
          <button onClick={consentAndOpen}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
            <CheckCircle2 className="h-4 w-4" />{t('consent.button')}
          </button>
          <p className="text-[11px] text-slate-400 mt-3">{t('consent.note')}</p>
        </Shell>
      )
    }

    const expired = validation.reason === 'expired'
    return (
      <Shell>
        <Lock className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-slate-900">{expired ? t('gate.expiredTitle') : t('gate.requiredTitle')}</h1>
        <p className="text-sm text-slate-500 mt-2">
          {expired ? t('gate.expiredBody') : t('gate.requiredBody')}
        </p>
        {fallback ? (
          <button onClick={() => openWithToken(fallback.token)}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
            <ShieldCheck className="h-4 w-4" />{t('gate.openSecure')}
          </button>
        ) : (
          <a href="tel:+918012340000"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
            <Phone className="h-4 w-4" />{t('gate.resendLink')}
          </a>
        )}
        <p className="text-[11px] text-slate-400 mt-3 font-mono">{upUhid}</p>
      </Shell>
    )
  }

  if (!patient && !inpatient && !erRecord) {
    return (
      <Shell>
        <Hospital className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-slate-900">{t('notFound.title')}</h1>
        <p className="text-sm text-slate-500 mt-2">
          {t.rich('notFound.body', {
            uhid: upUhid,
            sample: 'PT-XXXXX',
            mono: (chunks) => <span className="font-mono font-bold">{chunks}</span>,
            sampleMono: (chunks) => <span className="font-mono">{chunks}</span>,
          })}
        </p>
        <a href="tel:+918012340000" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">
          <Phone className="h-4 w-4" />{t('notFound.call')}
        </a>
      </Shell>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50">
      {/* Header — WhatsApp-y green */}
      <div className="bg-emerald-600 text-white px-4 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base truncate">{name}</p>
              <p className="text-[11px] opacity-90 truncate flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-pulse" aria-hidden="true" />
                {currentLocation}
              </p>
            </div>
            <a href="tel:+918012340000"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold transition">
              <Phone className="h-3 w-3" />{t('header.hospital')}
            </a>
            <LocaleToggle />
          </div>
          <p className="text-[10px] opacity-80 mt-1.5">
            {t('header.meta', {
              uhid: upUhid,
              ageSuffix: age ? t('header.ageSuffix', { age }) : '',
              phoneSuffix: phone ? t('header.phoneSuffix', { phone }) : '',
            })}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-3 space-y-3">
        {/* Authorization banner — confirms this link is consented + time-boxed */}
        {validation.ok && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
            <p className="text-[11px] text-emerald-800">
              {t('authorized', {
                date: fmtDate(t, new Date(validation.payload.exp).toISOString()),
                time: fmtTime(new Date(validation.payload.exp).toISOString()),
              })}
            </p>
          </div>
        )}

        {/* Critical banner (recent only) */}
        {criticalEvent && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-red-900">{publicTitle(t, criticalEvent.title)}</p>
              <p className="text-[11px] text-red-700 mt-0.5">{t('critical.concern')}</p>
            </div>
          </div>
        )}

        {/* Latest status card — announced to assistive tech as it updates */}
        {lastEvent && (
          <div aria-live="polite" className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-slate-400 mb-1">
              <Activity className="h-3 w-3" />{t('latest.label')}
            </div>
            <p className="text-sm font-bold text-slate-900">{publicTitle(t, lastEvent.title)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5" suppressHydrationWarning>
              {t('latest.by', { time: fmtTime(lastEvent.at), actor: lastEvent.actor ?? t('latest.defaultActor') })}
            </p>
          </div>
        )}

        {/* Patient-side care info */}
        {inpatient && (
          <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">{t('care.title')}</p>
            <div className="flex items-center gap-2 text-[12px]">
              <Stethoscope className="h-3.5 w-3.5 text-[var(--color-accent)] flex-shrink-0" />
              <span><b className="text-slate-700">{t('care.doctor')}</b> {inpatient.admittingDoctor}</span>
            </div>
            <div className="flex items-center gap-2 text-[12px]">
              <Bed className="h-3.5 w-3.5 text-[var(--color-accent)] flex-shrink-0" />
              <span><b className="text-slate-700">{t('care.room')}</b> {t('care.roomValue', { ward: inpatient.ward, bed: inpatient.bed })}</span>
            </div>
            {inpatient.expectedDischarge && (
              <div className="flex items-center gap-2 text-[12px]">
                <Clock className="h-3.5 w-3.5 text-[var(--color-accent)] flex-shrink-0" />
                <span><b className="text-slate-700">{t('care.expectedHome')}</b> {inpatient.expectedDischarge}</span>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp-style timeline */}
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <p className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />{t('timeline.title')}
            </p>
          </div>
          <div role="log" aria-label={t('timeline.ariaLabel')} className="p-4 space-y-3 max-h-[60vh] overflow-y-auto" style={{ background: 'linear-gradient(180deg,#FAF7F0,#F5F0E5)' }}>
            {events.length === 0 && (
              <p className="text-center text-xs text-slate-500 py-8">
                {t('timeline.empty')}
              </p>
            )}
            {grouped.map(({ date, events: list }) => (
              <div key={date}>
                <div className="flex items-center justify-center my-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-sm">{date}</span>
                </div>
                {list.map((e, i) => {
                  const Icon = DEPT_ICON[e.dept] ?? Activity
                  const color = DEPT_COLOR[e.dept]
                  return (
                    <div key={`${e.at}-${i}`} className="flex gap-2 mb-2">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: color }}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div className={cn("flex-1 min-w-0 rounded-xl p-2.5 shadow-sm",
                        e.severity === 'critical' ? 'bg-red-50 border border-red-200'
                        : e.severity === 'warning' ? 'bg-amber-50 border border-amber-200'
                        : e.severity === 'success' ? 'bg-emerald-50 border border-emerald-200'
                        : 'bg-white border border-slate-200')}>
                        <p className="text-[12px] font-bold text-slate-900">{publicTitle(t, e.title)}</p>
                        {e.actor && <p className="text-[10px] text-slate-500 mt-0.5">{e.actor}</p>}
                        <p className="text-[10px] text-slate-400 mt-0.5" suppressHydrationWarning>{fmtTime(e.at)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Hospital contact card */}
        <div className="rounded-2xl bg-emerald-600 text-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-emerald-100">{t('help.label')}</p>
          <p className="text-sm font-bold mt-0.5">{t('help.reception')}</p>
          <p className="text-[11px] text-emerald-100">{t('help.body')}</p>
          <a href="tel:+918012340000"
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-white text-emerald-700 font-bold text-[12px]">
            <Phone className="h-3 w-3" />{t('help.phone')}
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-400 py-2">
          {t('footer')}
        </p>
      </div>
    </div>
  )
}
