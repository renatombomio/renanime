import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseIds(value: string | null): number[] {
  if (!value) return [];
  const ids = [...new Set(value.split(",").map((part) => Number(part.trim())))];
  if (ids.length > 24 || ids.some((id) => !Number.isInteger(id) || id <= 0)) return [];
  return ids;
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const ids = parseIds(new URL(request.url).searchParams.get("ids"));
  if (!ids.length) return json({ ok: false, error: "INVALID_ANIME_IDS" }, 400);
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("anime_likes").select("anime_id,user_id").in("anime_id", ids);
    if (error) {
      console.warn("Anime likes read failed:", error.code);
      return json({ ok: false, error: "LIKES_UNAVAILABLE" }, 503);
    }
    const likes: Record<number, {count:number;liked:boolean}> = {};
    ids.forEach((id) => { likes[id] = { count: 0, liked: false }; });
    (data ?? []).forEach((row) => {
      likes[row.anime_id].count += 1;
      if (authData.user && row.user_id === authData.user.id) likes[row.anime_id].liked = true;
    });
    return json({ ok: true, likes });
  } catch (error) {
    console.error("Anime likes read failed:", error);
    return json({ ok: false, error: "LIKES_UNAVAILABLE" }, 503);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { animeId?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }
  const animeId = Number(body.animeId);
  if (!Number.isInteger(animeId) || animeId <= 0) return json({ ok: false, error: "INVALID_ANIME_ID" }, 400);

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { data: existing, error: existingError } = await supabase.from("anime_likes")
      .select("id").eq("user_id", authData.user.id).eq("anime_id", animeId).maybeSingle();
    if (existingError) return json({ ok: false, error: "LIKE_LOOKUP_FAILED" }, 503);

    let liked = false;
    if (existing) {
      const { error } = await supabase.from("anime_likes").delete().eq("id", existing.id).eq("user_id", authData.user.id);
      if (error) return json({ ok: false, error: "LIKE_REMOVE_FAILED" }, 503);
    } else {
      const { error } = await supabase.from("anime_likes").insert({ user_id: authData.user.id, anime_id: animeId });
      if (error && error.code !== "23505") return json({ ok: false, error: "LIKE_CREATE_FAILED" }, 503);
      liked = true;
    }

    const { count, error: countError } = await supabase.from("anime_likes")
      .select("id", { count: "exact", head: true }).eq("anime_id", animeId);
    if (countError) return json({ ok: false, error: "LIKE_COUNT_FAILED" }, 503);
    return json({ ok: true, liked, count: count ?? 0 });
  } catch (error) {
    console.error("Anime like toggle failed:", error);
    return json({ ok: false, error: "LIKE_UPDATE_FAILED" }, 503);
  }
};
