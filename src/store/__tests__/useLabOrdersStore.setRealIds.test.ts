import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLabOrdersStore, type LabOrder } from '@/store/useLabOrdersStore'

// setRealIds matches local specimens/tests to their real-backend counterparts
// by POSITION (not by type/code lookup) precisely so that a future order
// with duplicate test codes — e.g. ['CBC','CBC'] — can never have both local
// tests ambiguously mapped to the same real id via a `find(r => r.code ===
// t.code)` lookup. These tests exercise that guard directly against the
// store's local state, with no backend involved.
function baseOrder(overrides: Partial<LabOrder> = {}): LabOrder {
  return {
    id: 'LO-TEST-1',
    patientId: 'PT-1',
    patientName: 'Test Patient',
    source: 'OPD',
    doctorName: 'Dr. Test',
    orderedAt: new Date().toISOString(),
    paymentMode: 'Cash',
    specimens: [],
    tests: [],
    ...overrides,
  }
}

describe('useLabOrdersStore.setRealIds — positional matching guard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('correctly disambiguates duplicate test codes by index instead of mislinking both to the same real id', () => {
    const order = baseOrder({
      tests: [
        { id: 'LT-A', orderId: 'LO-TEST-1', code: 'CBC', name: 'CBC', bench: 'HEMA', priority: 'Routine', status: 'awaiting_collection', expectedTATmin: 60, orderedAt: new Date().toISOString(), analytes: [] },
        { id: 'LT-B', orderId: 'LO-TEST-1', code: 'CBC', name: 'CBC', bench: 'HEMA', priority: 'Routine', status: 'awaiting_collection', expectedTATmin: 60, orderedAt: new Date().toISOString(), analytes: [] },
      ],
    })
    useLabOrdersStore.setState({ orders: [order], reflexSuggestions: [] })

    useLabOrdersStore.getState().setRealIds('LO-TEST-1', {
      orderId: 'ORD-REAL-1',
      specimens: [],
      tests: [
        { code: 'CBC', realId: 'REAL-TEST-A' },
        { code: 'CBC', realId: 'REAL-TEST-B' },
      ],
    })

    const updated = useLabOrdersStore.getState().orders.find(o => o.id === 'LO-TEST-1')!
    expect(updated.tests.find(t => t.id === 'LT-A')?.realId).toBe('REAL-TEST-A')
    expect(updated.tests.find(t => t.id === 'LT-B')?.realId).toBe('REAL-TEST-B')
  })

  it('skips stamping and warns when the positional assumption is violated (type/code mismatch at an index)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const order = baseOrder({
      tests: [
        { id: 'LT-A', orderId: 'LO-TEST-1', code: 'CBC', name: 'CBC', bench: 'HEMA', priority: 'Routine', status: 'awaiting_collection', expectedTATmin: 60, orderedAt: new Date().toISOString(), analytes: [] },
      ],
    })
    useLabOrdersStore.setState({ orders: [order], reflexSuggestions: [] })

    // Simulates a caller whose real.tests ordering diverged from the local
    // tests ordering — the index-0 code doesn't match, so the guard must
    // refuse to stamp a realId rather than silently linking the wrong test.
    useLabOrdersStore.getState().setRealIds('LO-TEST-1', {
      orderId: 'ORD-REAL-1',
      specimens: [],
      tests: [{ code: 'LFT', realId: 'REAL-TEST-WRONG' }],
    })

    const updated = useLabOrdersStore.getState().orders.find(o => o.id === 'LO-TEST-1')!
    expect(updated.tests.find(t => t.id === 'LT-A')?.realId).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('code mismatch')
  })
})
