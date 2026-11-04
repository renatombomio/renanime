import type { APIRoute } from "astro";
import {
  getCurrentAnimeSeason,
  getSeasonDateRange,
  normalizeEpisodeScore,
  type AnimeSeason,
} from "../../lib/season-episodes";

export const prerender = false;
export const config = { maxDuration: 60 };

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const JIKAN_ENDPOINT = "https://api.jikan.moe/v4";
const ANILIST_PAGE_SIZE = 50;
const MAX_ANILIST_PAGES = 3;
const MAX_ANIME_CANDIDATES = 40;
const JIKAN_DELAY_MS = 450;

interface SeasonAnime {
  id: number;
  idMal: number | null;
  title: { romaji?: string | null; english?: string | null };
  popularity: number;
  coverImage?: { extraLarge?: string | null; large?: string | null };
}

interface JikanEpisode {
  mal_id: number;
  title?: string | null;
  aired?: string | null;
  score?: number | null;
  filler?: boolean;
  recap?: boolean;
}

interface JikanEpisodesResponse {
  data?: JikanEpisode[];
  pagination?: { last_visible_page?: number };
}

const ANILIST_QUERY = `
  query SeasonAnime($page: Int!, $perPage: Int!, $season: MediaSeason!, $seasonYear: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(
        type: ANIME
        season: $season
        seasonYear: $seasonYear
        format_in: [TV, ONA]
        sort: POPULARITY_DESC
      ) {
        id
        idMal
        title { romaji english }
        popularity
        coverImage { extraLarge large }
      }
    }
  }
`;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSeasonAnime(season: AnimeSeason, year: number): Promise<SeasonAnime[]> {
  const all: SeasonAnime[] = [];

  for (let page = 1; page <= MAX_ANILIST_PAGES; page += 1) {
    const response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: ANILIST_QUERY,
        variables: { page, perPage: ANILIST_PAGE_SIZE, season, seasonYear: year },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error(`AniList returned HTTP ${response.status}`);
    const payload = await response.json() as {
      data?: { Page?: { pageInfo?: { hasNextPage?: boolean }; media?: SeasonAnime[] } };
      errors?: { message: string }[];
    };

    if (payload.errors?.length) {
      throw new Error(payload.errors.map((item) => item.message).join("; "));
    }

    const result = payload.data?.Page;
    if (!result) throw new Error("AniList returned an empty season page.");
    all.push(...(result.media ?? []));
    if (!result.pageInfo?.hasNextPage) break;
  }

  return all
    .filter((anime) => anime.idMal && anime.idMal > 0)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, MAX_ANIME_CANDIDATES);
}

async function fetchJikanPage(malId: number, page: number): Promise<JikanEpisodesResponse> {
  const response = await fetch(`${JIKAN_ENDPOINT}/anime/${malId}/episodes?page=${page}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 429) throw new Error("Jikan rate limit reached.");
  if (!response.ok) throw new Error(`Jikan returned HTTP ${response.status} for anime ${malId}`);
  return await response.json() as JikanEpisodesResponse;
}

function isWithinSeason(aired: string | null | undefined, from: Date, to: Date): boolean {
  if (!aired) return false;
  const timestamp = Date.parse(aired);
  return Number.isFinite(timestamp) && timestamp >= from.getTime() && timestamp <= to.getTime();
}

export const GET: APIRoute = async () => {
  const now = new Date();
  const current = getCurrentAnimeSeason(now);
  const range = getSeasonDateRange(current.season, current.year);
  const generatedAt = now.toISOString();

  try {
    const anime = await fetchSeasonAnime(current.season, current.year);
    const ranked = [];
    let requests = 0;
    let jikanErrors = 0;

    for (const [index, title] of anime.entries()) {
      if (index > 0) await wait(JIKAN_DELAY_MS);

      try {
        const firstPage = await fetchJikanPage(title.idMal as number, 1);
        requests += 1;
        let episodes = firstPage.data ?? [];
        const lastPage = firstPage.pagination?.last_visible_page ?? 1;

        if (lastPage > 1) {
          await wait(JIKAN_DELAY_MS);
          const latestPage = await fetchJikanPage(title.idMal as number, lastPage);
          requests += 1;
          episodes = [...episodes, ...(latestPage.data ?? [])];
        }

        for (const episode of episodes) {
          if (!isWithinSeason(episode.aired, range.from, range.to)) continue;
          const score = normalizeEpisodeScore(episode.score);
          if (score === null) continue;

          ranked.push({
            animeId: title.id,
            malId: title.idMal,
            animeTitle: title.title.english || title.title.romaji || "Untitled",
            episodeId: episode.mal_id,
            episodeNumber: episode.mal_id,
            episodeTitle: episode.title || null,
            airedAt: episode.aired,
            score,
            sourceScore: episode.score,
            cover: title.coverImage?.extraLarge || title.coverImage?.large || null,
            animePopularity: title.popularity,
            source: "MyAnimeList via Jikan",
          });
        }
      } catch {
        jikanErrors += 1;
      }
    }

    const unique = new Map<string, (typeof ranked)[number]>();
    for (const episode of ranked) {
      unique.set(`${episode.malId}:${episode.episodeId}`, episode);
    }

    const episodes = [...unique.values()]
      .sort((a, b) =>
        b.score - a.score ||
        Date.parse(b.airedAt ?? "") - Date.parse(a.airedAt ?? "") ||
        b.animePopularity - a.animePopularity
      )
      .slice(0, 5)
      .map(({ animePopularity: _popularity, sourceScore: _sourceScore, ...episode }, index) => ({
        ...episode,
        rank: index + 1,
      }));

    return new Response(JSON.stringify({
      success: true,
      generatedAt,
      season: current.season,
      seasonYear: current.year,
      window: { from: range.from.toISOString(), to: range.to.toISOString() },
      diagnostics: {
        animeCandidates: anime.length,
        jikanRequests: requests,
        jikanErrors,
        scoredEpisodesFound: ranked.length,
        episodesReturned: episodes.length,
      },
      episodes,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=1209600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      season: current.season,
      seasonYear: current.year,
      error: error instanceof Error ? error.message : "Unable to generate the season episode ranking.",
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
};
