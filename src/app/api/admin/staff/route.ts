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
