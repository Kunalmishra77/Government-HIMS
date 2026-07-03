import { Avatar } from "./avatar"
import { cn } from "@/lib/utils"

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12",
}

/**
 * Patient avatar that shows an uploaded/Aadhaar photo when present and falls
 * back to the deterministic initials Avatar otherwise.
 */
export function PatientAvatar({ name, photoUrl, size = "md", className }: {
  name: string
  photoUrl?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn(SIZE[size], "rounded-full object-cover flex-shrink-0 border border-border-light", className)}
      />
    )
  }
  return <Avatar name={name} size={size} className={className} />
}
