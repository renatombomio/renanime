import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60" } });

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const [likes, characters] = await Promise.all([
      supabase.from("character_like_totals").select("character_id,like_count,updated_at").order("like_count", { ascending: false }).limit(100),
      supabase.from("characters").select("id,name,image_url"),
    ]);
    if (likes.error || characters.error) return json({ ok: false, error: "RANKING_UNAVAILABLE" }, 503);
    const metadata = new Map((characters.data ?? []).map((item) => [item.id, item]));
    const ranking = (likes.data ?? []).map((row) => ({
      ...metadata.get(row.character_id),
      likes: Number(row.like_count) || 0,
      lastLike: row.updated_at,
    })).filter((item) => item.id).slice(0, 10);
    return json({ ok: true, ranking });
  } catch {
    return json({ ok: false, error: "RANKING_UNAVAILABLE" }, 503);
  }
};
