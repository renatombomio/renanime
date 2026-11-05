import type { APIRoute } from "astro";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Safe Preview diagnostic for the Supabase Auth connection.
 * Never returns project keys, tokens, or secrets.
 */
export const GET: APIRoute = async () => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey =
    import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return json(
      {
        ok: false,
        code: "SUPABASE_ENV_MISSING",
        hasUrl: Boolean(supabaseUrl),
        hasPublicKey: Boolean(supabaseKey),
      },
      503,
    );
  }

  let healthUrl: URL;
  try {
    healthUrl = new URL("/auth/v1/health", supabaseUrl);
  } catch {
    return json({ ok: false, code: "SUPABASE_URL_INVALID" }, 503);
  }

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { apikey: supabaseKey },
      signal: AbortSignal.timeout(8000),
    });

    return json(
      {
        ok: response.ok,
        code: response.ok ? "SUPABASE_REACHABLE" : "SUPABASE_HEALTH_ERROR",
        status: response.status,
        projectHost: healthUrl.host,
      },
      response.ok ? 200 : 503,
    );
  } catch (error) {
    return json(
      {
        ok: false,
        code: "SUPABASE_NETWORK_ERROR",
        errorName: error instanceof Error ? error.name : "UnknownError",
        projectHost: healthUrl.host,
      },
      503,
    );
  }
};
