import { createClient } from '@supabase/supabase-js'

let serverClient: ReturnType<typeof createClient> | undefined

/**
 * Privileged client is initialized only by server operations that need it.
 * Importing this module does not require an admin secret, so public pages
 * and Preview builds can render without SUPABASE_SECRET_KEY.
 */
export function getSupabaseServer() {
  if (serverClient) return serverClient

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
  const supabaseSecretKey = import.meta.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Esta operación requiere SUPABASE_SECRET_KEY en este entorno')
  }

  serverClient = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return serverClient
}
