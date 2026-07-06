"use client"

/**
 * Reusable content modal — the shared primitive for forms, detail views and
 * confirmations that need a body (not just yes/no — use ConfirmDialog for that).
 *
 * Token-driven, accessible by construction: focus trap, Escape to close,
 * scrim-to-dismiss, `role="dialog"` + `aria-modal`, labelled by its title.
 * Animates from a scale+fade (spatial origin) and respects reduced motion via
 * the global CSS. Replaces the hand-rolled modals scattered across modules.
 */
import { type ReactNode, useId } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFocusTrap } from "@/lib/useFocusTrap"

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** Optional leading icon chip in the header. */
  icon?: React.ElementType
  size?: keyof typeof SIZES
  children: ReactNode
  /** Pinned footer (e.g. action buttons). */
  footer?: ReactNode
  /** Hide the × button (e.g. a required step). Escape / scrim still close. */
  hideClose?: boolean
  className?: string
}

export function Modal({
  open, onClose, title, description, icon: Icon, size = "md",
  children, footer, hideClose, className,
}: ModalProps) {
  const reduce = useReducedMotion()
  const titleId = useId()
  const descId = useId()
  const trapRef = useFocusTrap<HTMLDivElement>(open)

  if (typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onKeyDown={(e) => { if (e.key === "Escape") onClose() }}
        >
          {/* Scrim — 40%+ keeps the foreground legible (WCAG/HIG). */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
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
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative w-full bg-surface shadow-modal flex flex-col max-h-[92vh]",
              "rounded-t-2xl sm:rounded-2xl",
              SIZES[size],
              className,
            )}
          >
            <header className="flex items-start gap-3 px-5 py-4 border-b border-border">
              {Icon && (
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent flex-shrink-0">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="t-title text-foreground">{title}</h2>
                {description && (
                  <p id={descId} className="t-caption text-foreground-lighter mt-0.5">{description}</p>
                )}
              </div>
              {!hideClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="tap -mr-1.5 -mt-1 grid place-items-center h-8 w-8 rounded-lg text-foreground-lighter hover:bg-surface-sunken hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer && (
              <footer className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border bg-surface-sunken/50 rounded-b-2xl">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
