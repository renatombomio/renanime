import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../../lib/supabase-ssr";
export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const id = params.id;
    if (!id) return json({ ok: false, error: "INVALID_DEBATE" }, 400);
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    const { data: debate } = await supabase.from("community_debates").select("id").eq("id", id).eq("status", "published").maybeSingle();
    if (!debate) return json({ ok: false, error: "DEBATE_NOT_FOUND" }, 404);
    const { error } = await supabase.from("community_debate_likes").upsert({ debate_id: id, user_id: auth.user.id }, { onConflict: "debate_id,user_id", ignoreDuplicates: true });
    if (error) return json({ ok: false, error: "LIKE_FAILED" }, 503);
    const { count } = await supabase.from("community_debate_likes").select("id", { count: "exact", head: true }).eq("debate_id", id);
    return json({ ok: true, liked: true, count: count ?? 0 });
  } catch {
    return json({ ok: false, error: "LIKE_FAILED" }, 503);
  }
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  try {
    const id = params.id;
    if (!id) return json({ ok: false, error: "INVALID_DEBATE" }, 400);
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    const { error } = await supabase.from("community_debate_likes").delete().eq("debate_id", id).eq("user_id", auth.user.id);
    if (error) return json({ ok: false, error: "UNLIKE_FAILED" }, 503);
    const { count } = await supabase.from("community_debate_likes").select("id", { count: "exact", head: true }).eq("debate_id", id);
    return json({ ok: true, liked: false, count: count ?? 0 });
  } catch {
    return json({ ok: false, error: "UNLIKE_FAILED" }, 503);
  }
};
