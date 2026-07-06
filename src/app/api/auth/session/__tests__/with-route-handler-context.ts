/*
 * Test-only helper. `next/headers`'s `cookies()` (used inside
 * `getSupabaseServerClient()`, src/lib/supabase/server.ts) only works inside
 * Next's App Router request-scoped AsyncLocalStorage context (a "request"
 * work-unit store). That context is normally established by Next's own
 * route-handler runtime (`AppRouteRouteModule`) before it calls the
 * exported POST/DELETE functions — and that same runtime is also what
 * merges any cookies set via `cookies().set(...)` into the outgoing
 * response's `Set-Cookie` header (see `AppRouteRouteModule.do()` in
 * `next/dist/server/route-modules/app-route/module.js`): a route handler
 * that calls `cookies().set()` does NOT touch `Response.headers` itself,
 * the merge is done by that wrapper afterwards.
 *
 * This test calls `POST`/`DELETE` directly (no HTTP transport, per the
 * brief) which bypasses that wrapper entirely. Without reproducing it,
 * `cookies()` throws "called outside a request scope", and even if it
 * didn't, no Set-Cookie header would ever appear on the returned Response.
 * `callRouteHandler` reconstructs the same context and performs the same
 * merge step, using Next's own internal factories, so the exercised
 * behavior (including the Set-Cookie header) is genuine, not simulated.
 */
import './async-local-storage-polyfill'
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external'
import { createWorkStore, type WorkStoreContext } from 'next/dist/server/async-storage/work-store'
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store'
import { getImplicitTags } from 'next/dist/server/lib/implicit-tags'
import { appendMutableCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import type { NextRequest } from 'next/server'

export async function callRouteHandler(request: Request, handler: () => Promise<Response>): Promise<Response> {
  const url = new URL(request.url)
  const page = url.pathname
  const implicitTags = await getImplicitTags(page, url.pathname, null)
  const requestStore = createRequestStoreForAPI(
    request as unknown as NextRequest,
    url,
    implicitTags,
    undefined,
    undefined
  )
  const workStore = createWorkStore({
    page,
    renderOpts: {} as unknown as WorkStoreContext['renderOpts'],
    buildId: 'test',
    previouslyRevalidatedTags: [],
  })

  const res = await workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, handler))

  const headers = new Headers(res.headers)
  if (appendMutableCookies(headers, requestStore.mutableCookies)) {
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
  return res
}
