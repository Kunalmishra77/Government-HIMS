-- Fix — tighten `radiology_studies_insert_doctor` (security review finding).
--
-- The prior migration (20260705040000_radiology_studies_insert_doctor.sql,
-- already applied to the live DB from Phase 5 Task 3) only constrained
-- `status`, `attachments`, `acquiring_by`, `reading_by`, `verified_by`,
-- `resident_read_by`, `released_at`, `acknowledged_at`, `ai_prelim` beyond
-- order ownership. Against the schema's full column list
-- (20260705030000_radiology_schema.sql), 16 other progression/audit columns
-- were left completely open to a doctor's raw-PostgREST INSERT while
-- `status = 'ordered'` is satisfied — most importantly `report_sections`,
-- the direct analog of Lab's `analytes` (already locked down for lab_tests
-- by 20260705020000_tighten_lab_tests_insert_doctor.sql), which a doctor's
-- INSERT could otherwise fill with a fully fabricated clinical report while
-- the study still reads as freshly ordered.
--
-- `report_sections` cannot be locked to a literal `'{}'::jsonb` the way
-- Lab's `analytes` was locked to `'[]'::jsonb`: the real bridge
-- (dispatchRadOrder in src/app/doctor/dashboard/page.tsx, via
-- RadiologyStudies.create() in src/lib/api/radiology-studies.ts) always
-- sends `reportSections: emptyReportSections(code)` — confirmed against
-- src/store/useRadiologyStudiesStore.ts's emptyReportSections(), which for
-- every known catalog code returns a NON-EMPTY object with the template's
-- real section keys each mapped to `''` (e.g.
-- `{history: '', technique: '', findings: '', impression: ''}`), only
-- falling back to `{}` for an unrecognised code. Locking to the literal
-- `'{}'::jsonb` would 403 every legitimate doctor-ordered study. The
-- correct invariant is values-based, not shape-based: every value in the
-- jsonb object must be an empty string, checked via
-- `jsonb_each_text`/`NOT EXISTS`, which is satisfied both by the real
-- non-empty-keys/empty-values shape and by the `{}` fallback.
--
-- The remaining 15 columns are tightened the same way Lab's tightening
-- migration and this table's own original migration already did: matched
-- exactly to what dispatchRadOrder's real payload sends (nothing) and thus
-- to each column's own Postgres default (unspecified => null for every
-- nullable column here; none of these 15 has a non-null default) —
-- `scheduled_for`, `arrived_at`, `acquired_at` (workflow timestamps),
-- `reported_at`/`verified_at`/`verification_level` (un-locked siblings of
-- the already-locked `released_at`/`verified_by`/`resident_read_by`),
-- `callback`/`escalation`/`distribution`/`dose_record`/`ai_findings`/
-- `quality_flags` (fabricable "already happened" jsonb records), and
-- `cancel_reason`/`no_show_risk`/`predicted_duration_min`/
-- `comparison_prior_id` (workflow/audit history that cannot legitimately
-- exist at doctor-order time).
--
-- `contrast_consented` is included too even though the reviewer's own
-- sketch omitted it: verified nullable with no default
-- (20260705030000_radiology_schema.sql line 50, `contrast_consented
-- boolean`), and confirmed NOT sent by RadiologyStudies.create()'s real
-- call site — consent is recorded later via
-- RadiologyStudies.setContrastConsented(), a separate radiology-role
-- action, never by the ordering doctor. Leaving it unlocked would repeat
-- the exact class of gap this migration exists to close, at zero
-- functional cost to the real flow.
--
-- `ward_bed`/`clinical_question`/`patient_id`/`patient_name`/`source`/
-- `doctor_name`/`payment_mode`/`code`/`name`/`modality`/`body_part`/
-- `priority`/`expected_tat_min`/`ordered_at` are deliberately left
-- unconstrained beyond ownership — these are the study's own descriptive/
-- clinical-context fields (the legitimate content of a doctor's order),
-- not progression/audit columns a doctor could use to fabricate history.
drop policy if exists radiology_studies_insert_doctor on radiology_studies;

create policy radiology_studies_insert_doctor on radiology_studies for insert
  with check (
    exists (select 1 from orders o where o.id = radiology_studies.order_id and o.doctor_id = auth.uid())
    and status = 'ordered'
    and scheduled_for is null
    and arrived_at is null
    and acquiring_by is null
    and acquired_at is null
    and attachments = '[]'::jsonb
    and reading_by is null
    and not exists (
      select 1 from jsonb_each_text(radiology_studies.report_sections) kv where kv.value <> ''
    )
    and ai_prelim is null
    and reported_at is null
    and verified_by is null
    and verified_at is null
    and released_at is null
    and callback is null
    and acknowledged_at is null
    and cancel_reason is null
    and no_show_risk is null
    and predicted_duration_min is null
    and dose_record is null
    and ai_findings is null
    and quality_flags is null
    and verification_level is null
    and resident_read_by is null
    and escalation is null
    and distribution is null
    and comparison_prior_id is null
    and contrast_consented is null
  );
