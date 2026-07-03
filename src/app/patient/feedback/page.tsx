"use client"

import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { usePatientFeedbackStore, type SubmitFeedbackInput } from "@/store/usePatientFeedbackStore"
import { useNotificationStore } from "@/store/useNotificationStore"
import { useAuditStore } from "@/store/useAuditStore"
import { useAuthStore } from "@/store/useAuthStore"
import type { FeedbackRequest, FeedbackRecord, FeedbackCategoryRatings } from "@/types/feedback"
import { Star, CheckCircle, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, MessageSquarePlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Zod schema ────────────────────────────────────────────────────────────────
const CategorySchema = z.object({
  doctorProfessionalism: z.coerce.number().min(1).max(5),
  clinicalExpertise:     z.coerce.number().min(1).max(5),
  communication:         z.coerce.number().min(1).max(5),
  nursingCare:           z.coerce.number().min(1).max(5),
  facilityCleanliness:   z.coerce.number().min(1).max(5),
  waitTime:              z.coerce.number().min(1).max(5),
  billingClarity:        z.coerce.number().min(1).max(5),
})
const FeedbackSchema = z.object({
  overallRating:   z.coerce.number().min(1, 'Please give an overall rating').max(5),
  categories:      CategorySchema,
  nps:             z.coerce.number().min(0).max(10),
  comment:         z.string().max(500).optional(),
  wouldRecommend:  z.boolean(),
})
type FeedbackForm = z.infer<typeof FeedbackSchema>

const CAT_LABELS: Record<keyof FeedbackCategoryRatings, { label: string; low: string; high: string }> = {
  doctorProfessionalism: { label: 'Doctor Professionalism',   low: '😞 Poor', high: '😊 Excellent' },
  clinicalExpertise:     { label: 'Clinical Expertise',       low: '😞 Poor', high: '😊 Excellent' },
  communication:         { label: 'Communication',            low: '😞 Unclear', high: '😊 Very Clear' },
  nursingCare:           { label: 'Nursing Care',             low: '😞 Poor', high: '😊 Excellent' },
  facilityCleanliness:   { label: 'Facility Cleanliness',     low: '😞 Dirty', high: '😊 Spotless' },
  waitTime:              { label: 'Wait Time',                low: '😞 Very Long', high: '😊 Quick' },
  billingClarity:        { label: 'Billing Clarity',          low: '😞 Confusing', high: '😊 Clear' },
}

const NPS_COLORS = [
  '#EF4444','#EF4444','#EE6B26','#EE6B26','#EE6B26',
  '#EAB308','#EAB308','#22C55E','#22C55E','#22C55E','#16A34A',
]

// ── Star rating button row ────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className={cn("h-9 w-9 transition-colors", (hover || value) >= n ? "fill-amber-400 text-amber-400" : "text-slate-200")}
          />
        </button>
      ))}
    </div>
  )
}

// ── Category slider ───────────────────────────────────────────────────────────
function CategorySlider({ label, low, high, value, onChange }: {
  label: string; low: string; high: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className={cn("text-xs font-bold", value >= 4 ? 'text-emerald-600' : value >= 3 ? 'text-amber-600' : 'text-red-600')}>{value}/5</span>
      </div>
      <input
        type="range" min={1} max={5} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full accent-blue-600 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>{low}</span><span>{high}</span>
      </div>
    </div>
  )
}

// ── Sentiment badge ───────────────────────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === 'positive') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Positive</span>
  if (sentiment === 'negative') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Negative</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Neutral</span>
}

// ── Inline Feedback Form ──────────────────────────────────────────────────────
function FeedbackForm({ request, onSubmitted }: { request: FeedbackRequest; onSubmitted: () => void }) {
  const submitFeedback    = usePatientFeedbackStore(s => s.submitFeedback)
  const addNotif          = useNotificationStore(s => s.add)
  const auditLog          = useAuditStore(s => s.log)
  const currentUser       = useAuthStore(s => s.currentUser)
  const [submitting, setSubmitting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FeedbackForm>({
    resolver: zodResolver(FeedbackSchema) as Resolver<FeedbackForm>,
    defaultValues: {
      overallRating: 0,
      categories: { doctorProfessionalism:3, clinicalExpertise:3, communication:3, nursingCare:3, facilityCleanliness:3, waitTime:3, billingClarity:3 },
      nps: 7,
      comment: '',
      wouldRecommend: true,
    },
  })

  const overallRating = watch('overallRating') as number
  const npsVal        = watch('nps') as number
  const recommend     = watch('wouldRecommend') as boolean
  const cats          = watch('categories') as FeedbackCategoryRatings

  const onSubmit = async (data: FeedbackForm) => {
    setSubmitting(true)
    const input: SubmitFeedbackInput = {
      overallRating: data.overallRating as 1|2|3|4|5,
      categories: data.categories,
      nps: data.nps,
      comment: data.comment || undefined,
      wouldRecommend: data.wouldRecommend,
    }
    const record = submitFeedback(request.id, input)
    if (!record) { toast.error('Could not submit feedback'); setSubmitting(false); return }

    addNotif({
      type: 'feedback_submitted', priority: 'low',
      title: 'Thank you for your feedback!',
      body: `Your feedback for your ${request.visitType.toUpperCase()} visit has been recorded.`,
      targetRole: 'patient', channels: ['in_app'], link: '/patient/feedback',
    })
    auditLog({
      userId: currentUser?.id ?? 'patient',
      userName: currentUser?.name ?? request.patientName,
      action: 'feedback_submitted', resource: 'feedback',
      resourceId: record.id,
      detail: `Feedback submitted for ${request.visitType.toUpperCase()} visit · Rating ${data.overallRating}/5`,
    })
    toast.success('Thank you — your feedback has been recorded')
    setSubmitting(false)
    onSubmitted()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-5">
      {/* Overall rating */}
      <div>
        <label className="block text-sm font-bold text-slate-800 mb-3">Overall Rating *</label>
        <StarRating value={overallRating} onChange={v => setValue('overallRating', v)} />
        {errors.overallRating && <p className="text-xs text-red-500 mt-1">Please give an overall rating</p>}
        <p className="text-[11px] text-slate-400 mt-1.5">
          {overallRating === 5 ? 'Excellent' : overallRating === 4 ? 'Good' : overallRating === 3 ? 'Average' : overallRating === 2 ? 'Poor' : overallRating === 1 ? 'Terrible' : ''}
        </p>
      </div>

      {/* Category sliders */}
      <div>
        <label className="block text-sm font-bold text-slate-800 mb-3">Rate Each Area</label>
        <div className="space-y-4">
          {(Object.keys(CAT_LABELS) as (keyof FeedbackCategoryRatings)[]).map(key => (
            <CategorySlider
              key={key}
              {...CAT_LABELS[key]}
              value={cats[key]}
              onChange={v => setValue(`categories.${key}`, v)}
            />
          ))}
        </div>
      </div>

      {/* NPS */}
      <div>
        <label className="block text-sm font-bold text-slate-800 mb-2">
          How likely are you to recommend us? <span className="font-normal text-slate-500">(0 = Not at all · 10 = Definitely)</span>
        </label>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i} type="button"
              onClick={() => setValue('nps', i)}
              className={cn(
                "h-9 w-9 rounded-lg text-sm font-bold border-2 transition-all cursor-pointer",
                npsVal === i ? "text-white border-transparent scale-110 shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300",
              )}
              style={npsVal === i ? { background: NPS_COLORS[i] } : {}}
            >
              {i}
            </button>
          ))}
        </div>
        <input type="hidden" {...register('nps')} value={npsVal} />
      </div>

      {/* Would recommend */}
      <div>
        <label className="block text-sm font-bold text-slate-800 mb-2">Would you recommend us to family or friends?</label>
        <div className="flex gap-3">
          {[
            { val: true,  icon: ThumbsUp,   label: 'Yes',     style: recommend  ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200' },
            { val: false, icon: ThumbsDown, label: 'No',      style: !recommend ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-600 border-slate-200' },
          ].map(({ val, icon: Icon, label, style }) => (
            <button
              key={label} type="button"
              onClick={() => setValue('wouldRecommend', val)}
              className={cn("flex items-center gap-2 h-10 px-5 rounded-xl border-2 text-sm font-bold transition-all cursor-pointer", style)}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-bold text-slate-800 mb-1.5">Your Comments <span className="font-normal text-slate-400">(optional)</span></label>
        <textarea
          {...register('comment')}
          rows={3}
          maxLength={500}
          placeholder="Tell us about your experience…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary-light)] resize-none"
        />
        {errors.comment && <p className="text-xs text-red-500 mt-0.5">{errors.comment.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting || !overallRating}
        className="w-full h-12 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] active:scale-[0.98] text-white font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Submitting…' : <><CheckCircle className="h-4 w-4" /> Submit Feedback</>}
      </button>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PatientFeedbackPage() {
  const currentUser = useAuthStore(s => s.currentUser)
  const records     = usePatientFeedbackStore(s => s.records)
  const requests    = usePatientFeedbackStore(s => s.requests)
  const getPending  = usePatientFeedbackStore(s => s.getPendingForPatient)
  const getRecords  = usePatientFeedbackStore(s => s.getRecordsByPatient)
  const expireStale = usePatientFeedbackStore(s => s.expireStale)
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    usePatientFeedbackStore.persist.rehydrate()
    const t = setTimeout(() => expireStale(), 200)
    return () => clearTimeout(t)
  }, [expireStale])

  const patientId   = currentUser?.id ?? 'PT-20394'
  const pending     = getPending(patientId)
  const myRecords   = getRecords(patientId)

  void records; void requests // used via getPending/getRecords selectors

  return (
    <div className="pb-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <MessageSquarePlus className="h-6 w-6 text-[var(--color-accent)]" /> Feedback & Experience
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Your feedback helps us improve care for everyone.</p>
      </div>

      {/* Pending feedback requests */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Awaiting Your Feedback</h2>
          {pending.map(req => (
            <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
              <div className="flex items-start justify-between p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 uppercase">{req.visitType}</span>
                    <span className="text-xs text-slate-500">{new Date(req.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <p className="font-bold text-slate-800">{req.attendingDoctor}</p>
                  <p className="text-xs text-slate-500">{req.department}{req.diagnosis ? ` · ${req.diagnosis}` : ''}</p>
                </div>
                <button
                  onClick={() => setActiveFormId(activeFormId === req.id ? null : req.id)}
                  className="ml-4 h-9 px-4 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors cursor-pointer"
                >
                  {activeFormId === req.id ? <><ChevronUp className="h-3.5 w-3.5" /> Close</> : <><Star className="h-3.5 w-3.5" /> Give Feedback</>}
                </button>
              </div>

              {activeFormId === req.id && (
                <div className="border-t border-amber-200 bg-white">
                  <FeedbackForm request={req} onSubmitted={() => setActiveFormId(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && myRecords.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <MessageSquarePlus className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">No feedback requests yet</p>
          <p className="text-xs text-slate-400 mt-1">After each visit, a feedback request will appear here.</p>
        </div>
      )}

      {/* Past submissions */}
      {myRecords.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Your Submissions</h2>
          {myRecords.map(rec => (
            <div key={rec.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center gap-4 p-4 text-left cursor-pointer hover:bg-slate-50/60 transition-colors"
                onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
              >
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={cn("h-4 w-4", n <= rec.overallRating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{rec.attendingDoctor} · {rec.department}</p>
                  <p className="text-[11px] text-slate-400">{new Date(rec.visitDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {rec.visitType.toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <SentimentBadge sentiment={rec.sentiment} />
                  {expanded === rec.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>

              {expanded === rec.id && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(Object.entries(rec.categories) as [keyof FeedbackCategoryRatings, number][]).map(([key, val]) => (
                      <div key={key} className="flex justify-between bg-slate-50 rounded-lg px-2 py-1.5">
                        <span className="text-slate-500 truncate">{CAT_LABELS[key].label}</span>
                        <span className={cn("font-bold ml-2 flex-shrink-0", val >= 4 ? 'text-emerald-600' : val >= 3 ? 'text-amber-600' : 'text-red-600')}>{val}/5</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>NPS: <span className="font-bold text-slate-700">{rec.nps}/10</span></span>
                    <span>Recommend: <span className={cn("font-bold", rec.wouldRecommend ? 'text-emerald-600' : 'text-red-600')}>{rec.wouldRecommend ? 'Yes' : 'No'}</span></span>
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 italic leading-relaxed">&ldquo;{rec.comment}&rdquo;</p>
                  )}
                  {rec.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rec.themes.map(t => (
                        <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(238,107,38,0.07)] text-[var(--color-accent)]">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
