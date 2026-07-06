"use client"

import { cn } from "@/lib/utils"

interface AvatarProps {
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}

// Restrained cool-professional palette (no warm rainbow) — subtle variation for
// list legibility while staying within the single deep-blue/slate identity.
const colors = [
  "bg-[#1E3A8A] text-white",
  "bg-[#16324A] text-white",
  "bg-[#475467] text-white",
  "bg-[#334155] text-white",
  "bg-[#16324A] text-white",
]

function getColor(name: string) {
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
  const sizeClass = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" }[size]
  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      className={cn("rounded-full flex items-center justify-center font-semibold flex-shrink-0", getColor(name), sizeClass, className)}
    >
      <span aria-hidden="true">{initials}</span>
    </div>
  )
}
