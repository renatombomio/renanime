import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../lib/supabase-ssr";
export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  try {
    const id = params.id;
    if (!id) return json({ ok: false, error: "INVALID_DEBATE" }, 400);
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    const { data, error } = await supabase.from("community_debates").delete().eq("id", id).eq("author_id", auth.user.id).select("id").maybeSingle();
    if (error) return json({ ok: false, error: "DELETE_FAILED" }, 503);
    if (!data) return json({ ok: false, error: "NOT_OWNER_OR_NOT_FOUND" }, 404);
    return json({ ok: true, id: data.id });
  } catch {
    return json({ ok: false, error: "DELETE_FAILED" }, 503);
  }
};
