import { RoleGuard } from "@/components/layout/RoleGuard"

// Bed assignment/admission-request transitions are RLS-authorized (see
// supabase/migrations/20260706013000_admission_requests_transitions.sql and
// 20260706011000_beds_schema.sql) for the real 'reception' and 'admin' roles
// only — 'bed_manager' is a legacy mock-only role string that does not exist
// in the real Postgres role_t enum and can never be assigned to a real
// Supabase-authenticated user, so gating on it made this page permanently
// unreachable by any real user.
export default function AdmissionLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRole={['reception', 'admin']}>{children}</RoleGuard>
}
