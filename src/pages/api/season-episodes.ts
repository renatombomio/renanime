import type { APIRoute } from "astro";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const JIKAN_ENDPOINT = "https://api.jikan.moe/v4";
const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const MAX_ANIME = 10;
const JIKAN_INTERVAL_MS = 1_100;

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji?: string | null; english?: string | null };
  popularity?: number | null;
  season?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  coverImage?: { extraLarge?: string | null; large?: string | null };
  bannerImage?: string | null;
}

interface AiringSchedule {
  id: number;
  airingAt: number;
  episode: number;
  media: AniListMedia;
}

interface AniListPage {
  Page?: {
    pageInfo?: { hasNextPage?: boolean };
    airingSchedules?: AiringSchedule[];
  };
}

interface JikanEpisode {
  mal_id: number;
  title?: string | null;
  title_japanese?: string | null;
  title_romanji?: string | null;
  aired?: string | null;
  score?: number | null;
  filler?: boolean;
  recap?: boolean;
}

interface JikanResponse {
  data?: JikanEpisode;
}

const QUERY = `
  query WeeklyAiringSchedule(
    $page: Int!,
    $perPage: Int!,
    $from: Int!,
    $to: Int!
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      airingSchedules(
        airingAt_greater: $from,
        airingAt_lesser: $to,
        notYetAired: false,
        sort: TIME
      ) {
        id
        airingAt
        episode
        media {
          id
          idMal
          title { romaji english }
          popularity
          season
          seasonYear
          episodes
          coverImage { extraLarge large }
          bannerImage
        }
      }
    }
  }
`;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchAiringPage(page: number, from: number, to: number): Promise<AniListPage> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { page, perPage: PAGE_SIZE, from, to },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`AniList request failed with status ${response.status}`);
  }

  const payload = await response.json() as { data?: AniListPage; errors?: { message: string }[] };
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  if (!payload.data?.Page) throw new Error("AniList returned an empty schedule page.");
  return payload.data;
}

async function fetchJikanEpisode(malId: number, episodeNumber: number): Promise<JikanEpisode | null> {
  const response = await fetch(
    `${JIKAN_ENDPOINT}/anime/${malId}/episodes/${episodeNumber}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
  );

  if (response.status === 404) return null;
  if (response.status === 429) {
    throw new Error("Jikan rate limit reached.");
  }
  if (!response.ok) {
    throw new Error(`Jikan request failed with status ${response.status}`);
  }

  const payload = await response.json() as JikanResponse;
  return payload.data ?? null;
}

export const GET: APIRoute = async () => {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 7 * 24 * 60 * 60;
  const to = now;
  const schedules: AiringSchedule[] = [];
  let hasNextPage = true;
  let pagesRead = 0;

  try {
    for (let page = 1; page <= MAX_PAGES && hasNextPage; page += 1) {
      const result = await fetchAiringPage(page, from, to);
      const pageSchedules = result.Page?.airingSchedules ?? [];
      schedules.push(...pageSchedules);
      hasNextPage = Boolean(result.Page?.pageInfo?.hasNextPage);
      pagesRead = page;

      const eligibleCount = new Set(
        schedules
          .filter((item) => item.media?.idMal && item.media.idMal > 0)
          .map((item) => item.media.id),
      ).size;

      if (eligibleCount >= MAX_ANIME) break;
    }

    const latestByAnime = new Map<number, AiringSchedule>();
    for (const schedule of schedules) {
      const media = schedule.media;
      if (!media?.idMal || media.idMal <= 0 || !media.id || !media.title) continue;
      if (latestByAnime.has(media.id)) continue;
      latestByAnime.set(media.id, schedule);
    }

    const candidates = [...latestByAnime.values()]
      .sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0))
      .slice(0, MAX_ANIME);

    const episodes = [];
    const enrichmentErrors: { animeId: number; episode: number; message: string }[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const schedule = candidates[index];
      if (index > 0) await sleep(JIKAN_INTERVAL_MS);

      try {
        const jikanEpisode = await fetchJikanEpisode(
          schedule.media.idMal as number,
          schedule.episode,
        );

        episodes.push({
          anime: {
            anilistId: schedule.media.id,
            malId: schedule.media.idMal,
            title: schedule.media.title.romaji || schedule.media.title.english || "Untitled",
            titleEnglish: schedule.media.title.english || null,
            popularity: schedule.media.popularity ?? 0,
            season: schedule.media.season ?? null,
            seasonYear: schedule.media.seasonYear ?? null,
            totalEpisodes: schedule.media.episodes ?? null,
            cover: schedule.media.coverImage?.extraLarge || schedule.media.coverImage?.large || null,
            banner: schedule.media.bannerImage ?? null,
          },
          episode: {
            number: schedule.episode,
            airingAt: new Date(schedule.airingAt * 1000).toISOString(),
            title: jikanEpisode?.title ?? null,
            titleJapanese: jikanEpisode?.title_japanese ?? null,
            aired: jikanEpisode?.aired ?? null,
            score: jikanEpisode?.score ?? null,
            filler: jikanEpisode?.filler ?? false,
            recap: jikanEpisode?.recap ?? false,
            jikanFound: Boolean(jikanEpisode),
          },
        });
      } catch (error) {
        enrichmentErrors.push({
          animeId: schedule.media.id,
          episode: schedule.episode,
          message: error instanceof Error ? error.message : "Unknown Jikan error",
        });
        episodes.push({
          anime: {
            anilistId: schedule.media.id,
            malId: schedule.media.idMal,
            title: schedule.media.title.romaji || schedule.media.title.english || "Untitled",
            titleEnglish: schedule.media.title.english || null,
            popularity: schedule.media.popularity ?? 0,
            season: schedule.media.season ?? null,
            seasonYear: schedule.media.seasonYear ?? null,
            totalEpisodes: schedule.media.episodes ?? null,
            cover: schedule.media.coverImage?.extraLarge || schedule.media.coverImage?.large || null,
            banner: schedule.media.bannerImage ?? null,
          },
          episode: {
            number: schedule.episode,
            airingAt: new Date(schedule.airingAt * 1000).toISOString(),
            title: null,
            titleJapanese: null,
            aired: null,
            score: null,
            filler: false,
            recap: false,
            jikanFound: false,
          },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generatedAt: new Date().toISOString(),
      window: { from: new Date(from * 1000).toISOString(), to: new Date(to * 1000).toISOString() },
      diagnostics: {
        pagesRead,
        schedulesFound: schedules.length,
        uniqueAnimeFound: latestByAnime.size,
        candidatesSelected: candidates.length,
        episodesReturned: episodes.length,
        jikanErrors: enrichmentErrors,
      },
      episodes,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unable to load weekly episodes.",
      diagnostics: { pagesRead, schedulesFound: schedules.length },
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
};
