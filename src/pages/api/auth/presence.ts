import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ ok: false, error: "AUTH_REQUIRED" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_at: now })
      .eq("id", authData.user.id);

    if (error) {
      console.warn("Presence update failed:", error.code);
      return new Response(JSON.stringify({ ok: false, error: "PRESENCE_UPDATE_FAILED" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    return new Response(JSON.stringify({ ok: true, last_seen_at: now }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Presence endpoint failed:", error);
    return new Response(JSON.stringify({ ok: false, error: "PRESENCE_UNAVAILABLE" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
};
