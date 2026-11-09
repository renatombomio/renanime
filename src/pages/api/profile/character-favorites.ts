import type { APIRoute } from "astro";
import { createSupabaseSsrClient } from "../../../lib/supabase-ssr";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);

    const params = new URL(request.url).searchParams;
    const offset = Math.max(0, Math.min(10000, Number(params.get("offset")) || 0));
    const limit = Math.max(1, Math.min(12, Number(params.get("limit")) || 12));

    const { data, error } = await supabase
      .from("character_likes")
      .select("character_id, created_at, characters(id, name, image_url, anime_characters(anime_id, role, sort_order))")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return json({ ok: false, error: "FAVOURITES_READ_FAILED" }, 503);

    const characters = (data ?? []).map((row: any) => {
      const character = Array.isArray(row.characters) ? row.characters[0] : row.characters;
      const mainRelation = (character?.anime_characters ?? []).slice().sort((a: any, b: any) =>
        (a.role === "MAIN" ? 0 : 1) - (b.role === "MAIN" ? 0 : 1) || a.sort_order - b.sort_order
      )[0];
      return character?.id && character?.name ? { ...character, anime_id: mainRelation?.anime_id ?? null } : null;
    }).filter(Boolean);

    const animeIds = [...new Set(characters.map((item: any) => item.anime_id).filter((id: any) => Number.isInteger(id)))];
    let titles: Record<number, string> = {};
    if (animeIds.length) {
      const variables: Record<string, number> = {};
      const fields = animeIds.map((id, index) => {
        variables["id" + index] = id;
        return "a" + index + ": Media(id: $id" + index + ", type: ANIME) { id title { romaji english } }";
      }).join("\n");
      const definitions = animeIds.map((_, index) => "$id" + index + ": Int!").join(", ");
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: "query CharacterAnimeTitles(" + definitions + ") { " + fields + " }", variables }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return json({ ok: false, error: "ANILIST_UNAVAILABLE" }, 502);
      const payload = await response.json();
      titles = Object.fromEntries(animeIds.map((id, index) => {
        const anime = payload.data?.["a" + index];
        return [id, anime?.title?.english || anime?.title?.romaji || ""];
      }).filter((entry: any) => entry[1]));
    }

    return json({
      ok: true,
      characters: characters.map((character: any) => ({
        id: character.id,
        name: character.name,
        image_url: character.image_url,
        anime_title: character.anime_id ? titles[character.anime_id] ?? "" : "",
      })),
      offset,
      nextOffset: offset + characters.length,
      hasMore: characters.length === limit,
    });
  } catch {
    return json({ ok: false, error: "FAVOURITES_UNAVAILABLE" }, 503);
  }
};
