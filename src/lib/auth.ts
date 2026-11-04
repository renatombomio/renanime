import { supabaseServer } from './supabase-server'

export async function getRenanimeUser(token: string | undefined) {
  if (!token) {
    return null
  }

  // Public Preview environments may intentionally omit the privileged key.
  // Treat the request as unauthenticated instead of crashing every page load.
  if (!import.meta.env.PUBLIC_SUPABASE_URL || !import.meta.env.SUPABASE_SECRET_KEY) {
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
