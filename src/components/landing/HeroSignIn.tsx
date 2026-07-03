"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Mail, Lock, Eye, EyeOff, ArrowRight, QrCode, ShieldCheck, Loader2 } from "lucide-react"
import { useAuthStore, type Role } from "@/store/useAuthStore"

const ROLES: { value: Role; label: string; href: string }[] = [
  { value: "doctor", label: "Doctor", href: "/doctor/dashboard" },
  { value: "nurse", label: "Nurse", href: "/nurse/dashboard" },
  { value: "reception", label: "Reception", href: "/reception/dashboard" },
  { value: "admin", label: "Admin", href: "/admin/dashboard" },
  { value: "pharmacy", label: "Pharmacy", href: "/pharmacy/dashboard" },
  { value: "lab", label: "Laboratory", href: "/lab/dashboard" },
  { value: "radiology", label: "Radiology", href: "/radiology/dashboard" },
  { value: "billing", label: "Billing", href: "/billing/dashboard" },
  { value: "patient", label: "Patient", href: "/patient/dashboard" },
]

export function HeroSignIn() {
  const router = useRouter()
  const setRole = useAuthStore(s => s.setRole)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole_] = useState<Role>("doctor")
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const target = ROLES.find(r => r.value === role) ?? ROLES[0]
    setRole(target.value)
    // Brief delay so the button state reads as a real sign-in.
    setTimeout(() => router.push(target.href), 450)
  }

  return (
    <motion.div
      id="signin"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-3xl bg-white border border-[#EAECF2] shadow-[0_24px_60px_rgba(16,24,40,0.12)] p-6 lg:p-7"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="h-9 w-9 rounded-xl bg-[var(--color-primary)]/[0.08] text-[var(--color-accent)] flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[18px] font-bold text-[#101828] leading-tight">Sign in to your console</h2>
          <p className="text-[12.5px] text-[#667085]">Secure, role-based access</p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3.5">
        <div>
          <label className="block text-[12.5px] font-semibold text-[#344054] mb-1.5">Work email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#98A2B3]" />
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@hospital.org" autoComplete="username"
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#EAECF2] bg-white text-[14px] text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[12.5px] font-semibold text-[#344054]">Password</label>
            <button type="button" className="text-[11.5px] font-semibold text-[var(--color-accent)] hover:underline cursor-pointer">Forgot?</button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#98A2B3]" />
            <input
              type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              className="w-full h-11 pl-9 pr-10 rounded-xl border border-[#EAECF2] bg-white text-[14px] text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 transition"
            />
            <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#98A2B3] hover:text-[#475467] hover:bg-[#F8FAFC] cursor-pointer">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[12.5px] font-semibold text-[#344054] mb-1.5">Role</label>
          <select value={role} onChange={e => setRole_(e.target.value as Role)}
            className="w-full h-11 px-3 rounded-xl border border-[#EAECF2] bg-white text-[14px] font-medium text-[#101828] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 cursor-pointer transition">
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <button type="submit" disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl text-[15px] font-semibold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] transition-colors cursor-pointer shadow-[0_8px_24px_rgba(238,107,38,0.18)] disabled:opacity-70">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <span className="h-px flex-1 bg-[#EAECF2]" />
        <span className="text-[11px] font-semibold text-[#98A2B3]">or</span>
        <span className="h-px flex-1 bg-[#EAECF2]" />
      </div>

      <button onClick={() => router.push("/checkin")}
        className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-semibold text-[#344054] bg-white border border-[#EAECF2] hover:border-[#D0D5DD] transition-colors cursor-pointer">
        <QrCode className="h-4 w-4 text-[var(--color-accent)]" /> Patient self check-in
      </button>

      <p className="mt-3 text-center text-[11.5px] text-[#98A2B3]">
        Demo environment — any credentials work. Pick a role to explore.
      </p>
    </motion.div>
  )
}
