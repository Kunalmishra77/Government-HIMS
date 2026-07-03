"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, type Role } from "@/store/useAuthStore"
import { AppShell } from "./AppShell"

interface Props {
  allowedRole: Role
  children: React.ReactNode
}

export function RoleGuard({ allowedRole, children }: Props) {
  const { currentUser, activeRole } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!currentUser) {
      router.replace('/')
      return
    }
    if (activeRole !== allowedRole) {
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
  }, [currentUser, activeRole, allowedRole, router])

  if (!currentUser || activeRole !== allowedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-3" role="status" aria-label="Redirecting" />
          <p className="text-sm font-medium text-foreground-lighter">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
