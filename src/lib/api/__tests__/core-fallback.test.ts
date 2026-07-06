import { beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { table as TableFn } from '@/lib/api/_core'

// `_core.ts` computes `const isBrowser = typeof window !== 'undefined'` once,
// at module load time — so the localStorage shim below must exist on
// `globalThis` *before* `_core.ts` is first imported by this process, or the
// fallback path will silently no-op (readRaw/writeRaw both early-return when
// `!isBrowser`). vitest.config.ts uses `environment: 'node'` (Task 1) and no
// jsdom/happy-dom dependency is installed in this project, so rather than add
// a new devDependency for a single test file, this suite defines a minimal
// in-memory `window.localStorage` shim directly and dynamically imports
// `_core.ts` in `beforeAll`, after the shim is in place. This keeps the test
// a plain unit test with no real browser and no new dependency, while still
// exercising the exact `readRaw`/`writeRaw` code path the fallback relies on.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  get length(): number {
    return this.store.size
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
}

;(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: new MemoryStorage(),
}

let table: typeof TableFn

beforeAll(async () => {
  ;({ table } = await import('@/lib/api/_core'))
}, 30000)

const TestRowSchema = z.object({
  id: z.string(),
  label: z.string(),
})
type TestRow = z.infer<typeof TestRowSchema>

describe('table() falls back to localStorage for a non-migrated table', () => {
  it('put/get/list/remove all succeed via the localStorage fallback when Supabase reports PGRST205 (table not found)', async () => {
    const rows = table<TestRow>('nonexistent_test_table', TestRowSchema)

    const saved = await rows.put({ id: 'ROW-1', label: 'Hello' })
    expect(saved).toEqual({ id: 'ROW-1', label: 'Hello' })

    const fetched = await rows.get('ROW-1')
    expect(fetched?.label).toBe('Hello')

    const list = await rows.list()
    expect(list.some((r) => r.id === 'ROW-1')).toBe(true)

    const filtered = await rows.list((r) => r.label === 'Hello')
    expect(filtered.some((r) => r.id === 'ROW-1')).toBe(true)

    expect(await rows.count()).toBe(1)

    const patched = await rows.patch('ROW-1', { label: 'Updated' })
    expect(patched?.label).toBe('Updated')

    const removed = await rows.remove('ROW-1')
    expect(removed).toBe(true)
    expect(await rows.get('ROW-1')).toBeUndefined()
    expect(await rows.remove('ROW-1')).toBe(false)
  })

  it('replaceAll()/putMany() also round-trip through localStorage', async () => {
    const rows = table<TestRow>('nonexistent_test_table', TestRowSchema)

    await rows.replaceAll([
      { id: 'ROW-A', label: 'A' },
      { id: 'ROW-B', label: 'B' },
    ])
    expect(await rows.count()).toBe(2)

    await rows.putMany([{ id: 'ROW-C', label: 'C' }])
    const list = await rows.list()
    expect(list.map((r) => r.id).sort()).toEqual(['ROW-A', 'ROW-B', 'ROW-C'])
  })
})
