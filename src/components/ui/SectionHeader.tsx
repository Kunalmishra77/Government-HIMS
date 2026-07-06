/**
 * In-card / in-section title row. Replaces the ad-hoc
 *   <h2 className="text-lg font-bold text-[#0F172A] mb-4">…</h2>
 * pattern repeated across modules with a consistent eyebrow + title + count +
 * action layout on the type scale.
 *
 *   <SectionHeader icon={FlaskConical} title="Awaiting collection" count={6}
 *     action={<Link …>View all</Link>} />
 */
import { type ReactNode } from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  /** Small all-caps label above the title. */
  eyebrow?: string
  /** Count chip beside the title. */
  count?: number
  icon?: LucideIcon
  /** Right-aligned action (link / button / filter). */
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, eyebrow, count, icon: Icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="t-overline text-foreground-lighter">{eyebrow}</p>}
          <div className="flex items-center gap-2">
            <h2 className="t-title text-foreground truncate">{title}</h2>
            {count != null && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-sunken px-1.5 text-[11px] font-bold text-foreground-muted tabular-nums">
                {count}
              </span>
            )}
          </div>
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
