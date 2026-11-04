import type { APIRoute } from "astro";

type AniListSchedule = {
  episode: number;
  airingAt: number;
  media: {
    id: number;
    idMal: number | null;
    title: { romaji: string | null };
    bannerImage: string | null;
    coverImage: { color: string | null };
    format: string | null;
    tags: Array<{ name: string; category: string }>;
  };
};
type TopEpisode = {
  mal_id?: number;
  title?: string;
  url?: string;
  score?: number;
  scored_by?: number;
  anime?: { mal_id?: number; title?: string; url?: string };
};
const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";

function getCurrentWeekRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}
async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch { return null; }
}
async function getAiringSchedule(from: number, to: number): Promise<AniListSchedule[]> {
  const query = `query WeeklyEpisodes($from: Int!, $to: Int!) {
    Page(page: 1, perPage: 50) {
      airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
        episode airingAt
        media { id idMal title { romaji } bannerImage coverImage { color } format tags { name category } }
      }
    }
  }`;
  const result = await getJson<{ data?: { Page?: { airingSchedules?: AniListSchedule[] } } }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { from, to } }),
  });
  return result?.data?.Page?.airingSchedules ?? [];
}

export const GET: APIRoute = async () => {
  const { start, end } = getCurrentWeekRange();
  const from = Math.floor(start.getTime() / 1000);
  const to = Math.floor(end.getTime() / 1000);
  const schedule = await getAiringSchedule(from, to);

  // Build a precise key from MAL anime ID + episode number, using AniList only
  // for the current week's airing dates and Renanime's internal anime detail IDs.
  const scheduled = new Map<string, AniListSchedule>();
  for (const item of schedule) {
    if (!item.media?.idMal || !item.media.id || !item.episode) continue;
    scheduled.set(item.media.idMal + ":" + item.episode, item);
  }

  // Jikan supplies episode rating data. Its public top list is global/all-time,
  // so only episodes that also match this week's AniList schedule are eligible.
  const topPages = await Promise.all([1, 2, 3, 4].map((page) =>
    getJson<{ data?: TopEpisode[] }>(`${JIKAN}/top/episodes?limit=25&page=${page}`)
  ));
  const candidates = topPages.flatMap((payload) => payload?.data ?? []);
  const results = candidates.flatMap((episode) => {
    const malId = episode.anime?.mal_id;
    const episodeNumber = episode.mal_id;
    if (!malId || !episodeNumber || typeof episode.score !== "number" || episode.score <= 0) return [];
    const airing = scheduled.get(malId + ":" + episodeNumber);
    if (!airing) return [];
    const media = airing.media;
    const demographic = media.tags?.find((tag) => tag.category.toLowerCase().includes("demographic"))?.name ?? null;
    return [{
      id: media.id + "-" + episodeNumber,
      animeId: media.id,
      animeTitle: media.title.romaji || "",
      animeUrl: "/anime/" + media.id + "/",
      poster: media.bannerImage || "",
      banner: media.bannerImage,
      tint: media.coverImage?.color ?? null,
      format: media.format,
      demographic,
      episodeNumber: "Episodio " + episodeNumber,
      episode: episodeNumber,
      episodeTitle: episode.title || "",
      // AnimeGraphs documents the MAL episode scale as 1–5 and displays it as 1–10.
      score: Math.round(episode.score * 200) / 100,
      votes: episode.scored_by || 0,
      aired: new Date(airing.airingAt * 1000).toISOString(),
      url: "/anime/" + media.id + "/",
    }];
  });

  const unique = [...new Map(results.map((episode) => [episode.id, episode])).values()];
  unique.sort((a, b) => b.score - a.score || b.votes - a.votes);
  return new Response(JSON.stringify({
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    episodes: unique.slice(0, 5),
    source: "Jikan API v4 episode ratings + AniList weekly airing schedule",
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
};
