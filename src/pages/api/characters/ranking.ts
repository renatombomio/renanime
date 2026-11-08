import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60" } });

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const [likes, characters] = await Promise.all([
      supabase.from("character_likes").select("character_id,created_at").order("created_at", { ascending: false }).range(0, 9999),
      supabase.from("characters").select("id,name,image_url"),
    ]);
    if (likes.error || characters.error) return json({ ok: false, error: "RANKING_UNAVAILABLE" }, 503);
    const stats = new Map<number, { likes: number; lastLike: string }>();
    for (const row of likes.data ?? []) {
      const current = stats.get(row.character_id) ?? { likes: 0, lastLike: row.created_at };
      current.likes += 1;
      if (new Date(row.created_at).getTime() > new Date(current.lastLike).getTime()) current.lastLike = row.created_at;
      stats.set(row.character_id, current);
    }
    const metadata = new Map((characters.data ?? []).map((item) => [item.id, item]));
    const ranking = [...stats.entries()].map(([id, value]) => ({ ...metadata.get(id), likes: value.likes, lastLike: value.lastLike }))
      .filter((item) => item.id)
      .sort((a, b) => b.likes - a.likes || new Date(b.lastLike).getTime() - new Date(a.lastLike).getTime())
      .slice(0, 10);
    return json({ ok: true, ranking });
  } catch {
    return json({ ok: false, error: "RANKING_UNAVAILABLE" }, 503);
  }
};
