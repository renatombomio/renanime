import type { APIRoute } from "astro";

type AniListAiring = {
  episode: number;
  airingAt: number;
  media: {
    id: number;
    idMal: number | null;
    title: { romaji: string | null; english: string | null };
    popularity: number | null;
    isAdult: boolean;
    format: string | null;
    bannerImage: string | null;
    coverImage: { large: string | null; color: string | null } | null;
  };
};

type JikanEpisode = {
  mal_id?: number;
  title?: string | null;
  title_japanese?: string | null;
  title_romanji?: string | null;
  aired?: string | null;
  score?: number | null;
  [key: string]: unknown;
};

const ANILIST_URL = "https://graphql.anilist.co";
const JIKAN_URL = "https://api.jikan.moe/v4";
const MAX_ANILIST_PAGES = 10;
const MAX_CANDIDATES = 10;
const JIKAN_INTERVAL_MS = 1_100;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getUtcWeekRange() {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - weekday);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  return {
    from: Math.floor(monday.getTime() / 1000),
    to: Math.floor(nextMonday.getTime() / 1000),
    fromISO: monday.toISOString(),
    toISO: nextMonday.toISOString(),
  };
}

async function fetchAiringPage(page: number, from: number, to: number) {
  const query = `
    query WeeklyEpisodeDiagnostics($page: Int!, $from: Int!, $to: Int!) {
      Page(page: $page, perPage: 50) {
        pageInfo { currentPage hasNextPage total }
        airingSchedules(
          airingAt_greater: $from
          airingAt_lesser: $to
          notYetAired: false
          sort: TIME
        ) {
          episode
          airingAt
          media {
            id
            idMal
            title { romaji english }
            popularity
            isAdult
            format
            bannerImage
            coverImage { large color }
          }
        }
      }
    }`;
  const response = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { page, from, to } }),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, retryAfter: response.headers.get("retry-after"), payload };
}

export const GET: APIRoute = async ({ request }) => {
  // This diagnostic is intentionally available only on Vercel Preview deployments.
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response("Not found", { status: 404 });
  }

  const week = getUtcWeekRange();
  const anilist = {
    status: 0,
    pagesRead: 0,
    pageInfo: null as unknown,
    errors: null as unknown,
    returnedAirings: 0,
    retryAfter: null as string | null,
  };
  const allAirings: AniListAiring[] = [];

  try {
    for (let page = 1; page <= MAX_ANILIST_PAGES; page++) {
      const result = await fetchAiringPage(page, week.from, week.to);
      anilist.status = result.status;
      anilist.retryAfter = result.retryAfter;
      if (!result.payload?.data?.Page) {
        anilist.errors = result.payload?.errors ?? result.payload ?? "AniList returned no Page data";
        break;
      }
      const pageData = result.payload.data.Page;
      anilist.pagesRead = page;
      anilist.pageInfo = pageData.pageInfo;
      anilist.errors = result.payload.errors ?? null;
      allAirings.push(...(pageData.airingSchedules ?? []));
      if (!pageData.pageInfo?.hasNextPage) break;
      if (page === MAX_ANILIST_PAGES) {
        anilist.errors = "Diagnostic pagination cap reached; result set may be incomplete";
      }
    }
  } catch (error) {
    anilist.errors = error instanceof Error ? error.message : "AniList request failed";
  }

  const eligibleAirings = allAirings
    .filter((airing) => airing.media && !airing.media.isAdult && airing.media.idMal && airing.episode > 0)
    .sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0));

  // Keep one scheduled episode per anime: the most popular eligible entry.
  const uniqueCandidates = new Map<number, AniListAiring>();
  for (const airing of eligibleAirings) {
    if (!uniqueCandidates.has(airing.media.idMal!)) {
      uniqueCandidates.set(airing.media.idMal!, airing);
    }
  }
  const candidates = [...uniqueCandidates.values()].slice(0, MAX_CANDIDATES);

  const jikanResults: Array<Record<string, unknown>> = [];
  for (let index = 0; index < candidates.length; index++) {
    const airing = candidates[index];
    if (index > 0) await wait(JIKAN_INTERVAL_MS);

    const url = `${JIKAN_URL}/anime/${airing.media.idMal}/episodes/${airing.episode}`;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await response.json().catch(() => null);
      const episode = payload?.data as JikanEpisode | undefined;
      jikanResults.push({
        animeTitle: airing.media.title.romaji ?? airing.media.title.english,
        anilistId: airing.media.id,
        idMal: airing.media.idMal,
        episodeNumber: airing.episode,
        airingAt: new Date(airing.airingAt * 1000).toISOString(),
        httpStatus: response.status,
        retryAfter: response.headers.get("retry-after"),
        episodeFields: episode ? Object.keys(episode) : [],
        episode: episode ? {
          malEpisodeId: episode.mal_id ?? null,
          title: episode.title ?? null,
          aired: episode.aired ?? null,
          score: typeof episode.score === "number" ? episode.score : null,
          scoredBy: typeof episode.scored_by === "number" ? episode.scored_by : null,
        } : null,
        apiErrors: payload?.errors ?? payload?.message ?? null,
      });

      // Respect rate limiting immediately; do not keep sending requests after 429.
      if (response.status === 429) {
        for (const skipped of candidates.slice(index + 1)) {
          jikanResults.push({
            animeTitle: skipped.media.title.romaji ?? skipped.media.title.english,
            idMal: skipped.media.idMal,
            episodeNumber: skipped.episode,
            skipped: true,
            reason: "Stopped after Jikan HTTP 429",
          });
        }
        break;
      }
    } catch (error) {
      jikanResults.push({
        animeTitle: airing.media.title.romaji ?? airing.media.title.english,
        idMal: airing.media.idMal,
        episodeNumber: airing.episode,
        requestError: error instanceof Error ? error.message : "Jikan request failed",
      });
    }
  }

  const scored = jikanResults.filter((item) => {
    const episode = item.episode as { score?: number | null } | null;
    return typeof episode?.score === "number" && episode.score > 0;
  });

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    week,
    limits: {
      maxAniListPages: MAX_ANILIST_PAGES,
      anilistPerPage: 50,
      maxJikanCandidates: MAX_CANDIDATES,
      jikanRequestIntervalMs: JIKAN_INTERVAL_MS,
      jikanEndpoint: "/anime/{malId}/episodes/{episodeNumber}",
      matching: "Exact episode number in the Jikan path; no comparison against the episode's mal_id.",
    },
    anilist: {
      ...anilist,
      returnedAirings: allAirings.length,
      eligibleAirings: eligibleAirings.length,
      candidates: candidates.map((airing) => ({
        title: airing.media.title.romaji ?? airing.media.title.english,
        anilistId: airing.media.id,
        idMal: airing.media.idMal,
        popularity: airing.media.popularity,
        episode: airing.episode,
        airingAt: new Date(airing.airingAt * 1000).toISOString(),
      })),
    },
    jikan: {
      checked: jikanResults.length,
      withScore: scored.length,
      withoutScore: jikanResults.filter((item) => !item.skipped && !(item.episode as { score?: number | null } | null)?.score).length,
      results: jikanResults,
    },
  }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
};
