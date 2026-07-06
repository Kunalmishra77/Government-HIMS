/* PharmacyStock + PharmacyPurchaseOrders — standing drug inventory and the
 * procurement requests raised against it. Mirrors `StockItem`/`PurchaseOrder`
 * in src/store/usePharmacyInventoryStore.ts and the `pharmacy_stock_items` /
 * `pharmacy_purchase_orders` tables in
 * supabase/migrations/20260705050000_pharmacy_schema.sql.
 *
 * IMPORTANT: unlike every other Phase 1-5 entity, a stock item has no natural
 * "order" event to materialize a real row from — it is standing inventory,
 * not per-patient. PharmacyStock.getOrCreateByName() is this module's answer:
 * an upsert-by-name (pharmacy_stock_items.name is UNIQUE) that either finds
 * the existing real row or creates it from whatever fields the caller has on
 * hand (typically the matching local StockItem). Callers (Tasks 6/7) are
 * expected to cache the returned row's `id` locally rather than re-resolving
 * by name on every call.
 *
 * `raisedBy` (PurchaseOrder) is NOT verified by this module — see
 * pharmacy-dispenses.ts's module-level note; the same actor-identity caveat
 * applies here. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const PharmDrugSchedule = z.enum(['X', 'H1'])
export const POKind = z.enum(['patient', 'restock'])
export const POStatus = z.enum(['pending', 'ordered', 'received'])

export const StockItemSchema = z.object({
  id: z.string(),                    // 'PSI-...'
  name: z.string(),
  category: z.string(),
  qty: z.number().int().nonnegative(),
  unit: z.string(),
  reorderAt: z.number().int().nonnegative(),
  maxStock: z.number().int().nonnegative(),
  schedule: PharmDrugSchedule.optional(),
  updatedAt: z.string(),
})
export type StockItem = z.infer<typeof StockItemSchema>

const stockItems = table<StockItem>('pharmacy_stock_items', StockItemSchema)

export const PharmacyStock = {
  list: (filter?: (s: StockItem) => boolean) => stockItems.list(filter),
  get: (id: string) => stockItems.get(id),

  async findByName(name: string) {
    const rows = await stockItems.list()
    return rows.find((s) => s.name === name)
  },

  async getOrCreateByName(input: Omit<StockItem, 'id' | 'updatedAt'>) {
    const existing = await PharmacyStock.findByName(input.name)
    if (existing) return existing
    return stockItems.insert({ ...input, id: newId('PSI'), updatedAt: isoNow() })
  },

  async decrementQty(id: string, qty: number) {
    const item = await stockItems.get(id)
    if (!item) return undefined
    return stockItems.patch(id, { qty: Math.max(0, item.qty - qty), updatedAt: isoNow() })
  },

  async restockQty(id: string, qty: number) {
    const item = await stockItems.get(id)
    if (!item) return undefined
    return stockItems.patch(id, { qty: Math.min(item.maxStock, item.qty + qty), updatedAt: isoNow() })
  },

  _table: stockItems,
}

export const PurchaseOrderSchema = z.object({
  id: z.string(),                    // 'PPO-...'
  drug: z.string(),
  qty: z.number().int().positive(),
  kind: POKind,
  forPatient: z.string().optional(),
  raisedBy: z.string(),
  status: POStatus.default('pending'),
  raisedAt: z.string(),
  updatedAt: z.string(),
})
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>

const purchaseOrders = table<PurchaseOrder>('pharmacy_purchase_orders', PurchaseOrderSchema)

export const PharmacyPurchaseOrders = {
  list: (filter?: (p: PurchaseOrder) => boolean) => purchaseOrders.list(filter),
  get: (id: string) => purchaseOrders.get(id),

  // raisedBy: resolved server-side by the caller — see module-level note.
  async create(input: { drug: string; qty: number; kind: PurchaseOrder['kind']; forPatient?: string }, raisedBy: string) {
    const row: PurchaseOrder = {
      ...input, id: newId('PPO'), raisedBy, status: 'pending', raisedAt: isoNow(), updatedAt: isoNow(),
    }
    return purchaseOrders.insert(row)
  },

  async setStatus(id: string, status: PurchaseOrder['status']) {
    return purchaseOrders.patch(id, { status, updatedAt: isoNow() })
  },

  _table: purchaseOrders,
}
