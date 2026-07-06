"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, type Role } from "@/store/useAuthStore"
import { AppShell } from "./AppShell"

interface Props {
  // A single role, or (for pages where the real RLS/backend authorizes more
  // than one real role for the same action — e.g. admission/bed-assignment,
  // granted to both 'reception' and 'admin') a list of allowed roles.
  allowedRole: Role | Role[]
  children: React.ReactNode
}

export function RoleGuard({ allowedRole, children }: Props) {
  const { currentUser, activeRole } = useAuthStore()
  const router = useRouter()
  const allowed = Array.isArray(allowedRole) ? allowedRole : [allowedRole]
  const isAllowed = allowed.includes(activeRole)

  // useAuthStore uses `skipHydration: true` (see useAuthStore.ts) — its
  // persisted (localStorage) state only gets restored once StoreHydrator's
  // mount effect calls `useAuthStore.persist.rehydrate()`, which happens
  // AFTER this component's own first render/effect. Evaluating `isAllowed`
  // before that finishes sees the store's hardcoded pre-hydration default
  // (`activeRole: 'doctor'`) instead of the real signed-in role, so a
  // correctly-authenticated real user on a hard page reload gets bounced
  // through the DEFAULT role's dashboard first, then a second redirect
  // (once rehydration lands) corrects it to their own — a jarring, and on
  // a slower load, sometimes-observable double-redirect. Gate on hydration
  // completion so this only ever evaluates once, against the real state.
  // `.persist` is only meaningful client-side (its storage getter reads
  // `localStorage`, which doesn't exist during Next.js's server render of
  // this "use client" component) — read it only inside an effect, never
  // during render, so this never runs/throws on the server.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    // Bounded fallback: zustand persist's error path (a corrupted/malformed
    // localStorage value for `agentix-authstore` — verified by reading
    // node_modules/zustand/esm/middleware.mjs) never calls
    // `finishHydrationListeners` and never flips `hasHydrated()` true. With
    // no fallback, `hydrated` would stay false forever and every role-gated
    // page below would show an infinite "Redirecting..." spinner with no
    // recovery. If real hydration hasn't finished within a few seconds,
    // force `hydrated` true anyway — `currentUser` will still be whatever
    // the pre-hydration default is (or null), so this degrades to "treated
    // as unauthenticated, redirected to login" rather than hanging forever.
    const timeout = setTimeout(() => setHydrated(true), 4000)
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      clearTimeout(timeout)
      setHydrated(true)
    })
    return () => {
      unsub()
      clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!currentUser) {
      router.replace('/')
      return
    }
    if (!isAllowed) {
      const roleHomeMap: Record<Role, string> = {
        patient:       '/patient/dashboard',
        doctor:        '/doctor/dashboard',
        reception:     '/reception/dashboard',
        admin:         '/admin/dashboard',
        hr:            '/hr/dashboard',
        nurse:         '/nurse/dashboard',
        emergency:     '/emergency/dashboard',
        lab:           '/lab/dashboard',
        radiology:     '/radiology/dashboard',
        insurance:     '/insurance/dashboard',
        inventory:     '/inventory/dashboard',
        pharmacy:      '/pharmacy/dashboard',
        bed_manager:   '/admission/dashboard',
        discharge:     '/discharge/dashboard',
        billing:       '/billing/dashboard',
        ot:            '/ot/dashboard',
        housekeeping:  '/housekeeping/dashboard',
        quality:           '/quality/dashboard',
        feedback_analyst:  '/feedback/dashboard',
        blood_bank:    '/bloodbank/dashboard',
        cssd:          '/cssd/dashboard',
        dietary:       '/dietary/dashboard',
        bmw:           '/bmw/dashboard',
        mortuary:      '/mortuary/dashboard',
        ambulance:     '/ambulance/dashboard',
        audit_officer:   '/audit/dashboard',
        vendor_manager:  '/vendor-manager/dashboard',
        cmo:             '/cmo',
        secretary:       '/secretary',
      }
      router.replace(roleHomeMap[activeRole] ?? '/')
    }
  }, [hydrated, currentUser, activeRole, isAllowed, router])

  if (!hydrated || !currentUser || !isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-[rgba(8,145,178,0.20)] border-t-blue-600 animate-spin mx-auto mb-3" role="status" aria-label="Redirecting" />
          <p className="text-sm font-medium text-slate-500">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
