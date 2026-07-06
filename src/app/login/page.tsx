"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { useAuthStore } from "@/store/useAuthStore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const ROLE_DASHBOARD: Record<string, string> = {
  doctor: "/doctor/dashboard",
  nurse: "/nurse/dashboard",
  pharmacy: "/pharmacy/dashboard",
  lab: "/lab/dashboard",
  radiology: "/radiology/dashboard",
  reception: "/reception/opd",
  admin: "/admin/dashboard",
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.session) {
        toast.error(error?.message ?? "Sign-in failed")
        return
      }

      // Bridge the browser session into server-readable cookies (Task 3) so
      // middleware (Task 4) and Server Components can see the signed-in user.
      const syncRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      })
      if (!syncRes.ok) {
        toast.error("Signed in, but couldn't sync the session — try again")
        return
      }

      // Hydrate the app-wide auth store from the real session (Task 6) so
      // `currentUser`/`activeRole` reflect this genuine login everywhere,
      // not just the cookie/redirect handled locally on this page.
      await useAuthStore.getState().hydrateFromSession()
      const currentUser = useAuthStore.getState().currentUser
      if (!currentUser) {
        toast.error("Signed in, but no staff profile found for this account")
        return
      }

      const dashboard = ROLE_DASHBOARD[currentUser.role as string] ?? "/"
      router.push(dashboard)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Sign in — Agentix HIMS</h1>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting || !email || !password} className="w-full">
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
