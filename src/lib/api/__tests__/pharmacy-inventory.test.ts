import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { PharmacyStock, PharmacyPurchaseOrders } from '@/lib/api/pharmacy-inventory'
import { getSupabaseClient } from '@/lib/supabase/client'

const testStockName = 'Pharm Inventory Test Drug 500mg'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const pharmacyEmail = 'pharm-inventory-test-pharmacy@example.com'
const testPassword = 'Test-Pass-123!'
let pharmacyUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: pharmacyEmail, password: testPassword, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  pharmacyUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: pharmacyUserId, role: 'pharmacy', full_name: 'Pharm Inventory Test Pharmacy',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email: pharmacyEmail, password: testPassword })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
})

afterAll(async () => {
  await admin.from('profiles').delete().eq('id', pharmacyUserId)
  await admin.auth.admin.deleteUser(pharmacyUserId)
})

// Cleanup is keyed on `name`/`drug` (a stable value the test itself always
// controls), not a fixed `id` — PharmacyStock.getOrCreateByName() and
// PharmacyPurchaseOrders.create() both always mint their own id via
// `_core.ts`'s `newId()` on the insert path (matching this module's
// name-keyed-upsert design: unlike every other Phase 1-5 entity, a stock item
// has no caller-supplied id to hang a fixed-id cleanup off of — see
// pharmacy-inventory.ts's module-level note). A fixed test id in the
// `afterEach` filter would never match the real generated id and would leak
// a row into the live table on every run.
afterEach(async () => {
  await admin.from('pharmacy_stock_items').delete().eq('name', testStockName)
  await admin.from('pharmacy_purchase_orders').delete().eq('drug', testStockName)
})

describe('PharmacyStock repository', () => {
  it('getOrCreateByName() creates a new row when none exists', async () => {
    const created = await PharmacyStock.getOrCreateByName({
      name: testStockName, category: 'Analgesic', qty: 100, unit: 'Tabs', reorderAt: 20, maxStock: 500,
    })
    expect(created.name).toBe(testStockName)
    expect(created.qty).toBe(100)
  })

  it('getOrCreateByName() returns the existing row on a second call', async () => {
    const first = await PharmacyStock.getOrCreateByName({
      name: testStockName, category: 'Analgesic', qty: 100, unit: 'Tabs', reorderAt: 20, maxStock: 500,
    })
    const second = await PharmacyStock.getOrCreateByName({
      name: testStockName, category: 'Analgesic', qty: 999, unit: 'Tabs', reorderAt: 20, maxStock: 500,
    })
    expect(second.id).toBe(first.id)
    expect(second.qty).toBe(100) // unchanged — the existing row wins, not the second call's qty
  })

  it('decrementQty() and restockQty() adjust qty within bounds', async () => {
    const item = await PharmacyStock.getOrCreateByName({
      name: testStockName, category: 'Analgesic', qty: 100, unit: 'Tabs', reorderAt: 20, maxStock: 150,
    })
    const decremented = await PharmacyStock.decrementQty(item.id, 30)
    expect(decremented?.qty).toBe(70)
    const restocked = await PharmacyStock.restockQty(item.id, 1000)
    expect(restocked?.qty).toBe(150) // capped at maxStock
  })
})

describe('PharmacyPurchaseOrders repository', () => {
  it('create() raises a pending purchase order', async () => {
    const po = await PharmacyPurchaseOrders.create(
      { drug: testStockName, qty: 50, kind: 'restock' },
      'Pharm Inventory Test Pharmacy',
    )
    expect(po.status).toBe('pending')
    expect(po.raisedBy).toBe('Pharm Inventory Test Pharmacy')
  })

  it('setStatus() transitions pending -> ordered -> received', async () => {
    const po = await PharmacyPurchaseOrders.create(
      { drug: testStockName, qty: 50, kind: 'patient', forPatient: 'Test Patient' },
      'Pharm Inventory Test Pharmacy',
    )
    const ordered = await PharmacyPurchaseOrders.setStatus(po.id, 'ordered')
    expect(ordered?.status).toBe('ordered')
    const received = await PharmacyPurchaseOrders.setStatus(po.id, 'received')
    expect(received?.status).toBe('received')
  })
})
