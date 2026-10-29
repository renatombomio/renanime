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
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 128) {
    return json({ ok: false, error: "INVALID_PASSWORD" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: "RECOVERY_SESSION_REQUIRED" }, 401);
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.warn("Supabase password update failed:", error.code ?? "UNKNOWN");
      return json({ ok: false, error: "PASSWORD_UPDATE_FAILED" }, 400);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("Supabase password update setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
