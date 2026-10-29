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
  let body: { aka?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_REQUEST" }, 400);
  }

  const aka = typeof body.aka === "string" ? body.aka.trim() : "";
  if (!/^[\p{L}\p{N}_-]{2,24}$/u.test(aka)) {
    return json({ ok: false, error: "INVALID_NICKNAME" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { error } = await supabase
      .from("profiles")
      .update({ aka, name: aka, updated_at: new Date().toISOString() })
      .eq("id", authData.user.id);

    if (error) {
      console.warn("Profile nickname update failed:", error.code ?? "UNKNOWN");
      return json({ ok: false, error: "PROFILE_UPDATE_FAILED" }, 400);
    }

    return json({ ok: true, profile: { aka } });
  } catch (error) {
    console.error("Profile setup failed:", error);
    return json({ ok: false, error: "AUTH_UNAVAILABLE" }, 503);
  }
};
