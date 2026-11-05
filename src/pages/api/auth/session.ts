import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return new Response(JSON.stringify({ ok: true, user: null }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: Boolean(data.user.email_confirmed_at),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Supabase session check failed:", error);
    return new Response(JSON.stringify({ ok: false, error: "AUTH_UNAVAILABLE" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
};
