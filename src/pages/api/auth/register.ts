import type { APIRoute } from 'astro'
import { supabaseServer } from '../../../lib/supabase-server'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json()
    const accessPassword = String(body.accessPassword ?? '')
    const name = String(body.name ?? '').trim()
    const aka = String(body.aka ?? '').trim()

    if (!accessPassword || !name || !aka) {
      return new Response(JSON.stringify({ ok: false, error: 'INVALID_PROFILE' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabaseServer.rpc('renanime_register', {
      p_access_password: accessPassword,
      p_name: name,
      p_aka: aka,
    })

    if (error) {
      if (error.message.includes('INVALID_ACCESS_PASSWORD')) {
        return new Response(JSON.stringify({ ok: false, error: 'INVALID_ACCESS_PASSWORD' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (error.message.includes('INVALID_PROFILE')) {
        return new Response(JSON.stringify({ ok: false, error: 'INVALID_PROFILE' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      console.error('Renanime registration error:', error.message)
      return new Response(JSON.stringify({ ok: false, error: 'REGISTER_FAILED' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!data?.session_token || !data?.recovery_code) {
      return new Response(JSON.stringify({ ok: false, error: 'REGISTRATION_FAILED' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    cookies.set('renanime_session', data.session_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return new Response(JSON.stringify({
      ok: true,
      recoveryCode: data.recovery_code,
      user: {
        id: data.id,
        name: data.name,
        aka: data.aka,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unexpected registration error:', error)
    return new Response(JSON.stringify({ ok: false, error: 'INVALID_REQUEST' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
