import type { APIRoute } from 'astro'
import { supabaseServer } from '../../../lib/supabase-server'

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const accessPassword = String(body.accessPassword ?? '')

    if (!accessPassword) {
      return new Response(JSON.stringify({ ok: false, error: 'MISSING_ACCESS_PASSWORD' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabaseServer.rpc('renanime_check_access', {
      p_access_password: accessPassword,
    })

    if (error) {
      console.error('Renanime access error:', error.message)

      // renanime_check_access intentionally uses INVALID_ACCESS_PASSWORD
      // for a wrong code. Normalize the RPC error so the UI can always
      // trigger the playful access-denied experience.
      return new Response(JSON.stringify({ ok: false, error: 'INVALID_ACCESS_PASSWORD' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      hasProfiles: Boolean(data?.has_profiles),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected access error:', error)
    return new Response(JSON.stringify({ ok: false, error: 'INVALID_REQUEST' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
