// Client-side read of the on-duty DOCTOR roster from real profiles.
//
// Reception's registration doctor dropdown used to offer only the static mock
// roster (src/lib/opd.ts OPD_ROOMS), whose names match no real profile — so a
// patient "assigned" to a doctor never appeared in that doctor's real queue
// (the doctor dashboard filters by `patient.doctor === currentUser.name`).
// This reads the actual signed-in doctors so reception can assign to a name the
// doctor dashboard will actually match.
//
// Gated by RLS (profiles_select_doctors_staff) to signed-in staff. Returns [] on
// any error / no session, so every caller can fall back to OPD_ROOMS with no
// regression.
import { getSupabaseClient } from '@/lib/supabase/client'

export type RealDoctor = { id: string; name: string; department: string }

export async function listActiveDoctors(): Promise<RealDoctor[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('id, full_name, department')
      .eq('role', 'doctor')
      .eq('is_active', true)
    if (error || !data) return []
    return data.map((d) => ({
      id: String(d.id),
      name: String(d.full_name),
      department: d.department ? String(d.department) : '',
    }))
  } catch {
    return []
  }
}
