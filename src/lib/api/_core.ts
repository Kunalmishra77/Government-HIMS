/* Agentix HIMS — Mock API / Repository Boundary · Phase 1
 *
 * One typed, async, zod-validated layer between the UI/Zustand stores and the
 * real REST API that will replace it in Phase 2. Browser-persisted via
 * localStorage today (swap to IndexedDB later by replacing this file only).
 *
 * Convention:
 *   - All domain modules import `table<T>(name, schema)` from this file.
 *   - All mutations route through `audit.emit(...)` so we have one place to
 *     enforce the NABH evidence chain.
 *   - Public shapes (zod) mirror 02_TRD §5 endpoint contracts so the Phase-2
 *     swap is a transport change, not an API change.
 */

import { z } from 'zod'
import { getSupabaseClient } from '@/lib/supabase/client'

const isBrowser = typeof window !== 'undefined'

// ─────────────────────────────────────────────────────────────────────────
// localStorage primitives — retained solely for bootstrap/seed bookkeeping
// (isBootstrapped/markBootstrapped/getBootstrapState/resetAll below, plus
// _seed.ts's dynamic `wipeAll` import). Domain data no longer lives here —
// see the Table section, which is Supabase-backed — but `_seed.ts` still
// references `wipeAll` (confirmed via grep), so it can't be deleted in this
// task without also touching `_seed.ts`, which is out of scope here.
// ─────────────────────────────────────────────────────────────────────────

const NS = 'agentix.api.v1'

function readRaw(key: string): unknown {
  if (!isBrowser) return undefined
  try {
    const raw = window.localStorage.getItem(`${NS}.${key}`)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function writeRaw(key: string, value: unknown): void {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(`${NS}.${key}`, JSON.stringify(value))
  } catch (err) {
    console.error('[api] storage write failed:', key, err)
  }
}

function removeRaw(key: string): void {
  if (!isBrowser) return
  try {
    window.localStorage.removeItem(`${NS}.${key}`)
  } catch { /* ignore */ }
}

export function listTableKeys(): string[] {
  if (!isBrowser) return []
  const out: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k?.startsWith(`${NS}.`)) out.push(k.slice(NS.length + 1))
  }
  return out
}

export function wipeAll(): void {
  if (!isBrowser) return
  for (const k of listTableKeys()) removeRaw(k)
}

// ─────────────────────────────────────────────────────────────────────────
// camelCase (zod schemas, every existing consumer) <-> snake_case (Postgres)
// ─────────────────────────────────────────────────────────────────────────

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function rowToSnake(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[toSnakeCase(k)] = v
  return out
}

function rowToCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  // Postgres returns `null` for unset nullable columns, but every zod schema in
  // src/lib/api uses `.optional()` (expects `undefined`, not `null`) rather than
  // `.nullable()` — without this, schema.parse() throws for any row with an unset
  // optional field (e.g. a patient with no bloodGroup/dob/insurerName).
  for (const [k, v] of Object.entries(row)) out[toCamelCase(k)] = v === null ? undefined : v
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Table: typed CRUD, Supabase-backed for tables that have been migrated to
// Postgres, transparently falling back to the original localStorage-backed
// behavior for every other table name.
//
// Only 4 tables (profiles, patients, visits, appointments) exist in Postgres
// as of this phase; every other domain module (staff, drugs, orders, lab,
// bills, ...) still calls this same `table()` for a name that has no
// migration yet. Rather than hardcode which names are "live" (a list that
// would need editing every time a new table is migrated), each method tries
// Supabase first and detects "table not found" via PostgREST's error code
// `PGRST205`, falling back to localStorage for that call only. Once a
// table's migration lands, its calls simply stop 404ing and "graduate" to
// Supabase with zero changes here. Any other Supabase error (RLS denial,
// network failure, etc.) still throws immediately — it is only the
// table-not-found case that is treated as "not migrated yet".
//
// None of the 4 live tables has a DELETE RLS policy for any role (by design
// — see Patients.softDelete's DISHA right-to-forget pattern), so `remove()`
// and the delete step inside `replaceAll()` always affect 0 rows against
// Supabase (no error, `count`/rows just come back empty) rather than
// throwing. Callers should not be surprised that `remove()` on a migrated
// table always resolves `false`.
// ─────────────────────────────────────────────────────────────────────────

function isTableNotFound(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

export interface Table<T extends { id: string }> {
  name: string
  list: (filter?: (row: T) => boolean) => Promise<T[]>
  get: (id: string) => Promise<T | undefined>
  put: (row: T) => Promise<T>
  putMany: (rows: T[]) => Promise<T[]>
  /**
   * Insert-only (no ON CONFLICT DO UPDATE), for domain modules whose
   * `create()` always writes a brand-new row and never intends to overwrite
   * an existing one. `put()`'s upsert issues an `ON CONFLICT DO UPDATE SET`
   * targeting every column of the row, which requires UPDATE privilege on
   * all of them at plan time — even when the row is genuinely new and the
   * conflict branch never fires. That defeats column-scoped UPDATE grants
   * (see supabase/migrations/20260704125515_nurse_visits_column_grant.sql)
   * for any table using `put()` for creation. `insert()` only ever needs
   * INSERT privilege, so it stays compatible with a narrowed UPDATE grant.
   */
  insert: (row: T) => Promise<T>
  patch: (id: string, partial: Partial<T>) => Promise<T | undefined>
  remove: (id: string) => Promise<boolean>
  count: () => Promise<number>
  replaceAll: (rows: T[]) => Promise<T[]>
}

export function table<T extends { id: string }>(name: string, schema: z.ZodType<T>): Table<T> {
  const client = () => getSupabaseClient()

  // ── localStorage fallback (pre-Supabase behavior, restored per-call) ──
  const loadLocal = (): T[] => {
    const raw = readRaw(name)
    if (!Array.isArray(raw)) return []
    const out: T[] = []
    for (const r of raw) {
      const parsed = schema.safeParse(r)
      if (parsed.success) out.push(parsed.data)
      else console.warn(`[api/${name}] skipping invalid row`, parsed.error.message)
    }
    return out
  }
  const saveLocal = (rows: T[]) => writeRaw(name, rows)

  const local = {
    async list(filter?: (row: T) => boolean) {
      const rows = loadLocal()
      return filter ? rows.filter(filter) : rows
    },
    async get(id: string) {
      return loadLocal().find((r) => r.id === id)
    },
    async put(row: T) {
      const validated = schema.parse(row)
      const rows = loadLocal()
      const idx = rows.findIndex((r) => r.id === validated.id)
      if (idx >= 0) rows[idx] = validated
      else rows.unshift(validated)
      saveLocal(rows)
      return validated
    },
    async putMany(rows: T[]) {
      const validated = rows.map((r) => schema.parse(r))
      const all = loadLocal()
      for (const v of validated) {
        const idx = all.findIndex((r) => r.id === v.id)
        if (idx >= 0) all[idx] = v
        else all.unshift(v)
      }
      saveLocal(all)
      return validated
    },
    async patch(id: string, partial: Partial<T>) {
      const rows = loadLocal()
      const idx = rows.findIndex((r) => r.id === id)
      if (idx < 0) return undefined
      const merged = schema.parse({ ...rows[idx], ...partial })
      rows[idx] = merged
      saveLocal(rows)
      return merged
    },
    async remove(id: string) {
      const rows = loadLocal()
      const next = rows.filter((r) => r.id !== id)
      if (next.length === rows.length) return false
      saveLocal(next)
      return true
    },
    async count() {
      return loadLocal().length
    },
    async replaceAll(rows: T[]) {
      const validated = rows.map((r) => schema.parse(r))
      saveLocal(validated)
      return validated
    },
  }

  return {
    name,
    async list(filter) {
      const { data, error } = await client().from(name).select('*')
      if (error) {
        if (isTableNotFound(error)) return local.list(filter)
        throw new Error(`[api/${name}] list failed: ${error.message}`)
      }
      const rows = (data ?? []).map((r) => schema.parse(rowToCamel(r)))
      return filter ? rows.filter(filter) : rows
    },
    async get(id) {
      const { data, error } = await client().from(name).select('*').eq('id', id).maybeSingle()
      if (error) {
        if (isTableNotFound(error)) return local.get(id)
        throw new Error(`[api/${name}] get failed: ${error.message}`)
      }
      return data ? schema.parse(rowToCamel(data)) : undefined
    },
    async put(row) {
      const validated = schema.parse(row)
      const { data, error } = await client().from(name).upsert(rowToSnake(validated)).select().single()
      if (error) {
        if (isTableNotFound(error)) return local.put(row)
        throw new Error(`[api/${name}] put failed: ${error.message}`)
      }
      return schema.parse(rowToCamel(data))
    },
    async putMany(rows) {
      const validated = rows.map((r) => schema.parse(r))
      const { data, error } = await client().from(name).upsert(validated.map(rowToSnake)).select()
      if (error) {
        if (isTableNotFound(error)) return local.putMany(rows)
        throw new Error(`[api/${name}] putMany failed: ${error.message}`)
      }
      return (data ?? []).map((r) => schema.parse(rowToCamel(r)))
    },
    async insert(row) {
      const validated = schema.parse(row)
      const { data, error } = await client().from(name).insert(rowToSnake(validated)).select().single()
      if (error) {
        if (isTableNotFound(error)) return local.put(row)
        throw new Error(`[api/${name}] insert failed: ${error.message}`)
      }
      return schema.parse(rowToCamel(data))
    },
    async patch(id, partial) {
      const { data, error } = await client().from(name).update(rowToSnake(partial)).eq('id', id).select().maybeSingle()
      if (error) {
        if (isTableNotFound(error)) return local.patch(id, partial)
        throw new Error(`[api/${name}] patch failed: ${error.message}`)
      }
      return data ? schema.parse(rowToCamel(data)) : undefined
    },
    async remove(id) {
      const { error, count } = await client().from(name).delete({ count: 'exact' }).eq('id', id)
      if (error) {
        if (isTableNotFound(error)) return local.remove(id)
        throw new Error(`[api/${name}] remove failed: ${error.message}`)
      }
      return (count ?? 0) > 0
    },
    async count() {
      // Not `head: true`: PostgREST/Supabase's HEAD responses carry no body, so a
      // missing table can't surface a PGRST205 error code on a head-only request —
      // it comes back as an empty 204 "success" instead, defeating fallback
      // detection (confirmed by probing the live project). A normal (non-head)
      // count request still gets us `count` without needing the row bodies, and
      // correctly errors with PGRST205 when the table doesn't exist.
      const { count, error } = await client().from(name).select('id', { count: 'exact' })
      if (error) {
        if (isTableNotFound(error)) return local.count()
        throw new Error(`[api/${name}] count failed: ${error.message}`)
      }
      return count ?? 0
    },
    async replaceAll(rows) {
      const validated = rows.map((r) => schema.parse(r))
      const { error: delError } = await client().from(name).delete().neq('id', '')
      if (delError) {
        if (isTableNotFound(delError)) return local.replaceAll(rows)
        throw new Error(`[api/${name}] replaceAll delete failed: ${delError.message}`)
      }
      const { data, error } = await client().from(name).upsert(validated.map(rowToSnake)).select()
      if (error) {
        if (isTableNotFound(error)) return local.replaceAll(rows)
        throw new Error(`[api/${name}] replaceAll failed: ${error.message}`)
      }
      return (data ?? []).map((r) => schema.parse(rowToCamel(r)))
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────
// IDs + common schemas
// ─────────────────────────────────────────────────────────────────────────

let _seq = 0
export function id(prefix = 'ID'): string {
  _seq++
  // Deliberately NOT gated on `isBrowser` (unlike isoNow(), which pins a fixed
  // placeholder for SSR/hydration determinism) — an ID must be genuinely
  // unique in every environment that generates one, including Node/server
  // contexts and, notably, this test suite (environment: 'node'), which
  // exercises `newId()` against a real, shared Supabase database across
  // multiple test files/module instances (each with its own `_seq` starting
  // at 0). A fixed 't'/'seed' pair here made every module's first generated
  // id identical (e.g. 'VIS-t-seed-1'), which is invisible in a single file
  // but collides (duplicate key) the moment two files race to create a row
  // via the same table's auto-id path — found while adding
  // usePatientStore.updateStatus.test.ts alongside the existing
  // usePatientStore.addPatient.test.ts, both of which call the real
  // Visits.create() without an explicit id.
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${t}-${r}-${_seq}`
}

export const isoNow = (): string =>
  isBrowser ? new Date().toISOString() : '2026-06-01T00:00:00.000Z'

export const tenantId = 'tenant.main'

export const TimestampSchema = z.string()  // ISO 8601
export const TenantSchema = z.string()

// ─────────────────────────────────────────────────────────────────────────
// Audit emission — the single fan-in for evidence
// ─────────────────────────────────────────────────────────────────────────

export interface AuditEmit {
  action: string
  resource: string
  resourceId?: string
  userId?: string
  userName?: string
  detail?: string
  before?: unknown
  after?: unknown
}

type AuditBridge = (e: AuditEmit) => void
let auditBridge: AuditBridge | undefined

/** Register the bridge to useAuditStore (called from the audit-store side once mounted). */
export function registerAuditBridge(fn: AuditBridge): void {
  auditBridge = fn
}

export const audit = {
  emit(e: AuditEmit): void {
    if (!auditBridge) return
    try {
      auditBridge(e)
    } catch (err) {
      console.error('[api/audit] bridge failed:', err)
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────
// Bootstrap + reset
// ─────────────────────────────────────────────────────────────────────────

const BOOT_KEY = '__bootstrap__'
const SCHEMA_VERSION = 2

interface BootstrapState {
  schemaVersion: number
  seededAt: string
  seedName: string
}

export async function isBootstrapped(): Promise<boolean> {
  const s = readRaw(BOOT_KEY) as BootstrapState | undefined
  return Boolean(s && s.schemaVersion === SCHEMA_VERSION)
}

export async function markBootstrapped(seedName: string): Promise<void> {
  const state: BootstrapState = {
    schemaVersion: SCHEMA_VERSION,
    seededAt: isoNow(),
    seedName,
  }
  writeRaw(BOOT_KEY, state)
}

export async function getBootstrapState(): Promise<BootstrapState | undefined> {
  return readRaw(BOOT_KEY) as BootstrapState | undefined
}

export async function resetAll(seedName = 'manual-reset'): Promise<void> {
  wipeAll()
  await markBootstrapped(seedName)
}
