// Cross-device Lab / Radiology / Pharmacy order board.
//
// The doctor's lab/radiology/pharmacy orders must appear in those modules on
// OTHER machines. Each order is pushed to the shared `opd_orders` table as its
// full JSON payload and pulled back verbatim — no per-schema mapping. Every
// module hydrates + polls this board, so orders (and their status as modules
// process them) propagate to every device. All three modules run as
// authenticated staff, so they read/write the board directly (RLS:
// opd_orders_all_staff).
import { getSupabaseClient } from '@/lib/supabase/client'
import type { StoreApi } from 'zustand'

export type OrderType = 'lab' | 'radiology' | 'pharmacy'
type OrderLike = { id: string; patientId?: string; patientName?: string; status?: string }

// Ids known to be part of the shared board (created via doctor dispatch or
// pulled from the DB) — only these are auto-synced back on local change, so a
// device's private seed orders are never published.
const sharedIds = new Set<string>()

export async function pushOrder(type: OrderType, order: OrderLike): Promise<void> {
  sharedIds.add(order.id)
  try {
    await getSupabaseClient().from('opd_orders').upsert({
      id: order.id, order_type: type,
      patient_id: order.patientId ?? null, patient_name: order.patientName ?? null,
      status: order.status ?? null, payload: order, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  } catch { /* not authed / offline — the local order still stands */ }
}

export async function pullOrders<T extends { id: string }>(type: OrderType): Promise<T[]> {
  try {
    const { data, error } = await getSupabaseClient().from('opd_orders').select('payload').eq('order_type', type)
    if (error || !data) return []
    const out = data.map((r) => r.payload as T)
    out.forEach((o) => sharedIds.add(o.id))
    return out
  } catch { return [] }
}

// Merge shared orders pulled from the board into a local array: replace by id,
// append new, keep local-only (seed/demo) items untouched.
export function mergeById<T extends { id: string }>(local: T[], pulled: T[]): T[] {
  if (!pulled.length) return local
  const byId = new Map(pulled.map((o) => [o.id, o]))
  const merged = local.map((o) => byId.get(o.id) ?? o)
  const have = new Set(merged.map((o) => o.id))
  return [...pulled.filter((o) => !have.has(o.id)), ...merged]
}

// Auto-publish a shared order back to the board whenever it changes locally
// (e.g. Lab releases a result, Pharmacy dispenses), so other devices see the
// progress. Returns an unsubscribe fn. Only pushes orders already known shared,
// and only when their payload actually changed — avoids storms and loops.
export function bindOrderSync<S extends object, T extends OrderLike>(
  store: StoreApi<S>, type: OrderType, getOrders: (s: S) => T[],
): () => void {
  const lastSig = new Map<string, string>()
  return store.subscribe((state) => {
    for (const o of getOrders(state)) {
      if (!sharedIds.has(o.id)) continue
      const sig = JSON.stringify(o)
      if (lastSig.get(o.id) === sig) continue
      lastSig.set(o.id, sig)
      void pushOrder(type, o)
    }
  })
}
