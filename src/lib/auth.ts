import { supabaseServer } from './supabase-server'

export async function getRenanimeUser(token: string | undefined) {
  if (!token) {
    console.error('Renanime session: missing session cookie')
    return null
  }

  const { data, error } = await supabaseServer.rpc('renanime_session', {
    p_token: token,
  })

  if (error) {
    console.error('Renanime session RPC error:', error.message)
    return null
  }

  if (!data) {
    console.error('Renanime session: RPC returned no user')
    return null
  }

  return data as {
    id: string
    name: string
    aka: string
    recovery_code?: string
    created_at?: string
  }
}
