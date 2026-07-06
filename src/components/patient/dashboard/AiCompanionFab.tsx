"use client"

/* AI Companion — woven into the dashboard as a floating assistant rather than a
 * standalone card. A FAB (bottom-left, clear of the demo controls) opens a
 * right-side drawer hosting the existing AI companion bar. */

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { SideDrawer } from "@/components/ui/SideDrawer"
import { AiCompanionBar } from "@/components/patient/dashboard/AiCompanionBar"

export function AiCompanionFab() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the AI health companion"
        className="u-press fixed bottom-5 left-5 z-40 inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-3 text-[#0D2032] shadow-lg transition-colors hover:bg-primary-dark"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <span className="t-label">Ask AI</span>
      </button>

      <SideDrawer
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        title="AI health companion"
        description="Ask about your reports, medicines or visit"
        icon={Sparkles}
        width="md"
      >
        <div className="p-4">
          <AiCompanionBar />
        </div>
      </SideDrawer>
    </>
  )
}
