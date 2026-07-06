-- Reception AABHA/UHID workflow (Registration -> Aadhaar Pending -> AABHA ID
-- Creation -> UHID Generation -> "Send to Vitals") — bridges the pre-existing
-- local-only simulated Aadhaar/ABHA/UHID flow (src/lib/intake/aadhaar-mock.ts,
-- src/app/reception/register/page.tsx, src/components/reception/AadhaarAbhaFlow.tsx)
-- to real Postgres. Simulated/internal ID generator by design — no real
-- ABDM/NDHM integration.
--
-- "Aadhaar Pending" stays a DERIVED condition (visits.status = 'waiting' AND
-- patients.uhid is null), matching this project's established convention of
-- not adding a new enum value/status for a condition that a plain column
-- check already expresses (same pattern as every other phase here). No change
-- to visit_status_t.
--
-- uhid is nullable: not every patient has completed Aadhaar/ABHA verification
-- yet (self-check-in patients in particular — see the companion fix in
-- src/lib/intake/register.ts). The partial unique index below only enforces
-- uniqueness among patients that DO have one, so it doesn't reject the many
-- concurrent null rows.

alter table public.patients
  add column if not exists uhid text,
  add column if not exists abha_id text,
  add column if not exists aadhaar_verified boolean not null default false;

create unique index if not exists patients_uhid_unique_idx
  on public.patients (uhid)
  where uhid is not null;

-- patients_update_staff (20260703124735_rls_policies.sql) is `for update`
-- with no column list in `using`/`with check` — column-unrestricted grants in
-- Postgres automatically cover newly added columns, so reception/admin can
-- already write uhid/abha_id/aadhaar_verified through the existing policy.
-- Verified live against the project after applying this migration:
-- pg_policies confirms patients_update_staff's qual/with_check reference only
-- profiles.role (no column predicate), and information_schema.column_privileges
-- shows uhid/abha_id/aadhaar_verified carry the exact same
-- SELECT/INSERT/UPDATE/REFERENCES grants (per role) as every pre-existing
-- patients column — i.e. the table-level GRANT applies uniformly, with no
-- column-level REVOKE narrowing these three differently from the rest of the
-- table. No RLS change needed here.
