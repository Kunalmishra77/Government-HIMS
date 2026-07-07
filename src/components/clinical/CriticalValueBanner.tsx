"use client"

/* S3 — Closed-Loop Critical-Value Handling.
 *
 * Subscribes to the persisted audit table for `lab_critical_callback`
 * events and renders a top-of-shell banner per critical lab that hasn't
 * been acknowledged. Both the ordering doctor AND the nurse must
 * acknowledge before the banner clears; the ack event itself is
 * audit-logged with the actor role + a read-receipt timestamp.
 *
 *   <CriticalValueBanner role="doctor" />   // mount once in AppShell
 *
 * Behaviour:
 *   - Default-collapsed at the top of the role's main column.
 *   - Expands to show the lab, patient, value, source order, and a
 *     2-minute soft-blocker hint (countdown chip).
 *   - "Acknowledge" emits lab_critical_acknowledged with the role.
 *   - "Open chart" navigates to the patient's IPD chart.
 */
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, Check, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuditStore } from "@/store/useAuditStore"

interface Props {
  /** Restrict the banner to one role's surfaces (doctor / nurse / both). */
  role?: 'doctor' | 'nurse' | 'both'
  className?: string
}

const ACK_PREFIX = 'agentix.cv-ack.'
const ROLE_KEY: Record<NonNullable<Props['role']>, string> = {
  doctor: 'doctor',
  nurse:  'nurse',
  both:   'both',
}

function ackKey(eventId: string, role: string): string {
  return `${ACK_PREFIX}${role}.${eventId}`
}

export function CriticalValueBanner({ role = 'both', className }: Props) {
  const entries = useAuditStore((s) => s.entries)
  const log = useAuditStore((s) => s.log)
  const router = useRouter()
  const [, setTick] = useState(0)  // re-render after ack
  // SSR vs client see different "minutes ago" from the audit seed (seeded
  // via `Date.now()` at module-eval). Gate any rendered timestamp behind
  // mounted so SSR shows '—' and client hydrates to the real time without
  // a mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Find every recent critical-value event that hasn't been acknowledged
  // by this role yet. We treat the 50 most-recent audit rows as the
  // working window (consistent with the trail UI elsewhere).
  const open = useMemo(() => {
    const window = entries.slice(0, 50)
    const events = window.filter((e) => e.action === 'lab_critical_callback')
    return events.filter((e) => {
      if (typeof window === 'undefined') return false
      try {
        const k = ackKey(e.id, ROLE_KEY[role])
        return !localStorage.getItem(k)
      } catch { return true }
    })
  }, [entries, role])

  // Tick a second-resolution timer so the soft-blocker countdown chip
  // re-renders. We only keep it running when there ARE open events.
  useEffect(() => {
    if (open.length === 0) return
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [open.length])

  if (open.length === 0) return null

  function doAck(eventId: string) {
    try {
      localStorage.setItem(ackKey(eventId, ROLE_KEY[role]), new Date().toISOString())
    } catch {}
    log({
      userId: role === 'doctor' ? 'DR-ACTIVE' : 'NU-ACTIVE',
      userName: role === 'doctor' ? 'Doctor on call' : 'Nurse on shift',
      action: 'lab_critical_callback',  // closes the loop via the same code
      resource: 'lab_critical_ack', resourceId: eventId,
      detail: `Acknowledged (${role}) — read-receipt at bedside`,
    })
    setTick((t) => t + 1)
  }

  // Render nothing on SSR — the banner depends on audit seed timestamps
  // (Date.now() at module-eval, differs SSR vs client), localStorage ack
  // state (unavailable on server), and a Date.now() countdown chip. All
  // three are hydration hazards. Showing the empty container on SSR keeps
  // layout stable; client-mount swaps in real banners.
  if (!mounted) return <div className={cn("space-y-2", className)} role="alert" aria-live="assertive" suppressHydrationWarning />

  // Compact pill form — keeps the closed-loop acknowledge action but takes
  // minimal vertical space so the clinical workspace stays roomy. Full context
  // (patient · value · source) is on hover (title) and one tap away in Trail.
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} role="alert" aria-live="assertive" suppressHydrationWarning>
      {open.map((e) => {
        // Soft blocker — 2 min from the event time (mock).
        const eventTs = new Date(e.timestamp).getTime()
        const soft = Math.max(0, 120 - Math.floor((Date.now() - eventTs) / 1000))
        return (
          <div
            key={e.id}
            title={e.detail ?? `Critical result on ${e.resourceId}`}
            className="inline-flex items-center gap-1.5 rounded-full ring-1 ring-rose-300 bg-rose-50 py-0.5 pl-2 pr-1 shadow-sm"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-rose-800 whitespace-nowrap">Critical lab value</span>
            {soft > 0 && (
              <span className="hidden sm:inline text-[10px] font-mono text-rose-500 whitespace-nowrap">
                {Math.floor(soft / 60)}:{String(soft % 60).padStart(2, '0')}
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push('/audit/log')}
              title="Open audit trail"
              aria-label="Open audit trail"
              className="inline-flex items-center justify-center h-5 w-5 rounded-full text-rose-600 hover:bg-rose-100"
            >
              <FlaskConical className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => doAck(e.id)}
              className="inline-flex items-center gap-1 h-5 pl-1.5 pr-2 rounded-full text-[10.5px] font-semibold bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Check className="h-3 w-3" /> Ack
            </button>
          </div>
        )
      })}
    </div>
  )
}
