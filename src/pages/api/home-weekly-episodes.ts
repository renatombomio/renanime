import type { APIRoute } from "astro";

type AniListSchedule = {
  episode: number;
  airingAt: number;
  media: {
    id: number;
    idMal: number | null;
    title: { romaji: string | null; english: string | null };
    popularity: number | null;
    isAdult: boolean;
    bannerImage: string | null;
    coverImage: { color: string | null };
    format: string | null;
    tags: Array<{ name: string; category: string }>;
  };
};

type JikanEpisode = {
  mal_id: number;
  title?: string | null;
  aired?: string | null;
  score?: number | null;
  scored_by?: number | null;
  filler?: boolean;
  recap?: boolean;
};

type JikanEpisodeResponse = { data?: JikanEpisode[] };

const ANILIST = "https://graphql.anilist.co";
const JIKAN = "https://api.jikan.moe/v4";
const MAX_ANILIST_PAGES = 10;
const MAX_CANDIDATES = 10;
const MAX_FEATURED_EPISODES = 5;
const JIKAN_BATCH_SIZE = 2;
const JIKAN_INTERVAL_MS = 1_100;

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function getCurrentWeekRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

async function getAiringPage(page: number, from: number, to: number) {
  const query = `
    query WeeklyEpisodes($page: Int!, $from: Int!, $to: Int!) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
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
            bannerImage
            coverImage { color }
            format
            tags { name category }
          }
        }
      }
    }`;

  const response = await fetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { page, from, to } }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`AniList request failed: ${response.status}`);
  const payload = await response.json() as {
    data?: { Page?: { pageInfo?: { hasNextPage?: boolean }; airingSchedules?: AniListSchedule[] } };
    errors?: { message: string }[];
  };
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  if (!payload.data?.Page) throw new Error("AniList returned no schedule page.");
  return payload.data.Page;
}

async function getAnimeEpisodePage(malId: number, episodeNumber: number) {
  const page = Math.floor((episodeNumber - 1) / 100) + 1;
  const response = await fetch(
    `${JIKAN}/anime/${malId}/episodes?page=${page}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
  );

  if (response.status === 429) return { status: 429, episodes: [] as JikanEpisode[] };
  if (!response.ok) return { status: response.status, episodes: [] as JikanEpisode[] };

  const payload = await response.json() as JikanEpisodeResponse;
  return { status: response.status, episodes: payload.data ?? [] };
}

export const GET: APIRoute = async () => {
  const { start, end } = getCurrentWeekRange();
  const from = Math.floor(start.getTime() / 1000);
  const to = Math.floor(end.getTime() / 1000);
  const schedules: AniListSchedule[] = [];
  let pagesRead = 0;
  let hasNextPage = true;

  try {
    for (let page = 1; page <= MAX_ANILIST_PAGES && hasNextPage; page += 1) {
      const result = await getAiringPage(page, from, to);
      schedules.push(...(result.airingSchedules ?? []));
      pagesRead = page;
      hasNextPage = Boolean(result.pageInfo?.hasNextPage);
    }
  } catch {
    return new Response(JSON.stringify({
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
      episodes: [],
      error: "No se ha podido recuperar el calendario semanal de AniList.",
    }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  // One airing per anime: keep the latest aired episode of the current week.
  const latestByAnime = new Map<number, AniListSchedule>();
  for (const item of schedules) {
    const media = item.media;
    if (!media || media.isAdult || !media.idMal || media.idMal <= 0 || !item.episode) continue;
    const previous = latestByAnime.get(media.id);
    if (!previous || item.airingAt > previous.airingAt) latestByAnime.set(media.id, item);
  }

  const candidates = [...latestByAnime.values()]
    .sort((a, b) => (b.media.popularity ?? 0) - (a.media.popularity ?? 0))
    .slice(0, MAX_CANDIDATES);

  const enriched: Array<{
    airing: AniListSchedule;
    episode: JikanEpisode;
  }> = [];
  let jikanRateLimited = false;

  // Jikan's episode-list endpoint contains the episode score. Match by the
  // episode number within the anime, never by a global episode record ID.
  for (let offset = 0; offset < candidates.length; offset += JIKAN_BATCH_SIZE) {
    if (offset > 0) await wait(JIKAN_INTERVAL_MS);
    const batch = candidates.slice(offset, offset + JIKAN_BATCH_SIZE);
    const results = await Promise.all(batch.map(async (airing) => {
      const response = await getAnimeEpisodePage(
        airing.media.idMal as number,
        airing.episode,
      );
      return { airing, ...response };
    }));

    for (const result of results) {
      if (result.status === 429) {
        jikanRateLimited = true;
        continue;
      }
      const match = result.episodes.find((episode) => episode.mal_id === result.airing.episode);
      if (match && typeof match.score === "number" && match.score > 0) {
        enriched.push({ airing: result.airing, episode: match });
      }
    }

    if (jikanRateLimited) break;
  }

  const episodes = enriched
    .sort((a, b) =>
      (b.episode.score ?? 0) - (a.episode.score ?? 0) ||
      (b.episode.scored_by ?? 0) - (a.episode.scored_by ?? 0)
    )
    .slice(0, MAX_FEATURED_EPISODES)
    .map(({ airing, episode }) => {
      const media = airing.media;
      const demographic = media.tags?.find((tag) =>
        tag.category.toLowerCase().includes("demographic")
      )?.name ?? null;

      return {
        id: `${media.id}-${airing.episode}`,
        animeId: media.id,
        animeTitle: media.title.romaji || media.title.english || "Sin título",
        animeUrl: `/anime/${media.id}/`,
        poster: media.bannerImage || "",
        banner: media.bannerImage,
        tint: media.coverImage?.color ?? null,
        format: media.format,
        demographic,
        episodeNumber: `Episodio ${airing.episode}`,
        episode: airing.episode,
        episodeTitle: episode.title || "",
        score: Math.round((episode.score ?? 0) * 200) / 100,
        votes: episode.scored_by ?? 0,
        aired: episode.aired || new Date(airing.airingAt * 1000).toISOString(),
        filler: episode.filler ?? false,
        recap: episode.recap ?? false,
        url: `/anime/${media.id}/`,
      };
    });

  return new Response(JSON.stringify({
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    episodes,
    diagnostics: {
      anilistPagesRead: pagesRead,
      schedulesFound: schedules.length,
      eligibleAnime: latestByAnime.size,
      jikanCandidates: candidates.length,
      episodesWithScore: enriched.length,
      jikanRateLimited,
    },
    source: "AniList weekly airing schedule + Jikan episode ratings",
  }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
};
