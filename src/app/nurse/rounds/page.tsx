"use client"

import { Select } from "@/components/ui/Select"
import { useState, useRef, useEffect, useCallback } from "react"
import { type PatientBed, type RoundsNote } from "@/store/useWardStore"
import { useWard } from "@/lib/useWard"
import {
  Mic, MicOff, Save, Plus, X, ChevronDown, ChevronRight,
  Bed, Stethoscope, FlaskConical, FileText, ClipboardList,
  Sparkles, Clock, AlertCircle, Activity, Pill, Search,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { NeonBadge } from "@/components/ui/neon-badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { VoiceScribeButton } from "@/components/clinical/VoiceScribeButton"
import { notifyAndAudit } from "@/lib/notifyAndAudit"
import { ClinicalNotesCard } from "@/components/nurse/ClinicalNotesCard"
import { useTranslations } from "next-intl"

// ── Speech Recognition types ──────────────────────────────────────────────────
type SpeechResultItem = { transcript: string }
type SpeechResultList = { length: number; [key: number]: { length: number; [key: number]: SpeechResultItem } }
type SpeechRecognitionType = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType
    webkitSpeechRecognition: new () => SpeechRecognitionType
  }
}

const CATEGORY_META = {
  observation: { labelKey: 'catObservation', icon: Activity,      color: 'text-accent',           bg: 'bg-accent-soft',  badge: 'blue'    as const },
  medication:  { labelKey: 'catMedication',  icon: Pill,          color: 'text-accent',           bg: 'bg-accent-soft',  badge: 'muted'   as const },
  test:        { labelKey: 'catTest',        icon: FlaskConical,  color: 'text-brand-amber-strong', bg: 'bg-warning-bg',  badge: 'warning' as const },
  instruction: { labelKey: 'catInstruction', icon: ClipboardList, color: 'text-accent',           bg: 'bg-accent-soft',  badge: 'teal'    as const },
}

function inferCategory(text: string): RoundsNote['category'] {
  const t = text.toLowerCase()
  if (/\b(inject|iv|dose|mg|ml|tablet|syrup|infus|drip|administer|prescri)\b/.test(t)) return 'medication'
  if (/\b(test|cbc|ecg|xray|x-ray|culture|urine|blood|lab|sample|report)\b/.test(t)) return 'test'
  if (/\b(instruct|position|turn|mobilize|restrict|diet|nil|npo|sponge|monitor)\b/.test(t)) return 'instruction'
  return 'observation'
}

// ── Quick-action inline forms ─────────────────────────────────────────────────
function AddMedicineForm({ onAdd, onCancel }: { onAdd: (m: { name: string; dosage: string; frequency: string }) => void; onCancel: () => void }) {
  const t = useTranslations('nurse')
  const [f, setF] = useState({ name: '', dosage: '', frequency: '' })
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-accent-soft rounded-xl p-4 space-y-3">
      <p className="t-overline text-accent flex items-center gap-1.5"><Pill className="h-3.5 w-3.5" /> {t('rounds.addMedicine')}</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { key: 'name', placeholder: t('rounds.medicineName') },
          { key: 'dosage', placeholder: t('rounds.dosagePlaceholder') },
          { key: 'frequency', placeholder: t('rounds.frequencyPlaceholder') },
        ].map(({ key, placeholder }) => (
          <input key={key} placeholder={placeholder} value={f[key as keyof typeof f]}
            onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
            className="h-9 px-3 rounded-lg bg-surface text-sm text-foreground placeholder:text-foreground-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs" />
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg text-xs font-semibold text-foreground-lighter bg-surface shadow-xs hover:bg-surface-sunken cursor-pointer">{t('common.cancel')}</button>
        <button onClick={() => { if (f.name) { onAdd(f); onCancel() } }} disabled={!f.name}
          className="u-press flex-1 h-8 rounded-lg text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark disabled:opacity-50 cursor-pointer transition-colors">
          {t('rounds.addMedicine')}
        </button>
      </div>
    </motion.div>
  )
}

function AddTestForm({ onAdd, onCancel }: { onAdd: (t: { name: string; urgency: 'Routine' | 'Urgent' }) => void; onCancel: () => void }) {
  const t = useTranslations('nurse')
  const [f, setF] = useState({ name: '', urgency: 'Routine' as 'Routine' | 'Urgent' })
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-warning-bg rounded-xl p-4 space-y-3">
      <p className="t-overline text-brand-amber-strong flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> {t('rounds.addTestOrder')}</p>
      <div className="flex gap-2">
        <input placeholder={t('rounds.testNamePlaceholder')} value={f.name}
          onChange={e => setF(p => ({ ...p, name: e.target.value }))}
          className="flex-1 h-9 px-3 rounded-lg bg-surface text-sm text-foreground placeholder:text-foreground-placeholder focus:outline-none focus:ring-2 focus:ring-warning/40 shadow-xs" />
        <Select value={f.urgency} onChange={e => setF(p => ({ ...p, urgency: e.target.value as any }))}
          className="h-9 px-3 rounded-lg bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-warning/40 shadow-xs">
          <option value="Routine">{t('rounds.routine')}</option>
          <option value="Urgent">{t('rounds.urgent')}</option>
        </Select>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg text-xs font-semibold text-foreground-lighter bg-surface shadow-xs hover:bg-surface-sunken cursor-pointer">{t('common.cancel')}</button>
        <button onClick={() => { if (f.name) { onAdd(f); onCancel() } }} disabled={!f.name}
          className="u-press flex-1 h-8 rounded-lg text-xs font-bold text-white bg-warning hover:bg-brand-amber-strong disabled:opacity-50 cursor-pointer transition-colors">
          {t('rounds.addTest')}
        </button>
      </div>
    </motion.div>
  )
}

function AddInstructionForm({ onAdd, onCancel }: { onAdd: (i: string) => void; onCancel: () => void }) {
  const t = useTranslations('nurse')
  const [text, setText] = useState('')
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="bg-accent-soft rounded-xl p-4 space-y-3">
      <p className="t-overline text-accent flex items-center gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> {t('rounds.addInstruction')}</p>
      <textarea placeholder={t('rounds.instructionPlaceholder')} value={text} onChange={e => setText(e.target.value)}
        className="w-full h-16 px-3 py-2 rounded-lg bg-surface text-sm text-foreground placeholder:text-foreground-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs" />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg text-xs font-semibold text-foreground-lighter bg-surface shadow-xs hover:bg-surface-sunken cursor-pointer">{t('common.cancel')}</button>
        <button onClick={() => { if (text.trim()) { onAdd(text.trim()); onCancel() } }} disabled={!text.trim()}
          className="u-press flex-1 h-8 rounded-lg text-xs font-bold text-[#0D2032] hover:text-[#0D2032] bg-primary hover:bg-primary-dark disabled:opacity-50 cursor-pointer transition-colors">
          {t('rounds.addInstruction')}
        </button>
      </div>
    </motion.div>
  )
}

// ── Notes Panel ───────────────────────────────────────────────────────────────
function NotesPanel({ patient }: { patient: PatientBed }) {
  const t = useTranslations('nurse')
  const { addRoundsNote } = useWard()
  const [noteText, setNoteText] = useState('')
  const [aiCategory, setAiCategory] = useState<RoundsNote['category'] | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [speechSupported] = useState(() => typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // quick-action state
  const [quickAction, setQuickAction] = useState<'medicine' | 'test' | 'instruction' | null>(null)
  const [pendingMedicines, setPendingMedicines] = useState<{ name: string; dosage: string; frequency: string }[]>([])
  const [pendingTests, setPendingTests] = useState<{ name: string; urgency: 'Routine' | 'Urgent' }[]>([])
  const [pendingInstructions, setPendingInstructions] = useState<string[]>([])

  const [showHistory, setShowHistory] = useState(false)

  // AI category inference with debounce
  useEffect(() => {
    if (!noteText.trim()) { setAiCategory(null); return }
    setIsAiThinking(true)
    if (aiTimer.current) clearTimeout(aiTimer.current)
    aiTimer.current = setTimeout(() => {
      setAiCategory(inferCategory(noteText))
      setIsAiThinking(false)
    }, 1800)
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current) }
  }, [noteText])

  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setNoteText(prev => prev + (prev ? ' ' : '') + transcript.trim())
    }
    rec.onerror = () => { setRecording(false) }
    rec.onend = () => { setRecording(false) }
    recognitionRef.current = rec
    rec.start()
    setRecording(true)
    toast(t('rounds.listening'))
  }, [t])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  const handleSave = () => {
    if (!noteText.trim() && pendingMedicines.length === 0 && pendingTests.length === 0 && pendingInstructions.length === 0) return
    const category = aiCategory ?? 'observation'
    addRoundsNote(patient.id, {
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      text: noteText.trim(),
      category,
      author: 'Nurse on Duty',
      medicines: pendingMedicines.length > 0 ? pendingMedicines : undefined,
      tests: pendingTests.length > 0 ? pendingTests : undefined,
      instructions: pendingInstructions.length > 0 ? pendingInstructions : undefined,
    })
    // Notify the doctor that rounds are complete + summarise what was added.
    const parts: string[] = []
    if (pendingMedicines.length) parts.push(t('rounds.medsAdded', { count: pendingMedicines.length, plural: pendingMedicines.length === 1 ? '' : 's' }))
    if (pendingTests.length) parts.push(t('rounds.testsRequested', { count: pendingTests.length, plural: pendingTests.length === 1 ? '' : 's' }))
    if (pendingInstructions.length) parts.push(t('rounds.instructionsCaptured', { count: pendingInstructions.length, plural: pendingInstructions.length === 1 ? '' : 's' }))
    notifyAndAudit({
      to: 'doctor', type: 'system', priority: 'medium',
      title: t('rounds.roundsCompleteTitle', { name: patient.name }),
      body: t('rounds.roundsBody', { name: patient.name, bed: patient.bedNumber, parts: parts.length ? ' — ' + parts.join(', ') : '' }),
      patientName: patient.name,
      audit: { action: 'nurse_handover', resource: 'rounds_note', resourceId: patient.id, detail: `Rounds note saved for ${patient.name} (${category})`, userName: 'Nurse' },
    })
    setNoteText('')
    setAiCategory(null)
    setPendingMedicines([])
    setPendingTests([])
    setPendingInstructions([])
    toast.success(t('rounds.roundsSaved'))
  }

  const catMeta = aiCategory ? CATEGORY_META[aiCategory] : null
  const [ward, bed] = patient.bedNumber.split(' - ')

  return (
    <div className="space-y-5">
      {/* Patient header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-soft">
          <Bed className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold text-accent">{ward}</span>
          <span className="text-foreground-placeholder">—</span>
          <span className="text-sm font-bold text-accent">{t('rounds.bed', { bed: bed?.trim() ?? '' })}</span>
        </div>
        <span className="text-base font-bold text-foreground">{patient.name}</span>
        <NeonBadge variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'}>
          {patient.condition}
        </NeonBadge>
      </div>

      {/* Voice + text area */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground-muted">{t('rounds.doctorRoundsNote')}</p>
          <div className="flex items-center gap-2">
            {isAiThinking && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent bg-accent-soft px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3 animate-pulse" /> {t('rounds.aiCategorizing')}
              </span>
            )}
            {catMeta && !isAiThinking && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${catMeta.bg} ${catMeta.color}`}
              >
                <catMeta.icon className="h-3 w-3" /> {t(`rounds.${catMeta.labelKey}`)}
              </motion.span>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder={t('rounds.notePlaceholder')}
            className="w-full h-28 px-4 py-3 rounded-xl bg-surface-sunken text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-foreground-placeholder"
          />
          {recording && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-danger-bg text-danger text-[11px] font-bold px-2 py-1 rounded-full animate-pulse">
              <span className="h-2 w-2 rounded-full bg-danger" />
              {t('rounds.recording')}
            </div>
          )}
        </div>

        {/* Voice button row */}
        <div className="flex items-center gap-3">
          {speechSupported ? (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`u-press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                recording
                  ? 'bg-danger-bg text-danger-strong hover:bg-danger-bg/70'
                  : 'bg-surface-sunken text-foreground-muted hover:bg-surface-sunken/70'
              }`}
            >
              {recording ? <><MicOff className="h-4 w-4" /> {t('rounds.stopVoice')}</> : <><Mic className="h-4 w-4" /> {t('rounds.voiceNote')}</>}
            </button>
          ) : (
            <span className="text-xs text-foreground-placeholder bg-surface-sunken px-3 py-2 rounded-xl">{t('rounds.voiceUnsupported')}</span>
          )}
          {/* M4-W2 — S5: AI-SOAP companion. Existing voice button appends raw
              transcript; this one structures into SOAP for the chart. */}
          <VoiceScribeButton
            surface="nurse_round"
            onAccept={(soap) => { setNoteText((prev) => (prev ? prev + '\n\n' : '') + soap); toast.success(t('rounds.soapAppended')) }}
            compact
          />
          <span className="flex-1" />
          <button
            onClick={handleSave}
            disabled={!noteText.trim() && pendingMedicines.length === 0 && pendingTests.length === 0 && pendingInstructions.length === 0}
            className="u-press flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-[#0D2032] hover:text-[#0D2032] text-sm font-bold transition-colors cursor-pointer disabled:opacity-40 shadow-xs"
          >
            <Save className="h-4 w-4" /> {t('rounds.saveNote')}
          </button>
        </div>

        {/* Quick actions */}
        <div className="pt-2 border-t border-border-light">
          <p className="t-overline text-foreground-placeholder mb-3">{t('rounds.quickActions')}</p>
          <AnimatePresence mode="wait">
            {quickAction === 'medicine' && (
              <AddMedicineForm
                onAdd={m => setPendingMedicines(p => [...p, m])}
                onCancel={() => setQuickAction(null)}
              />
            )}
            {quickAction === 'test' && (
              <AddTestForm
                onAdd={t => setPendingTests(p => [...p, t])}
                onCancel={() => setQuickAction(null)}
              />
            )}
            {quickAction === 'instruction' && (
              <AddInstructionForm
                onAdd={i => setPendingInstructions(p => [...p, i])}
                onCancel={() => setQuickAction(null)}
              />
            )}
          </AnimatePresence>

          {!quickAction && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setQuickAction('medicine')}
                className="u-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-accent bg-accent-soft hover:bg-accent-soft/70 cursor-pointer transition-colors">
                <Plus className="h-3.5 w-3.5" /> {t('rounds.medicine')}
              </button>
              <button onClick={() => setQuickAction('test')}
                className="u-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-brand-amber-strong bg-warning-bg hover:bg-warning-bg/70 cursor-pointer transition-colors">
                <Plus className="h-3.5 w-3.5" /> {t('rounds.test')}
              </button>
              <button onClick={() => setQuickAction('instruction')}
                className="u-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-accent bg-accent-soft hover:bg-accent-soft/70 cursor-pointer transition-colors">
                <Plus className="h-3.5 w-3.5" /> {t('rounds.instruction')}
              </button>
            </div>
          )}

          {/* Pending items preview */}
          {(pendingMedicines.length > 0 || pendingTests.length > 0 || pendingInstructions.length > 0) && (
            <div className="mt-3 space-y-2">
              {pendingMedicines.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent-soft text-xs">
                  <span className="font-bold text-accent"><Pill className="h-3 w-3 inline mr-1" />{m.name} {m.dosage} — {m.frequency}</span>
                  <button onClick={() => setPendingMedicines(p => p.filter((_, j) => j !== i))} className="text-accent hover:text-danger cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {pendingTests.map((test, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-warning-bg text-xs">
                  <span className="font-bold text-brand-amber-strong"><FlaskConical className="h-3 w-3 inline mr-1" />{test.name} — {test.urgency === 'Urgent' ? t('rounds.urgent') : t('rounds.routine')}</span>
                  <button onClick={() => setPendingTests(p => p.filter((_, j) => j !== i))} className="text-warning hover:text-danger cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {pendingInstructions.map((inst, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent-soft text-xs">
                  <span className="font-bold text-accent"><ClipboardList className="h-3 w-3 inline mr-1" />{inst}</span>
                  <button onClick={() => setPendingInstructions(p => p.filter((_, j) => j !== i))} className="text-accent hover:text-danger cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* M9-B — NABH clinical-note modules: wound care, fall risk, care plan */}
      <ClinicalNotesCard patientId={patient.id} patientName={patient.name} />

      {/* Rounds History */}
      <div>
        <button
          onClick={() => setShowHistory(h => !h)}
          className="flex items-center gap-2 text-sm font-bold text-foreground-lighter hover:text-foreground cursor-pointer mb-3 transition-colors"
        >
          {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {t('rounds.roundsHistory', { count: patient.rounds?.length ?? 0 })}
        </button>

        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {!patient.rounds?.length ? (
                <p className="text-sm text-foreground-placeholder pl-4 py-3">{t('rounds.noRoundsNotes')}</p>
              ) : (
                [...(patient.rounds ?? [])].reverse().map(note => {
                  const meta = CATEGORY_META[note.category]
                  return (
                    <div key={note.id} className={`rounded-xl p-4 ${meta.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <meta.icon className={`h-4 w-4 ${meta.color}`} />
                          <NeonBadge variant={meta.badge}>{t(`rounds.${meta.labelKey}`)}</NeonBadge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-foreground-placeholder">
                          <Clock className="h-3 w-3" /> {note.timestamp}
                          <span>· {note.author}</span>
                        </div>
                      </div>
                      {note.text && <p className="text-sm text-foreground font-medium">{note.text}</p>}
                      {note.medicines?.map((m, i) => (
                        <p key={i} className="text-xs font-bold text-accent mt-1"><Pill className="h-3 w-3 inline mr-1" />{m.name} {m.dosage} — {m.frequency}</p>
                      ))}
                      {note.tests?.map((test, i) => (
                        <p key={i} className="text-xs font-bold text-brand-amber-strong mt-1"><FlaskConical className="h-3 w-3 inline mr-1" />{test.name} ({test.urgency === 'Urgent' ? t('rounds.urgent') : t('rounds.routine')})</p>
                      ))}
                      {note.instructions?.map((inst, i) => (
                        <p key={i} className="text-xs font-bold text-accent mt-1"><ClipboardList className="h-3 w-3 inline mr-1" />{inst}</p>
                      ))}
                    </div>
                  )
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Patient list item ─────────────────────────────────────────────────────────
function PatientListItem({ patient, selected, onClick }: {
  patient: PatientBed
  selected: boolean
  onClick: () => void
}) {
  const t = useTranslations('nurse')
  const [ward, bed] = patient.bedNumber.split(' - ')
  const roundsCount = patient.rounds?.length ?? 0
  const lastRound = patient.rounds?.at(-1)

  return (
    <button
      onClick={onClick}
      className={`u-press w-full text-left p-4 rounded-xl transition-all cursor-pointer ${
        selected
          ? 'bg-accent-soft shadow-xs'
          : 'bg-surface hover:bg-surface-sunken shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-bold text-foreground text-sm">{patient.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
              selected ? 'bg-accent-soft text-accent' : 'bg-surface-sunken text-foreground-lighter'
            }`}>
              <Bed className="h-3 w-3" /> {ward} · {t('rounds.bed', { bed: bed?.trim() ?? '' })}
            </div>
          </div>
        </div>
        <NeonBadge variant={patient.condition === 'Critical' ? 'danger' : patient.condition === 'Stable' ? 'success' : 'warning'} className="flex-shrink-0">
          {patient.condition}
        </NeonBadge>
      </div>
      <div className="flex items-center justify-between text-xs text-foreground-placeholder">
        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {t('rounds.notesCount', { count: roundsCount, plural: roundsCount !== 1 ? 's' : '' })}</span>
        {lastRound ? (
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t('rounds.lastRound', { time: lastRound.timestamp })}</span>
        ) : (
          <span className="text-brand-amber-strong font-medium">{t('rounds.roundsPending')}</span>
        )}
      </div>
      {patient.aiAlert && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-danger bg-danger-bg px-2 py-1 rounded-lg">
          <AlertCircle className="h-3 w-3" /> {patient.aiAlert}
        </div>
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NurseRoundsPage() {
  const t = useTranslations('nurse')
  const { patients } = useWard()
  const [selectedId, setSelectedId] = useState<string | null>(patients[0]?.id ?? null)
  const [search, setSearch] = useState('')

  const filteredPatients = search.trim()
    ? patients.filter(p =>
        p.bedNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase())
      )
    : patients

  // Auto-select when search narrows to a single patient
  useEffect(() => {
    if (filteredPatients.length === 1 && search.trim()) {
      setSelectedId(filteredPatients[0].id)
    }
  }, [filteredPatients.length, search])

  const selectedPatient = patients.find(p => p.id === selectedId)

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Slim meta + action row — the shell already renders the page title. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="t-body text-foreground-lighter">
          {t('rounds.searchHint')}
        </p>
        <div className="flex items-center gap-2">
          <NeonBadge variant="blue" dot pulse>
            <Stethoscope className="h-3 w-3" /> {t('rounds.patientsCount', { count: patients.length })}
          </NeonBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Patient list with bed search */}
        <div className="lg:col-span-4 space-y-3">
          {/* Bed number search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-placeholder pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('rounds.searchPlaceholder')}
              className="w-full h-10 pl-9 pr-9 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-foreground-placeholder focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-placeholder hover:text-foreground-lighter transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Result count when filtering */}
          {search.trim() && (
            <p className="text-xs font-semibold text-foreground-placeholder px-1">
              {filteredPatients.length === 0
                ? t('rounds.noPatientsFound')
                : t('rounds.resultsFor', { count: filteredPatients.length, plural: filteredPatients.length !== 1 ? 's' : '', query: search })}
            </p>
          )}

          {!search.trim() && (
            <p className="t-overline tracking-widest text-foreground-placeholder px-1">{t('rounds.wardPatients')}</p>
          )}

          <div className="space-y-2">
            <AnimatePresence>
              {filteredPatients.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <EmptyState icon={Bed} title={t('rounds.noBedsMatch', { query: search })} size="sm" />
                </motion.div>
              ) : (
                filteredPatients.map(p => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <PatientListItem
                      patient={p}
                      selected={p.id === selectedId}
                      onClick={() => setSelectedId(p.id)}
                    />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Notes panel */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedPatient ? (
              <motion.div
                key={selectedPatient.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <NotesPanel patient={selectedPatient} />
              </motion.div>
            ) : (
              <EmptyState
                icon={Bed}
                title={t('rounds.searchToBegin')}
                description={t('rounds.searchToBeginDesc')}
                size="sm"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
