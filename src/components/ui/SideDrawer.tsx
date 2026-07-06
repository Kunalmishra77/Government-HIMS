"use client"

/**
 * Slide-out drawer — the shared primitive for clinical actions, detail panels
 * and order forms that need a tall scrollable surface (use `Modal` for centred
 * dialogs). Extracted from the doctor dashboard's inline drawer and tokenised.
 *
 * Accessible by construction (mirrors `Modal`): focus trap + restore, Escape to
 * close, scrim-to-dismiss, `role="dialog"` + `aria-modal`, body scroll-lock, and
 * reduced-motion support. Opens from the right (clinical actions) or left
 * (queues/navigation).
 */
import { type ReactNode, useId, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFocusTrap } from "@/lib/useFocusTrap"

const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
} as const

const TONE = {
  brand:  "bg-primary text-[#0D2032]",
  danger: "bg-danger text-white",
} as const

export interface SideDrawerProps {
  open: boolean
  onClose: () => void
  /** Side it slides in from. Right = clinical actions, left = queues/nav. */
  side?: "left" | "right"
  title: string
  description?: string
  icon: LucideIcon
  /** Count chip beside the title (e.g. number of orders). */
  badge?: number
  width?: keyof typeof WIDTHS
  /** Icon-chip tone. `danger` for destructive surfaces (e.g. admission). */
  tone?: keyof typeof TONE
  footer?: ReactNode
  children: ReactNode
  className?: string
}

export function SideDrawer({
  open, onClose, side = "right", title, description, icon: Icon,
  badge, width = "md", tone = "brand", footer, children, className,
}: SideDrawerProps) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const descId = useId()
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (typeof document === "undefined") return null

  const off = side === "left" ? "-100%" : "100%"

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)]"
          onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="absolute inset-0 bg-[rgba(13,37,61,0.45)] backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { x: off }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: off }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute top-0 bottom-0 flex w-full flex-col bg-surface shadow-modal",
              WIDTHS[width],
              side === "left" ? "left-0" : "right-0",
              className,
            )}
          >
            <header className="flex flex-shrink-0 items-center gap-2.5 border-b border-border px-5 py-4">
              <span className={cn("grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl", TONE[tone])}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id={titleId} className="t-title text-foreground truncate">{title}</h2>
                  {badge ? (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-soft px-1.5 text-[10px] font-bold text-accent">{badge}</span>
                  ) : null}
                </div>
                {description && <p id={descId} className="t-caption text-foreground-lighter truncate mt-0.5">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="tap grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-foreground-lighter hover:bg-surface-sunken hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <div className="flex-shrink-0 border-t border-border bg-surface px-5 py-4">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
