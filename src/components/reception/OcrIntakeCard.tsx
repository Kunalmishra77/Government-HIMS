"use client"

/* S6 — Mock OCR Intake.
 *
 * Camera or file-drop scan that simulates an 800 ms OCR pipeline and
 * returns structured fields (name / DOB / payer / lab values / etc.) with
 * a confidence chip per field. Every field is editable — the OCR is a
 * draft, the human is the source of truth.
 *
 *   <OcrIntakeCard
 *     onApply={(fields) => setForm(f => ({ ...f, name: fields.name?.value ?? f.name, ... }))}
 *   />
 */

import { useRef, useState } from "react"
import { Camera, Upload, Sparkles, Check, X, ScanLine, Loader2, Image as ImageIcon, IdCard, ShieldCheck, FlaskConical } from "lucide-react"
import { useAuditStore } from "@/store/useAuditStore"
import { ReasoningChip } from "@/components/clinical/ReasoningChip"

export type DocType = "aadhaar" | "insurance" | "lab_paper"

export interface OcrField { value: string; confidence: number }

export interface OcrFields {
  name?: OcrField
  dob?: OcrField
  age?: OcrField
  gender?: OcrField
  phone?: OcrField
  aadhaar?: OcrField
  payer?: OcrField        // insurer name
  policyNo?: OcrField     // insurance policy number
  validTill?: OcrField    // insurance expiry
  testName?: OcrField     // lab — primary test name
  testValue?: OcrField    // lab — reading
  reference?: OcrField    // lab — reference range
}

interface Props {
  onApply: (fields: OcrFields, docType: DocType) => void
  className?: string
}

// Deterministic mock OCR outputs per doc type — keeps the demo reproducible.
const MOCK: Record<DocType, OcrFields> = {
  aadhaar: {
    name:     { value: "Anil Kumar Verma",        confidence: 0.94 },
    dob:      { value: "12-04-1988",              confidence: 0.92 },
    age:      { value: "38",                       confidence: 0.92 },
    gender:   { value: "Male",                     confidence: 0.98 },
    aadhaar:  { value: "XXXX-XXXX-7382",           confidence: 0.88 },
    phone:    { value: "+91 9876543210",           confidence: 0.71 },
  },
  insurance: {
    name:      { value: "Anil Kumar Verma",        confidence: 0.93 },
    payer:     { value: "Star Health",              confidence: 0.96 },
    policyNo:  { value: "SH-MED-2024-7382",         confidence: 0.89 },
    validTill: { value: "31-12-2026",               confidence: 0.84 },
  },
  lab_paper: {
    name:      { value: "Anil Kumar Verma",        confidence: 0.90 },
    testName:  { value: "Troponin I",              confidence: 0.93 },
    testValue: { value: "2.1 ng/mL",                confidence: 0.89 },
    reference: { value: "< 0.04 ng/mL",             confidence: 0.95 },
  },
}

const DOC_META: Record<DocType, { label: string; icon: React.ElementType; tint: string }> = {
  aadhaar:    { label: "Aadhaar",         icon: IdCard,       tint: "bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)] ring-primary/25" },
  insurance:  { label: "Insurance card",  icon: ShieldCheck,  tint: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  lab_paper:  { label: "Lab paper",       icon: FlaskConical, tint: "bg-amber-50 text-amber-700 ring-amber-200" },
}

type Tone = "ok" | "info" | "warn"
const toneFor = (c: number): Tone => (c >= 0.9 ? "ok" : c >= 0.75 ? "info" : "warn")

export function OcrIntakeCard({ onApply, className }: Props) {
  const [docType, setDocType]   = useState<DocType>("aadhaar")
  const [scanning, setScanning] = useState(false)
  const [fields, setFields]     = useState<OcrFields | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const inputRef                = useRef<HTMLInputElement>(null)
  const audit                    = useAuditStore((s) => s.log)

  function pickFile() { inputRef.current?.click() }

  function startScan(f?: File) {
    if (f) setFileName(f.name)
    setScanning(true)
    setFields(null)
    // Mock OCR pipeline — 800 ms canned timer per the W2 spec.
    window.setTimeout(() => {
      setScanning(false)
      setFields(MOCK[docType])
      audit({
        action: "hitl_modify",
        resource: "ocr_intake",
        resourceId: docType,
        detail: `Mock OCR completed for ${DOC_META[docType].label}${fileName ? ' (' + fileName + ')' : ''}.`,
        userId: "user",
        userName: "Active user",
      })
    }, 800)
  }

  function applyFields() {
    if (!fields) return
    onApply(fields, docType)
    audit({
      action: "hitl_accept",
      resource: "ocr_intake",
      resourceId: docType,
      detail: `OCR fields applied to walk-in form (${Object.keys(fields).length} fields).`,
      userId: "user",
      userName: "Active user",
    })
    setFields(null)
    setFileName("")
  }

  function discard() {
    audit({
      action: "hitl_reject",
      resource: "ocr_intake",
      resourceId: docType,
      detail: `OCR draft discarded for ${DOC_META[docType].label}.`,
      userId: "user",
      userName: "Active user",
    })
    setFields(null)
    setFileName("")
  }

  return (
    <div className={`rounded-xl bg-surface-sunken ring-1 ring-[rgba(238,107,38,0.20)] overflow-hidden ${className ?? ''}`}>
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(238,107,38,0.15)]/60">
        <ScanLine className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        <h3 className="text-[12.5px] font-semibold text-[var(--color-primary-dark)]">AI Scan & Fill</h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[var(--color-accent)]">
          <Sparkles className="h-3 w-3" /> Mock OCR — instant intake
        </span>
      </header>

      {/* Doc type chips */}
      <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap">
        {(Object.keys(DOC_META) as DocType[]).map((d) => {
          const m = DOC_META[d]; const Icon = m.icon
          return (
            <button
              key={d}
              type="button"
              onClick={() => { setDocType(d); setFields(null) }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ring-1 transition ${docType === d ? m.tint : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}
            >
              <Icon className="h-3 w-3" /> {m.label}
            </button>
          )
        })}
      </div>

      {/* Drop / upload area */}
      {!fields && !scanning ? (
        <div className="px-3 pb-3">
          <div
            role="button"
            tabIndex={0}
            onClick={pickFile}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pickFile() }}
            className="rounded-xl border-2 border-dashed border-[rgba(238,107,38,0.20)] bg-white hover:bg-[rgba(238,107,38,0.10)]/40 transition px-3 py-4 flex items-center gap-3 cursor-pointer"
          >
            <span className="h-9 w-9 rounded-full bg-[rgba(238,107,38,0.12)] text-[var(--color-accent)] flex items-center justify-center"><ImageIcon className="h-4 w-4" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-800">Drop or pick a {DOC_META[docType].label}</p>
              <p className="text-[11px] text-slate-500">800 ms simulated scan · every field is editable after.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={(e) => { e.stopPropagation(); pickFile() }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                <Upload className="h-3 w-3" /> Upload
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); startScan() }}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white">
                <Camera className="h-3 w-3" /> Demo scan
              </button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) startScan(f); e.currentTarget.value = '' }}
            />
          </div>
        </div>
      ) : null}

      {scanning ? (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-primary/25 flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-[var(--color-accent)] animate-spin" />
            <p className="text-[12.5px] text-slate-700">Scanning {DOC_META[docType].label.toLowerCase()}{fileName ? ' — ' + fileName : ''}…</p>
            <span className="ml-auto text-[10.5px] font-mono text-[var(--color-accent)]">~800 ms</span>
          </div>
        </div>
      ) : null}

      {fields ? (
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-primary/25 space-y-2">
            <div className="flex items-center gap-1.5">
              <ScanLine className="h-3 w-3 text-[var(--color-accent)]" />
              <p className="text-[10.5px] font-semibold text-[var(--color-accent)] uppercase tracking-wide">OCR draft — review before applying</p>
              {fileName ? <span className="text-[10.5px] text-slate-400">· {fileName}</span> : null}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {(Object.entries(fields) as [keyof OcrFields, OcrField][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 min-w-0">
                  <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide w-[68px] flex-shrink-0">{k}</span>
                  <span className="text-[12.5px] text-slate-900 font-medium truncate">{v.value}</span>
                  <ReasoningChip compact tone={toneFor(v.confidence)} title={`${Math.round(v.confidence * 100)}%`} />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10.5px] text-slate-500 mr-auto">HITL — every field editable on the form. Decision audited.</span>
            <button type="button" onClick={discard} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200">
              <X className="h-3 w-3" /> Discard
            </button>
            <button type="button" onClick={applyFields} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white">
              <Check className="h-3 w-3" /> Apply to form
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
