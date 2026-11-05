import type { APIRoute } from "astro";

type Season = "WINTER" | "SPRING" | "SUMMER" | "FALL";

type AniListAnime = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null; color: string | null };
  bannerImage: string | null;
  format: string | null;
  season: Season | null;
  seasonYear: number | null;
};

type JikanEpisode = {
  mal_id: number;
  title: string | null;
  score: number | null;
  scored_by: number | null;
  url: string;
};

type JikanEpisodesResponse = {
  data: JikanEpisode[];
};

const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";
const CANDIDATE_LIMIT = 12;
const REQUEST_BATCH_SIZE = 3;
const JIKAN_BATCH_DELAY_MS = 1100;

function getCurrentSeason(date = new Date()): { season: Season; year: number } {
  const month = date.getUTCMonth();
  const season: Season =
    month < 3 ? "WINTER" :
    month < 6 ? "SPRING" :
    month < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getUTCFullYear() };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Upstream request failed (${response.status}): ${new URL(url).pathname}`);
  }
  return await response.json() as T;
}

async function getSeasonAnime(season: Season, year: number): Promise<AniListAnime[]> {
  const query = `query SeasonAnime($season: MediaSeason!, $year: Int!) {
    Page(page: 1, perPage: ${CANDIDATE_LIMIT}) {
      media(type: ANIME, season: $season, seasonYear: $year, format_in: TV, sort: POPULARITY_DESC) {
        id idMal title { romaji english }
        coverImage { large color }
        bannerImage format season seasonYear
      }
    }
  }`;
  const result = await getJson<{
    data?: { Page?: { media?: AniListAnime[] } };
    errors?: Array<{ message?: string }>;
  }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { season, year } }),
  });
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).filter(Boolean).join("; "));
  return result.data?.Page?.media ?? [];
}

async function getAnimeEpisodes(idMal: number): Promise<JikanEpisode[]> {
  const result = await getJson<JikanEpisodesResponse>(`${JIKAN}/anime/${idMal}/episodes?page=1`);
  return Array.isArray(result.data) ? result.data : [];
}

export const GET: APIRoute = async () => {
  const { season, year } = getCurrentSeason();

  try {
    const anime = await getSeasonAnime(season, year);
    const candidates = anime.filter((item) => item.idMal && item.id).slice(0, CANDIDATE_LIMIT);
    if (!candidates.length) {
      return Response.json({ season, year, episodes: [], status: "ok", source: "AniList + MyAnimeList via Jikan" }, {
        headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200" },
      });
    }

    const episodes: Array<{
      id: string;
      animeId: number;
      animeTitle: string;
      animeUrl: string;
      poster: string;
      episode: number;
      episodeNumber: string;
      episodeTitle: string;
      score: number;
      votes: number;
      url: string;
    }> = [];
    let failedCandidates = 0;

    for (let offset = 0; offset < candidates.length; offset += REQUEST_BATCH_SIZE) {
      if (offset > 0) await delay(JIKAN_BATCH_DELAY_MS);
      const batch = candidates.slice(offset, offset + REQUEST_BATCH_SIZE);
      const settled = await Promise.allSettled(batch.map(async (animeItem) => ({
        anime: animeItem,
        episodes: await getAnimeEpisodes(animeItem.idMal!),
      })));

      for (const result of settled) {
        if (result.status === "rejected") {
          failedCandidates += 1;
          console.error("[season-episodes] Jikan candidate failed:", result.reason);
          continue;
        }
        const { anime: animeItem, episodes: animeEpisodes } = result.value;
        for (const episode of animeEpisodes) {
          if (typeof episode.score !== "number" || episode.score <= 0) continue;
          episodes.push({
            id: `${animeItem.id}-${episode.mal_id}`,
            animeId: animeItem.id,
            animeTitle: animeItem.title.english || animeItem.title.romaji || "Untitled",
            animeUrl: `/anime/${animeItem.id}/`,
            poster: animeItem.coverImage.large || animeItem.bannerImage || "",
            episode: episode.mal_id,
            episodeNumber: `Episode ${episode.mal_id}`,
            episodeTitle: episode.title || "",
            score: episode.score,
            votes: episode.scored_by || 0,
            url: `/anime/${animeItem.id}/`,
          });
        }
      }
    }

    episodes.sort((a, b) => b.score - a.score || b.votes - a.votes);
    const status = failedCandidates === candidates.length ? "degraded" : failedCandidates > 0 ? "partial" : "ok";

    return Response.json({
      season,
      year,
      episodes: episodes.slice(0, 10),
      status,
      failedCandidates,
      candidateCount: candidates.length,
      source: "MyAnimeList episode ratings via Jikan API v4; seasonal anime from AniList",
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
      },
    });
  } catch (error) {
    console.error("[season-episodes] Season ranking unavailable:", error);
    return Response.json({
      season,
      year,
      episodes: [],
      status: "degraded",
      error: "SEASON_EPISODES_UNAVAILABLE",
    }, {
      status: 503,
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  }
};
