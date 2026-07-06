# Backend Foundation — Schema, Auth Infrastructure & Core Repository Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the real Supabase Postgres schema, Auth infrastructure, and Row-Level Security for `profiles`, `patients`, `visits`, and `appointments`, and swap the existing `src/lib/api` repository layer's transport from `localStorage` to Supabase — with zero changes to any UI component or Zustand store. This is Phase 1 of 7 in the rollout order from `docs/superpowers/specs/2026-07-03-backend-architecture-design.md`; later phases (Nurse vitals, Doctor consult/orders, Lab, Radiology, Pharmacy, Admin/Admission) each get their own plan.

**Architecture:** Supabase Postgres + Auth, accessed via `supabase-js` directly from the browser/server, authorized entirely by Row-Level Security — no custom REST layer for CRUD. The existing `src/lib/api/_core.ts` `table<T>()` abstraction is reimplemented against Supabase instead of `localStorage`; every domain module built on top of it (`patients.ts`, `visits.ts`, the new `appointments.ts`) keeps its exact same public interface, per the comment already in that file: *"Phase-2 swap is a transport change, not an API change."*

**Tech Stack:** Next.js 16.2.4 (App Router), TypeScript, `@supabase/supabase-js`, `@supabase/ssr`, Zod (existing), Vitest (new — this repo has no test runner yet).

## Global Constraints

- No UI component or Zustand store is modified in this plan — that begins in Phase 2 onward. This plan only touches `src/lib/api/**`, `src/lib/supabase/**`, `src/app/api/admin/**`, `supabase/**`, and test/config files.
- Every write to Postgres must go through Row-Level Security — no table is left with RLS disabled.
- Zod schemas in `src/lib/api/*` stay camelCase (matching every existing consumer across the codebase); Postgres columns stay snake_case (idiomatic SQL). The mapping between the two happens once, inside `_core.ts`.
- The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is only ever read inside `src/lib/supabase/admin.ts` and `src/app/api/admin/**` — never inside anything that could be imported by a client component.
- Credentials already live in `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`. The Postgres connection (`DATABASE_URL`, via the Supavisor transaction pooler) and the anon key have both already been verified working against the live project `rojzpogpykqfccbssrsv`.
- Tests in this plan run against the **real, live Supabase project** (there is no local Docker Postgres in this environment) — every test that creates rows must clean them up in `afterAll`/`afterEach` so the shared database doesn't accumulate test data.

---

### Task 1: Dependencies and test harness

**Files:**
- Modify: `package.json` (via `npm install`, not hand-edited)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Interfaces:**
- Produces: a working `npm test` command that later tasks' tests run under; `.env.local` values available as `process.env.*` inside tests via the setup file.

- [ ] **Step 1: Install runtime and dev dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest dotenv
```
Expected: `package.json` `dependencies` gains `@supabase/supabase-js` and `@supabase/ssr`; `devDependencies` gains `vitest` and `dotenv`. Command exits 0.

- [ ] **Step 2: Add the test script**

Modify `package.json` — in `"scripts"`, add a `"test"` entry alongside the existing `"lint"`:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create the test setup file (loads `.env.local`)**

Create `vitest.setup.ts`:

```ts
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
```

- [ ] **Step 5: Write a throwaway smoke test to verify the harness itself**

Create `src/lib/__tests__/harness.smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('vitest harness', () => {
  it('loads env vars from .env.local', () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://rojzpogpykqfccbssrsv.supabase.co')
  })
})
```

- [ ] **Step 6: Run it**

Run: `npm test`
Expected: `1 passed`, exit code 0.

- [ ] **Step 7: Delete the smoke test (its job was only to prove the harness works)**

Delete `src/lib/__tests__/harness.smoke.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add Supabase client deps and Vitest test harness"
```

---

### Task 2: Core schema migration — enums, `profiles`, `patients`, `visits`, `appointments`

**Files:**
- Create: `supabase/config.toml`, `supabase/.gitignore` (via `npx supabase init`)
- Create: `supabase/migrations/<timestamp>_core_schema.sql`
- Test: `src/lib/supabase/__tests__/schema.test.ts`

**Interfaces:**
- Produces: live Postgres tables `profiles`, `patients`, `visits`, `appointments` with the columns listed below — every later task depends on these existing exactly as specified.

- [ ] **Step 1: Initialize the Supabase CLI project scaffold**

Run: `npx --yes supabase init --yes`
Expected: `Finished supabase init.` printed, and `supabase/config.toml` + `supabase/.gitignore` created. (The CLI may also print a harmless `PostHog` telemetry-shutdown warning on exit — ignore it, it does not affect the result.)

- [ ] **Step 2: Write the failing test first**

Create `src/lib/supabase/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Client } from 'pg'

async function tableExists(client: Client, table: string): Promise<boolean> {
  const res = await client.query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1`,
    [table]
  )
  return (res.rowCount ?? 0) > 0
}

describe('core schema', () => {
  it('creates profiles, patients, visits, and appointments tables', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      expect(await tableExists(client, 'profiles')).toBe(true)
      expect(await tableExists(client, 'patients')).toBe(true)
      expect(await tableExists(client, 'visits')).toBe(true)
      expect(await tableExists(client, 'appointments')).toBe(true)
    } finally {
      await client.end()
    }
  })
})
```

This test needs the `pg` package to talk to Postgres directly (independent of the app's own Supabase client, so it can verify schema exists before any app code is written). Run: `npm install -D pg @types/pg`

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- schema.test.ts`
Expected: FAIL — `expect(received).toBe(true)` for `profiles` (table does not exist yet).

- [ ] **Step 4: Create the migration file**

Run: `npx --yes supabase migration new core_schema`
Expected: creates `supabase/migrations/<timestamp>_core_schema.sql` (empty). Note the exact filename it prints — you'll edit that file next.

- [ ] **Step 5: Write the migration SQL**

Open the newly created `supabase/migrations/<timestamp>_core_schema.sql` and write:

```sql
-- Core schema: identity, patients, visits, appointments (Phase 1 of the 7-portal backend).

create type role_t as enum (
  'doctor', 'nurse', 'pharmacy', 'lab', 'radiology', 'reception', 'admin'
);

create table profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  role           role_t not null,
  full_name      text not null,
  department     text,
  specialization text,
  phone          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

create type sex_t as enum ('Male', 'Female', 'Other');
create type payer_t as enum ('cash', 'corporate', 'insurance', 'govt');

create table patients (
  id                 text primary key,
  hn                 text not null,
  auth_user_id       uuid references auth.users(id),
  full_name          text not null,
  phone              text not null,
  dob                date,
  age                smallint,
  sex                sex_t not null,
  blood_group        text,
  primary_payer      payer_t not null default 'cash',
  insurer_name       text,
  address            text,
  allergies          text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  family_contacts    jsonb not null default '[]',
  disha_consent_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);
create unique index patients_hn_idx on patients(hn);
create index patients_phone_idx on patients(phone);
create unique index patients_auth_user_idx on patients(auth_user_id) where auth_user_id is not null;

create type visit_kind_t as enum ('OPD', 'ER', 'IPD', 'OnlineConsult');
create type visit_status_t as enum
  ('scheduled', 'waiting', 'vitals', 'consulting', 'pharmacy', 'billing', 'completed', 'cancelled');
create type triage_t as enum ('Low', 'Medium', 'High', 'Critical');

create table visits (
  id                  text primary key,
  patient_id          text not null references patients(id),
  kind                visit_kind_t not null,
  doctor_id           uuid references profiles(id),
  doctor_name         text,
  department          text not null,
  status              visit_status_t not null,
  token               integer,
  scheduled_at        timestamptz,
  arrived_at          timestamptz,
  served_at           timestamptz,
  completed_at        timestamptz,
  payer_type          payer_t not null default 'cash',
  chief_complaint     text,
  symptoms            text[] not null default '{}',
  estimated_wait_min  integer,
  triage_level        triage_t,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index visits_patient_idx on visits(patient_id);
create index visits_doctor_active_idx on visits(doctor_id, status)
  where status not in ('completed', 'cancelled');
create index visits_status_idx on visits(status)
  where status not in ('completed', 'cancelled');

create type appt_mode_t as enum ('online', 'in_person');
create type appt_status_t as enum ('upcoming', 'confirmed', 'cancelled');

create table appointments (
  id           text primary key,
  patient_id   text not null references patients(id),
  patient_name text,
  doctor_id    uuid references profiles(id),
  doctor_name  text not null,
  specialty    text not null,
  date         date not null,
  time         text not null,
  mode         appt_mode_t not null default 'in_person',
  status       appt_status_t not null default 'upcoming',
  created_at   timestamptz not null default now()
);
create index appointments_doctor_date_idx on appointments(doctor_id, date);
create index appointments_patient_idx on appointments(patient_id);
```

- [ ] **Step 6: Apply the migration to the live database**

Run (PowerShell): `npx --yes supabase db push --db-url $env:DATABASE_URL --include-all --yes`
(`$env:DATABASE_URL` must already be set in the shell from `.env.local`'s `DATABASE_URL` — e.g. `$env:DATABASE_URL = "postgresql://postgres.rojzpogpykqfccbssrsv:Agentix%40HIMS@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"` — before running this command.)
Expected: output lists the migration file and confirms it was applied (`Applying migration <timestamp>_core_schema.sql...`), exits 0.

- [ ] **Step 7: Run the test again to verify it passes**

Run: `npm test -- schema.test.ts`
Expected: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add supabase/ src/lib/supabase/__tests__/schema.test.ts package.json package-lock.json
git commit -m "feat: add core schema migration (profiles, patients, visits, appointments)"
```

---

### Task 3: Row-Level Security policies

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_policies.sql`
- Test: `src/lib/supabase/__tests__/rls.test.ts`

**Interfaces:**
- Consumes: the `profiles`/`patients`/`visits`/`appointments` tables from Task 2.
- Produces: RLS enabled and policies enforced on all four tables — every later task's Supabase calls run through these policies.

- [ ] **Step 1: Write the failing RLS test first**

This test seeds two real Supabase Auth users (a `reception` staffer and a `doctor`) directly via the service-role client (bypassing RLS, since seeding test fixtures is exactly what the service role is for), signs in as each with the anon key to get RLS-bound sessions, and asserts what each can and cannot see. It cleans up everything it creates.

Create `src/lib/supabase/__tests__/rls.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

let receptionUserId: string
let doctorUserId: string
let receptionClient: SupabaseClient
let doctorClient: SupabaseClient
const testPatientId = 'PT-RLSTEST-1'
const testVisitId = 'VIS-RLSTEST-1'

async function createStaffUser(email: string, role: 'reception' | 'doctor') {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: 'Test-Pass-123!', email_confirm: true,
  })
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`)
  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id, role, full_name: `RLS Test ${role}`,
  })
  if (profileError) throw new Error(`profile insert failed: ${profileError.message}`)
  return data.user.id
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey)
  const { error } = await client.auth.signInWithPassword({ email, password: 'Test-Pass-123!' })
  if (error) throw new Error(`signIn failed: ${error.message}`)
  return client
}

beforeAll(async () => {
  receptionUserId = await createStaffUser('rls-test-reception@example.com', 'reception')
  doctorUserId = await createStaffUser('rls-test-doctor@example.com', 'doctor')
  receptionClient = await signIn('rls-test-reception@example.com')
  doctorClient = await signIn('rls-test-doctor@example.com')

  await admin.from('patients').insert({
    id: testPatientId, hn: 'HN-RLSTEST-1', full_name: 'RLS Test Patient', phone: '9999999999', sex: 'Other',
  })
  await admin.from('visits').insert({
    id: testVisitId, patient_id: testPatientId, kind: 'OPD', department: 'General Medicine',
    status: 'waiting', doctor_id: doctorUserId,
  })
})

afterAll(async () => {
  await admin.from('visits').delete().eq('id', testVisitId)
  await admin.from('patients').delete().eq('id', testPatientId)
  await admin.from('profiles').delete().eq('id', receptionUserId)
  await admin.from('profiles').delete().eq('id', doctorUserId)
  await admin.auth.admin.deleteUser(receptionUserId)
  await admin.auth.admin.deleteUser(doctorUserId)
})

describe('RLS: profiles', () => {
  it('lets a user read their own profile', async () => {
    const { data, error } = await receptionClient.from('profiles').select('*').eq('id', receptionUserId).maybeSingle()
    expect(error).toBeNull()
    expect(data?.role).toBe('reception')
  })
})

describe('RLS: patients', () => {
  it('lets staff (reception) see patients', async () => {
    const { data, error } = await receptionClient.from('patients').select('*').eq('id', testPatientId).maybeSingle()
    expect(error).toBeNull()
    expect(data?.id).toBe(testPatientId)
  })

  it('lets staff (doctor) see patients too', async () => {
    const { data, error } = await doctorClient.from('patients').select('*').eq('id', testPatientId).maybeSingle()
    expect(error).toBeNull()
    expect(data?.id).toBe(testPatientId)
  })
})

describe('RLS: visits', () => {
  it('lets the assigned doctor see their own visit', async () => {
    const { data, error } = await doctorClient.from('visits').select('*').eq('id', testVisitId).maybeSingle()
    expect(error).toBeNull()
    expect(data?.id).toBe(testVisitId)
  })

  it('lets reception see all visits', async () => {
    const { data, error } = await receptionClient.from('visits').select('*').eq('id', testVisitId).maybeSingle()
    expect(error).toBeNull()
    expect(data?.id).toBe(testVisitId)
  })

  it('blocks a doctor from updating a visit not assigned to them', async () => {
    const otherDoctorId = '00000000-0000-0000-0000-000000000000'
    await admin.from('visits').update({ doctor_id: otherDoctorId }).eq('id', testVisitId)
    const { data } = await doctorClient.from('visits').update({ status: 'consulting' }).eq('id', testVisitId).select()
    expect(data).toEqual([])
    await admin.from('visits').update({ doctor_id: doctorUserId }).eq('id', testVisitId)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- rls.test.ts`
Expected: FAIL, but only on the last test, "blocks a doctor from updating a visit not assigned to them" — 4 passed, 1 failed. Without RLS enabled, Postgres/Supabase's default grants let the anon-keyed sessions read and write everything in `public` tables, so every *select* assertion already passes even pre-migration. Only the assertion that expects a write to be *blocked* fails, because right now nothing blocks it. This is expected, and it's the one assertion in this file that actually exercises authorization rather than just connectivity.

- [ ] **Step 3: Create the RLS migration**

Run: `npx --yes supabase migration new rls_policies`

Write `supabase/migrations/<timestamp>_rls_policies.sql`:

```sql
-- Row-Level Security for Phase 1 tables. Nurse/lab/radiology/pharmacy policies
-- are added in their respective later phases as those workflows come online.

alter table profiles enable row level security;
alter table patients enable row level security;
alter table visits enable row level security;
alter table appointments enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────
create policy profiles_select_self on profiles for select
  using (id = auth.uid());

create policy profiles_select_admin on profiles for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── patients ────────────────────────────────────────────────────────────
create policy patients_select_staff on patients for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('doctor', 'nurse', 'reception', 'admin', 'lab', 'radiology', 'pharmacy')
  ));

create policy patients_select_self on patients for select
  using (auth_user_id = auth.uid());

create policy patients_insert_staff on patients for insert
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy patients_update_staff on patients for update
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

-- ── visits ──────────────────────────────────────────────────────────────
create policy visits_select_staff on visits for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy visits_select_doctor on visits for select
  using (doctor_id = auth.uid());

create policy visits_select_self on visits for select
  using (exists (
    select 1 from patients pt where pt.id = visits.patient_id and pt.auth_user_id = auth.uid()
  ));

create policy visits_insert_staff on visits for insert
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy visits_update_staff on visits for update
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy visits_update_doctor on visits for update
  using (doctor_id = auth.uid())
  with check (doctor_id = auth.uid());

-- ── appointments ────────────────────────────────────────────────────────
create policy appointments_select_staff on appointments for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy appointments_select_doctor on appointments for select
  using (doctor_id = auth.uid());

create policy appointments_select_self on appointments for select
  using (exists (
    select 1 from patients pt where pt.id = appointments.patient_id and pt.auth_user_id = auth.uid()
  ));

create policy appointments_insert_staff on appointments for insert
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));

create policy appointments_update_staff on appointments for update
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ))
  with check (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('reception', 'admin')
  ));
```

- [ ] **Step 4: Apply the migration**

Run: `npx --yes supabase db push --db-url $env:DATABASE_URL --include-all --yes`
Expected: confirms `<timestamp>_rls_policies.sql` applied, exits 0.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- rls.test.ts`
Expected: `6 passed` (all `it()` blocks across the `profiles`/`patients`/`visits` describe groups).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add RLS policies for profiles, patients, visits, appointments"
```

---

### Task 4: Supabase client modules (browser, server, admin)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Test: `src/lib/supabase/__tests__/client.test.ts`
- Test: `src/lib/supabase/__tests__/admin.test.ts`

**Interfaces:**
- Produces: `getSupabaseClient(): SupabaseClient` (browser/anon), `getSupabaseServerClient(): Promise<SupabaseClient>` (cookie-based, Route Handlers/RSC only), `getSupabaseAdminClient(): SupabaseClient` (service-role, server-only). Task 5 (`_core.ts`) consumes `getSupabaseClient`. Task 7 (staff route) consumes `getSupabaseAdminClient`.

- [ ] **Step 1: Write the failing test for the browser client**

Create `src/lib/supabase/__tests__/client.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getSupabaseClient } from '@/lib/supabase/client'

describe('getSupabaseClient', () => {
  it('returns a client that can reach the profiles table', async () => {
    const client = getSupabaseClient()
    const { error } = await client.from('profiles').select('id').limit(1)
    expect(error).toBeNull()
  })

  it('returns the same instance on repeated calls', () => {
    expect(getSupabaseClient()).toBe(getSupabaseClient())
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- client.test.ts`
Expected: FAIL with `Cannot find module '@/lib/supabase/client'`.

- [ ] **Step 3: Implement the browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | undefined

export function getSupabaseClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  cached = createClient(url, anonKey)
  return cached
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- client.test.ts`
Expected: `2 passed`.

- [ ] **Step 5: Write the failing test for the admin client**

Create `src/lib/supabase/__tests__/admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

describe('getSupabaseAdminClient', () => {
  it('returns a client that can list auth users (service-role only capability)', async () => {
    const client = getSupabaseAdminClient()
    const { data, error } = await client.auth.admin.listUsers()
    expect(error).toBeNull()
    expect(Array.isArray(data.users)).toBe(true)
  })

  it('throws if called from a browser context', () => {
    // Simulate a browser global existing (as it would in a client component bundle).
    ;(globalThis as { window?: unknown }).window = {}
    expect(() => getSupabaseAdminClient()).toThrow(/must not be called from the browser/)
    delete (globalThis as { window?: unknown }).window
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- admin.test.ts`
Expected: FAIL with `Cannot find module '@/lib/supabase/admin'`.

- [ ] **Step 7: Implement the admin client**

Create `src/lib/supabase/admin.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | undefined

export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdminClient must not be called from the browser')
  }
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cached
}
```

(A runtime `typeof window` guard is used instead of the `server-only` package — `server-only` unconditionally throws under plain Node module resolution outside Next.js's webpack bundler, which would break this file being imported directly in Vitest tests.)

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- admin.test.ts`
Expected: `2 passed`.

- [ ] **Step 9: Implement the server (cookie-based) client — no standalone test**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component without a mutable cookie store — safe to ignore;
          // middleware/Route Handlers are where session refresh actually persists.
        }
      },
    },
  })
}
```

This file depends on `next/headers`, which only works inside a real Next.js request (Route Handler, Server Component, or Server Action) — it cannot be unit-tested under plain Vitest. It's exercised for real in Task 7's Route Handler test.

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser, server, and admin client modules"
```

---

### Task 5: Swap `_core.ts` transport to Supabase; extend `patients.ts` and `visits.ts`

**Files:**
- Modify: `src/lib/api/_core.ts`
- Modify: `src/lib/api/patients.ts` (add `authUserId` field)
- Modify: `src/lib/api/visits.ts` (tighten `doctorId` to a UUID)
- Test: `src/lib/api/__tests__/core.test.ts`
- Test: `src/lib/api/__tests__/patients.test.ts`
- Test: `src/lib/api/__tests__/visits.test.ts`

**Interfaces:**
- Consumes: `getSupabaseClient` from Task 4.
- Produces: `table<T extends {id: string}>(name, schema): Table<T>` — same shape as before (`list/get/put/putMany/patch/remove/count/replaceAll`), now backed by Postgres. `Patients` and `Visits` (existing exports) keep their exact same method signatures — no other file in the codebase needs to change when this lands.

- [ ] **Step 1: Write the failing test for the snake_case/camelCase mapping (the core correctness risk in this task)**

Postgres columns are snake_case; every existing zod schema in `src/lib/api` is camelCase. `_core.ts` must convert transparently in both directions.

Create `src/lib/api/__tests__/core.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { table } from '@/lib/api/_core'
import { getSupabaseClient } from '@/lib/supabase/client'

const TestPatientSchema = z.object({
  id: z.string(),
  hn: z.string(),
  fullName: z.string(),
  phone: z.string(),
  sex: z.enum(['Male', 'Female', 'Other']),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
type TestPatient = z.infer<typeof TestPatientSchema>

const testId = 'PT-CORETEST-1'

afterEach(async () => {
  await getSupabaseClient().from('patients').delete().eq('id', testId)
})

describe('table() against the real patients table', () => {
  it('put(): converts camelCase input to snake_case columns and back on read', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    const saved = await patients.put({
      id: testId, hn: 'HN-CORETEST-1', fullName: 'Core Test Patient', phone: '9000000000', sex: 'Other',
    })
    expect(saved.fullName).toBe('Core Test Patient')

    const fetched = await patients.get(testId)
    expect(fetched?.fullName).toBe('Core Test Patient')
    expect(fetched?.hn).toBe('HN-CORETEST-1')
  })

  it('patch(): partial camelCase update reaches the right snake_case column', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    await patients.put({ id: testId, hn: 'HN-CORETEST-1', fullName: 'Before', phone: '9000000000', sex: 'Other' })
    const patched = await patients.patch(testId, { fullName: 'After' })
    expect(patched?.fullName).toBe('After')
  })

  it('list(): returns camelCase rows and applies the client-side filter', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    await patients.put({ id: testId, hn: 'HN-CORETEST-1', fullName: 'Filter Me', phone: '9000000000', sex: 'Other' })
    const rows = await patients.list((p) => p.fullName === 'Filter Me')
    expect(rows.some((r) => r.id === testId)).toBe(true)
  })

  it('remove(): deletes the row and reports success/failure correctly', async () => {
    const patients = table<TestPatient>('patients', TestPatientSchema)
    await patients.put({ id: testId, hn: 'HN-CORETEST-1', fullName: 'To Delete', phone: '9000000000', sex: 'Other' })
    expect(await patients.remove(testId)).toBe(true)
    expect(await patients.remove(testId)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- core.test.ts`
Expected: FAIL — current `table()` reads/writes `localStorage` (`window` is undefined under Node/Vitest, so every op silently no-ops and returns empty/undefined), so `saved.fullName`/`fetched?.fullName` assertions fail.

- [ ] **Step 3: Replace `_core.ts`'s storage implementation**

Modify `src/lib/api/_core.ts` — replace the "Storage primitives" and "Table" sections (everything from the `NS`/`readRaw`/`writeRaw` block through the end of the `table()` function) with:

```ts
import { z } from 'zod'
import { getSupabaseClient } from '@/lib/supabase/client'

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
  for (const [k, v] of Object.entries(row)) out[toCamelCase(k)] = v
  return out
}

// ─────────────────────────────────────────────────────────────────────────
// Table: typed CRUD over a Supabase Postgres table
// ─────────────────────────────────────────────────────────────────────────

export interface Table<T extends { id: string }> {
  name: string
  list: (filter?: (row: T) => boolean) => Promise<T[]>
  get: (id: string) => Promise<T | undefined>
  put: (row: T) => Promise<T>
  putMany: (rows: T[]) => Promise<T[]>
  patch: (id: string, partial: Partial<T>) => Promise<T | undefined>
  remove: (id: string) => Promise<boolean>
  count: () => Promise<number>
  replaceAll: (rows: T[]) => Promise<T[]>
}

export function table<T extends { id: string }>(name: string, schema: z.ZodType<T>): Table<T> {
  const client = () => getSupabaseClient()

  return {
    name,
    async list(filter) {
      const { data, error } = await client().from(name).select('*')
      if (error) throw new Error(`[api/${name}] list failed: ${error.message}`)
      const rows = (data ?? []).map((r) => schema.parse(rowToCamel(r)))
      return filter ? rows.filter(filter) : rows
    },
    async get(id) {
      const { data, error } = await client().from(name).select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(`[api/${name}] get failed: ${error.message}`)
      return data ? schema.parse(rowToCamel(data)) : undefined
    },
    async put(row) {
      const validated = schema.parse(row)
      const { data, error } = await client().from(name).upsert(rowToSnake(validated)).select().single()
      if (error) throw new Error(`[api/${name}] put failed: ${error.message}`)
      return schema.parse(rowToCamel(data))
    },
    async putMany(rows) {
      const validated = rows.map((r) => schema.parse(r))
      const { data, error } = await client().from(name).upsert(validated.map(rowToSnake)).select()
      if (error) throw new Error(`[api/${name}] putMany failed: ${error.message}`)
      return (data ?? []).map((r) => schema.parse(rowToCamel(r)))
    },
    async patch(id, partial) {
      const { data, error } = await client().from(name).update(rowToSnake(partial)).eq('id', id).select().maybeSingle()
      if (error) throw new Error(`[api/${name}] patch failed: ${error.message}`)
      return data ? schema.parse(rowToCamel(data)) : undefined
    },
    async remove(id) {
      const { error, count } = await client().from(name).delete({ count: 'exact' }).eq('id', id)
      if (error) throw new Error(`[api/${name}] remove failed: ${error.message}`)
      return (count ?? 0) > 0
    },
    async count() {
      const { count, error } = await client().from(name).select('*', { count: 'exact', head: true })
      if (error) throw new Error(`[api/${name}] count failed: ${error.message}`)
      return count ?? 0
    },
    async replaceAll(rows) {
      const validated = rows.map((r) => schema.parse(r))
      await client().from(name).delete().neq('id', '')
      const { data, error } = await client().from(name).upsert(validated.map(rowToSnake)).select()
      if (error) throw new Error(`[api/${name}] replaceAll failed: ${error.message}`)
      return (data ?? []).map((r) => schema.parse(rowToCamel(r)))
    },
  }
}
```

Keep everything below the old `table()` function (the "IDs + common schemas", "Audit emission", and "Bootstrap + reset" sections — `id()`, `isoNow()`, `tenantId`, `TimestampSchema`, `TenantSchema`, `audit`, `registerAuditBridge`, `AuditEmit`, `isBootstrapped`, `markBootstrapped`, `getBootstrapState`, `resetAll`) **unchanged** — those don't touch storage directly and are consumed as-is by every domain module.

Remove the now-unused `listTableKeys`, `wipeAll`, `readRaw`, `writeRaw`, `removeRaw`, `isBrowser`, and `NS` — nothing outside this file references them (confirm with the grep in Step 3a below before deleting).

- [ ] **Step 3a: Confirm nothing else imports the removed localStorage helpers**

Run (PowerShell): `Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Select-String -Pattern "listTableKeys|wipeAll" | Where-Object { $_.Path -notmatch "_core.ts" }`
Expected: no output (nothing else references them). If something does, keep the helper instead of deleting it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- core.test.ts`
Expected: `4 passed`.

- [ ] **Step 5: Extend `PatientSchema` with `authUserId`**

Modify `src/lib/api/patients.ts` — add one field to `PatientSchema` (after `dishaConsentAt`):

```ts
export const PatientSchema = z.object({
  id: z.string(),
  hn: z.string(),
  fullName: z.string(),
  phone: z.string(),
  dob: z.string().optional(),
  age: z.number().int().nonnegative().optional(),
  sex: Sex,
  bloodGroup: z.string().optional(),
  primaryPayer: PayerType.default('cash'),
  insurerName: z.string().optional(),
  address: z.string().optional(),
  allergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  dishaConsentAt: z.string().optional(),
  authUserId: z.string().uuid().optional(),
  familyContacts: z.array(z.object({ name: z.string(), relation: z.string(), phone: z.string() })).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
})
```

No other change to `patients.ts` is needed — `Patients.create`/`update`/etc. pass through to `table()` unchanged.

- [ ] **Step 6: Write the failing test for `Patients`**

Create `src/lib/api/__tests__/patients.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { Patients } from '@/lib/api/patients'
import { getSupabaseClient } from '@/lib/supabase/client'

const testId = 'PT-PATIENTSTEST-1'

afterEach(async () => {
  await getSupabaseClient().from('patients').delete().eq('id', testId)
})

describe('Patients repository (Supabase-backed)', () => {
  it('creates a patient with a generated id and timestamps', async () => {
    const saved = await Patients.create({
      id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male',
    })
    expect(saved.id).toBe(testId)
    expect(saved.createdAt).toBeTruthy()
  })

  it('finds the patient via list() with a phone filter, matching findByPhone-style lookups', async () => {
    await Patients.create({ id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male' })
    const found = await Patients.list((p) => p.phone === '9111111111')
    expect(found.some((p) => p.id === testId)).toBe(true)
  })

  it('soft-deletes: softDelete sets deletedAt and list() excludes it by default', async () => {
    await Patients.create({ id: testId, hn: 'HN-PATIENTSTEST-1', fullName: 'Patients Test', phone: '9111111111', sex: 'Male' })
    await Patients.softDelete(testId)
    const active = await Patients.list()
    expect(active.some((p) => p.id === testId)).toBe(false)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -- patients.test.ts`
Expected: FAIL — before Step 5's schema change and Step 3's transport swap, either the schema rejects the row or the write silently no-ops under Node.

- [ ] **Step 8: Run it to verify it passes** (implementation already landed in Steps 3 and 5)

Run: `npm test -- patients.test.ts`
Expected: `3 passed`.

- [ ] **Step 9: Tighten `VisitSchema.doctorId` to a UUID**

Modify `src/lib/api/visits.ts` — change one line:

```ts
  doctorId: z.string().uuid().optional(),
```

(was `doctorId: z.string().optional()`). This anticipates `doctor_id` being a real `profiles.id` (UUID) once staff accounts exist — safe now because no running UI code writes through `Visits` yet (stores still use `localStorage` directly until their own phase).

- [ ] **Step 10: Write the failing test for `Visits`**

Create `src/lib/api/__tests__/visits.test.ts`:

```ts
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Patients } from '@/lib/api/patients'
import { Visits } from '@/lib/api/visits'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-VISITSTEST-1'
const testVisitId = 'VIS-VISITSTEST-1'

beforeAll(async () => {
  await Patients.create({ id: testPatientId, hn: 'HN-VISITSTEST-1', fullName: 'Visits Test', phone: '9222222222', sex: 'Female' })
})

afterEach(async () => {
  await getSupabaseClient().from('visits').delete().eq('id', testVisitId)
})

describe('Visits repository (Supabase-backed)', () => {
  it('creates a visit linked to a patient', async () => {
    const saved = await Visits.create({
      id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting',
    })
    expect(saved.patientId).toBe(testPatientId)
    expect(saved.status).toBe('waiting')
  })

  it('advance() moves the visit through queue_status', async () => {
    await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' })
    const advanced = await Visits.advance(testVisitId, 'vitals')
    expect(advanced?.status).toBe('vitals')
  })

  it("byPatient() returns only that patient's visits", async () => {
    await Visits.create({ id: testVisitId, patientId: testPatientId, kind: 'OPD', department: 'General Medicine', status: 'waiting' })
    const rows = await Visits.byPatient(testPatientId)
    expect(rows.every((v) => v.patientId === testPatientId)).toBe(true)
    expect(rows.some((v) => v.id === testVisitId)).toBe(true)
  })
})
```

- [ ] **Step 11: Run it, verify it passes**

Run: `npm test -- visits.test.ts`
Expected: `3 passed`.

- [ ] **Step 12: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all tests pass (schema, rls, client, admin, core, patients, visits).

- [ ] **Step 13: Commit**

```bash
git add src/lib/api/_core.ts src/lib/api/patients.ts src/lib/api/visits.ts src/lib/api/__tests__/
git commit -m "feat: swap src/lib/api transport to Supabase; extend patients/visits schemas"
```

---

### Task 6: `appointments.ts` repository module

**Files:**
- Create: `src/lib/api/appointments.ts`
- Modify: `src/lib/api/index.ts` (export it)
- Test: `src/lib/api/__tests__/appointments.test.ts`

**Interfaces:**
- Consumes: `table`, `audit`, `id`, `isoNow` from `_core.ts` (Task 5); `appointments` table from Task 2/3.
- Produces: `Appointments.{list, get, byPatient, byDoctor, create, updateStatus}`, `AppointmentSchema`, `Appointment` type — mirrors the shape of `Appointment` already used in `usePatientStore.ts` (not modified in this plan, but this is the contract Phase 2+ will read from).

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/__tests__/appointments.test.ts`:

```ts
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Patients } from '@/lib/api/patients'
import { Appointments } from '@/lib/api/appointments'
import { getSupabaseClient } from '@/lib/supabase/client'

const testPatientId = 'PT-APPTTEST-1'
const testApptId = 'APT-APPTTEST-1'

beforeAll(async () => {
  await Patients.create({ id: testPatientId, hn: 'HN-APPTTEST-1', fullName: 'Appt Test', phone: '9333333333', sex: 'Male' })
})

afterEach(async () => {
  await getSupabaseClient().from('appointments').delete().eq('id', testApptId)
})

describe('Appointments repository', () => {
  it('books an appointment for a patient', async () => {
    const saved = await Appointments.create({
      id: testApptId, patientId: testPatientId, doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
      date: '2026-08-01', time: '10:30 AM', mode: 'in_person',
    })
    expect(saved.status).toBe('upcoming')
    expect(saved.patientId).toBe(testPatientId)
  })

  it('byPatient() returns the booking', async () => {
    await Appointments.create({
      id: testApptId, patientId: testPatientId, doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
      date: '2026-08-01', time: '10:30 AM', mode: 'in_person',
    })
    const rows = await Appointments.byPatient(testPatientId)
    expect(rows.some((a) => a.id === testApptId)).toBe(true)
  })

  it('updateStatus() cancels an appointment', async () => {
    await Appointments.create({
      id: testApptId, patientId: testPatientId, doctorName: 'Dr. Priya Nair', specialty: 'General Medicine',
      date: '2026-08-01', time: '10:30 AM', mode: 'in_person',
    })
    const cancelled = await Appointments.updateStatus(testApptId, 'cancelled')
    expect(cancelled?.status).toBe('cancelled')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- appointments.test.ts`
Expected: FAIL with `Cannot find module '@/lib/api/appointments'`.

- [ ] **Step 3: Implement `appointments.ts`**

Create `src/lib/api/appointments.ts`:

```ts
/* Appointments — patient bookings with a doctor. Mirrors the Appointment shape
 * used by usePatientStore.ts, now backed by Postgres instead of localStorage. */
import { z } from 'zod'
import { audit, id as newId, isoNow, table } from './_core'

export const ApptMode = z.enum(['online', 'in_person'])
export const ApptStatus = z.enum(['upcoming', 'confirmed', 'cancelled'])

export const AppointmentSchema = z.object({
  id: z.string(),                    // 'APT-...'
  patientId: z.string(),
  patientName: z.string().optional(),
  doctorId: z.string().uuid().optional(),
  doctorName: z.string(),
  specialty: z.string(),
  date: z.string(),                  // 'YYYY-MM-DD'
  time: z.string(),
  mode: ApptMode.default('in_person'),
  status: ApptStatus.default('upcoming'),
  createdAt: z.string(),
})
export type Appointment = z.infer<typeof AppointmentSchema>

const appointments = table<Appointment>('appointments', AppointmentSchema)

export const Appointments = {
  list: (filter?: (a: Appointment) => boolean) => appointments.list(filter),
  get: (id: string) => appointments.get(id),
  byPatient: (patientId: string) => appointments.list((a) => a.patientId === patientId),
  byDoctor: (doctorId: string) => appointments.list((a) => a.doctorId === doctorId),
  async create(input: Omit<Appointment, 'id' | 'createdAt' | 'status'> & { id?: string }) {
    const row: Appointment = {
      ...input,
      id: input.id ?? newId('APT'),
      status: 'upcoming',
      createdAt: isoNow(),
    }
    const saved = await appointments.put(row)
    audit.emit({
      action: 'reception_registered',
      resource: 'appointment',
      resourceId: saved.id,
      detail: `Appointment booked for ${saved.patientId} with ${saved.doctorName} on ${saved.date} ${saved.time}`,
    })
    return saved
  },
  async updateStatus(id: string, status: Appointment['status']) {
    return appointments.patch(id, { status })
  },
  _table: appointments,
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- appointments.test.ts`
Expected: `3 passed`.

- [ ] **Step 5: Export it from the public API surface**

Modify `src/lib/api/index.ts` — add one line, alphabetically among the other exports (after the `Bills` export):

```ts
export { Appointments, AppointmentSchema } from './appointments'
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/appointments.ts src/lib/api/index.ts src/lib/api/__tests__/appointments.test.ts
git commit -m "feat: add appointments repository module"
```

---

### Task 7: `POST /api/admin/staff` — the one privileged endpoint this phase needs

**Files:**
- Create: `src/lib/api/profiles.ts`
- Create: `src/app/api/admin/staff/route.ts`
- Test: `src/lib/api/__tests__/profiles.test.ts`
- Test: `src/app/api/admin/staff/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdminClient` (Task 4).
- Produces: `POST /api/admin/staff` accepting `{email, password, role, fullName, department?, specialization?, phone?}`, returning the created `profiles` row or a `{error}` body with an appropriate status.

- [ ] **Step 1: Write the failing test for the `profiles` helper module**

Create `src/lib/api/__tests__/profiles.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { Profiles } from '@/lib/api/profiles'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

let createdUserId: string | undefined

afterEach(async () => {
  if (createdUserId) {
    const admin = getSupabaseAdminClient()
    await admin.from('profiles').delete().eq('id', createdUserId)
    await admin.auth.admin.deleteUser(createdUserId)
    createdUserId = undefined
  }
})

describe('Profiles.createStaff', () => {
  it('creates an auth user and a matching profiles row', async () => {
    const result = await Profiles.createStaff({
      email: 'profiles-test-doctor@example.com', password: 'Test-Pass-123!',
      role: 'doctor', fullName: 'Profiles Test Doctor', department: 'General Medicine',
    })
    createdUserId = result.id
    expect(result.role).toBe('doctor')
    expect(result.fullName).toBe('Profiles Test Doctor')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- profiles.test.ts`
Expected: FAIL with `Cannot find module '@/lib/api/profiles'`.

- [ ] **Step 3: Implement `profiles.ts`**

Create `src/lib/api/profiles.ts`:

```ts
/* Profiles — staff identity + role. Created only via the service-role admin
 * client (Profiles.createStaff), never by a direct client-side insert. */
import { z } from 'zod'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export const StaffRole = z.enum(['doctor', 'nurse', 'pharmacy', 'lab', 'radiology', 'reception', 'admin'])

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  role: StaffRole,
  fullName: z.string(),
  department: z.string().optional(),
  specialization: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
})
export type Profile = z.infer<typeof ProfileSchema>

export const CreateStaffInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: StaffRole,
  fullName: z.string().min(1),
  department: z.string().optional(),
  specialization: z.string().optional(),
  phone: z.string().optional(),
})
export type CreateStaffInput = z.infer<typeof CreateStaffInput>

export const Profiles = {
  async createStaff(input: CreateStaffInput): Promise<Profile> {
    const parsed = CreateStaffInput.parse(input)
    const admin = getSupabaseAdminClient()

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: parsed.email, password: parsed.password, email_confirm: true,
    })
    if (userError || !userData.user) {
      throw new Error(`Failed to create staff account: ${userError?.message ?? 'unknown error'}`)
    }

    const { data: profileRow, error: profileError } = await admin
      .from('profiles')
      .insert({
        id: userData.user.id,
        role: parsed.role,
        full_name: parsed.fullName,
        department: parsed.department,
        specialization: parsed.specialization,
        phone: parsed.phone,
      })
      .select()
      .single()

    if (profileError) {
      await admin.auth.admin.deleteUser(userData.user.id)
      throw new Error(`Failed to create profile row: ${profileError.message}`)
    }

    return {
      id: profileRow.id,
      role: profileRow.role,
      fullName: profileRow.full_name,
      department: profileRow.department ?? undefined,
      specialization: profileRow.specialization ?? undefined,
      phone: profileRow.phone ?? undefined,
      isActive: profileRow.is_active,
      createdAt: profileRow.created_at,
    }
  },
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- profiles.test.ts`
Expected: `1 passed`.

- [ ] **Step 5: Write the failing test for the Route Handler**

Create `src/app/api/admin/staff/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/admin/staff/route'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

let createdUserId: string | undefined

afterEach(async () => {
  if (createdUserId) {
    const admin = getSupabaseAdminClient()
    await admin.from('profiles').delete().eq('id', createdUserId)
    await admin.auth.admin.deleteUser(createdUserId)
    createdUserId = undefined
  }
})

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/staff', () => {
  it('creates a staff login and returns the profile', async () => {
    const res = await POST(jsonRequest({
      email: 'route-test-nurse@example.com', password: 'Test-Pass-123!',
      role: 'nurse', fullName: 'Route Test Nurse',
    }))
    expect(res.status).toBe(201)
    const body = await res.json()
    createdUserId = body.id
    expect(body.role).toBe('nurse')
  })

  it('returns 400 for an invalid body', async () => {
    const res = await POST(jsonRequest({ email: 'not-an-email', role: 'nurse' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- route.test.ts`
Expected: FAIL with `Cannot find module '@/app/api/admin/staff/route'`.

- [ ] **Step 7: Implement the Route Handler**

Create `src/app/api/admin/staff/route.ts`:

```ts
import { CreateStaffInput, Profiles } from '@/lib/api/profiles'

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null)
  const parsed = CreateStaffInput.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 })
  }

  try {
    const profile = await Profiles.createStaff(parsed.data)
    return Response.json(profile, { status: 201 })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- route.test.ts`
Expected: `2 passed`.

- [ ] **Step 9: Run the entire test suite**

Run: `npm test`
Expected: every test file passes, 0 failures.

- [ ] **Step 10: Commit**

```bash
git add src/lib/api/profiles.ts src/app/api/admin/staff/ src/lib/api/__tests__/profiles.test.ts
git commit -m "feat: add staff account creation (Profiles.createStaff + /api/admin/staff route)"
```

---

## What this plan deliberately does not do

- **No UI/store wiring.** `usePatientStore`, `useAuthStore`, and every other Zustand store are untouched and keep working exactly as they do today, against `localStorage`. That rewiring is Phase 2+ (starting with Nurse vitals per the rollout order), once this foundation is verified solid.
- **No login page.** Real Supabase Auth sign-in exists (staff accounts can be created and authenticated), but no UI calls it yet.
- **No `nurse`/`lab`/`radiology`/`pharmacy` RLS policies on `visits`/`appointments`** beyond what's already granted to `reception`/`admin`/the assigned `doctor` — those roles' policies are added in their own phases, when there's an actual worklist query to authorize.
- **No `vitals_readings`, `journey_events`, or `notifications` tables** — first needed in the Nurse-vitals phase (the `record_vitals` RPC needs all three); adding them now would be schema speculation ahead of the code that uses them.

## Next step after this plan ships

Once all 7 tasks are committed and `npm test` passes clean, the next plan (`writing-plans` again, scoped to Phase 2) covers: a real login page wired to Supabase Auth, `record_vitals` RPC + `vitals_readings`/`journey_events`/`notifications` tables, and rewiring `usePatientStore`/`useAuthStore` to call through `src/lib/api` instead of `localStorage` directly.
