import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { provider?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  if (body.provider !== "google") {
    return json({ ok: false, error: "UNSUPPORTED_PROVIDER" }, 400);
  }

  let supabase;
  try {
    supabase = createSupabaseSsrClient(request, cookies);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Supabase OAuth client initialization failed:", errorName);
    return json(
      { ok: false, error: "AUTH_CLIENT_INIT_FAILED", stage: "client_initialization", errorName },
      503,
    );
  }

  const redirectTo = new URL(
    "/auth/callback?next=%2Flogin%2F%3Fcomplete-profile%3D1",
    request.url,
  ).toString();

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error) {
      const code = typeof error.code === "string" ? error.code : "SUPABASE_OAUTH_ERROR";
      const status = typeof error.status === "number" ? error.status : 503;
      console.warn("Supabase OAuth provider request failed:", { code, status });
      return json(
        { ok: false, error: "OAUTH_PROVIDER_ERROR", stage: "provider_request", code },
        503,
      );
    }

    if (!data.url) {
      console.error("Supabase OAuth returned no authorization URL.");
      return json(
        { ok: false, error: "OAUTH_URL_MISSING", stage: "provider_response" },
        503,
      );
    }

    return json({ ok: true, url: data.url });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Supabase OAuth request threw an exception:", errorName);
    return json(
      { ok: false, error: "OAUTH_REQUEST_FAILED", stage: "provider_request", errorName },
      503,
    );
  }
};
