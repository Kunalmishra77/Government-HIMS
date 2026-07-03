"use client"

import { use, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { LocaleToggle } from "@/components/ui/LocaleToggle"
import { usePatientStore } from "@/store/usePatientStore"
import { useAuditStore } from "@/store/useAuditStore"
import { useCameraStore } from "@/store/useCameraStore"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { Clock, MapPin, Shield, AlertTriangle, CheckCircle, Activity, Camera, Video, VideoOff, Wifi } from "lucide-react"

const CONDITION_CONFIG = {
  Stable: { color: 'bg-green-100 border-green-300 text-green-800', icon: CheckCircle },
  Monitoring: { color: 'bg-amber-100 border-amber-300 text-amber-800', icon: Activity },
  Critical: { color: 'bg-red-100 border-red-300 text-red-800', icon: AlertTriangle },
  Discharging: { color: 'bg-[rgba(238,107,38,0.12)] border-[rgba(238,107,38,0.30)] text-[var(--color-primary-dark)]', icon: CheckCircle },
}

function CameraFeedStub({ wardRoom }: { wardRoom: string }) {
  const t = useTranslations('family-track')
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
      {/* Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)' }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* Background noise */}
      <div className="absolute inset-0 bg-slate-800" />

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center z-20">
        <div className="text-center">
          <div className="h-16 w-16 bg-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-600">
            <Camera className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">{t('cameraStub.roomCamera')}</p>
          <p className="text-slate-500 text-xs mt-1">{wardRoom}</p>
          <div className="flex items-center gap-1.5 justify-center mt-2">
            <div className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-medium">{t('cameraStub.streamActive')}</span>
          </div>
        </div>
      </div>

      {/* LIVE badge */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-red-600 rounded px-2 py-0.5">
        <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
        <span className="text-white text-[10px] font-bold tracking-widest">{t('cameraStub.live')}</span>
      </div>

      {/* Timestamp */}
      <div className="absolute top-3 right-3 z-30 text-white text-[10px] font-mono bg-black/60 rounded px-2 py-0.5">
        {time.toLocaleTimeString('en-IN', { hour12: false })}
      </div>

      {/* Camera ID */}
      <div className="absolute bottom-3 left-3 z-30 text-slate-400 text-[10px] font-mono bg-black/60 rounded px-2 py-0.5">
        CAM-01 · {wardRoom}
      </div>

      {/* Connection status */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5">
        <Wifi className="h-3 w-3 text-green-400" />
        <span className="text-green-400 text-[10px] font-medium">{t('cameraStub.connected')}</span>
      </div>
    </div>
  )
}

export default function FamilyTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const t = useTranslations('family-track')
  const getPatientByFamilyToken = usePatientStore((s) => s.getPatientByFamilyToken)
  const log = useAuditStore((s) => s.log)
  const requests = useCameraStore((s) => s.requests)
  const requestCamera = useCameraStore((s) => s.requestCamera)
  const endSession = useCameraStore((s) => s.endSession)

  const patient = getPatientByFamilyToken(token)
  const cameraRequest = requests.find((r) => r.familyToken === token && r.status !== 'ended')

  useEffect(() => {
    if (patient) {
      log({
        userId: 'family_portal',
        userName: 'Family Portal',
        action: 'family_portal_view',
        resource: 'patient',
        resourceId: patient.id,
        detail: `Family portal accessed via token for ${patient.name}`,
      })
    }
  }, [patient, log])

  if (!patient || !patient.dishaConsentGiven || !patient.familyAccessToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">{t('accessNotAvailable')}</h1>
          <p className="text-slate-500 text-sm">{t('accessNotAvailableDetail')}</p>
        </div>
      </div>
    )
  }

  const status = patient.familyViewableStatus
  const condition = status?.condition
  const conditionConfig = condition ? CONDITION_CONFIG[condition as keyof typeof CONDITION_CONFIG] : null
  const ConditionIcon = conditionConfig?.icon ?? Activity

  const lastUpdated = status?.lastUpdatedAt
    ? new Date(status.lastUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null

  const wardRoom = status?.wardRoom ?? t('defaultWard')

  const conditionKey = condition
    ? `condition${condition.charAt(0).toUpperCase()}${condition.slice(1).toLowerCase()}`
    : null
  const conditionLabel = conditionKey && t.has(conditionKey) ? t(conditionKey) : condition

  const handleRequestCamera = () => {
    requestCamera(patient.id, patient.name, wardRoom, token)
    log({
      userId: 'family_portal',
      userName: 'Family Portal',
      action: 'family_camera_requested',
      resource: 'patient',
      resourceId: patient.id,
      detail: `Family requested live camera for ${patient.name} in ${wardRoom}`,
    })
    notifyAndAudit({
      to: 'nurse', type: 'system', priority: 'high',
      title: `Family camera request · ${patient.name}`,
      body: `Family member is requesting a live camera view of ${patient.name} (${wardRoom}). Approve or decline.`,
      patientName: patient.name,
      audit: { action: 'family_camera_requested', resource: 'family_camera_request', resourceId: patient.id, detail: `Family requested camera in ${wardRoom}`, userName: 'Family member' },
    })
  }

  const handleEndSession = () => {
    if (!cameraRequest) return
    endSession(cameraRequest.id)
    log({
      userId: 'family_portal',
      userName: 'Family Portal',
      action: 'family_camera_ended',
      resource: 'patient',
      resourceId: patient.id,
      detail: `Family ended camera session for ${patient.name}`,
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Privacy banner */}
      <div className="bg-[rgba(238,107,38,0.07)] border-b border-[rgba(238,107,38,0.15)] px-4 py-2.5 flex items-center justify-center gap-3">
        <p className="text-xs text-[var(--color-accent)] font-medium flex items-center justify-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {t('privacyBanner')}
        </p>
        <LocaleToggle />
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-sm text-slate-500 font-medium mb-4">
            <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
            {t('liveStatus')}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('tokenDept', { token: patient.token, department: patient.department })}</p>
        </div>

        {/* Condition badge */}
        {condition && conditionConfig && (
          <div className={`flex items-center justify-center gap-3 rounded-xl border px-5 py-4 ${conditionConfig.color}`}>
            <ConditionIcon className="h-6 w-6" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t('condition')}</p>
              <p className="text-lg font-bold">{conditionLabel}</p>
            </div>
          </div>
        )}

        {/* Journey status */}
        {status?.journeyStatus && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
              <Activity className="h-3.5 w-3.5" />
              {t('currentStatus')}
            </div>
            <p className="text-lg font-semibold text-slate-900">{status.journeyStatus}</p>
          </div>
        )}

        {/* Location */}
        {status?.wardRoom && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
              <MapPin className="h-3.5 w-3.5" />
              {t('location')}
            </div>
            <p className="text-lg font-semibold text-slate-900">{status.wardRoom}</p>
          </div>
        )}

        {/* Estimated wait */}
        {status?.estimatedWaitMinutes !== undefined && status.estimatedWaitMinutes > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
              <Clock className="h-3.5 w-3.5" />
              {t('estimatedWait')}
            </div>
            <p className="text-lg font-semibold text-slate-900">{t('estimatedWaitValue', { minutes: status.estimatedWaitMinutes })}</p>
          </div>
        )}

        {/* No status yet */}
        {!status?.journeyStatus && !status?.wardRoom && !condition && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <Activity className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">{t('noStatusYet')}</p>
          </div>
        )}

        {/* ── Live Camera Section ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-slate-600" />
              <h3 className="font-semibold text-slate-900 text-sm">{t('liveRoomCamera')}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('liveRoomCameraDesc')}
            </p>
          </div>

          <div className="p-5">
            {/* No active request */}
            {!cameraRequest && (
              <button
                onClick={handleRequestCamera}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--color-primary-dark)] active:scale-95 transition-all"
              >
                <Camera className="h-4 w-4" />
                {t('requestLiveCamera')}
              </button>
            )}

            {/* Pending approval */}
            {cameraRequest?.status === 'pending' && (
              <div className="text-center py-4">
                <div className="h-10 w-10 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">{t('awaitingApproval')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('awaitingApprovalDesc')}</p>
                <button
                  onClick={handleEndSession}
                  className="mt-3 text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline transition-colors"
                >
                  {t('cancelRequest')}
                </button>
              </div>
            )}

            {/* Approved — show feed */}
            {cameraRequest?.status === 'approved' && (
              <div>
                <CameraFeedStub wardRoom={wardRoom} />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {t('approvedBy', { name: cameraRequest.approvedBy ?? t('nurse') })}
                  </p>
                  <button
                    onClick={handleEndSession}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
                  >
                    {t('endSession')}
                  </button>
                </div>
              </div>
            )}

            {/* Declined */}
            {cameraRequest?.status === 'declined' && (
              <div className="text-center py-4">
                <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-200">
                  <VideoOff className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">{t('requestDeclined')}</p>
                <p className="text-xs text-slate-500 mt-1">{t('requestDeclinedDesc')}</p>
                <button
                  onClick={handleRequestCamera}
                  className="mt-3 text-xs text-[var(--color-accent)] hover:text-[var(--color-primary-dark)] font-semibold transition-colors"
                >
                  {t('requestAgain')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Last updated */}
        {lastUpdated && (
          <p className="text-center text-xs text-slate-400">{t('lastUpdatedAt', { time: lastUpdated })}</p>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 pt-4 text-center">
          <p className="text-xs text-slate-400">{t('poweredBy')}</p>
        </div>
      </div>
    </div>
  )
}
