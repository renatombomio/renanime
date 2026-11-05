import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseSecretKey = import.meta.env.SUPABASE_SECRET_KEY

export const isSupabaseServerConfigured = Boolean(supabaseUrl && supabaseSecretKey)

export const supabaseServer = isSupabaseServerConfigured
  ? createClient(supabaseUrl!, supabaseSecretKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : new Proxy({} as ReturnType<typeof createClient>, {
      get() {
        throw new Error('Faltan las variables de entorno de Supabase en el servidor')
      },
    })
