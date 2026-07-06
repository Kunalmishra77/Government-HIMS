"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { generateRadiologyReport } from "@/ai-services/radiology-report"
import { HitlReviewCard } from "@/components/features/HitlReviewCard"
import type { RadiologySuggestion } from "@/ai-services/radiology-report"
import type { AiEnvelope } from "@/types/ai"
import { Bot, Loader2, FileText, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

const REPORT_TEMPLATES = [
  { id: 'T-001', nameKey: 't001', modalityKey: 'modalityXray' },
  { id: 'T-002', nameKey: 't002', modalityKey: 'modalityCt' },
  { id: 'T-003', nameKey: 't003', modalityKey: 'modalityMri' },
  { id: 'T-004', nameKey: 't004', modalityKey: 'modalityUsg' },
] as const

export default function RadiologyTemplates() {
  const t = useTranslations("radiology")
  const [report, setReport] = useState<AiEnvelope<RadiologySuggestion> | null>(null)
  const [loading, setLoading] = useState(false)

  const generateReport = async (studyId: string) => {
    setLoading(true)
    const result = await generateRadiologyReport(studyId)
    setReport(result)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <p className="t-body text-foreground-lighter">
        {t("templates.subtitle")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REPORT_TEMPLATES.map((tpl) => (
          <div key={tpl.id} className="hms-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-foreground-placeholder" />
              <div>
                <p className="font-semibold text-foreground text-sm">{t(`templates.${tpl.nameKey}`)}</p>
                <p className="text-xs text-foreground-lighter">{t(`templates.${tpl.modalityKey}`)}</p>
              </div>
            </div>
            <button
              onClick={() => generateReport(tpl.id)}
              disabled={loading}
              className="u-press flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-[#0D2032] rounded-lg hover:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              {t("templates.aiFill")}
            </button>
          </div>
        ))}
      </div>

      {report && (
        <HitlReviewCard
          envelope={report}
          title={t("templates.reviewTitle")}
          featureId="radiology-report-gen"
          renderContent={(data) => (
            <div className="space-y-3 text-sm">
              <div>
                <p className="t-overline text-foreground-lighter mb-1">{t("templates.findings")}</p>
                <p className="text-foreground-muted leading-relaxed">{data.findings}</p>
              </div>
              <div>
                <p className="t-overline text-foreground-lighter mb-1">{t("templates.impression")}</p>
                <p className="font-semibold text-foreground">{data.impression}</p>
              </div>
              {data.recommendations.length > 0 && (
                <div>
                  <p className="t-overline text-foreground-lighter mb-1">{t("templates.recommendations")}</p>
                  <ul className="space-y-1">
                    {data.recommendations.map((r, i) => <li key={i} className="text-foreground-lighter text-xs">• {r}</li>)}
                  </ul>
                </div>
              )}
              {data.criticalFindings.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-danger-bg border border-danger/25 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-danger-strong">{t("templates.criticalFindings")}</p>
                    {data.criticalFindings.map((f, i) => <p key={i} className="text-xs text-danger">{f}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}
          onAccept={() => toast.success(t("templates.toastAccepted"))}
          onReject={() => setReport(null)}
        />
      )}
    </div>
  )
}
