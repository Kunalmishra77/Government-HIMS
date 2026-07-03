"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Video, VideoOff, Mic, MicOff, PhoneOff, Sparkles, MessageSquare, CheckCircle, Stethoscope, FileText } from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { usePatientStore } from "@/store/usePatientStore"
import { usePatientLiveStore } from "@/store/usePatientLiveStore"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

function useWebcam(active: boolean, withAudio: boolean) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    async function start() {
      if (!active || typeof navigator === 'undefined' || !navigator.mediaDevices) { setError('Camera unavailable in this browser'); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: withAudio })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        if (ref.current) { ref.current.srcObject = stream; ref.current.play().catch(() => { /* ignore */ }) }
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera permission denied')
      }
    }
    start()
    return () => { cancelled = true; if (stream) stream.getTracks().forEach((t) => t.stop()) }
  }, [active, withAudio])
  return { ref, error }
}

type Phase = 'precall' | 'incall' | 'ended'

function VideoStub({ name }: { name: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px)' }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-light)] flex items-center justify-center text-white text-3xl font-bold">{name.replace('Dr. ', '').split(' ').map(w => w[0]).join('')}</div>
        <p className="text-white font-semibold text-[17px]">{name}</p>
        <p className="text-white/50 text-[12px]">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
      </div>
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur px-2.5 py-1 rounded-full">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /><span className="text-white text-[11px] font-bold">LIVE</span>
      </div>
    </div>
  )
}

export default function TeleconsultPage() {
  const router = useRouter()
  const currentUser = useAuthStore(s => s.currentUser)
  const patients = usePatientStore(s => s.patients)
  const doctor = patients.find(p => p.id === currentUser?.id)?.doctor ?? 'Dr. Priya Nair'

  const [phase, setPhase] = useState<Phase>('precall')
  const [mic, setMic] = useState(true)
  const [cam, setCam] = useState(true)
  const [secs, setSecs] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (phase === 'incall') { timer.current = setInterval(() => setSecs(s => s + 1), 1000) }
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [phase])

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  // Self-view webcam (live during precall + incall). Doctor side stays stubbed.
  const selfPrecall = useWebcam(phase === 'precall' && cam, mic)
  const selfIncall  = useWebcam(phase === 'incall'  && cam, mic)
  const patientName = currentUser?.name ?? 'Patient'

  function joinCall() {
    setPhase('incall')
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'high',
      title: `${patientName} joined the call`,
      body: `Patient has joined the video room for the consultation with ${doctor}.`,
      patientName,
      audit: { action: 'hitl_accept', resource: 'teleconsult', detail: `Patient joined teleconsult with ${doctor}`, userName: patientName },
    })
    toast.success(`Joined call · ${doctor} notified`)
  }

  const endCall = () => {
    setPhase('ended')
    // advance the live journey past the call (video mode: in_call -> prescription)
    if (usePatientLiveStore.getState().stage === 'in_call') usePatientLiveStore.getState().advance()
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'medium',
      title: `Call ended · ${patientName}`,
      body: `Patient ended the teleconsult after ${mmss}. Encounter ready for sign-off.`,
      patientName,
      audit: { action: 'hitl_modify', resource: 'teleconsult', detail: `Patient ended call (duration ${mmss})`, userName: patientName },
    })
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-3">Video consultation</h1>

      {phase === 'precall' && (
        <div className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-5">
          <p className="text-[14px] text-slate-500 mb-4">You&apos;re about to join your call with <b className="text-slate-800">{doctor}</b>. Check your camera &amp; mic first.</p>
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video mb-4">
            {cam && !selfPrecall.error ? (
              <video ref={selfPrecall.ref} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover bg-slate-800" />
            ) : cam ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-700 to-slate-900 text-center px-4">
                <div className="h-20 w-20 rounded-full bg-white/15 flex items-center justify-center text-white text-2xl font-bold">{(currentUser?.name ?? 'You').split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                <p className="text-white/70 text-[11px]">{selfPrecall.error}</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[14px]">Camera off</div>
            )}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              <button onClick={() => setMic(m => !m)} className={cn("h-10 w-10 rounded-full flex items-center justify-center cursor-pointer", mic ? "bg-white/20 text-white" : "bg-red-500 text-white")}>{mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
              <button onClick={() => setCam(c => !c)} className={cn("h-10 w-10 rounded-full flex items-center justify-center cursor-pointer", cam ? "bg-white/20 text-white" : "bg-red-500 text-white")}>{cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
            </div>
          </div>
          <button onClick={joinCall} className="w-full h-13 py-3.5 rounded-2xl font-semibold text-[16px] text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer">
            <Video className="h-5 w-5" /> Join now
          </button>
        </div>
      )}

      {phase === 'incall' && (
        <div className="rounded-3xl overflow-hidden shadow-[0_1px_4px_rgba(15,23,42,0.06)]">
          <div className="relative aspect-video bg-slate-900">
            <VideoStub name={doctor} />
            {/* self PiP — uses real webcam when available */}
            <div className="absolute bottom-3 right-3 h-24 w-32 rounded-xl overflow-hidden border-2 border-white/20 bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
              {cam && !selfIncall.error ? (
                <video ref={selfIncall.ref} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : cam ? (
                <span className="text-white/80 text-[12px] font-semibold">You</span>
              ) : (
                <VideoOff className="h-5 w-5 text-white/50" />
              )}
            </div>
            {/* AI scribe + duration */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[rgba(238,107,38,0.07)]0/90 px-2.5 py-1 rounded-full"><Sparkles className="h-3.5 w-3.5 text-white" /><span className="text-white text-[11px] font-bold">AI scribe noting</span></div>
            <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur px-2.5 py-1 rounded-full text-white text-[12px] font-semibold">{mmss}</div>
          </div>
          <div className="bg-slate-800 py-3 flex items-center justify-center gap-3">
            <button onClick={() => setMic(m => !m)} className={cn("h-11 w-11 rounded-full flex items-center justify-center", mic ? "bg-white/15 text-white" : "bg-red-500 text-white")}>{mic ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
            <button onClick={() => setCam(c => !c)} className={cn("h-11 w-11 rounded-full flex items-center justify-center", cam ? "bg-white/15 text-white" : "bg-red-500 text-white")}>{cam ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>
            <button className="h-11 w-11 rounded-full bg-white/15 text-white flex items-center justify-center"><MessageSquare className="h-5 w-5" /></button>
            <button onClick={endCall} className="h-11 px-5 rounded-full bg-red-600 text-white flex items-center justify-center gap-2 font-semibold active:scale-95 transition-transform"><PhoneOff className="h-5 w-5" /> End</button>
          </div>
        </div>
      )}

      {phase === 'ended' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-white shadow-[0_1px_4px_rgba(15,23,42,0.06)] p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-green-50 border-[6px] border-green-100 flex items-center justify-center mx-auto mb-3"><CheckCircle className="h-8 w-8 text-green-500" /></div>
          <h2 className="text-[20px] font-bold text-slate-900">Consultation complete</h2>
          <p className="text-[14px] text-slate-500 mt-1 mb-5">Call duration {mmss} with {doctor}. Your e-prescription &amp; summary are ready.</p>
          <div className="grid grid-cols-2 gap-3 mb-5 text-left">
            <div className="rounded-2xl bg-slate-50 p-3.5 flex items-center gap-2.5"><FileText className="h-5 w-5 text-[var(--color-accent)]" /><div><p className="text-[13px] font-bold text-slate-900">e-Prescription</p><p className="text-[11px] text-slate-500">2 medicines</p></div></div>
            <div className="rounded-2xl bg-slate-50 p-3.5 flex items-center gap-2.5"><Stethoscope className="h-5 w-5 text-[var(--color-accent)]" /><div><p className="text-[13px] font-bold text-slate-900">Visit summary</p><p className="text-[11px] text-slate-500">Plain-language</p></div></div>
          </div>
          <button onClick={() => router.push('/patient/dashboard')} className="w-full py-3.5 rounded-2xl font-semibold text-[16px] text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-all active:scale-[0.98]">Back to dashboard</button>
        </motion.div>
      )}
    </div>
  )
}
