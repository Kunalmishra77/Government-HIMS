"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { generateDischargeSummary } from "@/ai-services/discharge-summary"
import type { DischargeSummary } from "@/ai-services/discharge-summary"
import type { AiEnvelope } from "@/types/ai"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import { Loader2, Pill, CalendarCheck, AlertTriangle, Utensils, Activity, Droplets, FlaskConical, ScanLine, TrendingUp, TrendingDown, Minus, User, Languages, Printer, Download, Pencil } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { printableHtml, downloadText } from "@/lib/fileIO"
import { notifyAndAudit } from "@/lib/notifyAndAudit"

type ViewMode = 'clinical' | 'patient' | 'hindi'

const TREND_CONFIG = {
  improving: { icon: TrendingUp, color: 'text-green-600' },
  stable: { icon: Minus, color: 'text-slate-500' },
  worsening: { icon: TrendingDown, color: 'text-red-600' },
}

function ClinicalView({ d }: { d: DischargeSummary }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="font-bold text-slate-500 uppercase tracking-wide mb-1">Admission</p>
          <p className="text-slate-700">{d.admissionDate}</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="font-bold text-slate-500 uppercase tracking-wide mb-1">Discharge</p>
          <p className="text-slate-700">{d.dischargeDate}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Discharge Diagnosis</p>
        <p className="font-semibold text-slate-900">{d.dischargeDiagnosis}</p>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Treatment Summary</p>
        <p className="text-slate-700 leading-relaxed">{d.treatmentSummary}</p>
      </div>

      {d.otNotes && (
        <div className="p-3 bg-primary-soft border border-primary/20 rounded-lg">
          <p className="text-xs font-bold text-accent uppercase tracking-wide mb-1">Surgical / OT Notes</p>
          <p className="text-xs text-slate-700">{d.otNotes}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Procedures Done</p>
        <div className="flex flex-wrap gap-1.5">
          {d.proceduresDone.map((p, i) => (
            <span key={i} className="text-xs bg-[rgba(238,107,38,0.07)] text-[#B84A16] px-2 py-0.5 rounded-full border border-[rgba(238,107,38,0.20)]">{p}</span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Condition at Discharge</p>
        <p className="text-slate-700">{d.conditionAtDischarge}</p>
      </div>

      {/* Ward medications administered */}
      {d.wardMedicationsAdministered.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Pill className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ward Medications Administered</p>
          </div>
          <div className="space-y-1">
            {d.wardMedicationsAdministered.map((m, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                <span className="font-semibold text-slate-800">{m.name}</span>
                <span className="text-slate-500">{m.route} · {m.daysGiven}d</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IV Therapy log */}
      {d.ivTherapyLog.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Droplets className="h-3.5 w-3.5 text-[#B84A16]" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">IV Therapy Log</p>
          </div>
          <div className="space-y-1">
            {d.ivTherapyLog.map((iv, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[rgba(238,107,38,0.07)] border border-[rgba(238,107,38,0.15)] rounded-lg text-xs">
                <span className="font-semibold text-slate-800">{iv.fluid}</span>
                <span className="text-slate-500">{iv.rate} · {iv.totalVolume}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lab trends */}
      {d.labTrends.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-[#B84A16]" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Lab Result Trends</p>
          </div>
          <div className="rounded-lg overflow-hidden border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  {['Test', 'On Admission', 'At Discharge', 'Trend'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-bold text-slate-500 uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.labTrends.map((lt, i) => {
                  const cfg = TREND_CONFIG[lt.trend]
                  const TrendIcon = cfg.icon
                  return (
                    <tr key={i} className="bg-white">
                      <td className="px-3 py-2 font-semibold text-slate-800">{lt.test}</td>
                      <td className="px-3 py-2 text-slate-600">{lt.onAdmission}</td>
                      <td className="px-3 py-2 text-slate-600">{lt.onDischarge}</td>
                      <td className="px-3 py-2">
                        <span className={cn("flex items-center gap-1 font-semibold", cfg.color)}>
                          <TrendIcon className="h-3 w-3" />
                          {lt.trend}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Imaging */}
      {d.imagingFindings && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ScanLine className="h-3.5 w-3.5 text-[#B84A16]" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Imaging Findings</p>
          </div>
          <p className="text-xs text-slate-700 p-3 bg-[rgba(238,107,38,0.07)] border border-primary/20 rounded-lg">{d.imagingFindings}</p>
        </div>
      )}

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Pill className="h-3.5 w-3.5 text-slate-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Discharge Medications</p>
        </div>
        <div className="space-y-1.5">
          {d.dischargeMedications.map((med, i) => (
            <div key={i} className="flex items-start justify-between p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs">
              <span className="font-semibold text-slate-800">{med.name}</span>
              <span className="text-slate-600 text-right ml-2">{med.dose} · {med.duration}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <CalendarCheck className="h-3.5 w-3.5 text-slate-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Follow-Up Instructions</p>
        </div>
        <ul className="space-y-1">
          {d.followUpInstructions.map((f, i) => (
            <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#EE6B26] flex-shrink-0 mt-1.5" />{f}
            </li>
          ))}
        </ul>
        <p className="text-xs font-semibold text-[#B84A16] mt-1.5">Next visit: {d.followUpDate}</p>
      </div>

      <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-red-700 mb-1">Warning — Return Immediately If:</p>
          <ul className="space-y-0.5">
            {d.warningSymptoms.map((w, i) => (
              <li key={i} className="text-xs text-red-600">• {w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Utensils className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diet</p>
          </div>
          <p className="text-xs text-slate-700">{d.dietAdvice}</p>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-slate-500" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Activity</p>
          </div>
          <p className="text-xs text-slate-700">{d.activityRestrictions}</p>
        </div>
      </div>
    </div>
  )
}

function PatientView({ d, lang }: { d: DischargeSummary; lang: 'en' | 'hi' }) {
  const text = lang === 'hi' ? d.hindiSummary : d.patientFriendlySummary
  return (
    <div className="bg-white border border-green-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 bg-green-50 border-b border-green-200">
        <User className="h-4 w-4 text-green-600" />
        <span className="text-sm font-bold text-green-800">
          {lang === 'hi' ? 'रोगी सूचना पत्र (हिंदी)' : 'Patient Copy — Plain Language Summary'}
        </span>
      </div>
      <pre className="px-5 py-4 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">{text}</pre>
    </div>
  )
}

export default function DischargeSummaryPage() {
  const params = useParams()
  const admissionId = (params?.id as string) ?? 'ADM-001'
  const [envelope, setEnvelope] = useState<AiEnvelope<DischargeSummary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepted, setAccepted] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('clinical')
  const [editingFollowUp, setEditingFollowUp] = useState(false)
  const [addendum, setAddendum] = useState('')

  function printSummary() {
    if (!envelope) return
    const d = envelope.data
    printableHtml(`Discharge Summary · ${admissionId}`, `
      <div class="info-row">
        <div class="info-item"><span class="info-label">Admission ID</span><span class="info-value">${admissionId}</span></div>
        <div class="info-item"><span class="info-label">Admitted</span><span class="info-value">${d.admissionDate}</span></div>
        <div class="info-item"><span class="info-label">Discharged</span><span class="info-value">${d.dischargeDate}</span></div>
        <div class="info-item"><span class="info-label">Condition at discharge</span><span class="info-value">${d.conditionAtDischarge}</span></div>
      </div>
      <h3>Diagnosis &amp; Procedures</h3>
      <table>
        <tbody>
          <tr><td><b>Diagnosis</b></td><td>${d.dischargeDiagnosis}</td></tr>
          <tr><td><b>Procedures</b></td><td>${d.proceduresDone.join(', ')}</td></tr>
        </tbody>
      </table>
      <h3>Treatment Summary</h3><p>${d.treatmentSummary}</p>
      ${d.otNotes ? `<h3>Surgical Notes</h3><p>${d.otNotes}</p>` : ''}
      <h3>Discharge Medications</h3>
      <table><thead><tr><th>Drug</th><th>Dose</th><th>Duration</th></tr></thead><tbody>
        ${d.dischargeMedications.map(m => `<tr><td>${m.name}</td><td>${m.dose}</td><td>${m.duration}</td></tr>`).join('')}
      </tbody></table>
      <h3>Follow-up Instructions · ${d.followUpDate}</h3>
      <ul>${d.followUpInstructions.map(f => `<li>${f}</li>`).join('')}</ul>
      <h3>Return Immediately If (Warning Signs)</h3>
      <ul>${d.warningSymptoms.map(w => `<li class="warn-li">${w}</li>`).join('')}</ul>
      <h3>Home Care</h3>
      <p><b>Diet:</b> ${d.dietAdvice}</p>
      <p><b>Activity:</b> ${d.activityRestrictions}</p>
      ${addendum ? `<h3>Attending Physician Addendum</h3><div class="highlight-block">${addendum}</div>` : ''}
    `)
  }
  function downloadPatientCopy() {
    if (!envelope) return
    downloadText(`Discharge_summary_${admissionId}.txt`,
      envelope.data.patientFriendlySummary + (addendum ? `\n\nAttending physician note: ${addendum}` : ''))
  }

  useEffect(() => {
    generateDischargeSummary(admissionId).then((res) => {
      setEnvelope(res)
      setLoading(false)
    })
  }, [admissionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 pt-6">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 mr-2" />
        <p className="text-slate-500">Generating discharge summary…</p>
      </div>
    )
  }

  if (!envelope) return null

  const VIEW_TABS: { key: ViewMode; label: string }[] = [
    { key: 'clinical', label: 'Clinical View' },
    { key: 'patient', label: 'Patient Copy' },
    { key: 'hindi', label: 'हिंदी' },
  ]

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Discharge Summary</h2>
        <p className="text-slate-500 text-sm mt-1">{admissionId} · AI draft — attending physician approval required</p>
      </div>

      {accepted ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CalendarCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm">Summary finalised — ready for patient handout</p>
              <p className="text-xs text-green-600 mt-0.5">Follow-up: {envelope.data.followUpDate}</p>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <Languages className="h-4 w-4" />
              <span className="text-xs font-semibold">Multi-language ready</span>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F1F5F9' }}>
            {VIEW_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
                  viewMode === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {viewMode === 'clinical' && (
            <div className="bg-white border shadow-sm rounded-xl p-5">
              <ClinicalView d={envelope.data} />
            </div>
          )}
          {viewMode === 'patient' && <PatientView d={envelope.data} lang="en" />}
          {viewMode === 'hindi' && <PatientView d={envelope.data} lang="hi" />}

          {/* Attending-physician addendum (replaces "no edit form" gap) */}
          <div className="bg-white border shadow-sm rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-amber-500" />
              <h3 className="text-[13.5px] font-bold text-slate-900">Attending physician addendum</h3>
              <span className="ml-auto text-[10.5px] text-slate-400">Optional · printed below the summary</span>
            </div>
            <textarea value={addendum} onChange={(e) => setAddendum(e.target.value)} rows={3}
              placeholder="Any clarification or correction the attending physician wants added to the printed handout."
              className="w-full px-3 py-2 rounded-lg ring-1 ring-slate-200 bg-white text-[13px] focus:outline-none focus:ring-amber-400 resize-none" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={printSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C2481A] hover:bg-[#9A3A14] text-white text-[13px] font-bold cursor-pointer">
              <Printer className="h-4 w-4" /> Print summary
            </button>
            <button onClick={downloadPatientCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[13px] font-semibold cursor-pointer">
              <Download className="h-4 w-4" /> Download patient copy
            </button>
            <button onClick={() => {
              notifyAndAudit({
                to: 'patient', type: 'discharge_ready', priority: 'medium',
                title: `Discharge summary ready`,
                body: `Your discharge summary is final. Pick it up from the nurse's station or download from your portal.`,
                audit: { action: 'admission_discharge', resource: 'discharge_summary', resourceId: admissionId, detail: `Discharge summary ready for handout`, userName: 'Discharge desk' },
              })
              toast.success('Patient notified · discharge summary ready')
            }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold cursor-pointer">
              <CalendarCheck className="h-4 w-4" /> Tell patient it&apos;s ready
            </button>
          </div>
        </div>
      ) : (
        <HitlReviewCard
          envelope={envelope}
          title="AI Discharge Summary Draft"
          featureId="discharge-summary"
          renderContent={(d) => <ClinicalView d={d} />}
          onAccept={() => {
            setAccepted(true)
            toast.success('Discharge summary finalised — ready for print')
          }}
          onReject={() => {
            setEnvelope(null)
            setLoading(true)
            generateDischargeSummary(admissionId).then((res) => {
              setEnvelope(res)
              setLoading(false)
            })
            toast.info('Regenerating summary…')
          }}
        />
      )}
    </div>
  )
}
