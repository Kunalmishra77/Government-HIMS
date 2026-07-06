import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

// Advance a visit's status in the shared DB (service role). Used by every module
// so a status change (Send to Vitals, vitals recorded, sent to pharmacy, …) on
// one device propagates — via Supabase Realtime + hydrateReal — to every other
// device, regardless of the acting staff role. Avoids the per-role visits UPDATE
// RLS (doctor_id scoping etc.) that would otherwise block cross-device advances.
//
// FOLLOW-UP for production: verify the caller's session/role here before writing.

const STATUSES = ['scheduled', 'waiting', 'vitals', 'consulting', 'pharmacy', 'billing', 'completed', 'cancelled'] as const
type Status = typeof STATUSES[number]

export async function POST(req: NextRequest) {
  let body: { visitId?: string; status?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }
  const { visitId, status } = body
  if (!visitId || !status || !STATUSES.includes(status as Status)) {
    return NextResponse.json({ error: 'visitId and valid status required' }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'completed') patch.completed_at = new Date().toISOString()

  const { error } = await admin.from('visits').update(patch).eq('id', visitId)
  if (error) {
    console.error('[api/opd-advance]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, visitId, status })
}
