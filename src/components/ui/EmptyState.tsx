import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  /** Optional subordinate action (ghost button) beside the primary. */
  secondaryAction?: EmptyStateAction
  /** `sm` for in-card empties (cleared lists); `md` (default) for full-page. */
  size?: "sm" | "md"
}

export function EmptyState({ icon: Icon, title, description, action, secondaryAction, size = "md" }: EmptyStateProps) {
  const sm = size === "sm"
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", sm ? "py-10 px-4" : "py-16 px-6")}>
      <div
        className={cn(
          "relative grid place-items-center rounded-2xl bg-accent-soft ring-1 ring-primary/15 shadow-sm",
          sm ? "mb-3 h-12 w-12" : "mb-4 h-16 w-16",
        )}
      >
        <Icon className={cn("text-accent", sm ? "h-6 w-6" : "h-7 w-7")} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className={cn("text-foreground", sm ? "t-title text-[15px]" : "t-title")}>{title}</p>
      {description && <p className="t-body text-foreground-lighter mt-1.5 max-w-sm">{description}</p>}
      {(action || secondaryAction) && (
        <div className={cn("flex items-center gap-2.5", sm ? "mt-4" : "mt-5")}>
          {action && (
            <button
              onClick={action.onClick}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-[#0D2032] shadow-sm hover:bg-primary-dark u-press transition-colors cursor-pointer"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-semibold text-foreground-muted hover:bg-surface-sunken u-press transition-colors cursor-pointer"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
