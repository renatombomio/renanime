import { createClient } from '@supabase/supabase-js'

type SupabaseServerClient = ReturnType<typeof createClient>

let serverClient: SupabaseServerClient | undefined

function getServerClient(): SupabaseServerClient {
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

/**
 * Backwards-compatible lazy client: importing this module is safe in Preview.
 * The privileged client is created only when a server operation uses it.
 */
export const supabaseServer = new Proxy({} as SupabaseServerClient, {
  get(_target, property) {
    const client = getServerClient()
    const value = Reflect.get(client, property, client)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
