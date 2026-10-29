import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { email?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password || email.length > 254 || password.length > 1024) {
    return json({ ok: false, error: "INVALID_CREDENTIALS" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Deliberately use one response for unknown email and incorrect password.
      return json({ ok: false, error: "INVALID_CREDENTIALS" }, 401);
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await supabase.auth.signOut();
      return json({ ok: false, error: "SESSION_CREATION_FAILED" }, 401);
    }

    return json({ ok: true, user: { id: userData.user.id, email: userData.user.email } });
  } catch (error) {
    console.error("Supabase login setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
