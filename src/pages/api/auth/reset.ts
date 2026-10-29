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
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "INVALID_EMAIL" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const redirectTo = new URL("/auth/callback?next=%2Flogin%2F%3Frecovery%3D1", request.url).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      console.warn("Supabase password reset request failed:", error.code ?? "UNKNOWN");
      // Return the same generic success response to avoid account enumeration.
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Supabase password reset setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
