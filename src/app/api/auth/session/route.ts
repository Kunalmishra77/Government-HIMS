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
