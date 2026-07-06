# Phase 4 — Laboratory: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full rich lab workflow — specimen collection, bench claiming, result entry, verification, microbiology, reflex tests — persist to Postgres end-to-end, with the doctor's real `orders` table (Phase 3) as the single source of truth for what was ordered (no more parallel, disconnected order-creation path).

**Architecture:** `src/store/useLabOrdersStore.ts` (1058 lines) is the existing, fully-built, localStorage-backed rich client model — `LabOrder`/`Specimen`/`TestRun`/`AnalyteResult`/`MicrobioResult`/`ReflexSuggestion` — already wired to every page under `src/app/lab/*`. This phase adds new Postgres tables shaped to mirror that model (not the simpler, separate `src/lib/api/lab.ts` `LabResultSchema`, which stays untouched and unrelated), new repository modules, and additive guarded bridges into the store's existing actions — following the exact pattern proven across Phases 2-3.

**Tech Stack:** Same as prior phases.

## Global Constraints

- **Guard pattern, no exceptions**: every real write is `const { data: { session } } = await getSupabaseClient().auth.getSession(); if (session) { ... }`. Never `useAuthStore`. Use `withLiveSession`-style helper if one is being extracted/exists — check `src/app/doctor/dashboard/page.tsx` for the established shape and consider whether a shared, cross-portal helper (in a new file, e.g. `src/lib/withLiveSession.ts`) is now warranted, since this phase adds many more call sites across a different file/portal.
- **RLS scoped to the real need.** Lab-role write access should be scoped by bench/status ownership where it makes sense (e.g. a lab tech claiming a test writes `assigned_to = auth.uid()`), not blanket role-only grants — apply the same discipline that Phase 2/3 reviews enforced.
- **Don't invent competing schemas for what already exists.** `orders` (Phase 3) is the doctor's order-of-record — do not create a second "lab order" concept; new tables reference `orders(id)`, they don't duplicate it.
- Every real backend write is additive — the existing `useLabOrdersStore` local behavior (including its cross-tab localStorage merge logic) keeps working exactly as it does today; a real write is attempted alongside it, wrapped in try/catch, never breaking local UX on failure.
- Use PowerShell for all commands. Do not commit until told to. Credentials in `.env.local`. Branch `feat/backend-supabase-integration` (confirm with `git branch --show-current` first).
- **Before writing any task's code, read the actual current file** — this plan was written from a research pass, not a guaranteed-current read; every prior phase found real drift between research snapshots and actual files by execution time.

---

### Task 1: `lab_specimens` / `lab_tests` / `lab_reflex_suggestions` schema + RLS

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_laboratory_schema.sql`
- Test: `src/lib/supabase/__tests__/laboratory-schema.test.ts`

**Before writing the migration, read `src/store/useLabOrdersStore.ts` in full** (already researched, but re-verify) for the exact current shape of `Specimen`, `TestRun`, `AnalyteResult`, `MicrobioResult`, `ReflexSuggestion`, `TestStatus`, `SpecimenType`, `Bench`, `Priority`, `RejectReason`, `MicroPhase`.

- [ ] **Step 1: Write the failing test** (same `information_schema.columns` pattern as every prior schema task in this project — see `doctor-consultation-schema.test.ts` for the exact idiom to copy)

- [ ] **Step 2: Run it, confirm it fails**

- [ ] **Step 3: Write the migration.** Structure (verify every enum value and column against the real store before finalizing):

```sql
create type lab_specimen_type_t as enum (/* copy SpecimenType's real values */);
create type lab_test_status_t as enum (
  'awaiting_collection','collected','on_bench','in_progress',
  'entered','verified','released','rejected','recollect_requested'
);
create type lab_reject_reason_t as enum (/* copy RejectReason's real values */);
create type lab_bench_t as enum (/* copy Bench's real values, e.g. Haematology/Biochemistry/Immunology/Urine/Microbiology/... */);

create table lab_specimens (
  id             text primary key,               -- accession, e.g. 'ACC-1042'
  order_id       text not null references orders(id),
  type           lab_specimen_type_t not null,
  container      text not null,
  collected_by   uuid references profiles(id),
  collected_at   timestamptz,
  reject_reason  lab_reject_reason_t
);
create index lab_specimens_order_idx on lab_specimens(order_id);

create table lab_tests (
  id                text primary key,             -- 'LT-...'
  order_id          text not null references orders(id),
  specimen_id       text references lab_specimens(id),
  code              text not null,
  name              text not null,
  bench             lab_bench_t not null,
  priority          text not null default 'Routine',
  status            lab_test_status_t not null default 'awaiting_collection',
  assigned_to       uuid references profiles(id),
  entered_by        uuid references profiles(id),
  verified_by       uuid references profiles(id),
  expected_tat_min  integer not null default 60,
  ordered_at        timestamptz not null default now(),
  released_at       timestamptz,
  analytes          jsonb not null default '[]',   -- AnalyteResult[]
  micro             jsonb,                          -- MicrobioResult | null
  callback          jsonb,                          -- callback record | null
  updated_at        timestamptz not null default now()
);
create index lab_tests_order_idx on lab_tests(order_id);
create index lab_tests_active_idx on lab_tests(status) where status not in ('released','rejected');
create index lab_tests_assigned_idx on lab_tests(assigned_to) where assigned_to is not null;

create table lab_reflex_suggestions (
  id                text primary key,
  based_on_test_id  text not null references lab_tests(id),
  code              text not null,
  reason            text not null,
  ordered_at        timestamptz,
  created_at        timestamptz not null default now()
);

alter table lab_specimens enable row level security;
alter table lab_tests enable row level security;
alter table lab_reflex_suggestions enable row level security;

-- Lab role: full read/write on all three (bench routing means any lab tech may need
-- to see/act on any bench's work, per the existing store's incharge-command-center
-- and cross-bench visibility) — but NEVER blanket without a role check.
create policy lab_specimens_all_lab on lab_specimens for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab','admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab','admin')));
create policy lab_tests_all_lab on lab_tests for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab','admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab','admin')));
create policy lab_reflex_all_lab on lab_reflex_suggestions for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab','admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('lab','admin')));

-- Doctor: read-only, own patients' tests (via the orders table they own).
create policy lab_tests_select_doctor on lab_tests for select
  using (exists (select 1 from orders o where o.id = lab_tests.order_id and o.doctor_id = auth.uid()));
```

Note: unlike the nurse-visits policy in Phase 2 (narrowly scoped to one status transition because a nurse's real need was exactly one field on someone else's row), lab staff genuinely need broad read/write across the whole bench workflow (claim, enter, verify, release — different lab techs touching the same test at different lifecycle stages, per the existing store's own cross-tech design). Role-scoped `for all` is the right shape here, analogous to Phase 3's doctor policy reasoning — but if a reviewer disagrees, that's the moment to revisit, not something to force through unquestioned.

- [ ] **Step 4: Apply, verify test passes, run full suite, stage**

---

### Task 2: `LabTests` / `LabSpecimens` repository modules

**Files:**
- Create: `src/lib/api/lab-tests.ts`, `src/lib/api/lab-specimens.ts`
- Modify: `src/lib/api/index.ts`
- Test: `src/lib/api/__tests__/lab-tests.test.ts`, `src/lib/api/__tests__/lab-specimens.test.ts`

Follow the established module shape (see `orders.ts`/`admission-requests.ts` for the pattern: zod schema mirroring the migration's columns, `table<T>('table_name', Schema)`, an exported object with `list`/`get`/domain-filter methods plus the specific mutation methods this phase's UI bridges will need — at minimum: `LabTests.{byOrder, create, claim, unclaim, enterAnalyte, finishEntry, verify, release, reject, microAdvance, microRelease}` and `LabSpecimens.{byOrder, create, collect, reject}` — read `useLabOrdersStore.ts`'s actual action signatures first and mirror what each one actually needs to persist, don't invent a different shape).

- [ ] Write failing tests, implement both modules, pass, export from `index.ts`, full suite, stage.

---

### Task 3: Bridge order creation — materialize real `lab_tests`/`lab_specimens` when a doctor orders a lab test ("order rewire")

**Files:**
- Modify: `src/app/doctor/dashboard/page.tsx` — `dispatchLabOrder` (already has an additive `Orders.create()` bridge from Phase 3; this task adds a follow-up step)

This is the most architecturally important task in this phase. Today, `dispatchLabOrder` writes a real `orders` row (kind='lab') but nothing materializes the actual test/specimen rows a lab tech would work against — `useLabOrdersStore.addOrder()` does that materialization **client-side only** (grouping test codes into specimens by type, creating `TestRun`s with `expectedTATmin`/`bench` looked up from `LAB_CATALOG`).

Read `useLabOrdersStore.addOrder()`'s real current implementation (the specimen-grouping/test-creation logic) and reproduce the equivalent server-side, immediately after Phase 3's existing `Orders.create()` call succeeds: for each ordered test code, resolve its `LAB_CATALOG` entry (bench, TAT, specimen type/container), group into `lab_specimens` by specimen type, create one `lab_tests` row per code referencing the real `order.id` and the matching specimen. Guarded by the same live session + `visitId` check already in place.

- [ ] Read real code, implement, verify via throwaway script (real doctor session, real order, confirm real `lab_tests`/`lab_specimens` rows materialize correctly grouped), full suite, stage.

---

### Task 4: Bridge specimen collection — `collectOrder`, `rejectSpecimen`, `recollectOrder`

**Files:**
- Modify: `src/store/useLabOrdersStore.ts` (these three actions)

Unlike the doctor-dashboard bridges (a page component), these live inside a Zustand store action, same as `usePatientStore`'s bridges in Phase 2 — same guarded pattern applies. Read the actual current implementations first. Add the guarded real-write (via `LabSpecimens.collect`/`LabTests` status updates) after each existing local `set(...)`, keyed off the real `order.id`/specimen accession (which should already match the real backend ids from Task 3's materialization, since specimen/test ids are created with the same scheme client and server side — confirm this alignment carefully, it's load-bearing for every subsequent bridge in this phase).

- [ ] Read, implement, verify, full suite, stage.

---

### Task 5: Bridge bench workflow — `claim`, `unclaim`, `enterAnalyte`, `finishEntry`, `analyzerAutoFeed`

**Files:**
- Modify: `src/store/useLabOrdersStore.ts`

`claim`/`unclaim` write `assigned_to`; scope the RLS-respecting write to use `session.user.id` as the claimant, matching whatever tech is actually signed in (not a `LabTech` object's arbitrary `id` field from local state, which may not be a real `profiles.id` — check this carefully, since the local `LabTech` type may use short ids like `'LT-101'` that don't correspond to real Supabase auth users; if so, the real bridge should use the SESSION's real uuid for `assigned_to`/`entered_by`/`verified_by`, while the local store keeps using its own display-friendly `LabTech` shape unchanged for UI purposes — same "local shape stays, backend field is the real actor id" pattern established in Phase 2/3).

`enterAnalyte`/`finishEntry`/`analyzerAutoFeed` update the `analytes` jsonb and status — bridge each additively.

- [ ] Read, implement, verify, full suite, stage.

---

### Task 6: Bridge verification chain — `verifyTest`, `releaseTest`, `rejectTest` (+ reflex auto-trigger)

**Files:**
- Modify: `src/store/useLabOrdersStore.ts`

`releaseTest` already triggers `evaluateReflex()` client-side and calls `pushReflex()` on match — when bridging `releaseTest`'s real write, also create the real `lab_reflex_suggestions` row for any reflex match, so Task 8's accept/dismiss bridge has something real to act on.

- [ ] Read, implement, verify (including a reflex-triggering test case), full suite, stage.

---

### Task 7: Bridge microbiology — `microAdvance`, `microRelease`

**Files:**
- Modify: `src/store/useLabOrdersStore.ts`

- [ ] Read, implement, verify, full suite, stage.

---

### Task 8: Bridge reflex actions — `orderReflex`, `dismissReflex`

**Files:**
- Modify: `src/store/useLabOrdersStore.ts`

`orderReflex` internally calls `addOrder()` again (creating a follow-up test) — trace whether this should also go through Task 3's real materialization path for consistency, or whether a simpler direct `LabTests.create` call is more appropriate here (the reflex order is for a single already-known test code, not a doctor's multi-item order) — use judgment, document the decision.

- [ ] Read, implement, verify, full suite, stage.

---

### Task 9 (if warranted after Task 5-8's review feedback): extract a shared guard helper for this file

Given Phase 3's final cleanup extracted `withLiveSession` for `doctor/dashboard/page.tsx`, and this phase adds 10+ more guarded call sites in a DIFFERENT file (`useLabOrdersStore.ts`), consider whether a shared, importable helper (e.g. `src/lib/withLiveSession.ts`, usable from both files) should be created now rather than duplicating the pattern inline across two files. Only do this as its own task after Tasks 4-8 are individually reviewed — don't preemptively abstract before the real shape of all the call sites is known.

---

## What this plan deliberately does not do

- **No changes to `src/lib/api/lab.ts`'s existing `LabResultSchema`/`Lab` module** — that stays exactly as it is, unrelated to this phase's new tables.
- **No QC/Westgard backend** (`useLabQCStore.ts`) — that's its own workflow, not part of "sample collection → test progress → results," deferred to a later cleanup or its own phase if needed.
- **No patient-portal read access** to lab results — that's the Patient Journey phase's trigger.
- **No changes to the analyzer-feed simulation's underlying deterministic-value generation** — only its status/analyte write-through gets bridged, not its RNG logic.

## Next step after this plan ships

Radiology (a similar rich workflow — studies, attachments, AI findings — likely with its own existing client store to reconcile with, per this phase's established research-first discipline), then Pharmacy, then OPD/IPD.
