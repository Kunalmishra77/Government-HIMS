import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

// Server-side cross-device Lab / Radiology / Pharmacy order board — read + write
// through the service role. Same reason as /api/opd-queue: the demo role-switcher
// login has no Supabase session, and opd_orders RLS requires an authenticated
// staff session, so direct browser push/pull returns nothing for demo staff and
// orders never cross devices. This route makes the board work for every login.
//
// GET  /api/opd-order?type=lab|radiology|pharmacy  -> { orders: <payload>[] }
// POST /api/opd-order  { type, order }             -> { ok: true }
//
// FOLLOW-UP for production: authenticate this route and scope per role.

export const dynamic = 'force-dynamic'

const TYPES = new Set(['lab', 'radiology', 'pharmacy'])

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? ''
  if (!TYPES.has(type)) return NextResponse.json({ error: 'invalid type' }, { status: 400 })

  const admin = getSupabaseAdminClient()
  try {
    const { data, error } = await admin.from('opd_orders').select('payload').eq('order_type', type)
    if (error) throw new Error(error.message)
    return NextResponse.json({ orders: (data ?? []).map(r => r.payload) })
  } catch (err) {
    console.error('[api/opd-order GET]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

type PostBody = {
  type: string
  order: { id: string; patientId?: string; patientName?: string; status?: string }
}

export async function POST(req: NextRequest) {
  let body: PostBody
  try {
    body = await req.json()
    if (!TYPES.has(body?.type) || !body?.order?.id) throw new Error('type + order.id required')
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()
  const { order, type } = body
  try {
    const { error } = await admin.from('opd_orders').upsert({
      id: order.id, order_type: type,
      patient_id: order.patientId ?? null, patient_name: order.patientName ?? null,
      status: order.status ?? null, payload: order, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/opd-order POST]', (err as Error).message)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
