import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

// Server-side OPD queue read — returns the live queue (active visits joined with
// their patients) using the service role, so EVERY staff module sees it
// regardless of how they logged in. The demo role-switcher login does not create
// a Supabase auth session, and the per-role RLS SELECT policies on visits/
// patients require a real authenticated staff session — so a direct browser read
// returns nothing for demo staff. Reading through this route (service role)
// bypasses that, which is what makes the queue actually cross-device: a patient
// checked in on one machine appears in Reception/Nurse/Doctor on every machine.
//
// FOLLOW-UP for production: authenticate this route (staff session / API key) so
// the queue (patient names, tokens) isn't world-readable.

export const dynamic = 'force-dynamic'

const VISIT_TO_QUEUE: Record<string, string | undefined> = {
  scheduled: 'waiting', waiting: 'waiting', vitals: 'vitals',
  consulting: 'consulting', pharmacy: 'pharmacy', billing: 'billing',
}

export async function GET() {
  const admin = getSupabaseAdminClient()
  try {
    const { data: visits, error: vErr } = await admin.from('visits')
      .select('*').not('status', 'in', '(completed,cancelled)')
    if (vErr) throw new Error(`visits: ${vErr.message}`)

    const active = (visits ?? []).filter(v => VISIT_TO_QUEUE[v.status])
    if (!active.length) return NextResponse.json({ patients: [] })

    const patientIds = [...new Set(active.map(v => v.patient_id))]
    const { data: patients, error: pErr } = await admin.from('patients')
      .select('*').in('id', patientIds)
    if (pErr) throw new Error(`patients: ${pErr.message}`)

    const byId = new Map((patients ?? []).map(p => [p.id, p]))
    const today = new Date().toISOString().slice(0, 10)

    const queue = active.flatMap(v => {
      const p = byId.get(v.patient_id)
      const qs = VISIT_TO_QUEUE[v.status]
      if (!p || !qs) return []
      return [{
        id: p.id, uhid: p.uhid ?? undefined, name: p.full_name,
        age: p.age ?? 30,
        gender: p.sex === 'Female' ? 'Female' : p.sex === 'Other' ? 'Other' : 'Male',
        phone: p.phone ?? '', bloodGroup: p.blood_group ?? 'A+', token: v.token ?? 0,
        queueStatus: qs, estimatedWait: v.estimated_wait_min ?? 0,
        doctor: v.doctor_name ?? 'Dr. Priya Nair', department: v.department ?? 'General Medicine',
        vitals: null, symptoms: v.symptoms ?? [], history: [],
        registeredAt: '', registeredDate: today, triageLevel: v.triage_level ?? 'Low',
        source: 'appointment', aadhaarVerified: p.aadhaar_verified ?? false,
        abhaId: p.abha_id ?? undefined, visitId: v.id,
      }]
    })

    return NextResponse.json({ patients: queue })
  } catch (err) {
    console.error('[api/opd-queue]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
