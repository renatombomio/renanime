import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase logout failed:", error.message);
      return new Response(JSON.stringify({ ok: false, error: "LOGOUT_FAILED" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Supabase logout setup failed:", error);
    return new Response(JSON.stringify({ ok: false, error: "AUTH_UNAVAILABLE" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
};
