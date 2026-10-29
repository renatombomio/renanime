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
  let body: { email?: unknown; password?: unknown; aka?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const aka = typeof body.aka === "string" ? body.aka.trim() : "";

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "INVALID_EMAIL" }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ ok: false, error: "INVALID_PASSWORD" }, 400);
  }
  if (!/^[\p{L}\p{N}_-]{2,24}$/u.test(aka)) {
    return json({ ok: false, error: "INVALID_NICKNAME" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const emailRedirectTo = new URL("/auth/callback?next=%2Flogin%2F%3Fconfirmed%3D1", request.url).toString();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { name: aka, aka, display_name: aka },
      },
    });

    if (error) {
      // Do not reveal whether an email is already registered.
      console.warn("Supabase sign-up rejected:", error.code ?? "UNKNOWN");
      return json({ ok: false, error: "SIGNUP_FAILED" }, 400);
    }

    return json({
      ok: true,
      requiresEmailConfirmation: !data.session,
      message: "If registration can be completed, check your email for the next step.",
    });
  } catch (error) {
    console.error("Supabase registration setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
