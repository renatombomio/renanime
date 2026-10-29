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

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const redirectTo = new URL("/auth/callback?next=%2F", request.url).toString();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      console.warn("Supabase OAuth could not start:", error?.code ?? "NO_URL");
      return json({ ok: false, error: "OAUTH_UNAVAILABLE" }, 503);
    }

    return json({ ok: true, url: data.url });
  } catch (error) {
    console.error("Supabase OAuth setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
