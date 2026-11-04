import type { APIRoute } from "astro";

type TopEpisode = {
  mal_id?: number;
  title?: string;
  episode?: string;
  score?: number;
  scored_by?: number;
  url?: string;
};
type TopGroup = {
  entry?: {
    mal_id?: number;
    title?: string;
    images?: { webp?: { image_url?: string }; jpg?: { image_url?: string } };
    url?: string;
  };
  episodes?: TopEpisode[];
};
type EpisodeRecord = {
  mal_id?: number;
  aired?: string | null;
  title?: string;
  images?: { jpg?: { image_url?: string }; webp?: { image_url?: string } };
};

const TENRAI = "https://api.tenrai.org/v1";
const WEEK_START = "2026-11-02";
const WEEK_END = "2026-11-09";

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export const GET: APIRoute = async () => {
  const top = await getJson<{ data?: TopGroup[] }>(`${TENRAI}/top/episodes?limit=25`);
  const groups = Array.isArray(top?.data) ? top.data : [];
  const candidates = groups.flatMap((group) => {
    const anime = group.entry;
    if (!anime?.mal_id || !Array.isArray(group.episodes)) return [];
    return group.episodes.map((episode) => ({ anime, episode })).filter(({ episode }) =>
      typeof episode.mal_id === "number" && typeof episode.score === "number" && episode.score >= 9
    );
  });

  const animeIds = [...new Set(candidates.map(({ anime }) => anime.mal_id!))];
  const airedByAnime = new Map<number, Map<number, string>>();
  for (let index = 0; index < animeIds.length; index += 4) {
    const batch = animeIds.slice(index, index + 4);
    const results = await Promise.all(batch.map(async (animeId) => {
      const payload = await getJson<{ data?: EpisodeRecord[] }>(`${TENRAI}/anime/${animeId}/episodes?page=1`);
      const records = Array.isArray(payload?.data) ? payload.data : [];
      const map = new Map<number, string>();
      for (const record of records) {
        if (typeof record.mal_id !== "number" || !record.aired) continue;
        const date = record.aired.slice(0, 10);
        if (date >= WEEK_START && date < WEEK_END) map.set(record.mal_id, date);
      }
      return [animeId, map] as const;
    }));
    for (const [animeId, map] of results) airedByAnime.set(animeId, map);
  }

  const episodes = candidates.flatMap(({ anime, episode }) => {
    const aired = airedByAnime.get(anime.mal_id!)?.get(episode.mal_id!);
    if (!aired) return [];
    return [{
      id: `${anime.mal_id}-${episode.mal_id}`,
      animeId: anime.mal_id!,
      animeTitle: anime.title || "",
      animeUrl: anime.url || "",
      poster: anime.images?.webp?.image_url || anime.images?.jpg?.image_url || "",
      episodeNumber: episode.episode || "",
      episodeTitle: episode.title || "",
      score: episode.score!,
      votes: episode.scored_by || 0,
      aired,
      url: episode.url || anime.url || "",
    }];
  }).sort((a, b) => b.score - a.score || b.votes - a.votes).slice(0, 10);

  return new Response(JSON.stringify({
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    episodes,
    source: "Tenrai / MyAnimeList episode discussion polls",
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600",
    },
  });
};
