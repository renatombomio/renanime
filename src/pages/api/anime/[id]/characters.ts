import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseSsrClient } from "../../../../lib/supabase-ssr";

export const prerender = false;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const GET: APIRoute = async ({ request, cookies, params }) => {
  const animeId = Number(params.id);
  const page = Math.max(1, Math.min(100, Number(new URL(request.url).searchParams.get("page")) || 1));
  if (!Number.isInteger(animeId) || animeId <= 0) return json({ ok: false, error: "INVALID_ANIME_ID" }, 400);

  try {
    const supabase = createSupabaseSsrClient(request, cookies);
    const start = (page - 1) * 25;
    const { data: cachedRelations, error: cacheError } = await supabase.from("anime_characters").select("role,sort_order,characters(id,name,image_url)").eq("anime_id", animeId).gte("sort_order", start).lt("sort_order", start + 25).order("sort_order", { ascending: true });
    if (cacheError) return json({ ok: false, error: "CHARACTER_CACHE_READ_FAILED" }, 503);
    if (cachedRelations?.length) {
      const ids = cachedRelations.map((row: any) => row.characters?.id).filter(Boolean);
      const [{ data: auth }, { data: likeRows }] = await Promise.all([supabase.auth.getUser(), ids.length ? supabase.from("character_likes").select("character_id,user_id").in("character_id", ids) : Promise.resolve({ data: [] as any[] })]);
      const stats = new Map<number, { count: number; liked: boolean }>();
      for (const id of ids) stats.set(id, { count: 0, liked: false });
      for (const like of likeRows ?? []) { const stat = stats.get(like.character_id); if (stat) { stat.count++; if (auth.user?.id === like.user_id) stat.liked = true; } }
      const cachedCharacters = cachedRelations.map((row: any) => row.characters ? { ...row.characters, role: row.role, ...(stats.get(row.characters.id) ?? { count: 0, liked: false }) } : null).filter(Boolean);
      return json({ ok: true, characters: cachedCharacters, page, hasNextPage: cachedRelations.length === 25, total: null, cached: true });
    }
    const query = `query AnimeCharacters($id:Int!, $page:Int!, $perPage:Int!){
      Media(id:$id,type:ANIME){
        characters(page:$page,perPage:$perPage,sort:ROLE){
          pageInfo{hasNextPage currentPage total}
          edges{role node{id name{full} image{large}}}
        }
      }
    }`;
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: animeId, page, perPage: 25 } }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return json({ ok: false, error: "ANILIST_UNAVAILABLE" }, 502);
    const payload = await response.json();
    const connection = payload.data?.Media?.characters;
    if (!connection) return json({ ok: false, error: "CHARACTERS_NOT_FOUND" }, 404);

    const edges = (connection.edges ?? []).filter((edge: any) => edge?.node?.id && edge?.node?.name?.full);
    if (edges.length) {
      const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
      const secretKey = import.meta.env.SUPABASE_SECRET_KEY;
      if (!supabaseUrl || !secretKey) return json({ ok: false, error: "CATALOG_WRITE_NOT_CONFIGURED" }, 503);
      const catalogWriter = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const characters = edges.map((edge: any) => ({ id: edge.node.id, name: edge.node.name.full, image_url: edge.node.image?.large ?? null }));
      const relations = edges.map((edge: any, index: number) => ({ anime_id: animeId, character_id: edge.node.id, role: edge.role ?? null, sort_order: (page - 1) * 25 + index }));
      const { error: characterError } = await catalogWriter.from("characters").upsert(characters, { onConflict: "id" });
      if (characterError) return json({ ok: false, error: "CHARACTER_PERSIST_FAILED" }, 503);
      const { error: relationError } = await catalogWriter.from("anime_characters").upsert(relations, { onConflict: "anime_id,character_id" });
      if (relationError) return json({ ok: false, error: "CHARACTER_PERSIST_FAILED" }, 503);
    }
    const ids = edges.map((edge: any) => edge.node.id);
    const [{ data: stored }, { data: auth }] = await Promise.all([
      ids.length ? supabase.from("characters").select("id,name,image_url").in("id", ids) : Promise.resolve({ data: [] as any[] }),
      supabase.auth.getUser(),
    ]);
    const { data: relations } = ids.length
      ? await supabase.from("anime_characters").select("character_id,role").eq("anime_id", animeId).in("character_id", ids)
      : { data: [] as any[] };
    const { data: likeRows } = ids.length
      ? await supabase.from("character_likes").select("character_id,user_id").in("character_id", ids)
      : { data: [] as any[] };
    const storedById = new Map((stored ?? []).map((item: any) => [item.id, item]));
    const roleById = new Map((relations ?? []).map((item: any) => [item.character_id, item.role]));
    const likesById = new Map<number, { count: number; liked: boolean }>();
    for (const id of ids) likesById.set(id, { count: 0, liked: false });
    for (const like of likeRows ?? []) {
      const item = likesById.get(like.character_id);
      if (item) {
        item.count += 1;
        if (auth.user?.id === like.user_id) item.liked = true;
      }
    }
    const characters = ids.map((id: number) => {
      const item = storedById.get(id);
      return item ? { ...item, role: roleById.get(id) ?? null, ...(likesById.get(id) ?? { count: 0, liked: false }) } : null;
    }).filter(Boolean);

    return json({ ok: true, characters, page, hasNextPage: Boolean(connection.pageInfo?.hasNextPage), total: connection.pageInfo?.total ?? null });
  } catch {
    return json({ ok: false, error: "CHARACTERS_UNAVAILABLE" }, 503);
  }
};
