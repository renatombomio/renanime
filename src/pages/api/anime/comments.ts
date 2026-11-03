import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validAnimeId(value: string | null) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  if (idsParam !== null) {
    const animeIds = [...new Set(idsParam.split(",").map((value) => validAnimeId(value)))];
    if (!animeIds.length || animeIds.length > 100 || animeIds.some((id) => id === null)) {
      return json({ ok: false, error: "INVALID_ANIME_IDS" }, 400);
    }

    try {
      const supabase = createSupabaseSsrClient(request, cookies);
      const results = await Promise.all(animeIds.map(async (animeId) => {
        const { count, error } = await supabase
          .from("anime_comments")
          .select("id", { count: "exact", head: true })
          .eq("anime_id", animeId);
        if (error) throw error;
        return [String(animeId), count ?? 0] as const;
      }));
      return json({ ok: true, counts: Object.fromEntries(results) });
    } catch (error) {
      console.warn("Anime comment counts read failed:", error);
      return json({ ok: false, error: "COMMENT_COUNTS_UNAVAILABLE" }, 503);
    }
  }

  const animeId = validAnimeId(url.searchParams.get("animeId"));
  if (!animeId) return json({ ok: false, error: "INVALID_ANIME_ID" }, 400);

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const [{ data: authData }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("anime_comments")
        .select("id, anime_id, user_id, content, created_at, updated_at, profiles(name, aka, avatar_url)")
        .eq("anime_id", animeId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (error) {
      console.warn("Anime comments read failed:", error.code);
      return json({ ok: false, error: "COMMENTS_UNAVAILABLE" }, 503);
    }

    return json({ ok: true, comments: data ?? [], viewerId: authData.user?.id ?? null });
  } catch (error) {
    console.error("Anime comments read failed:", error);
    return json({ ok: false, error: "COMMENTS_UNAVAILABLE" }, 503);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { animeId?: unknown; content?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  const animeId = Number(body.animeId);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!Number.isInteger(animeId) || animeId <= 0) return json({ ok: false, error: "INVALID_ANIME_ID" }, 400);
  if (!content || content.length > 1000) return json({ ok: false, error: "INVALID_COMMENT" }, 400);

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { error } = await supabase.from("anime_comments").insert({
      anime_id: animeId,
      user_id: authData.user.id,
      content,
    });
    if (error) {
      console.warn("Anime comment create failed:", error.code);
      return json({ ok: false, error: "COMMENT_CREATE_FAILED" }, 503);
    }
    return json({ ok: true }, 201);
  } catch (error) {
    console.error("Anime comment create failed:", error);
    return json({ ok: false, error: "COMMENT_CREATE_FAILED" }, 503);
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  let body: { id?: unknown; content?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  const id = typeof body.id === "string" ? body.id : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !content || content.length > 1000) {
    return json({ ok: false, error: "INVALID_COMMENT" }, 400);
  }

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { data, error } = await supabase.from("anime_comments")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", authData.user.id)
      .select("id")
      .maybeSingle();
    if (error) return json({ ok: false, error: "COMMENT_UPDATE_FAILED" }, 503);
    if (!data) return json({ ok: false, error: "COMMENT_NOT_FOUND" }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("Anime comment update failed:", error);
    return json({ ok: false, error: "COMMENT_UPDATE_FAILED" }, 503);
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  let body: { id?: unknown };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "INVALID_REQUEST" }, 400); }

  const id = typeof body.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: "INVALID_COMMENT_ID" }, 400);

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const { data, error } = await supabase.from("anime_comments")
      .delete()
      .eq("id", id)
      .eq("user_id", authData.user.id)
      .select("id")
      .maybeSingle();
    if (error) return json({ ok: false, error: "COMMENT_DELETE_FAILED" }, 503);
    if (!data) return json({ ok: false, error: "COMMENT_NOT_FOUND" }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("Anime comment delete failed:", error);
    return json({ ok: false, error: "COMMENT_DELETE_FAILED" }, 503);
  }
};
