# Phase 2 — Real Login, Reception Registration, Nurse Vitals: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one complete, real patient journey work end-to-end against Postgres: a staff member logs in for real, reception registers a walk-in patient (creating a real `patients`/`visits` row), and a nurse records vitals against that real visit (creating a real `vitals_readings` row and advancing `visits.status`).

**Architecture:** Builds directly on Phase 1 (`docs/superpowers/plans/2026-07-03-backend-foundation-schema-auth.md`, done). Real Supabase Auth session, bridged from the browser client to server-readable cookies via a small Route Handler + middleware (not by changing the existing `getSupabaseClient()` singleton, which 29 existing tests depend on running safely under Node). Reception/Nurse UI changes are additive: the existing Zustand/localStorage behavior stays intact for backward compatibility with demo-seeded data, and a real backend write is added alongside it, keyed by a new `visitId` field on the local `Patient` record.

**Tech Stack:** Next.js 16.2.4 App Router, `@supabase/ssr` (already installed), `@supabase/supabase-js` (already installed), existing `src/lib/api/*` repository layer, Vitest.

## Global Constraints

- Do not modify `src/lib/supabase/client.ts`'s use of plain `createClient` — 29 existing tests (Phase 1) rely on it working under Node without a `document`/`window`. Session bridging to cookies happens via a separate Route Handler, not by changing this file.
- Every new Postgres table gets RLS enabled with explicit policies — no table ships without them (same rule as Phase 1).
- Zod schemas in `src/lib/api/*` stay camelCase; Postgres columns stay snake_case (via the existing `_core.ts` mapping layer — no changes needed there, it already handles any table).
- Tests run against the real, live Supabase project; every test that creates rows/users must clean up (same as Phase 1).
- Existing Zustand stores (`usePatientStore`, `useAuthStore`) keep their current local behavior working for demo-seeded data — this phase adds real backend calls alongside, it does not remove or replace the local state model wholesale.
- Credentials already live in `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
- Use the PowerShell tool for all commands (`npm`, `npx`, `git`) — this environment's Bash tool lacks most POSIX coreutils and has caused hangs in the past.
- Do not commit anything until the user says to — stage changes with `git add`, never `git commit`, unless explicitly told otherwise.

---

### Task 1: `vitals_readings` table + RLS migration

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_vitals_readings.sql` (use `npx --yes supabase migration new vitals_readings` to get a correctly timestamped filename, then edit its contents)
- Test: `src/lib/supabase/__tests__/vitals-readings-schema.test.ts`

**Interfaces:**
- Consumes: nothing new (uses `visits`, `profiles` from Phase 1).
- Produces: a `vitals_readings` table with columns `id text primary key`, `visit_id text references visits(id)`, `recorded_by uuid references profiles(id)`, `recorded_at timestamptz`, `payload jsonb` — Task 2 builds the repository module on top of this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/supabase/__tests__/vitals-readings-schema.test.ts`:

```ts
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

describe('vitals_readings schema', () => {
  it('exists with the expected columns', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    try {
      const res = await client.query(
        `select column_name from information_schema.columns where table_name = 'vitals_readings' order by column_name`
      )
      const columns = res.rows.map((r) => r.column_name).sort()
      expect(columns).toEqual(['id', 'payload', 'recorded_at', 'recorded_by', 'visit_id'].sort())
    } finally {
      await client.end()
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- vitals-readings-schema.test.ts`
Expected: FAIL — `columns` is `[]` (empty array), not the expected 5 columns.

- [ ] **Step 3: Create the migration**

Run (PowerShell):
```powershell
npx --yes supabase migration new vitals_readings
```
This creates an empty file at `supabase/migrations/<TIMESTAMP>_vitals_readings.sql`. Replace its contents with:

```sql
create table vitals_readings (
  id           text primary key,              -- 'VR-...'
  visit_id     text not null references visits(id),
  recorded_by  uuid not null references profiles(id),
  recorded_at  timestamptz not null default now(),
  payload      jsonb not null
);
create index vitals_readings_visit_idx on vitals_readings(visit_id, recorded_at desc);

alter table vitals_readings enable row level security;

-- Staff (nurse/doctor/reception/admin) can see every vitals reading.
create policy vitals_readings_select_staff on vitals_readings for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse','doctor','reception','admin'))
  );

-- A patient can see vitals recorded against their own visits.
create policy vitals_readings_select_self on vitals_readings for select
  using (
    exists (
      select 1 from visits v
      join patients pt on pt.id = v.patient_id
      where v.id = vitals_readings.visit_id and pt.auth_user_id = auth.uid()
    )
  );

-- Only nurse/doctor/admin can record a vitals reading.
create policy vitals_readings_insert_staff on vitals_readings for insert
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('nurse','doctor','admin'))
  );
```

- [ ] **Step 4: Apply the migration**

Run (PowerShell — set `$env:DATABASE_URL` from `.env.local`'s value first):
```powershell
npx --yes supabase db push --db-url $env:DATABASE_URL --include-all --yes
```
Expected: reports the new migration applied successfully.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- vitals-readings-schema.test.ts`
Expected: `1 passed`.

- [ ] **Step 6: Stage (do not commit)**

```powershell
git add supabase/migrations/ src/lib/supabase/__tests__/vitals-readings-schema.test.ts
```

---

### Task 2: `VitalsReadings` repository module

**Files:**
- Create: `src/lib/api/vitals-readings.ts`
- Modify: `src/lib/api/index.ts` (export it — one line, alphabetically after `StaffApi`)
- Test: `src/lib/api/__tests__/vitals-readings.test.ts`

**Interfaces:**
- Consumes: `table`, `id`, `isoNow` from `_core.ts` (Phase 1); the `vitals_readings` table (Task 1); `Visits`/`Patients` from Phase 1 for test fixtures.
- Produces: `VitalsReadings.{byVisit, create}`, `VitalsReadingSchema`, `VitalsReading` type. Task 9 (Nurse wiring) calls `VitalsReadings.create(...)`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/__tests__/vitals-readings.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { VitalsReadings } from '@/lib/api/vitals-readings'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-VITALSTEST-1'
const testVisitId = 'VIS-VITALSTEST-1'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'vitals-test-nurse@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  const { error: profileError } = await admin.from('profiles').insert({
    id: staffUserId, role: 'nurse', full_name: 'Vitals Test Nurse',
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

  await Patients.create({ id: testPatientId, hn: 'HN-VITALSTEST-1', fullName: 'Vitals Test', phone: '9111111111', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'vitals' } as Parameters<typeof Visits.create>[0])
})

afterAll(async () => {
  await admin.from('vitals_readings').delete().eq('visit_id', testVisitId)
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
})

describe('VitalsReadings repository', () => {
  it('records a vitals reading for a visit', async () => {
    const saved = await VitalsReadings.create({
      visitId: testVisitId, recordedBy: staffUserId, payload: { hr: 78, systolicBP: 120, diastolicBP: 80 },
    })
    expect(saved.visitId).toBe(testVisitId)
    expect(saved.payload.hr).toBe(78)
  })

  it('byVisit() returns the reading', async () => {
    await VitalsReadings.create({
      visitId: testVisitId, recordedBy: staffUserId, payload: { hr: 80 },
    })
    const rows = await VitalsReadings.byVisit(testVisitId)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.visitId === testVisitId)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- vitals-readings.test.ts`
Expected: FAIL with `Cannot find module '@/lib/api/vitals-readings'`.

- [ ] **Step 3: Implement `vitals-readings.ts`**

Create `src/lib/api/vitals-readings.ts`:

```ts
/* VitalsReadings — nurse/doctor-recorded bedside vitals, one row per reading.
 * `payload` holds whatever fields the recording form captured (hr, systolicBP,
 * diastolicBP, spo2, temp, ...) — kept as a free-form record rather than a
 * fixed schema here because the richer VitalsRecord shape (useInpatientStore.ts)
 * already owns that contract; this table just needs to store and retrieve it. */
import { z } from 'zod'
import { id as newId, isoNow, table } from './_core'

export const VitalsReadingSchema = z.object({
  id: z.string(),                 // 'VR-...'
  visitId: z.string(),
  recordedBy: z.string().uuid(),
  recordedAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
})
export type VitalsReading = z.infer<typeof VitalsReadingSchema>

const vitalsReadings = table<VitalsReading>('vitals_readings', VitalsReadingSchema)

export const VitalsReadings = {
  byVisit: (visitId: string) => vitalsReadings.list((v) => v.visitId === visitId),
  async create(input: { visitId: string; recordedBy: string; payload: Record<string, unknown> }) {
    const row: VitalsReading = {
      id: newId('VR'),
      visitId: input.visitId,
      recordedBy: input.recordedBy,
      recordedAt: isoNow(),
      payload: input.payload,
    }
    return vitalsReadings.put(row)
  },
  _table: vitalsReadings,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- vitals-readings.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Export from the public API surface**

Modify `src/lib/api/index.ts` — add one line, alphabetically after the `StaffApi` export:

```ts
export { VitalsReadings, VitalsReadingSchema } from './vitals-readings'
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: every test file passes (29 existing + 2 new schema/repo tests here = 31... plus Task 1's schema test = 32 total once both tasks land).

- [ ] **Step 7: Stage (do not commit)**

```powershell
git add src/lib/api/vitals-readings.ts src/lib/api/index.ts src/lib/api/__tests__/vitals-readings.test.ts
```

---

### Task 3: Session-sync Route Handlers (bridge browser sign-in to server-readable cookies)

**Files:**
- Create: `src/app/api/auth/session/route.ts`
- Test: `src/app/api/auth/session/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getSupabaseServerClient` (Phase 1, `src/lib/supabase/server.ts`).
- Produces: `POST /api/auth/session` — accepts `{access_token, refresh_token}`, calls `.auth.setSession(...)` on a cookie-aware server client so the session is persisted into cookies the middleware (Task 4) and Server Components can read. `DELETE /api/auth/session` — clears the server-side session (signs out on the cookie-aware client). Task 5 (login page) calls `POST`; Task 6 (`useAuthStore.logout`) calls `DELETE`.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/auth/session/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { POST, DELETE } from '@/app/api/auth/session/route'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const staffEmail = 'session-route-test@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string | undefined

afterEach(async () => {
  if (staffUserId) {
    await admin.from('profiles').delete().eq('id', staffUserId)
    await admin.auth.admin.deleteUser(staffUserId)
    staffUserId = undefined
  }
})

function jsonRequest(method: string, body: unknown): Request {
  return new Request('http://localhost/api/auth/session', {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/auth/session', () => {
  it('sets a server-side session from a valid access/refresh token pair and returns a Set-Cookie header', async () => {
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: staffEmail, password: staffPassword, email_confirm: true,
    })
    if (userError || !userData.user) throw new Error(`createUser failed: ${userError?.message}`)
    staffUserId = userData.user.id
    await admin.from('profiles').insert({ id: staffUserId, role: 'reception', full_name: 'Session Route Test' })

    // Sign in with a throwaway client to get real tokens (not the shared getSupabaseClient()
    // singleton — this simulates what the browser's own sign-in call produces).
    const anon = createClient(url, anonKey)
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
      email: staffEmail, password: staffPassword,
    })
    if (signInError || !signInData.session) throw new Error(`signIn failed: ${signInError?.message}`)

    const res = await POST(jsonRequest('POST', {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    }))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeTruthy()
  })

  it('returns 400 for a missing token', async () => {
    const res = await POST(jsonRequest('POST', { access_token: '' }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/auth/session', () => {
  it('clears the session and returns 200', async () => {
    const res = await DELETE()
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- route.test.ts`
Expected: FAIL with `Cannot find module '@/app/api/auth/session/route'`.

- [ ] **Step 3: Implement the Route Handler**

Create `src/app/api/auth/session/route.ts`:

```ts
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const accessToken = body?.access_token
  const refreshToken = body?.refresh_token
  if (typeof accessToken !== 'string' || !accessToken || typeof refreshToken !== 'string' || !refreshToken) {
    return Response.json({ error: 'access_token and refresh_token are required' }, { status: 400 })
  }

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (error) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  // setSession triggers the server client's cookie `setAll` handler (src/lib/supabase/server.ts),
  // which writes the session into the response's Set-Cookie headers automatically.
  return Response.json({ ok: true })
}

export async function DELETE(): Promise<Response> {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- route.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: every test file passes, 0 failures.

- [ ] **Step 6: Stage (do not commit)**

```powershell
git add src/app/api/auth/session/
```

---

### Task 4: Session-refresh middleware

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `@supabase/ssr`'s `createServerClient`, `NextRequest`/`NextResponse` from `next/server`.
- Produces: on every request, refreshes the Supabase session cookie if needed (standard Supabase Next.js SSR pattern) so a signed-in session set by Task 3's route stays valid across page navigations. No exported functions other than Next.js's required `middleware` + `config`.

- [ ] **Step 1: Implement the middleware**

Create `src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
      },
    },
  })

  // Touching getUser() is what actually triggers a token refresh + re-sets the
  // cookie via setAll above, if the access token is close to expiry.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: Verify the app still boots**

Run (PowerShell): `npm run dev -- -p 3006` (background), then fetch it:
```powershell
$resp = Invoke-WebRequest -Uri "http://localhost:3006" -UseBasicParsing -TimeoutSec 120
```
Expected: `$resp.StatusCode` is `200` and the page title is "Umang HIMS" (confirms the middleware doesn't break routing for unauthenticated requests). Stop the dev server after checking (find its process via the port and stop it, or let it be — it's a dev-only process, not part of what gets staged).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: every test file passes, 0 failures (middleware doesn't run under Vitest, this just confirms nothing else broke).

- [ ] **Step 4: Stage (do not commit)**

```powershell
git add src/middleware.ts
```

---

### Task 5: `/login` page

**Files:**
- Create: `src/app/login/page.tsx`
- Test: `src/app/login/__tests__/page.test.tsx` — SKIP writing a component-render test for this task (this project has no React Testing Library / jsdom set up, and adding one is out of scope for this plan — see "What this plan deliberately does not do"). Instead, this task's verification is manual (Step 3 below) plus the full suite staying green.

**Interfaces:**
- Consumes: `getSupabaseClient` (Phase 1), `POST /api/auth/session` (Task 3).
- Produces: a page at `/login` that signs a user in and redirects them to `/{role}/dashboard` based on their real `profiles.role`. Task 6/7 reference this route.

- [ ] **Step 1: Implement the login page**

Create `src/app/login/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const ROLE_DASHBOARD: Record<string, string> = {
  doctor: "/doctor/dashboard",
  nurse: "/nurse/dashboard",
  pharmacy: "/pharmacy/dashboard",
  lab: "/lab/dashboard",
  radiology: "/radiology/dashboard",
  reception: "/reception/opd",
  admin: "/admin/dashboard",
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error || !data.session) {
        toast.error(error?.message ?? "Sign-in failed")
        return
      }

      // Bridge the browser session into server-readable cookies (Task 3) so
      // middleware (Task 4) and Server Components can see the signed-in user.
      const syncRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      })
      if (!syncRes.ok) {
        toast.error("Signed in, but couldn't sync the session — try again")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle()
      if (profileError || !profile) {
        toast.error("Signed in, but no staff profile found for this account")
        return
      }

      const dashboard = ROLE_DASHBOARD[profile.role as string] ?? "/"
      router.push(dashboard)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in — Umang HIMS</h1>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting || !email || !password} className="w-full">
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: every test file passes, 0 failures (this page has no automated test — see note above — this just confirms nothing else broke).

- [ ] **Step 3: Manual verification**

Start the dev server on a free port (e.g. `npm run dev -- -p 3006`) and, using the staff account created by Task 3's test as a reference for the pattern (or a fresh one created via `POST /api/admin/staff` from Phase 1), confirm: visiting `/login`, entering valid credentials, and submitting redirects to the correct `/{role}/dashboard` route. Report what you observed — if you cannot drive a real browser in this environment, create a throwaway staff account via `POST /api/admin/staff` and a small script that calls `signInWithPassword` + hits `/api/auth/session` directly to confirm the flow works end-to-end at the API level, and say so explicitly in your report.

- [ ] **Step 4: Stage (do not commit)**

```powershell
git add src/app/login/
```

---

### Task 6: `useAuthStore` reads the real session

**Files:**
- Modify: `src/store/useAuthStore.ts` (full current content below, for exact context — modify as shown)
- Test: `src/store/__tests__/useAuthStore.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient` (Phase 1), `DELETE /api/auth/session` (Task 3).
- Produces: `useAuthStore.hydrateFromSession()` (new action, call it once from a client component on mount — Task 7 wires this into `PortalLauncher`/a root layout), a real `logout()` that signs out of Supabase and clears the server-side cookie session. `currentUser`/`activeRole` are populated from the real session + `profiles` row once `hydrateFromSession()` resolves; `DEMO_USERS` and `setRole`/`setUser` remain as-is for any code that hasn't migrated to the real flow yet (existing demo pages still work).

**Current file** (`src/store/useAuthStore.ts`, reproduced in full so you can see exactly what you're modifying):

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Role } from '@/types/roles'

export type { Role }

export type User = {
  id: string
  name: string
  role: Role
  avatar?: string
  department?: string
  specialization?: string
}

interface AuthState {
  currentUser: User | null
  activeRole: Role
  setUser: (user: User) => void
  setRole: (role: Role) => void
  logout: () => void
}

const DEMO_USERS: Record<Role, User> = {
  // ... (unchanged, full demo user map — do not touch this block)
}

export const DEMO_USERS_MAP = DEMO_USERS

export const useAuthStore = create<AuthState>()(persist((set) => ({
  currentUser: DEMO_USERS.doctor,
  activeRole: 'doctor',
  setUser: (user) => set({ currentUser: user }),
  setRole: (role) => set({ activeRole: role, currentUser: DEMO_USERS[role] }),
  logout: () => set({ currentUser: null }),
}),
  {
    name: 'agentix-authstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
```

- [ ] **Step 1: Write the failing test**

Create `src/store/__tests__/useAuthStore.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { useAuthStore } from '@/store/useAuthStore'
import { getSupabaseClient } from '@/lib/supabase/client'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'authstore-test-doctor@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string

afterEach(async () => {
  await admin.from('profiles').delete().eq('id', staffUserId)
  await admin.auth.admin.deleteUser(staffUserId)
  await getSupabaseClient().auth.signOut()
})

describe('useAuthStore.hydrateFromSession', () => {
  it('populates currentUser/activeRole from the real session + profile row', async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: staffEmail, password: staffPassword, email_confirm: true,
    })
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
    staffUserId = data.user.id
    await admin.from('profiles').insert({
      id: staffUserId, role: 'doctor', full_name: 'AuthStore Test Doctor', department: 'Cardiology',
    })
    const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
      email: staffEmail, password: staffPassword,
    })
    if (signInError) throw new Error(`signIn failed: ${signInError.message}`)

    await useAuthStore.getState().hydrateFromSession()

    expect(useAuthStore.getState().currentUser?.id).toBe(staffUserId)
    expect(useAuthStore.getState().currentUser?.name).toBe('AuthStore Test Doctor')
    expect(useAuthStore.getState().activeRole).toBe('doctor')
  })

  it('leaves currentUser null when there is no session', async () => {
    await getSupabaseClient().auth.signOut()
    await useAuthStore.getState().hydrateFromSession()
    expect(useAuthStore.getState().currentUser).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- useAuthStore.test.ts`
Expected: FAIL with `useAuthStore.getState().hydrateFromSession is not a function`.

- [ ] **Step 3: Implement `hydrateFromSession` and a real `logout`**

Modify `src/store/useAuthStore.ts` — add the import, extend the interface, and change the store body:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Role } from '@/types/roles'
import { getSupabaseClient } from '@/lib/supabase/client'

export type { Role }

export type User = {
  id: string
  name: string
  role: Role
  avatar?: string
  department?: string
  specialization?: string
}

interface AuthState {
  currentUser: User | null
  activeRole: Role
  setUser: (user: User) => void
  setRole: (role: Role) => void
  logout: () => void
  hydrateFromSession: () => Promise<void>
}

const DEMO_USERS: Record<Role, User> = {
  // ... (unchanged — keep the existing full demo user map exactly as-is)
}

export const DEMO_USERS_MAP = DEMO_USERS

export const useAuthStore = create<AuthState>()(persist((set) => ({
  currentUser: DEMO_USERS.doctor,
  activeRole: 'doctor',
  setUser: (user) => set({ currentUser: user }),
  setRole: (role) => set({ activeRole: role, currentUser: DEMO_USERS[role] }),
  logout: () => {
    set({ currentUser: null })
    void getSupabaseClient().auth.signOut()
    void fetch('/api/auth/session', { method: 'DELETE' })
  },
  hydrateFromSession: async () => {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      set({ currentUser: null })
      return
    }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, full_name, department, specialization')
      .eq('id', session.user.id)
      .maybeSingle()
    if (error || !profile) {
      set({ currentUser: null })
      return
    }
    set({
      activeRole: profile.role as Role,
      currentUser: {
        id: session.user.id,
        name: profile.full_name,
        role: profile.role as Role,
        department: profile.department ?? undefined,
        specialization: profile.specialization ?? undefined,
      },
    })
  },
}),
  {
    name: 'agentix-authstore', version: 1,
    storage: createJSONStorage(() => localStorage),
    skipHydration: true,
  },
))
```

Do not remove or edit `DEMO_USERS`, `setUser`, or `setRole` — they stay for any UI not yet migrated off the demo flow.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- useAuthStore.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: every test file passes, 0 failures.

- [ ] **Step 6: Stage (do not commit)**

```powershell
git add src/store/useAuthStore.ts src/store/__tests__/useAuthStore.test.ts
```

---

### Task 7: `PortalLauncher` routes through real login

**Files:**
- Modify: `src/components/landing/PortalLauncher.tsx:67-76` (the `handleLogin` function and its call sites)

**Interfaces:**
- Consumes: `/login` (Task 5).
- Produces: no change to exports — same component, changed click behavior.

- [ ] **Step 1: Change the click handler**

In `src/components/landing/PortalLauncher.tsx`, find:

```tsx
export function PortalLauncher() {
  const { setRole } = useAuthStore()
  const router = useRouter()
  ...
  const handleLogin = (role: Role, href: string) => {
    setSelectedHref(href); setLoadingHref(href); setRole(role); router.push(href)
  }
```

Replace the `handleLogin` function body so it goes to `/login` instead of instantly demo-switching the role (drop the `setRole` call and the direct `router.push(href)` to the dashboard):

```tsx
export function PortalLauncher() {
  const router = useRouter()
  ...
  const handleLogin = (_role: Role, _href: string) => {
    router.push('/login')
  }
```

Remove the now-unused `useAuthStore`/`setRole` destructure if nothing else in this component still needs it (check the rest of the file for other `useAuthStore` usages before deleting the import — if something else in this file still reads `useAuthStore`, keep the import and just drop `setRole` from the destructure).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: every test file passes, 0 failures (this component has no existing test; this step just confirms nothing else broke).

- [ ] **Step 3: Manual verification**

Start the dev server (`npm run dev -- -p 3006`) and confirm clicking any role card on the home page now navigates to `/login` instead of an instant dashboard switch. Report what you observed; if you cannot drive a browser, fetch `http://localhost:3006` and confirm the role cards' rendered `href`/behavior in the HTML/JS reflects the new handler (or state clearly that this step could only be verified by reading the code, not by driving the browser).

- [ ] **Step 4: Stage (do not commit)**

```powershell
git add src/components/landing/PortalLauncher.tsx
```

---

### Task 8: Reception registration creates a real patient + visit

**Files:**
- Modify: `src/store/usePatientStore.ts` — the `Patient` type (add one field) and the `addPatient` action (lines ~20-59 for the type, ~554-596 for the action, per the file as it exists today — read the current file first since line numbers may have shifted)
- Test: `src/store/__tests__/usePatientStore.addPatient.test.ts`

**Interfaces:**
- Consumes: `Patients`, `Visits` from `@/lib/api` (Phase 1), `useAuthStore` (Task 6, for the real signed-in staff id).
- Produces: `Patient` gains an optional `visitId?: string` field, populated when a real backend visit was successfully created. Task 9 (Nurse wiring) reads `patient.visitId` to know which real visit to record vitals against.

- [ ] **Step 1: Write the failing test**

Create `src/store/__tests__/usePatientStore.addPatient.test.ts`:

```ts
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { usePatientStore } from '@/store/usePatientStore'
import { useAuthStore } from '@/store/useAuthStore'
import { getSupabaseClient } from '@/lib/supabase/client'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'addpatient-test-reception@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string
let createdPatientId: string | undefined

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  await admin.from('profiles').insert({ id: staffUserId, role: 'reception', full_name: 'AddPatient Test Reception' })
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
  await useAuthStore.getState().hydrateFromSession()
})

afterEach(async () => {
  if (createdPatientId) {
    await admin.from('visits').delete().eq('patient_id', createdPatientId)
    await admin.from('patients').delete().eq('id', createdPatientId)
    createdPatientId = undefined
  }
})

describe('usePatientStore.addPatient — real backend write', () => {
  it('creates a real patients + visits row and stores visitId locally', async () => {
    usePatientStore.setState({ patients: [], queue: [] })
    await usePatientStore.getState().addPatient({
      name: 'Real Backend Test Patient', phone: '9444444444', age: 40, gender: 'Male', department: 'General Medicine',
    })
    const created = usePatientStore.getState().patients[0]
    expect(created).toBeTruthy()
    expect(created.visitId).toBeTruthy()
    createdPatientId = created.id

    const remotePatients = await admin.from('patients').select('*').eq('id', created.id)
    expect(remotePatients.data?.length).toBe(1)
    const remoteVisits = await admin.from('visits').select('*').eq('id', created.visitId!)
    expect(remoteVisits.data?.length).toBe(1)
    expect(remoteVisits.data?.[0].status).toBe('waiting')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- usePatientStore.addPatient.test.ts`
Expected: FAIL — `created.visitId` is `undefined` (the field doesn't exist yet and no backend call happens).

- [ ] **Step 3: Add the `visitId` field to `Patient`**

Read `src/store/usePatientStore.ts` first to confirm the current `Patient` type's exact location, then add one optional field to it (immediately after the existing `triageFlag?: { band: Band; label: string }` line, or wherever the type's last field currently is):

```ts
  triageFlag?: { band: Band; label: string }
  // Phase 2 — set when this patient/visit was created through the real backend
  // (src/lib/api). Older/demo-seeded patients won't have this; the nurse-vitals
  // wiring (Task 9) checks for its presence before attempting a real write.
  visitId?: string
```

- [ ] **Step 4: Make `addPatient` also write to the real backend**

Read the current `addPatient` action in `src/store/usePatientStore.ts` (it's inside the `interface PatientState` as `addPatient: (patient: Partial<Patient> & { name: string; phone: string }) => void` and implemented near the bottom of the store body). Two changes are needed:

1. In the `PatientState` interface, change the signature to return a Promise (so the test above can `await` it):
```ts
  addPatient: (patient: Partial<Patient> & { name: string; phone: string }) => Promise<void>
```

2. In the implementation, after the existing local `set(...)` call that adds the patient to `patients`/`queue` (keep that local behavior exactly as it is — do not remove it), add a real backend write using the already-created local `patient` object, guarded so a backend failure doesn't break the existing local-only UX:

```ts
  addPatient: async (partial) => {
    let created: Patient | null = null
    set((state) => {
    const nextToken = Math.max(...state.patients.map(p => p.token), 0) + 1
    const patient: Patient = {
      id: partial.id ?? `PT-${Date.now()}`,
      name: partial.name,
      age: partial.age ?? 30,
      gender: partial.gender ?? 'Male',
      phone: partial.phone,
      bloodGroup: partial.bloodGroup ?? 'A+',
      token: partial.token ?? nextToken,
      queueStatus: 'waiting',
      estimatedWait: partial.estimatedWait ?? nextToken * 4,
      doctor: partial.doctor ?? 'Dr. Priya Nair',
      department: partial.department ?? 'General Medicine',
      vitals: null,
      symptoms: partial.symptoms ?? [],
      history: partial.history ?? [],
      registeredAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      registeredDate: new Date().toISOString().slice(0, 10),
      triageLevel: partial.triageLevel ?? 'Low',
      hasReports: partial.hasReports ?? false,
      departments: partial.departments,
      visitTypes: partial.visitTypes,
      insurer: partial.insurer,
    }
    created = patient
    return {
      patients: [patient, ...state.patients],
      queue: [patient, ...state.queue],
    }
    })
    if (created) {
      const p = created as Patient
      useAuditStore.getState().log({
        userId: 'RC-1101', userName: 'Reception',
        action: 'reception_registered',
        resource: 'opd_patient', resourceId: p.id,
        detail: `${p.name} (Token ${p.token}) registered · ${p.department} · ${p.triageLevel ?? 'Low'}`,
      })

      // Phase 2 — also create the real backend records, so this patient can
      // flow through Nurse/Doctor/etc. once those portals are wired. A real
      // signed-in staff session (Task 6) is required by RLS; if none exists
      // (e.g. this is still the pre-login demo flow), skip silently and keep
      // the local-only behavior working exactly as before.
      const actorId = useAuthStore.getState().currentUser?.id
      if (actorId) {
        try {
          const { Patients, Visits } = await import('@/lib/api')
          await Patients.create({
            id: p.id, hn: p.id, fullName: p.name, phone: p.phone, age: p.age,
            sex: p.gender === 'Male' ? 'Male' : p.gender === 'Female' ? 'Female' : 'Other',
            bloodGroup: p.bloodGroup,
          } as Parameters<typeof Patients.create>[0])
          const visit = await Visits.create({
            patientId: p.id, kind: 'OPD', department: p.department, status: 'waiting', token: p.token,
          } as Parameters<typeof Visits.create>[0])
          set((state) => ({
            patients: state.patients.map((x) => x.id === p.id ? { ...x, visitId: visit.id } : x),
          }))
        } catch (err) {
          console.error('[usePatientStore] real backend registration failed (local record still created):', err)
        }
      }
    }
  },
```

Add the import this needs at the top of the file, alongside the existing store imports:
```ts
import { useAuthStore } from '@/store/useAuthStore'
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- usePatientStore.addPatient.test.ts`
Expected: `1 passed`.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: every test file passes, 0 failures.

- [ ] **Step 7: Stage (do not commit)**

```powershell
git add src/store/usePatientStore.ts src/store/__tests__/usePatientStore.addPatient.test.ts
```

---

### Task 9: Nurse vitals recording writes a real reading + advances the real visit

**Files:**
- Modify: `src/store/usePatientStore.ts` — the `recordOpdVitals` action (read the current file first to find its exact current location — it's the action that sets `queueStatus: 'consulting'`)
- Test: `src/store/__tests__/usePatientStore.recordOpdVitals.test.ts`

**Interfaces:**
- Consumes: `VitalsReadings`, `Visits` from `@/lib/api` (Task 2, Phase 1), `useAuthStore.currentUser` (Task 6), `Patient.visitId` (Task 8).
- Produces: no new exports — `recordOpdVitals`'s existing signature and local behavior are unchanged; a real backend write is added alongside, mirroring Task 8's guarded pattern.

- [ ] **Step 1: Write the failing test**

Create `src/store/__tests__/usePatientStore.recordOpdVitals.test.ts`:

```ts
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { usePatientStore } from '@/store/usePatientStore'
import { useAuthStore } from '@/store/useAuthStore'
import { Patients, Visits, VitalsReadings } from '@/lib/api'
import { getSupabaseClient } from '@/lib/supabase/client'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
const staffEmail = 'recordvitals-test-nurse@example.com'
const staffPassword = 'Test-Pass-123!'
let staffUserId: string
const testPatientId = 'PT-VITALSREC-TEST-1'
let testVisitId: string

beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail, password: staffPassword, email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  staffUserId = data.user.id
  await admin.from('profiles').insert({ id: staffUserId, role: 'nurse', full_name: 'RecordVitals Test Nurse' })
  const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({
    email: staffEmail, password: staffPassword,
  })
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`)
  await useAuthStore.getState().hydrateFromSession()

  await Patients.create({ id: testPatientId, hn: testPatientId, fullName: 'RecordVitals Test', phone: '9555555555', sex: 'Male' } as Parameters<typeof Patients.create>[0])
  const visit = await Visits.create({ patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'vitals' } as Parameters<typeof Visits.create>[0])
  testVisitId = visit.id
})

afterEach(async () => {
  await admin.from('vitals_readings').delete().eq('visit_id', testVisitId)
})

describe('usePatientStore.recordOpdVitals — real backend write', () => {
  it('writes a vitals_readings row and advances the real visit to consulting', async () => {
    usePatientStore.setState({
      patients: [{
        id: testPatientId, name: 'RecordVitals Test', age: 40, gender: 'Male', phone: '9555555555',
        bloodGroup: 'A+', token: 1, queueStatus: 'vitals', estimatedWait: 0, doctor: 'Dr. Priya Nair',
        department: 'General Medicine', symptoms: [], history: [], registeredAt: '10:00 AM', visitId: testVisitId,
      } as never],
      queue: [],
    })

    await usePatientStore.getState().recordOpdVitals(testPatientId, { hr: 76, systolicBP: 118, diastolicBP: 76 })

    const readings = await VitalsReadings.byVisit(testVisitId)
    expect(readings.length).toBe(1)
    expect(readings[0].payload.hr).toBe(76)

    const visit = await Visits.get(testVisitId)
    expect(visit?.status).toBe('consulting')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- usePatientStore.recordOpdVitals.test.ts`
Expected: FAIL — `readings.length` is `0` (no backend write happens yet).

- [ ] **Step 3: Make `recordOpdVitals` also write to the real backend**

Read the current `recordOpdVitals` action in `src/store/usePatientStore.ts` (it computes `news`/`full`/`legacy`/`triageFlag` then does one `set(...)` call that flips `queueStatus` to `'consulting'`). Change its signature to return a `Promise<void>` in the `PatientState` interface:

```ts
  recordOpdVitals: (id: string, rec: Omit<VitalsRecord, 'id' | 'at'>) => Promise<void>
```

Then, in the implementation, keep every existing line exactly as-is, and append a guarded real-backend write after the existing `set(...)` call, following the same pattern as Task 8:

```ts
  recordOpdVitals: async (id, rec) => {
    const news = news2FromRecord(rec)
    const full: VitalsRecord = { id: `v-${Date.now()}`, at: new Date().toISOString(), ...rec }
    const legacy = {
      bp: (rec.systolicBP != null && rec.diastolicBP != null) ? `${rec.systolicBP}/${rec.diastolicBP}` : '—',
      temp: rec.temp != null ? `${rec.temp}°F` : '—',
      weight: rec.weight != null ? `${rec.weight} kg` : '—',
      spo2: rec.spo2 != null ? `${rec.spo2}%` : '—',
      pulse: rec.hr != null ? `${rec.hr} bpm` : '—',
    }
    const triageFlag: { band: Band; label: string } = {
      band: news.band,
      label: news.band === 'high' ? `NEWS ${news.score} — fast-track to doctor`
        : news.band === 'medium' ? `NEWS ${news.score} — prioritise review`
          : `NEWS ${news.score} — routine`,
    }
    let updatedPatient: Patient | undefined
    set((state) => {
      const updated = state.patients.map(p =>
        p.id === id ? { ...p, vitals: legacy, opdVitals: full, triageFlag, queueStatus: 'consulting' as QueueStatus } : p
      )
      updatedPatient = updated.find(p => p.id === id)
      return {
        patients: updated,
        queue: updated.filter(p => ['waiting', 'vitals', 'consulting'].includes(p.queueStatus)),
      }
    })

    // Phase 2 — mirror this into the real backend when this patient has a real
    // visit (Task 8) and a real signed-in staff session exists (Task 6).
    const actorId = useAuthStore.getState().currentUser?.id
    if (updatedPatient?.visitId && actorId) {
      try {
        const { VitalsReadings, Visits } = await import('@/lib/api')
        await VitalsReadings.create({ visitId: updatedPatient.visitId, recordedBy: actorId, payload: rec })
        await Visits.advance(updatedPatient.visitId, 'consulting')
      } catch (err) {
        console.error('[usePatientStore] real backend vitals write failed (local record still updated):', err)
      }
    }
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- usePatientStore.recordOpdVitals.test.ts`
Expected: `1 passed`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: every test file passes, 0 failures.

- [ ] **Step 6: Stage (do not commit)**

```powershell
git add src/store/usePatientStore.ts src/store/__tests__/usePatientStore.recordOpdVitals.test.ts
```

---

## What this plan deliberately does not do

- **Does not touch `useNursingStore`, `useJourneyStore`, `useNotificationStore`, or any cross-portal live notification** (e.g. "nurse notified when reception sends a patient to vitals") — the existing local notification flow keeps working exactly as before; wiring notifications to the real backend is a later phase (needs the `notifications`/`journey_events` tables from the original architecture spec, not built yet).
- **Does not add component-level (React Testing Library/jsdom) tests** for `/login` or `PortalLauncher` — this project has no such test infrastructure installed, and adding one is out of scope; verification for those two tasks is manual/API-level instead.
- **Does not remove the demo `DEMO_USERS`/role-switcher data** — `useAuthStore`'s demo map stays intact for any UI not yet migrated.
- **Does not migrate any other domain module** (lab, pharmacy, radiology, admission/beds) — those stay on the Phase-1 hybrid fallback (localStorage) until their own phase.
- **Does not add a signup/self-registration flow for patients** — only staff login (via Task 5's `/login`, using accounts created through Phase 1's `POST /api/admin/staff`) is in scope here.

## Next step after this plan ships

Once this is verified end-to-end (a real staff login → a real reception registration → a real nurse vitals recording, all visible in Postgres), the next phase covers Doctor consultation + orders (per the original design doc's rollout order), which is the first place a `lab_orders`/`radiology_studies` table gets introduced.
