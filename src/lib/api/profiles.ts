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
