-- Let signed-in staff read the DOCTOR roster.
--
-- Before this, profiles was readable only by admin (profiles_select_admin) or
-- the row's own owner (profiles_select_self). Reception therefore could not
-- list doctors, so its patient-registration doctor dropdown fell back to
-- hard-coded mock names (src/lib/opd.ts OPD_ROOMS) that match no real profile —
-- and the doctor dashboard, which filters its queue by
-- `patient.doctor === currentUser.name`, then showed a real doctor ZERO of the
-- patients reception "assigned" to them.
--
-- This adds a narrow SELECT policy: any authenticated user may read profile rows
-- whose role is 'doctor' (the on-duty roster). It does NOT expose nurses/other
-- staff rows, and INSERT/UPDATE remain admin/service-role only.
create policy profiles_select_doctors_staff on profiles
  for select to authenticated
  using (role = 'doctor');
