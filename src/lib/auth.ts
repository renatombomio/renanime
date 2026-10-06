import { supabaseServer } from './supabase-server'

export async function getRenanimeUser(token: string | undefined) {
  if (!token) return null

  const { data, error } = await supabaseServer.rpc('renanime_session', {
    p_token: token,
  })

  if (error || !data) return null

  return data as {
    id: string
    name: string
    aka: string
    recovery_code?: string
  }
}
