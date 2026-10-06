import type { APIRoute } from 'astro'
import { supabaseServer } from '../../../lib/supabase-server'

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json()
    const accessPassword = String(body.accessPassword ?? '')
    const recoveryCode = String(body.recoveryCode ?? '').trim()

    if (!accessPassword || !recoveryCode) {
      return new Response(
        JSON.stringify({ ok: false, error: 'MISSING_FIELDS' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const { data, error } = await supabaseServer.rpc('renanime_recover', {
      p_access_password: accessPassword,
      p_recovery_code: recoveryCode,
    })

    if (error) {
      if (error.message.includes('INVALID_ACCESS_PASSWORD')) {
        return new Response(
          JSON.stringify({ ok: false, error: 'INVALID_ACCESS_PASSWORD' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (error.message.includes('INVALID_RECOVERY_CODE')) {
        return new Response(
          JSON.stringify({ ok: false, error: 'INVALID_RECOVERY_CODE' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      console.error('Renanime recovery error:', error.message)

      return new Response(
        JSON.stringify({ ok: false, error: 'LOGIN_FAILED' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (!data?.session_token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'SESSION_CREATION_FAILED' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    cookies.set('renanime_session', data.session_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: data.id,
          name: data.name,
          aka: data.aka,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected recovery error:', error)

    return new Response(
      JSON.stringify({ ok: false, error: 'INVALID_REQUEST' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
