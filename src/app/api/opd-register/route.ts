import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

// Server-side OPD registration/check-in — creates the shared patient + visit in
// Postgres using the service role, so it works for BOTH the anonymous
// self-check-in kiosk AND logged-in staff without exposing patient PII to the
// browser's anon role. Every module then reads the queue from the DB
// (usePatientStore.hydrateReal) + Supabase Realtime, so a patient checked in on
// one device appears on every device.
//
// FOLLOW-UP for production: gate this route (kiosk token / rate-limit) so it
// can't be used to spam patient rows.

type Body = {
  id: string
  name: string
  phone: string
  age?: number
  gender?: 'Male' | 'Female' | 'Other'
  bloodGroup?: string
  uhid?: string
  abhaId?: string
  aadhaarVerified?: boolean
  department?: string
  doctor?: string
  token?: number
  symptoms?: string[]
  triageLevel?: 'Low' | 'Medium' | 'High' | 'Critical'
  estimatedWait?: number
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = await req.json()
    if (!body?.id || !body?.name || !body?.phone) throw new Error('id, name, phone required')
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()
  const now = new Date().toISOString()

  try {
    // Upsert the patient (id is deterministic client-side, so re-check-in is idempotent).
    const { error: pErr } = await admin.from('patients').upsert({
      id: body.id, hn: body.id, full_name: body.name, phone: body.phone,
      age: body.age ?? 30, sex: body.gender ?? 'Male', blood_group: body.bloodGroup ?? 'A+',
      uhid: body.uhid ?? null, abha_id: body.abhaId ?? null,
      aadhaar_verified: body.aadhaarVerified ?? false, updated_at: now,
    }, { onConflict: 'id' })
    if (pErr) throw new Error(`patient: ${pErr.message}`)

    // One active OPD visit per patient — reuse an open one, else create it.
    const { data: openVisits } = await admin.from('visits')
      .select('id').eq('patient_id', body.id).not('status', 'in', '(completed,cancelled)').limit(1)
    let visitId = openVisits?.[0]?.id
    if (!visitId) {
      visitId = `VIS-${body.id}-${Date.now().toString(36)}`
      const { error: vErr } = await admin.from('visits').insert({
        id: visitId, patient_id: body.id, kind: 'OPD', status: 'waiting',
        department: body.department ?? 'General Medicine', doctor_name: body.doctor ?? 'Dr. Priya Nair',
        token: body.token ?? null, symptoms: body.symptoms ?? [],
        chief_complaint: body.symptoms?.[0] ?? null, triage_level: body.triageLevel ?? 'Low',
        estimated_wait_min: body.estimatedWait ?? null, created_at: now, updated_at: now,
      })
      if (vErr) throw new Error(`visit: ${vErr.message}`)
    }

    return NextResponse.json({ ok: true, patientId: body.id, visitId, uhid: body.uhid ?? null })
  } catch (err) {
    console.error('[api/opd-register]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
