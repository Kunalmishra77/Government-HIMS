import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "danger" | "success"
  size?: "xs" | "default" | "sm" | "lg" | "icon"
  isLoading?: boolean
  icon?: React.ElementType
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, icon: Icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || props.disabled}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          {
            "bg-primary text-[#0D2032] hover:bg-primary-dark hover:text-[#0D2032] shadow-sm hover:shadow focus-visible:ring-primary": variant === "default" || variant === "primary",
            "bg-surface-sunken text-foreground border border-border hover:bg-border-light hover:border-border-hover focus-visible:ring-border-hover": variant === "secondary",
            "border border-border bg-surface text-foreground-muted hover:bg-background hover:border-border-hover hover:text-foreground shadow-sm focus-visible:ring-border-hover": variant === "outline",
            "text-foreground-lighter hover:bg-surface-sunken hover:text-foreground focus-visible:ring-border-hover": variant === "ghost",
            "bg-danger text-white hover:bg-danger-strong shadow-sm focus-visible:ring-danger": variant === "danger",
            "bg-success text-white hover:bg-success-strong shadow-sm focus-visible:ring-success": variant === "success",

            "h-8 px-2.5 text-xs": size === "xs",
            "h-10 px-4 py-2": size === "default",
            "h-9 px-3 text-xs": size === "sm",
            "h-11 px-5 text-sm": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4 text-current flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : Icon ? (
          <Icon className="h-4 w-4 flex-shrink-0" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"
export { Button }
