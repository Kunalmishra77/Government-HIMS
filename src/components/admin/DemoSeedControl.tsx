"use client"

/* Demo seed control — visible only on the admin dashboard. Lets the
 * demo presenter reset the in-browser seed (Kiran's full NSTEMI journey
 * + secondary queues) without manually clearing localStorage. */
import { useState } from "react"
import { RotateCw, Database } from "lucide-react"
import { toast } from "sonner"

export function DemoSeedControl() {
  const [busy, setBusy] = useState(false)
  const [openConfirm, setOpenConfirm] = useState(false)

  async function reseed() {
    setBusy(true)
    try {
      const { reseed } = await import("@/lib/api")
      await reseed()
      toast.success("Demo data reseeded · refreshing…", { duration: 1200 })
      // Hard reload so every store rehydrates from the fresh API state.
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload()
      }, 600)
    } catch (err) {
      console.error("[DemoSeedControl] reseed failed:", err)
      toast.error("Reseed failed — see console.")
    } finally {
      setBusy(false)
      setOpenConfirm(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenConfirm(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
        title="Reset all browser-persisted demo data and reseed Kiran's journey."
        aria-label="Reset demo data"
      >
        <Database className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        Demo data
      </button>

      {openConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-[min(440px,90vw)] rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-[var(--color-accent)]">
              <Database className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Reset & reseed demo data</h2>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-slate-600">
              Wipes the mock-API persisted state in your browser and reseeds the
              Kiran Patil (PT-20394) NSTEMI / post-PCI journey plus the secondary
              queues used by every role. Other tabs / users on different machines
              are unaffected. The page will reload.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100"
                onClick={() => setOpenConfirm(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
                onClick={reseed}
                disabled={busy}
              >
                <RotateCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                {busy ? "Reseeding…" : "Reset & reseed"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
