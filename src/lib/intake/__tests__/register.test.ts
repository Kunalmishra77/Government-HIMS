import { describe, expect, it, vi } from 'vitest'
import { generateUhid, writeWithUhidRetry } from '@/lib/intake/register'
import type { Patient } from '@/store/usePatientStore'

// writeWithUhidRetry is the concurrency-safety mechanism for real UHID writes
// (see the ADR comment above it in register.ts): generateUhid()'s per-year
// sequence is computed from a local patient cache that isn't guaranteed
// fresh/complete across concurrent reception terminals, so the real
// `patients.uhid` partial unique index is the actual source of truth —
// a collision there is treated as a retry signal. These are pure unit tests
// against a fake `write` function (no live DB needed); the live-DB proof that
// the unique index itself rejects a real duplicate write lives in
// src/lib/api/__tests__/patients.test.ts.

function collisionError(): Error {
  return new Error('duplicate key value violates unique constraint "patients_uhid_unique_idx"')
}

describe('generateUhid', () => {
  it('produces PUH-<year>-<5-digit sequence>, continuing from the highest existing UHID this year', () => {
    const year = new Date().getFullYear()
    const patients = [
      { uhid: `PUH-${year}-00007` } as Patient,
      { uhid: `PUH-${year}-00003` } as Patient,
      { uhid: `PUH-${year - 1}-00099` } as Patient, // different year — ignored
    ]
    expect(generateUhid(patients)).toBe(`PUH-${year}-00008`)
  })

  it('falls back to a timestamp-derived sequence when no UHID exists yet this year', () => {
    const year = new Date().getFullYear()
    const uhid = generateUhid([])
    expect(uhid).toMatch(new RegExp(`^PUH-${year}-\\d{5}$`))
  })
})

describe('writeWithUhidRetry', () => {
  it('writes undefined straight through once when no UHID is being issued (no collision is possible)', async () => {
    const write = vi.fn().mockResolvedValue('ok')
    const { uhid, result } = await writeWithUhidRetry([], undefined, write)
    expect(uhid).toBeUndefined()
    expect(result).toBe('ok')
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(undefined)
  })

  it('succeeds on the first attempt when there is no collision', async () => {
    const write = vi.fn().mockResolvedValue('ok')
    const { uhid, result } = await writeWithUhidRetry([], 'PUH-2026-00001', write)
    expect(uhid).toBe('PUH-2026-00001')
    expect(result).toBe('ok')
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('retries with a freshly bumped candidate after a unique-index collision, and succeeds', async () => {
    const write = vi.fn()
      .mockRejectedValueOnce(collisionError())
      .mockResolvedValueOnce('ok')
    const { uhid, result } = await writeWithUhidRetry([], 'PUH-2026-00001', write)
    expect(result).toBe('ok')
    expect(uhid).toBe('PUH-2026-00002') // bumped past the failed candidate
    expect(write).toHaveBeenCalledTimes(2)
    expect(write).toHaveBeenNthCalledWith(1, 'PUH-2026-00001')
    expect(write).toHaveBeenNthCalledWith(2, 'PUH-2026-00002')
  })

  it('does not retry a non-collision error — propagates it immediately', async () => {
    const rlsError = new Error('new row violates row-level security policy for table "patients"')
    const write = vi.fn().mockRejectedValue(rlsError)
    await expect(writeWithUhidRetry([], 'PUH-2026-00001', write)).rejects.toThrow(rlsError)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('gives up and throws after repeated collisions, without ever reporting a false success', async () => {
    const write = vi.fn().mockRejectedValue(collisionError())
    await expect(writeWithUhidRetry([], 'PUH-2026-00001', write)).rejects.toThrow(/unique constraint/)
    // Bounded retry — 5 attempts (MAX_UHID_ATTEMPTS), never an unbounded loop.
    expect(write).toHaveBeenCalledTimes(5)
  })
})
