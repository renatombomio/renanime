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
type EpisodeRecord = { mal_id?: number; aired?: string | null; title?: string };
const JIKAN = "https://api.jikan.moe/v4";

function getCurrentWeekRange() {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);
  return { start: monday.toISOString().slice(0, 10), end: nextMonday.toISOString().slice(0, 10) };
}
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch { return null; }
}
function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export const GET: APIRoute = async () => {
  const { start: WEEK_START, end: WEEK_END } = getCurrentWeekRange();

  // Jikan's top episode endpoint exposes episode ratings; episode-list endpoints
  // expose the original air date. Episode scores are displayed on a 1–10 scale.
  const topPages = await Promise.all([1, 2].map((page) =>
    getJson<{ data?: TopEpisode[] }>(`${JIKAN}/top/episodes?limit=25&page=${page}`)
  ));
  const candidates = topPages.flatMap((payload) => payload?.data ?? []).filter((episode) =>
    typeof episode.mal_id === "number" &&
    typeof episode.score === "number" &&
    episode.score > 0 &&
    typeof episode.anime?.mal_id === "number"
  );

  const animeIds = [...new Set(candidates.map((episode) => episode.anime!.mal_id!))];
  const airedByAnime = new Map<number, Map<number, string>>();

  // Jikan rate limit: keep requests sequential and paced.
  for (const animeId of animeIds) {
    const payload = await getJson<{ data?: EpisodeRecord[] }>(`${JIKAN}/anime/${animeId}/episodes?page=1`);
    const records = payload?.data ?? [];
    const map = new Map<number, string>();
    for (const record of records) {
      if (typeof record.mal_id !== "number" || !record.aired) continue;
      const date = record.aired.slice(0, 10);
      if (date >= WEEK_START && date < WEEK_END) map.set(record.mal_id, date);
    }
    airedByAnime.set(animeId, map);
    await wait(350);
  }

  const episodes = candidates.flatMap((episode) => {
    const anime = episode.anime!;
    const animeId = anime.mal_id!;
    const aired = airedByAnime.get(animeId)?.get(episode.mal_id!);
    if (!aired) return [];
    const episodeNumber = episode.mal_id!;
    return [{
      id: `${animeId}-${episodeNumber}`,
      animeId,
      animeTitle: anime.title || "",
      animeUrl: anime.url || "",
      poster: anime.images?.webp?.image_url || anime.images?.jpg?.image_url || "",
      episodeNumber: `Episodio ${episodeNumber}`,
      episodeTitle: episode.title || "",
      score: Math.round(episode.score! * 100) / 100,
      votes: episode.scored_by || 0,
      aired,
      url: anime.url || episode.url || "",
    }];
  }).sort((a, b) => b.score - a.score || b.votes - a.votes).slice(0, 5);

  return new Response(JSON.stringify({
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    episodes,
    source: "Jikan API v4 / MyAnimeList",
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
};
