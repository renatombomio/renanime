import type { APIRoute } from "astro";

type TopEpisode = {
  mal_id?: number;
  title?: string;
  url?: string;
  score?: number;
  scored_by?: number;
  anime?: {
    mal_id?: number;
    title?: string;
    url?: string;
    images?: { webp?: { image_url?: string }; jpg?: { image_url?: string } };
  };
};
type EpisodeRecord = {
  mal_id?: number;
  aired?: string | null;
  title?: string;
  episode?: string;
};
const TENRAI = "https://api.tenrai.org/v1";
function getCurrentWeekRange() {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  return {
    start: monday.toISOString().slice(0, 10),
    end: nextMonday.toISOString().slice(0, 10),
  };
}

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
  const { start: WEEK_START, end: WEEK_END } = getCurrentWeekRange();
  // Tenrai follows the Jikan v4 shape: each top episode contains its anime in `anime`.
  const top = await getJson<{ data?: TopEpisode[] }>(`${TENRAI}/top/episodes?limit=25&page=1`);
  const topEpisodes = Array.isArray(top?.data) ? top.data : [];
  const candidates = topEpisodes.filter((episode) =>
    typeof episode.mal_id === "number" &&
    typeof episode.score === "number" &&
    episode.score > 9 &&
    typeof episode.anime?.mal_id === "number"
  );

  const animeIds = [...new Set(candidates.map((episode) => episode.anime!.mal_id!))];
  const airedByAnime = new Map<number, Map<number, string>>();
  // Respect Tenrai's public 4 requests/second limit.
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

  const episodes = candidates.flatMap((episode) => {
    const anime = episode.anime!;
    const animeId = anime.mal_id!;
    const aired = airedByAnime.get(animeId)?.get(episode.mal_id!);
    if (!aired) return [];
    const episodeNumber = episode.url?.match(/\/episode\/(\d+)/)?.[1] || "";
    return [{
      id: `${animeId}-${episode.mal_id}`,
      animeId,
      animeTitle: anime.title || "",
      animeUrl: anime.url || "",
      poster: anime.images?.webp?.image_url || anime.images?.jpg?.image_url || "",
      episodeNumber: episodeNumber ? `Episodio ${episodeNumber}` : "",
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
