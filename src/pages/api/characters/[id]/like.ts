import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../../lib/supabase-ssr";

export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const characterId = Number(params.id);
  if (!Number.isInteger(characterId) || characterId <= 0) return json({ ok: false, error: "INVALID_CHARACTER_ID" }, 400);
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
    const { data: existing, error: lookupError } = await supabase.from("character_likes").select("id").eq("character_id", characterId).eq("user_id", auth.user.id).maybeSingle();
    if (lookupError) return json({ ok: false, error: "LIKE_LOOKUP_FAILED" }, 503);
    let liked = false;
    if (existing) {
      const { error } = await supabase.from("character_likes").delete().eq("id", existing.id).eq("user_id", auth.user.id);
      if (error) return json({ ok: false, error: "UNLIKE_FAILED" }, 503);
    } else {
      const { error } = await supabase.from("character_likes").insert({ character_id: characterId, user_id: auth.user.id });
      if (error && error.code !== "23505") return json({ ok: false, error: "LIKE_FAILED" }, 503);
      liked = true;
    }
    const { count, error } = await supabase.from("character_likes").select("id", { count: "exact", head: true }).eq("character_id", characterId);
    if (error) return json({ ok: false, error: "LIKE_COUNT_FAILED" }, 503);
    return json({ ok: true, liked, count: count ?? 0 });
  } catch {
    return json({ ok: false, error: "LIKE_FAILED" }, 503);
  }
};
