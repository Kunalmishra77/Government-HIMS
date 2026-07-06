/*
 * Test-only. Must be the first import of `with-route-handler-context.ts`
 * (ESM evaluates a module's own imports, top to bottom, before running any
 * of its top-level code — so this has to live in its own module with no
 * other imports, imported first, or the polyfill runs too late). Next's
 * internal AsyncLocalStorage wrapper (`next/dist/server/app-render/async-local-storage.js`)
 * reads `globalThis.AsyncLocalStorage` once, at module-evaluation time, and
 * falls back to a `FakeAsyncLocalStorage` that always throws if it isn't
 * set yet.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

if (!('AsyncLocalStorage' in globalThis)) {
  Object.assign(globalThis, { AsyncLocalStorage })
}
