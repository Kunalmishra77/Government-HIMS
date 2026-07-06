"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useWard, type WardPatient } from "@/lib/useWard"
import { VitalsForm } from "@/components/nurse/VitalsForm"
import { useInpatientStore, type VitalsRecord } from "@/store/useInpatientStore"
import { usePatientProfileStore, type PatientProfile } from "@/store/usePatientProfileStore"
import { FirstVisitWizard } from "@/components/nurse/FirstVisitWizard"
import { ShiftBanner } from "@/components/nurse/ShiftBanner"
import { DischargeClearanceModal } from "@/components/nurse/DischargeClearanceModal"
import { escalate, trendArrow } from "@/lib/escalation"
import { news2FromRecord } from "@/lib/vitals"
import { useDischargeStore } from "@/store/useDischargeStore"
import { useAdmissionStore } from "@/store/useAdmissionStore"
import { useCameraStore } from "@/store/useCameraStore"
import { useAuditStore } from "@/store/useAuditStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useHRStore } from "@/store/useHRStore"
import { OnShiftTeam } from "@/components/clinical/OnShiftTeam"
import { SepsisWatchPanel } from "@/components/nurse/SepsisWatchPanel"
import { CareTeamPresenceCard } from "@/components/clinical/CareTeamPresenceCard"
import { Activity, AlertCircle, Bed, Stethoscope, Clock, CheckCircle, Pill, Droplets, LogOut, ArrowDownToLine, FileText, ShieldAlert, Info, Video, VideoOff, Send, TrendingUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { CompactKPI } from "@/components/ui/CompactKPI"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { news2Token } from "@/lib/statusColors"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

// Avatar tint by triage acuity (inline, not a colour-map const).
const triageAvatar = (level?: string) =>
  level === "Critical" ? "bg-danger" : level === "High" ? "bg-warning" : "bg-brand-amber"

export default function NurseDashboard() {
  const { patients, activeNurses, availableBeds, updateVitals, dismissAlert } = useWard()
  const { initDischarge, dischargeQueue, setClearance } = useDischargeStore()
  const addNursingNote = useInpatientStore(s => s.addNursingNote)

  // Bug C fix — useWard() (above) reads straight off useInpatientStore's
  // inpatients array, which otherwise has no way to learn about a real
  // ipd_stays row (e.g. a patient admitted today) that isn't already in the
  // local seed/mock list. Hydrate once on mount so the nurse ward view shows
  // genuinely-newly-admitted real patients too.
  useEffect(() => {
    void useInpatientStore.getState().hydrateReal()
  }, [])
  const [dischargingPatient, setDischargingPatient] = useState<WardPatient | null>(null)
  const { admissionRequests, beds, markAdmitted } = useAdmissionStore()
  const cameraRequests = useCameraStore((s) => s.requests)

  // M4.2 — Live ward roster widget. Uses HR canonical store.
  const currentUser = useAuthStore(s => s.currentUser)
  const me = useHRStore(s => s.staff.find(x => x.id === currentUser?.id))
  const myDept = me?.department ?? 'General Ward'
  const todayISO = new Date().toISOString().split('T')[0]!
  const currentShift = ((): 'Morning' | 'Evening' | 'Night' => {
    const h = new Date().getHours()
    if (h >= 6 && h < 14) return 'Morning'
    if (h >= 14 && h < 22) return 'Evening'
    return 'Night'
  })()
  const pendingCameraRequests = cameraRequests.filter((r) => r.status === 'pending')
  const approveRequest = useCameraStore((s) => s.approveRequest)
  const declineRequest = useCameraStore((s) => s.declineRequest)
  const log = useAuditStore((s) => s.log)
  const [editingPatient, setEditingPatient] = useState<WardPatient | null>(null)
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null)

  const handleApproveCamera = (requestId: string, patientName: string, wardRoom: string, patientId: string) => {
    approveRequest(requestId, 'Nurse')
    log({
      userId: 'nurse_portal',
      userName: 'Nurse',
      action: 'family_camera_approved',
      resource: 'patient',
      resourceId: patientId,
      detail: `Camera feed approved for ${patientName}'s family in ${wardRoom}`,
    })
    toast.success(`Camera feed approved for ${patientName}'s family`)
  }

  const handleDeclineCamera = (requestId: string, patientName: string, patientId: string) => {
    declineRequest(requestId)
    log({
      userId: 'nurse_portal',
      userName: 'Nurse',
      action: 'family_camera_declined',
      resource: 'patient',
      resourceId: patientId,
      detail: `Camera request declined for ${patientName}`,
    })
    toast.info(`Camera request declined for ${patientName}`)
  }

  const incomingTransfers = admissionRequests.filter(r => r.status === 'Assigned')

  // Nurse completes the nursing clearance → patient is routed to the discharge
  // desk with the nursing pillar cleared, so they can proceed.
  const confirmDischargeClearance = (patient: WardPatient, note?: string) => {
    const alreadyQueued = dischargeQueue.some(d => d.patientId === patient.id)
    if (!alreadyQueued) {
      const ip = inpatients.find(i => i.patientId === patient.id)
      initDischarge({
        patientId: patient.id,
        patientName: patient.name,
        wardBed: patient.bedNumber,
        diagnosis: ip?.diagnosis ?? 'See medical record',
        admittedOn: ip?.admittedAt ?? new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        expectedDischarge: new Date().toISOString(),
        attendingDoctor: ip?.admittingDoctor ?? 'Dr. Priya Nair',
        payerType: 'General',
        condition: patient.condition === 'Discharging' ? 'Stable' : patient.condition === 'Critical' ? 'Critical' : 'Stable',
        ttoMeds: (ip?.meds ?? []).filter(m => m.status === 'active').map(m => ({ name: m.name, dose: m.dose, freq: m.freq, duration: '7 days' })),
      })
    }
    setClearance(patient.id, 'nursing', 'cleared')
    addNursingNote(patient.id, `Nursing discharge clearance completed${note ? `: ${note}` : ''}. Routed to discharge desk.`, 'Anjali Desai')
    log({ userId: 'nurse_portal', userName: 'Anjali Desai', action: 'discharge_nursing_cleared', resource: 'patient', resourceId: patient.id, detail: `Nursing clearance for ${patient.name} → discharge desk` })
    toast.success(`Nursing cleared — ${patient.name} sent to the discharge desk`)
    setDischargingPatient(null)
  }

  const criticalPatients = patients.filter(p => p.condition === 'Critical')

  const inpatients = useInpatientStore(s => s.inpatients)
  const applyProfileClinical = useInpatientStore(s => s.applyProfileClinical)
  const profiles = usePatientProfileStore(s => s.profiles)
  const saveProfile = usePatientProfileStore(s => s.saveProfile)
  const profileDone = (id: string) => !!profiles[id]?.completedAt

  // First ward vitals: complete the profile, sync clinical to the chart, record vitals.
  const handleCompleteProfile = (patient: WardPatient, data: { profile: PatientProfile; vitals: Omit<VitalsRecord, 'id' | 'at'> }) => {
    saveProfile(patient.id, data.profile, 'Anjali Desai')
    applyProfileClinical(patient.id, {
      allergies: data.profile.noKnownAllergies ? ['No known drug allergies'] : data.profile.allergies,
      comorbidities: data.profile.chronicConditions,
    })
    handleSaveVitals(patient.id, data.vitals)
    toast.success(`Profile completed for ${patient.name}`)
  }
  const wardMeta = (id: string) => { const ip = inpatients.find(i => i.patientId === id); return { age: ip?.age ?? 0, gender: ip?.gender ?? 'Male' } }
  const wardInitial = (id: string): Partial<PatientProfile> => {
    const ip = inpatients.find(i => i.patientId === id)
    const nka = (ip?.allergies ?? []).some(a => /no known/i.test(a))
    return {
      noKnownAllergies: nka,
      allergies: nka ? [] : (ip?.allergies ?? []),
      chronicConditions: ip?.comorbidities ?? [],
    }
  }

  const handleEscalate = (id: string) => {
    const ip = inpatients.find(i => i.patientId === id)
    if (!ip) return
    const { doctor } = escalate(ip)
    toast.error(`Escalated ${ip.name} to ${doctor} — AI-SBAR sent to inbox`)
  }

  const handleSaveVitals = (id: string, rec: Omit<VitalsRecord, 'id' | 'at'>) => {
    updateVitals(id, rec)
    // AI auto-escalation: a high early-warning score pages the doctor immediately.
    if (news2FromRecord(rec).band === 'high') {
      const ip = useInpatientStore.getState().inpatients.find(i => i.patientId === id)
      if (ip) { const { doctor } = escalate(ip); toast.error(`High NEWS — auto-escalated ${ip.name} to ${doctor} (AI-SBAR sent)`) }
      else toast.success('Vitals recorded')
    } else {
      toast.success('Vitals recorded')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Shift & assigned ward */}
      <ShiftBanner />

      {/* M4-W6 — S14: Care-Team Presence + Live Handover. Pill-style
          presence + SBAR compose + incoming-handover accept. */}
      <CareTeamPresenceCard ward="Cardiac Care" department="Cardiology" />

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactKPI label="Active Patients" value={patients.length} tone="ok" icon={<Activity className="h-4 w-4 text-success-strong" />} />
        <CompactKPI label="Critical Alerts" value={criticalPatients.length} tone="danger" icon={<AlertCircle className="h-4 w-4 text-danger-strong" />} />
        <CompactKPI label="Available Beds" value={availableBeds} tone="info" icon={<Bed className="h-4 w-4 text-primary" />} />
        <CompactKPI label="Nurses on Duty" value={activeNurses} tone="neutral" icon={<Stethoscope className="h-4 w-4 text-foreground-lighter" />} />
      </div>

      {/* M4.2 — Ward roster: who's on shift with me right now */}
      <Card className="overflow-hidden shadow-sm">
        <div className="p-4">
          <OnShiftTeam
            department={myDept}
            date={todayISO}
            shift={currentShift}
            title={`Your team · ${myDept} · ${currentShift} shift`}
            emptyMessage={`No clinical staff currently rostered for ${myDept} ${currentShift}. Tap to escalate.`}
            roles={['doctor', 'nurse', 'emergency', 'ot']}
          />
        </div>
      </Card>

      {/* AI Sepsis Watch (Track B) */}
      <Card className="overflow-hidden shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-4 w-4 text-danger" />
          <h2 className="t-title text-foreground">AI Sepsis Watch</h2>
        </div>
        <p className="text-xs text-foreground-lighter mb-3">Screen a deteriorating patient against qSOFA; accept to page the doctor and ICU for the Sepsis-6 bundle.</p>
        <SepsisWatchPanel patientName={criticalPatients[0]?.name} />
      </Card>

      {/* Incoming Transfers from OPD/IPD */}
      {incomingTransfers.length > 0 && (
        <Card className="overflow-hidden border-primary/20">
          <div className="px-5 py-4 flex items-center justify-between bg-accent-soft">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-primary">
                <ArrowDownToLine className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="t-title text-primary-dark">Incoming Transfers</h2>
                <p className="text-xs text-primary font-medium">Patients assigned a bed — awaiting arrival</p>
              </div>
            </div>
            <NeonBadge variant="blue" dot pulse>{incomingTransfers.length} incoming</NeonBadge>
          </div>
          <div className="divide-y divide-border-light">
            {incomingTransfers.map((req, i) => {
              const bed = beds.find(b => b.id === req.assignedBedId)
              const bundle = req.bundle
              const isExpanded = expandedBundleId === req.id
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="px-5 py-3 flex items-center gap-4">
                    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs text-white", triageAvatar(req.triageLevel))}>
                      {req.patientName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-foreground">{req.patientName}</p>
                        <span className="text-xs text-foreground-placeholder">{req.patientAge}y · {req.patientGender}</span>
                        {req.triageLevel && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger-strong border border-danger/25">{req.triageLevel}</span>}
                      </div>
                      <p className="text-xs text-foreground-lighter font-medium mt-0.5">{req.diagnosis}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-foreground-placeholder">
                        <span className="flex items-center gap-1"><Bed className="h-3 w-3" />Bed {bed?.bedNumber ?? '—'} · {bed?.ward ?? req.admissionType}</span>
                        <span className="flex items-center gap-1">From: {req.requestedBy}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {bundle && (
                        <button
                          onClick={() => setExpandedBundleId(isExpanded ? null : req.id)}
                          className="p-1.5 rounded-lg text-primary hover:bg-accent-soft transition-colors cursor-pointer"
                          title="View documents"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { markAdmitted(req.id); toast.success(`${req.patientName} marked as arrived`) }}
                        className="u-press flex items-center gap-1.5 text-xs font-bold text-white bg-success hover:bg-success-strong px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Arrived
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && bundle && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden px-5 pb-3 space-y-2 bg-surface-sunken"
                      >
                        {bundle.allergies && (
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-danger-bg">
                            <ShieldAlert className="h-3.5 w-3.5 text-danger mt-0.5 flex-shrink-0" />
                            <p className="text-xs font-semibold text-danger-strong"><span className="font-bold">Allergies:</span> {bundle.allergies}</p>
                          </div>
                        )}
                        {bundle.specialInstructions && (
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-accent-soft">
                            <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-xs font-medium text-primary-dark">{bundle.specialInstructions}</p>
                          </div>
                        )}
                        {bundle.prescriptions.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Pill className="h-3.5 w-3.5 text-primary" />
                            {bundle.prescriptions.map((p, j) => (
                              <span key={j} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-primary border border-primary/20">{p.medicine}</span>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Family Camera Requests */}
      {pendingCameraRequests.length > 0 && (
        <Card className="overflow-hidden border-warning/30">
          <div className="px-5 py-4 flex items-center justify-between bg-warning-bg">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-warning">
                <Video className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="t-title text-brand-amber-strong">Family Camera Requests</h2>
                <p className="text-xs text-brand-amber-strong font-medium">Family members requesting live room camera access</p>
              </div>
            </div>
            <NeonBadge variant="warning" dot pulse>{pendingCameraRequests.length} pending</NeonBadge>
          </div>
          <div className="divide-y divide-border-light">
            {pendingCameraRequests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="px-5 py-3 flex items-center gap-4"
              >
                <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-warning">
                  <Video className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground">{req.patientName}</p>
                  <p className="text-xs text-foreground-lighter">
                    {req.wardRoom} · Requested {new Date(req.requestedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDeclineCamera(req.id, req.patientName, req.patientId)}
                    className="u-press flex items-center gap-1.5 text-xs font-bold text-danger border border-danger/25 bg-danger-bg hover:bg-danger-bg/70 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                  >
                    <VideoOff className="h-3.5 w-3.5" /> Decline
                  </button>
                  <button
                    onClick={() => handleApproveCamera(req.id, req.patientName, req.wardRoom, req.patientId)}
                    className="u-press flex items-center gap-1.5 text-xs font-bold text-white bg-success hover:bg-success-strong px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-colors"
                  >
                    <Video className="h-3.5 w-3.5" /> Approve
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Deterioration & Escalation */}
      {patients.filter(p => p.aiAlert || p.news?.band === 'high').length > 0 && (
        <Card className="p-5 bg-danger-bg/60 border-danger/20" role="alert" aria-live="polite">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-danger" aria-hidden="true" />
            <h2 className="t-title text-danger-strong">AI Deterioration & Escalation</h2>
            <span className="ml-auto text-[11px] font-semibold text-danger">NEWS2 early-warning · auto-escalation on high score</span>
          </div>
          <div className="space-y-3">
            {patients.filter(p => p.aiAlert || p.news?.band === 'high').map(p => {
              const trend = (p.vitalsRecords ?? []).map(r => news2FromRecord(r).score)
              const arrow = trendArrow(trend.map(score => ({ score })))
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap p-3 bg-surface rounded-xl shadow-card border border-danger/25">
                  <div className="flex items-center gap-3 min-w-0">
                    <div>
                      <p className="font-bold text-foreground text-sm">{p.name}</p>
                      <p className="text-xs text-foreground-lighter">{p.bedNumber}</p>
                    </div>
                    {p.aiAlert && <NeonBadge variant="danger">{p.aiAlert}</NeonBadge>}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-right">
                      <p className="text-xs font-bold text-danger flex items-center gap-1 justify-end">
                        <TrendingUp className="h-3 w-3" /> NEWS {trend.join(' → ') || '—'} {trend.length > 1 ? arrow : ''}
                      </p>
                      <p className="text-[11px] text-foreground-lighter">HR {p.vitals.hr} · BP {p.vitals.bp} · {p.lastChecked}</p>
                    </div>
                    <button
                      onClick={() => handleEscalate(p.id)}
                      className="u-press flex items-center gap-1.5 text-xs font-bold text-white bg-danger hover:bg-danger-strong px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition-colors"
                    >
                      <Send className="h-3.5 w-3.5" /> Escalate to doctor
                    </button>
                    <button
                      onClick={() => { dismissAlert(p.id); toast('Alert acknowledged') }}
                      aria-label={`Dismiss alert for ${p.name}`}
                      className="p-1.5 rounded-lg hover:bg-danger-bg transition-colors cursor-pointer group"
                    >
                      <CheckCircle className="h-4 w-4 text-foreground-placeholder group-hover:text-success" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Ward Overview */}
      <div>
        <SectionHeader icon={Activity} title="Ward Overview" count={patients.length} className="mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {patients.map(patient => (
            <Card key={patient.id} className="p-5 flex flex-col justify-between u-lift">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <Link href={`/nurse/patients/${patient.id}`} className="font-bold text-foreground hover:text-primary hover:underline">{patient.name}</Link>
                    <p className="text-sm font-medium text-foreground-lighter flex items-center gap-1 mt-0.5">
                      <Bed className="h-3.5 w-3.5" aria-hidden="true" /> {patient.bedNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <NeonBadge
                      variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'}
                    >
                      {patient.condition}
                    </NeonBadge>
                    {patient.news && (
                      <NeonBadge variant={news2Token(patient.news.band).variant}>NEWS {patient.news.score}</NeonBadge>
                    )}
                  </div>
                </div>

                <div className="bg-surface-sunken rounded-xl p-3 grid grid-cols-3 gap-2 mb-4">
                  {(() => {
                    const r = patient.latestRecord
                    const items: { label: string; value: string; abnormal: boolean }[] = [
                      { label: 'HR',   value: `${patient.vitals.hr} bpm`, abnormal: patient.vitals.hr > 100 || (patient.vitals.hr > 0 && patient.vitals.hr < 50) },
                      { label: 'BP',   value: patient.vitals.bp,          abnormal: r?.systolicBP != null && (r.systolicBP < 100 || r.systolicBP >= 180) },
                      { label: 'SpO2', value: `${patient.vitals.spo2}%`,  abnormal: patient.vitals.spo2 > 0 && patient.vitals.spo2 < 95 },
                      ...(r?.rr != null ? [{ label: 'RR', value: `${r.rr}/min`, abnormal: r.rr < 12 || r.rr > 20 }] : []),
                      { label: 'Temp', value: `${patient.vitals.temp}°F`, abnormal: patient.vitals.temp >= 100.4 },
                      ...(r?.bloodGlucose != null ? [{ label: 'Glucose', value: `${r.bloodGlucose}`, abnormal: r.bloodGlucose < 70 || r.bloodGlucose > 250 }] : []),
                      ...(r?.pain != null ? [{ label: 'Pain', value: `${r.pain}/10`, abnormal: r.pain >= 7 }] : []),
                    ]
                    return items.map(({ label, value, abnormal }) => (
                      <div key={label}>
                        <p className="text-[10px] text-foreground-lighter uppercase tracking-wider font-bold">{label}</p>
                        <p className={cn("font-bold text-sm tabular-nums", abnormal ? 'text-danger' : 'text-foreground')}>
                          {value}
                          {abnormal && <span className="ml-1 text-[9px] bg-danger-bg text-danger px-1 rounded font-bold">!</span>}
                        </p>
                      </div>
                    ))
                  })()}
                </div>
              </div>

              {/* Current meds/IV drips */}
              {((patient.currentMedications?.filter(m => m.status === 'Active') ?? []).length > 0 ||
                (patient.ivDrips?.filter(d => d.status === 'Running') ?? []).length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {patient.currentMedications?.filter(m => m.status === 'Active').map((med, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-accent-soft px-2 py-0.5 rounded-full">
                      <Pill className="h-2.5 w-2.5" /> {med.name}
                    </span>
                  ))}
                  {patient.ivDrips?.filter(d => d.status === 'Running').map((drip, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-accent-soft px-2 py-0.5 rounded-full">
                      <Droplets className="h-2.5 w-2.5" /> {drip.fluid}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-border-light">
                <div className="flex items-center gap-2 text-xs text-foreground-lighter">
                  <Clock className="h-3 w-3" aria-hidden="true" /> {patient.lastChecked}
                  {(patient.rounds?.length ?? 0) > 0 && (
                    <span className="text-success-strong font-medium">· Rounded</span>
                  )}
                  {!(patient.rounds?.length) && (
                    <span className="text-brand-amber-strong font-medium">· Rounds pending</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDischargingPatient(patient)}
                    title="Nursing discharge clearance"
                    className="flex items-center gap-1 text-xs font-bold text-foreground-lighter hover:text-brand-amber-strong hover:bg-warning-bg transition-colors cursor-pointer px-2 py-1 rounded-lg"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Discharge
                  </button>
                  <button
                    onClick={() => setEditingPatient(patient)}
                    className="text-sm font-bold text-success-strong hover:text-success transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-success-bg"
                  >
                    {profileDone(patient.id) ? 'Update Vitals' : 'Complete profile'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Nursing discharge clearance modal */}
      <AnimatePresence>
        {dischargingPatient && (
          <DischargeClearanceModal
            patient={dischargingPatient}
            alreadyQueued={dischargeQueue.some(d => d.patientId === dischargingPatient.id)}
            onClose={() => setDischargingPatient(null)}
            onConfirm={(note) => confirmDischargeClearance(dischargingPatient, note)}
          />
        )}
      </AnimatePresence>

      {/* Vitals / first-visit profile modal */}
      <AnimatePresence>
        {editingPatient && (profileDone(editingPatient.id) ? (
          <VitalsForm
            title={editingPatient.name}
            subtitle={editingPatient.bedNumber}
            priorRecords={editingPatient.vitalsRecords}
            onClose={() => setEditingPatient(null)}
            onSave={(rec) => handleSaveVitals(editingPatient.id, rec)}
          />
        ) : (
          <FirstVisitWizard
            title={editingPatient.name}
            subtitle={editingPatient.bedNumber}
            meta={wardMeta(editingPatient.id)}
            initial={wardInitial(editingPatient.id)}
            onClose={() => setEditingPatient(null)}
            onComplete={(data) => handleCompleteProfile(editingPatient, data)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
