"use client"

import { useRef, useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ScanLine, Mic, MicOff, Camera, CheckCircle, Sparkles, Upload } from "lucide-react"
import { extractIntakeFromVoice } from "@/ai-services/voice-intake"
import type { IntakeForm, Gender } from "@/lib/intake/data"
import { cn } from "@/lib/utils"

type Update = (patch: Partial<IntakeForm>) => void

// ── Aadhaar scan (simulated) ─────────────────────────────────────────
export function AadhaarScanStep({ update }: { form: IntakeForm; update: Update }) {
  const [scan, setScan] = useState<'idle' | 'scanning' | 'done'>('idle')

  const runScan = async () => {
    setScan('scanning')
    await new Promise(r => setTimeout(r, 2000))
    update({ name: 'Ramesh Kumar', age: '42', gender: 'Male' })
    setScan('done')
  }

  return (
    <div className="pt-2 space-y-4">
      <div className="relative bg-slate-900 rounded-[20px] overflow-hidden aspect-[4/3] flex items-center justify-center select-none">
        {scan === 'idle' && (
          <>
            <div className="absolute inset-6 border-2 border-dashed border-white/20 rounded-xl" />
            <div className="flex flex-col items-center gap-4 text-center z-10">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                <Camera className="h-8 w-8 text-white/60" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white/80 text-[15px] font-semibold">Position Aadhaar card in frame</p>
                <p className="text-white/40 text-[13px] mt-1">Make sure all four corners are visible</p>
              </div>
            </div>
          </>
        )}
        {scan === 'scanning' && (
          <>
            <div className="absolute inset-6 border-2 border-green-400/50 rounded-xl" />
            <motion.div
              className="absolute left-8 right-8 h-0.5 bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.5)]"
              animate={{ top: ['20%', '80%', '20%'] }}
              transition={{ duration: 1.8, ease: 'linear', repeat: Infinity }}
            />
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4 text-green-400 animate-pulse" aria-hidden="true" />
              <p className="text-green-300 text-[13px] font-semibold">Scanning Aadhaar…</p>
            </div>
          </>
        )}
        {scan === 'done' && (
          <div className="flex flex-col items-center gap-3 z-10">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}>
              <CheckCircle className="h-14 w-14 text-green-400" aria-hidden="true" />
            </motion.div>
            <p className="text-white font-semibold text-[15px]">Scan complete</p>
            <p className="text-white/50 text-[13px]">Details filled — tap Continue to confirm</p>
          </div>
        )}
      </div>

      {scan === 'idle' && (
        <div className="flex gap-3">
          <button onClick={runScan} className="flex-1 h-12 rounded-[16px] bg-[#EE6B26] text-[#0D2032] font-semibold text-[15px] active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(238,107,38,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]">
            <ScanLine className="h-5 w-5" aria-hidden="true" /> Scan Card
          </button>
          <button className="flex-1 h-12 rounded-[16px] bg-white text-slate-700 font-semibold text-[15px] active:scale-[0.97] transition-all flex items-center justify-center gap-2 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <Upload className="h-5 w-5 text-slate-400" aria-hidden="true" /> Upload
          </button>
        </div>
      )}
      <p className="text-[13px] text-slate-400 text-center px-4">Processed locally — never stored on our servers.</p>
    </div>
  )
}

// ── Voice capture ────────────────────────────────────────────────────
export function VoiceStep({ update }: { form: IntakeForm; update: Update }) {
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'done'>('idle')
  const [transcript, setTranscript] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)

  useEffect(() => () => recRef.current?.stop(), [])

  const start = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    rec.continuous = false
    rec.interimResults = false
    recRef.current = rec
    rec.onstart = () => setState('listening')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = async (e: any) => {
      const t = e.results[0][0].transcript
      setTranscript(t)
      setState('processing')
      const { data } = await extractIntakeFromVoice(t, lang)
      update({
        name: data.extractedName ?? undefined,
        age: data.extractedAge ? String(data.extractedAge) : undefined,
        gender: (data.extractedGender as Gender) ?? undefined,
        phone: data.extractedPhone ?? undefined,
        symptoms: data.extractedSymptoms.length ? data.extractedSymptoms : undefined,
        departments: data.extractedDepartmentPreference ? [data.extractedDepartmentPreference] : undefined,
      })
      setState('done')
    }
    rec.onerror = () => setState('idle')
    rec.onend = () => setState(s => (s === 'listening' ? 'idle' : s))
    rec.start()
  }

  const stop = () => { recRef.current?.stop(); setState('idle') }

  return (
    <div className="pt-2 space-y-4">
      <div className="bg-slate-200/60 p-1 rounded-xl flex gap-1 max-w-[200px] mx-auto">
        {(['en', 'hi'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn("flex-1 h-9 rounded-lg text-[13px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26]", lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            {l === 'en' ? 'English' : 'हिंदी'}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 py-6">
        <button
          onClick={state === 'listening' ? stop : start}
          disabled={state === 'processing'}
          aria-label={state === 'listening' ? 'Stop listening' : 'Tap to speak'}
          className={cn(
            "h-24 w-24 rounded-full flex items-center justify-center transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EE6B26] focus-visible:ring-offset-2",
            state === 'listening' ? "bg-red-500 animate-pulse shadow-[0_0_0_12px_rgba(239,68,68,0.15)]"
              : state === 'processing' ? "bg-amber-400" : "bg-[#EE6B26] shadow-[0_8px_20px_rgba(238,107,38,0.25)]"
          )}
        >
          {state === 'listening' ? <MicOff className="h-10 w-10 text-white" aria-hidden="true" /> : <Mic className="h-10 w-10 text-white" aria-hidden="true" />}
        </button>
        <p className="text-[15px] font-semibold text-center text-slate-700">
          {state === 'idle' && 'Tap and say your name, age & problem'}
          {state === 'listening' && 'Listening… tap to stop'}
          {state === 'processing' && 'Extracting details…'}
          {state === 'done' && 'Done! Continue to confirm.'}
        </p>
      </div>

      {transcript && (
        <div className="bg-slate-100 rounded-[16px] p-4">
          <p className="text-[12px] text-slate-500 font-medium mb-1 uppercase tracking-wide">Transcript</p>
          <p className="text-slate-800 text-[14px]">&ldquo;{transcript}&rdquo;</p>
        </div>
      )}
      {state === 'done' && <p className="text-[13px] text-green-700 font-medium text-center">Fields pre-filled — review on the next steps.</p>}
    </div>
  )
}
